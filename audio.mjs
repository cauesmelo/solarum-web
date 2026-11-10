/** Solarum sound: procedural body sounds plus the adaptive score. Presentation
 * only: nothing here reads or writes the simulation, and every Web Audio call
 * is guarded so a missing or blocked AudioContext simply means silence.
 *
 * Two parts (RESEARCH_MUSIC.md, "the path is the score"):
 * 1. CUES: the immediate body of every action and moment (breath, cloth,
 *    stone, sparkle, thump). They are never delayed and carry no free pitch:
 *    anything pitched in them follows the current chord (`params.chord`).
 * 2. The score: score.mjs decides, per sixteenth and per event, which notes
 *    the world (bed) and Diana (player voices) play; VOICES below are their
 *    recipes and the engine schedules them on the audio clock, 120 ms ahead.
 *    Landings play the felt bass, stars the melody, constellations bring in
 *    the choir, flights hold a vowel; a miss leaves a rest, never a wrong
 *    note. The bed detunes (<= 20 cents) after mistakes; Gentle music never.
 *
 * A cue or voice is a pure recipe `build(rng, params)` that returns plain
 * numbers (layers, envelopes, sweeps), so tests check tuning and finiteness
 * without a browser; `createAudioEngine` turns recipes into nodes.
 * Palette: mystical, spacey, floaty. Soft attacks on sustained voices, glides
 * upward in the air, a 5.5 s space reverb whose tail blooms, an octave
 * shimmer, wide pads but Diana's voice narrow at her screen position (-0.25).
 * Key: the soundtrack's D major / B minor at 107 BPM (README, "Sound").
 *
 * Signal flow:
 *   cue -> sfx bus -> gentle compressor -> master -> soft safety clipper -> out
 *   cue -> reverb send -> 2.4 s convolver -> master
 *   bed voice -> bed bus -> tape wow (H) -> lowpass (H) -> score bus
 *   player voice --------------------------------------> score bus
 *   voice -> space send -> 5.5 s convolver (+ octave shimmer loop) -> score bus
 *   score bus -> tape delay (tape-stop) -> tape tone -> tape gain -> score out -> master
 *   rewind notes -> rewind bus -> master (they sound while the score is stopped)
 *   soundtrack element -> music gain (ducking) -> music tone -> master (title, door)
 */
import { createConductor, createClockMap, chordTones, rootIn, safeAtOrAbove, scoreOf, CHORDS, SIXTEENTH, BEAT, BAR, LAYERS } from "./score.mjs";
import { PATHS } from "./score-path.mjs";
import { createLevel, LEVELS } from "./level.mjs";

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
/** Harmony feedback: "expressive" (default; mistakes detune the bed a
 * little) or "gentle" (no dissonance, the fall fades instead of tape-stopping).
 * Same guarded storage rules: anything but an explicit "gentle" is expressive. */
