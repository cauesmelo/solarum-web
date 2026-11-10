/** Solarum's adaptive score: pure musical logic (RESEARCH_MUSIC.md). No Web
 * Audio, DOM or clock here; audio.mjs renders what this module decides, and
 * the tests drive it with recorded runs.
 *
 * Units: positions are 107 BPM sixteenths from waking (bar 1 = sixteenths
 * 0-15); times are simulation seconds unless named `audio`; pitches are MIDI
 * numbers; detune in cents.
 *
 * Principles (brief section 5):
 * - Harmony belongs to places, the pulse to time. The transport ticks every
 *   sixteenth of simulation time; at sync anchors it re-phases by whole
 *   sixteenths so the bar (and chord) matches the place (path clock).
 * - Every action has an immediate body sound (audio.mjs cues, never delayed)
 *   and a pitched voice from this module, quantised to the grid under a
 *   hard cap and always picked from the current chord's safe notes.
 * - Mistakes detune the bed through the hidden tuning value H (<= 20 cents),
 *   never Diana's voice; clean play retunes it. Gentle music keeps H = 1.
 */

export const BPM = 107;
export const BEAT = 60 / BPM; // 0.5607 s
export const SIXTEENTH = BEAT / 4; // 0.14019 s = 37.85 px of run
export const BAR = 16; // sixteenths
/** "On the grid": an action this close to a grid point plays at once (audio
 * seconds; 35 ms is inside the ~40 ms interactive A/V tolerance). */
export const TOLERANCE = 0.035;
/** Hard caps on how long a pitched voice may wait for its grid point (audio
 * seconds, brief 3 "Latency"): inputs 70 ms, landings 35 ms, pickups and
 * blooms 140 ms (their sparkle is instant), Great Stars one beat. */
export const CAPS = Object.freeze({ input: 0.07, landing: 0.035, pickup: 0.14, bloom: 0.14, great: 0.28, world: 0.14 });
/** A score note (a star the baked main route takes) further than this from
 * its intended sixteenth counts as an error: it still snaps to the grid, but
 * plays loose (softer, wetter, slightly blurred) and H dips. Seconds. */
export const LOOSE = 0.07;

/* ---------- pitch ---------- */
const PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const pcName = (m) => PC_NAMES[((Math.round(m) % 12) + 12) % 12];
export const pc = (m) => ((Math.round(m) % 12) + 12) % 12;
/** D major's pitch classes; G# (8) is the Lydian colour reserved for Great
 * Stars and the Earth reveal. */
export const DIATONIC = Object.freeze([2, 4, 6, 7, 9, 11, 1]);
export const EARTH_PC = 8;

/** Chords of the soundtrack's measured cycle (Bm | F#m D | F#m D | G) and its
 * colours. `safe` are the pitch classes a free voice may use over the chord
 * (brief 5.5): D major pentatonic is safe over Bm, D and G, but its D is a
 * flat-6 rub over F#m, so each chord has its own set. `pad` is the bed's
 * voicing (sevenths and add9s for float; colours like C# over G live only
 * here), `bass` the felt-bass root (D2-B2). */
export const CHORDS = Object.freeze({
  Bm: { name: "Bm", root: 11, bass: 47, tones: [11, 2, 6], safe: [11, 2, 4, 6, 9], pad: [59, 62, 66, 69] },
  "F#m": { name: "F#m", root: 6, bass: 42, tones: [6, 9, 1], safe: [6, 9, 11, 1, 4], pad: [57, 61, 64, 66] },
  D: { name: "D", root: 2, bass: 38, tones: [2, 6, 9], safe: [2, 4, 6, 9, 11], pad: [57, 62, 66, 69] },
  G: { name: "G", root: 7, bass: 43, tones: [7, 11, 2], safe: [7, 9, 11, 2, 4], pad: [55, 59, 62, 66] },
  Dadd9: { name: "Dadd9", root: 2, bass: 38, tones: [2, 6, 9, 4], safe: [2, 4, 6, 9, 11], pad: [57, 62, 64, 66] },
  "Gmaj7#11": { name: "Gmaj7#11", root: 7, bass: 43, tones: [7, 11, 2, 6], safe: [7, 9, 11, 2, 4], pad: [59, 62, 66, 73] },
  // D Lydian: the chapter's only sustained G#, at the door with three Great Stars.
  Earth: { name: "Dmaj7#11", root: 2, bass: 38, tones: [2, 6, 9, 1, 8], safe: [2, 4, 6, 8, 9, 11, 1], pad: [62, 66, 68, 73] },
});
const C = CHORDS;
/** The score map in bars (1-based) and the chord of each half bar (brief
 * 5.4). The main route is 35 bars to the door (score-path.mjs). */
