/** Revision eight's mix (README, "The constant tone"): the sky is air, the
 * shimmer no longer drones, a real soundtrack plays under Diana's notes on her
 * grid, pause still silences everything, nothing clips. Engine tests run on a
 * strict Web Audio stand-in; the loudness rules run on the measurement
 * scripts/mix-check.mjs makes in Chrome (tests/mix-measured.json), which must
 * be fresh. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAudioEngine, VOICES, TUNE_VOICES, SKY_SAWS, MIX, MIX_REV7, mulberry32, midiHz, safetyCurve, cuesForEvent, CUES } from "../audio.mjs";
import { SIXTEENTH, SCORES, CHORDS } from "../score.mjs";
import { createGame, start as startGame, update, jump, releaseJump, dash, dive } from "../model.mjs";
import { createRouteMemory, chooseAction } from "./routes.mjs";
import { LEVELS } from "../level.mjs";
import { MockContext } from "./webaudio-mock.mjs";
import { mixSignature } from "./mix-signature.mjs";
import { rules } from "./mix-rules.mjs";

/** A whole main route through the real engine at 60 fps on a fake audio
 * clock (as game.js drives it), recording where every score note landed. */
function run(level, { pauseAt = null, mix } = {}) {
  let now = 0,
    ctx = null;
  class AC extends MockContext {
    constructor() {
      super();
      ctx = this;
    }
  }
  const notes = [];
  const engine = createAudioEngine({ AudioContext: AC, seed: 3, pauseFade: 0, level, mix, clock: () => now, trace: (n) => notes.push({ ...n, wall: now }) });
  const s = createGame(2021, { level });
  let seen = s.eventSerial;
  const flush = () => {
    for (const e of s.events) if (e.serial > seen) (seen = e.serial), engine.event(e, { timeScale: s.clock });
  };
  engine.unlock();
  startGame(s);
  flush();
  const m = createRouteMemory("main");
  const dt = s.clock / 60;
  let paused = null;
  for (let i = 0; i < 100 / dt && s.status !== "won"; i++) {
    if (pauseAt != null && s.time >= pauseAt && !paused) {
      engine.setPaused(true);
      const before = { nodes: engine.stats().nodes, notes: notes.length };
      for (let k = 0; k < 90; k++) {
        now += 1 / 60; // wall time moves, the simulation does not
        engine.scoreFrame({ simTime: s.time, x: s.player.x, y: s.player.y, status: "paused", timeScale: s.clock });
      }
      paused = { before, after: { nodes: engine.stats().nodes, notes: notes.length }, state: ctx.state };
      engine.setPaused(false);
    }
    const a = chooseAction(s, m);
    if (a) ({ jump, releaseJump, dash, dive, tap: (g) => (jump(g), releaseJump(g)) })[a](s), flush();
    update(s, dt, { glide: m.glide });
    now += 1 / 60;
    flush();
    engine.scoreFrame({ simTime: s.time, x: s.player.x, y: s.player.y, status: s.status, timeScale: s.clock, inWind: s.player.inWind, gliding: s.player.gliding, fallsHere: s.fallsHere });
  }
  return { s, engine, notes, paused, stats: engine.stats(), ctx };
}

test("the sky is air: filtered noise only, no saw or oscillator, nothing held on top, kept out of the shimmer", () => {
  for (let seed = 1; seed <= 4; seed++)
    for (const name of Object.keys(CHORDS)) {
      const spec = VOICES.pad.build(mulberry32(seed), { midis: CHORDS[name].pad, dur: 2.2 });
      assert.equal(spec.send, 0, "the sky never feeds the space or its shimmer");
      assert.ok(!spec.grouped, "no oscillator bus");
      for (const L of spec.layers) {
        assert.equal(L.kind, "noise", `${name}: noise only`);
        const f = L.filter.freq,
          top = Array.isArray(f) ? Math.max(...f.map((p) => p[1])) : f;
        // A tuned breath sits an octave under the chord's voicing, broad enough to be air.
        if (L.band != null) assert.ok(top <= midiHz(66) && L.filter.q <= 8, `${name}: breath at ${top.toFixed(0)} Hz, Q ${L.filter.q}`);
        else assert.ok(L.filter.q <= 1, "the wind bands are broad");
        // Gusts: every layer's level moves within the bar (no steady tone).
        assert.ok(L.env.length >= 4 && new Set(L.env.slice(1, -1).map((p) => p[1].toFixed(3))).size >= 2, `${name}: a level that wanders`);
      }
    }
  // The saws stay only for the soundboard's A/B.
  assert.ok(SKY_SAWS.build(mulberry32(1), {}).layers.some((L) => L.wave === "sawtooth"));
  assert.equal(MIX.sky, "air");
  assert.equal(MIX_REV7.sky, "saws");
});

