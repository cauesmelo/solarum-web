/** Solarum's soundtrack inside the levels: a real little song per level (the
 * owner: "falta som de musica e vdd, uma trilhinha sonora"). Pure musical
 * logic like score.mjs: no Web Audio, DOM or clock. audio.mjs schedules what
 * `createTune` decides, on the same transport as the bed, so the song is locked
 * to the level's beat grid and moves with every re-phase, fall and restart.
 *
 * Units: positions are the score's 107 BPM simulation sixteenths from waking
 * (the transport plays them at the level's own BPM); `len` in sixteenths;
 * pitches are MIDI numbers.
 *
 * The language is the original soundtrack's (RESEARCH_MUSIC 1: D major / B
 * minor, its four-bar cycle and the 3 + 3 + 2 motif, a calm half-time feel)
 * in each level's own mode, chords and tempo (RESEARCH_PROGRESSION 4.3):
 * - lead: a short hook, its answer and two variations per level, played in
 *   order through the gaps Diana's own song leaves (call and response): it
 *   never sounds in a half bar where her baked main route plays two or more
 *   pitched notes, nor within a sixteenth of one, nor on the Signal's bars, and
 *   it rests from the closing theme on (the Signal plays it);
 * - bass: the chord's bass note in the level's pattern (whole notes in I, the
 *   3 + 3 + 2 tresillo in II, a half-time line in IV, the pedal's eighths in VI);
 * - harp: the chord's tones in the level's arpeggio, which now carries the
 *   harmony the sky used to hold (the sky is air: audio.mjs);
 * - kit: light percussion (none in I; ticks, brushes, a rim) that rests in
 *   the sections a preset marks `pulse: false`.
 * Every pitch is fitted to the chord at the position it sounds (its safe set,
 * score.mjs), so the song can never put a wrong note under Diana's.
 */
import { scoreOf, barOf, isSafe, nearestSafe, chordTones, rootIn, pc, BAR } from "./score.mjs";
import { PATHS } from "./score-path.mjs";
import { LEVELS } from "./level.mjs";

/** Diana's pitched voices on the baked route: her melody (the lead gives way
 * to it) and her gestures (jumps, flights: the lead only softens under them). */
export const MELODIC = Object.freeze(["star", "chain-note", "constellation", "checkpoint"]);
export const GESTURES = Object.freeze(["jump", "double-jump", "super-jump", "dash", "dive", "smash", "lip-catch", "tile-drop"]);

const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "F#4" -> 66 (C4 = 60). */
export function noteMidi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
/** One bar of melody, "D5:6 C#5:6 B4:4" (note:sixteenths, r = rest), to
 * [{ at, midi, len }]. Every bar must fill exactly 16 sixteenths (tested). */
export function parseBar(text) {
  const out = [];
  let at = 0;
  for (const tok of text.trim().split(/\s+/)) {
    const [n, l] = tok.split(":");
    const len = Number(l);
    if (!(len > 0)) throw new Error(`bad length in ${tok}`);
    if (n !== "r") out.push({ at, midi: noteMidi(n), len });
    at += len;
  }
  if (at !== BAR) throw new Error(`bar "${text}" lasts ${at} sixteenths`);
  return out;
}

// Light percussion helpers (sixteenth positions in a bar).
const every = (step, voice, gain, accent = gain) => Array.from({ length: BAR / step }, (_, i) => [i * step, voice, i * step % 4 === 0 ? accent : gain]);
const EIGHTHS = (voice, gain, accent) => every(2, voice, gain, accent);

/**
 * Per level key (LEVELS' `key`; RESEARCH_PROGRESSION 4.3's ladder, I floaty
 * and calm ... VIII tense but fair). `lead`: four bars of melody written over
 * the level's main chords (A, its answer B, A's variation, the cadence C);
 * `lo`/`hi`: its register, under most of Diana's stars (D5-F#6). `bass`:
 * [at, degree, len, gain] per bar (R the chord's bass note, 5 the chord tone
 * nearest a fifth above it, 8 its octave). `harp`: onsets, an order of
 * chord tones in [lo, hi] and a gain. `kit`: [at, voice, gain] per bar.
 * `brightness` opens the lead's FM index (later levels ring more).
 */