const CYCLE = [[C.Bm, C.Bm], [C["F#m"], C.D], [C["F#m"], C.D], [C.G, C.G]];
const CYCLE_III = [[C.Bm, C.Bm], [C["F#m"], C.Dadd9], [C["F#m"], C.Dadd9], [C["Gmaj7#11"], C["Gmaj7#11"]]];
export const SECTIONS = Object.freeze([
  { id: "wake", from: 1, to: 2 }, // Bm pedal: Sky, Signal
  { id: "I", from: 3, to: 10 }, // the cycle twice; Pulse enters
  { id: "II", from: 11, to: 22 }, // three cycles; shaker; earned Glass
  { id: "hearth", from: 23, to: 24 }, // G -> D, the pulse rests
  { id: "III", from: 25, to: 34 }, // the cycle with Gmaj7#11 and Dadd9
  { id: "coda", from: 35, to: Infinity }, // D: every earned layer plays the theme
]);
export const barOf = (pos) => Math.floor(pos / BAR) + 1;
export function sectionOf(pos) {
  const bar = barOf(pos);
  return SECTIONS.find((q) => bar >= q.from && bar <= q.to) ?? SECTIONS[0];
}
/** The chord at score position `pos` (sixteenths). */
export function chordAt(pos) {
  const bar = barOf(Math.max(0, pos)),
    half = Math.floor((((Math.max(0, pos) % BAR) + BAR) % BAR) / 8);
  if (bar <= 2) return C.Bm;
  if (bar <= 10) return CYCLE[(bar - 3) % 4][half];
  if (bar <= 22) return CYCLE[(bar - 11) % 4][half];
  if (bar === 23) return C.G;
  if (bar === 24) return C.D;
  if (bar <= 32) return CYCLE_III[(bar - 25) % 4][half];
  if (bar === 33) return C.Bm;
  if (bar === 34) return C["Gmaj7#11"];
  return C.Dadd9;
}
export const isSafe = (chord, m) => chord.safe.includes(pc(m));
/** The safe pitch nearest to `target` (ties go up). */
export function nearestSafe(chord, target) {
  for (let d = 0; d < 12; d++) {
    if (isSafe(chord, target + d)) return target + d;
    if (isSafe(chord, target - d)) return target - d;
  }
  return target;
}
/** The lowest safe pitch at or above `target`. */
export function safeAtOrAbove(chord, target) {
  for (let d = 0; d < 12; d++) if (isSafe(chord, target + d)) return target + d;
  return target;
}
/** The chord's root in [lo, lo + 12). */
export function rootIn(chord, lo) {
  return lo + ((chord.root - pc(lo) + 12) % 12);
}
/** Chord tones that are also safe for a free voice (a Gmaj7#11's F# and C#
 * stay in the pad), from `lo` up to `hi` inclusive, ascending. */
export function chordTones(chord, lo, hi) {
  const out = [];
  for (let m = lo; m <= hi; m++) if (chord.tones.includes(pc(m)) && chord.safe.includes(pc(m))) out.push(m);
  return out;
}

/* ---------- authored notes ----------
 * Every constellation star has a composed note, checked by a test against
 * the chord at the star's baked sixteenth (score-path.mjs). The phrases quote
 * the soundtrack's top line (D5 C#5 B4 | A4 ...) and answer it. */
export const PHRASES = Object.freeze({
  // bars 3-4 (Bm | F#m D): the motif's head, as in the brief: D5 | C#5 B4 A4.
  "first-song": [74, 73, 71, 69],
  // bar 8 (F#m | D): climbing with the double jump, A4 B4 C#5 | E5.
  "climb-song": [69, 71, 73, 76],
  // the star well (upper line, about bars 18-19, G | Bm): E5 | D5 B4 A4 F#4.
  "well-song": [76, 74, 71, 69, 66],
  // bar 25 (Bm): the cape opens on a falling Bm line, F#5 E5 D5 B4.
  "flight-line": [78, 76, 74, 71],
  // bar 27 (F#m | Dadd9): the answer, falling home, F#5 E5 C#5 | B4 A4.
  "split-song": [78, 76, 73, 71, 69],
  // the star cache (ability line, about bar 31, F#m | Dadd9): E5 F#5 A5 B5.
  "cache-song": [76, 78, 81, 83],
  // bar 33 (Bm): the last phrase climbs to the high B, B4 D5 F#5 B5.
  "finale-song": [71, 74, 78, 83],
});
/** The Signal: the motif's head (3 + 3 + 2 eighths) and its answer. Offsets
 * in sixteenths from the bar line; the answer bar is F#m | D. */
export const MOTIF = Object.freeze({
  head: [[0, 74], [6, 73], [12, 71]], // D5 . . C#5 . . B4 .
  answer: [[0, 69], [2, 78], [8, 69]], // A4 F#5 . . A4 . . .
});
/** Bars on which the Signal calls (the Bm bar of each cycle). */
export const SIGNAL_BARS = Object.freeze([1, 3, 7, 11, 15, 19, 25, 29, 33]);

/* ---------- path clock ---------- */
/** Score position (sixteenths) of world x on the baked main route. */
export function pathPos(table, x) {
  const p = table.path,
    step = table.step,
    i = Math.floor((x - p[0][0]) / step);
  if (i <= 0) return p[0][1] + (x - p[0][0]) / (270 * SIXTEENTH);
  if (i >= p.length - 1) {
    const [xl, kl] = p[p.length - 1];
    return kl + (x - xl) / (270 * SIXTEENTH);
  }
  const [xa, ka] = p[i],
    [xb, kb] = p[i + 1];
  return ka + ((x - xa) / (xb - xa)) * (kb - ka);
}

