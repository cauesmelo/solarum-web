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

import { LEVELS } from "./level.mjs";
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
  // Per-level colours (RESEARCH_LEVELS 6). L1: the cycle in maj7 / add9
  // voicings. L3: E Dorian (D major's notes, so G# stays reserved). L4: B
  // Aeolian over an F# pedal; its A# lives only in the F# pad.
  "Bm(add9)": { name: "Bm(add9)", root: 11, bass: 47, tones: [11, 2, 6], safe: [11, 1, 2, 4, 6, 9], pad: [59, 61, 62, 66] },
  "F#m7": { name: "F#m7", root: 6, bass: 42, tones: [6, 9, 1], safe: [6, 9, 11, 1, 4], pad: [57, 61, 64, 66] },
  Dmaj7: { name: "Dmaj7", root: 2, bass: 38, tones: [2, 6, 9], safe: [2, 4, 6, 9, 11], pad: [57, 61, 62, 66] },
  Gmaj7: { name: "Gmaj7", root: 7, bass: 43, tones: [7, 11, 2], safe: [7, 9, 11, 2, 4], pad: [55, 59, 62, 66] },
  Em9: { name: "Em9", root: 4, bass: 40, tones: [4, 7, 11], safe: [4, 7, 9, 11, 2], pad: [55, 59, 62, 66] },
  A7sus4: { name: "A7sus4", root: 9, bass: 45, tones: [9, 2, 4], safe: [9, 11, 2, 4], pad: [55, 57, 62, 64] },
  "Dmaj9/F#": { name: "Dmaj9/F#", root: 2, bass: 42, tones: [2, 6, 9], safe: [2, 4, 6, 9, 11], pad: [57, 61, 64, 66] },
  "Bm/F#": { name: "Bm/F#", root: 11, bass: 42, tones: [11, 2, 6], safe: [11, 2, 4, 6, 9], pad: [59, 62, 66, 71] },
  // Over the pedal the F# itself is always safe (the ostinato plays it).
  "G/F#": { name: "G/F#", root: 7, bass: 42, tones: [7, 11, 2], safe: [7, 9, 11, 2, 4, 6], pad: [55, 59, 62, 67] },
  "Em/F#": { name: "Em/F#", root: 4, bass: 42, tones: [4, 7, 11], safe: [4, 7, 11, 2, 9, 6], pad: [55, 59, 64, 67] },
  "F#sus4": { name: "F#sus4", root: 6, bass: 42, tones: [6, 11, 1], safe: [6, 11, 1, 4], pad: [54, 59, 61, 66] },
  "F#": { name: "F#", root: 6, bass: 42, tones: [6, 1, 11], safe: [6, 11, 1, 4], pad: [54, 58, 61, 66] },
  A: { name: "A", root: 9, bass: 45, tones: [9, 1, 4], safe: [9, 11, 1, 4, 6], pad: [57, 61, 64, 69] },
  // II's turnaround (A C# E F#): the sixth instead of the seventh keeps it calm.
  A6: { name: "A6", root: 9, bass: 45, tones: [9, 1, 4], safe: [9, 11, 1, 4, 6], pad: [57, 61, 64, 66] },
  // III's Lydian colour: A over G (the #11's C# against the bass).
  "A/G": { name: "A/G", root: 9, bass: 43, tones: [9, 1, 4], safe: [9, 11, 1, 4, 6], pad: [55, 61, 64, 69] },
  Bm7: { name: "Bm7", root: 11, bass: 47, tones: [11, 2, 6], safe: [11, 2, 4, 6, 9], pad: [57, 62, 66, 69] },
  "F#m/A": { name: "F#m/A", root: 6, bass: 45, tones: [6, 9, 1], safe: [6, 9, 11, 1, 4], pad: [57, 61, 64, 66] },
  // VI's A Mixolydian over the A pedal (D major's notes): G, D and Em7 with A in the bass.
  "G/A": { name: "G/A", root: 7, bass: 45, tones: [7, 11, 2], safe: [7, 9, 11, 2, 4], pad: [55, 59, 62, 69] },
  "D/A": { name: "D/A", root: 2, bass: 45, tones: [2, 6, 9], safe: [2, 4, 6, 9, 11], pad: [57, 62, 66, 69] },
  "Em7/A": { name: "Em7/A", root: 4, bass: 45, tones: [4, 7, 11, 2], safe: [4, 7, 9, 11, 2], pad: [55, 59, 62, 64] },
  // D Lydian: the chapter's only sustained G#, at the door with three Great Stars.
  Earth: { name: "Dmaj7#11", root: 2, bass: 38, tones: [2, 6, 9, 1, 8], safe: [2, 4, 6, 8, 9, 11, 1], pad: [62, 66, 68, 73] },
});
const C = CHORDS;
/** The chapter's score map in bars (1-based) and the chord of each half bar
 * (brief 5.4): the source of L2's map (its bars are the chapter's minus 22). */