export const TUNES = Object.freeze({
  // I · Waking, 88 BPM, floaty and calm: no drums (the preset's rule); the
  // harp's soft eighths are the only motion, the bass a dotted half and a
  // quarter on the "2" of 3 + 3 + 2.
  waking: {
    feel: "floaty, calm",
    lead: ["F#4:6 B4:6 C#5:4", "E5:6 C#5:6 A4:4", "D5:6 C#5:6 B4:4", "A4:10 F#4:6"],
    lo: 62, hi: 78, brightness: 0.8, gain: 0.85,
    bass: [[0, "R", 12, 1], [12, "5", 4, 0.55]],
    harp: { at: [0, 2, 4, 6, 8, 10, 12, 14], order: [0, 1, 2, 3, 4, 3, 2, 1], lo: 57, hi: 76, gain: 0.42, accents: [0, 6, 12] },
    kit: [],
  },
  // II · The Gift, 94 BPM, calm with marked beats: the bass plays the
  // soundtrack's 3 + 3 + 2 under the bed's heartbeat; soft ticks on 2 and 4.
  gift: {
    feel: "calm, marked beats",
    lead: ["F#4:4 A4:4 B4:4 D5:4", "C#5:6 B4:6 A4:4", "B4:4 D5:4 E5:4 F#5:4", "E5:6 D5:6 A4:4"],
    lo: 62, hi: 79, brightness: 0.9, gain: 0.85,
    bass: [[0, "R", 6, 1], [6, "R", 6, 0.7], [12, "5", 4, 0.7]],
    rest: { bass: [[0, "R", 16, 0.8]] },
    harp: { at: [0, 4, 8, 12], order: [0, 2, 1, 3], lo: 57, hi: 74, gain: 0.45, accents: [0] },
    kit: [[4, "tick", 0.55], [12, "tick", 0.55]],
  },
  // III · Still Water, 100 BPM, floating and flowing (G Lydian): rolling harp
  // eighths and brushed eighths at a whisper; the lead flows in 3 + 3 + 2.
  "still-water": {
    feel: "floating, flowing",
    lead: ["B4:3 D5:3 E5:2 F#5:8", "E5:3 C#5:3 B4:2 A4:8", "D5:3 E5:3 G5:2 F#5:8", "E5:3 D5:3 B4:2 G4:8"],
    lo: 62, hi: 81, brightness: 0.75, gain: 0.8,
    bass: [[0, "R", 6, 1], [6, "5", 6, 0.7], [12, "8", 4, 0.55]],
    harp: { at: [0, 2, 4, 6, 8, 10, 12, 14], order: [0, 2, 4, 1, 3, 5, 2, 4], lo: 59, hi: 79, gain: 0.4, accents: [0, 6, 12] },
    kit: EIGHTHS("brush", 0.22, 0.34),
  },
  // IV · The Way Down, 107 BPM, the song at home: the soundtrack's own cycle,
  // its motif (D5 . . C#5 . . B4 . | A4 F#5 . . A4) and its half-time groove
  // (shaker eighths, a rim on beat 3).
  "way-down": {
    feel: "the song at home",
    lead: ["D5:6 C#5:6 B4:4", "A4:2 F#5:6 A4:8", "D5:6 E5:6 F#5:4", "E5:2 D5:6 B4:8"],
    lo: 62, hi: 79, brightness: 1, gain: 0.85,
    bass: [[0, "R", 10, 1], [10, "R", 2, 0.5], [12, "5", 4, 0.7]],
    rest: { bass: [[0, "R", 12, 0.9], [12, "5", 4, 0.5]] },
    harp: { at: [0, 4, 6, 8, 12, 14], order: [0, 2, 3, 1, 2, 3], lo: 59, hi: 76, gain: 0.38, accents: [0, 6, 12] },
    kit: [...EIGHTHS("brush", 0.26, 0.4), [8, "rim", 0.55]],
  },
  // V · The Breaking Constellation, 112 BPM, a nocturne of call and
  // response (E Dorian): dotted harp calls, a tresillo bass, ticks and a rim.
  breaking: {
    feel: "nocturne, call and response",
    lead: ["E5:6 D5:6 B4:4", "A4:4 B4:2 D5:6 E5:4", "B4:6 A4:6 E4:4", "D5:2 E5:4 r:2 B4:8"],
    lo: 62, hi: 79, brightness: 1, gain: 0.8,
    bass: [[0, "R", 6, 1], [6, "R", 2, 0.6], [8, "5", 8, 0.8]],
    harp: { at: [0, 3, 6, 8, 11, 14], order: [0, 2, 4, 3, 1, 2], lo: 59, hi: 78, gain: 0.4, accents: [0, 6] },
    kit: [[4, "tick", 0.5], [8, "rim", 0.55], [12, "tick", 0.5], [14, "tick", 0.3]],
  },
  // VI · Borrowed Wind, 118 BPM, storm-bright (A Mixolydian over the A
  // pedal): the bass drives eighths on the pedal, accents on 3 + 3 + 2; a
  // sixteenth shaker with the same accents; the harp runs high.
  "borrowed-wind": {
    feel: "storm-bright",
    lead: ["E5:3 A4:3 C#5:2 E5:8", "D5:3 B4:3 A4:2 G4:8", "F#5:3 E5:3 C#5:2 A4:8", "E5:3 D5:3 B4:2 E5:8"],
    lo: 64, hi: 81, brightness: 1.2, gain: 0.8,
    bass: [[0, "R", 2, 1], [2, "8", 2, 0.45], [4, "R", 2, 0.55], [6, "R", 2, 0.9], [8, "8", 2, 0.45], [10, "R", 2, 0.55], [12, "R", 2, 0.9], [14, "8", 2, 0.45]],
    rest: { bass: [[0, "R", 6, 1], [6, "R", 6, 0.8], [12, "R", 4, 0.8]] },
    harp: { at: [0, 2, 4, 6, 8, 10, 12, 14], order: [0, 1, 2, 3, 4, 5, 4, 3], lo: 64, hi: 83, gain: 0.36, accents: [0, 6, 12] },
    kit: Array.from({ length: 16 }, (_, k) => [k, "brush", [0, 6, 12].includes(k) ? 0.42 : k % 2 ? 0.14 : 0.24]),
  },
  // VII · The Falling Road, 123 BPM, tense (B Aeolian): a falling lead and
  // harp, a backbeat rim and eighth ticks (the bed's cascade is the drum).
  "falling-road": {
    feel: "tense",
    lead: ["F#5:4 E5:4 D5:4 B4:4", "C#5:4 D5:4 E5:8", "D5:4 C#5:4 B4:4 F#4:4", "A4:4 B4:4 D5:8"],
    lo: 62, hi: 79, brightness: 1.2, gain: 0.8,
    bass: [[0, "R", 4, 1], [4, "R", 2, 0.6], [6, "5", 4, 0.8], [10, "R", 2, 0.6], [12, "8", 4, 0.8]],
    harp: { at: [0, 2, 4, 6, 8, 10, 12, 14], order: [5, 4, 3, 2, 1, 0, 1, 2], lo: 59, hi: 79, gain: 0.36, accents: [0, 8] },
    kit: [...EIGHTHS("tick", 0.24, 0.32), [8, "rim", 0.6]],
  },
  // VIII · The Far Door, 128 BPM, tense but fair (B Aeolian over the F#
  // pedal): the bass on the pedal in 3 + 3 + 2 (the bed has the kick and the
  // ostinato), sixteenth ticks, a rim on 3.
  door: {
    feel: "tense but fair",
    lead: ["B4:3 D5:3 F#5:2 E5:4 D5:4", "C#5:3 B4:3 A#4:2 B4:8", "D5:3 E5:3 F#5:2 G5:4 F#5:4", "E5:3 D5:3 C#5:2 B4:8"],
    lo: 62, hi: 79, brightness: 1.3, gain: 0.8,
    bass: [[0, "R", 6, 1], [6, "R", 6, 0.8], [12, "R", 4, 0.8]],
    harp: { at: [0, 2, 4, 6, 8, 10, 12, 14], order: [0, 2, 1, 3, 0, 2, 1, 4], lo: 59, hi: 78, gain: 0.34, accents: [0, 6, 12] },
    kit: [...Array.from({ length: 16 }, (_, k) => [k, "tick", k % 4 === 0 ? 0.36 : 0.18]), [8, "rim", 0.55]],
  },
});
// The Far Door's eventual key (the progression branch names it `far-door`).
const ALIASES = { "far-door": "door" };
export const tuneFor = (key) => TUNES[key] ?? TUNES[ALIASES[key]] ?? TUNES.waking;

