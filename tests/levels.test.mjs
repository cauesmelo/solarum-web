/** RESEARCH_PROGRESSION 8 for the built stages (I · Waking, II · The Gift,
 * III · Still Water, IV · The Way Down, V · The Breaking Constellation, VI ·
 * Borrowed Wind;
 * V on have no GET: cracks and wind are the world's): unlocks (U1, U3, U5), the cape's breath on real
 * routes (C1-C4), the level rules (L2, L4, L5, L8), the GET spacing of
 * section 7, the difficulty ladder of 4.2 (L3: windows, inputs per bar,
 * peak, beacon gaps, monotone), M1 on Diana's own notes and the save
 * migration. Every route winning at 30-240 Hz, the grid, windows, glyphs,
 * lookahead, beacons and the step-up sweep are the per-level tests in
 * model.test.mjs, movement-audit.test.mjs and score.test.mjs. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createGame, start, update, jump, releaseJump, dash, dive, snapshot, retry, restart, setAssist, capeReady, TICK, RULES } from "../model.mjs";
import { CAMPAIGN, LEVELS, levelDef, createLevel, gx, readSave, writeSave, SAVE_VERSION } from "../level.mjs";
import { playRoute, chooseAction, createRouteMemory } from "./routes.mjs";
import { nominalRun, replayShifted, timingWindow, inputsOf } from "../scripts/movement-audit.mjs";
import { musicRun } from "./music-run.mjs";
import { LAYERS } from "../score.mjs";

const SIX = 15 / 107;
const BUILT = LEVELS.filter((d) => !d.interim);
const [I, II, III, IV] = BUILT;
/** The built stages that own the cape's breath (II on). */
const BREATH = BUILT.filter((d) => d.capeRule === "breath" && (d.verbs.cape || d.gets.some((g) => g.verb === "cape")));
/** RESEARCH_PROGRESSION 2.1: the verbs each stage starts with, in order. */
const START_VERBS = [
  { double: false, cape: false, glide: false, dive: false, super: false },
  { double: true, cape: false, glide: false, dive: false, super: false },
  { double: true, cape: true, glide: false, dive: false, super: false },
  { double: true, cape: true, glide: true, dive: false, super: false },
  { double: true, cape: true, glide: true, dive: true, super: false },
  { double: true, cape: true, glide: true, dive: true, super: false },
  { double: true, cape: true, glide: true, dive: true, super: false },
  { double: true, cape: true, glide: true, dive: true, super: false },
];
/** V (cracks), VI (wind) and VII (the cascade) bring no verb: the world
 * introduces them. VIII's GET is the super jump. */
