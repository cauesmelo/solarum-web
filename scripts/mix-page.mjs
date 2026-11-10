/** In-page half of scripts/mix-check.mjs (loaded into soundboard.html). It
 * renders a level's perfect main run offline through the real engine and
 * returns BS.1770 loudness, peaks and a few spectral numbers per stem.
 * window.__mixStem({ level, only, cues, air, dry, mix }) -> metrics. */
import { createAudioEngine } from "/audio.mjs";
import { recordFrames } from "/tests/music-run.mjs";

const cache = new Map();
const framesOf = (level) => (cache.has(level) ? cache.get(level) : cache.set(level, recordFrames({ route: "main", level }).frames).get(level));
const KW = [
  [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
  [1, -2, 1, -1.99004745483398, 0.99007225036621],
];
function kweight(x) {
  for (const [b0, b1, b2, a1, a2] of KW) {
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      (x2 = x1), (x1 = x[i]), (y2 = y1), (y1 = v), (y[i] = v);
    }
    x = y;
  }
  return x;
}
const lk = (p) => -0.691 + 10 * Math.log10(p || 1e-20);
/** 400 ms block powers every 100 ms over [t0, t1). */
function blocks(buf, t0, t1) {
  const sr = buf.sampleRate, a = Math.floor(t0 * sr), b = Math.min(buf.length, Math.floor(t1 * sr));
  const w = [0, 1].map((c) => kweight(buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)).subarray(a, b)));
  const block = Math.round(0.4 * sr), hop = Math.round(0.1 * sr), z = [];
  for (let s = 0; s + block <= w[0].length; s += hop) {
    let sum = 0;
    for (const c of w) {
      let m = 0;
      for (let i = s; i < s + block; i++) m += c[i] * c[i];
      sum += m / block;
    }
    z.push(sum);
  }
  return z;
}
function integrated(z) {
  const abs = z.filter((p) => lk(p) > -70);
  if (!abs.length) return -Infinity;
  const rel = lk(abs.reduce((p, q) => p + q, 0) / abs.length) - 10;
  const g = abs.filter((p) => lk(p) > rel);
  return lk(g.reduce((p, q) => p + q, 0) / g.length);
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) ([re[i], re[j]] = [re[j], re[i]]), ([im[i], im[j]] = [im[j], im[i]]);
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2;
        const vr = re[b] * cr - im[b] * ci, vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr, im[b] = im[a] - vi, re[a] += vr, im[a] += vi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}
/** Median sharp partials per sounding 4096-sample frame (a peak 12 dB over its
 * +-8-bin neighbourhood: a held tone has many, air has none) and the median
 * spectral centroid. */
function spectrum(buf, t1) {
  const sr = buf.sampleRate, N = 4096, L = buf.getChannelData(0), R = buf.getChannelData(1);
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const peaks = [], cents = [];
  for (let i = 0; i + N <= Math.min(buf.length, t1 * sr); i += N) {
    const re = new Float64Array(N), im = new Float64Array(N);
    let e = 0;
    for (let j = 0; j < N; j++) {
      const v = 0.5 * (L[i + j] + R[i + j]);
      re[j] = v * win[j];
      e += v * v;
    }
    if (10 * Math.log10(e / N + 1e-20) < -55) continue;
    fft(re, im);
    const p = new Float64Array(N / 2);
    let num = 0, den = 0, pk = 0;
    for (let k = 2; k < N / 2; k++) (p[k] = re[k] * re[k] + im[k] * im[k]), (num += ((k * sr) / N) * p[k]), (den += p[k]);
    for (let k = 10; k < N / 2 - 9 && (k * sr) / N < 12000; k++) {
      if (!(p[k] > p[k - 1] && p[k] >= p[k + 1])) continue;
      const nb = [];
      for (let q = k - 8; q <= k + 8; q++) if (q !== k) nb.push(p[q]);
      nb.sort((x, y) => x - y);
      if (p[k] > 16 * nb[8] && p[k] > (1e-3 * den) / (N / 2)) pk++;
    }
    peaks.push(pk);
    cents.push(num / (den || 1));
  }
  const med = (v) => (v.length ? v.slice().sort((x, y) => x - y)[Math.floor(v.length / 2)] : null);
  return { partials: med(peaks), centroid: cents.length ? Math.round(med(cents)) : null };
}
window.__mixStem = async function ({ level = 1, only = null, cues = false, air = false, dry = false, mix = null } = {}) {
  const f = framesOf(level);
  const end = f.at(-1).wall;
  const win = f.find((q) => (q.events ?? []).some((e) => e.name === "win"))?.wall ?? end;
  const secs = win + 6;
  const sr = 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(secs * sr), sr);
  const convs = [];
  const mk = ctx.createConvolver.bind(ctx);
  ctx.createConvolver = () => (convs.push(mk()), convs.at(-1));
  let now = 0;
  const e = createAudioEngine({ context: ctx, seed: 3, only, level, mix, clock: () => now });
  e.unlock();
  if (dry) for (const c of convs.slice(1)) c.disconnect(); // the score's space and so its shimmer
  for (const q of f) {
    now = q.wall;
    for (const ev of q.events ?? []) e.event(ev, { cues, timeScale: q.timeScale });
    if (air) e.setAir({ wind: q.status === "running" && !!q.inWind, glide: q.status === "running" && !!q.gliding && !q.inWind }, now + 0.006);
    e.scoreFrame(q);
  }
  const buf = await ctx.startRendering();
  const z = blocks(buf, 0, win);
  let peak = 0;
  for (let c = 0; c < 2; c++) for (const v of buf.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
  const ml = z.map(lk);
  // The door: its first 3 s against the run before it.
  const door = integrated(blocks(buf, win, win + 3));
  return { level, win: +win.toFixed(2), lufs: +integrated(z).toFixed(1), peak: +(20 * Math.log10(peak || 1e-12)).toFixed(1), door: +door.toFixed(1), sounding: +(ml.filter((v) => v > -45).length / (ml.length || 1)).toFixed(2), ml: ml.map((v) => +v.toFixed(1)), ...spectrum(buf, win), tune: e.stats().tune };
};
window.__mixReady = true;
