/** Solarum procedural sound effects. Presentation only: nothing here reads or
 * writes the simulation, and every Web Audio call is guarded so a missing or
 * blocked AudioContext simply means silence.
 *
 * Every cue is synthesised (oscillators, FM bells, filtered noise,
 * Karplus-Strong plucks, generated crackle); the original Unity WAVs stay in
 * assets/sfx/ for provenance only. A cue is a pure recipe `build(rng, params)`
 * that returns plain numbers (layers, envelopes, sweeps), so tests can check
 * tuning and finiteness without a browser; `createAudioEngine` turns recipes
 * into nodes.
 *
 * Direction: soft, airy, intimate and musical, always under the soundtrack.
 * Rewards are melodic, danger and failure gentle. Pitches come from the
 * soundtrack's key, D major (relative B minor), measured from
 * assets/soundtrack.mp3 (README, "Sound"): peak-chroma correlation 0.88 for
 * D major, chords cycling Bm-D-F#m-G, tuning within 4 cents of A440.
 *
 * Signal flow:
 *   voice -> sfx bus -> gentle compressor -> master -> soft safety clipper -> out
 *   voice -> reverb send -> generated-impulse convolver -> master
 *   music element -> music gain (ducking) -> music tone (darkens on a fall) -> master
 */

/* ---------- settings ---------- */
export const SETTING_KEY = "solarum.sound";
/** Sound is ON unless the player explicitly turned it off. Storage may be
 * missing, blocked (sandboxed iframes throw on access) or empty; all of those
 * mean "on". `storage` is a Storage-like object or a getter returning one. */
export function readSoundSetting(storage) {
  try {
    const s = typeof storage === "function" ? storage() : storage;
    return s?.getItem(SETTING_KEY) !== "off";
  } catch {
    return true;
  }
}
export function writeSoundSetting(storage, on) {
  try {
    const s = typeof storage === "function" ? storage() : storage;
    s?.setItem(SETTING_KEY, on ? "on" : "off");
    return !!s;
  } catch {
    return false;
  }
}

/* ---------- deterministic helpers ---------- */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const spread = (rng, amount) => (rng() * 2 - 1) * amount;
export const dbToGain = (db) => 10 ** (db / 20);

/* ---------- key ---------- */
export const KEY = Object.freeze({
  name: "D major",
  relative: "B minor",
  tonic: 62, // D4
  // D E F# G A B C#: the diatonic set; melodies use the pentatonic subset so
  // they never rub against the soundtrack's Bm / D / F#m / G changes.
  pitchClasses: Object.freeze([2, 4, 6, 7, 9, 11, 1]),
  pentatonic: Object.freeze([0, 2, 4, 7, 9]), // D E F# A B
});
export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
export const pitchClass = (m) => ((Math.round(m) % 12) + 12) % 12;
export const inKey = (m) => KEY.pitchClasses.includes(pitchClass(m));
/** The `step`-th D-major-pentatonic note at or above `base` (74 = D5). */
export function penta(step, base = 74) {
  const octave = Math.floor(step / 5),
    degree = step - octave * 5;
  return base + 12 * octave + KEY.pentatonic[degree];
}
/** Loose stars climb the pentatonic scale while they keep coming; a pause
 * longer than STAR_RESET (simulation seconds) starts the run again. Time can
 * go backwards after a respawn, which also restarts it. */
export const STAR_RESET = 1.4;
export function nextStarStep(previous, time) {
  if (!previous || !(time >= previous.time) || time - previous.time > STAR_RESET) return { step: 0, time };
  return { step: previous.step + 1, time };
}
/** D5 up to F#6, then it keeps circling the upper five notes instead of
 * running out of register (long star lines never climb into harsh highs). */
export const starMidi = (step) => penta(step < 8 ? step : 3 + ((step - 8) % 5));

/* ---------- envelopes: [time, value, ramp] with ramp 'lin' | 'exp' | 'set' ---------- */
const Z = 0.0001; // -80 dB: exponential ramps cannot reach 0
export const env = {
  perc: (a, d, peak = 1) => [[0, 0], [a, peak, "lin"], [a + d, Z, "exp"]],
  swell: (a, hold, r, peak = 1) => [[0, 0], [a, peak, "lin"], [a + hold, peak, "lin"], [a + hold + r, Z, "exp"]],
  // A reversed sound: an exponential rise that is cut right at its peak.
  rise: (a, peak = 1, cut = 0.035) => [[0, Z], [a, peak, "exp"], [a + cut, Z, "exp"]],
};
export const envEnd = (points) => points[points.length - 1][0];

/* ---------- layer constructors (pure data) ---------- */
function tone(midi, o = {}) {
  const c = o.cents ?? 0,
    f0 = midiHz(midi + c / 100);
  const freq = o.glideTo != null ? [[0, f0], [o.glide ?? 0.1, midiHz(o.glideTo + c / 100), "exp"]] : [[0, f0]];
  return {
    kind: "tone",
    tonal: true,
    midi,
    midiEnd: o.glideTo,
    cents: c,
    wave: o.wave ?? "sine",
    freq,
    env: o.env ?? env.perc(0.005, 0.3),
    gain: o.gain ?? 0.2,
    at: o.at ?? 0,
    filter: o.filter,
    pan: o.pan,
  };
}
/** Unpitched body (thumps, booms): a sine sweep, deliberately not "a note". */
function thump(from, to, sweep, o = {}) {
  return {
    kind: "tone",
    tonal: false,
    wave: "sine",
    freq: [[0, from], [sweep, to, "exp"]],
    env: o.env ?? env.perc(0.003, 0.12),
    gain: o.gain ?? 0.3,
    at: o.at ?? 0,
    filter: o.filter,
  };
}
/** Two-operator FM: a sine carrier whose frequency is modulated by a sine at
 * `ratio` x carrier, with depth `index` x modulator frequency over time.
 * Integer ratios read as glass / music box; 3.5 reads as a soft bell. */
function fm(midi, o = {}) {
  const c = o.cents ?? 0;
  return {
    kind: "fm",
    tonal: true,
    midi,
    cents: c,
    hz: midiHz(midi + c / 100),
    ratio: o.ratio ?? 4,
    index: o.index ?? [[0, 1], [0.1, 0.1, "exp"]],
    env: o.env ?? env.perc(0.003, 0.5),
    gain: o.gain ?? 0.2,
    at: o.at ?? 0,
    pan: o.pan,
  };
}
function pluck(midi, o = {}) {
  const c = o.cents ?? 0;
  return {
    kind: "pluck",
    tonal: true,
    midi,
    cents: c,
    hz: midiHz(midi),
    rate: 2 ** (c / 1200), // jitter via playback rate so cached strings stay exact
    t60: o.t60 ?? 0.9,
    bright: o.bright ?? 0.35,
    gain: o.gain ?? 0.3,
    at: o.at ?? 0,
    pan: o.pan,
  };
}
function noise(o = {}) {
  return {
    kind: "noise",
    tonal: false,
    color: o.color ?? "pink",
    filter: o.filter ?? { type: "bandpass", freq: 1000, q: 0.8 },
    highpass: o.highpass,
    am: o.am,
    env: o.env ?? env.perc(0.005, 0.2),
    gain: o.gain ?? 0.2,
    at: o.at ?? 0,
    pan: o.pan,
  };
}
/** Sparse grains of noise (stone, leaves, glass dust), generated per play. */
function crackle(o = {}) {
  return {
    kind: "crackle",
    tonal: false,
    dur: o.dur ?? 0.3,
    from: o.from ?? 60, // grains per second at the start...
    to: o.to ?? o.from ?? 60, // ...and at the end
    rise: o.rise ?? [1, 1], // amplitude at start / end
    grain: o.grain ?? 0.004, // seconds per grain (decaying burst)
    filter: { type: "bandpass", freq: o.band ?? 1500, q: o.q ?? 0.7 },
    gain: o.gain ?? 0.2,
    at: o.at ?? 0,
    seed: o.seed ?? 1,
    pan: o.pan,
  };
}
export function layerEnd(L) {
  if (L.kind === "pluck") return L.at + L.t60 + 0.05;
  if (L.kind === "crackle") return L.at + L.dur + 0.02;
  return L.at + envEnd(L.env);
}
function voice(spec) {
  spec.dur = Math.max(...spec.layers.map(layerEnd));
  return spec;
}

/* ---------- timbres ---------- */
// Music-box glass: FM at two octaves; the brightness falls away in 80 ms so
// only the first touch shines.
const glass = (midi, rng, o = {}) =>
  fm(midi, {
    ratio: 4,
    index: [[0, o.bright ?? 0.8], [0.08, 0.12, "exp"]],
    env: env.perc(0.002, o.decay ?? 0.5),
    gain: o.gain ?? 0.2,
    at: o.at,
    cents: spread(rng, 3),
    pan: o.pan,
  });
