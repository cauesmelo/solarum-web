/** v1.0 release: no oscillator is ever asked for a frequency outside Web
 * Audio's nominal range. Chrome clamps such a value and logs a warning on
 * every call; levels II, VI, VII and VIII logged "Oscillator.frequency
 * .setValueAtTime value 24657-32896 outside nominal range [-22050, 22050]"
 * because the star glass's tiny bell (two octaves over a high melody note) put
 * its 3.5x FM modulator above Nyquist. The test runs every level's routes
 * through the real engine on a strict stand-in (which records each oscillator's
 * frequency automation) and sweeps every voice and cue recipe over the whole
 * musical range, so a new bell or a higher melody cannot bring it back. */
import test from "node:test";
import assert from "node:assert/strict";
import { createAudioEngine, VOICES, TUNE_VOICES, VOICES_REV8, CUES, BODY_REV8, OSC_MAX_HZ, mulberry32, midiHz } from "../audio.mjs";
import { CHORDS } from "../score.mjs";
import { createGame, start as startGame, update, jump, releaseJump, dash, dive } from "../model.mjs";
import { createRouteMemory, chooseAction } from "./routes.mjs";
import { LEVELS } from "../level.mjs";
import { MockContext } from "./webaudio-mock.mjs";

/** One route of one level through the engine, as game.js drives it (60 fps on
 * a fake audio clock). Returns every oscillator the engine started. */
function oscillatorsOf(level, route) {
  let now = 0,
    ctx = null;
  class AC extends MockContext {
    constructor() {
      super();
      ctx = this;
    }
  }
  const engine = createAudioEngine({ AudioContext: AC, seed: 3, pauseFade: 0, level, clock: () => now });
  const s = createGame(2021, { level });
  let seen = s.eventSerial;
  const flush = () => {
    for (const e of s.events) if (e.serial > seen) (seen = e.serial), engine.event(e, { timeScale: s.clock });
  };
  engine.unlock();
  startGame(s);
  flush();
  const m = createRouteMemory(route);
  const dt = s.clock / 60;
  for (let i = 0; i < 100 / dt && s.status !== "won"; i++) {
    const a = chooseAction(s, m);
    if (a) ({ jump, releaseJump, dash, dive, tap: (g) => (jump(g), releaseJump(g)) })[a](s), flush();
    update(s, dt, { glide: m.glide });
    now += 1 / 60;
    flush();
    engine.scoreFrame({ simTime: s.time, x: s.player.x, y: s.player.y, status: s.status, timeScale: s.clock, inWind: s.player.inWind, gliding: s.player.gliding, fallsHere: s.fallsHere });
  }
  return { oscillators: ctx.starts.filter((o) => o.kind === "osc"), won: s.status === "won" };
}

/** Which notes the engine really hands each voice recipe: every route below
 * runs with the recipes' `build` wrapped to record the midi, chord and glide
 * target it receives (restored afterwards). The recipe sweep then covers each
 * voice's own register, because a landing's bowl and a star's glass live in
 * different octaves and a blind sweep of every voice at every note tests notes
 * nobody plays. */
const played = new Map(); // "VOICES.glass" -> { lo, hi }
function observing(run) {
  const restore = [];
  for (const [setName, set] of Object.entries({ VOICES, TUNE_VOICES, VOICES_REV8 }))
    for (const [name, v] of Object.entries(set)) {
      const original = v.build;
      v.build = (rng, n = {}) => {
        const notes = [n.midi, n.glideTo, ...(n.midis ?? [])].filter(Number.isFinite);
        if (notes.length) {
          const seen = played.get(`${setName}.${name}`) ?? { lo: Infinity, hi: -Infinity };
          played.set(`${setName}.${name}`, { lo: Math.min(seen.lo, ...notes), hi: Math.max(seen.hi, ...notes) });
        }
        return original(rng, n);
      };
      restore.push(() => (v.build = original));
    }
  try {
    return run();
  } finally {
    restore.forEach((r) => r());
  }
}

test("every level's routes keep every oscillator inside +-Nyquist of a 44.1 kHz context (no clamped-frequency warning)", () => {
  assert.equal(OSC_MAX_HZ, 22050);
  assert.ok(LEVELS.filter((d) => !d.interim).length >= 8, "all eight levels are checked");
  let checked = 0;
  for (const d of LEVELS.filter((q) => !q.interim))
    // main is the route the score is baked on; upper adds the Great Stars'
    // lines, which reach the highest melody notes.
    for (const route of ["main", "upper"]) {
      const { oscillators, won } = observing(() => oscillatorsOf(d.id, route));
      assert.ok(won, `${d.key} ${route} reaches the door`);
      assert.ok(oscillators.length > 500, `${d.key} ${route}: ${oscillators.length} oscillators`);
      let top = 0;
      for (const o of oscillators)
        for (const e of o.frequency.events) {
          top = Math.max(top, Math.abs(e.v));
          assert.ok(Math.abs(e.v) <= OSC_MAX_HZ, `${d.key} ${route}: an oscillator frequency of ${e.v.toFixed(0)} Hz at t=${e.t.toFixed(2)} (a ${o.type})`);
        }
      assert.ok(top > 1000, `${d.key} ${route}: the highest oscillator is ${top.toFixed(0)} Hz (the scan saw the bells)`);
      checked += oscillators.length;
    }
  assert.ok(checked > 10000, `${checked} oscillators`);
});