export const GENTLE_KEY = "solarum.music";
export function readGentleSetting(storage) {
  try {
    const s = typeof storage === "function" ? storage() : storage;
    return s?.getItem(GENTLE_KEY) === "gentle";
  } catch {
    return false;
  }
}
export function writeGentleSetting(storage, gentle) {
  try {
    const s = typeof storage === "function" ? storage() : storage;
    s?.setItem(GENTLE_KEY, gentle ? "gentle" : "expressive");
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
  let freq = o.glideTo != null ? [[0, f0], [o.glide ?? 0.1, midiHz(o.glideTo + c / 100), "exp"]] : [[0, f0]];
  // A sigh: hold the note, then bend it `bend` cents down over bendTime.
  if (o.bend) freq = [[0, f0], [0.12, f0, "lin"], [0.12 + (o.bendTime ?? 0.4), f0 * 2 ** (o.bend / 1200), "exp"]];
  return {
    kind: "tone",
    // A partial (a harmonic of a voice) is timbre, not a note of its own.
    tonal: !o.partial,
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
    detuneBus: o.detuneBus, // +1 / -1: follows the bed's H detune (pads)
    vibrato: o.vibrato, // { rate, cents, delay }
  };
}
/** A formant voice: `count` sawtooths a few cents apart through two
 * band-passes whose centres morph from "oo" (300 / 870 Hz) toward "ah"
 * (700 / 1200 Hz), with a slow vibrato after the attack. */
function choirLayer(midi, o = {}) {
  return {
    kind: "choir",
    tonal: true,
    midi,
    // Several notes can share one pair of formant filters (the choir voice):
    // one sum and two band-passes per voice instead of per note.
    midis: o.midis,
    cents: o.cents ?? 0,
    count: o.count ?? 3,
    spread: o.spread ?? 7,
    formants: o.formants ?? [[[0, 300], [o.morph ?? 0.9, 700, "exp"]], [[0, 870], [o.morph ?? 0.9, 1200, "exp"]]],
    q: o.q ?? 6,
    vibrato: o.vibrato ?? { rate: 5, cents: 8, delay: 0.3 },
    env: o.env ?? env.swell(0.4, 0.5, 1.5),
    gain: o.gain ?? 0.1,
    at: o.at ?? 0,
    pan: o.pan,
    detuneBus: o.detuneBus,
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
  if (L.kind === "choir") return L.at + envEnd(L.env);
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

/** The chord a pitched body follows (the engine passes the score's current
 * chord; alone, on the soundboard, D). */
const chordOf = (p) => p?.chord ?? CHORDS.D;

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
  emerge: {
    group: "story",
    label: "Emerge",
    about: "The soil stirs as Diana rises out of the earth: a slow low breath of air and a few soft leaf whispers (the wake follows when she pops out)",
    limit: 1,
    minGap: 0.5,
    maxTail: 3,
    build: (rng) =>
      voice({
        gain: 0.1,
        send: 0.35,
        layers: [
          noise({ color: "brown", filter: { type: "lowpass", freq: [[0, 180], [0.9, 420, "exp"]], q: 0.5 }, env: [[0, 0], [0.5, 1, "lin"], [1.0, 0.6, "lin"], [1.4, Z, "exp"]], gain: 0.26 }),
          noise({ filter: { type: "bandpass", freq: [[0, 500], [1.0, 1200, "exp"]], q: 0.7 }, env: [[0, 0], [0.7, 1, "lin"], [1.3, Z, "exp"]], gain: 0.16, at: 0.2 }),
          noise({ filter: { type: "bandpass", freq: 2600 * (1 + spread(rng, 0.1)), q: 1 }, env: env.perc(0.03, 0.12), gain: 0.1, at: 0.05 }),
          noise({ filter: { type: "bandpass", freq: 3100 * (1 + spread(rng, 0.1)), q: 1 }, env: env.perc(0.03, 0.12), gain: 0.08, at: 0.4 }),
        ],
      }),
  },
  jump: {
    group: "move",
    label: "Jump",
    about: "An airy upward breath with a whisper of cloth, no thump (the score adds a glass harmonica gliding root to fifth)",
    limit: 3,
    minGap: 0.03,
    short: true,
    maxTail: 1.6,
    // Revision seven (user: "too hard, it clashes with the atmosphere"): the
    // 3 ms felt thump is gone. Every layer swells in over 18-30 ms and is
    // low-passed air, so the body is felt rather than heard as a hit, about
    // 6 dB under the old peak and far under Diana's voice (README, Sound).
    build: (rng) =>
      voice({
        gain: 0.4,
        send: 0.2,
        layers: [
          // The breath rises with her: a soft band of pink noise opening upward.
          noise({ filter: { type: "bandpass", freq: [[0, 420 * (1 + spread(rng, 0.06))], [0.22, 1150, "exp"]], q: 0.7 }, env: env.perc(0.03, 0.2), gain: 0.3 }),
          // Cloth lifting: brighter air, low-passed under 2.4 kHz.
          noise({ filter: { type: "lowpass", freq: 2400, q: 0.5 }, highpass: 700, env: env.perc(0.024, 0.12), gain: 0.06 }),
          // Felt weight leaving the ground: deep, slow air instead of a sine.
          noise({ color: "brown", filter: { type: "lowpass", freq: 260, q: 0.5 }, env: env.perc(0.026, 0.12), gain: 0.16 }),
        ],
      }),
  },
  "double-jump": {
    group: "move",
    label: "Double jump",
    about: "Higher and lighter: a thinner rising breath with a soft airy shimmer, no tick (the score glides fifth to ninth)",
    limit: 3,
    minGap: 0.03,
    short: true,
    maxTail: 1.8,
    build: (rng) =>
      voice({
        gain: 0.46,
        send: 0.3,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 800 * (1 + spread(rng, 0.06))], [0.18, 1900, "exp"]], q: 0.8 }, env: env.perc(0.024, 0.16), gain: 0.24 }),
          // Where a 1 ms white tick was: air sparkling in over 16 ms.
          noise({ filter: { type: "bandpass", freq: 4200, q: 1.2 }, env: env.perc(0.02, 0.1), gain: 0.035, at: 0.01 }),
        ],
      }),
  },
  "super-jump": {
    group: "move",
    label: "Super jump",
    about: "A long rising wash of air with a soft shimmer above it (the score stacks open fifths, a thirty-second apart)",
    limit: 2,
    minGap: 0.1,
    short: true,
    maxTail: 3,
    // Its crackle trail was a burst of 2 ms grains (transients): now one
    // smooth band of air, and 6 dB down so it no longer matches the score.
    build: () =>
      voice({
        gain: 0.3,
        send: 0.4,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 420], [0.34, 2200, "exp"]], q: 0.8 }, env: [[0, 0], [0.07, 1, "lin"], [0.24, 0.7, "lin"], [0.5, Z, "exp"]], gain: 0.32 }),
          noise({ filter: { type: "bandpass", freq: [[0, 3200], [0.35, 4600, "exp"]], q: 1.1 }, env: [[0, 0], [0.12, 1, "lin"], [0.5, Z, "exp"]], gain: 0.05, at: 0.04 }),
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
    about: "A falling rush of air, 1.7 kHz down to 320 Hz (the score glides an octave down to the root)",
    limit: 2,
    minGap: 0.06,
    short: true,
    maxTail: 1.8,
    // Starts darker (it opened at 2.6 kHz) and 5 dB softer.
    build: () =>
      voice({
        gain: 0.3,
        send: 0.18,
        layers: [noise({ filter: { type: "bandpass", freq: [[0, 1700], [0.3, 320, "exp"]], q: 0.8 }, env: [[0, 0], [0.04, 1, "lin"], [0.22, 0.6, "lin"], [0.38, Z, "exp"]], gain: 0.34 })],
      }),
  },
  "land-soft": {
    group: "move",
    label: "Land (soft)",
    about: "Feet settling into soft ground: a short hush of air and cloth, felt rather than heard",
    limit: 2,
    minGap: 0.06,
    short: true,
    maxTail: 1,
    // The thump (a 2 ms sine sweep) is gone: the landing's note is the felt
    // bass the score plays on the grid; the body only settles under it.
    build: (rng) =>
      voice({
        gain: 0.44,
        send: 0.08,
        layers: [
          noise({ filter: { type: "lowpass", freq: 900 * (1 + spread(rng, 0.08)), q: 0.5 }, highpass: 150, env: env.perc(0.018, 0.1), gain: 0.2 }),
          noise({ color: "brown", filter: { type: "lowpass", freq: 240, q: 0.5 }, env: env.perc(0.02, 0.09), gain: 0.2 }),
        ],
      }),
  },
  "land-hard": {
    group: "move",
    label: "Land (hard)",
    about: "A deeper, longer settle with a little dust in the air, only after big falls or dives",
    limit: 2,
    minGap: 0.06,
    short: true,
    maxTail: 1.2,
    // No sine and no stone grains: weight is slow low air, the "gravel" a
    // soft band of dust that swells in over 25 ms.
    build: (rng) =>
      voice({
        gain: 0.26,
        send: 0.12,
        layers: [
          noise({ color: "brown", filter: { type: "lowpass", freq: 300, q: 0.5 }, env: env.perc(0.022, 0.2), gain: 0.34 }),
          noise({ filter: { type: "lowpass", freq: 1100 * (1 + spread(rng, 0.08)), q: 0.5 }, highpass: 140, env: env.perc(0.02, 0.14), gain: 0.18 }),
          noise({ filter: { type: "bandpass", freq: 1700, q: 0.7 }, env: env.perc(0.025, 0.22), gain: 0.035, at: 0.02 }),
        ],
      }),
  },
  "lip-catch": {
    group: "move",
    label: "Ledge catch",
    about: "A soft brush of cloth when a near miss or a step-up lifts her onto the lip (the score scoops into the chord's third)",
    limit: 1,
    minGap: 0.1,
    short: true,
    maxTail: 1,
    build: () =>
      voice({
        gain: 0.56,
        send: 0.12,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 700], [0.09, 1300, "exp"]], q: 0.8 }, env: env.perc(0.02, 0.075), gain: 0.12 }),
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
    about: "A distant low rumble with falling dust when the beat cascade arms, on the chord's root (params.chord)",
    limit: 1,
    minGap: 0.5,
    maxTail: 3.5,
    build: (rng, p = {}) =>
      voice({
        gain: 0.22,
        send: 0.25,
        layers: [
          noise({ color: "brown", filter: { type: "lowpass", freq: 220, q: 0.6 }, env: [[0, 0], [0.6, 1, "lin"], [1.6, Z, "exp"]], gain: 0.34 }),
          crackle({ dur: 1.2, from: 30, to: 12, rise: [0.4, 0.1], band: 2500, q: 0.7, grain: 0.003, gain: 0.08, seed: rng() * 1e9 }),
          tone(rootIn(chordOf(p), 38), { env: env.swell(0.5, 0.2, 0.8), gain: 0.12, cents: spread(rng, 3) }),
        ],
      }),
  },
  "tile-drop": {
    group: "stone",
    label: "Cascade tile",
    about: "The stone knock of a falling tile on the beat (the score adds a marimba note stepping down the chord)",
    limit: 3,
    minGap: 0.1,
    short: true,
    maxTail: 2,
    build: (rng) =>
      voice({
        gain: 0.73,
        send: 0.2,
        layers: [
          thump(210 * (1 + spread(rng, 0.04)), 120, 0.05, { env: env.perc(0.002, 0.08), gain: 0.2 }),
          noise({ color: "white", filter: { type: "bandpass", freq: 2500, q: 1 }, env: env.perc(0.001, 0.012), gain: 0.08 }),
          crackle({ at: 0.01, dur: 0.15, from: 140, to: 30, rise: [1, 0.2], band: 1300, q: 0.7, gain: 0.12, seed: rng() * 1e9 }),
        ],
      }),
  },
  smash: {
    group: "stone",
    label: "Dive smash",
    about: "Cracking stone and chips over a soft low boom (the score scatters six glass shards from the chord)",
    limit: 2,
    minGap: 0.08,
    maxTail: 3,
    build: (rng) =>
      voice({
        gain: 0.56,
        send: 0.3,
        layers: [
          crackle({ dur: 0.18, from: 320, to: 60, rise: [1, 0.2], band: 2600, q: 0.5, gain: 0.2, seed: rng() * 1e9 }),
          crackle({ at: 0.02, dur: 0.4, from: 60, to: 10, rise: [0.6, 0.1], band: 4200, q: 0.8, grain: 0.002, gain: 0.1, seed: rng() * 1e9 }),
          thump(82, 40, 0.35, { env: env.perc(0.004, 0.45), gain: 0.42 }),
          noise({ color: "brown", filter: { type: "lowpass", freq: 300, q: 0.5 }, env: env.perc(0.005, 0.35), gain: 0.3 }),
        ],
      }),
  },
  "wind-catch": {
    group: "air",
    label: "Wind catch",
    about: "An airy rising swell with two faint chord tones when a flight enters the solar wind (params.chord)",
    limit: 1,
    minGap: 0.2,
    maxTail: 2.5,
    build: (rng, p = {}) => {
      const [a, b] = chordTones(chordOf(p), 69, 81);
      return voice({
        gain: 0.55,
        send: 0.35,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 400], [0.5, 1500, "exp"]], q: 0.7 }, env: [[0, 0], [0.18, 1, "lin"], [0.75, Z, "exp"]], gain: 0.32 }),
          tone(a, { env: env.perc(0.12, 0.6), gain: 0.05, cents: spread(rng, 3) }),
          tone(b, { env: env.perc(0.14, 0.6), gain: 0.04, cents: spread(rng, 3) }),
        ],
      });
    },
  },
  star: {
    group: "stars",
    label: "Star",
    about: "The touch of a star: a 3 ms glass sparkle with a breath of air (the score plays its melody note on the grid)",
    limit: 4,
    minGap: 0.045,
    short: true,
    maxTail: 2.2,
    build: (rng) =>
      voice({
        gain: 1.0,
        send: 0.28,
        pan: spread(rng, 0.15),
        layers: [
          noise({ color: "white", filter: { type: "bandpass", freq: 6200 * (1 + spread(rng, 0.08)), q: 2.5 }, env: env.perc(0.001, 0.003 + rng() * 0.002), gain: 0.16 }),
          crackle({ dur: 0.09, from: 260, to: 60, rise: [1, 0.15], band: 7000, q: 1.2, grain: 0.0015, gain: 0.05, seed: rng() * 1e9 }),
          noise({ filter: { type: "bandpass", freq: 3600, q: 0.8 }, env: env.perc(0.01, 0.12), gain: 0.025 }),
        ],
      }),
  },
  "chain-note": {
    group: "stars",
    label: "Constellation star",
    about: "A warmer sparkle with a faint ink stroke (the score plays the constellation's authored note)",
    limit: 4,
    minGap: 0.04,
    short: true,
    maxTail: 2.6,
    build: (rng) =>
      voice({
        gain: 0.9,
        send: 0.32,
        pan: spread(rng, 0.15),
        layers: [
          noise({ color: "white", filter: { type: "bandpass", freq: 5600 * (1 + spread(rng, 0.08)), q: 2 }, env: env.perc(0.001, 0.004), gain: 0.15 }),
          crackle({ dur: 0.12, from: 200, to: 40, rise: [1, 0.2], band: 6000, q: 1.1, grain: 0.0015, gain: 0.05, seed: rng() * 1e9 }),
          noise({ filter: { type: "bandpass", freq: [[0, 1800], [0.15, 3200, "exp"]], q: 1.2 }, env: env.perc(0.02, 0.16), gain: 0.03 }),
        ],
      }),
  },
  constellation: {
    group: "stars",
    label: "Constellation",
    about: "Ink lines drawn in light: a rising airy shimmer (the score blooms the chord and the choir enters)",
    limit: 1,
    minGap: 0.3,
    duck: [5, 0.12, 1, 1],
    maxTail: 5,
    build: () =>
      voice({
        gain: 0.47,
        send: 0.45,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 1200], [0.6, 4200, "exp"]], q: 0.9 }, env: env.swell(0.25, 0.15, 1.1), gain: 0.05 }),
          shimmer({ at: 0.15, env: env.swell(0.3, 0.1, 1.3), gain: 0.02 }),
        ],
      }),
  },
  "chain-fade": {
    group: "stars",
    label: "Constellation fades",
    about: "A missed chain: the lines exhale, a soft falling breath (the score lets the last note sigh 50 cents down)",
    limit: 1,
    minGap: 0.3,
    maxTail: 2.5,
    build: () =>
      voice({
        gain: 0.47,
        send: 0.45,
        layers: [noise({ filter: { type: "bandpass", freq: [[0, 1200], [0.5, 500, "exp"]], q: 1 }, env: env.perc(0.05, 0.4), gain: 0.09 })],
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
    about: "A burst of light: a bright airy swell and glittering dust (the score rings the Earth colour, G#)",
    limit: 1,
    minGap: 0.2,
    duck: [3, 0.06, 0.4, 0.8],
    maxTail: 4,
    build: (rng) =>
      voice({
        gain: 0.6,
        send: 0.45,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 2200], [0.4, 5200, "exp"]], q: 0.8 }, env: env.swell(0.04, 0.1, 0.9), gain: 0.06 }),
          crackle({ dur: 0.7, from: 120, to: 20, rise: [1, 0.1], band: 6500, q: 1, grain: 0.002, gain: 0.07, seed: rng() * 1e9 }),
          shimmer({ env: env.swell(0.05, 0.1, 1), gain: 0.014 }),
        ],
      }),
  },
  "great-banked": {
    group: "stars",
    label: "Great Star kept",
    about: "A gentle two-bell confirmation on the chord's tones (params.chord)",
    limit: 1,
    minGap: 0.2,
    duck: [2, 0.05, 0.4, 0.6],
    maxTail: 4,
    build: (rng, p = {}) => {
      const tones = chordTones(chordOf(p), 79, 88);
      return voice({
        gain: 0.47,
        send: 0.4,
        layers: [
          bell(tones[0], rng, { gain: 0.14, decay: 1.2, index: 0.9 }),
          bell(tones[tones.length - 1], rng, { at: 0.14, gain: 0.14, decay: 1.3, index: 0.9 }),
          tone(rootIn(chordOf(p), 62), { env: env.perc(0.02, 0.9), gain: 0.09, cents: spread(rng, 3) }),
        ],
      });
    },
  },
  beacon: {
    group: "story",
    label: "Beacon lit",
    about: "A ring of light: an airy swell and a soft low pulse (the score chimes on the half bar and re-voices the sky)",
    limit: 1,
    minGap: 0.4,
    duck: [5, 0.2, 1.1, 1.2],
    maxTail: 5,
    build: (rng) =>
      voice({
        gain: 0.45,
        send: 0.45,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 500], [0.5, 1800, "exp"]], q: 0.9 }, env: env.swell(0.2, 0.2, 1.4), gain: 0.07 }),
          thump(90 * (1 + spread(rng, 0.03)), 55, 0.4, { env: env.swell(0.06, 0.1, 0.9), gain: 0.12 }),
          shimmer({ at: 0.1, env: env.swell(0.4, 0.2, 1.6), gain: 0.012 }),
        ],
      }),
  },
  movement: {
    group: "story",
    label: "Movement title",
    about: "A low singing bowl on the chord's root and fifth, with a breath, under the movement card (params.chord)",
    limit: 1,
    minGap: 0.5,
    duck: [4, 0.3, 1.3, 0.8],
    maxTail: 5,
    build: (rng, p = {}) => {
      const r = rootIn(chordOf(p), 45);
      return voice({
        gain: 0.45,
        send: 0.5,
        layers: [
          fm(r, { ratio: 2.76, index: [[0, 1.2], [1.5, 0.3, "exp"]], env: [[0, 0], [0.06, 1, "lin"], [2.6, Z, "exp"]], gain: 0.15, cents: spread(rng, 3) }),
          fm(safeAtOrAbove(chordOf(p), r + 7), { ratio: 2, index: [[0, 0.6], [1.5, 0.1, "exp"]], env: [[0, 0], [0.4, 1, "lin"], [2.4, Z, "exp"]], gain: 0.07, cents: spread(rng, 3) }),
          noise({ filter: { type: "bandpass", freq: 500, q: 0.8 }, env: env.swell(0.5, 0.1, 0.8), gain: 0.05 }),
        ],
      });
    },
  },
  fall: {
    group: "story",
    label: "Fall",
    about: "A soft rush of air closing into the dark while the score tape-stops and plays its last notes backwards",
    limit: 1,
    minGap: 0.3,
    duck: [6, 0.1, 0.6, 0.8],
    maxTail: 4,
    build: (rng) =>
      voice({
        gain: 0.25,
        send: 0.55,
        layers: [
          noise({ filter: { type: "lowpass", freq: [[0, 2400], [1.0, 200, "exp"]], q: 0.6 }, env: [[0, 0], [0.06, 1, "lin"], [0.5, 0.6, "lin"], [1.1, Z, "exp"]], gain: 0.16 }),
          noise({ filter: { type: "bandpass", freq: [[0, 1800], [0.8, 300, "exp"]], q: 1.2 }, env: [[0, 0], [0.04, 1, "lin"], [0.9, Z, "exp"]], gain: 0.06 }),
          thump(70, 38, 0.6, { at: 0.05, env: env.swell(0.1, 0.1, 0.7), gain: 0.1 }),
        ],
      }),
  },
  respawn: {
    group: "story",
    label: "Respawn",
    about: "A reversed shimmer rising for 0.34 s into a kalimba on the beacon chord's root as the sprout pops Diana back up (params.chord)",
    limit: 1,
    minGap: 0.3,
    maxTail: 3.5,
    build: (rng, p = {}) => {
      const c = chordOf(p),
        [a, b] = chordTones(c, 86, 95);
      return voice({
        gain: 0.32,
        send: 0.4,
        layers: [
          noise({ filter: { type: "bandpass", freq: [[0, 1500], [0.34, 3200, "exp"]], q: 0.9 }, env: env.rise(0.34, 1, 0.03), gain: 0.06 }),
          fm(a, { ratio: 2, index: [[0, 0.3]], env: env.rise(0.34, 1, 0.04), gain: 0.05, cents: spread(rng, 3) }),
          fm(b ?? a, { ratio: 2, index: [[0, 0.2]], env: env.rise(0.34, 1, 0.04), gain: 0.025, cents: spread(rng, 3) }),
          ...kalimba(rootIn(c, 71), rng, { at: 0.34, gain: 0.3, decay: 1.0 }),
          tone(rootIn(c, 59), { at: 0.34, env: env.perc(0.005, 0.5), gain: 0.1, cents: spread(rng, 3) }),
        ],
      });
    },
  },
  win: {
    group: "story",
    label: "The far door",
    about: "The door resolves: a slow bloom of the closing chord with bells (params.chord); the Earth chord's G# when Earth is blue (params.earth); a completed song adds the motif's cadence (params.complete)",
    limit: 1,
    minGap: 1,
    duck: [8, 0.6, 3.5, 2],
    maxTail: 8,
    build: (rng, p = {}) => {
      const c = p.earth ? CHORDS.Earth : chordOf(p.chord ? p : { chord: CHORDS.Dadd9 });
      const bells = chordTones(c, 74, 86).slice(0, 4);
      return voice({
        gain: 0.5,
        send: 0.5,
        layers: [
          ...pad([38, ...c.pad.slice(0, 3).map((m) => m - 12), ...c.pad], rng, { gain: 0.035, strum: 0.05, cutoff: 1600, env: [[0, 0], [1.2, 1, "lin"], [2.6, 0.8, "lin"], [5.2, Z, "exp"]] }),
          ...bells.map((m, i) => bell(m, rng, { at: 0.3 + i * 0.2, gain: 0.1, decay: 1.8, ratio: 2, index: 0.4, pan: -0.3 + i * 0.2 })),
          ...(p.earth ? [bell(80, rng, { at: 1.3, gain: 0.07, decay: 2, ratio: 2, index: 0.35 }), bell(92, rng, { at: 1.5, gain: 0.06, decay: 2.2, ratio: 2, index: 0.35 })] : []),
          // The completed song: the motif's head resolves, D5 . C#5 . B4 . A4.
          ...(p.complete ? [74, 73, 71, 69].map((m, i) => tone(m, { at: 0.9 + i * 0.56, env: env.swell(0.12, 0.25, 1.2), gain: 0.06, pan: -0.25 })) : []),
          shimmer({ at: 0.2, env: env.swell(1.5, 0.3, 3), gain: 0.012 }),
        ],
      });
    },
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
/** The movement bodies as they were before revision seven (a 2-3 ms felt
 * thump under the jump and landings, 1-2 ms ticks and pats, a crackle trail
 * on the super jump), kept only so the soundboard can A/B them against the
 * soft bodies above (createAudioEngine({ cues }) / renderCueOffline({ cues })).
 * The game never plays them. */
export const BODY_BEFORE = Object.freeze({
  jump: {
    group: "move",
    label: "Jump",
    about: "A small soft 'hup': a breath puff over a felt lift (unpitched; the score adds a glass harmonica gliding root to fifth)",
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
          thump(150 * (1 + spread(rng, 0.04)), 96, 0.07, { env: env.perc(0.003, 0.1), gain: 0.18 }),
        ],
      }),
  },
  "double-jump": {
    group: "move",
    label: "Double jump",
    about: "Higher and lighter: a thinner breath and a tiny spark tick (the score glides fifth to ninth)",
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
          noise({ color: "white", filter: { type: "bandpass", freq: 5200, q: 2 }, env: env.perc(0.001, 0.025), gain: 0.05, at: 0.012 }),
        ],
      }),
  },
  "super-jump": {
    group: "move",
    label: "Super jump",
    about: "A rising whoosh with a glittering trail (the score stacks open fifths, a thirty-second apart)",
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
          crackle({ at: 0.05, dur: 0.3, from: 160, to: 40, rise: [0.6, 0.2], band: 5200, q: 0.9, grain: 0.002, gain: 0.08, seed: rng() * 1e9 }),
        ],
      }),
  },
  dive: {
    group: "move",
    label: "Dive",
    about: "A descending air rush, 2.6 kHz to 380 Hz (the score glides an octave down to the root)",
    limit: 2,
    minGap: 0.06,
    short: true,
    maxTail: 1.8,
    build: () =>
      voice({
        gain: 0.69,
        send: 0.12,
        layers: [noise({ filter: { type: "bandpass", freq: [[0, 2600], [0.3, 380, "exp"]], q: 1 }, env: [[0, 0], [0.03, 1, "lin"], [0.22, 0.6, "lin"], [0.36, Z, "exp"]], gain: 0.34 })],
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
          // Pitched above the felt bass (D2-B2, 73-123 Hz) so a landing's
          // body never masks the note it plays.
          thump(190 * (1 + spread(rng, 0.05)), 125, 0.06, { env: env.perc(0.002, 0.08), gain: 0.3 }),
          noise({ color: "brown", filter: { type: "lowpass", freq: 620, q: 0.5 }, highpass: 140, env: env.perc(0.002, 0.05), gain: 0.34 }),
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
        gain: 0.185, // 6 dB under its first mix (audio critic: it masked the score)
        send: 0.06,
        layers: [
          thump(170 * (1 + spread(rng, 0.05)), 100, 0.12, { env: env.perc(0.002, 0.18), gain: 0.5 }),
          noise({ color: "brown", filter: { type: "lowpass", freq: 800, q: 0.5 }, highpass: 130, env: env.perc(0.002, 0.09), gain: 0.4 }),
          crackle({ dur: 0.12, from: 220, to: 60, rise: [1, 0.2], band: 1400, q: 0.8, gain: 0.12, seed: rng() * 1e9 }),
        ],
      }),
  },
  "lip-catch": {
    group: "move",
    label: "Ledge catch",
    about: "A tiny pat when a near miss pops onto the lip (the score scoops into the chord's third)",
    limit: 1,
    minGap: 0.1,
    short: true,
    maxTail: 1,
    build: () =>
      voice({
        gain: 1.0,
        send: 0.08,
        layers: [noise({ filter: { type: "bandpass", freq: 1800, q: 1.5 }, env: env.perc(0.002, 0.03), gain: 0.19 })],
      }),
  },
});