test("the soundtrack's voices all decay: none is held, none is a saw, all follow the world's tuning", () => {
  for (const [name, v] of Object.entries(TUNE_VOICES)) {
    const spec = v.build(mulberry32(2), { midi: 64, dur: 0.6 });
    assert.ok(spec.tune === "lead" || spec.tune === "rest", `${name} routes to the soundtrack bus`);
    assert.ok(spec.dur <= 0.6 + 1.3, `${name} rings at most ${spec.dur.toFixed(2)} s`);
    for (const L of spec.layers) assert.notEqual(L.wave, "sawtooth", name);
  }
});

test("mix rules: half the shimmer's feedback and 6 dB off its return, the whistle a breath, the soundtrack under Diana and ducking for her", () => {
  assert.ok(MIX.shimmer <= 0.5 && MIX.shimmerOut <= -6);
  assert.ok(MIX.whistle.tone <= 0.012 && MIX.whistle.air > 0 && MIX.whistle.q <= 16, "the glide whistle is mostly breath");
  assert.ok(MIX.sing.q <= 16 && MIX.sing.gain < 9, "the wind column sings softer and broader");
  assert.ok(MIX.tune < 0 && MIX.tune + MIX.tuneWet < MIX.tune && MIX.leadDuck >= 3);
  assert.ok(MIX.door < 0, "the door blooms lower");
  assert.ok(MIX.air.glide < 0.052 && MIX.air.wind < 0.088);
  assert.equal(MIX_REV7.tune, null, "the A/B's old bed has no soundtrack");
  // No clipping by construction: a fast -3 dBFS limiter (ratio 20), then a
  // safety curve that never leaves [-1, 1].
  const curve = safetyCurve();
  assert.ok(Math.max(...curve.map(Math.abs)) <= 1);
});

test("the relic's banner: a soft chime that follows the chord, from { type: 'relic', verb }", () => {
  assert.deepEqual(cuesForEvent({ type: "relic", verb: "dive" }), [{ cue: "relic", params: { verb: "dive" } }]);
  assert.deepEqual(cuesForEvent({ name: "relic", verb: "glide" }), [{ cue: "relic", params: { verb: "glide" } }]);
  const spec = CUES.relic.build(mulberry32(1), { chord: CHORDS.Bm, verb: "cape" });
  assert.ok(spec.gain < CUES["great-banked"].build(mulberry32(1), {}).gain, "softer than a Great Star kept");
  for (const L of spec.layers) if (L.kind === "fm") assert.ok(CHORDS.Bm.safe.includes(Math.round(12 * Math.log2(L.hz / 440) + 69) % 12), "on the chord");
  assert.equal(CUES.relic.duck, undefined, "it never pumps the music");
});

test("the soft landing rises over at least 15 ms and spreads its energy", () => {
  for (let seed = 1; seed <= 5; seed++)
    for (const L of CUES["land-soft"].build(mulberry32(seed), {}).layers) {
      assert.ok(L.env[1][0] >= 0.015, `attack ${L.env[1][0]} s`);
      assert.ok(L.env.at(-1)[0] >= 0.15, "it settles over 150 ms or more");
    }
});

