/* The automatic end-of-level transition (RESEARCH_TRANSITIONS §2-3), the
 * Node half of T5, T7, T8 and T9: the beat plan, the tally's numbers, the
 * save (version 3) and reduced motion. The browser half (real keys, skip,
 * pause, layouts and frame time) runs in common/tests/browser.mjs. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createGame, start, update, snapshot, jump, releaseJump, dash, dive } from "../model.mjs";
import { LEVELS, writeSave as writeSaveV2 } from "../level.mjs";
import { transitionPlan, frameAt, phaseAt, countUp, readSave, writeSave, recordWin, journeyOf, tallyOf, endingLine, CREDITS } from "../transition.mjs";
import { playRoute } from "./routes.mjs";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const pairs = LEVELS.slice(0, -1).map((d, i) => [d, LEVELS[i + 1]]);

test("T5: every transition's beats are monotonic, B4 = A0 + 4b + 4c, 3.8-5.3 s at pace 1 (within 1.25x under Gentle pace)", () => {
  for (const [a, b] of pairs)
    for (const pace of [1, 0.8]) {
      const p = transitionPlan({ bpmFrom: a.bpm, bpmTo: b.bpm, pace });
      const beats = [...p.A.slice(0, 5), ...p.B.slice(1, 5)];
      for (let i = 1; i < beats.length; i++) assert.ok(beats[i] > beats[i - 1], `${a.numeral}→${b.numeral}`);
      assert.ok(Math.abs(p.B[4] - (4 * p.b + 4 * p.c)) < 1e-9);
      assert.equal(p.B[0], p.A[4], "A4 is B0: the swap");
      const one = transitionPlan({ bpmFrom: a.bpm, bpmTo: b.bpm }).total;
      if (pace === 1) assert.ok(one >= 3.8 && one <= 5.3, `${a.numeral}→${b.numeral}: ${one.toFixed(2)} s`);
      else assert.ok(p.total > one && p.total <= one * 1.25 + 1e-9, `${a.numeral}→${b.numeral} Gentle: ${p.total.toFixed(2)} s`);
      // The lockout is one beat; phases run door → space → arrive → null.
      assert.equal(p.lockout, p.b);
      const seen = [];
      for (let t = 0; t <= p.total + 0.05; t += 0.01) if (seen.at(-1) !== phaseAt(p, t)) seen.push(phaseAt(p, t));
      assert.deepEqual(seen, ["door", "space", "arrive", null]);
    }
  // I → II at 88 → 94 BPM is 5.28 s (the spec's table).
  assert.ok(Math.abs(transitionPlan({ bpmFrom: 88, bpmTo: 94 }).total - 5.28) < 0.01);
  // The ending: about 13 bars with credits, 5 without (24.4 / 9.4 s at 128 BPM).
  const first = transitionPlan({ bpmFrom: 128, last: true, credits: true }),
    later = transitionPlan({ bpmFrom: 128, last: true, credits: false });
  assert.ok(Math.abs(first.total - 13 * first.bar) < 1e-9 && Math.abs(first.total - 24.4) < 0.1, `${first.total}`);
  assert.ok(Math.abs(later.total - 5 * later.bar) < 1e-9 && Math.abs(later.total - 9.4) < 0.05);
  assert.equal(first.cards, CREDITS.length);
  assert.equal(first.tallyAt, first.A[8], "the final tally on bar 2");
});

test("T5/T9: the picture follows the beats; at B4 the new world is the run's identity; reduced motion keeps the beats and drops the motion", () => {
  for (const [a, b] of pairs) {
    const p = transitionPlan({ bpmFrom: a.bpm, bpmTo: b.bpm });
    const end = frameAt(p, p.B[4] - 1e-9);
    assert.ok(Math.abs(end.push - 1) < 1e-6 && end.newWorld > 0.999, "nothing moves when control begins");
    assert.ok(Math.abs(frameAt(p, p.A[3]).zoom - 0.55) < 1e-9, "pulled back to 0.55 at A3");
    assert.equal(frameAt(p, p.A[0]).zoom, 1);
    assert.equal(frameAt(p, p.B[2] - 0.001).newBody.u < 1, true);
    assert.equal(frameAt(p, p.B[2]).newBody.u, 1, "the new body is home at B2");
    assert.equal(frameAt(p, p.A[3]).world, 0, "only space is left at A3");
    // Skip opens one beat after the door.
    assert.ok(frameAt(p, p.A[1] - 0.01).controls && !frameAt(p, p.A[1] + 0.01).controls);
    let firstVisible = null;
    for (let t = 0; t <= p.total; t += 1 / 120) {
      const f = frameAt(p, t, { reduced: true }),
        full = frameAt(p, t);
      assert.equal(f.phase, full.phase, "the same beat timeline");
      assert.equal(f.zoom, 1, "no zoom");
      assert.equal(f.push, 1, "no push-in");
      assert.ok(f.newBody.u === 1 && (f.oldBody.u === 0 || f.oldBody.u === 1), "bodies at their end boxes");
      assert.equal(f.motes, false, "no motes");
      assert.deepEqual(f.rings, []);
      assert.equal(f.skyTravel, 0);
      if (f.tally > 0 && firstVisible == null) firstVisible = f;
    }
    assert.equal(firstVisible.count, 1, "the tally is final on its first visible frame");
  }
  const e = transitionPlan({ bpmFrom: 128, last: true, credits: true });
  for (let t = 0; t <= e.total; t += 0.05) {
    const f = frameAt(e, t, { reduced: true });
    assert.equal(f.zoom, 1);
    assert.equal(f.earth, 1, "the ending's Earth is static");
    assert.equal(f.moonSink, 1);
  }
  assert.ok(Math.abs(frameAt(e, e.A[5]).zoom - 0.35) < 1e-9, "the ending pulls back deeper");
});

test("count-up: at most 12 integer steps from the old total to the new", () => {
  for (const [from, to] of [[0, 5], [10, 58], [58, 58], [3, 200]]) {
    const values = new Set();
    for (let u = 0; u <= 1.0001; u += 0.001) values.add(countUp(from, to, u));
    assert.ok(values.size <= 13, `${from}→${to}: ${values.size}`);
    assert.equal(countUp(from, to, 0), from);
    assert.equal(countUp(from, to, 1), to);
  }
});

/** Two falls before the first beacon (a skipped required press is a fall
 * too; here the floor is simply taken away), then the main route. */