/* ---------- the score's voices ----------
 * `build(rng, note)` turns a note from score.mjs (midi or midis, dur, gain,
 * pan, glideTo, bend, blur, strum) into layers. `bed` voices are the world
 * and follow the tuning value H (detune bus, tape wow, lowpass); the others
 * are Diana's own notes and stay in tune. `hold` voices are sustained: the
 * next of the same kind releases them, so the sky never has a gap. Levels
 * are relative; the score's output sits under the cues (README, "Sound").
 * `send` feeds the 5.5 s space reverb and its octave shimmer. */
const swellEnv = (a, dur, r, sustain = 0.85) => [[0, 0], [a, 1, "lin"], [Math.max(a + 0.01, dur), sustain, "lin"], [Math.max(a + 0.01, dur) + r, Z, "exp"]];
const harmonicaLayers = (n, rng, o = {}) => {
  const m = n.midi ?? 74,
    dur = n.dur ?? 0.6,
    a = o.attack ?? 0.12,
    e = swellEnv(a, Math.max(a + 0.05, dur - 0.25), o.release ?? 1.1, 0.7),
    c = (n.blur ?? 0) + spread(rng, 2);
  // Panned once at voice level (spec.pan), not per layer: three fewer
  // stereo panners per note.
  return [
    tone(m, { glideTo: n.glideTo, glide: n.glide, env: e, gain: (o.gain ?? 0.12), cents: c }),
    // The third harmonic, 20 dB down, gives the glass its hollow ring.
    tone(m + 19.02, { partial: true, glideTo: n.glideTo != null ? n.glideTo + 19.02 : undefined, glide: n.glide, env: e, gain: (o.gain ?? 0.12) * 0.1, cents: c }),
    // The wet-finger rub: 80 ms of pink noise at twice the fundamental.
    noise({ filter: { type: "bandpass", freq: Math.min(12000, midiHz(m) * 2), q: 12 }, env: env.perc(0.02, 0.08), gain: (o.gain ?? 0.12) * 0.5 }),
  ];
};
export const VOICES = {
  pad: {
    group: "bed",
    label: "Sky pad",
    about: "Each chord tone as two saws 12 cents apart and a triangle an octave below the root, under a breathing 900 Hz lowpass; 1.6 s in, 2.8 s out",
    build: (rng, n = {}) => {
      const midis = n.midis ?? CHORDS.D.pad,
        dur = n.dur ?? 4 * BEAT,
        e = swellEnv(1.6, dur, 2.8);
      // Rendered as grouped buses (renderPad): each tone's two saws feed the
      // two sides in turn, the second 7-15 ms later so the sides decorrelate,
      // under one envelope. The layers below describe the same sound (tests,
      // tuning checks); the engine does not build a node graph per layer.
      const layers = [];
      midis.forEach((m, i) => {
        const u = midis.length > 1 ? i / (midis.length - 1) : 0.5;
        layers.push(tone(m, { wave: "sawtooth", cents: 6, detuneBus: 1, env: e, gain: 0.028, pan: i % 2 ? 0.75 : -0.75 }));
        layers.push(tone(m, { wave: "sawtooth", cents: -6, detuneBus: -1, env: e, gain: 0.028, pan: i % 2 ? -0.75 : 0.75, at: 0.007 + 0.008 * u }));
      });
      layers.push(tone(midis[0] - 12, { wave: "triangle", detuneBus: 1, env: e, gain: 0.06 }));
      return voice({ gain: 0.64 * (n.gain ?? 1), send: 0.55, bed: true, hold: "pad", grouped: true, env: e, filter: { type: "lowpass", freq: 900, q: 0.4, lfo: { rate: 0.07, depth: 300 } }, layers });
    },
  },
  choir: {
    group: "bed",
    label: "Choir",
    about: "Formant voices, oo opening to ah, with a slow vibrato: four bars after every completed constellation",
    build: (rng, n = {}) => {
      const midis = n.midis ?? [62, 66, 69],
        dur = n.dur ?? 4 * BEAT,
        e = swellEnv(0.7, dur, 2.2, 0.8);
      return voice({
        gain: 0.8 * (n.gain ?? 1),
        send: 0.6,
        bed: true,
        hold: "choir",
        // Formant band-passes (Q 6) keep only a little of the saws' energy,
        // hence the high gain (balanced by offline renders). All notes share
        // one pair of formant filters.
        autopan: { rate: 0.06, depth: 0.35 },
        layers: [choirLayer(midis[0], { midis, env: e, gain: 0.45 * Math.sqrt(midis.length / 3), detuneBus: 1, morph: 1.4 })],
      });
    },
  },
  signal: {
    group: "bed",
    label: "Signal",
    about: "The far call: a distant glass harmonica playing the soundtrack's motif from the right, nearer with progress",
    build: (rng, n = {}) => voice({ gain: 0.7 * (n.gain ?? 1), send: n.send ?? 0.5, bed: true, pan: n.pan ?? 0.6, layers: harmonicaLayers(n, rng, { attack: 0.22, release: 1.4, gain: 0.1 }) }),
  },
  pulse: {
    group: "bed",
    label: "Heartbeat",
    about: "A felt heartbeat on beats 1 and 3, the half-time pulse (unpitched)",
    build: (rng, n = {}) =>
      voice({
        gain: 0.7 * (n.gain ?? 1),
        send: 0.12,
        bed: true,
        layers: [
          thump(74 * (1 + spread(rng, 0.03)), 44, 0.16, { env: env.perc(0.004, 0.26), gain: 0.32 }),
          // The felt of the beater: what makes the beat heard on small speakers.
          noise({ color: "brown", filter: { type: "lowpass", freq: 520, q: 0.5 }, env: env.perc(0.002, 0.04), gain: 0.14 }),
        ],
      }),
  },
  shaker: {
    group: "bed",
    label: "Shaker",
    about: "A whisper of seeds on every sixteenth, about 30 dB under the score",
    build: (rng, n = {}) =>
      voice({
        gain: 0.5 * (n.gain ?? 1),
        send: 0.1,
        bed: true,
        pan: 0.3 + spread(rng, 0.1),
        // The engine plays shakers on one persistent noise voice (per-tick
        // envelopes, no new nodes); this recipe is its description.
        persistent: "shaker",
        layers: [noise({ color: "white", filter: { type: "bandpass", freq: 7000 * (1 + spread(rng, 0.05)), q: 1.5 }, highpass: 4000, env: env.perc(0.002, 0.035), gain: 0.05 })],
      }),
  },
  celesta: {
    group: "bed",
    label: "Celesta arpeggio",
    about: "FM 4:1 celesta sixteenths through Movement II, earned by the lid smash or Great Star 2",
    build: (rng, n = {}) =>
      voice({ gain: 0.6 * (n.gain ?? 1), send: 0.45, bed: true, layers: [fm(n.midi ?? 86, { ratio: 4, index: [[0, 1.5], [0.06, 0.1, "exp"]], env: env.perc(0.002, 0.45), gain: 0.21, pan: n.pan, cents: spread(rng, 2) })] }),
  },
  dust: {
    group: "bed",
    label: "Star dust",
    about: "Grains of an inharmonic celestial bell on the chord and the Earth colour G#, after a Great Star",
    build: (rng, n = {}) => {
      const midis = n.midis ?? [n.midi ?? 86],
        long = midis.length > 1;
      return voice({
        gain: (long ? 0.8 : 0.5) * (n.gain ?? 1),
        send: 0.6,
        bed: true,
        layers: midis.map((m, i) =>
          fm(m, {
            ratio: 1.4,
            index: [[0, 0.6], [long ? 1.4 : 0.05, 0.08, "exp"]],
            env: long ? env.perc(0.004, 2.2) : [[0, 0], [0.015, 1, "lin"], [0.07, Z, "exp"]],
            gain: long ? 0.085 : 0.07,
            at: (n.strum ?? 0) * i,
            pan: n.pan ?? spread(rng, 0.5),
            cents: spread(rng, 2),
          }),
        ),
      });
    },
  },
  harmonica: {
    group: "player",
    label: "Glass harmonica",
    about: "Diana's breath made glass: jumps glide root to fifth, doubles fifth to ninth, dives an octave down, wind runs rise",
    build: (rng, n = {}) => voice({ gain: 1.0 * (n.gain ?? 1), send: n.send ?? 0.35, pan: n.pan, layers: harmonicaLayers(n, rng) }),
  },
  vowel: {
    group: "player",
    label: "Cape vowel",
    about: "The cape flight holds a sung vowel on the chord's fifth, oo opening to ah over the flight",
    build: (rng, n = {}) => {
      const dur = n.dur ?? 0.7;
      return voice({
        gain: 1.0 * (n.gain ?? 1),
        send: n.send ?? 0.45,
        layers: [choirLayer(n.midi ?? 69, { env: swellEnv(0.08, dur - 0.15, 0.7, 0.8), gain: 0.2, morph: dur, pan: n.pan, cents: n.blur ?? 0 }), tone(n.midi ?? 69, { env: swellEnv(0.1, dur - 0.15, 0.6, 0.6), gain: 0.03, pan: n.pan, cents: n.blur ?? 0 })],
      });
    },
  },
  glass: {
    group: "player",
    label: "Star glass",
    about: "A loose star's melody note: music-box glass with a soft celestial partial, climbing the chord",
    build: (rng, n = {}) => {
      const m = n.midi ?? 74,
        c = n.blur ?? 0;
      return voice({
        gain: 1.0 * (n.gain ?? 1),
        send: n.send ?? 0.4,
        pan: spread(rng, 0.15),
        layers: [
          fm(m, { ratio: 4, index: [[0, 0.7], [0.08, 0.1, "exp"]], env: env.perc(0.002, 1.1), gain: 0.16, cents: c + spread(rng, 2) }),
          fm(m + 12, { ratio: 1.4, index: [[0, 0.3], [0.3, 0.05, "exp"]], env: env.perc(0.004, 0.5), gain: 0.025, cents: c }),
        ],
      });
    },
  },
  kalimba: {
    group: "player",
    label: "Constellation kalimba",
    about: "A constellation's authored note: a felt kalimba with a soft octave below; a broken chain's last note sighs 50 cents down",
    build: (rng, n = {}) => {
      const m = n.midi ?? 74,
        c = n.blur ?? 0;
      if (n.bend)
        return voice({ gain: 0.7 * (n.gain ?? 1), send: 0.5, layers: [tone(m, { bend: n.bend, bendTime: n.bendTime ?? 0.4, env: env.perc(0.01, 1.0), gain: 0.12, cents: c }), tone(m + 12, { partial: true, bend: n.bend, env: env.perc(0.01, 0.4), gain: 0.02 })] });
      return voice({ gain: 1.0 * (n.gain ?? 1), send: n.send ?? 0.4, pan: spread(rng, 0.15), layers: [...kalimba(m, rng, { gain: 0.3, decay: 1.1 }).map((L) => ({ ...L, cents: L.cents + c })), tone(m - 12, { env: env.perc(0.01, 0.6), gain: 0.05, cents: c })] });
    },
  },
  bloom: {
    group: "player",
    label: "Bloom",
    about: "A constellation or super jump blooms: the chord strummed in glass over a soft pad swell, into the shimmer",
    build: (rng, n = {}) => {
      const midis = n.midis ?? [50, 62, 66, 69, 76],
        strum = n.strum ?? 0.03;
      return voice({
        gain: 0.85 * (n.gain ?? 1),
        send: 0.6,
        layers: [
          ...midis.map((m, i) => (m < 60 ? tone(m, { at: i * strum, env: env.swell(0.25, 0.4, 1.6), gain: 0.07 }) : glass(m, rng, { at: i * strum, gain: 0.08, decay: 1.2, bright: 0.3, pan: -0.4 + (0.8 * i) / Math.max(1, midis.length - 1) }))),
          ...pad(midis.filter((m) => m >= 60).slice(0, 3), rng, { at: 0.04, gain: 0.03, cutoff: 1600, env: [[0, 0], [0.3, 1, "lin"], [0.8, 0.8, "lin"], [2.6, Z, "exp"]] }),
          shimmer({ at: 0.1, env: env.swell(0.3, 0.1, 1.4), gain: 0.012 }),
        ],
      });
    },
  },
  chime: {
    group: "player",
    label: "Beacon chime",
    about: "Two soft bells on the half bar when a beacon lights",
    build: (rng, n = {}) =>
      voice({ gain: 0.7 * (n.gain ?? 1), send: 0.55, layers: (n.midis ?? [81, 86]).map((m, i) => bell(m, rng, { at: i * (n.strum ?? 0.14), gain: 0.13, decay: 1.7 })) }),
  },
  bass: {
    group: "player",
    label: "Felt bass",
    about: "Steps: every stable landing plays the chord's root, a felt mallet on a sine under 400 Hz",
    build: (rng, n = {}) => {
      const m = n.midi ?? 38;
      return voice({
        gain: 1.0 * (n.gain ?? 1),
        send: 0.12,
        pan: n.pan ?? -0.25,
        layers: [
          tone(m, { env: env.perc(0.015, 0.6), gain: 0.34, filter: { type: "lowpass", freq: 400, q: 0.7 } }),
          tone(m + 12, { partial: true, env: env.perc(0.01, 0.25), gain: 0.05 }),
          noise({ color: "pink", filter: { type: "lowpass", freq: 1200, q: 0.5 }, env: env.perc(0.001, 0.008), gain: 0.08 }),
        ],
      });
    },
  },
  marimba: {
    group: "player",
    label: "Stone marimba",
    about: "Each cascade tile knocks a marimba note on the beat, stepping down the chord",
    build: (rng, n = {}) => {
      const m = n.midi ?? 71,
        c = spread(rng, 3);
      return voice({
        gain: 0.75 * (n.gain ?? 1),
        send: 0.25,
        layers: [tone(m, { env: env.perc(0.002, 0.32), gain: 0.3, cents: c }), tone(m + 24, { partial: true, env: env.perc(0.001, 0.05), gain: 0.06, cents: c })],
      });
    },
  },
  shards: {
    group: "player",
    label: "Glass shards",
    about: "A smash scatters six glass shards from the chord, a thirty-second apart",
    build: (rng, n = {}) =>
      voice({
        gain: 0.6 * (n.gain ?? 1),
        send: 0.45,
        layers: (n.midis ?? [86, 90, 93, 98, 74, 78]).map((m, i) => glass(m, rng, { at: i * (n.strum ?? 0.07) + rng() * 0.01, gain: 0.06 + rng() * 0.03, decay: 0.25 + rng() * 0.3, bright: 0.6, pan: spread(rng, 0.5) })),
      }),
  },
};
export const VOICE_NAMES = Object.freeze(Object.keys(VOICES));
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
  "movement", "death", "respawn", "wind-catch", "win", "get", "wind-refund",
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
    // A GET (a new verb) blooms like a Great Star; the wind's refund is the
    // cape's refill glint (RESEARCH_PROGRESSION 2.2, 3.2).
    case "get": return [{ cue: "great-banked" }];
    case "wind-refund": return [{ cue: "refill" }];
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
 * means what it says (convolver normalisation stays off). `fadeIn` gives the
 * space reverb its bloom: the tail swells for that long after the note. */