// A soft bell: inharmonic 3.5 ratio with a slowly closing index.
const bell = (midi, rng, o = {}) =>
  fm(midi, {
    ratio: o.ratio ?? 3.5,
    index: [[0, o.index ?? 1.1], [o.decay ?? 1.2, 0.05, "exp"]],
    env: env.perc(o.attack ?? 0.003, o.decay ?? 1.2),
    gain: o.gain ?? 0.15,
    at: o.at,
    cents: spread(rng, 3),
    pan: o.pan,
  });
// Kalimba: a felt-soft Karplus-Strong tine plus a sine body for warmth.
const kalimba = (midi, rng, o = {}) => {
  const c = spread(rng, 3),
    decay = o.decay ?? 0.9;
  return [
    pluck(midi, { t60: decay, bright: o.bright ?? 0.32, gain: o.gain ?? 0.3, at: o.at, cents: c, pan: o.pan }),
    tone(midi, { env: env.perc(0.004, decay * 0.6), gain: (o.gain ?? 0.3) * 0.45, at: o.at, cents: c, pan: o.pan }),
  ];
};
// A pad: each chord tone is a pair of triangles detuned a few cents apart
// (slow chorus) and panned apart, under one lowpass.
const pad = (midis, rng, o = {}) =>
  midis.flatMap((m, i) =>
    [-1, 1].map((side) =>
      tone(m, {
        wave: "triangle",
        cents: side * (4 + rng() * 4),
        env: o.env,
        gain: o.gain ?? 0.05,
        at: (o.at ?? 0) + (o.strum ?? 0) * i + rng() * 0.012,
        filter: { type: "lowpass", freq: o.cutoff ?? 1200, q: 0.5 },
        pan: side * 0.4,
      }),
    ),
  );
// Air above the bloom: pink noise in a band, never a white hiss.
const shimmer = (o = {}) =>
  noise({
    filter: { type: "bandpass", freq: o.from ?? 4500, q: 0.7 },
    env: o.env ?? env.swell(0.3, 0.1, 1.2),
    gain: o.gain ?? 0.02,
    at: o.at,
  });

/* ---------- the cue book ----------
 * gain: voice level; send: reverb send; limit: concurrent voices of this cue
 * (the oldest is faded out); minGap: seconds of audio time a repeat must wait
 * (otherwise it is dropped); maxTail: rendered audible length bound including
 * reverb (tests); short: dry length must stay under 0.6 s; duck: music dip in
 * dB with attack / hold / release seconds. */