const GET_VERBS = [["double"], ["cape"], ["glide"], ["dive"], [], [], [], ["super"]];
/** A held-cape onset that is a press of its own (no flight at that x). */
const pureGlide = (plan, i) => plan[i][1] === "glide" && !(plan[i - 1] && plan[i - 1][1] === "dash" && Math.abs(plan[i - 1][0] - plan[i][0]) < 1);
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
test("U1: each built stage starts with its own verbs and its GET (if it has one) fires on every route at 30/60/120/240 Hz", () => {
  assert.deepEqual(BUILT.map((d) => d.verbs), START_VERBS.slice(0, BUILT.length));
  assert.deepEqual(BUILT.map((d) => d.gets.map((g) => g.verb)), GET_VERBS.slice(0, BUILT.length));
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
  // leap; II's safe line (no cape over the first gap) dies at the hearth
  // void (after the gift on the crater floor, bar 11); III's main route (its float off the cliff is optional) at the
  // still void.
  const gk = (k, F) => 220 + 37.85 * k + 113.55 * F;
  for (const [d, route, beacon, lo, hi] of [
    [I, "main", "first-star", gx(152), gx(168)],
    [II, "safe", "gift", gk(232, 1), gk(244, 1)],
    [III, "main", "float", gk(76, 1), gk(96, 2)],
    // IV's main route (the safe dive through the glinting lid is optional)
    // dies at the cut: the flight runs on over the islet.
    [IV, "main", "down", gk(79, 1), gk(100, 2)],
  ].filter(([d]) => d)) {
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
  const KIND = { double: "double-jump", cape: "dash", glide: "glide", dive: "dive", super: "super-jump" };
  for (const d of BUILT) {
    const n = d.id;
    const nom = nominalRun(n);
    // When (in sixteenths of simulation) the main route passes each GET and
    // beacon: flights before a GET move it off the plain lattice.
    const when = {};
    {
      // (I's GET and its beacon share the id first-star.)
      const marks = [...d.gets.map((q) => ["get " + q.id, q.x]), ...d.checkpoints.map((q) => [q.id, q.x])];
      const s = game(d);
      playRoute(api(s, { step: (g) => { for (const [id, x] of marks) if (g.player.x >= x) when[id] ??= g.time / SIX; } }), { route: "main" });
    }
    // Required: skipping the step fails (a held cape and a release in the
    // air count; a release after a touch-down does not), and no optional
    // glyph marks it as the safe first use (II's first gap has a floor).
    const optional = d.prompts.filter((q) => q.optional);
    const required = nom.plan.map((step, i) => (step[1] === "unglide" && step[2] !== "a" ? false : !optional.some((q) => step[0] >= q.from && step[0] <= q.to) && !replayShifted(n, nom, i, 0, { skip: true }).ok));
    const at = (i) => nom.steps[i].tick * TICK / SIX; // sixteenth of the press
    for (const g of d.gets) {
      const k = when["get " + g.id];
      const kind = KIND[g.verb];
      nom.plan.forEach((_, i) => required[i] && assert.ok(Math.abs(at(i) - k) >= 16 - 1e-6, `${d.numeral} step ${i} at ${at(i).toFixed(1)} is within a bar of ${g.id} (${k.toFixed(1)})`));
      const use = nom.plan.findIndex((q, i) => required[i] && (kind === "glide" ? q[1] === "glide" : nom.steps[i].kind === kind));
      assert.ok(use >= 0 && at(use) >= k + 32 - 1e-6, `${d.numeral}: first required ${kind} at ${at(use)?.toFixed(1)}`);
      // The use's airtime starts at the ground jump before it.
      const takeoff = nom.plan.slice(0, use).findLastIndex((q) => q[2] === "g" && q[1] !== "glide" && q[1] !== "unglide");
      const useX = nom.plan[use][0];
      const beacon = d.checkpoints.filter((c) => c.x < useX).at(-1);
      assert.ok(beacon && at(takeoff) - when[beacon.id] <= 16.2, `${d.numeral}: the beacon before the first use (${beacon?.id})`);
      assert.ok(d.prompts.some((q) => !q.optional && q.action === kind && q.from <= useX + 120 && q.to >= useX), `${d.numeral}: a glyph shows the first required ${kind}`);
    }
  }
});

/* ---------- the cape's breath on real routes ---------- */
/** A flight press on an empty bar is "empty" unless it flies within the
 * cape's press buffer (0.14 s real: RESEARCH_REFILLS C12 and the critic's
 * cape buffer), as a press just before a refill or a column's edge does. */
function pressWait(empty) {
  let pend = null;
  return {
    dash: (g, ready) => !ready && (pend = { x: Math.round(g.player.x), t: g.time, flights: g.flights }),
    step: (g) => {
      if (!pend) return;
      if (g.flights > pend.flights) pend = null;
      else if (g.time - pend.t > g.physics.jumpBuffer + 1e-9 || g.status !== "running") ((empty.push(pend.x)), (pend = null));
    },
  };
}
/** C1 for one stage: every flight press on every route and rate finds the
 * bar full, and every held-cape onset that is a press of its own (no flight
 * in that airtime: the same key) finds it short of full, so it glides and
 * never flies. Then each required press at its window's edges. */
function c1(d) {
  for (const route of ["main", "upper", "ability", "safe"])
    for (const hz of [30, 60, 120, 240]) {
      const empty = [],
        flew = [];
      let air = 0,
        gliding = false;
      const wait = pressWait(empty);
      const { s } = run(d, route, 1 / hz, {
        dash: wait.dash,
        step: (g) => {
          wait.step(g);
          if (g.player.grounded) air = g.time;
          if (g.player.gliding && !gliding && g.lastDashAt < air && capeReady(g) && !g.player.inWind) flew.push(Math.round(g.player.x));
          gliding = g.player.gliding;
        },
      });
      assert.equal(s.status, "won", `${d.numeral} ${route} ${hz}`);
      assert.deepEqual(empty, [], `${d.numeral} ${route} ${hz} Hz: flight presses on an empty bar`);
      assert.deepEqual(flew, [], `${d.numeral} ${route} ${hz} Hz: a held cape with a full bar would fly`);
    }
  // The timingWindow sweep: each required press at its earliest and latest
  // working tick (the late valid route included), the rest of the route as
  // flown by the pilot.
  const nom = nominalRun(d.id);
  const xs = [];
  {
    const s = game(d);
    const m = createRouteMemory("main");
    while (s.status === "running") {
      xs.push(s.player.x);
      const a = chooseAction(snapshot(s), m);
      if (a) api(s)[a]();
      update(s, TICK, { glide: m.glide });
    }
  }
  let shifted = 0;
  nom.plan.forEach((step, i) => {
    if (step[1] === "glide" || step[1] === "unglide") return;
    const w = timingWindow(d.id, nom, i);
    if (!w.required || !w.works) return;
    for (const dt of [w.lo, w.hi]) {
      // Diana's x at the shifted tick: the route's own before the authored
      // press, plain running after it (the press has not happened yet).
      // A person who presses early or late keeps the rhythm of the presses
      // that follow in the same airtime (replayShifted's rule): they move by
      // the same time, which is dt ticks of plain running in x.
      // A super jump is pressed during a flight: moving it by dt ticks also
      // moves the flight's end, so she is dt ticks of flight speed (run plus
      // cape) ahead or behind for the rest of that airtime (VIII).
      const t0 = nom.steps[i].tick;
      const speed = nom.steps[i].kind === "super-jump" ? 270 + RULES.dashSpeed : 270;
      const x = dt <= 0 ? xs[t0 + dt] : xs[t0] + dt * speed * TICK;
      let group = i + 1;
      while (group < nom.plan.length && nom.plan[group][2] !== "g") group++;
      const plan = nom.plan.map((q, j) => (j === i ? [x - 0.01, q[1], "*"] : j > i && j < group ? [q[0] + dt * speed * TICK, q[1], q[2]] : q));
      const empty = [];
      const s = game({ ...d, routes: { ...d.routes, main: plan } });
      const m = createRouteMemory("main");
      const wait = pressWait(empty);
      const a = api(s, wait);
      for (let t = 0; s.status === "running" && t < 120 * 120; t++) {
        // A person who touches down before an airborne press of the shifted
        // airtime (a late flight's held cape lands before its dive) simply
        // does not make it; the pilot would wait for the next airtime.
        if (s.player.grounded && m.i > i && m.i < group && plan[m.i][2] === "a") m.i = group;
        const act = chooseAction(snapshot(s), m);
        if (act) a[act]();
        update(s, TICK, { glide: m.glide });
        wait.step(s);
      }
      assert.equal(s.status, "won", `${d.numeral} step ${i} shifted ${dt} ticks`);
      assert.deepEqual(empty, [], `${d.numeral} step ${i} shifted ${dt} ticks: a flight press on an empty bar`);
      shifted++;
    }
  });
  return shifted;
}
test("C1: on every route of every breath stage at 30/60/120/240 Hz, and with each required press shifted to its window's edges, every flight press finds the bar full and every held cape on its own finds it short", () => {
  assert.deepEqual(BREATH.map((d) => d.numeral), BUILT.slice(1).map((d) => d.numeral));
  for (const d of BREATH) {
    const shifted = c1(d);
    assert.ok(shifted >= 30, `${d.numeral}: ${shifted} shifted runs`);
  }
});
test("C2: no doomed approach: an optional flight spent in any airtime with a full bar never leaves a required flight empty", () => {
  for (const d of BREATH) {
    const nom = nominalRun(d.id);
    // A required flight: skipping it fails, and no optional glyph marks it
    // as the safe first use (II's first gap has a floor and a hop back up).
    const safeUse = d.prompts.filter((q) => q.optional && q.action === "dash");
    const required = nom.plan.map((step, i) => step[1] === "dash" && !safeUse.some((q) => step[0] >= q.from && step[0] <= q.to) && !replayShifted(d.id, nom, i, 0, { skip: true }).ok);
    // Candidate ticks: on each sixteenth, airborne, the bar full and the
    // next pilot step not a flight (that airtime's own flight is C1's).
    const candidates = [];
    {
      const s = game(d);
      const m = createRouteMemory("main");
      let k = -1;
      for (let t = 0; s.status === "running"; t++) {
        const a = chooseAction(snapshot(s), m);
        if (a) api(s)[a]();
        update(s, TICK, { glide: m.glide });
        const kk = Math.floor(s.time / SIX + 1e-9);
        // (The press is injected before the next tick: t + 1. A press in an
        // airtime whose own flight is still to come is an early press of
        // that flight: its window, C1's sweep.)
        const next = nom.plan.findIndex((q, j) => j >= m.i && q[1] === "dash");
        const ownFlight = next >= 0 && !nom.plan.slice(m.i, next).some((q) => q[2] === "g");
        if (kk !== k && !s.player.grounded && capeReady(s) && s.verbs.cape && !ownFlight && s.dashRemaining <= 0) candidates.push(t + 1);
        k = kk;
      }
    }
    assert.ok(candidates.length >= (d === II ? 8 : 1), `${d.numeral}: ${candidates.length} injection points`);
    let survived = 0;
    for (const T of candidates) {
      const s = game(d);
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
        update(s, TICK, { glide: m.glide });
      }
      assert.deepEqual(empty, [], `${d.numeral}: an optional flight at tick ${T} doomed step ${empty}`);
      if (s.status === "won") survived++;
    }
    assert.ok(survived >= 1, `${d.numeral}: ${survived} of ${candidates.length} injected runs still win`);
  }
});
test("C3: every respawn restores a full bar; II's gift (bar 11) arrives full and III restarts full", () => {
  for (const d of BREATH)
    // (II's beacons before its gift give no cape to restore.)
    for (const cp of d.checkpoints.filter((c) => !d.gets.some((g) => g.verb === "cape" && g.x > c.x))) {
      for (const how of ["fall", "retry", "net"]) {
        const s = game(d, how === "net" ? { starNet: true } : {});
        const m = createRouteMemory("main");
        while (s.status === "running" && !(s.checkpoint?.id === cp.id && s.player.x > cp.x + 80)) {
          const a = chooseAction(snapshot(s), m);
          if (a) api(s)[a]();
          update(s, TICK, { glide: m.glide });
        }
        if (how === "retry") retry(s);
        else {
          s.player.y += 2000;
          update(s, TICK);
          assert.equal(s.status, "dead");
          for (let t = 0; t < 400 && s.status !== "running"; t++) update(s, TICK);
        }
        assert.equal(s.status, "running", `${d.numeral} ${cp.id} ${how}`);
        assert.equal(s.verbs.cape, true, `${cp.id} ${how}: the cape stays owned`);
        assert.equal(s.capeCharge, 1, `${d.numeral} ${cp.id} ${how}: a full bar`);
        assert.equal(snapshot(s).capeFull, true);
      }
    }
  // RESEARCH_REFILLS 2.2: the relic is the first flight's charge.
  const s = game(II);
  restart(s);
  const m = createRouteMemory("main");
  while (s.status === "running" && s.player.x < II.gets[0].x - 1) {
    const a = chooseAction(snapshot(s), m);
    if (a) api(s)[a]();
    update(s, TICK, { glide: m.glide });
    assert.equal(s.verbs.cape, false, "no cape before the gift");
  }
  update(s, TICK);
  assert.equal(s.verbs.cape, true);
  assert.equal(s.capeCharge, 1, "the gift arrives full");
  assert.equal(snapshot(s).capeCharges, 1, "the legacy flag follows it");
  for (const d of BREATH.filter((q) => q !== II)) {
    const r = game(d);
    update(r, 1);
    restart(r);
    assert.equal(r.capeCharge, 1, `${d.numeral} restarts with a full bar`);
  }
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
test("L2: every beacon's story line is unique across the campaign, and none repeats an interim level's", () => {
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
test("M1: Diana's own notes on the perfect run rise at least 10% stage over stage (the bed stays sparse, under hers)", () => {
  const rate = (d) => {
    const r = musicRun({ level: d.id });
    const own = r.notes.filter((v) => !LAYERS[v.layer].bed).length;
    const bed = r.notes.filter((v) => LAYERS[v.layer].bed && v.event === "tick").length;
    return { own: own / real(d, r.s.time), bed: bed / real(d, r.s.time) };
  };
  const rates = BUILT.map(rate);
  assert.ok(rates[0].own >= 1.2 && rates[0].own <= 2.0, `I ${rates[0].own.toFixed(2)} own onsets/s`);
  for (let i = 1; i < rates.length; i++) assert.ok(rates[i].own >= rates[i - 1].own * 1.1, `${BUILT[i].numeral} ${rates[i].own.toFixed(2)} vs ${rates[i - 1].own.toFixed(2)}`);
  // Restraint (revision five feedback): fewer bed onsets than Diana's own.
  rates.forEach((r, i) => assert.ok(r.bed < r.own, `${BUILT[i].numeral} bed ${r.bed.toFixed(2)} vs own ${r.own.toFixed(2)} per s`));
});
/** RESEARCH_PROGRESSION 4.2 for I-VIII (real units, main route).
 * `narrow` is the narrowest required window's band. Its CEILING is kept for
 * I-III and VIII only: in IV-VII the narrowest windows used to be accidents
 * of star gating (a required star sitting at the very press that needs what
 * it gives, so a press 50 ms early skipped the star: the human proxies' hot
 * spots, MOVEMENT_AUDIT 2026-11-10 round 8). Those cells now complete their
 * song or touch their star 250 ms or more before the dependent press, so IV-VII's
 * narrowest windows are the ordinary 290-430 ms of a hop or a double; the
 * ladder's rise there is carried by the median and lower-quartile windows
 * (checked below), by inputs per bar, by the beacon gaps and by the
 * proxies' falls (tests/human-proxy.test.mjs). The floor stays everywhere. */
const LADDER = [
  { narrow: [400, Infinity], median: 500, inputs: [1.1, 1.5], peak: 2, gap: 14 },
  { narrow: [320, 420], median: 450, inputs: [1.3, 1.7], peak: 3, gap: 13 },
  { narrow: [280, 370], median: 410, inputs: [1.5, 1.9], peak: 3, gap: 12.5 },
  { narrow: [250, Infinity], median: 370, inputs: [1.7, 2.1], peak: 4, gap: 12 },
  { narrow: [220, Infinity], median: 330, inputs: [1.9, 2.4], peak: 4, gap: 11.5 },
  { narrow: [190, Infinity], median: 300, inputs: [2.2, 2.7], peak: 5, gap: 11 },
  { narrow: [160, Infinity], median: 270, inputs: [2.5, 3.0], peak: 5, gap: 10 },
  { narrow: [120, 200], median: 240, inputs: [2.8, 3.5], peak: 6, gap: 9.5 },
];
test("L3: the difficulty ladder: windows, inputs per bar, peak bar and beacon gaps in each stage's band; median and lower-quartile windows never widen and inputs never thin out", () => {
  const rows = BUILT.map((d) => {
    const nom = nominalRun(d.id);
    const ms = nom.plan
      .map(([, a], i) => (a === "glide" || a === "unglide" ? null : timingWindow(d.id, nom, i)))
      .filter((w) => w && w.required)
      .map((w) => (assert.ok(w.works, `${d.numeral} step ${w.i}`), w.widthMs))
      .sort((a, b) => a - b);
    // Bars: the door is on the downbeat after the last one.
    const bars = Math.round(nom.ticks * TICK / SIX / 16);
    const perBar = Array.from({ length: bars }, () => 0);
    const inputs = inputsOf(nom);
    for (const q of inputs) perBar[Math.min(bars - 1, Math.floor(q.tick * TICK / SIX / 16))]++;
    const xs = [d.level.startX, ...d.checkpoints.map((c) => c.x), d.level.finishX];
    const gap = Math.max(...xs.slice(1).map((x, i) => real(d, (x - xs[i]) / 270)));
    return { d, narrow: ms[0], quarter: ms[Math.floor(ms.length / 4)], median: ms[Math.floor(ms.length / 2)], inputs: inputs.length / bars, peak: Math.max(...perBar), gap };
  });
  rows.forEach((r, i) => {
    const want = LADDER[i],
      where = `${r.d.numeral}: narrowest ${r.narrow.toFixed(0)} ms, lower quartile ${r.quarter.toFixed(0)}, median ${r.median.toFixed(0)}, ${r.inputs.toFixed(2)} inputs a bar (peak ${r.peak}), beacons ${r.gap.toFixed(1)} s`;
    assert.ok(r.narrow >= want.narrow[0] && r.narrow <= want.narrow[1], where);
    assert.ok(r.median >= want.median, where);
    assert.ok(r.inputs >= want.inputs[0] && r.inputs <= want.inputs[1], where);
    assert.ok(r.peak <= want.peak, where);
    assert.ok(r.gap <= want.gap, where);
    if (i === 0) return;
    const p = rows[i - 1];
    // (The narrowest window no longer has to fall every stage, see LADDER;
    // I-III still do, and the lower quartile may rise by at most 30 ms, the
    // slack of one hop's window against the next stage's.)
    if (i < 3) assert.ok(r.narrow <= p.narrow, `${where}: the narrowest window never widens (${p.narrow.toFixed(0)} before)`);
    assert.ok(r.median <= p.median, `${where}: median windows never widen (${p.median.toFixed(0)} before)`);
    assert.ok(r.quarter <= p.quarter + 30, `${where}: lower-quartile windows never widen by more than 30 ms (${p.quarter.toFixed(0)} before)`);
    assert.ok(r.inputs >= p.inputs - 1e-9, `${where}: inputs never thin out (${p.inputs.toFixed(2)} before)`);
    assert.ok(r.d.bpm > p.d.bpm, where);
  });
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