export function reverbImpulse(sampleRate, seconds = 2.4, rng = mulberry32(11), { predelay = 0.014, fadeIn = 0 } = {}) {
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
      const bloom = fadeIn > 0 ? Math.min(1, (i - p) / (fadeIn * sampleRate)) : 1;
      const v = lp * 0.001 ** u * bloom * Math.min(1, (len - i) / (0.05 * sampleRate));
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
/** The title / door soundtrack. Revision seven (user: the background was
 * "too full, too present, too loud") takes it 4 dB under its revision-five
 * level (0.32), with the bed below. */
export const MUSIC_LEVEL = 0.2;
/** Mix rules, global in the mixer layer so that every level preset in
 * score.mjs (four today, eight in the next phase) inherits them; a preset
 * shapes harmony, groove and space, never these. The player's notes (steps,
 * stars, strings: the path drawing the song) are the foreground; the bed
 * (sky, Signal, pulse, choir, glass, Earth) is the room. README, "The mix". */
export const MIX = Object.freeze({
  bed: -9, // dB: the bed's dry bus, under Diana's notes (they are untouched)
  bedWet: 4, // dB: its reverb sends lose only 5 dB, so the bed moves further away
  bedLowpass: 6500, // Hz: the bed's tuning lowpass at H = 1 (was 16 kHz); it still closes with H
  bedDip: Object.freeze({ freq: 2500, q: 0.8, gain: -4 }), // dB: tames the pads' and choir's 1-4 kHz presence
  bedVoices: 12, // bed voices sounding at once; the oldest fades (Diana's notes are never stolen for the bed)
  layers: Object.freeze({ sky: -1, signal: -2, pulse: -3, choir: -3, glass: -2, earth: -1 }), // dB on top of the bed bus
  presence: Object.freeze({ freq: 3800, q: 0.7, gain: 3.5 }), // dB: now on Diana's notes only (it lifted the whole score)
});
/** The revision-six mix, kept only for the soundboard's before / after A/B
 * (createAudioEngine({ mix: "before" })): the bed as loud as Diana's notes,
 * open to 16 kHz, the presence lift on everything, no bed voice cap, and the
 * soundtrack at 0.32. */
export const MIX_BEFORE = Object.freeze({ bed: 0, bedWet: 0, bedLowpass: 16000, bedDip: Object.freeze({ freq: 2500, q: 0.8, gain: 0 }), bedVoices: 99, layers: Object.freeze({}), presence: MIX.presence, presenceOnBed: true, closing: 1, music: 0.32 });
/** Player volume settings: Music (the bed and the soundtrack) and Sounds
 * (Diana's bodies and notes, stars, beacons, the interface), each 0-1, 1 by
 * default = the mix above. Guarded storage like the sound setting. */
export const VOLUME_KEY = "solarum.volume";
export function readVolumes(storage) {
  try {
    const s = typeof storage === "function" ? storage() : storage;
    const v = JSON.parse(s?.getItem(VOLUME_KEY) || "null");
    const ok = (x) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 1);
    return { music: ok(v?.music), sounds: ok(v?.sounds) };
  } catch {
    return { music: 1, sounds: 1 };
  }
}
export function writeVolumes(storage, v) {
  try {
    const s = typeof storage === "function" ? storage() : storage;
    s?.setItem(VOLUME_KEY, JSON.stringify({ music: v.music, sounds: v.sounds }));
    return !!s;
  } catch {
    return false;
  }
}
/** The score's output level, calibrated by offline renders to sit where the
 * soundtrack sat under the cues (README, "Sound"). */
export const SCORE_LEVEL = 0.55;
/** Everything was calibrated quiet (the old in-level mp3 sat at -29 LUFS);
 * the audio critic measured -27.5 LUFS against the soundtrack's own -15. The
 * whole mix now gains 7.7 dB into a fast limiter (whose built-in make-up
 * adds about 1.5 dB) and the safety clipper after it: with the louder space
 * return that puts a perfect run near the brief's -16 LUFS (measured offline,
 * README "The mix"). The soundtrack's level rose 3.3 dB to match. */
export const OUTPUT_GAIN = 10 ** (7.7 / 20);
const PAUSE_FADE = 0.015; // s of fade before suspending and after resuming
/** Audio seconds of score scheduled ahead of the present (brief 5.2). The rAF
 * loop schedules every frame; a hidden tab pauses the game, so no timer
 * fallback is needed (nothing moves while the simulation is frozen). */
export const SCHEDULE_AHEAD = 0.12;
const MAX_MUSIC = 28; // score voices beside the 20 cue voices
const TAPE_BASE = 0.005; // s of music-bus delay at rest (the tape-stop's head room)
const WOW_BASE = 0.008;
const WOW_RATE = 0.45; // Hz
/** Seconds of wow-delay depth per cent: a delay swinging +-D at f Hz bends the
 * pitch by 2 pi f D (as a ratio), and 1 cent is 1/1731 of that ratio. */
const WOW_PER_CENT = 1 / (1731 * 2 * Math.PI * WOW_RATE);
const MP3_FIRST_BEAT = 0.449; // s into assets/soundtrack.mp3 (RESEARCH_MUSIC 1)
/** Bar 26 of the soundtrack, where its full section begins (RESEARCH_MUSIC 1:
 * bars 26-68 are the loud part), on a downbeat: first beat + 25 bars. */
const MP3_FULL_SECTION = MP3_FIRST_BEAT + 25 * 4 * (60 / 107);
const DOOR_BOOST = 1.4; // +3 dB: the full section then matches the door's bloom
/** The bed sounds this much after its grid point: Diana's own notes arrive a
 * frame after their event (0-17 ms), so a slightly late bed centres them on
 * the beat instead of trailing it (audio critic, finding 7). */
const BED_DELAY = 0.015;
const wallNow = () => globalThis.performance?.now?.() ?? Date.now();
// Cracked stone of every level (ids are unique within a level, and no id is
// cracked in one level and stable in another).
const CRACKED = new Set(LEVELS.flatMap((d) => createLevel(d).platforms.filter((q) => q.type).map((q) => q.id)));
/** Pitched cues follow the score's chord at the moment they sound. */
const CHORDED = new Set(["cascade", "wind-catch", "great-banked", "movement", "respawn"]);

/**
 * options: enabled (default true), context (an existing / Offline context),
 * AudioContext (class override), seed, safety (soft clipper, default true),
 * gentle (Gentle music), clock (a function returning the audio time to use
 * instead of context.currentTime: offline renders of a whole run schedule
 * everything up front), spaceSeconds (space reverb length; 4 s on phones),
 * only (an iterable of score layer ids: render just those, for stems),
 * level (1-4: whose score preset and path to conduct; setLevel changes it).
 */
