/** Dev-only soundboard for audio.mjs (excluded from the itch.io ZIP).
 * Plays every cue through the game's engine, runs short gameplay-like
 * sequences, toggles the soundtrack, and exposes `window.__soundboard` so a
 * browser QA script can render each cue offline. */
import { CUES, CUE_NAMES, BEDS, createAudioEngine, renderCueOffline, MUSIC_LEVEL } from "./audio.mjs";

const $ = (id) => document.getElementById(id);
const engine = createAudioEngine({ enabled: true, seed: (Date.now() & 0xffff) + 1 });
const music = new Audio("./assets/soundtrack.mp3");
music.loop = true;
music.preload = "none";
engine.attachMusic(music, { level: MUSIC_LEVEL });
const counters = { chain: 0, tile: 0 };
let meter = null;

const GROUPS = { move: "Movement", stone: "Stone", stars: "Stars", air: "Air and cape", story: "Story moments", ui: "Interface" };
const log = (text) => ($("log").textContent = text);
function ready() {
  engine.unlock();
  if (!meter) {
    meter = engine.analyser();
    if (meter) requestAnimationFrame(drawMeter);
  }
}
/** Play one cue the way the game would (events feed the star melody). */
function fire(name, extra = {}) {
  ready();
  const t = performance.now() / 1000;
  if (name === "star") return engine.event({ name: "star", time: t });
  if (name === "chain-note") {
    const step = extra.step ?? counters.chain++ % 6;
    return engine.event({ name: "chain-note", step, count: 6, chain: "board", time: t });
  }
  if (name === "constellation") return engine.event({ name: "constellation", chain: extra.chain ?? "board", time: t });
  if (name === "tile-drop") return engine.play("tile-drop", { index: extra.index ?? counters.tile++ % 6 });
  if (name === "win") return engine.play("win", { earth: $("earth").checked });
  if (name === "fall") return engine.event({ name: "death", time: t });
  if (name === "respawn") return engine.event({ name: "respawn", time: t });
  return engine.play(name, extra);
}
function holdAir(air, seconds) {
  ready();
  engine.setAir(air);
  setTimeout(() => engine.setAir({}), seconds * 1000);
}

/* ---------- cue buttons ---------- */
const groups = $("groups");
for (const [group, title] of Object.entries(GROUPS)) {
  const names = [...CUE_NAMES.filter((n) => CUES[n].group === group), ...Object.keys(BEDS).filter((n) => BEDS[n].group === group)];
  if (!names.length) continue;
  const h = document.createElement("h2");
  h.textContent = title;
  const grid = document.createElement("div");
  grid.className = "grid";
  for (const name of names) {
    const def = CUES[name] ?? BEDS[name];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cue";
    b.dataset.cue = name;
    b.innerHTML = `<strong></strong><span></span><code></code>`;
    b.querySelector("strong").textContent = def.label;
    b.querySelector("span").textContent = def.about;
    b.querySelector("code").textContent = name;
    b.addEventListener("click", () => {
      if (BEDS[name]) holdAir(BEDS[name].air, BEDS[name].seconds);
      else fire(name);
      b.classList.add("playing");
      setTimeout(() => b.classList.remove("playing"), 160);
      log(`${def.label} (${name})`);
    });
    grid.append(b);
  }
  groups.append(h, grid);
}

/* ---------- sequences: timings follow the game (270 px/s, 88 BPM cascade) ---------- */
const BEAT = 60 / 88;
const SEQUENCES = {
  "Constellation run": [
    ...[0, 1, 2, 3, 4].map((step, i) => [i * 0.62, () => fire("chain-note", { step, chain: "seq" })]),
    [4 * 0.62, () => fire("constellation", { chain: "seq" })],
  ],
  "Loose stars (melody restarts)": [
    ...Array.from({ length: 7 }, (_, i) => [i * 0.34, () => fire("star")]),
    ...Array.from({ length: 3 }, (_, i) => [3.9 + i * 0.34, () => fire("star")]),
  ],
  "Rapid stars (voice limit)": Array.from({ length: 16 }, (_, i) => [i * 0.03, () => fire("star")]),
  "Run, jump and fly": [
    [0, () => fire("jump")],
    [0.32, () => fire("double-jump")],
    [0.7, () => fire("cape")],
    [1.4, () => fire("land-soft")],
    [1.75, () => fire("jump")],
    [2.4, () => fire("land-soft")],
    [2.6, () => fire("refill")],
    [3.0, () => fire("jump")],
    [3.25, () => fire("cape")],
    [3.5, () => fire("super-jump")],
    [4.6, () => fire("land-hard")],
  ],
  "Crumbling shelf": [
    [0, () => fire("land-soft")],
    [0.01, () => fire("crumble-shake", { duration: 0.65 })],
    [0.5, () => fire("jump")],
    [0.66, () => fire("crumble-fall")],
  ],
  "Dive smash": [
    [0, () => fire("jump")],
    [0.45, () => fire("dive")],
    [0.62, () => fire("smash")],
    [0.95, () => fire("land-hard")],
  ],
  "Beat cascade": [
    [0, () => fire("cascade")],
    ...[0, 1, 2, 3, 4, 5].map((index) => [0.6 + index * BEAT, () => fire("tile-drop", { index })]),
    ...[0, 1, 2, 3, 4, 5].map((i) => [0.6 + i * BEAT + 0.12, () => fire("jump")]),
  ],
  "Solar wind": [
    [0, () => fire("cape")],
    [0.35, () => fire("wind-catch")],
    [0.36, () => holdAir({ wind: true }, 2.4)],
    [2.9, () => holdAir({ glide: true }, 1.3)],
    [4.3, () => fire("land-soft")],
  ],
  "Fall and respawn": [
    [0, () => fire("fall")],
    [0.7, () => fire("respawn")],
  ],
  "Great Star to beacon": [
    [0, () => fire("great-star")],
    [0.7, () => fire("land-soft")],
    [0.71, () => fire("great-banked")],
    [2.0, () => fire("beacon")],
  ],
  "Movement title": [[0, () => fire("movement")]],
  "The far door": [[0, () => fire("win")]],
  "Pause freezes everything": [
    [0, () => fire("beacon")],
    [0.7, () => setPaused(true)],
    [2.2, () => setPaused(false)],
  ],
};
for (const [name, steps] of Object.entries(SEQUENCES)) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "cue";
  b.innerHTML = "<strong></strong><span></span>";
  b.querySelector("strong").textContent = name;
  const span = Math.max(...steps.map((s) => s[0]));
  b.querySelector("span").textContent = steps.length === 1 ? "one cue" : `${steps.length} cues over ${span.toFixed(1)} s`;
  b.addEventListener("click", () => {
    ready();
    log(name);
    for (const [at, run] of steps) setTimeout(run, at * 1000);
  });
  $("sequences").append(b);
}