/* ---------- quantiser ---------- */
/** Where a voice for an event at score position `pos` plays. Grid in
 * sixteenths; cap and tolerance in audio seconds (a sixteenth lasts
 * SIXTEENTH / timeScale of audio under Gentle pace).
 *   on:    within the tolerance of a grid point: at once, or at the point if
 *          it is still ahead (never later than the tolerance)
 *   snap:  waits for the next grid point, no longer than `cap`
 *   loose: plays at once; the voice is softened (not an error by itself) */
export function quantize(pos, { grid = 1, cap = CAPS.input, timeScale = 1, tolerance = TOLERANCE } = {}) {
  const s16 = SIXTEENTH / timeScale,
    near = Math.round(pos / grid) * grid,
    offset = (pos - near) * s16;
  if (Math.abs(offset) <= tolerance) {
    const at = Math.max(pos, near);
    return { kind: "on", pos: at, delay: (at - pos) * s16, offset };
  }
  const next = Math.ceil(pos / grid) * grid,
    wait = (next - pos) * s16;
  if (wait <= cap) return { kind: "snap", pos: next, delay: wait, offset };
  return { kind: "loose", pos, delay: 0, offset };
}

/* ---------- transport ---------- */
/** A steady 107 BPM lattice in simulation time. `shift` moves the bar
 * position by whole sixteenths without moving the lattice in time (the next
 * sixteenth still comes exactly when expected); `start` re-anchors it. */
export function createTransport() {
  let origin = 0,
    pos0 = 0,
    running = false;
  return {
    start(t, pos = 0) {
      origin = t;
      pos0 = pos;
      running = true;
    },
    stop() {
      running = false;
    },
    get running() {
      return running;
    },
    pos: (t) => pos0 + (t - origin) / SIXTEENTH,
    timeOf: (pos) => origin + (pos - pos0) * SIXTEENTH,
    shift(d) {
      pos0 += Math.round(d);
    },
  };
}

/* ---------- simulation -> audio clock ---------- */
/** Maps simulation seconds to AudioContext seconds. Every frame `follow`
 * compares where the present simulation time should sound with the audio
 * clock. The audio clock advances in 128-sample render quanta (2.7 ms at
 * 48 kHz) while frames are smooth, so the error is smoothed and ignored
 * inside a 4 ms dead band (chasing that sawtooth would wobble the grid).
 * Real drift up to `jump` (50 ms: the frame clamp, small hitches, clock
 * skew) is slewed away at 1% of tempo (the brief allows 3%); larger errors
 * re-anchor at once (a long hitch, a respawn, a resume). */
export function createClockMap({ slew = 0.01, jump = 0.05, deadband = 0.004 } = {}) {
  let sim0 = 0,
    audio0 = 0,
    scale = 1,
    set = false,
    drift = 0,
    smooth = 0,
    jumps = 0,
    maxDrift = 0;
  const toAudio = (t) => audio0 + (t - sim0) / scale;
  return {
    toAudio,
    toSim: (a) => sim0 + (a - audio0) * scale,
    anchor(t, a, s = scale) {
      sim0 = t;
      audio0 = a;
      scale = s;
      set = true;
      smooth = 0;
    },
    /** dtAudio: audio seconds since the previous call (bounds the slew). */
    follow(t, a, dtAudio, s = scale) {
      if (set && s !== scale) {
        // Gentle pace toggled: keep the present where it is, change the rate.
        audio0 = toAudio(t);
        sim0 = t;
        scale = s;
      }
      const err = a - toAudio(t);
      drift = err;
      maxDrift = Math.max(maxDrift, Math.abs(err));
      if (!set || Math.abs(err) > jump) {
        this.anchor(t, a, s);
        jumps++;
        return "jump";
      }
      smooth += 0.2 * (err - smooth);
      if (Math.abs(smooth) < deadband) return "hold";
      const max = slew * Math.max(0, dtAudio),
        step = Math.max(-max, Math.min(max, smooth));
      audio0 += step;
      smooth -= step;
      return "slew";
    },
    get scale() {
      return scale;
    },
    stats: () => ({ drift, maxDrift, jumps }),
  };
}

/* ---------- tuning value H ---------- */
export const H_MIN = 0.4;
/** The hidden tuning value (brief 5.6). Only visible errors lower it: a
 * fall, a broken constellation, a score note more than 70 ms off its beat.
 * Clean play raises it again. `mix()` turns it into the bed's detune (pads
 * +-(1 - H) x 30 cents plus tape wow (1 - H) x 20 cents, together never
 * above 20 cents), its lowpass and whether the choir may sing. */