export const CUES = {
  wake: {
    group: "story",
    label: "Wake",
    about: "Leaf rustle, a soft rising breath and two kalimba notes as Diana pops out of the soil",
    limit: 1,
    minGap: 0.3,
    maxTail: 4,
    build: (rng) =>
      voice({
        gain: 0.33,
        send: 0.35,
        layers: [
          crackle({ dur: 0.3, from: 150, to: 50, rise: [1, 0.3], band: 2200, q: 0.8, grain: 0.003, gain: 0.18, seed: rng() * 1e9 }),
          noise({ filter: { type: "bandpass", freq: [[0, 600], [0.25, 1600, "exp"]], q: 0.8 }, env: env.perc(0.08, 0.25), gain: 0.16 }),
          tone(62, { glideTo: 69, glide: 0.16, env: env.perc(0.012, 0.32), gain: 0.2, cents: spread(rng, 3) }),
          ...kalimba(81, rng, { at: 0.12, gain: 0.3, decay: 1.0 }),
          ...kalimba(86, rng, { at: 0.26, gain: 0.2, decay: 1.1 }),
        ],
      }),
  },
  jump: {
    group: "move",
    label: "Jump",
    about: "A small soft 'hup': a pitched breath puff over a low sine lifting D3 to A3",
    limit: 3,
    minGap: 0.03,
    short: true,
    maxTail: 1.6,
    build: (rng) =>
      voice({
        gain: 0.69,
        send: 0.08,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 800 * (1 + spread(rng, 0.06))], [0.09, 1300, "exp"]], q: 1.1 }, env: env.perc(0.004, 0.11), gain: 0.32 }),
          tone(50, { glideTo: 57, glide: 0.08, env: env.perc(0.003, 0.12), gain: 0.3, cents: spread(rng, 3) }),
        ],
      }),
  },
  "double-jump": {
    group: "move",
    label: "Double jump",
    about: "Higher and lighter: a thinner breath, A3 to D4 and a tiny F#6 glint for the spark",
    limit: 3,
    minGap: 0.03,
    short: true,
    maxTail: 1.8,
    build: (rng) =>
      voice({
        gain: 0.97,
        send: 0.15,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 1500 * (1 + spread(rng, 0.06))], [0.08, 2300, "exp"]], q: 1.3 }, env: env.perc(0.003, 0.09), gain: 0.26 }),
          tone(57, { glideTo: 62, glide: 0.07, env: env.perc(0.003, 0.1), gain: 0.2, cents: spread(rng, 3) }),
          glass(90, rng, { at: 0.012, gain: 0.07, decay: 0.25, bright: 0.5 }),
        ],
      }),
  },
  "super-jump": {
    group: "move",
    label: "Super jump",
    about: "A rising whoosh with a four-bell sparkle climbing D6 F#6 A6 D7",
    limit: 2,
    minGap: 0.1,
    short: true,
    maxTail: 3,
    build: (rng) =>
      voice({
        gain: 0.74,
        send: 0.3,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 500], [0.32, 3000, "exp"]], q: 0.9 }, env: [[0, 0], [0.06, 1, "lin"], [0.22, 0.7, "lin"], [0.45, Z, "exp"]], gain: 0.32 }),
          tone(50, { glideTo: 62, glide: 0.2, env: env.perc(0.005, 0.25), gain: 0.22, cents: spread(rng, 3) }),
          ...[86, 90, 93, 98].map((m, i) => bell(m, rng, { at: 0.05 + i * 0.042, gain: 0.07, decay: 0.38, ratio: 2, index: 0.5, pan: -0.3 + i * 0.2 })),
        ],
      }),
  },
  cape: {
    group: "move",
    label: "Cape flight",
    about: "A breathy filtered-noise whoosh that opens and settles over the 0.5 s flight, with a soft fabric flutter",
    limit: 2,
    minGap: 0.08,
    short: false,
    maxTail: 2,
    build: (rng) =>
      voice({
        gain: 0.55,
        send: 0.2,
        layers: [
          noise({
            filter: { type: "bandpass", freq: [[0, 600], [0.12, 1500 * (1 + spread(rng, 0.06)), "exp"], [0.5, 900, "exp"]], q: 0.8 },
            env: [[0, 0], [0.05, 1, "lin"], [0.38, 0.55, "lin"], [0.62, Z, "exp"]],
            gain: 0.36,
          }),
          // The flutter: amplitude modulation at about 14 Hz on a brighter band.
          noise({
            filter: { type: "bandpass", freq: 1900, q: 0.7 },
            am: { rate: 13 + rng() * 3, depth: 0.8 },
            env: [[0, 0], [0.08, 1, "lin"], [0.45, 0.4, "lin"], [0.6, Z, "exp"]],
            gain: 0.09,
          }),
        ],
      }),
  },
  dive: {
    group: "move",
    label: "Dive",
    about: "A descending air rush (2.6 kHz to 380 Hz) over a sine falling A3 to D3",
    limit: 2,
    minGap: 0.06,
    short: true,
    maxTail: 1.8,
    build: (rng) =>
      voice({
        gain: 0.69,
        send: 0.12,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 2600], [0.3, 380, "exp"]], q: 1 }, env: [[0, 0], [0.03, 1, "lin"], [0.22, 0.6, "lin"], [0.36, Z, "exp"]], gain: 0.34 }),
          tone(57, { glideTo: 50, glide: 0.25, env: env.perc(0.01, 0.25), gain: 0.16, cents: spread(rng, 3) }),
        ],
      }),
  },
  "land-soft": {
    group: "move",
    label: "Land (soft)",
    about: "A muted padded thump; kept quiet because it happens constantly",
    limit: 2,
    minGap: 0.06,
    short: true,
    maxTail: 1,
    build: (rng) =>
      voice({
        gain: 0.41,
        send: 0.03,
        layers: [
          thump(130 * (1 + spread(rng, 0.05)), 75, 0.06, { env: env.perc(0.002, 0.09), gain: 0.34 }),
          noise({ color: "brown", filter: { type: "lowpass", freq: 520, q: 0.5 }, env: env.perc(0.002, 0.05), gain: 0.3 }),
        ],
      }),
  },
  "land-hard": {
    group: "move",
    label: "Land (hard)",
    about: "A deeper, longer thump with a little gravel, only after big falls or dives",
    limit: 2,
    minGap: 0.06,
    short: true,
    maxTail: 1.2,
    build: (rng) =>
      voice({
        gain: 0.37,
        send: 0.06,
        layers: [
          thump(120 * (1 + spread(rng, 0.05)), 52, 0.12, { env: env.perc(0.002, 0.2), gain: 0.5 }),
          noise({ color: "brown", filter: { type: "lowpass", freq: 700, q: 0.5 }, env: env.perc(0.002, 0.09), gain: 0.4 }),
          crackle({ dur: 0.12, from: 220, to: 60, rise: [1, 0.2], band: 1400, q: 0.8, gain: 0.12, seed: rng() * 1e9 }),
        ],
      }),
  },
  "lip-catch": {
    group: "move",
    label: "Ledge catch",
    about: "A tiny pat and an E4-A4 lift when a near miss pops onto the lip",
    limit: 1,
    minGap: 0.1,
    short: true,
    maxTail: 1,
    build: (rng) =>
      voice({
        gain: 1.0,
        send: 0.08,
        layers: [
          noise({ filter: { type: "bandpass", freq: 1800, q: 1.5 }, env: env.perc(0.002, 0.03), gain: 0.19 }),
          tone(64, { glideTo: 69, glide: 0.05, env: env.perc(0.003, 0.07), gain: 0.1, cents: spread(rng, 3) }),
        ],
      }),
  },
  "crumble-shake": {
    group: "stone",
    label: "Shelf shakes",
    about: "Dry stone crackle that starts quietly as a cracked shelf shakes and builds until it gives (params.duration)",
    limit: 3,
    minGap: 0.05,
    maxTail: 1.6,
    build: (rng, p = {}) => {
      const d = Math.min(Math.max(p.duration ?? 0.65, 0.2), 1.5);
      return voice({
        gain: 0.43,
        send: 0.08,
        layers: [
          crackle({ dur: d, from: 18, to: 120, rise: [0.25, 1], band: 1600, q: 0.7, gain: 0.3, seed: rng() * 1e9 }),
          noise({ color: "brown", filter: { type: "lowpass", freq: 190, q: 0.7 }, env: [[0, 0], [d, 1, "lin"], [d + 0.08, Z, "exp"]], gain: 0.22 }),
        ],
      });
    },
  },
  "crumble-fall": {
    group: "stone",
    label: "Shelf falls",
    about: "The crunch when the shelf drops: dense crackle, a low thud and a few trailing pebbles",
    limit: 2,
    minGap: 0.05,
    short: false,
    maxTail: 2,
    build: (rng) =>
      voice({
        gain: 0.61,
        send: 0.15,
        layers: [
          crackle({ dur: 0.22, from: 280, to: 40, rise: [1, 0.3], band: 1200, q: 0.6, gain: 0.32, seed: rng() * 1e9 }),
          noise({ color: "brown", filter: { type: "lowpass", freq: 420, q: 0.5 }, env: env.perc(0.004, 0.25), gain: 0.34 }),
          thump(95, 48, 0.25, { env: env.perc(0.003, 0.3), gain: 0.3 }),
          crackle({ at: 0.12, dur: 0.5, from: 22, to: 6, rise: [0.6, 0.2], band: 2200, q: 0.8, grain: 0.003, gain: 0.12, seed: rng() * 1e9 }),
        ],
      }),
  },
  cascade: {
    group: "stone",
    label: "Cascade wakes",
    about: "A distant low rumble with falling dust when the beat cascade arms",
    limit: 1,
    minGap: 0.5,
    maxTail: 3.5,
    build: (rng) =>
      voice({
        gain: 0.22,
        send: 0.25,
        layers: [
          noise({ color: "brown", filter: { type: "lowpass", freq: 220, q: 0.6 }, env: [[0, 0], [0.6, 1, "lin"], [1.6, Z, "exp"]], gain: 0.34 }),
          crackle({ dur: 1.2, from: 30, to: 12, rise: [0.4, 0.1], band: 2500, q: 0.7, grain: 0.003, gain: 0.08, seed: rng() * 1e9 }),
          tone(38, { env: env.swell(0.5, 0.2, 0.8), gain: 0.12, cents: spread(rng, 3) }),
        ],
      }),
  },
  "tile-drop": {
    group: "stone",
    label: "Cascade tile",
    about: "A tuned stone-marimba knock on the beat, stepping down B4 A4 F#4 E4 D4 B3 (params.index)",
    limit: 3,
    minGap: 0.1,
    short: true,
    maxTail: 2,
    build: (rng, p = {}) => {
      const index = Math.max(0, Math.min(5, Math.floor(p.index ?? 0))),
        m = penta(4 - index, 62),
        c = spread(rng, 3);
      return voice({
        gain: 0.73,
        send: 0.2,
        layers: [
          tone(m, { env: env.perc(0.002, 0.28), gain: 0.34, cents: c }),
          tone(m + 24, { env: env.perc(0.001, 0.05), gain: 0.07, cents: c }), // the marimba's two-octave partial
          noise({ color: "white", filter: { type: "bandpass", freq: 2500, q: 1 }, env: env.perc(0.001, 0.012), gain: 0.08 }),
          crackle({ at: 0.01, dur: 0.15, from: 140, to: 30, rise: [1, 0.2], band: 1300, q: 0.7, gain: 0.12, seed: rng() * 1e9 }),
        ],
      });
    },
  },
  smash: {
    group: "stone",
    label: "Dive smash",
    about: "A glassy shatter of six pentatonic shards (D6-D7) over a soft low boom",
    limit: 2,
    minGap: 0.08,
    maxTail: 3,
    build: (rng) => {
      const shards = [86, 88, 90, 93, 95, 98].map((m, i) =>
        glass(m, rng, { at: rng() * 0.07, gain: 0.06 + rng() * 0.04, decay: 0.2 + rng() * 0.3, bright: 0.6, pan: spread(rng, 0.5) }),
      );
      return voice({
        gain: 0.56,
        send: 0.3,
        layers: [
          ...shards,
          crackle({ dur: 0.18, from: 320, to: 60, rise: [1, 0.2], band: 2600, q: 0.5, gain: 0.2, seed: rng() * 1e9 }),
          thump(82, 40, 0.35, { env: env.perc(0.004, 0.45), gain: 0.42 }),
          noise({ color: "brown", filter: { type: "lowpass", freq: 300, q: 0.5 }, env: env.perc(0.005, 0.35), gain: 0.3 }),
        ],
      });
    },
  },
  "wind-catch": {
    group: "air",
    label: "Wind catch",
    about: "An airy rising swell with a faint A4/E5 fifth when a flight enters the solar wind",
    limit: 1,
    minGap: 0.2,
    maxTail: 2.5,
    build: (rng) =>
      voice({
        gain: 0.55,
        send: 0.35,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 400], [0.5, 1500, "exp"]], q: 0.7 }, env: [[0, 0], [0.18, 1, "lin"], [0.75, Z, "exp"]], gain: 0.32 }),
          tone(69, { env: env.perc(0.12, 0.6), gain: 0.05, cents: spread(rng, 3) }),
          tone(76, { env: env.perc(0.14, 0.6), gain: 0.04, cents: spread(rng, 3) }),
        ],
      }),
  },
  star: {
    group: "stars",
    label: "Star",
    about: "A music-box glass note; successive stars climb D-major pentatonic from D5 and restart after a pause (params.step)",
    limit: 4,
    minGap: 0.045,
    short: true,
    maxTail: 2.2,
    build: (rng, p = {}) => {
      const m = starMidi(Math.max(0, Math.floor(p.step ?? 0)));
      return voice({
        gain: 1.0,
        send: 0.28,
        pan: spread(rng, 0.15),
        layers: [glass(m, rng, { gain: 0.22, decay: 0.5 }), tone(m + 12, { env: env.perc(0.001, 0.1), gain: 0.035, cents: spread(rng, 2) })],
      });
    },
  },
  "chain-note": {
    group: "stars",
    label: "Constellation note",
    about: "A warmer kalimba note with a soft octave below; the chain's own melody, D5 E5 F#5 A5 B5 D6 (params.step)",
    limit: 4,
    minGap: 0.04,
    short: false,
    maxTail: 2.6,
    build: (rng, p = {}) => {
      const m = penta(Math.max(0, Math.min(7, Math.floor(p.step ?? 0))));
      return voice({
        gain: 0.73,
        send: 0.32,
        pan: spread(rng, 0.15),
        layers: [
          ...kalimba(m, rng, { gain: 0.3, decay: 0.9 }),
          tone(m - 12, { env: env.perc(0.01, 0.5), gain: 0.06, cents: spread(rng, 3) }),
          tone(m + 19, { env: env.perc(0.001, 0.08), gain: 0.025, cents: spread(rng, 2) }), // a twelfth: in-key glint
        ],
      });
    },
  },
  constellation: {
    group: "stars",
    label: "Constellation",
    about: "The chain's notes strum again and resolve into a soft D add9 bloom with a shimmer tail (params.count)",
    limit: 1,
    minGap: 0.3,
    duck: [5, 0.12, 1, 1],
    maxTail: 5,
    build: (rng, p = {}) => {
      const count = Math.max(3, Math.min(6, Math.floor(p.count ?? 5)));
      return voice({
        gain: 0.47,
        send: 0.45,
        layers: [
          ...Array.from({ length: count }, (_, i) => glass(penta(i), rng, { at: i * 0.035 + rng() * 0.006, gain: 0.1, decay: 0.8, bright: 0.3, pan: -0.4 + (0.8 * i) / (count - 1) })),
          ...pad([62, 66, 69, 76], rng, { at: 0.06, gain: 0.05, cutoff: 1700, env: [[0, 0], [0.25, 1, "lin"], [0.7, 0.8, "lin"], [2.2, Z, "exp"]] }),
          tone(50, { at: 0.06, env: env.swell(0.25, 0.4, 1.2), gain: 0.08, cents: spread(rng, 3) }),
          shimmer({ at: 0.15, env: env.swell(0.3, 0.1, 1.3), gain: 0.016 }),
          bell(93, rng, { at: 0.3, gain: 0.045, decay: 1.1, ratio: 2, index: 0.35 }),
          bell(98, rng, { at: 0.42, gain: 0.03, decay: 1.1, ratio: 2, index: 0.3 }),
        ],
      });
    },
  },
  "chain-fade": {
    group: "stars",
    label: "Constellation fades",
    about: "A missed chain: two quiet notes settle A5 to F#5 and dissolve into the reverb, no buzzer",
    limit: 1,
    minGap: 0.3,
    maxTail: 2.5,
    build: (rng) =>
      voice({
        gain: 0.47,
        send: 0.45,
        layers: [
          tone(81, { env: env.perc(0.01, 0.45), gain: 0.09, cents: spread(rng, 3) }),
          tone(78, { at: 0.15, env: env.perc(0.01, 0.55), gain: 0.08, cents: spread(rng, 3) }),
          noise({ filter: { type: "bandpass", freq: [[0, 1200], [0.5, 500, "exp"]], q: 1 }, env: env.perc(0.05, 0.4), gain: 0.04 }),
        ],
      }),
  },
  refill: {
    group: "air",
    label: "Cape refills",
    about: "The cape breathes in: a reversed airy inhale that ends on a small A6 glint",
    limit: 1,
    minGap: 0.15,
    short: true,
    maxTail: 2,
    build: (rng) =>
      voice({
        gain: 0.93,
        send: 0.25,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 700], [0.2, 1800, "exp"]], q: 1.2 }, env: [[0, Z], [0.2, 1, "exp"], [0.26, Z, "exp"]], gain: 0.2 }),
          glass(93, rng, { at: 0.2, gain: 0.06, decay: 0.3, bright: 0.2 }),
        ],
      }),
  },
  "great-star": {
    group: "stars",
    label: "Great Fallen Star",
    about: "A bright but soft bell arpeggio D6 F#6 A6 D7 over a kalimba D5",
    limit: 1,
    minGap: 0.2,
    duck: [3, 0.06, 0.4, 0.8],
    maxTail: 4,
    build: (rng) =>
      voice({
        gain: 0.6,
        send: 0.45,
        layers: [
          ...[86, 90, 93, 98].map((m, i) => bell(m, rng, { at: i * 0.045, gain: 0.1 - i * 0.012, decay: 0.9, ratio: 2, index: 0.4, pan: -0.3 + i * 0.2 })),
          ...kalimba(74, rng, { gain: 0.26, decay: 1.2 }),
          tone(62, { env: env.swell(0.05, 0.2, 0.8), gain: 0.08, cents: spread(rng, 3) }),
          shimmer({ env: env.swell(0.05, 0.1, 1), gain: 0.012 }),
        ],
      }),
  },
  "great-banked": {
    group: "stars",
    label: "Great Star kept",
    about: "A gentle confirmation chime, A5 then D6, over a warm D4",
    limit: 1,
    minGap: 0.2,
    duck: [2, 0.05, 0.4, 0.6],
    maxTail: 4,
    build: (rng) =>
      voice({
        gain: 0.47,
        send: 0.4,
        layers: [
          bell(81, rng, { gain: 0.14, decay: 1.2, index: 0.9 }),
          bell(86, rng, { at: 0.14, gain: 0.14, decay: 1.3, index: 0.9 }),
          tone(62, { env: env.perc(0.02, 0.9), gain: 0.09, cents: spread(rng, 3) }),
        ],
      }),
  },
  beacon: {
    group: "story",
    label: "Beacon lit",
    about: "A warm D3/A3/F#4 pad swell and the two-note bell chime, A5 then D6",
    limit: 1,
    minGap: 0.4,
    duck: [5, 0.2, 1.1, 1.2],
    maxTail: 5,
    build: (rng) =>
      voice({
        gain: 0.45,
        send: 0.45,
        layers: [
          ...pad([50, 57, 66], rng, { gain: 0.06, cutoff: 900, env: [[0, 0], [0.35, 1, "lin"], [0.8, 0.85, "lin"], [2.4, Z, "exp"]] }),
          bell(81, rng, { at: 0.05, gain: 0.15, decay: 1.6 }),
          bell(86, rng, { at: 0.2, gain: 0.13, decay: 1.8 }),
        ],
      }),
  },
  movement: {
    group: "story",
    label: "Movement title",
    about: "A low singing-bowl tone on D3 with a breath, under the movement card",
    limit: 1,
    minGap: 0.5,
    duck: [4, 0.3, 1.3, 0.8],
    maxTail: 5,
    build: (rng) =>
      voice({
        gain: 0.45,
        send: 0.5,
        layers: [
          fm(50, { ratio: 2.76, index: [[0, 1.2], [1.5, 0.3, "exp"]], env: [[0, 0], [0.06, 1, "lin"], [2.6, Z, "exp"]], gain: 0.15, cents: spread(rng, 3) }),
          fm(57, { ratio: 2, index: [[0, 0.6], [1.5, 0.1, "exp"]], env: [[0, 0], [0.4, 1, "lin"], [2.4, Z, "exp"]], gain: 0.07, cents: spread(rng, 3) }),
          noise({ filter: { type: "bandpass", freq: 500, q: 0.8 }, env: env.swell(0.5, 0.1, 0.8), gain: 0.05 }),
        ],
      }),
  },
  fall: {
    group: "story",
    label: "Fall",
    about: "A soft descending gliss, A4 to D3 with a fifth above, closing into the dark (music dims until respawn)",
    limit: 1,
    minGap: 0.3,
    duck: [6, 0.1, 0.6, 0.8],
    maxTail: 4,
    build: (rng) =>
      voice({
        gain: 0.25,
        send: 0.55,
        layers: [
          tone(69, { wave: "triangle", glideTo: 50, glide: 0.9, env: [[0, 0], [0.03, 1, "lin"], [0.5, 0.6, "lin"], [1.1, Z, "exp"]], gain: 0.2, cents: spread(rng, 3), filter: { type: "lowpass", freq: [[0, 2400], [0.9, 300, "exp"]], q: 0.7 } }),
          tone(76, { glideTo: 57, glide: 0.9, env: [[0, 0], [0.05, 1, "lin"], [0.5, 0.5, "lin"], [1.0, Z, "exp"]], gain: 0.08, cents: spread(rng, 3) }),
          glass(86, rng, { gain: 0.04, decay: 0.3, bright: 0.4, pan: -0.3 }),
          glass(93, rng, { at: 0.03, gain: 0.03, decay: 0.3, bright: 0.4, pan: 0.3 }),
          noise({ filter: { type: "lowpass", freq: [[0, 1500], [1.0, 200, "exp"]], q: 0.5 }, env: [[0, 0], [0.1, 1, "lin"], [1.0, Z, "exp"]], gain: 0.06 }),
        ],
      }),
  },
  respawn: {
    group: "story",
    label: "Respawn",
    about: "A reversed shimmer rising for 0.34 s into a kalimba D5 as the sprout pops Diana back up",
    limit: 1,
    minGap: 0.3,
    maxTail: 3.5,
    build: (rng) =>
      voice({
        gain: 0.32,
        send: 0.4,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 1500], [0.34, 3200, "exp"]], q: 0.9 }, env: env.rise(0.34, 1, 0.03), gain: 0.06 }),
          fm(86, { ratio: 2, index: [[0, 0.3]], env: env.rise(0.34, 1, 0.04), gain: 0.05, cents: spread(rng, 3) }),
          fm(93, { ratio: 2, index: [[0, 0.2]], env: env.rise(0.34, 1, 0.04), gain: 0.025, cents: spread(rng, 3) }),
          ...kalimba(74, rng, { at: 0.34, gain: 0.3, decay: 1.0 }),
          tone(62, { at: 0.34, env: env.perc(0.005, 0.5), gain: 0.1, cents: spread(rng, 3) }),
        ],
      }),
  },
  win: {
    group: "story",
    label: "The far door",
    about: "A slow D maj9 chord bloom with a bell arpeggio; two more bells when Earth is blue (params.earth)",
    limit: 1,
    minGap: 1,
    duck: [8, 0.6, 3.5, 2],
    maxTail: 8,
    build: (rng, p = {}) =>
      voice({
        gain: 0.5,
        send: 0.5,
        layers: [
          ...pad([50, 57, 64, 66, 69, 73], rng, { gain: 0.04, strum: 0.05, cutoff: 1600, env: [[0, 0], [1.2, 1, "lin"], [2.6, 0.8, "lin"], [5.2, Z, "exp"]] }),
          ...[74, 78, 81, 86].map((m, i) => bell(m, rng, { at: 0.3 + i * 0.2, gain: 0.1, decay: 1.8, ratio: 2, index: 0.4, pan: -0.3 + i * 0.2 })),
          ...(p.earth ? [bell(88, rng, { at: 1.3, gain: 0.07, decay: 2, ratio: 2, index: 0.35 }), bell(90, rng, { at: 1.5, gain: 0.07, decay: 2.2, ratio: 2, index: 0.35 })] : []),
          shimmer({ at: 0.2, env: env.swell(1.5, 0.3, 3), gain: 0.012 }),
        ],
      }),
  },
  "ui-hover": {
    group: "ui",
    label: "UI hover",
    about: "A barely-there paper tick",
    limit: 2,
    minGap: 0.06,
    short: true,
    maxTail: 0.6,
    build: (rng) =>
      voice({
        gain: 0.87,
        send: 0.02,
        layers: [noise({ color: "white", filter: { type: "bandpass", freq: 2000 * (1 + spread(rng, 0.08)), q: 1.5 }, env: env.perc(0.001, 0.015), gain: 0.14 })],
      }),
  },
  "ui-select": {
    group: "ui",
    label: "UI select",
    about: "A soft wooden tock on A5",
    limit: 2,
    minGap: 0.05,
    short: true,
    maxTail: 1,
    build: (rng) =>
      voice({
        gain: 0.93,
        send: 0.1,
        layers: [
          tone(81, { env: env.perc(0.001, 0.05), gain: 0.22, cents: spread(rng, 3) }),
          { ...tone(81, { env: env.perc(0.001, 0.015), gain: 0.06 }), tonal: false, freq: [[0, midiHz(81) * 2.7]] }, // wood's inharmonic overtone
          noise({ color: "white", filter: { type: "bandpass", freq: 2000, q: 1 }, env: env.perc(0.001, 0.01), gain: 0.14 }),
        ],
      }),
  },
  "ui-resume": {
    group: "ui",
    label: "UI resume",
    about: "Two soft ticks rising F#5 to A5 as the pause card closes",
    limit: 1,
    minGap: 0.1,
    short: true,
    maxTail: 1,
    build: (rng) =>
      voice({
        gain: 0.34,
        send: 0.12,
        layers: [
          tone(78, { env: env.perc(0.001, 0.05), gain: 0.16, cents: spread(rng, 3) }),
          tone(81, { at: 0.07, env: env.perc(0.001, 0.07), gain: 0.18, cents: spread(rng, 3) }),
          noise({ color: "white", filter: { type: "bandpass", freq: 2400, q: 1 }, env: env.perc(0.001, 0.01), gain: 0.1 }),
        ],
      }),
  },
};
export const CUE_NAMES = Object.freeze(Object.keys(CUES));
/** The continuous air bed (updraft swell, glide flutter) is not a one-shot
 * cue; these pseudo-cues render it for the soundboard and offline tests. */