const CYCLE = [[C.Bm, C.Bm], [C["F#m"], C.D], [C["F#m"], C.D], [C.G, C.G]];
const CYCLE_III = [[C.Bm, C.Bm], [C["F#m"], C.Dadd9], [C["F#m"], C.Dadd9], [C["Gmaj7#11"], C["Gmaj7#11"]]];
export const barOf = (pos) => Math.floor(pos / BAR) + 1;
const halfOf = (pos) => Math.floor((((Math.max(0, pos) % BAR) + BAR) % BAR) / 8);
function chapterChordAt(pos) {
  const bar = barOf(Math.max(0, pos)),
    half = halfOf(pos);
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
/** A level map from its sections: each has bars [from, to], a cycle of
 * chords (one per bar, or [first half, second half]) and its bed flags. */
function mapOf(sections, coda) {
  return (pos) => {
    const bar = barOf(Math.max(0, pos)),
      sec = sections.find((q) => bar >= q.from && bar <= q.to);
    if (!sec?.cycle) return coda;
    const c = sec.cycle[(bar - sec.from) % sec.cycle.length];
    return Array.isArray(c) ? c[halfOf(pos)] : c;
  };
}
// II · The Gift: Bm7 Gmaj7 Dadd9 A6 laid over its sections (the heartbeat
// rests while the gift arrives and over the long void).
const GIFT_SECTIONS = [
  { id: "gift", from: 1, to: 4, pulse: false, cycle: [C.Bm7, C.Bm7, C.Bm7, C.Gmaj7] },
  { id: "voids", from: 5, to: 7, cycle: [C.Dadd9, C.A6, C.Bm7] },
  { id: "breath", from: 8, to: 9, cycle: [C.Gmaj7, C.Dadd9] },
  { id: "long", from: 10, to: 11, pulse: false, cycle: [C.A6, C.Bm7] },
  { id: "steps", from: 12, to: 16, cycle: [C.Gmaj7, C.Dadd9, C.A6, C.Bm7, C.Gmaj7] },
  { id: "plain", from: 17, to: 19, cycle: [C.Dadd9, C.Gmaj7, C.A6] },
  { id: "coda", from: 20, to: Infinity },
];
// III · Still Water: G Lydian, Gmaj7#11 A/G F#m7 Em9, a chord a bar; the
// brush rests while the helper comes and over the warm-up flight.
const STILL_SECTIONS = [
  { id: "warm", from: 1, to: 2, pulse: false, cycle: [C["Gmaj7#11"]] },
  { id: "helper", from: 3, to: 4, pulse: false, cycle: [C["A/G"], C.Em9] },
  { id: "still", from: 5, to: 7, cycle: [C["Gmaj7#11"], C["A/G"], C["F#m7"]] },
  { id: "float", from: 8, to: 12, cycle: [C.Em9, C["Gmaj7#11"], C["A/G"], C["F#m7"], C.Em9] },
  { id: "stair", from: 13, to: 17, cycle: [C["Gmaj7#11"], C["A/G"], C["F#m7"], C.Em9, C["Gmaj7#11"]] },
  { id: "rise", from: 18, to: 21, cycle: [C["A/G"], C["F#m7"], C.Em9, C["Gmaj7#11"]] },
  { id: "shelf", from: 22, to: 22, cycle: [C["A/G"]] },
  { id: "coda", from: 23, to: Infinity },
];
// IV · The Way Down: the soundtrack's own cycle (Bm | F#m D | F#m D | G)
// from bar 3; the heartbeat rests while the necklace wakes and in the
// broken well, keeps only its downbeat over the cut and the glint, and
// beats on 1 and 3 in the rings.
const WAY_SECTIONS = [
  { id: "warm", from: 1, to: 2, pulse: false },
  { id: "necklace", from: 3, to: 4, pulse: false },
  { id: "down", from: 5, to: 7, downbeat: true },
  { id: "glint", from: 8, to: 10, downbeat: true },
  { id: "broken", from: 11, to: 13, pulse: false },
  { id: "rings", from: 14, to: 20 },
  { id: "coda", from: 21, to: Infinity },
];
const L1_CYCLE = [C["Bm(add9)"], C["Bm(add9)"], C["F#m7"], C.Dmaj7, C["F#m7"], C.Dmaj7, C.Gmaj7, C.Gmaj7];
// V · The Breaking Constellation: E Dorian (D major's notes, so G# stays
// reserved), Em9 A7sus4 Dmaj9/F# Gmaj7#11; the split voids turn to the
// relative minor, Bm7 G A F#m (RESEARCH_PROGRESSION 4.3). Restraint (the
// bed stays at or under IV's onsets): the tresillo's marimba and the
// half-time beat only where the cracks run land and go on the beat (bars
// 5-8 and the run down from the crown, 21-22); the groove rests everywhere
// else, so the dives, the shards and the songs are Diana's own. No shaker.
const V_CYCLE = [C.Em9, C.A7sus4, C["Dmaj9/F#"], C["Gmaj7#11"]];
const BREAKING_SECTIONS = [
  { id: "wake", from: 1, to: 2, pulse: false, cycle: [C.Em9] },
  { id: "first", from: 3, to: 4, pulse: false, cycle: [C["Gmaj7#11"], C["Dmaj9/F#"]] },
  { id: "go", from: 5, to: 8, cycle: V_CYCLE },
  { id: "ridge", from: 9, to: 11, pulse: false, cycle: V_CYCLE },
  { id: "split", from: 12, to: 15, pulse: false, cycle: [C.Bm7, C.G, C.A, C["F#m"]] },
  { id: "through", from: 16, to: 18, pulse: false, cycle: [C.Em9, C["Dmaj9/F#"], C.A7sus4] },
  { id: "crown", from: 19, to: 20, pulse: false, cycle: [C["Gmaj7#11"], C["Dmaj9/F#"]] },
  { id: "down", from: 21, to: 22, cycle: [C.A7sus4, C.Em9] },
  { id: "close", from: 23, to: 23, cycle: [C["Gmaj7#11"]] },
  { id: "coda", from: 24, to: Infinity },
];
// VI · Borrowed Wind: A Mixolydian, A G/A D/A Em7/A over the A pedal
// (RESEARCH_PROGRESSION 4.3). Restraint: the brief's driving shaker is left
// out; the tresillo (the clave's 3+3+2 on the marimba, the half-time beat)
// plays only over the first wind and the finale (the bed stays at or under
// V's onsets); the wind's own rising
// runs (the strings, Diana's) carry the storm.
const WIND_CYCLE = [C.A, C["G/A"], C["D/A"], C["Em7/A"]];
const WIND_SECTIONS = [
  { id: "wake", from: 1, to: 2, pulse: false, cycle: [C.A] },
  { id: "breeze", from: 3, to: 5, pulse: false, cycle: [C.A, C["G/A"]] },
  { id: "lift", from: 6, to: 9, cycle: WIND_CYCLE },
  { id: "storm", from: 10, to: 14, pulse: false, cycle: WIND_CYCLE },
  { id: "finale", from: 15, to: 17, cycle: [C["D/A"], C["Em7/A"], C.A] },
  { id: "high", from: 18, to: 18, pulse: false, cycle: [C["G/A"]] },
  { id: "last", from: 19, to: 23, pulse: false, cycle: [...WIND_CYCLE, C.A] },
  { id: "coda", from: 24, to: Infinity },
];
// VII · The Falling Road: B Aeolian, Bm G A F#m (RESEARCH_PROGRESSION 4.3).
// Restraint: the brief's full backbeat is left out; the falling road is the
// drum: the tiles' knocks on each beat are the world's, Diana's touch-downs
// on them are hers (the stone marimba stepping down the chord); the clave
// plays only under the six-tile wave (bars 6-8).
const ROAD_CYCLE = [C.Bm, C.G, C.A, C["F#m"]];
const ROAD_SECTIONS = [
  { id: "wake", from: 1, to: 2, pulse: false, cycle: [C.Bm] },
  { id: "first", from: 3, to: 4, pulse: false, cycle: [C.Bm, C.G] },
  { id: "road", from: 5, to: 5, pulse: false, cycle: [C.Bm] },
  { id: "wave", from: 6, to: 8, cycle: [C.G, C.A, C["F#m"]] },
  { id: "dive", from: 9, to: 12, pulse: false, cycle: ROAD_CYCLE },
  { id: "gap", from: 13, to: 16, pulse: false, cycle: [C.G, C.A, C["F#m"], C.Bm] },
  { id: "wind", from: 17, to: 20, pulse: false, cycle: ROAD_CYCLE },
  { id: "home", from: 21, to: 23, pulse: false, cycle: [C.G, C.A, C.Bm] },
  { id: "close", from: 24, to: 24, pulse: false, cycle: [C.Bm] },
  { id: "coda", from: 25, to: Infinity },
];
// VIII · The Far Door (RESEARCH_PROGRESSION 4.3: B Aeolian over an F# pedal,
// revision six's IV harmony). Restraint (the owner: the background was
// overwhelming): the tension is the pedal's harmony, the falling roads'
// knocks (the world's) and the density of Diana's own notes. Revision six's
// four on the floor (a felt kick on every beat and an eighth-note
// ostinato) is left out: no groove at all, and no shaker.
const FAR_CYCLE = [C["Bm/F#"], C["G/F#"], C["Em/F#"], [C["F#sus4"], C["F#"]]];
const FAR_SECTIONS = [
  { id: "wake", from: 1, to: 2, pulse: false, cycle: [C["Bm/F#"]] },
  { id: "school", from: 3, to: 3, pulse: false, cycle: [C["G/F#"]] },
  { id: "storm", from: 4, to: 5, pulse: false, cycle: [C["Em/F#"], [C["F#sus4"], C["F#"]]] },
  { id: "wind", from: 6, to: 7, pulse: false, cycle: [C["Bm/F#"], C["G/F#"]] },
  { id: "falling", from: 8, to: 10, pulse: false, cycle: [C["Em/F#"], [C["F#sus4"], C["F#"]], C["Bm/F#"]] },
  { id: "gauntlet", from: 11, to: 14, pulse: false, cycle: FAR_CYCLE },
  { id: "road", from: 15, to: 16, pulse: false, cycle: [C["G/F#"], [C["F#sus4"], C["F#"]]] },
  { id: "stair", from: 17, to: 20, pulse: false, cycle: FAR_CYCLE },
  { id: "last", from: 21, to: 24, pulse: false, cycle: FAR_CYCLE },
  { id: "close", from: 25, to: 25, pulse: false, cycle: [C.Bm] },
  { id: "coda", from: 26, to: Infinity, pulse: false },
];
/**
 * One conductor preset per level (RESEARCH_LEVELS 6): its map (sections in
 * bars, a chord per position), the Signal's bars and the bar its closing
 * theme starts, the groove, the bed's detune cap, the space, the fall and
 * the payoff. Section flags: pulse (the groove plays), shaker, glass (the
 * earned celesta). Positions are simulation sixteenths from the level's bar
 * 1; the transport plays them at the level's own BPM (clock = BPM / 107).
 * (A level may start on a half bar with `pickup: 8`; revision six's
 * Borrowed Wind did, from the chapter's hearth.)
 */
const PRESETS = {
  waking: {
    bpm: 88, bars: 20, pickup: 0,
    // I · Waking, floaty and calm (RESEARCH_PROGRESSION 4.3): the cycle at
    // half harmonic rhythm in maj7 / add9 voicings, no drums at all; the pad
    // re-voicing on every bar line is the breath. Restraint (user, revision
    // five: the music was "too full, too present, too loud"): the bed is the
    // pad and four far Signal calls, nothing else until Diana's own notes;
    // the tension of the crash is harmonic (bars 15-16), never louder.
    groove: "breath", maxFlat: 12, space: { seconds: 5.5, shimmer: 0.45 }, tapeStop: 0.35, rewind: false, dropOnFall: false,
    sections: [
      { id: "wake", from: 1, to: 2 },
      { id: "climb", from: 3, to: 4 },
      { id: "shower", from: 5, to: 7 },
      { id: "first-star", from: 8, to: 9 },
      { id: "leap", from: 10, to: 12 },
      { id: "stairs", from: 13, to: 15 },
      { id: "home", from: 16, to: 19 },
      { id: "coda", from: 20, to: Infinity },
    ],
    chordAt(pos) {
      const bar = barOf(Math.max(0, pos));
      if (bar <= 2) return C["Bm(add9)"];
      // The brightest star (bar 15) hangs on the dominant colour; the crash
      // lands on the tonic's relative (bar 16) and the run goes home.
      if (bar === 15) return C["F#m7"];
      if (bar <= 17) return L1_CYCLE[(bar - 3) % 8];
      if (bar === 18) return C.Gmaj7;
      if (bar === 19) return C.Dmaj7;
      return C.Dadd9;
    },
    // The first call at the wake, the lookout (bar 5), after the first star
    // (bar 9) and after the crash (bar 16); the theme closes from bar 18.
    signalBars: [1, 5, 9, 16], closeFrom: 18,
    phrases: {
      // the climb (bars 2-4, Bm(add9)): the motif's head, slowed: D5 C#5 B4 | A4.
      "first-song": [74, 73, 71, 69],
      // the shower (bar 5 F#m7, bar 6 Dmaj7): falling, then rising past the
      // lookout's height: A5 F#5 E5 | D5 F#5 A5 B5 A5.
      "shower-song": [81, 78, 76, 74, 78, 81, 83, 81],
      // the upper tier's four (bars 5-6): C#5 E5 | F#5 A5.
      "tier-song": [73, 76, 78, 81],
      // home (bars 16-19, Dmaj7 Gmaj7 Gmaj7 Dmaj7): the answer falling home,
      // F#5 E5 D5 A4.
      "home-song": [78, 76, 74, 69],
    },
  },
  gift: {
    bpm: 94, bars: 20, pickup: 0,
    // II · The Gift, calm with marked beats (RESEARCH_PROGRESSION 4.3): Bm7
    // Gmaj7 Dadd9 A6, a felt heartbeat on 1 and 3 from bar 3 and nothing else
    // in the bed. Restraint: no shaker (there is no wind in II), the
    // heartbeat rests while the gift arrives and on the long void (bars 1-4
    // and 10-11), so the cape's notes and the void-song carry those bars.
    groove: "heartbeat", maxFlat: 14, space: { seconds: 5.5, shimmer: 0.4 }, tapeStop: 0.45, rewind: true, dropOnFall: false,
    sections: GIFT_SECTIONS,
    chordAt: mapOf(GIFT_SECTIONS, C.Dadd9),
    // The gift (bar 1), the hearth void (bar 5), the long void (bar 10) and
    // Pluto (bar 14); the theme closes from bar 18.
    signalBars: [1, 5, 10, 14], closeFrom: 18,
    phrases: {
      // bar 3 (Bm7) into bar 4 (Gmaj7): the first flight, F#5 E5 D5 | B4.
      "first-flight": [78, 76, 74, 71],
      // bar 5 (Dadd9): the hearth void rises, A4 B4 D5 | F#5.
      "flight-line": [69, 71, 74, 78],
      // bar 11 (Bm7): the refill climbs, B4 D5 E5 F#5.
      "void-song": [71, 74, 76, 78],
      // bar 13 (Dadd9) into 14 (A6): the steps-song, D5 E5 F#5 A5.
      "steps-song": [74, 76, 78, 81],
      // bar 16 (Gmaj7): down to Pluto, D5 B4 A4 | G4.
      "pluto-song": [74, 71, 69, 67],
    },
  },
  "still-water": {
    bpm: 100, bars: 23, pickup: 0,
    // III · Still Water, floating and flowing (RESEARCH_PROGRESSION 4.3):
    // G Lydian, a chord a bar. Restraint (revision five: the bed was "too
    // full, too present, too loud"): the groove is one soft brush on beat
    // 4 and nothing else; the held cape's whistle and Diana's own notes
    // (the long descending glide lines) carry the song.
    groove: "brush", maxFlat: 15, space: { seconds: 5, shimmer: 0.4 }, tapeStop: 0.45, rewind: true, dropOnFall: false,
    sections: STILL_SECTIONS,
    chordAt: mapOf(STILL_SECTIONS, C["Gmaj7#11"]),
    // The wake, the still void (bar 5), letting go (bar 11) and the rise
    // (bar 18); the theme closes from bar 21.
    signalBars: [1, 5, 11, 18], closeFrom: 21,
    phrases: {
      // bar 4 (Em9): down the slope of air, B5 A5 G5 E5.
      "float-song": [83, 81, 79, 76],
      // bar 6 (A/G): up along the flight, down the glide, E5 F#5 A5 | B5 A5 F#5.
      "still-song": [76, 78, 81, 83, 81, 78],
      // bar 9 (Gmaj7#11): down off the ledge, D6 B5 A5 G5.
      "ledge-song": [86, 83, 81, 79],
      // bar 11 (F#m7): over the islets, C#5 E5 F#5 E5 C#5.
      "drift-song": [73, 76, 78, 76, 73],
      // bar 17 (Gmaj7#11): the refill climbs, D5 E5 G5 A5.
      "refill-song": [74, 76, 79, 81],
      // bar 17 (Gmaj7#11) into 18 (A/G): the second flight, B5 A5 E5 | C#5.
      "deep-song": [83, 81, 76, 73],
      // bar 20 (Em9): the rise, E5 G5 A5 B5.
      "climb-song": [76, 79, 81, 83],
      // bars 20-21: Neptune's song falls and opens, B5 A5 G5 | D6.
      "neptune-song": [83, 81, 79, 86],
    },
  },
  "way-down": {
    bpm: 107, bars: 22, pickup: 0,
    // IV · The Way Down, the song at home at its own tempo (RESEARCH_PROGRESSION
    // 4.3): the soundtrack's cycle and a felt heartbeat. Restraint: no
    // ticks and no shaker (the brief's sixteenths are left out), the
    // heartbeat on 1 and 3 only in the rings; the dives, smashes and the
    // descending lines are Diana's own.
    groove: "heartbeat", maxFlat: 16, space: { seconds: 4.5, shimmer: 0.35 }, tapeStop: 0.45, rewind: true, dropOnFall: false,
    sections: WAY_SECTIONS,
    chordAt(pos) {
      const bar = barOf(Math.max(0, pos));
      if (bar <= 2) return C.Bm;
      if (bar <= 20) return CYCLE[(bar - 3) % 4][halfOf(pos)];
      return C.Dadd9;
    },
    // The wake, the cut (bar 5), the well (bar 11) and the rings (bar 15);
    // the theme closes from bar 20.
    signalBars: [1, 5, 11, 15], closeFrom: 20,
    phrases: {
      // bars 2-3 (Bm): along the warm-up's flight and held cape, B4 D5 F#5 | E5 D5.
      "warm-song": [71, 74, 78, 76, 74],
      // bar 9 (F#m | D): over the glint, A5 F#5 | E5 D5.
      "glint-song": [81, 78, 76, 74],
      // bar 9 (F#m): the cache, C#5 E5 F#5 A5.
      "cache-song": [73, 76, 78, 81],
      // bar 12 (F#m | D): out of the well, C#5 | D5 F#5 A5.
      "well-song": [73, 74, 78, 81],
      // bar 16 (D, its second half): on ring-2 and up, D5 F#5 A5 B5.
      "ring-song": [74, 78, 81, 83],
      // bars 19-20 (Bm | F#m): up to the plane, B4 D5 F#5 | A5.
      "plane-song": [71, 74, 78, 81],
    },
  },
  breaking: {
    bpm: 112, bars: 24, pickup: 0,
    // V · The Breaking Constellation, a nocturne of call and response
    // (RESEARCH_PROGRESSION 4.3): the cracks give no bass (they are outside
    // the score), Diana's jumps, dives and shards answer them. Restraint:
    // the clave plays six of its 23 bars (BREAKING_SECTIONS), no shaker.
    groove: "clave", maxFlat: 18, space: { seconds: 3.5, shimmer: 0.3 }, tapeStop: 0.45, rewind: true, dropOnFall: false,
    sections: BREAKING_SECTIONS,
    chordAt: mapOf(BREAKING_SECTIONS, C["Gmaj7#11"]),
    // The wake, the second crack (bar 5), the split voids (bar 12) and the
    // crown (bar 19); the theme closes from bar 22.
    signalBars: [1, 5, 12, 19], closeFrom: 22,
    phrases: {
      // bar 2 (Em9): down the dive onto the low islet, G5 E5 D5 B4.
      "fall-song": [79, 76, 74, 71],
      // bars 5-6 (Em9 | A7sus4): land and go, D5 E5 | A5 B5 A5.
      "crack-song": [74, 76, 81, 83, 81],
      // bars 9-10 (Em9 | A7sus4): the ridge's late double, D5 E5 | A5 B5.
      "ridge-song": [74, 76, 81, 83],
      // bars 12-13 (Bm7 | G): the split voids' answer, F#5 E5 D5 B4 | G4.
      "split-song": [78, 76, 74, 71, 67],
      // bars 16-18 (Em9 | Dmaj9/F# | A7sus4): down through the stone, B5 | A5 F#5 D5 | A4.
      "stone-song": [83, 81, 78, 74, 69],
      // bar 20 (Dmaj9/F#): up to the crown, A4 B4 D5 F#5 A5.
      "crown-song": [69, 71, 74, 78, 81],
      // bars 21-22 (A7sus4 | Em9): the run down, B5 A5 E5 D5 | E5.
      "plain-song": [83, 81, 76, 74, 76],
    },
  },
  "borrowed-wind": {
    bpm: 118, bars: 24, pickup: 0,
    // VI · Borrowed Wind, storm-bright (RESEARCH_PROGRESSION 4.3): the clave
    // plays 7 of 23 bars (WIND_SECTIONS), no shaker; in the wind the strings
    // run up the chord with her.
    groove: "clave", maxFlat: 20, space: { seconds: 3.5, shimmer: 0.3 }, tapeStop: 0.45, rewind: true, dropOnFall: false,
    sections: WIND_SECTIONS,
    chordAt: mapOf(WIND_SECTIONS, C.A),
    // The wake, the first wind (bar 6), out of the top (bar 10) and the
    // finale (bar 15); the theme closes from bar 22.
    signalBars: [1, 6, 10, 15], closeFrom: 22,
    phrases: {
      // bar 4 (G/A): up the hearth breeze, D5 E5 G5 A5.
      "breeze-song": [74, 76, 79, 81],
      // bars 10-11 (A | G/A): up the fly-out wind, C#5 E5 F#5 | A5.
      "wind-song": [73, 76, 78, 81],
      // bar 15 (D/A): the cracked launch, D5 F#5 A5 B5.
      "launch-song": [74, 78, 81, 83],
      // bars 15-16 (D/A | Em7/A): along the first flight and the double, D6 | B5 A5 G5.
      "finale-song": [86, 83, 81, 79],
      // bars 13-14 (Em7/A | A): wind, dive, wind, E5 G5 | A5 C#6 E6.
      "storm-song": [76, 79, 81, 85, 88],
      // bars 20-21 (G/A | D/A): the last wind's float, D5 G5 B5 D6 | A5.
      "last-song": [74, 79, 83, 86, 81],
    },
  },
  "falling-road": {
    bpm: 123, bars: 26, pickup: 0,
    // VII · The Falling Road, tense (RESEARCH_PROGRESSION 4.3): the tiles'
    // knocks step down the chord on every beat while the road falls; the
    // clave plays 3 of 25 bars (ROAD_SECTIONS), no shaker.
    groove: "clave", maxFlat: 22, space: { seconds: 3, shimmer: 0.28 }, tapeStop: 0.45, rewind: true, dropOnFall: false,
    sections: ROAD_SECTIONS,
    chordAt: mapOf(ROAD_SECTIONS, C.Bm),
    // The wake, the wave (bar 5) and the missing tiles (bar 13); the theme
    // closes from bar 23.
    signalBars: [1, 5, 13], closeFrom: 23,
    phrases: {
      // bars 3-4 (Bm | G): down the first road, F#5 | D5 B4 G4.
      "road-song": [78, 74, 71, 67],
      // bars 6-8 (G | A | F#m): the wave falls a step a tile, B5 A5 G5 | E5 C#5 | B4.
      "wave-song": [83, 81, 79, 76, 73, 71],
      // bars 11-12 (A | F#m): down the dives, C#6 A5 F#5 E5 | C#5.
      "dive-song": [85, 81, 78, 76, 73],
      // bars 14-15 (A | F#m): rising over the missing tiles, E5 | F#5 A5 C#6.
      "gap-song": [76, 78, 81, 85],
      // bar 18 (G): the shore's run and the rise, B4 D5 G5 B5.
      "spark-song": [71, 74, 79, 83],
      // bars 23-24 (Bm): home, F#5 E5 D5 B4.
      "home-song": [78, 76, 74, 71],
    },
  },
  door: {
    bpm: 128, bars: 26, pickup: 0,
    // VIII · The Far Door, tense but fair: the densest and brightest of the
    // campaign by Diana's own notes, not by the bed (FAR_SECTIONS: no
    // groove plays; "four" names revision six's, which the restraint dropped).
    groove: "four", maxFlat: 24, space: { seconds: 2.5, shimmer: 0.25 }, tapeStop: 0.45, rewind: true, dropOnFall: true,
    sections: FAR_SECTIONS,
    chordAt: mapOf(FAR_SECTIONS, C["Bm/F#"]),
    // The wake, out of the wind (bar 6), the gauntlet (bar 11) and the
    // rising stair (bar 17); the theme closes from bar 24.
    signalBars: [1, 6, 11, 17], closeFrom: 24,
    phrases: {
      // bars 2-3 (Bm/F# | G/F#): up the school's super jump, D5 | E5 F#5 A5.
      "school-song": [74, 76, 78, 81],
      // bars 6-7 (Bm/F# | G/F#): up the column, F#5 A5 B5 | D6.
      "rise-song": [78, 81, 83, 86],
      // bars 9-10 (F# | Bm/F#): down the falling road, C#6 B5 | F#5 D5.
      "cascade-song": [85, 83, 78, 74],
      // bar 12 (G/F#): the cracked launch, B4 D5 E5 G5.
      "launch-song": [71, 74, 76, 79],
      // bars 16-17 (F#sus4 F# | Bm/F#): the star road, B5 C#6 E6 | F#6 D6.
      "road-song": [83, 85, 88, 90, 86],
      // bars 18-19 (G/F# | Em/F#): the rising stair, B4 | D5 E5 G5 A5.
      "stair-song": [71, 74, 76, 79, 81],
      // bars 19-20 (Em/F# | F#sus4): to the summit, B5 | C#6 E6 F#6.
      "summit-song": [83, 85, 88, 90],
      // bars 23-25 (Em/F# | F#sus4 F# | Bm): home, B5 | F#5 E5 C#5 | B4.
      "home-song": [83, 78, 76, 73, 71],
    },
  },
};
/** The presets by level number (LEVELS order), so a stage inserted into
 * the campaign shifts the interim levels' scores with them. */
export const SCORES = Object.freeze(Object.fromEntries(LEVELS.map((d) => [d.id, Object.freeze({ ...PRESETS[d.key], level: d.id })])));

export const scoreOf = (level = 1) => SCORES[level] ?? SCORES[1];
/** Level n's sections (kept as `SECTIONS` for level 1). */
export const SECTIONS = SCORES[1].sections;
export function sectionOf(pos, level = 1) {
  const P = scoreOf(level),
    bar = barOf(pos);
  return P.sections.find((q) => bar >= q.from && bar <= q.to) ?? P.sections[0];
}
/** The chord at score position `pos` (sixteenths) of level n. */
export function chordAt(pos, level = 1) {
  return scoreOf(level).chordAt(pos);
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
/** Every level's authored constellation notes, by chain id. */
export const PHRASES = Object.freeze({ ...SCORES[1].phrases });
/** The Signal: the motif's head (3 + 3 + 2 eighths) and its answer. Offsets
 * in sixteenths from the bar line; the answer bar is F#m | D. */
export const MOTIF = Object.freeze({
  head: [[0, 74], [6, 73], [12, 71]], // D5 . . C#5 . . B4 .
  answer: [[0, 69], [2, 78], [8, 69]], // A4 F#5 . . A4 . . .
});
/** Bars on which level 1's Signal calls (each level: SCORES[n].signalBars). */
export const SIGNAL_BARS = Object.freeze(SCORES[1].signalBars);

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
      if (!set) {
        this.anchor(t, a, s);
        return "anchor";
      }
      if (Math.abs(err) > jump) {
        // Re-anchor by whole sixteenths, so the grid keeps its phase against
        // everything already scheduled (a sixteenth is skipped or held, never
        // shifted by an odd amount); the residual is slewed below.
        const s16 = SIXTEENTH / scale,
          k = Math.round(err / s16);
        audio0 += k * s16;
        smooth = err - k * s16;
        jumps++;
        return "jump";
      }
      smooth += 0.2 * (err - smooth);
      if (Math.abs(smooth) < deadband) return "hold";
      // 1% of tempo for small drift, up to the brief's 3% for a residual
      // left by a re-anchor or a slow resume.
      const rate = Math.abs(smooth) > 0.02 ? 0.03 : slew;
      const max = rate * Math.max(0, dtAudio),
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
export const MAX_FLAT = 20; // cents
export const MAX_DETUNE = 25; // cents: flat + spread + wow at H_MIN
/** The hidden tuning value (brief 5.6). Only visible errors lower it: a
 * fall, a broken constellation, a score note more than 70 ms off its beat.
 * Clean play raises it again, but slowly: at most +0.1 per error-free bar
 * (a beacon counts as one), so a fall is heard for about four bars.
 * `mix()` turns it into the bed's tuning. The audio critic measured the
 * first, symmetric detune (pads spread around true pitch) as nearly
 * inaudible, so the whole bed now drifts flat against Diana's in-tune
 * voice: (1 - H) x 40 cents, at most 20, plus a small spread and tape wow,
 * at most 25 cents in all. Its lowpass closes and below H 0.7 the choir
 * rests. */
export function createTuning({ gentle = false, maxFlat = MAX_FLAT } = {}) {
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
    /** Dev auditions (soundboard): set H directly (Gentle still wins). */
    force(v) {
      return set(v);
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
        // Clean play is what heals, one bar at a time.
        case "on-grid-note":
        case "stable-landing":
        case "constellation":
          return 0;
        case "clean-bar":
        case "beacon":
          return set(H + 0.1);
        case "restart":
          return set(1);
        default:
          return 0;
      }
    },
    mix() {
      const out = 1 - H;
      // Each level caps the flat drift (10/15/20/20 cents, RESEARCH_LEVELS 6).
      const flat = Math.min(maxFlat, out * 40),
        pad = Math.min(3, out * 7.5),
        wow = Math.min(2, out * 5);
      return {
        H,
        flatCents: flat, // the whole bed, flat of Diana's voice
        padCents: pad, // +- spread between a pad's paired oscillators
        wowCents: wow,
        totalCents: flat + pad + wow, // the furthest any bed partial strays

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
  pulse: { bed: true, voices: ["pulse", "shaker", "marimba"] },
  steps: { bed: false, voices: ["bass"] },
  stars: { bed: false, voices: ["glass", "kalimba", "bloom", "chime", "shards"] },
  choir: { bed: true, voices: ["choir"] },
  glass: { bed: true, voices: ["celesta"] },
  strings: { bed: false, voices: ["harmonica", "vowel"] },
  earth: { bed: true, voices: ["dust"] },
});
const SIGH_BEND = -50; // cents: a broken constellation's last note sighs down
const REWIND_NOTES = 8;

/**
 * options: level (its SCORES preset), path (that level's score-path entry),
 * cracked (Set of platform ids that give no bass), gentle, seed.
 * The engine calls wake / frame / event / ticks and renders the returned
 * notes: { layer, voice, midi | midis, pos, t, kind, delay, cap, dur, gain,
 * pan, glideTo, bend, blur }. `t` is the onset in simulation seconds.
 */
export function createConductor(options = {}) {
  // The level's preset shadows the module's level-1 map inside the conductor.
  const P = scoreOf(options.level ?? 1);
  const chordAt = (pos) => P.chordAt(pos);
  const sectionOf = (pos) => P.sections.find((q) => barOf(pos) >= q.from && barOf(pos) <= q.to) ?? P.sections[0];
  const PHRASES = P.phrases;
  const path = options.path;
  const cracked = options.cracked ?? new Set();
  // VII: the falling road is the drum (RESEARCH_PROGRESSION 4.3). Diana's
  // own touch-down on a cascade tile is a note of hers (the stone marimba,
  // stepping down the chord); every other crack stays outside the score.
  const tiles = new Set((LEVELS.find((d) => d.id === P.level)?.cascades ?? []).flatMap((c) => c.tiles).filter(Boolean));
  const transport = createTransport();
  const tuning = createTuning({ gentle: options.gentle, maxFlat: P.maxFlat });
  const intended = new Map(); // star id -> baked sixteenth
  // The path counts from waking; a level that starts on a half bar (L2)
  // wakes at its pickup position.
  const pickup = P.pickup ?? 0;
  for (const a of path?.anchors ?? []) if (a.name === "star" || a.name === "chain-note") intended.set(a.id, a.k + pickup);
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
      roadStep: 0,
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
      dropped: false, // L4: the groove rests after a fall
    };
  }
  reset();
  const pos = (t) => transport.pos(t);
  const placePos = (x) => (path ? pathPos(path, x) + pickup : null);
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
    // Quantised across a chord change, a pitch chosen for the old chord is
    // refitted to the one it now sounds over (a bloom's low root excepted).
    const c = chordAt(q.pos),
      fit = (m) => (m == null || m < 60 || isSafe(c, m) ? m : nearestSafe(c, m));
    if (spec.midi != null) spec = { ...spec, midi: fit(spec.midi) };
    if (spec.glideTo != null) spec = { ...spec, glideTo: fit(spec.glideTo) };
    if (spec.midis) spec = { ...spec, midis: spec.midis.map(fit) };
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
    // Sky pad (and choir) on every chord change, every bar line and the first
    // tick: a held pad hands over to the next with a 1.6 s crossfade, so a
    // chord held for several bars never decays into a gap.
    const changed = st.lastChord !== chord || st.lastTick === null || inBar === 0;
    if (changed) {
      let midis = chord.pad;
      if (st.sus && k < st.sus.until) midis = midis.map((m) => (chord.tones[1] === pc(m) ? safeAtOrAbove(chord, m + 1) : m));
      bed({ layer: "sky", voice: "pad", midis, chord: chord.name, dur: 4 * BEAT, gain: 0.9 });
      if (k <= st.choirUntil && mix.choir) bed({ layer: "choir", voice: "choir", midis: chordTones(chord, 55, 69).slice(-3), dur: 4 * BEAT, gain: 0.8 });
      st.lastChord = chord;
    }
    if (st.sus && k >= st.sus.until) st.sus = null;
    // The groove (RESEARCH_LEVELS 6), from bar 3, resting where a section
    // says so and, in L4, after a fall until the next constellation or beacon.
    const S = sectionOf(k);
    const grooveOn = bar >= 3 && S.pulse !== false && !st.dropped;
    const coda = sec === "coda" ? 0.6 : 1;
    if (grooveOn && P.groove === "brush") {
      // III: one soft brush on beat 4, nothing on the downbeats (water).
      if (inBar === 12) bed({ layer: "pulse", voice: "shaker", dur: 0.08, gain: 0.4 * coda });
    } else if (grooveOn && P.groove === "heartbeat") {
      // A felt heartbeat on beats 1 and 3 (the half-time feel), a tick on 2 and 4.
      // (A section may keep only the downbeat: IV's cut and glint.)
      if (inBar === 0 || (inBar === 8 && !S.downbeat)) bed({ layer: "pulse", voice: "pulse", dur: 0.4, gain: (inBar === 0 ? 1 : 0.7) * coda });
      if ((inBar === 4 || inBar === 12) && S.shaker) bed({ layer: "pulse", voice: "shaker", dur: 0.06, gain: 0.62 });
    } else if (grooveOn && P.groove === "clave") {
      // Half-time backbeat on beat 3; the tresillo (3+3+2) on the rim and a
      // low marimba root under it.
      if (inBar === 8) bed({ layer: "pulse", voice: "pulse", dur: 0.4, gain: 0.85 * coda });
      if (inBar === 0 || inBar === 6 || inBar === 12)
        bed({ layer: "pulse", voice: "marimba", midi: rootIn(chord, 45), dur: 0.5, gain: (inBar === 0 ? 0.62 : 0.48) * coda, pan: 0.15 });
    } else if (grooveOn && P.groove === "four") {
      // A felt kick on every beat and an eighth-note ostinato on the F# pedal.
      if (inBar % 4 === 0) bed({ layer: "pulse", voice: "pulse", dur: 0.3, gain: (inBar === 0 ? 1 : 0.78) * coda });
      if (inBar % 2 === 0) bed({ layer: "pulse", voice: "marimba", midi: inBar % 4 === 0 ? 54 : 66, dur: 0.22, gain: 0.34 * coda, pan: 0.2 });
    }
    // Shaker sixteenths at about -30 dB where the section has them; accents
    // follow the groove (beats, or the tresillo in L3).
    if (S.shaker && grooveOn) {
      const accent = P.groove === "clave" ? [0, 6, 12].includes(inBar) : inBar % 4 === 0;
      bed({ layer: "pulse", voice: "shaker", dur: 0.06, gain: accent ? 0.5 : inBar % 2 === 0 ? 0.32 : 0.22 });
    }
    // The Signal: the motif's head on each cycle's Bm bar, far right at first
    // and nearer and drier with progress; the full theme leads the coda.
    const rel = inBar;
    const near = Math.min(1, bar / P.bars);
    const signalNote = (midi, len) =>
      bed({ layer: "signal", voice: "signal", midi, dur: len * SIXTEENTH * 1.6, gain: 0.45 + 0.55 * near, pan: 0.75 - 0.45 * near, send: 0.5 - 0.25 * near });
    if (P.signalBars.includes(bar) && bar < P.closeFrom) {
      // Re-entries after falls rotate the phrase (seeded by the fall count).
      const head = st.variation % 2 ? [[0, 74], [6, 76], [12, 71]] : MOTIF.head;
      for (const [at, m] of head) if (rel === at) signalNote(m, at === 12 ? 4 : 6);
    }
    // The theme closes the level: its head, then its answer, into the door.
    if (bar >= P.closeFrom) {
      const phrase = (bar - P.closeFrom) % 2 === 0 ? MOTIF.head : MOTIF.answer;
      for (const [at, m] of phrase) if (rel === at) signalNote(m, 6);
    }
    // Glass: a quiet celesta arpeggio where the section allows it, earned by
    // a lid smash or Great Star 2.
    if (S.glass && st.glassEarned) {
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
      transport.start(t, pickup);
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
        if (cracked.has(e.platform)) {
          if (!tiles.has(e.platform)) break;
          const q = quantize(pos(t), { grid: 1, cap: CAPS.landing, timeScale: st.timeScale });
          const tones = chordTones(chordAt(q.pos), 64, 83).reverse();
          const m = tones[st.roadStep++ % tones.length];
          push(note({ layer: "steps", voice: "marimba", midi: m, pos: q.pos, t: transport.timeOf(q.pos), kind: q.kind, delay: q.delay, cap: CAPS.landing, dur: 0.45, gain: 0.6, pan: -0.25 }));
          break;
        }
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
        st.dropped = false;
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
        // (Over the chord sounding now, which may have changed since.)
        const last = st.lastChainNote ?? rootIn(chord, 74);
        const m = isSafe(chord, last) ? last : nearestSafe(chord, last);
        push(note({ layer: "stars", voice: "kalimba", midi: m, bend: SIGH_BEND, bendTime: 0.4, pos: pos(t), t, kind: "loose", delay: 0, cap: 0, dur: 1, gain: 0.5 }));
        const p = pos(t);
        st.sus = { until: Math.ceil((p + 1) / 8) * 8 };
        st.lastChord = null;
        break;
      }
      case "refill-star": {
        // RESEARCH_REFILLS 1.1: one quantised voice of Diana's on the grid.
        // The cape star is the refill's A6 glint; the leaf star a glass tick
        // on the ninth, the double jump's own interval.
        const q = quantize(pos(t), { grid: 1, cap: CAPS.input, timeScale: st.timeScale });
        const c2 = chordAt(q.pos);
        const m = e.kind === "leaf" ? nearestSafe(c2, rootIn(c2, 74) + 14) : nearestSafe(c2, 93);
        push(note({ layer: "stars", voice: "glass", midi: m, pos: q.pos, t: transport.timeOf(q.pos), kind: q.kind, delay: q.delay, cap: CAPS.input, dur: 0.6, gain: 0.6, pan: 0.15 }));
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
        st.dropped = false;
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
        st.roadStep = 0;
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
        // Per level: L1's is a short one-octave stop; from L2 on the last
        // notes play backwards; in L4 the groove also rests (dropOnFall).
        out.fx.push(tuning.gentle ? { kind: "fade", seconds: 0.45 } : { kind: "tape-stop", seconds: P.tapeStop, rewind: P.rewind ? st.recent.slice().reverse().map((r) => ({ ...r, midi: r.midi + 12 })) : [] });
        if (P.dropOnFall) st.dropped = true;
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
    // The bar the score restarts on is not a clean bar yet (a beacon on a
    // downbeat used to heal the fall on its first tick).
    st.lastBar = barOf(Math.round(target));
    st.barErrors = 0;
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
    /** A fresh song (restart chapter, title): stopped, in tune, bar 1 next. */
    reset() {
      reset();
      transport.stop();
      tuning.apply("restart");
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
    /** The level's chord at a score position, and a world x's position. */
    chordAt,
    placePos,
    preset: P,
    /** After the engine silenced the bed (a reset), voice it again next tick. */
    revoice() {
      st.lastChord = null;
    },
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