export function createAudioEngine(options = {}) {
  const seed = options.seed ?? 1987,
    safety = options.safety !== false;
  let enabled = options.enabled ?? true,
    ctx = options.context ?? null;
  const offline = !!ctx && typeof ctx.startRendering === "function";
  let graph = null,
    score = null,
    paused = false,
    musicEl = null,
    musicRouted = false,
    musicWanted = false,
    musicLevel = options.mix === "before" ? MIX_BEFORE.music : MUSIC_LEVEL,
    resumingUntil = 0,
    bed = null,
    melody = null,
    duckState = { until: -1, target: 1 },
    nodes = 0,
    dropped = 0,
    peakVoices = 0,
    peakMusic = 0,
    peakBed = 0,
    darkened = false,
    doorTimer = null,
    pauseTimer = null;
  const rng = mulberry32(seed),
    voices = [],
    music = [],
    held = { pad: null, choir: null },
    lastAt = {},
    played = {},
    chainSize = {},
    buffers = {},
    plucks = new Map();
  let level = options.level ?? 1;
  const vol = { music: options.volumes?.music ?? 1, sounds: options.volumes?.sounds ?? 1 };
  const mix = options.mix === "before" ? MIX_BEFORE : MIX;
  // A cue book override (the soundboard's before / after A/B); the game
  // always plays CUES.
  const book = options.cues ? { ...CUES, ...options.cues } : CUES;
  const makeConductor = (n, gentle) => createConductor({ level: n, path: PATHS[n], cracked: CRACKED, seed: seed ^ 0x51, gentle });
  let conductor = makeConductor(level, !!options.gentle);
  const clock = createClockMap();
  const only = options.only ? new Set(options.only) : null;
  const sc = { lastAudio: null, scale: 1, sim: 0, status: "ready", scheduled: 0, late: 0, maxLate: 0, lateCount: 0, maxQuant: 0, tapeStops: 0, fades: 0, restarts: 0, frames: 0, mix: null, whistle: null };

  const node = (kind) => {
    nodes++;
    return ctx[`create${kind}`]();
  };
  const t = () => (options.clock ? options.clock() : ctx.currentTime);
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

  /* Generated sample data, in the exact order build() draws it from one
   * seeded rng, so a warm-up (prepare) and a cold build make identical
   * buffers. Each step is a few ms; prepare() runs them in separate tasks. */
  const pre = { r: null, room: null, noise: {}, space: null };
  const PREP = [
    () => (pre.r ??= mulberry32(seed ^ 0x5eed), pre.room ??= reverbImpulse(ctx.sampleRate, 2.4, pre.r)),
    ...["white", "pink", "brown"].map((color) => () => (pre.noise[color] ??= noiseSamples(ctx.sampleRate, 3, color, pre.r))),
    () => (pre.space ??= reverbImpulse(ctx.sampleRate, Math.min(options.spaceSeconds ?? 9, scoreOf(level).space.seconds), pre.r, { predelay: 0.03, fadeIn: 0.12 })),
  ];
  function build() {
    for (const step of PREP) step();
    const sr = ctx.sampleRate,
      r = pre.r;
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
    const output = node("Gain");
    output.gain.value = OUTPUT_GAIN;
    const limiter = node("DynamicsCompressor");
    limiter.threshold.value = -3;
    limiter.knee.value = 1;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    master.connect(output);
    output.connect(limiter);
    const verbIn = node("Gain");
    const verb = node("Convolver");
    verb.normalize = false;
    verb.buffer = makeBuffer(pre.room);
    buffers.impulse = true;
    const verbTone = node("BiquadFilter");
    verbTone.type = "lowpass";
    verbTone.frequency.value = 5200;
    verbTone.Q.value = 0.5;
    const verbOut = node("Gain");
    verbOut.gain.value = 0.55;
    const musicGain = node("Gain");
    musicGain.gain.value = musicLevel;
    const musicTone = node("BiquadFilter");
    musicTone.type = "lowpass";
    musicTone.frequency.value = 20000;
    musicTone.Q.value = 0.5;
    // The player's Music setting, after the soundtrack's own fades and ducks.
    const musicVol = node("Gain");
    musicVol.gain.value = vol.music;
    sfx.gain.value = SFX_LEVEL * vol.sounds;
    sfx.connect(comp);
    comp.connect(master);
    verbIn.connect(verb);
    verb.connect(verbTone);
    verbTone.connect(verbOut);
    verbOut.connect(master);
    musicGain.connect(musicTone);
    musicTone.connect(musicVol);
    musicVol.connect(master);
    let last = limiter;
    if (safety) {
      const shaper = node("WaveShaper");
      shaper.curve = safetyCurve();
      shaper.oversample = "none";
      limiter.connect(shaper);
      last = shaper;
    }
    last.connect(ctx.destination);
    for (const color of ["white", "pink", "brown"]) {
      buffers[color] = makeBuffer([pre.noise[color]]);
    }
    graph = { sfx, comp, master, output, verbIn, music: musicGain, musicTone, musicVol, out: last };
    // A browser without delay lines or constant sources still gets every cue;
    // only the score stays silent.
    try {
      buildScore(r);
    } catch {
      score = null;
    }
  }
  /** An octave-up pitch shifter for the shimmer: two delay lines whose delay
   * falls from W to 0 over W seconds (a falling delay reads the past faster:
   * slope -1 doubles the pitch), half a period apart, each under a sine
   * window that is silent at its jump. Looping buffers drive the delay and
   * gain params at audio rate, so it is sample-exact offline too. It also
   * supplies the DelayNode that Web Audio requires inside a feedback loop. */
  function octaveUp(input) {
    const sr = ctx.sampleRate,
      W = 0.08,
      N = Math.round(W * sr);
    const ramp = new Float32Array(N),
      win = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = i / N;
      ramp[i] = W * (1 - u);
      win[i] = Math.sin(Math.PI * u);
    }
    const rampBuf = makeBuffer([ramp]),
      winBuf = makeBuffer([win]);
    const out = node("Gain");
    const at = t();
    for (const phase of [0, 0.5]) {
      const d = node("Delay");
      d.delayTime.value = 0;
      const g = node("Gain");
      g.gain.value = 0;
      const rs = node("BufferSource"),
        ws = node("BufferSource");
      rs.buffer = rampBuf;
      ws.buffer = winBuf;
      rs.loop = ws.loop = true;
      rs.connect(d.delayTime);
      ws.connect(g.gain);
      input.connect(d);
      d.connect(g);
      g.connect(out);
      rs.start(at, phase * W);
      ws.start(at, phase * W);
    }
    return out;
  }
  function buildScore(r) {
    const sr = ctx.sampleRate;
    const scoreOut = node("Gain");
    scoreOut.gain.value = SCORE_LEVEL;
    const tapeGain = node("Gain");
    const tapeTone = node("BiquadFilter");
    tapeTone.type = "lowpass";
    tapeTone.frequency.value = 18000;
    tapeTone.Q.value = 0.5;
    const tape = ctx.createDelay(1);
    nodes++;
    tape.delayTime.value = TAPE_BASE;
    const scoreIn = node("Gain");
    scoreIn.connect(tape);
    tape.connect(tapeTone);
    tapeTone.connect(tapeGain);
    tapeGain.connect(scoreOut);
    scoreOut.connect(graph.master);
    // Diana's notes: a little air (+3.5 dB around 3.8 kHz) on them alone, so
    // the path's song sits in front of the room, then the Sounds setting.
    const playerIn = node("Gain");
    const presence = node("BiquadFilter");
    presence.type = "peaking";
    presence.frequency.value = mix.presence.freq;
    presence.Q.value = mix.presence.q;
    presence.gain.value = mix.presence.gain;
    const playerVol = node("Gain");
    playerVol.gain.value = vol.sounds;
    playerIn.connect(presence);
    presence.connect(playerVol);
    playerVol.connect(scoreIn);
    // The bed: tape wow (H) and a lowpass that closes a little as H falls.
    const bedIn = node("Gain");
    const wow = ctx.createDelay(0.05);
    nodes++;
    wow.delayTime.value = WOW_BASE;
    const wowLfo = node("Oscillator"),
      wowDepth = node("Gain");
    wowLfo.frequency.value = WOW_RATE;
    wowDepth.gain.value = 0;
    wowLfo.connect(wowDepth);
    wowDepth.connect(wow.delayTime);
    wowLfo.start(t());
    const bedTone = node("BiquadFilter");
    bedTone.type = "lowpass";
    bedTone.frequency.value = mix.bedLowpass;
    bedTone.Q.value = 0.5;
    // The room, not the singer: 1-4 kHz tamed, the whole bed mix.bed under
    // Diana's notes, then the Music setting.
    const bedDip = node("BiquadFilter");
    bedDip.type = "peaking";
    bedDip.frequency.value = mix.bedDip.freq;
    bedDip.Q.value = mix.bedDip.q;
    bedDip.gain.value = mix.bedDip.gain;
    const bedVol = node("Gain");
    bedVol.gain.value = dbToGain(mix.bed) * vol.music;
    bedIn.connect(wow);
    wow.connect(bedTone);
    bedTone.connect(bedDip);
    if (mix.presenceOnBed) {
      // (The revision-six mix lifted the whole score, bed included.)
      const lift = node("BiquadFilter");
      lift.type = "peaking";
      lift.frequency.value = mix.presence.freq;
      lift.Q.value = mix.presence.q;
      lift.gain.value = mix.presence.gain;
      bedDip.connect(lift);
      lift.connect(bedVol);
    } else bedDip.connect(bedVol);
    bedVol.connect(scoreIn);
    // Space: a long, blooming, darkening reverb whose return passes the tape
    // (so a tape-stop drags the tail down too), plus the octave shimmer.
    const spaceIn = node("Gain");
    // Reverb sends come in through two doors, so each setting also scales
    // its own tails: the bed's (mix.bed + mix.bedWet: further away) and
    // Diana's.
    const bedSend = node("Gain"),
      playerSend = node("Gain");
    bedSend.gain.value = dbToGain(mix.bed + mix.bedWet) * vol.music;
    playerSend.gain.value = vol.sounds;
    bedSend.connect(spaceIn);
    playerSend.connect(spaceIn);
    const space = node("Convolver");
    space.normalize = false;
    // Each level has its own space (5.5 s floating to 2.5 s close, RESEARCH_LEVELS 6).
    const spaceSeconds = (n) => Math.min(options.spaceSeconds ?? 9, scoreOf(n).space.seconds);
    space.buffer = makeBuffer(pre.space);
    buffers.space = true;
    const spaceOut = node("Gain");
    spaceOut.gain.value = 1.1; // +5 dB on the first mix: more space, more float
    spaceIn.connect(space);
    space.connect(spaceOut);
    spaceOut.connect(scoreIn);
    const shifted = octaveUp(spaceOut);
    const hp = node("BiquadFilter");
    hp.type = "highpass";
    hp.frequency.value = 300;
    const lp = node("BiquadFilter");
    lp.type = "lowpass";
    lp.frequency.value = 6000;
    const fb = node("Gain");
    fb.gain.value = 0.4;
    shifted.connect(hp);
    hp.connect(lp);
    lp.connect(fb);
    fb.connect(spaceIn);
    const shimmerOut = node("Gain");
    shimmerOut.gain.value = 0.22 * (scoreOf(level).space.shimmer / 0.4);
    lp.connect(shimmerOut);
    shimmerOut.connect(scoreIn);
    // The detune bus: pad and choir oscillators add +-padCents from here.
    const det = ctx.createConstantSource();
    nodes++;
    det.offset.value = 0;
    det.start(t());
    const detDown = node("Gain");
    detDown.gain.value = -1;
    det.connect(detDown);
    // The flat bus: every bed oscillator (and plucked buffer) follows it, so
    // after mistakes the whole world drifts flat of Diana's in-tune voice.
    const flat = ctx.createConstantSource();
    nodes++;
    flat.offset.value = 0;
    flat.start(t());
    // Rewind notes sound while the score bus is stopped, so they bypass it.
    const rewind = node("Gain");
    rewind.gain.value = vol.music;
    rewind.connect(graph.master);
    score = { scoreOut, tapeGain, tapeTone, tape, scoreIn, playerIn, playerVol, bedIn, bedVol, bedSend, playerSend, wowDepth, bedTone, spaceIn, fb, det, detDown, flat, rewind, space, shimmerOut, spaceSeconds, rng: r };
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
      musicEl.volume = Math.min(1, musicLevel * OUTPUT_GAIN * vol.music);
    }
  }
  /** Warm-up at load (game.js, sound on): create the context, which starts
   * suspended without a gesture, and build the whole graph one step per
   * task, so the wake press only has to resume it. Creating an AudioContext
   * takes 60-350 ms on the main thread on some machines; done at the press
   * it stalled the first frames of the wake (playtest critic). Nothing plays
   * and the soundtrack is not routed until unlock() inside a gesture. */
  let preparing = null;
  function prepare({ step = (fn) => setTimeout(fn, 0) } = {}) {
    if (!enabled || offline || graph || preparing) return preparing ?? Promise.resolve(!!graph);
    preparing = new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        if (graph && i <= PREP.length) return resolve(true); // unlock() finished it meanwhile
        try {
          if (i === 0) {
            const AC = options.AudioContext ?? globalThis.AudioContext ?? globalThis.webkitAudioContext;
            if (!AC) return resolve(false);
            try {
              ctx ??= new AC({ latencyHint: "interactive" });
            } catch {
              ctx ??= new AC();
            }
          } else if (i <= PREP.length) PREP[i - 1]();
          else if (!graph) build();
          else {
            // The wake cue's kalimba strings, so the pop computes none.
            for (const L of CUES.wake.build(mulberry32(1), {}).layers) if (L.kind === "pluck") pluckBuffer(L);
            return resolve(true);
          }
        } catch {
          return resolve(false);
        }
        i++;
        step(tick);
      };
      step(tick);
    });
    return preparing;
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
  function release(list, now) {
    for (let i = list.length - 1; i >= 0; i--) {
      const v = list[i];
      if (v.end + 0.05 < now) {
        // Offline, every voice is scheduled before the render runs, so the
        // engine's (virtual) clock passing a voice's end does not mean it has
        // sounded: forget it, but leave its nodes connected.
        if (!offline)
          for (const n of v.nodes) {
            try {
              n.disconnect();
            } catch {
              /* already gone */
            }
          }
        list.splice(i, 1);
      }
    }
  }
  const prune = (now) => {
    release(voices, now);
    release(music, now);
  };
  function fadeOut(v, fade = 0.04, from) {
    if (v.stolen) return;
    const now = Math.max(t(), from ?? 0);
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
  const active = (now, list = voices) => list.filter((v) => !v.stolen && v.end > now);

  function pluckBuffer(L) {
    const key = `${L.midi}|${L.t60}|${L.bright}`;
    if (!plucks.has(key)) {
      if (plucks.size > 48) plucks.delete(plucks.keys().next().value);
      plucks.set(key, makeBuffer([karplusStrong(ctx.sampleRate, L.hz, { t60: L.t60, bright: L.bright, rng: mulberry32(L.midi * 31 + 7) })]));
    }
    return plucks.get(key);
  }
  function vibratoInto(params, vib, start, end, list, sources) {
    const lfo = node("Oscillator"),
      depth = node("Gain");
    lfo.frequency.value = vib.rate;
    depth.gain.value = 0;
    // The vibrato blooms in after `delay`, like a held sung note.
    depth.gain.setValueAtTime(0, start);
    depth.gain.linearRampToValueAtTime(vib.cents, start + (vib.delay ?? 0.3) + 0.3);
    lfo.connect(depth);
    for (const p of params) depth.connect(p);
    lfo.start(start);
    lfo.stop(end + 0.05);
    list.push(lfo, depth);
    sources.push(lfo);
  }
  function detuneInto(param, side) {
    if (!score || !side) return;
    (side > 0 ? score.det : score.detDown).connect(param);
  }
  function renderLayer(L, t0, dest, list, { bed = false } = {}) {
    const flatInto = (param) => bed && score && score.flat.connect(param);
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
      detuneInto(o.detune, L.detuneBus);
      flatInto(o.detune);
      if (L.vibrato) vibratoInto([o.detune], L.vibrato, start, end, list, sources);
      o.connect(into);
      go(o);
    } else if (L.kind === "choir") {
      // Saws a few cents apart, summed into two formant band-passes.
      const sum = node("Gain");
      sum.gain.value = 1 / L.count;
      list.push(sum);
      const params = [];
      const notes = L.midis ?? [L.midi];
      sum.gain.value = 1 / (L.count * notes.length);
      notes.forEach((m, j) => {
        for (let i = 0; i < L.count; i++) {
          const o = node("Oscillator");
          o.type = "sawtooth";
          o.frequency.setValueAtTime(midiHz(m + L.cents / 100), start);
          o.detune.setValueAtTime((i - (L.count - 1) / 2) * L.spread, start);
          detuneInto(o.detune, j % 2 ? -L.detuneBus : L.detuneBus);
          flatInto(o.detune);
          params.push(o.detune);
          o.connect(sum);
          go(o);
        }
      });
      if (L.vibrato) vibratoInto(params, L.vibrato, start, end, list, sources);
      L.formants.forEach((freq, i) => {
        const f = node("BiquadFilter"),
          fg = node("Gain");
        f.type = "bandpass";
        f.Q.value = L.q;
        automate(f.frequency, freq, start);
        fg.gain.value = i ? 0.6 : 1;
        sum.connect(f);
        f.connect(fg);
        fg.connect(into);
        list.push(f, fg);
      });
    } else if (L.kind === "fm") {
      const carrier = node("Oscillator"),
        mod = node("Oscillator"),
        depth = node("Gain");
      carrier.frequency.setValueAtTime(L.hz, start);
      mod.frequency.setValueAtTime(L.hz * L.ratio, start);
      flatInto(carrier.detune);
      flatInto(mod.detune);
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
      if (s.detune) flatInto(s.detune);
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
    const cue = book[name];
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

  /* ---------- the score ---------- */
  /** Render one score note at its grid time on the audio clock (never in the
   * past: a note whose grid point has just gone by sounds at once). */
  function renderMusic(n, { at: forceAt } = {}) {
    const recipe = VOICES[n.voice];
    if (!recipe || !canPlay() || !score) return null;
    if (only && !only.has(n.layer)) return null;
    try {
      const now = t();
      prune(now);
      const want = forceAt ?? clock.toAudio(n.t) + (LAYERS[n.layer]?.bed ? BED_DELAY : 0);
      const at = Math.max(now + LOOKAHEAD, want);
      if (n.voice === "shaker") return shake(at, n);
      const late = at - want;
      if (late > 0.002) {
        sc.lateCount++;
        sc.maxLate = Math.max(sc.maxLate, late);
      }
      sc.maxQuant = Math.max(sc.maxQuant, n.delay ?? 0);
      const live = active(now, music);
      if (live.length >= MAX_MUSIC) fadeOut(live.find((v) => v.bed && !v.hold) ?? live[0], 0.05);
      const spec = recipe.build(rng, n);
      // The layer decides the bus (LAYERS in score.mjs): a voice that serves
      // both, like the marimba of the pulse, follows the layer it plays in.
      if (LAYERS[n.layer]) spec.bed = LAYERS[n.layer].bed;
      if (spec.bed) {
        // mix.bedVoices: a thinner room. The oldest bed voice (never a held
        // pad mid-bar, never one of Diana's notes) gives way.
        const beds = live.filter((v) => v.bed && !v.stolen);
        if (beds.length >= mix.bedVoices) fadeOut(beds.find((v) => !v.hold) ?? beds[0], 0.25);
      }
      const list = [];
      const out = node("Gain");
      list.push(out);
      out.gain.value = spec.gain * dbToGain(spread(rng, 0.5) + (spec.bed ? mix.layers[n.layer] ?? 0 : 0));
      let head = out;
      if (spec.filter) {
        const f = node("BiquadFilter");
        f.type = spec.filter.type;
        f.frequency.value = spec.filter.freq;
        f.Q.value = spec.filter.q ?? 0.7;
        head.connect(f);
        head = f;
        list.push(f);
        if (spec.filter.lfo) {
          const lfo = node("Oscillator"),
            depth = node("Gain");
          lfo.frequency.value = spec.filter.lfo.rate;
          depth.gain.value = spec.filter.lfo.depth;
          lfo.connect(depth);
          depth.connect(f.frequency);
          lfo.start(at);
          lfo.stop(at + spec.dur + 0.1);
          list.push(lfo, depth);
          spec.extra = [lfo];
        }
      }
      if ((spec.pan || spec.autopan) && ctx.createStereoPanner) {
        const p = node("StereoPanner");
        p.pan.value = spec.pan ?? 0;
        head.connect(p);
        head = p;
        list.push(p);
        if (spec.autopan) {
          const lfo = node("Oscillator"),
            depth = node("Gain");
          lfo.frequency.value = spec.autopan.rate;
          depth.gain.value = spec.autopan.depth;
          lfo.connect(depth);
          depth.connect(p.pan);
          lfo.start(at);
          lfo.stop(at + spec.dur + 0.1);
          list.push(lfo, depth);
          (spec.extra ??= []).push(lfo);
        }
      }
      head.connect(spec.bed ? score.bedIn : score.playerIn);
      if (spec.send) {
        const send = node("Gain");
        send.gain.value = spec.send;
        head.connect(send);
        send.connect(spec.bed ? score.bedSend : score.playerSend);
        list.push(send);
      }
      const sources = [...(spec.grouped ? renderPad(spec, at, out, list) : spec.layers.flatMap((L) => renderLayer(L, at, out, list, { bed: !!spec.bed }))), ...(spec.extra ?? [])];
      const v = { voice: n.voice, layer: n.layer, bed: !!spec.bed, hold: spec.hold, start: at, end: at + spec.dur, out, sources, nodes: list, stolen: false };
      // A sustained voice hands over: the previous sky (or choir) releases
      // as the next one swells, so the bed never has a gap or a click.
      if (spec.hold) {
        const prev = held[spec.hold];
        if (prev && !prev.stolen && prev.end > at) fadeOut(prev, 1.6, at);
        held[spec.hold] = v;
      }
      music.push(v);
      sc.scheduled++;
      peakMusic = Math.max(peakMusic, active(now, music).length);
      if (v.bed) peakBed = Math.max(peakBed, active(now, music).filter((q) => q.bed && !q.stolen).length);
      return v;
    } catch {
      return null;
    }
  }
  /** The sky pad as grouped buses: oscillators feed a left, a right and a
   * centre (sub) gain directly, under one envelope. About 18 nodes a pad
   * instead of about 35 (audio critic, finding 11: per-note graphs cost CPU). */
  function renderPad(spec, at, out, list) {
    const env = node("Gain");
    env.gain.value = 0;
    automate(env.gain, spec.env, at, 1);
    env.connect(out);
    const sides = [-0.75, 0.75, 0].map((pan, i) => {
      const g = node("Gain");
      g.gain.value = i < 2 ? 0.028 : 0.06;
      if (pan && ctx.createStereoPanner) {
        const p = node("StereoPanner");
        p.pan.value = pan;
        g.connect(p);
        p.connect(env);
        list.push(p);
      } else g.connect(env);
      list.push(g);
      return g;
    });
    list.push(env);
    const end = at + envEnd(spec.env) + 0.05;
    const sources = [];
    for (const L of spec.layers) {
      const o = node("Oscillator");
      o.type = L.wave;
      o.frequency.setValueAtTime(L.freq[0][1], at);
      detuneInto(o.detune, L.detuneBus);
      if (score) score.flat.connect(o.detune);
      o.connect(L.wave === "triangle" ? sides[2] : L.pan < 0 ? sides[0] : sides[1]);
      o.start(at + L.at);
      o.stop(end);
      sources.push(o);
      list.push(o);
    }
    return sources;
  }
  /** Shakers on one persistent noise voice: each tick is an envelope on its
   * gain, so a sixteenth of shaker creates no node at all. */
  function shake(at, n) {
    try {
      if (!sc.shaker) {
        const src = node("BufferSource"),
          bp = node("BiquadFilter"),
          hp = node("BiquadFilter"),
          g = node("Gain"),
          p = node("StereoPanner");
        src.buffer = buffers.white;
        src.loop = true;
        bp.type = "bandpass";
        bp.frequency.value = 7000;
        bp.Q.value = 1.5;
        hp.type = "highpass";
        hp.frequency.value = 4000;
        g.gain.value = 0;
        p.pan.value = 0.3;
        src.connect(bp);
        bp.connect(hp);
        hp.connect(g);
        g.connect(p);
        p.connect(score.bedIn);
        src.start(t());
        sc.shaker = { src, g, nodes: [src, bp, hp, g, p] };
      }
      const g = sc.shaker.g.gain,
        peak = 0.5 * 0.05 * (n.gain ?? 1) * dbToGain(spread(rng, 1));
      g.setValueAtTime(0, at);
      g.linearRampToValueAtTime(peak, at + 0.002);
      g.exponentialRampToValueAtTime(Z, at + 0.037);
      g.setValueAtTime(0, at + 0.04);
      sc.scheduled++;
      return { voice: "shaker", start: at, end: at + 0.04 };
    } catch {
      return null;
    }
  }
  function destroyShaker() {
    if (!sc.shaker) return;
    try {
      sc.shaker.src.stop();
      for (const n of sc.shaker.nodes) n.disconnect();
    } catch {
      /* ignore */
    }
    sc.shaker = null;
  }
  function silenceScore(at, fade = 0.05) {
    for (const v of music) fadeOut(v, fade, at);
    held.pad = held.choir = null;
    // Cancel shaker ticks already scheduled past this point.
    if (sc.shaker)
      try {
        const g = sc.shaker.g.gain;
        g.cancelScheduledValues(at);
        g.setValueAtTime(0, at);
      } catch {
        /* ignore */
      }
  }
  /** The fall (brief 5.6): 0-0.45 s the score's tape slows to a stop (pitch
   * falls two octaves as the delay's growth rate reaches 0.75, the lowpass
   * closes 8 kHz -> 300 Hz, the level falls 12 dB); 0.45-0.70 s its last
   * notes play backwards an octave up, 32 ms apart, 18 dB down, drifting
   * toward the beacon on the left; the respawn shimmer (a cue) follows. */
  function tapeStop(fx) {
    if (!score || !canPlay()) return;
    try {
      const a = t(),
        T = fx.seconds ?? 0.45;
      const d = score.tape.delayTime,
        n = 64,
        curve = new Float32Array(n);
      // Pitch ratio r = 1 - d'(t) falling linearly 1 -> 0.25: d = 0.375 t^2 / T.
      for (let i = 0; i < n; i++) curve[i] = TAPE_BASE + (0.375 * (T * (i / (n - 1))) ** 2) / T;
      d.cancelScheduledValues(a);
      d.setValueCurveAtTime(curve, a, T);
      d.setValueAtTime(TAPE_BASE, a + T + 0.08);
      const f = score.tapeTone.frequency;
      f.cancelScheduledValues(a);
      f.setValueAtTime(8000, a);
      f.exponentialRampToValueAtTime(300, a + T);
      const g = score.tapeGain.gain;
      g.cancelScheduledValues(a);
      g.setValueAtTime(1, a);
      g.linearRampToValueAtTime(0.25, a + T);
      g.linearRampToValueAtTime(0, a + T + 0.04);
      silenceScore(a + T, 0.04);
      (fx.rewind ?? []).slice(0, 8).forEach((r, i) => {
        const at = a + T + i * 0.032;
        const list = [],
          out = node("Gain");
        out.gain.value = dbToGain(-18);
        let head = out;
        if (ctx.createStereoPanner) {
          const p = node("StereoPanner");
          p.pan.value = -0.2 - 0.06 * i;
          out.connect(p);
          head = p;
          list.push(p);
        }
        head.connect(score.rewind);
        const L = tone(r.midi, { env: env.rise(0.09, 1, 0.012), gain: 0.22 });
        const sources = renderLayer(L, at, out, list);
        music.push({ voice: "rewind", start: at, end: at + 0.12, out, sources, nodes: [out, ...list], stolen: false });
      });
      sc.tapeStops++;
    } catch {
      /* ignore */
    }
  }
  function fadeScore(fx) {
    if (!score || !canPlay()) return;
    try {
      const a = t(),
        g = score.tapeGain.gain;
      g.cancelScheduledValues(a);
      g.setValueAtTime(g.value, a);
      g.linearRampToValueAtTime(0, a + (fx.seconds ?? 0.45));
      silenceScore(a + (fx.seconds ?? 0.45), 0.04);
      sc.fades++;
    } catch {
      /* ignore */
    }
  }
  function restoreTape(fade = 0.12) {
    if (!score) return;
    try {
      const a = t();
      score.tape.delayTime.cancelScheduledValues(a);
      score.tape.delayTime.setValueAtTime(TAPE_BASE, a);
      score.tapeTone.frequency.cancelScheduledValues(a);
      score.tapeTone.frequency.setValueAtTime(18000, a);
      const g = score.tapeGain.gain;
      g.cancelScheduledValues(a);
      g.setValueAtTime(fade ? 0 : 1, a);
      if (fade) g.linearRampToValueAtTime(1, a + fade);
    } catch {
      /* ignore */
    }
  }
  function runFx(list, simTime) {
    for (const fx of list) {
      if (fx.kind === "wake") {
        // Anchor on the first frame after the wake, not at the event: the
        // event arrives a frame late, and anchoring early made the first
        // frame re-anchor the grid by an odd 60-70 ms (audio critic).
        sc.anchorPending = true;
        restoreTape(0);
        // The title song gives way to the sky over 1.5 s; a title song the
        // browser blocked is forgotten, so a later resume never starts it.
        if (musicEl && !musicEl.paused) fadeOutMusic(1.5);
        else musicWanted = false;
      } else if (fx.kind === "restart") {
        // Control has returned (or a retry): the score re-enters on the
        // beacon's bar at this very moment.
        clock.anchor(simTime, t() + LOOKAHEAD, sc.scale);
        silenceScore(t(), 0.12);
        restoreTape(0.12);
        sc.restarts++;
      } else if (fx.kind === "tape-stop") tapeStop(fx);
      else if (fx.kind === "fade") fadeScore(fx);
      else if (fx.kind === "door") door(fx);
    }
  }
  /** The far door: the score's sustain blooms out while (in L4), one bar later and
   * on a downbeat, the original recording fades in at its full section
   * (bar 26 of the file, where it is as loud as the score; its intro sat
   * 9 dB under and left a hole): the title song, finished by the player. */
  /** After a door without the recording (I-III), the closing chord stays in
   * the sky under the victory card and the map between levels: a soft pad
   * that swells in as the cadence fades and is re-voiced every 5.5 s (the
   * playtest critic measured -70 dBFS of silence there). scoreReset / hush
   * end it. */
  let rest = null;
  function restFrame(now) {
    if (!rest || now < rest.next || !score) return;
    renderMusic({ layer: "sky", voice: "pad", midis: rest.pad, dur: 7, gain: 0.85, t: 0 }, { at: now + LOOKAHEAD });
    rest.next = now + 5.5;
  }
  function door(fx) {
    try {
      for (const v of music) if (v.hold) fadeOut(v, 4, t() + 0.5);
      held.pad = held.choir = null;
    } catch {
      /* ignore */
    }
    // Only the last level's door opens onto Earth and the original recording;
    // the others close on the score's own cadence (RESEARCH_LEVELS 4).
    const earth = !!LEVELS.find((d) => d.id === level)?.level.earth;
    if (!earth && ctx) rest = { pad: fx.chord?.pad ?? CHORDS.Dadd9.pad, next: t() + 2 };
    if (offline || !musicEl || !earth) return;
    clearTimeout(doorTimer);
    const wait = (BAR * SIXTEENTH) / sc.scale;
    doorTimer = setTimeout(() => {
      doorTimer = null;
      musicWanted = true;
      try {
        musicEl.currentTime = MP3_FULL_SECTION;
      } catch {
        /* not seekable yet: it starts from the top */
      }
      playMusic({ fadeIn: 2, level: musicLevel * DOOR_BOOST });
    }, Math.max(0, wait) * 1000);
  }
  function applyTuning(now) {
    const m = conductor.tuning.mix();
    const prev = sc.mix;
    sc.mix = m;
    if (!score || (prev && Math.abs(prev.totalCents - m.totalCents) < 0.05 && prev.shimmer === m.shimmer)) return;
    try {
      // Each step settles over about 0.8 s (time constant 0.27 s).
      score.det.offset.setTargetAtTime(m.padCents, now, 0.27);
      score.flat.offset.setTargetAtTime(-m.flatCents, now, 0.27);
      score.wowDepth.gain.setTargetAtTime(m.wowCents * WOW_PER_CENT, now, 0.27);
      // The bed's ceiling is mix.bedLowpass; mistakes still close it (H 0.6: 4.2 kHz).
      score.bedTone.frequency.setTargetAtTime(Math.min(mix.bedLowpass, m.lowpass * (mix.closing ?? 0.6)), now, 0.27);
      score.fb.gain.setTargetAtTime(m.shimmer, now, 0.3);
    } catch {
      /* ignore */
    }
  }
  /** The glide whistle: a breathy sine that snaps to chord tones by altitude
   * with a 120 ms portamento (time constant 40 ms). */
  function whistle(simTime, now) {
    const m = conductor.whistle(simTime);
    if (m == null && !sc.whistle) return;
    try {
      if (!sc.whistle) {
        const o = node("Oscillator"),
          g = node("Gain"),
          p = node("StereoPanner");
        o.frequency.value = midiHz(m);
        g.gain.value = 0;
        p.pan.value = -0.25;
        o.connect(g);
        g.connect(p);
        p.connect(score.playerIn);
        const send = node("Gain");
        send.gain.value = 0.5;
        p.connect(send);
        send.connect(score.playerSend);
        o.start(now);
        sc.whistle = { o, g, p, send, on: false };
      }
      const w = sc.whistle;
      if (m != null) w.o.frequency.setTargetAtTime(midiHz(m), now, 0.04);
      if (w.on !== (m != null)) {
        w.g.gain.setTargetAtTime(m != null ? 0.045 : 0, now, m != null ? 0.08 : 0.15);
        w.on = m != null;
      }
    } catch {
      /* ignore */
    }
  }
  function destroyWhistle() {
    if (!sc.whistle) return;
    try {
      sc.whistle.o.stop();
      for (const n of [sc.whistle.o, sc.whistle.g, sc.whistle.p, sc.whistle.send]) n.disconnect();
    } catch {
      /* ignore */
    }
    sc.whistle = null;
  }
  /** Per rAF frame (and per step in offline renders): follow the clock,
   * schedule the bed's sixteenths 120 ms ahead, retune, steer the whistle and
   * the singing wind. `render: false` keeps the conductor in step without
   * creating nodes (QA fast-forwards, sound off). */
  function scoreFrame(f = {}, { render = true } = {}) {
    sc.scale = f.timeScale ?? 1;
    sc.sim = f.simTime ?? 0;
    sc.status = f.status;
    sc.frames++;
    const r = conductor.frame({ t: sc.sim, x: f.x ?? 0, status: f.status, timeScale: sc.scale, inWind: f.inWind, gliding: f.gliding, y: f.y, fallsHere: f.fallsHere });
    if (!render || !canPlay() || !score) {
      sc.lastAudio = null;
      if (r) runFxQuiet(r.fx);
      return;
    }
    // A context that is still starting (the wake's resume, Continue after a
    // pause) has a clock that does not move yet: following it would re-anchor
    // the grid frame after frame. Wait until it runs; the wake's anchor stays
    // pending, and a resume is slewed from where the clock froze.
    if (!offline && ctx.state !== "running") {
      sc.lastAudio = null;
      if (r) runFxQuiet(r.fx);
      return;
    }
    try {
      const now = t();
      const dt = sc.lastAudio == null ? 0 : now - sc.lastAudio;
      sc.lastAudio = now;
      if (r) runFx(r.fx, sc.sim);
      if (sc.anchorPending && f.status === "running") {
        clock.anchor(sc.sim, now + LOOKAHEAD, sc.scale);
        sc.anchorPending = false;
      } else if (f.status === "running") clock.follow(sc.sim, now + LOOKAHEAD, dt, sc.scale);
      if (conductor.transport.running && f.status === "running") {
        const nowPos = conductor.transport.pos(sc.sim);
        const aheadPos = conductor.transport.pos(clock.toSim(now + SCHEDULE_AHEAD));
        for (const n of conductor.ticks(nowPos, aheadPos)) renderMusic(n);
      }
      applyTuning(now);
      restFrame(now);
      whistle(sc.sim, now);
      singWind(f, now);
    } catch {
      /* decorative */
    }
  }
  function runFxQuiet(list) {
    for (const fx of list) if (fx.kind === "restart" && graph) clock.anchor(sc.sim, t(), sc.scale);
  }

  /* ---------- the soundtrack (title and far door) ---------- */
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
      // The world's bed breathes back under story moments too, by half.
      if (score) {
        const b = score.bedIn.gain;
        b.cancelScheduledValues(now);
        b.setValueAtTime(b.value, now);
        b.linearRampToValueAtTime(dbToGain(-db / 2), now + attack);
        b.setValueAtTime(dbToGain(-db / 2), until);
        b.linearRampToValueAtTime(1, until + release);
      }
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
  function playMusic({ fadeIn = 0, fromStart = false, level = musicLevel } = {}) {
    musicWanted = true;
    if (!enabled || paused || !musicEl) return;
    try {
      if (fromStart) musicEl.currentTime = 0;
      if (musicRouted && graph) {
        const g = graph.music.gain;
        g.cancelScheduledValues(t());
        g.setValueAtTime(fadeIn ? Z : level, t());
        if (fadeIn) g.linearRampToValueAtTime(level, t() + fadeIn);
        duckState = { until: -1, target: 1 };
      }
      musicEl.play()?.catch?.(() => {});
    } catch {
      /* ignore */
    }
  }
  function stopMusic() {
    musicWanted = false;
    clearTimeout(doorTimer);
    doorTimer = null;
    try {
      musicEl?.pause();
    } catch {
      /* ignore */
    }
  }
  function fadeOutMusic(seconds) {
    musicWanted = false;
    if (!musicEl) return;
    try {
      if (musicRouted && graph) {
        const g = graph.music.gain;
        g.cancelScheduledValues(t());
        g.setValueAtTime(g.value, t());
        g.linearRampToValueAtTime(Z, t() + seconds);
      }
      setTimeout(() => {
        if (!musicWanted) musicEl.pause();
      }, seconds * 1000 + 50);
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
    // The singing wind: three narrow band-passes on the chord's tones (Q 28)
    // sing out of the same noise while Diana is inside a column.
    const sing = node("Gain");
    sing.gain.value = 0;
    const bands = [0, 1, 2].map(() => {
      const b = node("BiquadFilter");
      b.type = "bandpass";
      b.Q.value = 28;
      b.frequency.value = 880;
      src.connect(b);
      b.connect(sing);
      return b;
    });
    sing.connect(out);
    const at = t();
    src.start(at);
    sway.start(at);
    flutter.start(at);
    list.push(src, band, sway, swayDepth, am, flutter, flutterDepth, out, send, sing, ...bands);
    bed = { out, band, flutterDepth, sing, bands, nodes: list, sources: [src, sway, flutter], target: 0, glide: false, wind: false, chord: null };
  }
  function singWind(f, now) {
    if (!bed) return;
    try {
      const wind = !!f.inWind && f.status === "running";
      const chord = conductor.windChord(sc.sim);
      if (wind && bed.chord !== chord) {
        chordTones(chord, 69, 93)
          .slice(0, 3)
          .forEach((m, i) => bed.bands[i].frequency.setTargetAtTime(midiHz(m), now, 0.05));
        bed.chord = chord;
      }
      if (bed.singing !== wind) {
        bed.sing.gain.setTargetAtTime(wind ? 9 : 0, now, 0.2); // narrow bands pass little: make up level
        bed.singing = wind;
      }
    } catch {
      /* ignore */
    }
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

  /** `hold`: a longer fade for held pads only (a level that follows the map
   * swells in under the last one's closing chord instead of starting cold). */
  function hush(fade = 0.06, { hold = fade } = {}) {
    conductor.revoice(); // a silenced bed is voiced again on the next tick
    rest = null;
    if (!ctx) return;
    for (const v of voices) fadeOut(v, fade);
    for (const v of music) fadeOut(v, v.hold ? hold : fade);
    held.pad = held.choir = null;
    if (sc.shaker) silenceScore(t(), fade);
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
  const scoreAudible = () => !!score && enabled && !paused && conductor.transport.running && !!ctx && (offline || ctx.state === "running");

  return {
    unlock,
    prepare,
    play,
    duck,
    /** The map between levels: one bar of the next level's pulse at its
     * tempo (felt beats, the first accented) under the held closing chord,
     * with the Signal calling on the downbeat, so the next level does not
     * start cold. `delay` seconds from now; returns the beats scheduled. */
    countIn({ bpm = 107, delay = 0, signal = 74 } = {}) {
      if (!canPlay() || !score) return 0;
      const beat = 60 / bpm,
        at0 = t() + LOOKAHEAD + Math.max(0, delay);
      let n = 0;
      for (let k = 0; k < 4; k++) if (renderMusic({ layer: "pulse", voice: "pulse", gain: k === 0 ? 0.9 : 0.5, t: 0 }, { at: at0 + k * beat })) n++;
      renderMusic({ layer: "signal", voice: "signal", midi: signal, dur: 1.2, pan: 0.6, t: 0 }, { at: at0 });
      return n;
    },
    /** The player's Music and Sounds settings (0-1 each), applied over 80 ms. */
    setVolumes({ music = vol.music, sounds = vol.sounds } = {}) {
      vol.music = Math.max(0, Math.min(1, Number(music) || 0));
      vol.sounds = Math.max(0, Math.min(1, Number(sounds) || 0));
      try {
        if (musicEl && !musicRouted) musicEl.volume = Math.min(1, musicLevel * OUTPUT_GAIN * vol.music);
        if (!graph) return { ...vol };
        const at = t();
        const to = (param, v) => (param.cancelScheduledValues(at), param.setValueAtTime(param.value, at), param.linearRampToValueAtTime(v, at + 0.08));
        to(graph.musicVol.gain, vol.music);
        to(graph.sfx.gain, SFX_LEVEL * vol.sounds);
        if (score) {
          to(score.bedVol.gain, dbToGain(mix.bed) * vol.music);
          to(score.bedSend.gain, dbToGain(mix.bed + mix.bedWet) * vol.music);
          to(score.rewind.gain, vol.music);
          to(score.playerVol.gain, vol.sounds);
          to(score.playerSend.gain, vol.sounds);
        }
      } catch {
        /* ignore */
      }
      return { ...vol };
    },
    volumes: () => ({ ...vol }),
    setAir,
    hush,
    attachMusic(el, { level } = {}) {
      musicEl = el;
      musicLevel = level ?? MUSIC_LEVEL;
      try {
        // Unrouted (before the first gesture) the element plays on its own at
        // the level it will have through the graph.
        if (!musicRouted) el.volume = Math.min(1, musicLevel * OUTPUT_GAIN * vol.music);
      } catch {
        /* ignore */
      }
      routeMusic();
    },
    playMusic,
    stopMusic,
    fadeOutMusic,
    /** Map one simulation event to its body cue(s) and its score voice. With
     * `render: false` only the conductor hears it (the score keeps its place
     * through QA fast-forwards and while sound is off). Returns the cues. */
    event(e, { render = true, cues = true, timeScale } = {}) {
      const out = [];
      if (timeScale) sc.scale = timeScale;
      const r = conductor.event(e, { timeScale: sc.scale });
      if (render && cues && !only) {
        for (const c of cuesForEvent(e)) {
          const params = { ...(c.params ?? {}) };
          if (c.cue === "star") {
            melody = nextStarStep(melody, e.time ?? 0);
            params.step = melody.step;
          }
          if (c.cue === "chain-note" && params.chain) chainSize[params.chain] = params.count;
          if (c.cue === "constellation") params.count = chainSize[params.chain] ?? 5;
          if (CHORDED.has(c.cue)) params.chord = c.cue === "respawn" ? conductor.chordAt(Math.max(0, Math.round(conductor.placePos(e.x ?? 0)))) : conductor.chordAt(Math.max(0, conductor.transport.pos(e.time ?? 0)));
          if (c.cue === "win") Object.assign(params, { complete: !!conductor.state().door?.complete, chord: e.earth ? CHORDS.Earth : CHORDS.Dadd9 });
          if (c.music === "darken" && canPlay()) tint(true);
          if (c.music === "brighten") tint(false);
          const v = play(c.cue, params);
          if (v) out.push(v);
        }
      }
      if (render && canPlay() && score) {
        runFx(r.fx, e.time ?? sc.sim);
        for (const n of r.notes) renderMusic(n);
      } else runFxQuiet(r.fx);
      return out;
    },
    scoreFrame,
    /** Conduct level n (its preset, path and space). The score starts fresh. */
    setLevel(n) {
      const next = LEVELS.some((d) => d.id === n) ? n : 1;
      if (next === level) return level;
      level = next;
      conductor = makeConductor(level, conductor.gentle);
      if (score) {
        try {
          score.space.buffer = makeBuffer(reverbImpulse(ctx.sampleRate, score.spaceSeconds(level), score.rng, { predelay: 0.03, fadeIn: 0.12 }));
          score.shimmerOut.gain.value = 0.22 * (scoreOf(level).space.shimmer / 0.4);
        } catch {
          /* a context mid-close keeps its old space */
        }
      }
      return level;
    },
    get level() {
      return level;
    },
    /** A fresh score (restart chapter, title): bar 1, H = 1, silence. */
    scoreReset({ hold = 0.12 } = {}) {
      conductor.reset();
      rest = null;
      if (ctx) {
        for (const v of music) fadeOut(v, v.hold ? hold : 0.12);
        held.pad = held.choir = null;
        restoreTape(0);
        destroyWhistle();
      }
      sc.lastAudio = null;
    },
    setGentle(on) {
      conductor.gentle = !!on;
    },
    get gentle() {
      return conductor.gentle;
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
        for (const v of music) fadeOut(v, 0.01);
        held.pad = held.choir = null;
        destroyBed();
        destroyWhistle();
        destroyShaker();
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
        sc.lastAudio = null;
        if (musicWanted) playMusic();
      }
    },
    /** Pausing freezes everything in place: the context is suspended (tails,
     * swells, blooms and the score stop mid-air and continue on resume, never
     * restart), the soundtrack pauses, the score's clock and transport hold
     * (the simulation is frozen with them). Nothing new can start while paused. */
    setPaused(p) {
      p = !!p;
      if (p === paused) return;
      paused = p;
      clearTimeout(pauseTimer);
      // A 15 ms fade on each side, so pausing never clicks. Nothing new can
      // start once `paused` is set; the context suspends after the fade.
      const fade = options.pauseFade ?? PAUSE_FADE;
      const ramp = (to) => {
        if (!graph || offline) return;
        const g = graph.output.gain,
          now = ctx.currentTime;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(to, now + fade);
      };
      try {
        if (p) {
          if (ctx && !offline && fade > 0) {
            ramp(0);
            pauseTimer = setTimeout(() => {
              if (!paused) return;
              musicEl?.pause();
              ctx.suspend?.()?.catch?.(() => {});
            }, fade * 1000 + 5);
          } else {
            musicEl?.pause();
            if (ctx && !offline) ctx.suspend?.()?.catch?.(() => {});
          }
        } else if (enabled) {
          if (ctx && !offline) {
            resumingUntil = wallNow() + 400;
            const back = ctx.resume?.();
            if (fade > 0) {
              if (graph) graph.output.gain.setValueAtTime(0, ctx.currentTime);
              (back?.then ? back : Promise.resolve()).then(() => !paused && ramp(OUTPUT_GAIN)).catch?.(() => {});
            }
          }
          sc.lastAudio = null;
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
    /** Play one score voice now (soundboard auditions). */
    voice(name, note = {}) {
      if (!canPlay() || !score) return null;
      const v = renderMusic({ layer: "stars", ...note, voice: name, t: 0 }, { at: t() + LOOKAHEAD });
      return v ? { end: v.end } : null;
    },
    /** Soundboard: hear the bed at tuning value H right now (dev only). */
    auditionTuning(H) {
      conductor.tuning.force(H);
      sc.mix = null;
      if (ctx && score) applyTuning(t());
      return conductor.tuning.mix();
    },
    // The level's conductor (setLevel replaces it).
    get conductor() {
      return conductor;
    },
    get context() {
      return ctx;
    },
    stats() {
      const now = ctx ? t() : 0;
      if (ctx) prune(now);
      const st = conductor.state(sc.sim);
      return {
        engine: "procedural + adaptive score",
        key: `${KEY.name} (relative ${KEY.relative})`,
        enabled,
        unlocked: !!ctx,
        state: ctx?.state ?? "none",
        time: ctx ? ctx.currentTime : 0, // the audio clock: frozen while paused
        paused,
        suspended: !ctx || ctx.state !== "running",
        musicWanted,
        // True while the soundtrack or the score is audible (never paused).
        musicPlaying: (!!musicEl && !musicEl.paused) || scoreAudible(),
        soundtrackPlaying: !!musicEl && !musicEl.paused,
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
        score: {
          running: st.running,
          audible: scoreAudible(),
          bar: st.bar,
          chord: st.chord,
          section: st.section,
          H: +st.H.toFixed(3),
          detuneCents: +st.totalCents.toFixed(2),
          flatCents: +st.flatCents.toFixed(2),
          gentle: st.gentle,
          choir: st.choir,
          earth: st.earth,
          voices: ctx ? active(now, music).length : 0,
          peakVoices: peakMusic, peakBed,
          rest: rest ? { next: +rest.next.toFixed(2) } : null, // the closing chord held after a door (I-III)
          scheduled: sc.scheduled,
          lateNotes: sc.lateCount,
          maxLateMs: +(sc.maxLate * 1000).toFixed(1),
          maxQuantizeMs: +(sc.maxQuant * 1000).toFixed(1),
          clock: clock.stats(),
          song: st.song,
          layers: st.layers,
          played: st.played,
          rephases: st.rephases,
          tapeStops: sc.tapeStops,
          fades: sc.fades,
          restarts: sc.restarts,
          door: st.door,
        },
      };
    },
  };
}

/** Render one cue (or a bed) offline: used by the soundboard and browser QA. */
export async function renderCueOffline(name, { OfflineContext = globalThis.OfflineAudioContext, sampleRate = 48000, params = {}, seed = 1, safety = true, tail = 2.6, cues = null } = {}) {
  const bedDef = BEDS[name];
  const spec = bedDef ? null : (cues?.[name] ?? CUES[name]).build(mulberry32(seed), params);
  const seconds = (bedDef ? bedDef.seconds + 0.6 : spec.dur) + tail + 0.05;
  const ctx = new OfflineContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const engine = createAudioEngine({ context: ctx, seed, safety, cues });
  engine.unlock();
  if (bedDef) {
    engine.setAir(bedDef.air, 0.01);
    engine.setAir({}, bedDef.seconds);
  } else engine.play(name, params);
  const buffer = await ctx.startRendering();
  return { buffer, stats: engine.stats() };
}

/** Render a recorded run offline through the full engine (cues + score).
 * `frames` are the game's frames: { wall, simTime, x, y, status, timeScale,
 * inWind, gliding, fallsHere, events: [...] } with `wall` in seconds. Frames
 * before `from` keep the conductor in step without sound; the render covers
 * [from, from + seconds). `only` limits the output to some score layers
 * (stems): the others are rendered silent. */
export async function renderRunOffline({ frames, from = 0, seconds = 20, OfflineContext = globalThis.OfflineAudioContext, sampleRate = 48000, seed = 1, gentle = false, cues = true, only = null, safety = true, level = 1, mix = null } = {}) {
  const ctx = new OfflineContext(2, Math.ceil((seconds + 3) * sampleRate), sampleRate);
  let now = 0;
  const engine = createAudioEngine({ context: ctx, seed, safety, gentle, only, level, mix, clock: () => now });
  engine.unlock();
  for (const f of frames) {
    if (f.wall >= from + seconds) break;
    const live = f.wall >= from;
    now = Math.max(0, f.wall - from);
    for (const e of f.events ?? []) engine.event(e, { render: live, cues, timeScale: f.timeScale });
    engine.scoreFrame(f, { render: live });
  }
  const buffer = await ctx.startRendering();
  return { buffer, stats: engine.stats() };
}