/** Diana's baked pitched notes by score position: { melodic: Map(pos ->
 * count), gestures: Set(pos) }, positions rounded to the sixteenth. */
export function dianaNotes(level) {
  const P = scoreOf(level),
    path = PATHS[level],
    pickup = P.pickup ?? 0;
  const melodic = new Map(),
    gestures = new Set();
  for (const a of path?.anchors ?? []) {
    const k = Math.round(a.k + pickup);
    if (MELODIC.includes(a.name)) melodic.set(k, (melodic.get(k) ?? 0) + 1);
    else if (GESTURES.includes(a.name)) gestures.add(k);
  }
  return { melodic, gestures };
}

/** The lead's plan for a whole level: bar -> [{ at, midi, len }] (unfitted),
 * the phrase bars taken in order through the gaps (so the hook is heard
 * before its answer however far apart they land). */
export function leadPlan(level, tune = tuneFor(LEVELS.find((d) => d.id === level)?.key)) {
  const P = scoreOf(level),
    { melodic } = dianaNotes(level);
  const bars = tune.lead.map(parseBar);
  const plan = new Map();
  const count = (k0, k1) => {
    let n = 0;
    for (let k = k0; k < k1; k++) n += melodic.get(k) ?? 0;
    return n;
  };
  const near = (k) => (melodic.get(k - 1) ?? 0) + (melodic.get(k) ?? 0) + (melodic.get(k + 1) ?? 0) > 0;
  let next = 0;
  for (let bar = 3; bar < Math.min(P.closeFrom ?? P.bars, P.bars + 1); bar++) {
    if ((P.signalBars ?? []).includes(bar)) continue; // the Signal calls; the lead answers later
    const k0 = (bar - 1) * BAR;
    const halves = [count(k0, k0 + 8) <= 1, count(k0 + 8, k0 + 16) <= 1];
    if (!halves[0] && !halves[1]) continue;
    const phrase = bars[next % bars.length];
    const notes = phrase.filter((n) => halves[n.at < 8 ? 0 : 1] && !near(k0 + n.at)).map((n) => ({ ...n, len: Math.min(n.len, n.at < 8 && !halves[1] ? 8 - n.at : n.len) }));
    if (!notes.length) continue;
    plan.set(bar, notes);
    next++;
  }
  return plan;
}