export function createTuning({ gentle = false } = {}) {
  let H = 1,
    gentleMode = !!gentle,
    errors = 0;
  const clamp = (v) => Math.max(H_MIN, Math.min(1, v));
  const set = (v) => {
    const before = H;
    H = gentleMode ? 1 : clamp(v);
    return H - before;
  };
  return {
    get H() {
      return H;
    },
    get gentle() {
      return gentleMode;
    },
    set gentle(v) {
      gentleMode = !!v;
      if (gentleMode) H = 1;
    },
    get errors() {
      return errors;
    },
    /** kind: respawn (info.fallsHere), chain-break, loose-note, on-grid-note,
     * stable-landing, constellation, clean-bar, beacon, restart. */
    apply(kind, info = {}) {
      switch (kind) {
        case "respawn": {
          errors++;
          // Kindness: three falls at one beacon soften it, five forgive it.
          const f = info.fallsHere ?? 1;
          return set(f >= 5 ? 1 : f >= 3 ? Math.min(H, 0.8) : Math.min(H, 0.6));
        }
        case "chain-break":
          errors++;
          return set(H - 0.15);
        case "loose-note":
          errors++;
          return set(H - 0.03);
        case "on-grid-note":
          return set(H + 0.05);
        case "stable-landing":
          return set(H + 0.03);
        case "constellation":
          return set(H + 0.3);
        case "clean-bar":
          return set(H + 0.1);
        case "beacon":
        case "restart":
          return set(1);
        default:
          return 0;
      }
    },
    mix() {
      const out = 1 - H;
      let pad = out * 30,
        wow = out * 20;
      const total = pad + wow;
      if (total > 20) {
        pad *= 20 / total;
        wow *= 20 / total;
      }
      return {
        H,
        padCents: pad,
        wowCents: wow,
        totalCents: pad + wow,
        lowpass: 2000 * 2 ** (3 * H), // 16 kHz in tune, 7 kHz at H = 0.6
        choir: H >= 0.7,
        shimmer: H >= 0.7 ? 0.4 : 0.15,
      };
    },
  };
}

/* ---------- conductor ---------- */
const mulberry = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
/** Voices each layer uses (audio.mjs implements them). Player voices are
 * Diana's own notes and are never detuned by H; bed voices are the world. */
export const LAYERS = Object.freeze({
  sky: { bed: true, voices: ["pad"] },
  signal: { bed: true, voices: ["signal"] },
  pulse: { bed: true, voices: ["pulse", "shaker"] },
  steps: { bed: false, voices: ["bass"] },
  stars: { bed: false, voices: ["glass", "kalimba", "bloom"] },
  choir: { bed: true, voices: ["choir"] },
  glass: { bed: true, voices: ["celesta"] },
  strings: { bed: false, voices: ["harmonica", "vowel"] },
  earth: { bed: true, voices: ["dust"] },
});
const SIGH_BEND = -50; // cents: a broken constellation's last note sighs down
const REWIND_NOTES = 8;

/**
 * options: path (score-path.mjs PATH), cracked (Set of platform ids that
 * give no bass), chains (id -> star count), gentle, seed.
 * The engine calls wake / frame / event / ticks and renders the returned
 * notes: { layer, voice, midi | midis, pos, t, kind, delay, cap, dur, gain,
 * pan, glideTo, bend, blur }. `t` is the onset in simulation seconds.
 */