function runWithFalls(level, falls) {
  const s = start(createGame(2021, { level }));
  let deaths = 0,
    seen = 0;
  const count = () => {
    for (const e of s.events) if (e.serial > seen) ((seen = e.serial), e.name === "death" && deaths++);
  };
  for (let k = 0; k < falls; k++) {
    s.player.y = 2400;
    for (let i = 0; i < 1200 && s.status !== "running"; i++) (update(s, 1 / 120, {}), count());
    update(s, 1 / 120, {});
    count();
    for (let i = 0; i < 600 && s.status !== "running"; i++) (update(s, 1 / 120, {}), count());
  }
  const api = {
    getState: () => snapshot(s),
    step: (dt, c) => (update(s, dt, c), count(), snapshot(s)),
    jump: () => jump(s),
    releaseJump: () => releaseJump(s),
    dash: () => dash(s),
    dive: () => dive(s),
    tap: () => (jump(s), releaseJump(s)),
  };
  playRoute(api, { route: "main" });
  return { s, deaths };
}
test("T7: the tally after scripted falls and stars; replays add only improvements, falls only add up", () => {
  const d = LEVELS[0];
  const { s, deaths } = runWithFalls(1, 2);
  assert.equal(s.status, "won");
  assert.equal(s.deaths, 2);
  assert.equal(deaths, 2, "two death events (each written to the save's falls)");
  // An earlier save: II done with 30 stars and 2 Great Stars, 5 falls.
  const save = readSave({ v: 3, unlocked: 2, great: { gift: 2 }, done: { gift: true }, stars: { gift: 30 }, falls: 5, credits: false });
  save.falls += deaths;
  const run = { stars: s.stars, total: s.pickups.filter((q) => !q.great).length, great: s.greatBanked.length, falls: s.deaths };
  const { before, after } = recordWin(save, { level: 1, stars: run.stars, great: run.great });
  const tally = tallyOf(d, run, after, LEVELS[1]);
  assert.deepEqual({ stars: tally.level.stars, total: tally.level.total, great: tally.level.great, falls: tally.level.falls }, { stars: s.stars, total: run.total, great: s.greatBanked.length, falls: 2 });
  assert.equal(after.falls, 7);
  assert.equal(after.stars, 30 + run.stars);
  assert.equal(after.great, 2 + run.great);
  assert.equal(before.stars, 30);
  assert.equal(after.greatTotal, 3 * LEVELS.length);
  assert.match(tally.say, new RegExp(`^I · Waking complete\\. ${run.stars} of ${run.total} stars, ${run.great} of 3 Great Fallen Stars, 2 falls\\. Journey: ${after.stars} stars, ${after.great} of ${after.greatTotal} Great Fallen Stars, 7 falls\\. Next: II · The Gift\\.$`));
  // A replay with fewer stars changes nothing; one with more adds exactly the difference.
  const worse = recordWin(save, { level: 1, stars: run.stars - 3, great: 0 });
  assert.equal(worse.after.stars, after.stars);
  const better = recordWin(save, { level: 1, stars: run.stars + 4, great: 0 });
  assert.equal(better.after.stars - better.before.stars, 4);
  assert.equal(tallyOf(d, { ...run, falls: 1 }, after).falls, "1 fall");
  assert.match(endingLine({ great: 21, greatTotal: 21 }), /remembered every star/);
  assert.match(endingLine({ great: 4, greatTotal: 21 }), /She was home/);
});