test("tempo lock: every soundtrack note lands on the level's sixteenth grid, in step with Diana's on-grid notes, never late", () => {
  for (const d of LEVELS) {
    const r = run(d.id);
    assert.equal(r.s.status, "won", `L${d.id} won`);
    const tune = r.notes.filter((n) => n.layer === "tune");
    assert.ok(tune.length > 100, `L${d.id}: ${tune.length} soundtrack notes`);
    assert.equal(r.stats.tune.lateNotes, 0, `L${d.id}: no soundtrack note was scheduled late`);
    // The audio sixteenth at the level's tempo (60 / bpm / 4): every note's
    // grid time (its want, minus the 15 ms the bed and the song sit late) is
    // a whole number of sixteenths from any other, and from Diana's
    // quantised ("on" or "snap") notes.
    const s16 = 60 / SCORES[d.id].bpm / 4;
    assert.ok(Math.abs(s16 - SIXTEENTH / r.s.clock) < 1e-9);
    const grid = tune.map((n) => n.want - 0.015);
    const ref = grid[0];
    let worst = 0;
    for (const g of grid) worst = Math.max(worst, Math.abs(((g - ref) / s16) - Math.round((g - ref) / s16)) * s16);
    // (A note taken just after its grid point plays at once, off the grid by design: only whole positions count.)
    const hers = r.notes.filter((n) => (n.layer === "stars" || n.layer === "strings" || n.layer === "steps") && Math.abs(n.pos - Math.round(n.pos)) < 1e-6 && n.want === n.at);
    assert.ok(hers.length >= 5, `L${d.id}: ${hers.length} of her notes on the grid`);
    for (const n of hers) worst = Math.max(worst, Math.abs(((n.want - ref) / s16) - Math.round((n.want - ref) / s16)) * s16);
    // The clock map slews small drift at 1% of tempo; the grid stays within 4 ms.
    assert.ok(worst <= 0.004, `L${d.id}: ${(worst * 1000).toFixed(2)} ms off the grid`);
    assert.ok(r.stats.tune.peakVoices <= 16, `L${d.id}: ${r.stats.tune.peakVoices} soundtrack voices`);
    assert.ok(r.stats.score.peakVoices <= 28, "the score's own budget is untouched");
  }
});

test("pause silence: while paused no soundtrack or score note is scheduled and no node is made; the run continues in place", () => {
  const r = run(2, { pauseAt: 20 });
  assert.ok(r.paused, "paused once");
  assert.equal(r.paused.state, "suspended", "the context is suspended");
  assert.equal(r.paused.after.notes, r.paused.before.notes, "no note while paused");
  assert.equal(r.paused.after.nodes, r.paused.before.nodes, "no node while paused");
  assert.equal(r.s.status, "won");
  assert.ok(r.notes.some((n) => n.layer === "tune" && n.wall > 21), "the song continues after Continue");
});

test("the A/B's old bed (rev7) plays no soundtrack", () => {
  const old = run(1, { mix: "rev7" });
  assert.equal(old.notes.filter((n) => n.layer === "tune").length, 0);
  assert.equal(old.stats.tune, null);
});

test("the measured mix holds every rule on every level, and the measurement is fresh", async (t) => {
  const fixture = JSON.parse(await readFile(new URL("./mix-measured.json", import.meta.url), "utf8"));
  assert.equal(fixture.signature, mixSignature(), "the mix changed since it was measured: run `node scripts/mix-check.mjs`");
  for (const d of LEVELS) {
    const row = fixture.levels[d.id];
    if (!row || row.key !== d.key) {
      // A level added since the measurement (another squad's merge): say so, do not fail.
      t.diagnostic(`level ${d.id} (${d.key}) is not in tests/mix-measured.json yet`);
      continue;
    }
    for (const [name, ok] of rules(row.after, row)) assert.ok(ok, `L${d.id} ${d.key}: ${name} (${JSON.stringify(row.after)})`);
    // Before / after: the sky fell, the constant wash shortened.
    assert.ok(row.after.sky <= row.before.sky - 10, `L${d.id}: the sky is at least 10 dB softer than the saws were`);
    assert.ok(row.before.skyPartials > 20 && row.after.skyPartials <= 2, "a reedy tone before, air after");
  }
});
