/** RESEARCH_PROGRESSION 8 for the built stages (I · Waking, II · The Gift):
 * unlocks (U1, U3, U5), the cape's breath on real routes (C1-C4), the level
 * rules (L2, L4, L5, L8), the GET spacing of section 7, M1 on Diana's own
 * notes and the save migration. Every route winning at 30-240 Hz, the grid,
 * windows, glyphs, lookahead, beacons and the step-up sweep are the per-level
 * tests in model.test.mjs, movement-audit.test.mjs and score.test.mjs. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createGame, start, update, jump, releaseJump, dash, dive, snapshot, retry, restart, setAssist, capeReady, TICK } from "../model.mjs";
import { CAMPAIGN, LEVELS, levelDef, createLevel, gx, readSave, writeSave, SAVE_VERSION } from "../level.mjs";
import { playRoute, chooseAction, createRouteMemory } from "./routes.mjs";
import { nominalRun, replayShifted, timingWindow } from "../scripts/movement-audit.mjs";
import { musicRun } from "./music-run.mjs";
import { LAYERS } from "../score.mjs";

const SIX = 15 / 107;
const BUILT = LEVELS.filter((d) => !d.interim);
const [I, II] = BUILT;
function api(s, hooks = {}) {
  return {
    getState: () => snapshot(s),
    step: (dt, c) => (update(s, dt, c), hooks.step?.(s), snapshot(s)),
    jump: () => jump(s),
    releaseJump: () => releaseJump(s),
    dash: () => {
      const ready = capeReady(s) && s.verbs.cape;
      const ok = dash(s);
      hooks.dash?.(s, ready, ok);
      return ok;
    },
    dive: () => dive(s),
    tap: () => (jump(s), releaseJump(s)),
  };
}
const game = (def, o = {}) => start(createGame(2021, { def, ...o }));
const run = (def, route = "main", dt = 1 / 120, hooks, o) => {
  const s = game(def, o);
  const r = playRoute(api(s, hooks), { route, dt });
  return { s, r };
};
/** Real seconds of simulation. */
const real = (d, simS) => simS / d.clock;