export const BEDS = {
  updraft: { group: "air", label: "Updraft (held)", about: "The sustained airy wind swell while Diana is inside a solar-wind column", seconds: 2.4, air: { wind: true } },
  glide: { group: "air", label: "Glide (held)", about: "Soft air with a fabric flutter while the cape is held outside the wind", seconds: 1.6, air: { glide: true } },
};
const AIR = { wind: 0.088, glide: 0.052 };

/* ---------- game events -> cues (pure) ---------- */
/** Every event name model.mjs emits (tests compare this with the source). */
export const EVENT_NAMES = Object.freeze([
  "wake", "jump", "double-jump", "super-jump", "dash", "dive", "smash", "cascade", "tile-drop", "land", "lip-catch",
  "star", "chain-note", "constellation", "chain-fade", "refill", "great-star", "great-banked", "checkpoint",
  "movement", "death", "respawn", "wind-catch", "win",
]);
/** Returns [{ cue, params, music }]. A cue the engine must count (star steps,
 * cascade tiles, the chain's size) is resolved by the engine. */
export function cuesForEvent(e) {
  switch (e?.name) {
    case "wake": return [{ cue: "wake" }];
    case "jump": return [{ cue: "jump" }];
    case "double-jump": return [{ cue: "double-jump" }];
    case "super-jump": return [{ cue: "super-jump" }];
    case "dash": return [{ cue: "cape" }];
    case "dive": return [{ cue: "dive" }];
    case "smash": return [{ cue: "smash" }];
    case "cascade": return [{ cue: "cascade" }];
    case "tile-drop": {
      const n = /(\d+)$/.exec(String(e.platform ?? ""));
      return [{ cue: "tile-drop", params: { index: n ? Number(n[1]) : undefined } }];
    }
    case "land": return [{ cue: e.hard ? "land-hard" : "land-soft" }];
    case "lip-catch": return [{ cue: "lip-catch" }];
    case "star": return [{ cue: "star", params: { time: e.time } }];
    case "chain-note": return [{ cue: "chain-note", params: { step: e.step, count: e.count, chain: e.chain } }];
    case "constellation": return [{ cue: "constellation", params: { chain: e.chain } }];
    case "chain-fade": return [{ cue: "chain-fade" }];
    // A beacon or a completed constellation already voices the refill inside
    // its own cue; a second sound there would only blur it.
    case "refill": return e.source === "beacon" || e.source === "constellation" ? [] : [{ cue: "refill" }];
    case "great-star": return [{ cue: "great-star" }];
    case "great-banked": return [{ cue: "great-banked" }];
    case "checkpoint": return [{ cue: "beacon" }];
    case "movement": return [{ cue: "movement" }];
    case "death": return [{ cue: "fall", music: "darken" }];
    case "respawn": return [{ cue: "respawn", music: "brighten" }];
    case "wind-catch": return [{ cue: "wind-catch" }];
    case "win": return [{ cue: "win", params: { earth: !!e.earth } }];
    default: return [];
  }
}