test("T8: save version 3 round-trips; v2 and v1 migrate without loss; unknown fields are tolerated", () => {
  const v2 = writeSaveV2({ unlocked: 3, great: { 1: 2, 2: 3 }, done: { 1: true, 2: true } });
  assert.equal(v2.v, 2);
  const m = readSave(v2);
  assert.deepEqual(m, { unlocked: 3, great: { 1: 2, 2: 3 }, done: { 1: true, 2: true }, stars: {}, falls: 0, credits: false, relics: [] });
  const v3 = writeSave({ ...m, stars: { 1: 24, 2: 41 }, falls: 17, relics: ["double"] });
  assert.deepEqual(v3, { v: 3, unlocked: 3, great: { waking: 2, gift: 3 }, done: { waking: true, gift: true }, stars: { waking: 24, gift: 41 }, falls: 17, credits: false, relics: ["double"] });
  const back = readSave(JSON.parse(JSON.stringify({ ...v3, extra: { anything: 1 } })));
  assert.deepEqual(back, { unlocked: 3, great: { 1: 2, 2: 3 }, done: { 1: true, 2: true }, stars: { 1: 24, 2: 41 }, falls: 17, credits: false, relics: ["double"] });
  assert.deepEqual(journeyOf(back), { stars: 65, great: 5, greatTotal: 3 * LEVELS.length, falls: 17 });
  // v1: the numeral stays, the stars reset; garbage starts fresh.
  assert.equal(readSave({ unlocked: 2, great: { 1: 3 } }).unlocked, 2);
  assert.deepEqual(readSave({ unlocked: 2, great: { 1: 3 } }).great, {});
  assert.deepEqual(readSave("nonsense"), { unlocked: 1, great: {}, done: {}, stars: {}, falls: 0, credits: false, relics: [] });
  assert.equal(readSave({ v: 3, unlocked: 2, falls: -4, stars: { waking: "x" } }).falls, 0);
  // The renderer writes the completion at the door (A0) and each fall at its death event.
  return read("game.js").then((js) => {
    assert.match(js, /const \{ before, after \} = recordWin\(book, \{ level: n, stars: run\.stars, great: run\.great \}\);\n  if \(!preview\) \{\n    writeProgress\(\);/);
    assert.match(js, /progress\.falls = \(progress\.falls \?\? 0\) \+ 1;\n        writeProgress\(\);/);
    assert.match(js, /credits: last && !book\.credits/);
  });
});