/* ---------- unlocks ---------- */
test("U1: each built stage starts with its own verbs and its GET fires on every route at 30/60/120/240 Hz", () => {
  assert.deepEqual(I.verbs, { double: false, cape: false, glide: false, dive: false, super: false });
  assert.deepEqual(II.verbs, { double: true, cape: false, glide: false, dive: false, super: false });
  assert.deepEqual(BUILT.map((d) => d.gets.map((g) => g.verb)), [["double"], ["cape"]]);
  for (const d of BUILT)
    for (const route of ["main", "upper", "ability", "safe"])
      for (const hz of [30, 60, 120, 240]) {
        const { s } = run(d, route, 1 / hz);
        const where = `${d.numeral} ${route} ${hz} Hz`;
        assert.equal(s.status, "won", where);
        for (const g of d.gets) {
          assert.ok(s.gotten.includes(g.id), `${where}: ${g.id}`);
          assert.equal(s.verbs[g.verb], true, where);
        }
      }
});
test("U3: without its GET the route wins up to the first required use and dies exactly there, after its beacon", () => {
  // I's main route (its safe double under the key costs nothing) dies at the
  // leap; II's safe line (no cape over the first gap) dies at the hearth void.
  for (const [d, route, beacon, lo, hi] of [
    [I, "main", "first-star", gx(152), gx(168)],
    [II, "safe", "gift", 220 + 37.85 * 68 + 113.55, 220 + 37.85 * 80 + 113.55],
  ]) {
    const { s } = run({ ...d, gets: [] }, route);
    assert.equal(s.status, "dead", d.numeral);
    assert.equal(s.checkpoint?.id, beacon, `${d.numeral}: after its beacon`);
    assert.ok(s.player.x > lo && s.player.x < hi, `${d.numeral} fell at ${s.player.x.toFixed(0)}`);
    const before = d.checkpoints.filter((c) => c.x < s.player.x).map((c) => c.id);
    assert.deepEqual(s.checkpointsReached, before, `${d.numeral}: every beacon before the use is reached`);
  }
});
test("U5: level I opened with every stage unlocked has no cape and no double jump before its GET (bar 8)", async () => {
  const s = start(createGame(2021, { level: 1 }));
  const m = createRouteMemory("main");
  let checked = 0;
  while (s.status === "running" && s.player.x < I.gets[0].x - 1) {
    const a = chooseAction(snapshot(s), m);
    if (a) api(s)[a]();
    update(s, 1 / 120);
    if (s.player.x >= I.gets[0].x) break;
    assert.equal(s.verbs.double, false);
    assert.equal(s.verbs.cape, false);
    if (!s.player.grounded && s.coyote <= 0 && s.player.vy < 0 && checked < 20) {
      // An air press only waits in the buffer; the cape button does nothing.
      const probe = start(createGame(2021, { level: 1 }));
      Object.assign(probe.player, { ...s.player });
      probe.coyote = 0;
      probe.player.jumps = 1;
      assert.equal(jump(probe), false);
      assert.equal(dash(probe), false);
      checked++;
    }
  }
  assert.ok(s.player.x >= I.gets[0].x - 2 && checked >= 10, `${checked} air presses probed`);
  assert.ok(I.gets[0].x < gx(128), "the GET is in bar 8");
  // game.js opens a level from its definition only: no progress, unlocked
  // count or later verb reaches createGame.
  const js = await readFile(new URL("../game.js", import.meta.url), "utf8");
  assert.match(js, /function loadLevel\(n\) \{\s*const assist = \{ \.\.\.state\.assist \};\s*Object\.assign\(state, createGame\(state\.seed, \{ level: n, \.\.\.assist \}\)\);/);
});
test("GETs (RESEARCH_PROGRESSION 7): no required input within a bar of one; the first required use comes 2+ bars later, a bar after a beacon, with a glyph", () => {
  for (const d of BUILT) {
    const n = d.id;
    const nom = nominalRun(n);
    // Required: skipping the press fails, and no optional glyph marks it as
    // the safe first use (II's first gap has a floor and a hop back up).
    const optional = d.prompts.filter((q) => q.optional);
    const required = nom.plan.map((step, i) => (step[1] === "glide" || step[1] === "unglide" ? false : !optional.some((q) => step[0] >= q.from && step[0] <= q.to) && !replayShifted(n, nom, i, 0, { skip: true }).ok));
    const at = (i) => nom.steps[i].tick * TICK / SIX; // sixteenth of the press
    for (const g of d.gets) {
      const k = (g.x - d.level.startX) / 270 / SIX; // no flight before either GET
      const kind = g.verb === "double" ? "double-jump" : "dash";
      nom.plan.forEach((_, i) => required[i] && assert.ok(Math.abs(at(i) - k) >= 16 - 1e-6, `${d.numeral} step ${i} at ${at(i).toFixed(1)} is within a bar of ${g.id} (${k.toFixed(1)})`));
      const use = nom.plan.findIndex((_, i) => required[i] && nom.steps[i].kind === kind);
      assert.ok(use >= 0 && at(use) >= k + 32 - 1e-6, `${d.numeral}: first required ${kind} at ${at(use)?.toFixed(1)}`);
      // The use's airtime starts at the ground jump before it.
      const takeoff = nom.plan.slice(0, use).findLastIndex((q) => q[2] === "g");
      const useX = nom.plan[use][0];
      const beacon = d.checkpoints.filter((c) => c.x < useX).at(-1);
      assert.ok(beacon && at(takeoff) - (beacon.x - d.level.startX) / 37.85 <= 16.2, `${d.numeral}: the beacon before the first use (${beacon?.id})`);
      assert.ok(d.prompts.some((q) => !q.optional && q.action === kind && q.from <= useX + 120 && q.to >= useX), `${d.numeral}: a glyph shows the first required ${kind}`);
    }
  }
});

/* ---------- the cape's breath on real routes ---------- */
test("C1: on every II route at 30/60/120/240 Hz, and with each required press shifted to its window's edges, every flight press finds the bar full", () => {
  for (const route of ["main", "upper", "ability", "safe"])
    for (const hz of [30, 60, 120, 240]) {
      const empty = [];
      const { s } = run(II, route, 1 / hz, { dash: (g, ready) => !ready && empty.push(Math.round(g.player.x)) });
      assert.equal(s.status, "won", `${route} ${hz}`);
      assert.deepEqual(empty, [], `II ${route} ${hz} Hz: flight presses on an empty bar`);
    }
  // The timingWindow sweep: each required press at its earliest and latest
  // working tick (the late valid route included), the rest of the route as
  // flown by the pilot.
  const nom = nominalRun(II.id);
  const xs = [];
  {
    const s = game(II);
    const m = createRouteMemory("main");
    while (s.status === "running") {
      xs.push(s.player.x);
      const a = chooseAction(snapshot(s), m);
      if (a) api(s)[a]();
      update(s, TICK);
    }
  }
  let shifted = 0;
  nom.plan.forEach((step, i) => {
    if (step[1] === "glide" || step[1] === "unglide") return;
    const w = timingWindow(II.id, nom, i);
    if (!w.required || !w.works) return;
    for (const d of [w.lo, w.hi]) {
      // Diana's x at the shifted tick: the route's own before the authored
      // press, plain running after it (the press has not happened yet).
      // A person who presses early or late keeps the rhythm of the presses
      // that follow in the same airtime (replayShifted's rule): they move by
      // the same time, which is d ticks of plain running in x.
      const t0 = nom.steps[i].tick;
      const x = d <= 0 ? xs[t0 + d] : xs[t0] + d * 270 * TICK;
      let group = i + 1;
      while (group < nom.plan.length && nom.plan[group][2] !== "g") group++;
      const plan = nom.plan.map((q, j) => (j === i ? [x - 0.01, q[1], "*"] : j > i && j < group ? [q[0] + d * 270 * TICK, q[1], q[2]] : q));
      const empty = [];
      const s = game({ ...II, routes: { ...II.routes, main: plan } });
      playRoute(api(s, { dash: (g, ready) => !ready && empty.push(Math.round(g.player.x)) }), { route: "main" });
      assert.equal(s.status, "won", `step ${i} shifted ${d} ticks`);
      assert.deepEqual(empty, [], `step ${i} shifted ${d} ticks: a flight press on an empty bar`);
      shifted++;
    }
  });
  assert.ok(shifted >= 30, `${shifted} shifted runs`);
});
test("C2: no doomed approach: an optional flight spent in any airtime with a full bar never leaves a required flight empty", () => {
  const nom = nominalRun(II.id);
  // A required flight: skipping it fails, and no optional glyph marks it as
  // the safe first use (that gap has a floor and a hop back up).
  const safeUse = II.prompts.filter((q) => q.optional && q.action === "dash");
  const required = nom.plan.map((step, i) => step[1] === "dash" && !safeUse.some((q) => step[0] >= q.from && step[0] <= q.to) && !replayShifted(II.id, nom, i, 0, { skip: true }).ok);
  // Candidate ticks: on each sixteenth, airborne, the bar full and the next
  // pilot step not a flight (that airtime's own flight is C1's).
  const candidates = [];
  {
    const s = game(II);
    const m = createRouteMemory("main");
    let k = -1;
    for (let t = 0; s.status === "running"; t++) {
      const a = chooseAction(snapshot(s), m);
      if (a) api(s)[a]();
      update(s, TICK);
      const kk = Math.floor(s.time / SIX + 1e-9);
      if (kk !== k && !s.player.grounded && capeReady(s) && s.verbs.cape && nom.plan[m.i]?.[1] !== "dash" && s.dashRemaining <= 0) candidates.push(t);
      k = kk;
    }
  }
  assert.ok(candidates.length >= 8, `${candidates.length} injection points`);
  let survived = 0;
  for (const T of candidates) {
    const s = game(II);
    const m = createRouteMemory("main");
    const empty = [];
    for (let t = 0; s.status === "running" && t < 120 * 120; t++) {
      if (t === T) dash(s);
      const i = m.i;
      const a = chooseAction(snapshot(s), m);
      if (a === "dash") {
        const step = nom.plan.findIndex((q, j) => j >= Math.max(0, i) && q[1] === "dash");
        if (required[step] && !capeReady(s)) empty.push(step);
      }
      if (a) api(s)[a]();
      update(s, TICK);
    }
    assert.deepEqual(empty, [], `an optional flight at tick ${T} doomed step ${empty}`);
    if (s.status === "won") survived++;
  }
  assert.ok(survived >= 1, `${survived} of ${candidates.length} injected runs still win`);
});
test("C3: every respawn in II restores a full bar; Restart starts empty at the GET and breathes it full over one bar", () => {
  for (const cp of II.checkpoints) {
    for (const how of ["fall", "retry", "net"]) {
      const s = game(II, how === "net" ? { starNet: true } : {});
      const m = createRouteMemory("main");
      while (s.status === "running" && !(s.checkpoint?.id === cp.id && s.player.x > cp.x + 80)) {
        const a = chooseAction(snapshot(s), m);
        if (a) api(s)[a]();
        update(s, TICK);
      }
      if (how === "retry") retry(s);
      else {
        s.player.y += 2000;
        update(s, TICK);
        assert.equal(s.status, "dead");
        for (let t = 0; t < 400 && s.status !== "running"; t++) update(s, TICK);
      }
      assert.equal(s.status, "running", `${cp.id} ${how}`);
      assert.equal(s.verbs.cape, true, `${cp.id} ${how}: the cape stays owned`);
      assert.equal(s.capeCharge, 1, `${cp.id} ${how}: a full bar`);
      assert.equal(snapshot(s).capeFull, true);
    }
  }
  const s = game(II);
  restart(s);
  while (s.player.x < II.gets[0].x + 1) update(s, TICK);
  assert.ok(s.capeCharge < 0.01, "the gift arrives empty");
  assert.equal(snapshot(s).capeCharges, 0, "the legacy flag follows it");
  const t0 = s.time;
  while (s.capeCharge < 1) update(s, TICK);
  assert.ok(Math.abs((s.time - t0) - 4 * 4 * SIX) < 2 * TICK, `full after ${((s.time - t0) / SIX).toFixed(2)} sixteenths of running`);
});
test("C4: loose stars never gate: with every non-constellation star removed, each level's main route still wins", () => {
  for (const d of LEVELS) {
    const s = start(createGame(2021, { level: d.id }));
    s.pickups = s.pickups.filter((q) => q.chain || q.great);
    playRoute(api(s), { route: "main" });
    assert.equal(s.status, "won", `${d.numeral}`);
    assert.equal(s.deaths, 0, `${d.numeral}`);
  }
});

/* ---------- levels ---------- */
test("L2: every beacon's story line is unique across the built stages, and none repeats an interim level's", () => {
  const built = BUILT.flatMap((d) => d.checkpoints.map((c) => c.story));
  assert.equal(new Set(built).size, built.length, "unique among I and II");
  const interim = new Set(LEVELS.filter((d) => d.interim).flatMap((d) => d.checkpoints.map((c) => c.story)));
  for (const line of built) assert.ok(!interim.has(line), line);
});
test("L4: each main route is 45-70 s real", () => {
  for (const d of LEVELS) {
    const { s } = run(d);
    const t = real(d, s.time);
    assert.ok(t >= 45 && t <= 70, `${d.numeral} ${t.toFixed(1)} s`);
  }
  assert.ok(Math.abs(real(I, run(I).s.time) - 51.8) < 0.1, "I is 19 bars at 88 BPM");
});
test("L5: one unique `introduces` per built stage, in the campaign's order", () => {
  const order = ["double", "cape", "glide", "dive", "cracks", "wind", "cascade", "super"];
  assert.deepEqual(CAMPAIGN.map((q) => q.introduces), order);
  assert.deepEqual(BUILT.map((d) => d.introduces), order.slice(0, BUILT.length));
  assert.deepEqual(BUILT.map((d) => d.stage), BUILT.map((_, i) => i + 1));
  for (const d of BUILT) assert.equal(d.introduces, CAMPAIGN[d.stage - 1].introduces);
  // A verb a stage introduces is never owned before its GET there.
  for (const d of BUILT) if (["double", "cape", "glide", "dive", "super"].includes(d.introduces)) assert.equal(d.verbs[d.introduces], false, d.numeral);
});
test("L8: I's songs complete with natural holds of 250, 350 and 500 ms; no 2-bar stretch passes without an input or an event", () => {
  const songs = I.chains.filter((c) => c.route === "low").map((c) => c.id);
  for (const ms of [250, 350, 500]) {
    const s = game(I);
    const m = createRouteMemory("main");
    let releaseAt = null;
    for (let t = 0; s.status === "running" && t < 120 * 90; t++) {
      if (releaseAt !== null && s.time >= releaseAt - 1e-9) ((releaseAt = null), releaseJump(s));
      const a = chooseAction(snapshot(s), m);
      if (a === "jump") {
        if (releaseAt !== null) releaseJump(s);
        jump(s);
        releaseAt = s.time + (ms / 1000) * I.clock;
      } else if (a) api(s)[a]();
      update(s, TICK);
    }
    assert.equal(s.status, "won", `${ms} ms holds`);
    assert.equal(s.deaths, 0);
    const done = s.chains.filter((c) => c.complete).map((c) => c.id);
    for (const id of songs) assert.ok(done.includes(id), `${ms} ms holds: ${id}`);
  }
  // The pilot's presses plus the scripted world (beacons, the GET, the
  // shower, the brightest star, the crash) and the wake and the door.
  const s = game(I);
  const marks = [0];
  let seen = s.eventSerial;
  playRoute(
    api(s, {
      step: (g) => {
        for (const e of g.events) if (e.serial > seen) ((seen = e.serial), ["checkpoint", "get", "moment", "jump", "double-jump"].includes(e.name) && marks.push(e.time / SIX));
      },
    }),
    { route: "main" },
  );
  marks.push(s.time / SIX);
  marks.sort((a, b) => a - b);
  const longest = Math.max(...marks.slice(1).map((k, i) => k - marks[i]));
  assert.ok(longest < 32, `longest quiet stretch ${(longest / 16).toFixed(2)} bars`);
  assert.ok(I.moments.filter((q) => q.kind === "fall").length >= 8, "the shower lands at least eight stars");
  // Each falling star lands in view at least 2.2 s (real) before Diana takes it.
  const w = createLevel(I);
  for (const q of I.moments.filter((m) => m.kind === "fall" && m.target !== "first-star")) {
    const star = w.pickups.find((p) => p.id === q.target);
    const reach = (star.x - 40 - I.level.startX) / 270 / SIX;
    assert.ok(real(I, (reach - q.k) * SIX) >= 2.2, `${q.id}: ${real(I, (reach - q.k) * SIX).toFixed(2)} s ahead`);
  }
});
test("M1: Diana's own notes on the perfect run rise at least 10% from I to II (the bed stays sparse)", () => {
  const rate = (d) => {
    const r = musicRun({ level: d.id });
    const own = r.notes.filter((v) => !LAYERS[v.layer].bed).length;
    const bed = r.notes.filter((v) => LAYERS[v.layer].bed && v.event === "tick").length;
    return { own: own / real(d, r.s.time), bed: bed / real(d, r.s.time) };
  };
  const [a, b] = [rate(I), rate(II)];
  assert.ok(a.own >= 1.2 && a.own <= 2.0, `I ${a.own.toFixed(2)} own onsets/s`);
  assert.ok(b.own >= a.own * 1.1, `II ${b.own.toFixed(2)} vs I ${a.own.toFixed(2)}`);
  // Restraint (revision five feedback): fewer bed onsets than Diana's own.
  assert.ok(a.bed < a.own && b.bed < b.own, `bed ${a.bed.toFixed(2)} / ${b.bed.toFixed(2)} per s`);
});

/* ---------- the save ---------- */
test("save migration: a revision-five save keeps its numeral and loses its Great Stars; version 2 keys them by level", () => {
  assert.deepEqual(readSave(null), { unlocked: 1, great: {}, done: {} });
  assert.deepEqual(readSave({ unlocked: "x" }), { unlocked: 1, great: {}, done: {} });
  assert.deepEqual(readSave({ unlocked: 3, great: { 1: 3, 2: 2 }, done: { 1: true } }), { unlocked: 3, great: {}, done: {} });
  assert.equal(readSave({ unlocked: 99 }).unlocked, LEVELS.length);
  const progress = { unlocked: 2, great: { 1: 3, 2: 1 }, done: { 1: true } };
  const saved = writeSave(progress);
  assert.deepEqual(saved, { v: SAVE_VERSION, unlocked: 2, great: { waking: 3, gift: 1 }, done: { waking: true } });
  assert.deepEqual(readSave(JSON.parse(JSON.stringify(saved))), progress);
  // A later build that inserts a stage keeps each level's stars by key.
  const shifted = [LEVELS[0], { ...LEVELS[1], id: 3 }];
  assert.deepEqual(readSave(saved, shifted).great, { 1: 3, 3: 1 });
});