/* ---------- generated sample data (pure) ---------- */
/** Karplus-Strong string, tuned exactly: the loop is an integer delay, a
 * two-point average (half a sample) and a first-order allpass for the
 * remaining fraction. `bright` lowpasses the excitation (felt vs. pick). */
export function karplusStrong(sampleRate, hz, { t60 = 0.9, bright = 0.35, rng = mulberry32(5) } = {}) {
  const len = Math.ceil((t60 + 0.05) * sampleRate),
    out = new Float32Array(len),
    P = sampleRate / hz;
  let L = Math.floor(P - 0.5),
    d = P - 0.5 - L;
  if (d < 0.1) {
    L -= 1;
    d += 1;
  }
  const c = (1 - d) / (1 + d);
  // Per-pass loss so the string reaches -60 dB at t60, compensating the
  // average filter's own attenuation at the fundamental.
  const loss = Math.min(0.99995, 0.001 ** (1 / (hz * t60)) / Math.cos((Math.PI * hz) / sampleRate));
  const exc = new Float32Array(L + 1),
    k = 0.08 + 0.85 * bright;
  let lp = 0,
    mean = 0;
  for (let i = 0; i <= L; i++) {
    lp += k * (rng() * 2 - 1 - lp);
    exc[i] = lp;
    mean += lp / (L + 1);
  }
  let apX = 0,
    apY = 0,
    peak = 1e-9;
  for (let n = 0; n < len; n++) {
    const a = n >= L ? out[n - L] : 0,
      b = n >= L + 1 ? out[n - L - 1] : 0;
    const avg = loss * 0.5 * (a + b);
    const y = c * avg + apX - c * apY;
    apX = avg;
    apY = y;
    out[n] = (n <= L ? exc[n] - mean : 0) + y;
    peak = Math.max(peak, Math.abs(out[n]));
  }
  const fade = Math.floor(0.03 * sampleRate);
  for (let n = 0; n < len; n++) out[n] = (out[n] / peak) * Math.min(1, (len - n) / fade);
  return out;
}
/** Poisson-timed grains of decaying noise; density and level move linearly
 * from start to end, so a shelf's crackle can build as it shakes. */