export function createConductor(options = {}) {
  const path = options.path;
  const cracked = options.cracked ?? new Set();
  const transport = createTransport();
  const tuning = createTuning({ gentle: options.gentle });
  const intended = new Map(); // star id -> baked sixteenth
  for (const a of path?.anchors ?? []) if (a.name === "star" || a.name === "chain-note") intended.set(a.id, a.k);
  const mainChains = new Set((path?.anchors ?? []).filter((a) => a.name === "constellation").map((a) => a.id));
  let rng = mulberry(options.seed ?? 7);
  let st;
  function reset() {
    st = {
      started: false,
      status: "ready",
      timeScale: 1,
      lastTick: null, // last scheduled sixteenth
      lastChord: null,
      choirUntil: -1,
      earthUntil: -1,
      windStep: 0,
      glassEarned: false,
      sus: null, // { until } broken-constellation sus4 on the pad
      melody: { step: -1, t: -9 },
      tileStep: 0,
      recent: [], // last player notes, for the rewind
      filled: new Set(),
      constellations: new Set(),
      falls: 0,
      barErrors: 0,
      lastBar: 0,
      pendingRestart: null,
      flights: 0,
      variation: 0,
      wind: false,
      glide: false,
      altitude: 0,
      played: {},
      maxDelay: {},
      layersHeard: new Set(),
      tapeStops: 0,
      rephases: [],
      door: null,
    };
  }
  reset();
  const pos = (t) => transport.pos(t);
  const placePos = (x) => (path ? pathPos(path, x) : null);
  function note(n) {
    st.played[n.voice] = (st.played[n.voice] ?? 0) + 1;
    st.layersHeard.add(n.layer);
    if (n.delay != null) st.maxDelay[n.voice] = Math.max(st.maxDelay[n.voice] ?? 0, n.delay);
    if (!LAYERS[n.layer].bed) {
      const midis = n.midis ?? [n.midi];
      for (const m of midis) st.recent.push({ midi: m, voice: n.voice });
      if (st.recent.length > REWIND_NOTES) st.recent.splice(0, st.recent.length - REWIND_NOTES);
    }
    return n;
  }
  /** A player voice for an event at simulation time t. `intended` is the
   * baked sixteenth of a score note (a star of the main route): taking it
   * more than 70 ms away from there is an error, on time retunes a little. */
  function voice(t, spec, { grid = 1, cap = CAPS.input, intended = null } = {}) {
    const p = pos(t),
      q = quantize(p, { grid, cap, timeScale: st.timeScale });
    let offBeat = false;
    if (intended != null) {
      offBeat = (Math.abs(p - intended) * SIXTEENTH) / st.timeScale > LOOSE;
      if (offBeat) {
        tuning.apply("loose-note");
        st.barErrors++;
      } else tuning.apply("on-grid-note");
    }
    const loose = q.kind === "loose" || offBeat;
    return note({
      ...spec,
      pos: q.pos,
      t: transport.timeOf(q.pos),
      kind: offBeat && q.kind !== "loose" ? "late" : q.kind,
      delay: q.delay,
      cap,
      // A loose note is softer and wetter, and (unless Gentle) slightly blurred.
      gain: (spec.gain ?? 1) * (loose ? 0.71 : 1),
      send: (spec.send ?? 0.3) * (loose ? 1.2 : 1),
      blur: loose && !tuning.gentle ? 6 + rng() * 4 : 0,
    });
  }
  const chordAtT = (t) => chordAt(pos(t));

  /* ---------- the bed: one call per sixteenth ---------- */
  function tick(k) {
    const out = [];
    const t = transport.timeOf(k),
      chord = chordAt(k),
      sec = sectionOf(k).id,
      bar = barOf(k),
      inBar = ((k % BAR) + BAR) % BAR;
    const mix = tuning.mix();
    // Bed notes sit on their own tick: nothing waits (cap 0).
    const bed = (n) => out.push(note({ ...n, pos: k, t, kind: "on", delay: 0, cap: 0 }));
    // Bar bookkeeping: an error-free bar retunes a little.
    if (inBar === 0 && bar !== st.lastBar) {
      if (st.lastBar && st.barErrors === 0) tuning.apply("clean-bar");
      st.barErrors = 0;
      st.lastBar = bar;
    }
    // Sky pad (and choir) on every chord change, and on the first tick.
    const changed = st.lastChord !== chord || st.lastTick === null;
    if (changed) {
      let midis = chord.pad;
      if (st.sus && k < st.sus.until) midis = midis.map((m) => (chord.tones[1] === pc(m) ? safeAtOrAbove(chord, m + 1) : m));
      bed({ layer: "sky", voice: "pad", midis, chord: chord.name, dur: 4 * BEAT, gain: 0.9 });
      if (k <= st.choirUntil && mix.choir) bed({ layer: "choir", voice: "choir", midis: chordTones(chord, 55, 69).slice(-3), dur: 4 * BEAT, gain: 0.8 });
      st.lastChord = chord;
    }
    if (st.sus && k >= st.sus.until) st.sus = null;
    // Pulse: a felt heartbeat on beats 1 and 3 (the half-time feel), from bar
    // 3; it rests on the hearth and breathes out in the coda.
    if (bar >= 3 && sec !== "hearth" && (inBar === 0 || inBar === 8))
      bed({ layer: "pulse", voice: "pulse", dur: 0.4, gain: (inBar === 0 ? 1 : 0.7) * (sec === "coda" ? 0.6 : 1) });
    // Shaker, 1/16 at about -30 dB, in II and III; accents on beats.
    if (sec === "II" || sec === "III") bed({ layer: "pulse", voice: "shaker", dur: 0.06, gain: inBar % 4 === 0 ? 0.5 : inBar % 2 === 0 ? 0.32 : 0.22 });
    // The Signal: the motif's head on each cycle's Bm bar, far right at first
    // and nearer and drier with progress; the full theme leads the coda.
    const rel = inBar;
    const near = Math.min(1, bar / 36);
    const signalNote = (midi, len) =>
      bed({ layer: "signal", voice: "signal", midi, dur: len * SIXTEENTH * 1.6, gain: 0.45 + 0.55 * near, pan: 0.75 - 0.45 * near, send: 0.5 - 0.25 * near });
    if (SIGNAL_BARS.includes(bar) && bar < 34) {
      // Re-entries after falls rotate the phrase (seeded by the fall count).
      const head = st.variation % 2 ? [[0, 74], [6, 76], [12, 71]] : MOTIF.head;
      for (const [at, m] of head) if (rel === at) signalNote(m, at === 12 ? 4 : 6);
    }
    // The theme closes the chapter: its head over bar 34's Gmaj7#11 (C# is
    // the Lydian #11 there), its answer over the coda's Dadd9, into the door.
    if (bar >= 34) {
      const phrase = (bar - 34) % 2 === 0 ? MOTIF.head : MOTIF.answer;
      for (const [at, m] of phrase) if (rel === at) signalNote(m, 6);
    }
    // Glass: a quiet celesta arpeggio through II, earned by the lid smash or
    // Great Star 2.
    if (sec === "II" && st.glassEarned) {
      const tones = chordTones(chord, 74, 90);
      const order = [0, 1, 2, 3, 2, 1];
      const m = tones[order[(inBar + st.variation) % order.length] % tones.length];
      bed({ layer: "glass", voice: "celesta", midi: m, dur: 0.25, gain: inBar % 4 === 0 ? 0.5 : 0.32, pan: 0.2 });
    }
    // Earth: star dust for two bars after a Great Star (G# unless the chord
    // is G, where it would be a minor ninth on the root).
    if (k <= st.earthUntil) {
      const tones = chordTones(chord, 76, 93);
      const pool = chord.root === 7 ? tones : [...tones, ...[80, 92]];
      bed({ layer: "earth", voice: "dust", midi: pool[Math.floor(rng() * pool.length)], dur: 0.35, gain: 0.5, pan: rng() * 1.2 - 0.6 });
    }
    // Strings: a rising run of chord tones while the solar wind lifts Diana.
    if (st.wind) {
      const tones = chordTones(chord, 69, 93);
      const m = tones[st.windStep++ % tones.length];
      out.push(note({ layer: "strings", voice: "harmonica", midi: m, pos: k, t, kind: "on", delay: 0, cap: 0, dur: 0.3, gain: 0.55, pan: -0.25 }));
    } else st.windStep = 0;
    st.lastTick = k;
    return out;
  }

  /* ---------- events ---------- */
  function event(e, ctx = {}) {
    st.timeScale = ctx.timeScale ?? st.timeScale;
    const t = e.time ?? 0,
      out = { notes: [], fx: [] };
    const push = (n) => n && out.notes.push(n);
    if (e.name === "wake") {
      transport.start(t, 0);
      st.started = true;
      st.status = "running";
      tuning.apply("restart");
      out.fx.push({ kind: "wake" });
      return out;
    }
    if (!transport.running) {
      if (e.name === "respawn" && e.source === "retry") return restart(t, e.x ?? 0, { penalty: false, out });
      return out;
    }
    const chord = chordAtT(t);
    switch (e.name) {
      case "jump": {
        // Glass harmonica gliding root -> fifth over the 0.38 s rise.
        const root = rootIn(chord, 62);
        push(voice(t, { layer: "strings", voice: "harmonica", midi: root, glideTo: safeAtOrAbove(chord, root + 7), glide: 0.38, dur: 0.6, gain: 0.7, pan: -0.25 }));
        break;
      }
      case "double-jump": {
        // An octave glide from the fifth to the ninth (or the next safe note).
        const fifth = safeAtOrAbove(chord, rootIn(chord, 62) + 7);
        push(voice(t, { layer: "strings", voice: "harmonica", midi: fifth, glideTo: safeAtOrAbove(chord, rootIn(chord, 74) + 2), glide: 0.3, dur: 0.6, gain: 0.6, pan: -0.25 }));
        break;
      }
      case "super-jump": {
        // Open fifths climbing, a thirty-second apart.
        const r = rootIn(chord, 62);
        const midis = [r, safeAtOrAbove(chord, r + 7), safeAtOrAbove(chord, r + 14), safeAtOrAbove(chord, r + 16)];
        push(voice(t, { layer: "stars", voice: "bloom", midis, strum: SIXTEENTH / 2, dur: 1.6, gain: 0.7 }));
        break;
      }
      case "dash": {
        // The cape holds a vowel on the fifth for the whole flight.
        st.flights++;
        const fifth = safeAtOrAbove(chord, rootIn(chord, 62) + 7);
        push(voice(t, { layer: "strings", voice: "vowel", midi: fifth, dur: 0.5 / st.timeScale + 0.2, gain: 0.7, pan: -0.25 }));
        break;
      }
      case "dive": {
        const r = rootIn(chord, 50);
        push(voice(t, { layer: "strings", voice: "harmonica", midi: r + 12, glideTo: r, glide: 0.25, dur: 0.45, gain: 0.55, pan: -0.25 }));
        break;
      }
      case "smash": {
        const tones = chordTones(chord, 86, 98).concat(chordTones(chord, 74, 85)).slice(0, 6);
        push(voice(t, { layer: "stars", voice: "shards", midis: tones, strum: SIXTEENTH / 2, dur: 1.2, gain: 0.7 }, { grid: 2, cap: CAPS.bloom }));
        st.glassEarned = true;
        break;
      }
      case "land": {
        // Steps: stable stone plays the chord's root in the felt bass. Cracks
        // are outside the score: no bass, only the gravel body sound.
        if (cracked.has(e.platform)) break;
        tuning.apply("stable-landing");
        const p = pos(t),
          q = quantize(p, { grid: 1, cap: CAPS.landing, timeScale: st.timeScale });
        const late = q.kind === "loose";
        push(
          note({
            layer: "steps",
            voice: "bass",
            midi: chordAt(q.pos).bass,
            pos: q.pos,
            t: transport.timeOf(q.pos),
            kind: q.kind,
            delay: q.delay,
            cap: CAPS.landing,
            dur: 0.7,
            // Beyond the cap the root plays at once, 6 dB down.
            gain: (e.hard ? 1 : 0.85) * (late ? 0.5 : 1),
            pan: -0.25,
          }),
        );
        if (Math.abs(q.offset) > LOOSE) {
          tuning.apply("loose-note");
          st.barErrors++;
        }
        break;
      }
      case "lip-catch": {
        // A grace scoop into the third, from the safe note just below it.
        const third = chordTones(chord, 64, 76).find((m) => pc(m) === chord.tones[1]) ?? rootIn(chord, 64);
        let from = third - 1;
        while (!isSafe(chord, from)) from--;
        push(voice(t, { layer: "strings", voice: "harmonica", midi: from, glideTo: third, glide: 0.06, dur: 0.3, gain: 0.5, pan: -0.25 }, { cap: CAPS.landing }));
        break;
      }
      case "star": {
        // Loose stars climb the chord's arpeggio; a pause restarts the run.
        const gap = t - st.melody.t;
        st.melody = { step: gap >= 0 && gap <= 1.4 ? st.melody.step + 1 : 0, t };
        const p = quantize(pos(t), { grid: 1, cap: CAPS.pickup, timeScale: st.timeScale });
        const c2 = chordAt(p.pos);
        const tones = chordTones(c2, 74, 90);
        const m = tones[st.melody.step % tones.length];
        push(voice(t, { layer: "stars", voice: "glass", midi: m, dur: 1.2, gain: 0.8 }, { cap: CAPS.pickup, intended: intended.get(e.id) }));
        track(e.id, t);
        break;
      }
      case "chain-note": {
        const id = `${e.chain}-${e.step}`;
        const phrase = PHRASES[e.chain];
        const p = quantize(pos(t), { grid: 1, cap: CAPS.pickup, timeScale: st.timeScale });
        const c2 = chordAt(p.pos);
        // The authored note when it fits where it actually lands; off the
        // intended timing, the safe note nearest to it (never a wrong note).
        let m = phrase?.[e.step] ?? 74;
        if (!isSafe(c2, m)) m = nearestSafe(c2, m);
        st.lastChainNote = m;
        push(voice(t, { layer: "stars", voice: "kalimba", midi: m, dur: 1.4, gain: 0.85 }, { cap: CAPS.pickup, intended: intended.get(id) }));
        track(id, t);
        break;
      }
      case "constellation": {
        st.constellations.add(e.chain);
        tuning.apply("constellation");
        const q = quantize(pos(t), { grid: 2, cap: CAPS.bloom, timeScale: st.timeScale });
        const c2 = chordAt(q.pos);
        const r = rootIn(c2, 62);
        push(voice(t, { layer: "stars", voice: "bloom", midis: [rootIn(c2, 50), ...chordTones(c2, r, r + 14)], strum: 0.03, dur: 3, gain: 0.8 }, { grid: 2, cap: CAPS.bloom }));
        // The choir enters for four bars (unless H is still too low).
        st.choirUntil = Math.max(st.choirUntil, q.pos + 4 * BAR);
        st.lastChord = null; // re-voice the bed with the choir at the next tick
        break;
      }
      case "chain-fade": {
        tuning.apply("chain-break");
        st.barErrors++;
        // A sigh: the last note bends down 50 cents; the pad holds a sus4
        // until the next strong beat.
        const m = st.lastChainNote ?? rootIn(chord, 74);
        push(note({ layer: "stars", voice: "kalimba", midi: m, bend: SIGH_BEND, bendTime: 0.4, pos: pos(t), t, kind: "loose", delay: 0, cap: 0, dur: 1, gain: 0.5 }));
        const p = pos(t);
        st.sus = { until: Math.ceil((p + 1) / 8) * 8 };
        st.lastChord = null;
        break;
      }
      case "great-star": {
        const q = quantize(pos(t), { grid: 4, cap: CAPS.great, timeScale: st.timeScale });
        const c2 = chordAt(q.pos);
        const tones = chordTones(c2, 74, 93);
        // The musical blue: G# rings over every chord but G.
        const midis = c2.root === 7 ? tones.slice(0, 4) : [...tones.slice(0, 3), 80];
        push(note({ layer: "earth", voice: "dust", midis, strum: SIXTEENTH / 2, pos: q.pos, t: transport.timeOf(q.pos), kind: q.kind, delay: q.delay, cap: CAPS.great, dur: 2.5, gain: 0.9 }));
        st.earthUntil = q.pos + 2 * BAR;
        if (e.id === "great-2") st.glassEarned = true;
        break;
      }
      case "checkpoint": {
        // Sync anchor first, then the cadence chime on the half bar.
        anchor(t, e.x, "beacon");
        tuning.apply("beacon");
        st.barErrors = 0;
        const q = quantize(pos(t), { grid: 8, cap: CAPS.bloom, timeScale: st.timeScale });
        const c2 = chordAt(q.pos);
        push(note({ layer: "stars", voice: "chime", midis: [safeAtOrAbove(c2, 81), safeAtOrAbove(c2, 86)], strum: SIXTEENTH, pos: q.pos, t: transport.timeOf(q.pos), kind: q.kind, delay: q.delay, cap: CAPS.bloom, dur: 2.5, gain: 0.8 }));
        break;
      }
      case "movement":
        anchor(t, e.x, "movement");
        break;
      case "cascade":
        anchor(t, e.x, "cascade");
        st.tileStep = 0;
        break;
      case "tile-drop": {
        // A marimba knock on the beat, stepping down the chord's safe notes.
        const q = quantize(pos(t), { grid: 4, cap: CAPS.world, timeScale: st.timeScale });
        const c2 = chordAt(q.pos);
        const m = nearestSafe(c2, 71 - [0, 2, 5, 7, 9, 12][Math.min(5, st.tileStep++)]);
        push(note({ layer: "pulse", voice: "marimba", midi: m, pos: q.pos, t: transport.timeOf(q.pos), kind: q.kind, delay: q.delay, cap: CAPS.world, dur: 0.6, gain: 0.8 }));
        break;
      }
      case "death": {
        // The fall: tape-stop the score, play its last notes backwards while
        // the shards fly home, then wait for control to return (respawn).
        st.falls++;
        transport.stop();
        st.status = "dead";
        out.fx.push(tuning.gentle ? { kind: "fade", seconds: 0.45 } : { kind: "tape-stop", seconds: 0.45, rewind: st.recent.slice().reverse().map((r) => ({ ...r, midi: r.midi + 12 })) });
        st.tapeStops++;
        st.recent = [];
        break;
      }
      case "respawn":
        // Retry from the pause card or R: no tape-stop and no penalty.
        if (e.source === "retry") return restart(t, e.x ?? 0, { penalty: false, out });
        break;
      case "win": {
        transport.stop();
        st.status = "won";
        const song = songState();
        st.door = { complete: song.complete, earth: !!e.earth };
        out.fx.push({ kind: "door", ...st.door, chord: e.earth ? CHORDS.Earth : CHORDS.Dadd9 });
        break;
      }
    }
    out.notes.forEach((n) => (n.chordName = chordAt(n.pos).name));
    return out;
  }
  function track(id, t) {
    if (!id || !intended.has(id)) return;
    // On time: within 70 ms (half a sixteenth) of where the main route takes it.
    if ((Math.abs(pos(t) - intended.get(id)) * SIXTEENTH) / st.timeScale <= LOOSE) st.filled.add(id);
  }
  /** Sync anchor (brief 5.2): re-phase the bar so it matches the place. */
  function anchor(t, x, why) {
    const target = placePos(x);
    if (target == null || !transport.running) return 0;
    const d = target - pos(t);
    let r = Math.round(d);
    if (r === 0) return 0;
    if (Math.abs(d) <= 8) r = Math.max(-4, Math.min(4, r)); // at most a beat per anchor
    transport.shift(r);
    // The lattice keeps its times, so already-scheduled ticks keep theirs:
    // renumber the last one instead of scheduling it again.
    if (st.lastTick !== null) st.lastTick += r;
    st.rephases.push({ why, by: r, at: t });
    st.lastChord = null;
    return r;
  }
  function restart(t, x, { penalty = true, fallsHere = 1, out = { notes: [], fx: [] } } = {}) {
    // Restart on the beacon's place in the bar (beacons sit on half bars).
    const target = placePos(x) ?? 0;
    transport.start(t, Math.round(target));
    st.status = "running";
    st.lastTick = null;
    st.lastChord = null;
    st.sus = null;
    st.choirUntil = -1;
    st.earthUntil = -1;
    st.melody = { step: -1, t: -9 };
    st.variation = st.falls;
    if (penalty) tuning.apply("respawn", { fallsHere });
    out.fx.push({ kind: "restart", pos: Math.round(target), bar: barOf(Math.round(target)) });
    return out;
  }
  function songState() {
    const total = intended.size;
    const constellations = [...mainChains].filter((c) => st.constellations.has(c)).length;
    return {
      notes: st.filled.size,
      total,
      constellations,
      totalConstellations: mainChains.size,
      falls: st.falls,
      complete: total > 0 && st.filled.size === total && constellations === mainChains.size && st.falls === 0,
    };
  }

  return {
    transport,
    tuning,
    reset() {
      reset();
      rng = mulberry(options.seed ?? 7);
    },
    wake: (t) => event({ name: "wake", time: t }),
    event,
    /** Per frame: continuous state. Returns { restart } when control has just
     * returned after a fall (the transport restarts on the beacon's bar). */
    frame({ t, x, status, timeScale = 1, inWind = false, gliding = false, y = 0, fallsHere = 1 } = {}) {
      st.timeScale = timeScale;
      st.wind = !!inWind && status === "running";
      st.glide = !!gliding && !inWind && status === "running";
      st.altitude = y;
      let res = null;
      if (st.status === "dead" && status === "running") res = restart(t, x, { penalty: true, fallsHere });
      return res;
    },
    /** Bed notes for every sixteenth not scheduled yet, from the present
     * position `now` up to the lookahead position `ahead`. A tick already in
     * the past when first seen (after a restart) is skipped, not crammed. */
    ticks(now, ahead) {
      if (!transport.running) return [];
      let k = st.lastTick === null ? Math.ceil(now - 1e-6) : st.lastTick + 1;
      if (k < Math.ceil(now - 1e-6) - 1) k = Math.ceil(now - 1e-6);
      const out = [];
      for (; k <= Math.floor(ahead + 1e-9); k++) out.push(...tick(k));
      return out;
    },
    /** The glide whistle's target pitch: chord tones by altitude (higher
     * flight, higher note), or null when not gliding. */
    whistle(t) {
      if (!st.glide) return null;
      const tones = chordTones(chordAtT(t), 79, 91);
      const lift = Math.max(0, Math.min(1, (560 - st.altitude) / 480));
      return tones[Math.min(tones.length - 1, Math.floor(lift * tones.length))];
    },
    windChord: (t) => chordAtT(t),
    get gentle() {
      return tuning.gentle;
    },
    set gentle(v) {
      tuning.gentle = v;
    },
    song: songState,
    state(t) {
      const p = transport.running ? pos(t) : null;
      return {
        running: transport.running,
        status: st.status,
        pos: p,
        bar: p == null ? null : barOf(p),
        chord: p == null ? null : chordAt(p).name,
        section: p == null ? null : sectionOf(p).id,
        ...tuning.mix(),
        gentle: tuning.gentle,
        errors: tuning.errors,
        choir: p != null && p <= st.choirUntil,
        earth: p != null && p <= st.earthUntil,
        glassEarned: st.glassEarned,
        played: { ...st.played },
        maxDelay: { ...st.maxDelay },
        layers: [...st.layersHeard].sort(),
        song: songState(),
        rephases: st.rephases.length,
        tapeStops: st.tapeStops,
        door: st.door,
      };
    },
  };
}