/** The bass degree's pitch over `chord` (chord.bass is D2-B2). */
export function bassNote(chord, degree) {
  const R = chord.bass;
  if (degree === "8") return R + 12;
  if (degree === "5") {
    // the chord tone nearest a fifth above the bass (a slash chord's pedal
    // has no fifth of its own: its chord's root or fifth answers it)
    const tones = chordTones(chord, R + 3, R + 10);
    return tones.length ? tones.reduce((a, b) => (Math.abs(b - (R + 7)) < Math.abs(a - (R + 7)) ? b : a)) : R + 12;
  }
  return R;
}
/** A lead pitch fitted to the chord it sounds over (its safe set), kept in
 * the lead's register. */
export function fitLead(chord, midi, lo = 60, hi = 81) {
  let m = isSafe(chord, midi) ? midi : nearestSafe(chord, midi);
  while (m > hi) m -= 12;
  while (m < lo) m += 12;
  return isSafe(chord, m) ? m : nearestSafe(chord, m);
}

/**
 * options: level (its SCORES preset and baked path).
 * tick(k) returns the notes of score position k: { layer: "tune", voice,
 * midi, pos, len, dur (simulation seconds are the engine's), gain, pan,
 * part } with part lead | bass | harp | kit. `restart()` after a fall: the
 * lead rests for the first bar back (re-entries breathe, never pile up).
 */