export function crackleSamples(sampleRate, seconds, rng, { from = 60, to = from, rise = [1, 1], grain = 0.004 } = {}) {
  const out = new Float32Array(Math.max(1, Math.ceil(seconds * sampleRate)));
  let t = 0;
  for (;;) {
    const u = t / seconds,
      rate = Math.max(1, from + (to - from) * u);
    t += -Math.log(1 - rng() * 0.999999) / rate;
    if (t >= seconds) break;
    const v = t / seconds,
      amp = (rise[0] + (rise[1] - rise[0]) * v) * (0.35 + 0.65 * rng() ** 2),
      n0 = Math.floor(t * sampleRate),
      n = Math.max(8, Math.floor(grain * (0.5 + rng()) * sampleRate));
    for (let i = 0; i < n && n0 + i < out.length; i++) out[n0 + i] += amp * (rng() * 2 - 1) * Math.exp((-5 * i) / n);
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
  return out;
}
export function noiseSamples(sampleRate, seconds, color, rng) {
  const out = new Float32Array(Math.ceil(seconds * sampleRate));
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, brown = 0, peak = 1e-9;
  for (let i = 0; i < out.length; i++) {
    const w = rng() * 2 - 1;
    let v = w;
    if (color === "pink") {
      // Paul Kellet's economy pink filter.
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    } else if (color === "brown") {
      brown = (brown + 0.02 * w) / 1.02;
      v = brown;
    }
    out[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  for (let i = 0; i < out.length; i++) out[i] /= peak;
  // Loop seam: crossfade the last 20 ms into the first so looping never clicks.
  const x = Math.floor(0.02 * sampleRate);
  for (let i = 0; i < x; i++) {
    const u = i / x;
    out[out.length - x + i] = out[out.length - x + i] * (1 - u) + out[i] * u;
  }
  return out;
}
/** A small, soft hall: stereo decaying noise that darkens as it decays (air
 * absorption), with a short pre-delay; energy-normalised so the send level
 * means what it says (convolver normalisation stays off). */
export function reverbImpulse(sampleRate, seconds = 2.4, rng = mulberry32(11), { predelay = 0.014 } = {}) {
  const len = Math.ceil(seconds * sampleRate),
    p = Math.floor(predelay * sampleRate),
    span = len - p;
  return [0, 1].map(() => {
    const data = new Float32Array(len);
    let lp = 0,
      energy = 0;
    for (let i = p; i < len; i++) {
      const u = (i - p) / span;
      const k = 0.75 - 0.6 * Math.min(1, u * 1.5); // one-pole coefficient: closes as it decays
      lp += k * (rng() * 2 - 1 - lp);
      const v = lp * 0.001 ** u * Math.min(1, (len - i) / (0.05 * sampleRate));
      data[i] = v;
      energy += v * v;
    }
    const g = 1 / Math.sqrt(energy || 1);
    for (let i = 0; i < len; i++) data[i] *= g;
    return data;
  });
}
/** Final safety: transparent below 0.6, then a smooth knee that can never
 * exceed 0.89, so no stack of cues can clip the output. */
export function safetyCurve(n = 2049) {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1,
      a = Math.abs(x);
    curve[i] = Math.sign(x) * (a <= 0.6 ? a : 0.6 + 0.29 * Math.tanh((a - 0.6) / 0.29));
  }
  return curve;
}

/* ---------- the engine ---------- */
const LOOKAHEAD = 0.006; // s; starting a hair ahead keeps attacks whole
const MAX_VOICES = 20;
const SFX_LEVEL = 1; // calibrated against the soundtrack (README, "Sound")
export const MUSIC_LEVEL = 0.22;
const wallNow = () => globalThis.performance?.now?.() ?? Date.now();

/**
 * options: enabled (default true), context (an existing / Offline context),
 * AudioContext (class override), seed, safety (soft clipper, default true).
 */
export function createAudioEngine(options = {}) {
  const seed = options.seed ?? 1987,
    safety = options.safety !== false;
  let enabled = options.enabled ?? true,
    ctx = options.context ?? null;
  const offline = !!ctx && typeof ctx.startRendering === "function";
  let graph = null,
    paused = false,
    musicEl = null,
    musicRouted = false,
    musicWanted = false,
    musicLevel = MUSIC_LEVEL,
    resumingUntil = 0,
    bed = null,
    melody = null,
    duckState = { until: -1, target: 1 },
    nodes = 0,
    dropped = 0,
    peakVoices = 0,
    darkened = false;
  const rng = mulberry32(seed),
    voices = [],
    lastAt = {},
    played = {},
    chainSize = {},
    buffers = {},
    plucks = new Map();

  const node = (kind) => {
    nodes++;
    return ctx[`create${kind}`]();
  };
  const t = () => ctx.currentTime;
  function automate(param, points, t0, scale = 1) {
    param.setValueAtTime(points[0][1] * scale, t0 + points[0][0]);
    for (let i = 1; i < points.length; i++) {
      const [time, value, ramp] = points[i],
        at = t0 + time,
        v = value * scale;
      if (ramp === "set") param.setValueAtTime(v, at);
      else if (ramp === "lin") param.linearRampToValueAtTime(v, at);
      else param.exponentialRampToValueAtTime(Math.max(Z * Math.max(scale, 1e-6), Math.abs(v)) || Z, at);
    }
  }
  const setParam = (param, value, t0) => (Array.isArray(value) ? automate(param, value, t0) : param.setValueAtTime(value, t0));
  function makeBuffer(channels) {
    const b = ctx.createBuffer(channels.length, channels[0].length, ctx.sampleRate);
    channels.forEach((data, i) => b.getChannelData(i).set(data));
    return b;
  }

  function build() {
    const sr = ctx.sampleRate,
      r = mulberry32(seed ^ 0x5eed);
    const sfx = node("Gain");
    sfx.gain.value = SFX_LEVEL;
    // Gentle glue: catches stacked cues, never pumps a single one.
    const comp = node("DynamicsCompressor");
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    const master = node("Gain");
    const verbIn = node("Gain");
    const verb = node("Convolver");
    verb.normalize = false;
    verb.buffer = makeBuffer(reverbImpulse(sr, 2.4, r));
    buffers.impulse = true;
    const verbTone = node("BiquadFilter");
    verbTone.type = "lowpass";
    verbTone.frequency.value = 5200;
    verbTone.Q.value = 0.5;
    const verbOut = node("Gain");
    verbOut.gain.value = 0.55;
    const music = node("Gain");
    music.gain.value = musicLevel;
    const musicTone = node("BiquadFilter");
    musicTone.type = "lowpass";
    musicTone.frequency.value = 20000;
    musicTone.Q.value = 0.5;
    sfx.connect(comp);
    comp.connect(master);
    verbIn.connect(verb);
    verb.connect(verbTone);
    verbTone.connect(verbOut);
    verbOut.connect(master);
    music.connect(musicTone);
    musicTone.connect(master);
    let last = master;
    if (safety) {
      const shaper = node("WaveShaper");
      shaper.curve = safetyCurve();
      shaper.oversample = "none";
      master.connect(shaper);
      last = shaper;
    }
    last.connect(ctx.destination);
    for (const color of ["white", "pink", "brown"]) {
      buffers[color] = makeBuffer([noiseSamples(sr, 3, color, r)]);
    }
    graph = { sfx, comp, master, verbIn, music, musicTone, out: last };
  }
  function routeMusic() {
    if (!musicEl || musicRouted || !graph || offline) return;
    try {
      const source = ctx.createMediaElementSource(musicEl);
      nodes++;
      source.connect(graph.music);
      musicRouted = true;
      musicEl.volume = 1; // the level now lives in the music gain (and works on iOS)
    } catch {
      musicEl.volume = musicLevel;
    }
  }
  function unlock() {
    if (!enabled && !offline) return false;
    try {
      if (!ctx) {
        const AC = options.AudioContext ?? globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AC) return false;
        try {
          ctx = new AC({ latencyHint: "interactive" });
        } catch {
          ctx = new AC();
        }
      }
      if (!graph) build();
      // A context born during a pause (sound switched on from the pause
      // card) must stay frozen until Continue.
      if (!offline && paused && ctx.state === "running") ctx.suspend?.()?.catch?.(() => {});
      if (!offline && !paused && ctx.state !== "running") {
        resumingUntil = wallNow() + 400; // resume() settles asynchronously
        ctx.resume?.()?.catch?.(() => {});
      }
      routeMusic();
      return true;
    } catch {
      return false;
    }
  }
  function canPlay() {
    if (!enabled || paused || !ctx || !graph) return false;
    if (offline) return true;
    return ctx.state === "running" || wallNow() < resumingUntil;
  }

  /* voices */
  function prune(now) {
    for (let i = voices.length - 1; i >= 0; i--) {
      const v = voices[i];
      if (v.end + 0.05 < now) {
        for (const n of v.nodes) {
          try {
            n.disconnect();
          } catch {
            /* already gone */
          }
        }
        voices.splice(i, 1);
      }
    }
  }
  function fadeOut(v, fade = 0.04) {
    if (v.stolen) return;
    const now = t();
    v.stolen = true;
    try {
      const g = v.out.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + fade);
    } catch {
      /* ignore */
    }
    for (const s of v.sources) {
      try {
        s.stop(now + fade + 0.01);
      } catch {
        /* a source that already ended */
      }
    }
    v.end = Math.min(v.end, now + fade + 0.02);
  }
  const active = (now) => voices.filter((v) => !v.stolen && v.end > now);

  function pluckBuffer(L) {
    const key = `${L.midi}|${L.t60}|${L.bright}`;
    if (!plucks.has(key)) {
      if (plucks.size > 48) plucks.delete(plucks.keys().next().value);
      plucks.set(key, makeBuffer([karplusStrong(ctx.sampleRate, L.hz, { t60: L.t60, bright: L.bright, rng: mulberry32(L.midi * 31 + 7) })]));
    }
    return plucks.get(key);
  }
  function renderLayer(L, t0, dest, list) {
    const start = t0 + L.at,
      end = layerEnd(L) - L.at + start;
    const g = node("Gain");
    list.push(g);
    let into = g;
    if (L.env) {
      g.gain.value = 0;
      automate(g.gain, L.env, start, L.gain);
    } else g.gain.value = L.gain;
    if (L.pan != null && ctx.createStereoPanner) {
      const p = node("StereoPanner");
      p.pan.value = Math.max(-1, Math.min(1, L.pan));
      g.connect(p);
      p.connect(dest);
      list.push(p);
    } else g.connect(dest);
    if (L.filter) {
      const f = node("BiquadFilter");
      f.type = L.filter.type;
      f.Q.value = L.filter.q ?? 0.7;
      setParam(f.frequency, L.filter.freq, start);
      f.connect(into);
      into = f;
      list.push(f);
    }
    if (L.highpass) {
      const f = node("BiquadFilter");
      f.type = "highpass";
      f.frequency.value = L.highpass;
      f.connect(into);
      into = f;
      list.push(f);
    }
    const sources = [];
    const go = (s) => {
      s.start(start);
      s.stop(end + 0.05);
      sources.push(s);
      list.push(s);
    };
    if (L.kind === "tone") {
      const o = node("Oscillator");
      o.type = L.wave;
      automate(o.frequency, L.freq, start);
      o.connect(into);
      go(o);
    } else if (L.kind === "fm") {
      const carrier = node("Oscillator"),
        mod = node("Oscillator"),
        depth = node("Gain");
      carrier.frequency.setValueAtTime(L.hz, start);
      mod.frequency.setValueAtTime(L.hz * L.ratio, start);
      automate(depth.gain, L.index, start, L.hz * L.ratio);
      mod.connect(depth);
      depth.connect(carrier.frequency);
      carrier.connect(into);
      list.push(depth);
      go(carrier);
      go(mod);
    } else if (L.kind === "noise") {
      const s = node("BufferSource");
      s.buffer = buffers[L.color] ?? buffers.pink;
      s.loop = true;
      if (L.am) {
        const am = node("Gain"),
          lfo = node("Oscillator"),
          depth = node("Gain");
        am.gain.value = 1 - L.am.depth / 2;
        lfo.frequency.value = L.am.rate;
        depth.gain.value = L.am.depth / 2;
        lfo.connect(depth);
        depth.connect(am.gain);
        s.connect(am);
        am.connect(into);
        list.push(am, depth);
        go(lfo);
      } else s.connect(into);
      // A random read position so repeated cues never share the same grain.
      sources.push(s);
      list.push(s);
      s.start(start, rng() * 2.5);
      s.stop(end + 0.05);
    } else if (L.kind === "pluck") {
      const s = node("BufferSource");
      s.buffer = pluckBuffer(L);
      s.playbackRate.value = L.rate;
      s.connect(into);
      go(s);
    } else if (L.kind === "crackle") {
      const s = node("BufferSource");
      s.buffer = makeBuffer([crackleSamples(ctx.sampleRate, L.dur, mulberry32(Math.floor(L.seed)), L)]);
      s.connect(into);
      go(s);
    }
    return sources;
  }

  function play(name, params = {}) {
    const cue = CUES[name];
    if (!cue || !canPlay()) return null;
    try {
      const now = t();
      prune(now);
      if (now - (lastAt[name] ?? -1e9) < (cue.minGap ?? 0)) {
        dropped++;
        return null;
      }
      // Polyphony: fade the oldest voice of this cue, then the oldest overall.
      const same = active(now).filter((v) => v.cue === name);
      if (same.length >= (cue.limit ?? 3)) fadeOut(same[0]);
      const all = active(now);
      if (all.length >= MAX_VOICES) fadeOut(all[0]);
      const spec = cue.build(rng, params);
      const t0 = now + LOOKAHEAD + Math.max(0, params.delay ?? 0);
      const list = [];
      const out = node("Gain");
      list.push(out);
      out.gain.value = spec.gain * dbToGain(spread(rng, 1)); // +-1 dB of life
      let head = out;
      if (spec.pan && ctx.createStereoPanner) {
        const p = node("StereoPanner");
        p.pan.value = spec.pan;
        out.connect(p);
        head = p;
        list.push(p);
      }
      head.connect(graph.sfx);
      if (spec.send) {
        const send = node("Gain");
        send.gain.value = spec.send;
        head.connect(send);
        send.connect(graph.verbIn);
        list.push(send);
      }
      const sources = spec.layers.flatMap((L) => renderLayer(L, t0, out, list));
      const v = { cue: name, start: t0, end: t0 + spec.dur, out, sources, nodes: list, stolen: false };
      voices.push(v);
      lastAt[name] = now;
      played[name] = (played[name] ?? 0) + 1;
      peakVoices = Math.max(peakVoices, active(now).length);
      if (cue.duck) duck(...cue.duck, t0);
      return { cue: name, end: v.end, stop: (fade) => fadeOut(v, fade) };
    } catch {
      return null; // decorative: never let a sound break play
    }
  }

  /* music */
  function duck(db, attack = 0.1, hold = 0.5, release = 0.8, startAt) {
    if (!graph || !canPlay()) return;
    try {
      const g = graph.music.gain,
        now = Math.max(t(), startAt ?? 0),
        target = musicLevel * dbToGain(-db),
        until = now + attack + hold;
      if (duckState.until > now) {
        duckState.target = Math.min(duckState.target, target);
        duckState.until = Math.max(duckState.until, until);
      } else duckState = { target, until };
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(duckState.target, now + attack);
      g.setValueAtTime(duckState.target, duckState.until);
      g.linearRampToValueAtTime(musicLevel, duckState.until + release);
    } catch {
      /* ignore */
    }
  }
  function tint(dark) {
    if (!graph || darkened === dark) return;
    darkened = dark;
    try {
      const f = graph.musicTone.frequency;
      f.cancelScheduledValues(t());
      f.setTargetAtTime(dark ? 650 : 20000, t(), dark ? 0.12 : 0.3);
    } catch {
      /* ignore */
    }
  }
  function playMusic({ fadeIn = 0 } = {}) {
    musicWanted = true;
    if (!enabled || paused || !musicEl) return;
    try {
      if (musicRouted && fadeIn && graph) {
        const g = graph.music.gain;
        g.cancelScheduledValues(t());
        g.setValueAtTime(Z, t());
        g.linearRampToValueAtTime(musicLevel, t() + fadeIn);
        duckState = { until: -1, target: 1 };
      }
      musicEl.play()?.catch?.(() => {});
    } catch {
      /* ignore */
    }
  }
  function stopMusic() {
    musicWanted = false;
    try {
      musicEl?.pause();
    } catch {
      /* ignore */
    }
  }

  /* the air bed: one looping noise voice, swelled by the game every frame */
  function makeBed() {
    const list = [];
    const src = node("BufferSource");
    src.buffer = buffers.pink;
    src.loop = true;
    const band = node("BiquadFilter");
    band.type = "bandpass";
    band.frequency.value = 820;
    band.Q.value = 0.8;
    // A slow LFO moves the band so the wind breathes instead of hissing.
    const sway = node("Oscillator"),
      swayDepth = node("Gain");
    sway.frequency.value = 0.21;
    swayDepth.gain.value = 260;
    sway.connect(swayDepth);
    swayDepth.connect(band.frequency);
    const am = node("Gain"),
      flutter = node("Oscillator"),
      flutterDepth = node("Gain");
    am.gain.value = 1;
    flutter.frequency.value = 12;
    flutterDepth.gain.value = 0.1;
    flutter.connect(flutterDepth);
    flutterDepth.connect(am.gain);
    const out = node("Gain"),
      send = node("Gain");
    out.gain.value = 0;
    send.gain.value = 0.4;
    src.connect(band);
    band.connect(am);
    am.connect(out);
    out.connect(graph.sfx);
    out.connect(send);
    send.connect(graph.verbIn);
    const at = t();
    src.start(at);
    sway.start(at);
    flutter.start(at);
    list.push(src, band, sway, swayDepth, am, flutter, flutterDepth, out, send);
    bed = { out, band, flutterDepth, nodes: list, sources: [src, sway, flutter], target: 0, glide: false, wind: false };
  }
  function destroyBed() {
    if (!bed) return;
    for (const s of bed.sources) {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    }
    for (const n of bed.nodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    bed = null;
  }
  function setAir({ wind = false, glide = false } = {}, when) {
    if (paused) return; // a frozen context keeps the bed exactly where it was
    const target = canPlay() ? (wind ? AIR.wind : glide ? AIR.glide : 0) : 0;
    if (!bed) {
      if (target <= 0) return;
      try {
        makeBed();
      } catch {
        return;
      }
    }
    if (target === bed.target && !!glide === bed.glide && !!wind === bed.wind) return;
    try {
      const at = when ?? t();
      bed.out.gain.setTargetAtTime(target, at, target > bed.target ? 0.15 : 0.3);
      bed.flutterDepth.gain.setTargetAtTime(glide && !wind ? 0.45 : 0.1, at, 0.08);
      bed.band.frequency.setTargetAtTime(wind ? 820 : 950, at, 0.3);
    } catch {
      /* ignore */
    }
    bed.target = target;
    bed.glide = !!glide;
    bed.wind = !!wind;
  }

  function hush(fade = 0.06) {
    if (!ctx) return;
    for (const v of voices) fadeOut(v, fade);
    if (bed) setAirSilent();
  }
  function setAirSilent() {
    try {
      bed.out.gain.setTargetAtTime(0, t(), 0.05);
      bed.target = 0;
      bed.glide = bed.wind = false;
    } catch {
      /* ignore */
    }
  }

  return {
    unlock,
    play,
    duck,
    setAir,
    hush,
    attachMusic(el, { level } = {}) {
      musicEl = el;
      musicLevel = level ?? MUSIC_LEVEL;
      try {
        if (!musicRouted) el.volume = musicLevel;
      } catch {
        /* ignore */
      }
      routeMusic();
    },
    playMusic,
    stopMusic,
    /** Map one simulation event to its cue(s); returns the voices started. */
    event(e) {
      const out = [];
      for (const c of cuesForEvent(e)) {
        const params = { ...(c.params ?? {}) };
        if (c.cue === "star") {
          melody = nextStarStep(melody, e.time ?? 0);
          params.step = melody.step;
        }
        if (c.cue === "chain-note" && params.chain) chainSize[params.chain] = params.count;
        if (c.cue === "constellation") params.count = chainSize[params.chain] ?? 5;
        if (c.music === "darken" && canPlay()) tint(true);
        if (c.music === "brighten") tint(false);
        const v = play(c.cue, params);
        if (v) out.push(v);
      }
      return out;
    },
    /** Clear ducks and the fall's darkness (restart, title). */
    clearMoments() {
      tint(false);
      if (!graph) return;
      try {
        const g = graph.music.gain;
        g.cancelScheduledValues(t());
        g.setTargetAtTime(musicLevel, t(), 0.1);
        duckState = { until: -1, target: 1 };
      } catch {
        /* ignore */
      }
    },
    setEnabled(on) {
      on = !!on;
      if (on === enabled) return;
      enabled = on;
      if (!on) {
        for (const v of voices) fadeOut(v, 0.01);
        destroyBed();
        try {
          musicEl?.pause();
        } catch {
          /* ignore */
        }
        if (ctx && !offline && ctx.state === "running") ctx.suspend?.()?.catch?.(() => {});
      } else if (!paused) {
        if (ctx && !offline) {
          resumingUntil = wallNow() + 400;
          ctx.resume?.()?.catch?.(() => {});
        }
        if (musicWanted) playMusic();
      }
    },
    /** Pausing freezes everything in place: the context is suspended (tails,
     * swells and blooms stop mid-air and continue on resume, never restart)
     * and the music element pauses. Nothing new can start while paused. */
    setPaused(p) {
      p = !!p;
      if (p === paused) return;
      paused = p;
      try {
        if (p) {
          musicEl?.pause();
          if (ctx && !offline) ctx.suspend?.()?.catch?.(() => {});
        } else if (enabled) {
          if (ctx && !offline) {
            resumingUntil = wallNow() + 400;
            ctx.resume?.()?.catch?.(() => {});
          }
          if (musicWanted && musicEl) musicEl.play()?.catch?.(() => {});
        }
      } catch {
        /* ignore */
      }
    },
    /** Re-resume after the browser itself suspended us (call on gestures). */
    nudge() {
      if (enabled && !paused && ctx && !offline && ctx.state !== "running") {
        resumingUntil = wallNow() + 400;
        ctx.resume?.()?.catch?.(() => {});
      }
    },
    /** Tap the final output (soundboard meter). */
    analyser() {
      if (!graph) return null;
      const a = ctx.createAnalyser();
      a.fftSize = 2048;
      graph.out.connect(a);
      return a;
    },
    /** Where an offline test connects a decoded music buffer. */
    musicInput: () => graph?.music ?? null,
    get context() {
      return ctx;
    },
    stats() {
      const now = ctx ? t() : 0;
      if (ctx) prune(now);
      return {
        engine: "procedural",
        key: `${KEY.name} (relative ${KEY.relative})`,
        enabled,
        unlocked: !!ctx,
        state: ctx?.state ?? "none",
        time: ctx ? ctx.currentTime : 0, // the audio clock: frozen while paused
        paused,
        suspended: !ctx || ctx.state !== "running",
        musicWanted,
        musicPlaying: !!musicEl && !musicEl.paused,
        musicRouted,
        musicDark: darkened,
        air: bed ? { target: bed.target, wind: bed.wind, glide: bed.glide } : null,
        voices: ctx ? active(now).length : 0,
        peakVoices,
        nodes,
        dropped,
        played: { ...played },
        decoded: Object.keys(buffers).sort(), // generated buffers: no samples are decoded
        cues: [...CUE_NAMES],
      };
    },
  };
}

/** Render one cue (or a bed) offline: used by the soundboard and browser QA. */
export async function renderCueOffline(name, { OfflineContext = globalThis.OfflineAudioContext, sampleRate = 48000, params = {}, seed = 1, safety = true, tail = 2.6 } = {}) {
  const bedDef = BEDS[name];
  const spec = bedDef ? null : CUES[name].build(mulberry32(seed), params);
  const seconds = (bedDef ? bedDef.seconds + 0.6 : spec.dur) + tail + 0.05;
  const ctx = new OfflineContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const engine = createAudioEngine({ context: ctx, seed, safety });
  engine.unlock();
  if (bedDef) {
    engine.setAir(bedDef.air, 0.01);
    engine.setAir({}, bedDef.seconds);
  } else engine.play(name, params);
  const buffer = await ctx.startRendering();
  return { buffer, stats: engine.stats() };
}