/* ---------- mix controls ---------- */
let musicOn = false;
$("music").addEventListener("click", () => {
  ready();
  musicOn = !musicOn;
  if (musicOn) engine.playMusic({ fadeIn: 0.8 });
  else engine.stopMusic();
  $("music").setAttribute("aria-pressed", String(musicOn));
  $("music").textContent = musicOn ? "♫ Music on" : "♫ Music off";
});
function setPaused(p) {
  engine.setPaused(p);
  $("pause").setAttribute("aria-pressed", String(p));
  $("pause").textContent = p ? "Resume audio" : "Pause audio";
}
$("pause").addEventListener("click", () => {
  ready();
  setPaused(!engine.stats().paused);
});
const scratch = new Float32Array(2048);
let hold = 0;
function drawMeter() {
  meter.getFloatTimeDomainData(scratch);
  let peak = 0;
  for (const v of scratch) peak = Math.max(peak, Math.abs(v));
  hold = Math.max(peak, hold * 0.95);
  const db = 20 * Math.log10(hold || 1e-9);
  $("meter-bar").style.width = `${Math.max(0, Math.min(100, ((db + 48) / 48) * 100))}%`;
  $("meter-text").textContent = `${db < -90 ? "-inf" : db.toFixed(1)} dBFS`;
  requestAnimationFrame(drawMeter);
}

/* ---------- QA hooks (offline rendering) ---------- */
const toBase64 = (f32) => {
  const bytes = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const pack = (buffer) => ({
  sampleRate: buffer.sampleRate,
  length: buffer.length,
  channels: Array.from({ length: buffer.numberOfChannels }, (_, i) => toBase64(buffer.getChannelData(i))),
});
let track = null;
async function soundtrack(sampleRate) {
  if (!track) {
    const bytes = await (await fetch("./assets/soundtrack.mp3")).arrayBuffer();
    track = await new OfflineAudioContext(2, 1, sampleRate).decodeAudioData(bytes);
  }
  return track;
}
window.__soundboard = {
  cues: [...CUE_NAMES],
  beds: Object.keys(BEDS),
  meta: Object.fromEntries([...CUE_NAMES.map((n) => [n, { maxTail: CUES[n].maxTail, short: !!CUES[n].short, group: CUES[n].group }]), ...Object.keys(BEDS).map((n) => [n, { maxTail: BEDS[n].seconds + 2.6, short: false, group: "air" }])]),
  async render(name, { params = {}, safety = true, seed = 1 } = {}) {
    const { buffer, stats } = await renderCueOffline(name, { params, safety, seed });
    return { ...pack(buffer), nodes: stats.nodes };
  },
  /** Soundtrack (from `offset` s) through the engine's music path, with an
   * optional cue 0.5 s in: measures masking, ducking and summed peaks.
   * `music: false` renders the identical cue alone, for subtraction. */
  async renderWithMusic(name, { offset = 40, seconds = 6, params = {}, music = true } = {}) {
    const sr = 48000,
      t = await soundtrack(sr);
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
    const e = createAudioEngine({ context: ctx, seed: 1 });
    e.unlock();
    const src = ctx.createBufferSource();
    src.buffer = t;
    src.connect(e.musicInput());
    if (music) src.start(0, offset);
    if (name) e.play(name, { ...params, delay: 0.5 });
    return pack(await ctx.startRendering());
  },
  play: fire,
  stats: () => engine.stats(),
};