export function createTune({ level = 1 } = {}) {
  const def = LEVELS.find((d) => d.id === level) ?? LEVELS[0];
  const P = scoreOf(def.id);
  const T = tuneFor(def.key);
  const plan = leadPlan(def.id, T);
  const { melodic, gestures } = dianaNotes(def.id);
  const section = (k) => P.sections.find((q) => barOf(k) >= q.from && barOf(k) <= q.to) ?? P.sections[0];
  let quietUntil = -Infinity;
  const busyBar = (bar) => {
    let n = 0;
    for (let k = (bar - 1) * BAR; k < bar * BAR; k++) n += melodic.get(k) ?? 0;
    return n;
  };
  function tick(k) {
    if (k < 0) return [];
    const out = [];
    const bar = barOf(k),
      inBar = ((k % BAR) + BAR) % BAR,
      chord = P.chordAt(k),
      sec = section(k),
      coda = sec.id === "coda" || bar > P.bars,
      rest = sec.pulse === false;
    const push = (n) => out.push({ layer: "tune", pos: k, ...n });
    // Lead (from bar 3, through the gaps; the closing theme is the Signal's).
    if (!coda && k >= quietUntil) {
      for (const n of plan.get(bar) ?? [])
        if (n.at === inBar)
          push({ part: "lead", voice: "keys", midi: fitLead(chord, n.midi, T.lo, T.hi), len: n.len, gain: T.gain * (gestures.has(k) ? 0.7 : 1), brightness: T.brightness, pan: 0.22 });
    }
    if (coda && inBar === 0 && bar === (sec.id === "coda" ? sec.from : P.bars + 1)) {
      // the coda's first bar: the lead settles on a chord tone, once
      push({ part: "lead", voice: "keys", midi: fitLead(chord, chordTones(chord, T.lo, T.hi)[1] ?? rootIn(chord, T.lo), T.lo, T.hi), len: 12, gain: T.gain * 0.8, brightness: T.brightness, pan: 0.22 });
    }
    // Bass (the rest pattern where the preset's groove rests; one note in the coda).
    const bassPat = coda ? [[0, "R", 16, 0.8]] : rest && T.rest?.bass ? T.rest.bass : T.bass;
    for (const [at, deg, len, g] of bassPat) if (at === inBar) push({ part: "bass", voice: "tbass", midi: bassNote(chord, deg), len, gain: g });
    // Harp: the chord's tones; quarters where Diana's melody is dense.
    const H = T.harp,
      dense = busyBar(bar) >= 4;
    const i = H.at.indexOf(inBar);
    if (i >= 0 && !(coda && inBar > 0) && !(dense && inBar % 4 !== 0)) {
      const tones = chordTones(chord, H.lo, H.hi);
      if (tones.length) {
        const m = tones[H.order[i % H.order.length] % tones.length];
        push({ part: "harp", voice: "harp", midi: m, len: 4, gain: H.gain * (H.accents.includes(inBar) ? 1 : 0.7) * (dense ? 0.8 : 1), pan: i % 2 ? 0.35 : -0.35 });
      }
    }
    // Kit from bar 3, resting where the preset's groove rests and in the coda.
    if (bar >= 3 && !rest && !coda) for (const [at, v, g] of T.kit) if (at === inBar) push({ part: "kit", voice: v, gain: g, pan: v === "rim" ? -0.1 : 0.28 });
    return out;
  }
  return {
    tick,
    key: def.key,
    tune: T,
    plan,
    /** After a fall: the lead rests for the first bar back. */
    restart(k) {
      quietUntil = (Math.floor(k / BAR) + 1) * BAR;
    },
    reset() {
      quietUntil = -Infinity;
    },
  };
}