/** Every frequency a layer asks an oscillator for: automation points, an FM
 * carrier and its modulator, a choir's notes and a glide's target. */
function layerHz(L) {
  const out = (L.freq ?? []).map((p) => p[1]);
  if (L.hz != null) out.push(L.hz);
  if (L.kind === "fm") out.push(L.hz * L.ratio);
  if (L.kind === "choir") for (const m of L.midis ?? [L.midi]) out.push(midiHz(m + (L.cents ?? 0) / 100));
  if (L.midiEnd != null) out.push(midiHz(L.midiEnd + (L.cents ?? 0) / 100));
  return out;
}
const SETS = { VOICES, TUNE_VOICES, VOICES_REV8, CUES, BODY_REV8 };
/** A margin over the highest note a voice is given in the routes above: a
 * retuned level or a higher star (starMidi tops out at F#6, midi 90) must not
 * bring the warning back. */
const MARGIN = 6;

test("every voice recipe stays in range over its own register plus a margin, with and without a glide", () => {
  assert.ok(played.size >= 10, `the routes exercised ${played.size} voices`);
  let layers = 0;
  for (const [key, { lo, hi }] of played) {
    const [setName, name] = key.split(".");
    const v = SETS[setName][name];
    for (let m = Math.floor(lo) - 2; m <= hi + MARGIN; m++)
      for (const extra of [{}, { glideTo: m + 7, glide: 0.38 }, { chord: CHORDS.D }]) {
        const spec = v.build(mulberry32(m), { midi: m, midis: [m, m + 4, m + 7], dur: 0.6, ...extra });
        for (const L of spec.layers)
          for (const f of layerHz(L)) {
            assert.ok(Number.isFinite(f) && f <= OSC_MAX_HZ, `${key} at midi ${m}: a ${L.kind} layer asks for ${f.toFixed(0)} Hz`);
            layers++;
          }
      }
  }
  assert.ok(layers > 3000, `${layers} frequencies checked`);
  // Cues are not driven by a note: every one is built over a few parameter sets.
  for (const set of [CUES, BODY_REV8])
    for (const [name, c] of Object.entries(set))
      for (let seed = 1; seed <= 4; seed++)
        for (const L of c.build(mulberry32(seed), { step: seed * 3, index: seed, count: 5 + seed, earth: seed % 2 === 0, chord: CHORDS.D, verb: "glide" }).layers)
          for (const f of layerHz(L)) assert.ok(f <= OSC_MAX_HZ, `cue ${name}: ${f.toFixed(0)} Hz`);
});

test("only a modulator past Nyquist moves: in-range bells keep their ratio, a folded one keeps its index", () => {
  // Star glass on a mid melody note: the three layers keep their authored ratios.
  const mid = VOICES.glass.build(mulberry32(1), { midi: 74 }).layers;
  assert.deepEqual(mid.map((L) => L.ratio), [4, 1.4, 3.5]);
  // On B6 (midi 95) the tiny bell sits at B8 (7.9 kHz) and its 3.5x modulator
  // would be 27.7 kHz: it drops one octave (1.75x, 13.8 kHz), the sideband strength
  // (the index automation) and the carrier are untouched, the other two layers
  // keep their ratios.
  const high = VOICES.glass.build(mulberry32(1), { midi: 95 }).layers;
  assert.deepEqual(high.map((L) => L.ratio), [4, 1.4, 1.75]);
  assert.ok(Math.abs(high[2].hz - midiHz(119)) / midiHz(119) < 0.002, "the bell is still two octaves above the note");
  assert.deepEqual(high[2].index, mid[2].index, "the index, not the depth in Hz, is what the recipe sets");
  assert.ok(high[2].hz * high[2].ratio < OSC_MAX_HZ);
  // The fold is by octaves and only as far as needed: no modulator ends up
  // below half of the limit unless the authored one already was.
  for (let m = 24; m <= 100; m++)
    VOICES.glass.build(mulberry32(m), { midi: m }).layers.forEach((L, i) => {
      const authored = L.hz * [4, 1.4, 3.5][i];
      const folded = L.hz * L.ratio;
      assert.ok(folded <= OSC_MAX_HZ);
      if (authored > OSC_MAX_HZ) assert.ok(folded > OSC_MAX_HZ / 2, `midi ${m}: folded to ${folded.toFixed(0)} Hz`);
      else assert.equal(folded, authored, `midi ${m}: an in-range modulator is left alone`);
    });
});
