import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createGame,
  start,
  update,
  jump,
  releaseJump,
  dash,
  dive,
  togglePause,
  restart,
  retry,
  RULES,
  snapshot,
  capeReady,
  setAssist,
  levelPhysics,
} from "../model.mjs";
import { BEAT, CARD, LEVELS, levelDef, createLevel, shownPrompts, gx } from "../level.mjs";
import { frameForClip, characterLayers } from "../animation.mjs";
import {
  VIEW,
  outlineY,
  portalPlacement,
  viewGeometry,
  fitStage,
  cameraTargetY,
  clampCameraY,
  visibleBand,
} from "../geometry.mjs";
import { playRoute, chooseAction, createRouteMemory } from "./routes.mjs";
import { visibleBounds } from "./png.mjs";
import { createFrameClock } from "../frame-clock.mjs";
const manifest = JSON.parse(
  await readFile(new URL("../assets/manifest.json", import.meta.url)),
);
const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
/** Real (audio) seconds of run between two x on level n's lattice, ignoring
 * flights (which only shorten it). */
const t = (x, from, n = 2) => (x - from) / 270 / levelDef(n).clock;
/** A game of level n (2, Borrowed Wind, has every verb at clock 1: the
 * default for rule fixtures). */
const game = (n = 2, o = {}) => createGame(2021, { level: n, ...o });

function adapter(s, block) {
  return {
    getState: () => snapshot(s),
    step: (dt, c) => {
      update(s, dt, c);
      return snapshot(s);
    },
    jump: () => (block === "double" && !s.player.grounded ? false : block === "super" && s.dashRemaining > 0 ? false : jump(s)),
    releaseJump: () => releaseJump(s),
    dash: () => (block === "dash" ? false : dash(s)),
    dive: () => (block === "dive" ? false : dive(s)),
    tap: () => (jump(s), releaseJump(s)),
  };
}
function traverse(route = "main", dt = 1 / 120, block, setup, level = 2) {
  const s = start(game(level));
  setup?.(s);
  const result = playRoute(adapter(s, block), { route, dt });
  return { s, result };
}
/** Run a pilot until Diana reaches x (or the run ends). */
function pilotTo(s, route, x, dt = 1 / 120) {
  const m = createRouteMemory(route);
  const api = adapter(s);
  for (let i = 0; i < 200 / dt && s.status === "running" && s.player.x < x; i++) {
    const a = chooseAction(snapshot(s), m);
    if (a) api[a]();
    update(s, dt, { glide: m.glide });
  }
  return s;
}
/** A tiny isolated world for rule fixtures. */
function fixture(platforms, extra = {}) {
  // Level 2's rules with level 1's spawn (x 220, y 540) and nothing else.
  const s = start(game());
  Object.assign(s.player, { x: 220, y: 540 });
  s.anchorY = 540;
  s.updrafts = [];
  s.platforms = platforms.map((q, i) => ({
    phase: i,
    route: "low",
    crumbleAfter: q.type === "crumble" ? RULES.crumbleAfter : null,
    triggeredAt: null,
    collapseAt: null,
    collapsed: false,
    cascade: null,
    ...q,
  }));
  s.platforms.sort((a, b) => a.y - b.y);
  s.pickups = extra.pickups ?? [];
  s.chains = extra.chains ?? [];
  s.updrafts = extra.updrafts ?? [];
  s.cascades = extra.cascades ?? [];
  s.prompts = [];
  return s;
}
const mainPlatforms = (n) =>
  createLevel(n)
    .platforms.filter((q) => q.route === "low")
    .sort((a, b) => a.x - b.x);
const IDS = LEVELS.map((d) => d.id);
/** Consecutive main-route transitions: each platform with the one Diana
 * leaves to reach it (the latest edge before it; stacked floors overlap). */
function mainPairs(n) {
  const main = mainPlatforms(n);
  const out = [];
  for (const b of main) {
    const from = main.filter((a) => a !== b && a.x < b.x && a.x + a.width <= b.x + 1).sort((p, q) => q.x + q.width - (p.x + p.width))[0];
    if (from) out.push([from, b]);
  }
  return out;
}

/* ---------- complete routes, every level ---------- */
test("every level: main, upper (its three Great Stars), ability and safe routes win at 30/60/120/240 Hz", () => {
  for (const n of IDS)
    for (const dt of [1 / 30, 1 / 60, 1 / 120, 1 / 240])
      for (const route of ["main", "upper", "ability", "safe"]) {
        const { s } = traverse(route, dt, null, null, n);
        const where = `L${n} ${route} at ${Math.round(1 / dt)} Hz`;
        assert.equal(s.status, "won", where);
        assert.equal(s.deaths, 0, where);
        assert.ok(s.time / s.clock < 80, `${where} took ${(s.time / s.clock).toFixed(1)} s real`);
        if (route === "upper") assert.equal(s.greatBanked.length, 3, where);
      }
});
test("each main route reaches every beacon and uses its level's kit through public actions", () => {
  const kit = {
    1: { dash: 0, "double-jump": 5, constellations: 3 },
    2: { dash: 5, "double-jump": 1, constellations: 3 },
    3: { dash: 3, dive: 1, constellations: 2, cascade: true },
    4: { dash: 4, "super-jump": 2, constellations: 1, cascade: true },
  };
  for (const n of IDS) {
    const { s, result } = traverse("main", 1 / 120, null, null, n);
    const d = levelDef(n);
    assert.equal(s.player.x, d.level.finishX, `L${n}`);
    assert.deepEqual(s.checkpointsReached, d.checkpoints.map((q) => q.id), `L${n}`);
    const count = (a) => result.actions.filter((q) => q.action === a).length;
    const k = kit[n];
    if (n === 1) assert.equal(count("dash"), 0, "L1 has no cape");
    else assert.ok(count("dash") >= k.dash, `L${n} flights ${count("dash")}`);
    if (k.dive) assert.ok(s.smashes >= 1, `L${n} smashes the lid`);
    if (k["super-jump"]) assert.ok(s.superJumps >= k["super-jump"], `L${n} super jumps ${s.superJumps}`);
    assert.ok(s.constellationsDone >= k.constellations, `L${n} constellations ${s.constellationsDone}`);
    assert.equal(s.ringsCrossed, s.constellationsDone);
    if (k.cascade) assert.ok(s.platforms.some((q) => q.cascade && q.collapsed), `L${n} cascade`);
  }
});
test("L2's ability route glides in the wind, smashes the cache lid and keeps two refills for the QA contract", () => {
  const { s, result } = traverse("ability", 1 / 120, null, null, 2);
  assert.equal(s.status, "won");
  assert.ok(s.smashes >= 1);
  assert.ok(s.greatBanked.includes("great-1"), "the star cache's Great Star");
  assert.ok(result.actions.some((q) => q.action === "dive"));
  assert.ok(result.actions.some((q) => q.action === "tap"), "a tap off the far rock");
  assert.ok(s.ringsCrossed >= 2);
  const l1 = traverse("ability", 1 / 120, null, null, 1);
  assert.ok(l1.result.actions.some((q) => q.action === "releaseJump" || q.action === "tap"), "L1's ability route taps");
});
test("removing a level's new action fails exactly at the challenge that teaches it", () => {
  const noDouble = traverse("main", 1 / 120, "double", null, 1).s;
  assert.equal(noDouble.status, "dead");
  assert.ok(noDouble.player.x > gx(84) && noDouble.player.x < gx(96), `L1 no double: ${noDouble.player.x}`);
  assert.equal(noDouble.checkpoint.id, "drift");
  const noCape = traverse("main", 1 / 120, "dash", null, 2).s;
  assert.equal(noCape.status, "dead");
  assert.ok(noCape.player.x > 15060 && noCape.player.x < 15460, `L2 no cape: ${noCape.player.x}`);
  assert.equal(noCape.checkpoint, null, "the hearth void comes before L2's first beacon");
  // The school's super jump is optional (a floor runs under it): from the
  // storm beacon on, without it the void ends the run.
  const noSuper = pilotTo(start(game(4)), "main", gx(60) + 70);
  assert.equal(noSuper.checkpoint.id, "storm");
  playRoute(adapter(noSuper, "super"), { route: "main" });
  assert.equal(noSuper.status, "dead");
  assert.ok(noSuper.player.x > gx(68) && noSuper.player.x < gx(84), `L4 no super: ${noSuper.player.x}`);
});
test("missing a required midair constellation leaves the cape spent over the void", () => {
  for (const [n, star, beacon, lo, hi] of [
    [2, "void-song-3", "voids", 16380 + 37.85 * 35, 16710 + 37.85 * 35],
    [3, "split-song-4", "voids", 16590 + 37.85 * 70, 16960 + 37.85 * 70],
  ]) {
    const { s } = traverse("main", 1 / 120, null, (g) => (g.pickups = g.pickups.filter((q) => q.id !== star)), n);
    assert.equal(s.status, "dead", `L${n}`);
    assert.equal(s.checkpoint.id, beacon);
    assert.ok(s.player.x > lo && s.player.x < hi, `L${n} fell at ${s.player.x}`);
  }
});

/* ---------- levels: tempo, verbs, length ---------- */
test("four levels, each faster and each adding a verb; ≤ 80 s real, door on a downbeat", async () => {
  const { PATHS } = await import("../score-path.mjs");
  const { SCORES } = await import("../score.mjs");
  assert.deepEqual(LEVELS.map((d) => d.bpm), [96, 107, 118, 128]);
  for (const d of LEVELS) {
    assert.ok(Math.abs(d.clock - d.bpm / 107) < 1e-12, `L${d.id} clock`);
    // px per beat is the same ruler everywhere: 270 px/s of simulation.
    assert.equal(d.level.speed, 270);
    const realSeconds = (PATHS[d.id].end * (15 / 107)) / d.clock;
    assert.ok(realSeconds > 25 && realSeconds <= 80, `L${d.id} ${realSeconds.toFixed(1)} s`);
    assert.equal((PATHS[d.id].end + SCORES[d.id].pickup) % 16 < 0.1 || (PATHS[d.id].end + SCORES[d.id].pickup) % 16 > 15.9, true, `L${d.id} door on a downbeat`);
    const floor = createLevel(d).platforms.find((q) => d.level.finishX > q.x && d.level.finishX < q.x + q.width && q.y === d.level.finishY);
    assert.ok(floor && d.level.finishX - floor.x > 400, `L${d.id}: a long calm island before the door`);
  }
  // L1 is basics only; L2 opens the cape, wind and dive; L3 brings cracked
  // shelves and the cascade; L4 requires the super jump.
  assert.deepEqual(LEVELS[0].verbs, { cape: false, dive: false, glide: false });
  assert.ok(LEVELS.slice(1).every((d) => d.verbs.cape && d.verbs.dive && d.verbs.glide));
  const kinds = (d) => new Set(createLevel(d).platforms.map((q) => q.type).filter(Boolean));
  assert.equal(kinds(LEVELS[0]).size, 0, "L1: stable stone only");
  assert.deepEqual([...kinds(LEVELS[1])], ["lid"], "L2: only the cache lid");
  assert.ok(kinds(LEVELS[2]).has("crumble") && kinds(LEVELS[2]).has("cascade"));
  assert.ok(LEVELS[3].prompts.some((q) => q.action === "super-jump" && !q.optional));
  assert.ok(!LEVELS.slice(0, 3).some((d) => d.prompts.some((q) => q.action === "super-jump")));
  // Human-time forgiveness is constant in real seconds (RESEARCH_LEVELS 3).
  for (const d of LEVELS) {
    const ph = levelPhysics(d);
    assert.ok(Math.abs(ph.coyote / d.clock - RULES.coyote) < 1e-9 && Math.abs(ph.jumpBuffer / d.clock - RULES.jumpBuffer) < 1e-9, `L${d.id}`);
    assert.ok((ph.respawnShatter + ph.respawnIris + ph.respawnPop) / d.clock <= 1.2);
  }
  // L1 floats: half gravity at the apex while held, a lower terminal speed.
  const f = levelPhysics(LEVELS[0]);
  assert.ok(f.apexHang && Math.abs(f.apexHang.below * LEVELS[0].clock - 70) < 1e-9 && Math.abs(f.maxFall * LEVELS[0].clock - 560) < 1e-9);
  assert.ok(Math.abs(levelPhysics(LEVELS[2]).crumbleAfter - 5 * (15 / 107)) < 1e-12, "cracks break 5/16 after touch-down");
});
test("L1's float: a held jump hangs at the top and falls no faster than 560 px/s real", () => {
  const s = start(game(1));
  s.platforms = [{ id: "floor", x: -1000, y: 540, width: 1240, phase: 0, route: "low", crumbleAfter: null, triggeredAt: null, collapseAt: null, collapsed: false, cascade: null }];
  Object.assign(s.player, { x: 220, y: 540, grounded: true });
  jump(s);
  let apexTime = 0,
    vmax = 0;
  for (let i = 0; i < 240; i++) {
    update(s, 1 / 120);
    if (Math.abs(s.player.vy) < s.physics.apexHang.below) apexTime += 1 / 120;
    vmax = Math.max(vmax, s.player.vy);
  }
  const plain = start(game(1));
  plain.physics = { ...plain.physics, apexHang: null };
  const tHang = apexTime / LEVELS[0].clock;
  // Without the hang the slow band lasts 2 x 78 / 1304 = 0.12 s sim.
  assert.ok(tHang > 0.2, `hang ${tHang.toFixed(3)} s real`);
  assert.ok(vmax * LEVELS[0].clock <= 560 + 1e-6, `fall ${vmax * LEVELS[0].clock}`);
  // Releasing early cancels the hang (a tap is a tap).
  const tap = start(game(1));
  jump(tap);
  releaseJump(tap);
  assert.equal(tap.jumpHeld, false);
});

/* ---------- M1 cape rule ---------- */
test("cape rule defaults to one flight per airtime; L1 has no cape at all", () => {
  assert.equal(RULES.capeRule, "landing");
  const s = start(game());
  assert.equal(dash(s), false, "grounded cape does nothing");
  jump(s);
  update(s, 0.2);
  assert.equal(dash(s), true);
  assert.equal(snapshot(s).capeSpent, true);
  assert.equal(snapshot(s).capeCharges, 0);
  update(s, 0.6);
  assert.equal(dash(s), false, "a second flight needs a refill");
  const l1 = start(game(1));
  jump(l1);
  update(l1, 0.2);
  assert.equal(dash(l1), false, "L1 ignores the cape button");
  assert.equal(dive(l1), false, "and the dive");
});
test("stable ground refills the cape; cracked shelves do not", () => {
  const s = fixture([
    { id: "stable", x: 0, y: 500, width: 400 },
    { id: "crack", x: 600, y: 500, width: 400, type: "crumble" },
  ]);
  Object.assign(s.player, { x: 700, y: 440, vy: 0, grounded: false, jumps: 1 });
  s.capeCharges = 0;
  update(s, 0.4);
  assert.equal(s.player.grounded, true);
  assert.equal(capeReady(s), false, "a fragile landing leaves the cape spent");
  Object.assign(s.player, { x: 100, y: 440, vy: 0, grounded: false });
  update(s, 0.4);
  assert.equal(s.player.grounded, true);
  assert.equal(capeReady(s), true);
  assert.equal(s.events.at(-1).name === "refill" || s.events.some((e) => e.name === "refill" && e.source === "ground"), true);
});
test("beacons and completed constellations refill the cape midair", () => {
  const s = start(game());
  const cp = levelDef(2).checkpoints[0];
  Object.assign(s.player, { x: cp.x + 10, y: cp.y, grounded: true });
  s.capeCharges = 0;
  s.capeRule = "cooldown"; // beacon refills even when ground would not
  s.dashCooldown = 5;
  update(s, 0.02);
  assert.equal(s.checkpoint.id, cp.id);
  assert.equal(capeReady(s), true);
  const c = fixture([], {
    pickups: [0, 1, 2, 3].map((i) => ({ id: `c-${i}`, x: 300 + i * 60, y: 264, chain: "k", index: i, route: "low", collected: false })),
    chains: [{ id: "k", count: 4, got: 0, lastAt: -1, broken: false, complete: false, links: [] }],
  });
  Object.assign(c.player, { x: 250, y: 300, vy: 0, grounded: false, jumps: 2 });
  c.capeCharges = 0;
  c.dashRemaining = 9; // hold altitude: a long flight line through the chain
  update(c, 0.5);
  assert.equal(c.chains[0].complete, true);
  assert.equal(capeReady(c), true);
  assert.equal(c.ringsCrossed, 1);
  assert.ok(c.events.some((e) => e.name === "constellation"));
});
test("'cooldown' cape rule keeps the archived 6 s timer for comparison", () => {
  const s = start(game(2, { capeRule: "cooldown" }));
  jump(s);
  update(s, 0.2);
  assert.equal(dash(s), true);
  assert.ok(snapshot(s).dashCooldown > 5);
  update(s, 1);
  assert.equal(dash(s), false);
});
test("Endless cape assist never spends the cape", () => {
  const s = fixture([{ id: "floor", x: -1000, y: 540, width: 3000 }]);
  setAssist(s, "endlessCape", true);
  jump(s);
  update(s, 0.2);
  assert.equal(dash(s), true);
  update(s, 0.55);
  assert.equal(dash(s), true);
});

/* ---------- M2 dive smash ---------- */
test("a dive smashes cracked stone instantly and keeps falling into the catch below", () => {
  const s = fixture([
    { id: "lid", x: 0, y: 400, width: 300, type: "lid" },
    { id: "catch", x: 0, y: 580, width: 600 },
  ]);
  Object.assign(s.player, { x: 100, y: 330, vy: 0, grounded: false, jumps: 1 });
  dive(s);
  let smashedAt = null;
  for (let i = 0; i < 120 && !s.player.grounded; i++) {
    update(s, 1 / 120);
    if (smashedAt == null && s.platforms.find((q) => q.id === "lid").collapsed) {
      smashedAt = s.time;
      assert.ok(s.player.vy >= RULES.smashCarry);
    }
  }
  assert.ok(smashedAt != null);
  assert.equal(s.player.y, 580, "the catch below holds");
  assert.equal(s.smashes, 1);
});
test("a soft landing keeps a lid whole; a grounded dive breaks only drawn cracks", () => {
  const s = fixture([
    { id: "lid", x: 0, y: 400, width: 300, type: "lid" },
    { id: "floor", x: 300, y: 400, width: 300 },
  ]);
  Object.assign(s.player, { x: 60, y: 380, vy: 0, grounded: false, jumps: 1 });
  update(s, 0.6);
  assert.equal(s.player.grounded, true);
  assert.equal(s.platforms.find((q) => q.id === "lid").collapsed, false);
  Object.assign(s.player, { x: 420 });
  update(s, 0.01);
  assert.equal(dive(s), false, "ordinary stone ignores a grounded dive");
  Object.assign(s.player, { x: 100, y: 400, grounded: true });
  update(s, 0.01);
  assert.equal(dive(s), true);
  assert.equal(s.platforms.find((q) => q.id === "lid").collapsed, true);
  assert.equal(s.player.grounded, false);
});
test("every lid has a catch 90-280 px below it; the broken well's is deeper than a walk-off survives", () => {
  for (const n of IDS) {
    const all = createLevel(n).platforms;
    for (const lid of all.filter((q) => q.type === "lid")) {
      assert.ok(lid.width >= 160 && lid.width <= 560, lid.id);
      const catches = all.filter(
        (q) => q !== lid && q.x < lid.x + lid.width && q.x + q.width > lid.x && q.y - lid.y >= 90 && q.y - lid.y <= 280,
      );
      assert.ok(catches.length, `L${n} ${lid.id}`);
      // Deeper than the death line, only a dive (which lowers it) gets there.
      if (catches.every((q) => q.y - lid.y > RULES.fallLimit)) assert.ok(catches.every((q) => q.y - lid.y < RULES.fallLimit + RULES.smashDrop), lid.id);
    }
  }
});
test("L3's broken well forces the dive: walking or jumping off the lid's end dies; the dive lands", () => {
  for (const mode of ["dive", "walk", "jump", "double"]) {
    const s = pilotTo(start(game(3)), "main", 14700);
    assert.equal(s.checkpoint.id, "broken");
    const lid = s.platforms.find((q) => q.id === "broken-lid");
    let done = 0;
    for (let i = 0; i < 600 && s.status === "running"; i++) {
      const p = s.player;
      if (mode === "dive" && !done && p.grounded && p.x > lid.x + 200) (dive(s), (done = 1));
      if (mode !== "dive" && mode !== "walk" && !done && p.grounded && p.x > lid.x + lid.width - 25) (jump(s), (done = 1));
      if (mode === "double" && done === 1 && !p.grounded && p.vy > -40) (jump(s), (done = 2));
      update(s, 1 / 120);
      if (p.grounded && p.y > lid.y + 200) break;
    }
    if (mode === "dive") assert.ok(s.status === "running" && s.player.y > lid.y + 200, "the dive reaches the floor");
    else assert.notEqual(s.status, "running", `${mode} off the lid's end must fail`);
  }
});

/* ---------- M3 constellations ---------- */
test("constellations: 4–6 stars on the route, completed in order, a miss costs nothing", () => {
  for (const n of IDS) {
    const w = createLevel(n);
    for (const c of w.chains) {
      assert.ok(c.count >= 4 && c.count <= 6, c.id);
      const stars = w.pickups.filter((q) => q.chain === c.id).sort((a, b) => a.index - b.index);
      for (let i = 1; i < stars.length; i++) assert.ok(stars[i].x > stars[i - 1].x, `L${n} ${c.id} runs forward`);
    }
  }
  const s = fixture([], {
    pickups: [0, 1, 2, 3].map((i) => ({ id: `c-${i}`, x: 300 + i * 120, y: i === 2 ? 100 : 264, chain: "k", index: i, route: "low", collected: false })),
    chains: [{ id: "k", count: 4, got: 0, lastAt: -1, broken: false, complete: false, links: [] }],
  });
  Object.assign(s.player, { x: 250, y: 300, vy: 0, grounded: false, jumps: 2 });
  s.dashRemaining = 9;
  s.capeCharges = 0;
  update(s, 1.4);
  const c = s.chains[0];
  assert.equal(c.broken, true, "passing the high star fades the chain");
  assert.equal(c.complete, false);
  assert.equal(s.stars, 3, "the stars still count");
  assert.equal(s.status, "running");
  assert.ok(s.events.some((e) => e.name === "chain-fade"));
});
test("constellation steps climb the pentatonic scale and time out after 1.2 s", () => {
  const s = fixture([], {
    pickups: [0, 1].map((i) => ({ id: `c-${i}`, x: 300 + i * 400, y: 264, chain: "k", index: i, route: "low", collected: false })),
    chains: [{ id: "k", count: 2, got: 0, lastAt: -1, broken: false, complete: false, links: [] }],
  });
  Object.assign(s.player, { x: 290, y: 300, vy: 0, grounded: false, jumps: 2 });
  s.dashRemaining = 9;
  s.speed = 200; // 400 px at 470 px/s with flight: 0.85 s, then slow down
  update(s, 0.1);
  assert.equal(s.events.find((e) => e.name === "chain-note").step, 0);
  s.dashRemaining = 0;
  s.player.vy = 0;
  s.speed = 100;
  for (let i = 0; i < 160; i++) {
    s.player.vy = 0; // fixture: hover so only the pause matters
    update(s, 1 / 120);
  }
  assert.equal(s.chains[0].broken, true);
});
test("no required crossing depends on a chain unless a beacon sits right before it", () => {
  // The required chains are L2's void-song and L3's split-song (tested
  // above); each one's beacon is the last before it, within 6 s of run.
  for (const [n, chain] of [[2, "void-song"], [3, "split-song"]]) {
    const stars = createLevel(n).pickups.filter((q) => q.chain === chain);
    const before = levelDef(n).checkpoints.filter((c) => c.x < stars[0].x).at(-1);
    assert.equal(before.id, "voids");
    assert.ok(t(stars[0].x, before.x, n) < 6);
  }
});

/* ---------- M4 beat cascade ---------- */
test("the beat cascade drops a tile on every beat (107 BPM of simulation) and closes in on the bouncing line", () => {
  // L4's main route bounces all six tiles (L3's enters from the well on the second).
  const s = start(game(4));
  const tiles = s.platforms.filter((q) => q.cascade).sort((a, b) => a.x - b.x);
  assert.ok(tiles.length >= 5 && tiles.length <= 7);
  assert.ok(Math.abs(BEAT - 60 / 107) < 1e-12, "the soundtrack's tempo, not the GDD's 88");
  for (let i = 0; i < tiles.length; i++) {
    assert.ok(tiles[i].width >= 140 && tiles[i].width <= 160, tiles[i].id);
    if (i) {
      // One tile per beat at a 207 px pitch: the wave travels 369 px/s and
      // gains 55.6 px of run on Diana every beat (RESEARCH_MUSIC 5.3).
      assert.ok(Math.abs(tiles[i].x - tiles[i - 1].x - 207) < 1, `${tiles[i].id} pitch`);
      const gap = tiles[i].x - tiles[i - 1].x - tiles[i - 1].width;
      assert.ok(gap >= 50 && gap <= 70, `${tiles[i].id} gap ${gap}`);
    }
  }
  const wave = s.cascades[0];
  assert.equal(wave.interval, BEAT);
  // The main route bounces across; record when it leaves each tile.
  const log = [];
  let seen = 0;
  const api = adapter(s);
  const step = api.step;
  api.step = (dt, c) => {
    const r = step(dt, c);
    for (const e of s.events) if (e.serial > seen) (seen = e.serial), log.push({ ...e });
    return r;
  };
  playRoute(api, { route: "main" });
  assert.equal(s.status, "won");
  const drops = log.filter((e) => e.name === "tile-drop");
  assert.equal(drops.length, tiles.length);
  for (const d of drops) {
    const beats = d.time / BEAT;
    assert.ok(Math.abs(beats - Math.round(beats)) * BEAT < 0.02, `${d.platform} drops ${((beats - Math.round(beats)) * BEAT * 1000).toFixed(1)} ms off the beat`);
  }
  // Each touch-down on a tile is also the takeoff from it (a bounce), so the
  // slack is the time from that landing until the tile falls.
  const left = tiles.map((q) => log.find((e) => e.name === "land" && e.platform === q.id).time);
  const slack = tiles.map((q, i) => drops[i].time - left[i]);
  for (let i = 1; i < slack.length; i++) assert.ok(slack[i] < slack[i - 1], `the wave gains on tile ${i}`);
  assert.ok(slack.at(-1) > 0.35 && slack.at(-1) < 0.75, `last tile falls ${slack.at(-1).toFixed(3)} s after Diana leaves it`);
});
test("hopping at each tile edge survives the wave; late coyote hops are caught", () => {
  for (const n of [3, 4]) assert.equal(traverse("main", 1 / 120, null, null, n).s.status, "won");
  const late = start(game(4));
  const tiles = late.platforms.filter((q) => q.cascade).sort((a, b) => a.x - b.x);
  pilotTo(late, "main", tiles[1].x + 116);
  // From here, hop 24 px after each edge (inside coyote time) and never use
  // the second jump as a rescue: the wave catches this runner on the last tiles.
  let next = 0;
  const end = late.platforms.find((q) => q.id === "cascade-end");
  for (let i = 0; i < 2400 && late.status === "running" && late.player.x < end.x + 600; i++) {
    const p = late.player;
    if (next < tiles.length && p.x >= tiles[next].x + tiles[next].width + 24) {
      if (p.grounded || late.coyote > 0) jump(late);
      next++;
    }
    update(late, 1 / 120);
  }
  assert.equal(late.status, "dead");
  assert.ok(late.player.x > tiles[3].x && late.player.x < end.x + 580, `caught at ${late.player.x}`);
});

/* ---------- M5 updrafts ---------- */
test("inside an updraft gravity becomes lift, capped at 240 px/s; the cape catches 40% more", () => {
  const column = { id: "u", x: 0, width: 400, top: 0, bottom: 800 };
  function ride(glide) {
    const s = fixture([], { updrafts: [{ ...column }] });
    Object.assign(s.player, { x: 10, y: 600, vy: 0, grounded: false, jumps: 1 });
    s.speed = 0;
    update(s, 1.5, { glide });
    return s.player.vy;
  }
  assert.ok(Math.abs(ride(false) + RULES.updraftRise) < 1e-6);
  assert.ok(Math.abs(ride(true) + RULES.updraftRise * RULES.updraftGlideBoost) < 1e-6);
  const s = fixture([], { updrafts: [{ ...column }] });
  Object.assign(s.player, { x: 10, y: 600, vy: 0, grounded: false, jumps: 1 });
  s.speed = 0;
  update(s, 0.2);
  assert.ok(s.player.vy < 0 && s.player.vy > -RULES.updraftLift * 0.21);
  dive(s);
  update(s, 0.05);
  assert.ok(s.player.vy >= RULES.diveSpeed, "a dive exits the wind");
});
test("inside wind the cape glides upward instead of dashing level; a flight entering wind ends", () => {
  const column = { id: "u", x: 0, width: 400, top: 0, bottom: 800 };
  const s = fixture([], { updrafts: [{ ...column }] });
  Object.assign(s.player, { x: 20, y: 600, vy: 0, grounded: false, jumps: 1 });
  assert.equal(dash(s), false, "no level dash inside wind");
  assert.equal(capeReady(s), true, "and the charge is kept");
  update(s, 0.6, { glide: true });
  assert.ok(s.player.vy < -RULES.updraftRise, "holding the cape rises faster");
  const f = fixture([], { updrafts: [{ ...column, x: 300 }] });
  Object.assign(f.player, { x: 200, y: 600, vy: 0, grounded: false, jumps: 1 });
  assert.equal(dash(f), true);
  update(f, 0.3);
  assert.equal(f.dashRemaining, 0, "the wind takes over the flight");
  assert.ok(f.player.vy < 0);
  assert.ok(f.events.some((e) => e.name === "wind-catch"));
});
test("the first updraft is what carries the main route to the high shore", () => {
  const withWind = traverse("main").s;
  assert.equal(withWind.status, "won");
  const calm = traverse("main", 1 / 120, null, (g) => (g.updrafts = [])).s;
  assert.equal(calm.status, "dead");
  assert.equal(calm.checkpoint.id, "updraft");
  for (const n of IDS) for (const u of createLevel(n).updrafts) assert.ok(u.width >= 120 && u.width <= 180);
});

/* ---------- M6 super jump ---------- */
test("a jump during flight is a super jump, once per flight", () => {
  const s = start(game());
  jump(s);
  update(s, 0.3);
  dash(s);
  update(s, 0.1);
  assert.equal(jump(s), true);
  assert.equal(s.player.vy, -RULES.superJump);
  assert.equal(s.superJumps, 1);
  assert.equal(s.dashRemaining, 0, "the super jump ends the flight");
  update(s, 0.05);
  assert.equal(jump(s), false, "no extra jump after the super jump");
  // A new flight allows a new super jump.
  setAssist(s, "endlessCape", true);
  dash(s);
  update(s, 0.05);
  assert.equal(jump(s), true);
  assert.equal(s.superJumps, 2);
  const rise = (RULES.superJump * RULES.superJump) / (2 * RULES.gravity);
  assert.ok(rise > 165 && rise < 180);
});

/* ---------- M7 Great Fallen Stars ---------- */
test("a Great Star counts once Diana lands; a fall before that returns it to the sky", () => {
  const s = start(game());
  const g = s.pickups.find((q) => q.id === "great-1");
  Object.assign(s.player, { x: g.x, y: g.y + 36, vy: 0, grounded: false, jumps: 2 });
  s.anchorY = g.y;
  update(s, 1 / 120);
  assert.deepEqual(s.greatPending, ["great-1"]);
  s.player.y = s.anchorY + RULES.fallLimit + 1;
  update(s, 1 / 120);
  assert.equal(s.status, "dead");
  update(s, 1.2);
  assert.equal(s.status, "running");
  assert.equal(s.greatBanked.length, 0);
  assert.equal(s.pickups.find((q) => q.id === "great-1").collected, false);
});
test("a banked Great Star survives a later fall and retry", () => {
  const s = start(game());
  const g = s.pickups.find((q) => q.id === "great-1");
  Object.assign(s.player, { x: g.x, y: g.y + 36, vy: 0, grounded: false, jumps: 2 });
  update(s, 1 / 120);
  Object.assign(s.player, { x: g.x, y: 440, vy: 0 });
  update(s, 0.2); // lands on the star cache's floor at y=470
  assert.deepEqual(s.greatBanked, ["great-1"]);
  s.status = "dead";
  retry(s);
  assert.deepEqual(s.greatBanked, ["great-1"]);
  assert.equal(s.pickups.find((q) => q.id === "great-1").collected, true);
});
test("Great Stars are visible from the line the player is on and never gate the finish", () => {
  for (const n of IDS) {
    const w = createLevel(n);
    const greats = w.pickups.filter((q) => q.great);
    assert.equal(greats.length, 3, `L${n}`);
    for (const g of greats) {
      // Some platform of the line within one screen sees it inside the band.
      const seen = w.platforms.some((q) => {
        const band = visibleBand(q.y);
        return Math.abs(g.x - (q.x + q.width / 2)) < 700 && g.y > band.hudBottom && g.y < band.bottom - 20;
      });
      assert.ok(seen, `L${n} ${g.id}`);
    }
    assert.equal(traverse("main", 1 / 120, null, null, n).s.status, "won"); // zero Great Stars still wins
  }
});

/* ---------- map fairness, every level ---------- */
test("beacons are at most 14 s of real run apart and leave 400 px before the next required input", () => {
  for (const d of LEVELS) {
    const xs = [d.level.startX, ...d.checkpoints.map((c) => c.x), d.level.finishX];
    for (let i = 1; i < xs.length; i++) assert.ok(t(xs[i], xs[i - 1], d.id) <= 14, `L${d.id} beacon gap ${i}: ${t(xs[i], xs[i - 1], d.id).toFixed(2)} s`);
    const platforms = createLevel(d).platforms;
    for (const c of d.checkpoints) {
      const q = platforms.find((p) => p.id === c.platform);
      assert.equal(q.y, c.y, `L${d.id} ${c.id}`);
      assert.ok(c.x >= q.x && c.x < q.x + q.width, `L${d.id} ${c.id}`);
      assert.ok(!q.type, `L${d.id} ${c.id} stands on stable stone`);
      assert.ok(q.x + q.width - c.x >= 400, `L${d.id} ${c.id} runway`);
    }
  }
});
test("a beacon (or the level's start) sits right before the first required use of each mechanic", () => {
  const firstUse = {
    1: { "double-jump": gx(84), tap: gx(164) },
    2: { flight: 14982, constellation: 16157 + 37.85 * 35, updraft: 18047 + 37.85 * 35, glide: 21113.2, dive: 21491.7 + 37.85 * 64 },
    3: { fragile: 7190, cascade: 11477.2, dive: 14925, flight: 14982 + 37.85 * 70, constellation: 16147 + 37.85 * 70 },
    4: { "super-jump": gx(68) + 63.67, cascade: createLevel(4).platforms.find((q) => q.id === "tile-0").x, constellation: 16147 - 6988.46 },
  };
  for (const d of LEVELS)
    for (const [mechanic, x] of Object.entries(firstUse[d.id])) {
      const before = [{ id: "start", x: d.level.startX }, ...d.checkpoints].filter((c) => c.x < x).at(-1);
      assert.ok(t(x, before.x, d.id) <= 6, `L${d.id} ${mechanic}: ${t(x, before.x, d.id).toFixed(2)} s after ${before.id}`);
    }
});
/** Transitions carried by a solar-wind column are budgeted by the wind
 * (tested separately), not by the plain jump envelope. */
const windBetween = (n, a, b) =>
  createLevel(n).updrafts.some((u) => u.x >= a.x + a.width - 20 && u.x + u.width <= b.x + 20);
/** A stable line below the gap that catches a failed attempt. */
const catchUnder = (n, a, b) =>
  createLevel(n).platforms.some(
    (q) => !q.type && q.y > a.y && q.y - a.y < RULES.fallLimit - 10 && q.x < b.x && q.x + q.width > a.x + a.width,
  );
test("the title card (300/1600/500 ms of simulation time) never covers a required input", () => {
  for (const d of LEVELS) {
    const { result } = traverse("main", 1 / 120, null, null, d.id);
    const span = (CARD.fadeIn + CARD.hold + CARD.fadeOut) * d.level.speed;
    const from = d.level.startX + (d.cardDelay ?? CARD.wakeDelay) * d.level.speed;
    assert.ok(!d.prompts.some((q) => !q.optional && q.inputX >= from && q.inputX <= from + span), `L${d.id}`);
    assert.ok(!result.actions.some((a) => a.x >= from && a.x <= from + span), `L${d.id}: pilot input under the card`);
  }
});
test("main-route gaps and rises respect each level's authoring limits", () => {
  // L1's float allows a 180 px double rise; L4's super jump climbs 235 px;
  // L2's long void is crossed by two flights around a refill constellation.
  // L3's broken well is left by jump, double jump and flight (606 px).
  const limits = { 1: { rise: 180, gap: 400 }, 2: { rise: 165, gap: 400, void: 700 }, 3: { rise: 165, gap: 400, long: { "well-bottom": 610 } }, 4: { rise: 235, gap: 400 } };
  for (const n of IDS) {
    const chains = createLevel(n).pickups.filter((q) => q.chain);
    for (const [a, b] of mainPairs(n)) {
      const gap = b.x - (a.x + a.width),
        rise = a.y - b.y;
      // (A floor under a lid is reached by the dive through it.)
      const lid = createLevel(n).platforms.find((q) => q.type === "lid" && q.x <= b.x + 1 && q.x + q.width > b.x);
      if (gap <= 0 || windBetween(n, a, b) || lid) continue;
      const refill = chains.some((q) => q.x > a.x + a.width && q.x < b.x);
      assert.ok(rise <= limits[n].rise, `L${n} ${a.id}→${b.id} rise ${rise}`);
      assert.ok(gap <= (limits[n].long?.[a.id] ?? (refill && limits[n].void ? limits[n].void : limits[n].gap)), `L${n} ${a.id}→${b.id} gap ${gap}`);
      assert.ok(b.y - a.y <= 240, `L${n} ${a.id}→${b.id} drop`);
    }
  }
});
test("no blind landings: every required landing is in view when the input that commits to it is made", () => {
  const rejoin = {
    1: [["high-crown", "field"], ["float-3", "field"]],
    2: [["lid-2", "star-cache"], ["finale-rock", "low-a"]],
    3: [["chain-exit", "ridge-c"], ["crown-stair-2", "hearth"]],
    4: [["school-shore", "storm-step"], ["lid", "well-floor"], ["finale-crack", "low-a"]],
  };
  for (const d of LEVELS) {
    // The narrowest sky this level ever shows.
    const view = viewGeometry(Math.max(VIEW.portraitMinWidth, d.view?.portraitMinWidth ?? 0));
    const { result } = traverse("main", 1 / 120, null, null, d.id);
    for (const [a, b] of mainPairs(d.id)) {
      if (b.x <= a.x + a.width) continue;
      const takeoff = a.x + a.width,
        band = visibleBand(a.y);
      // The last pilot input before the landing (a second flight after a
      // refill commits later than the takeoff, and sees further).
      const commit = Math.max(takeoff - 60, ...result.actions.filter((q) => q.x < b.x && q.x >= takeoff - 60).map((q) => q.x));
      // (Wind and lids budget their own landings: the glide is steered in
      // view, and a floor under a lid is reached through it.)
      const lid = createLevel(d).platforms.find((q) => q.type === "lid" && q.x <= b.x + 1 && q.x + q.width > b.x);
      if (lid) continue;
      assert.ok(b.x + 40 - commit <= view.lookahead || catchUnder(d.id, a, b) || windBetween(d.id, a, b), `L${d.id} ${b.id} beyond lookahead`);
      assert.ok(b.y > band.hudBottom && b.y < band.bottom - 20, `L${d.id} ${b.id} outside the vertical view from ${a.id}`);
    }
    // Optional lines rejoin with their landing in view too.
    const all = createLevel(d).platforms;
    for (const [from, to] of rejoin[d.id]) {
      const a = all.find((q) => q.id === from),
        b = all.find((q) => q.id === to),
        band = visibleBand(a.y);
      assert.ok(b.y > band.hudBottom && b.y < band.bottom, `L${d.id} ${from}→${to}`);
      assert.ok(b.y - a.y < RULES.fallLimit - 10, `L${d.id} ${from}→${to} above the death line`);
    }
  }
});
test("optional platforms keep clear of the main route (F3): it only ever lands on its own line", () => {
  for (const n of IDS) {
    const { s } = traverse("main", 1 / 120, null, null, n);
    const high = new Set(s.platforms.filter((q) => q.route === "high").map((q) => q.id));
    const log = [];
    const g = start(game(n));
    let seen = 0;
    const api = adapter(g);
    const step = api.step;
    api.step = (dt, c) => {
      const r = step(dt, c);
      for (const e of g.events) if (e.serial > seen) (seen = e.serial), e.name === "land" || e.name === "lip-catch" ? log.push(e.platform) : 0;
      return r;
    };
    playRoute(api, { route: "main" });
    const strays = [...new Set(log.filter((id) => high.has(id)))];
    assert.deepEqual(strays, [], `L${n} main touched ${strays}`);
  }
});
test("fragile surfaces always telegraph and have a catch or a visible next step", () => {
  for (const d of LEVELS) {
    const all = createLevel(d).platforms;
    const view = viewGeometry(VIEW.portraitMinWidth);
    const ph = levelPhysics(d);
    assert.ok(ph.crumbleAfter / d.clock >= 0.35 && ph.cascadeShake / d.clock >= 0.35, `L${d.id}`);
    for (const q of all.filter((p) => p.type)) {
      const catchBelow = all.some(
        (p) => !p.type && p !== q && p.x < q.x + q.width && p.x + p.width > q.x && p.y > q.y && p.y - q.y < RULES.fallLimit,
      );
      const next = all.some((p) => p !== q && p.x > q.x + q.width && p.x - (q.x + q.width) < view.lookahead);
      assert.ok(catchBelow || next, `L${d.id} ${q.id}`);
    }
  }
});
test("every glyph prompt is on screen at least 1.5 s (real) before its latest valid input", () => {
  let required = 0;
  for (const d of LEVELS) {
    const { lookahead } = viewGeometry(Math.max(VIEW.portraitMinWidth, d.view?.portraitMinWidth ?? 0));
    const prompts = d.prompts;
    required += prompts.filter((q) => !q.optional).length;
    assert.ok(prompts.some((q) => !q.optional), `L${d.id} teaches with a glyph`);
    for (const q of prompts) {
      // Diana is 1.5 s (real) before the input; the glyph must already be on screen.
      const diana = q.inputX - 1.5 * d.clock * d.level.speed;
      assert.ok(q.x - diana <= lookahead - 20, `L${d.id} ${q.id} visible ${((lookahead - (q.x - diana)) / d.level.speed / d.clock).toFixed(2)} s late`);
      assert.ok(q.from < q.inputX && q.to >= q.inputX - 40, `L${d.id} ${q.id}`);
    }
  }
  assert.ok(required >= 8);
});
test("lookahead: ≥2.5 s (real) in landscape, ≥2.0 s in letterboxed portrait, at every level's speed", () => {
  for (const d of LEVELS)
    for (const [w, h] of [
      [960, 640],
      [1280, 720],
      [1920, 1080],
      [390, 844],
      [320, 568],
      [844, 390],
      [768, 1024],
      [600, 600],
      [1024, 768],
    ]) {
      const fit = fitStage(w, h, 60, d.view),
        view = viewGeometry(fit.logicalWidth),
        seconds = view.lookahead / (VIEW.runSpeed * d.clock);
      const where = `L${d.id} ${w}x${h}`;
      if (w / h < VIEW.minWidth / VIEW.height) {
        assert.equal(fit.layout, "portrait", where);
        assert.ok(seconds >= 2.0 - 1e-9, `${where}: ${seconds}`);
        assert.ok(h - 60 - fit.cssHeight >= VIEW.deckMin - 0.5, `${where}: a control deck remains below the sky`);
      } else {
        assert.equal(fit.layout, "landscape", where);
        assert.ok(seconds >= 2.5 - 1e-9, `${where}: ${seconds}`);
        assert.ok(fit.cssHeight <= h + 1e-9 && fit.top >= 0, where);
      }
    }
});
test("the vertical camera keeps apexes out of the HUD band and the death line near the view bottom", () => {
  // Highest possible rise: jump + double + flight + super jump.
  const maxRise = 106 + 92 + (RULES.superJump * RULES.superJump) / (2 * RULES.gravity);
  for (const n of IDS) {
    const all = createLevel(n);
    for (const q of all.platforms.filter((p) => p.route === "low")) {
      const apex = q.y - maxRise,
        top = clampCameraY(cameraTargetY(q.y), apex);
      assert.ok(apex - VIEW.bodyHeight - top >= VIEW.topBand, `L${n} ${q.id}`);
      const bottom = visibleBand(q.y).bottom,
        death = q.y + RULES.fallLimit;
      assert.ok(death >= bottom - 120 && death <= bottom + 100, `L${n} ${q.id} death ${death} vs view ${bottom}`);
    }
    for (const star of all.pickups) {
      const under = all.platforms
        .filter((q) => Math.abs(q.x + q.width / 2 - star.x) < q.width / 2 + 300 && q.y > star.y)
        .sort((a, b) => a.y - b.y)[0];
      if (!under) continue;
      assert.ok(star.y - visibleBand(under.y).top >= VIEW.topBand, `L${n} ${star.id}`);
    }
  }
  assert.ok(cameraTargetY(470, 2) - cameraTargetY(470, 0) === VIEW.lookDownMax);
  assert.equal(cameraTargetY(470, 0.3), cameraTargetY(470, 0));
});

/* ---------- respawn ---------- */
test("a fall returns control at the beacon within 1.2 s (real) and keeps a buffered jump", () => {
  for (const d of LEVELS) {
    const s = start(game(d.id));
    const cp = d.checkpoints[1];
    Object.assign(s.player, { x: cp.x + 5, y: cp.y, grounded: true });
    update(s, 0.02);
    assert.equal(s.checkpoint?.id, cp.id, `L${d.id}`);
    Object.assign(s.player, { x: cp.x + 300, y: cp.y + 400, grounded: false });
    update(s, 1 / 120);
    assert.equal(s.status, "dead");
    assert.equal(s.deaths, 1);
    let elapsed = 0;
    jump(s); // pressed while falling apart
    while (s.status !== "running" && elapsed < 3) {
      update(s, 1 / 120);
      elapsed += 1 / 120;
    }
    assert.ok(elapsed / d.clock <= 1.2, `L${d.id} back in control after ${(elapsed / d.clock).toFixed(3)} s real`);
    assert.equal(s.player.x > cp.x - 1 && s.player.x < cp.x + 20, true);
    assert.ok(s.player.vy < 0, "the buffered jump fired on the first controllable frame");
  }
});
test("manual retry restores the beacon snapshot and repairs shelves; restart clears it", () => {
  for (const n of [2, 3]) {
    const { s } = traverse("main", 1 / 120, null, null, n);
    const cp = s.checkpoint;
    s.status = "dead";
    retry(s);
    assert.equal(s.status, "running");
    assert.equal(s.player.x, cp.x);
    assert.equal(s.stars, cp.stars);
    assert.equal(capeReady(s), true);
    assert.deepEqual(s.checkpointsReached, cp.reached);
    assert.equal(s.platforms.filter((q) => q.collapsed).length, 0);
    const result = playRoute(adapter(s), { route: "main" });
    assert.equal(result.status, "won");
    restart(s);
    assert.equal(s.level, n, "a restart stays in its level");
    assert.equal(s.player.x, s.def.level.startX);
    assert.equal(s.checkpoint, null);
    assert.equal(s.ringsCrossed, 0);
  }
});
test("Star net returns Diana to her last ground once per beacon and restores what lies ahead", () => {
  const s = start(game(3));
  setAssist(s, "starNet", true);
  // Play L3's main route to the second split void, then fall on purpose.
  pilotTo(s, "main", 16560 + 37.85 * 70);
  assert.equal(s.status, "running");
  const stars = s.stars;
  Object.assign(s.player, { y: s.anchorY + RULES.fallLimit + 5 });
  update(s, 1 / 120);
  assert.equal(s.status, "dead");
  update(s, 1.4);
  assert.equal(s.status, "running");
  assert.ok(s.player.x < 16100 + 37.85 * 70 && s.player.x > 15400 + 37.85 * 70, `net at ${s.player.x}`);
  assert.equal(s.platforms.find((q) => q.id === "split-crack").collapsed, false);
  assert.ok(s.stars <= stars);
  assert.equal(s.starNetUsed, true);
  const result = playRoute(adapter(s), { route: "main" });
  assert.equal(result.status, "won");
});

/* ---------- portal ---------- */
test("portal crop matches actual visible original PNG pixels and stands on each level's door island", async () => {
  const pixels = visibleBounds(await readFile(new URL("../assets/portal.png", import.meta.url)));
  assert.deepEqual(manifest.portal.visibleBounds, pixels);
  for (const d of LEVELS) {
    const L = d.level;
    const p = portalPlacement(L.finishX, L.finishY, pixels);
    assert.equal(p.y + p.height, p.baseY);
    assert.ok(p.baseY >= p.groundY && p.baseY <= p.groundY + 4);
    const floor = createLevel(d).platforms.find((q) => L.finishX > q.x && L.finishX < q.x + q.width && q.y === L.finishY);
    assert.ok(floor, `L${d.id}`);
    assert.equal(floor.y, p.groundY);
    assert.ok(L.finishY + 3 >= outlineY(floor, L.finishX - floor.x));
  }
  assert.equal(LEVELS.filter((d) => d.level.earth).map((d) => d.id).join(), "4", "Earth waits behind the last door");
});

/* ---------- core movement and animation (kept from earlier revisions) ---------- */
test("what you see is what collides: airborne frames are drawn at the feet (F1)", async () => {
  const { measure, airborneFrames } = await import("../scripts/measure-feet.mjs");
  const lifts = await measure(manifest);
  const air = airborneFrames(manifest);
  assert.ok(air.length >= 12, `${air.length} airborne frames`);
  for (const { sheet, frame, clip } of air) {
    const foot = manifest[sheet].frames[frame].foot;
    assert.ok(Number.isFinite(foot), `${sheet}[${frame}] has a baked foot`);
    assert.ok(Math.abs(lifts[sheet][frame] - foot) <= 3, `${clip} ${sheet}[${frame}]: drawn ${(lifts[sheet][frame] - foot).toFixed(1)} px off the feet`);
  }
  // The air pose floated 34 px before; ground frames keep only their bob.
  assert.ok(lifts.air.every((v) => v > 30), "the source art really is lifted");
  for (const clip of ["run", "idle", "softLanding", "dive"]) {
    for (const q of manifest.animations[clip].frames) {
      const v = lifts[q.sheet][q.frame];
      if (v < 60) assert.ok(v <= 8 && !manifest[q.sheet].frames[q.frame].foot, `${clip} ${q.sheet}[${q.frame}] ${v}`);
    }
  }
  const js = await read("game.js");
  assert.match(js, /p\.y \+ footFor\(manifest, anim\.name, anim\.age\)/, "the renderer applies the offset");
});
test("body and cape are separate source layers; transition clips hold and loops repeat", () => {
  const l = characterLayers(manifest, "dash", 0.2);
  assert.equal(l.length, 2);
  assert.equal(l[0].sheet, "bodyDash");
  assert.equal(l[1].sheet, "dash");
  assert.equal(manifest.dash.frames[0].pivotX, 0.8);
  for (const name of ["jump", "softLanding", "hardLanding", "start", "stop"]) {
    const f = manifest.animations[name].frames.at(-1);
    assert.deepEqual(frameForClip(manifest, name, 10), { sheet: f.sheet, frame: f.frame });
  }
  assert.deepEqual(frameForClip(manifest, "run", 0.05), frameForClip(manifest, "run", manifest.animations.run.duration + 0.05));
  assert.equal(manifest.animations.sprout.frames.length, 18);
  for (const name of ["cadent1", "cadent2"]) assert.ok(manifest.animations[name].frames.length > 10);
});
test("ready/pause freeze simulation and action-age animation", () => {
  const s = createGame();
  update(s, 2);
  assert.equal(s.player.x, s.def.level.startX);
  start(s);
  update(s, 0.4);
  togglePause(s);
  const before = snapshot(s);
  update(s, 2);
  assert.equal(s.player.x, before.player.x);
  assert.equal(s.animation.age, before.animation.age);
});
test("jump release shortens the arc; a buffered tap stays a tap", () => {
  function pendingJump(released) {
    const s = start(createGame());
    Object.assign(s.player, { y: 535, vy: 200, jumps: 2, grounded: false });
    s.coyote = 0;
    assert.equal(jump(s), false);
    if (released) releaseJump(s);
    update(s, 0.04);
    assert.equal(s.player.jumps, 1);
    assert.ok(s.player.vy < 0);
    return s;
  }
  const tap = pendingJump(true),
    held = pendingJump(false);
  assert.ok(tap.player.vy >= -RULES.tapCap);
  assert.ok(held.player.vy < -500);
  const s = start(createGame());
  jump(s);
  update(s, 0.06);
  const v = s.player.vy;
  releaseJump(s);
  assert.ok(s.player.vy > v);
});
test("a press just before touch-down is a ground jump even with the double in hand; releases count behind pause and respawn", () => {
  // Falling onto stone 60 ms before touch-down with the double still there.
  const s = fixture([{ id: "floor", x: 0, y: 540, width: 3000 }]);
  Object.assign(s.player, { y: 520, vy: 300, grounded: false, jumps: 1 });
  s.coyote = 0;
  s.launched = true;
  assert.equal(jump(s), false, "waits for the landing");
  update(s, 0.1);
  assert.equal(s.player.jumps, 1, "a ground jump: the double is still in hand");
  assert.ok(s.player.vy < -500);
  // Far above any stone it is the double jump at once.
  const high = fixture([{ id: "floor", x: 0, y: 540, width: 3000 }]);
  Object.assign(high.player, { y: 300, vy: 100, grounded: false, jumps: 1 });
  high.coyote = 0;
  assert.equal(jump(high), true);
  assert.equal(high.player.jumps, 2);
  // Opening the cape drops the waiting press (it never fires mid-flight).
  const cape = fixture([{ id: "floor", x: 0, y: 540, width: 3000 }]);
  Object.assign(cape.player, { y: 520, vy: 300, grounded: false, jumps: 1 });
  cape.coyote = 0;
  jump(cape);
  assert.equal(dash(cape), true);
  update(cape, 0.4);
  assert.equal(cape.superJumps, 0);
  assert.equal(cape.player.jumps, 1);
  // A release while paused cuts the jump; a press and release while falling
  // apart respawns as a tap.
  const p = fixture([{ id: "floor", x: 0, y: 540, width: 3000 }]);
  jump(p);
  togglePause(p);
  releaseJump(p);
  togglePause(p);
  assert.equal(p.player.vy, -RULES.tapCap);
  const d = start(game());
  Object.assign(d.player, { y: 1300, grounded: false });
  update(d, 1 / 120);
  assert.equal(d.status, "dead");
  jump(d);
  releaseJump(d);
  while (d.status !== "running") update(d, 1 / 120);
  assert.equal(d.player.vy, -RULES.tapCap, "the queued press respawns as a tap");
});
test("ascending never snaps to a platform; large time chunks still resolve thin landings", () => {
  const s = fixture([{ id: "fixture", x: 200, y: 450, width: 700 }]);
  Object.assign(s.player, { y: 480, vy: -500, grounded: false, jumps: 1 });
  s.anchorY = 450;
  update(s, 0.05);
  assert.equal(s.player.grounded, false);
  assert.ok(s.player.y > 450);
  update(s, 0.7);
  assert.equal(s.player.grounded, true);
  assert.equal(s.player.y, 450);
});
test("pickup collision scores once and invalid elapsed time cannot poison the world", () => {
  const s = start(createGame());
  s.pickups = [{ id: "x", x: 225, y: 504, collected: false, route: "high" }];
  update(s, 0.01);
  update(s, 0.01);
  assert.equal(s.stars, 1);
  assert.equal(s.highStars, 1);
  for (const dt of [-1, NaN, Infinity]) assert.throws(() => update(s, dt), RangeError);
});
test("cracked shelves collapse while Diana is still on them and keep coyote grace", () => {
  // L3: cracks break 5/16 (0.70 s of simulation) after touch-down.
  const s = start(game(3));
  const q = s.platforms.find((p) => p.id === "first-crack");
  Object.assign(s.player, { x: q.x + 20, y: q.y, grounded: true });
  s.anchorY = q.y;
  update(s, 0.69);
  assert.equal(q.collapsed, false, "not before 5/16");
  update(s, 0.03);
  assert.equal(q.collapsed, true);
  assert.ok(s.player.x < q.x + q.width);
  assert.ok(s.coyote > 0);
  assert.equal(jump(s), true);
  const fall = start(game(3));
  const f = fall.platforms.find((p) => p.id === "first-crack");
  const floor = fall.platforms.find((p) => p.id === "crack-floor");
  Object.assign(fall.player, { x: f.x + 20, y: f.y, grounded: true });
  fall.anchorY = f.y;
  update(fall, 1.2);
  assert.equal(fall.status, "running");
  assert.equal(fall.player.y, floor.y, "the floor beneath catches the first break");
});

/* ---------- forgiveness, glyphs, stars ---------- */
test("lip catch: a jump that arrives up to 30 px below a lip pops onto it; walk-offs and deep misses do not", () => {
  // The step-up needs 4 px of the collider over the top, so arriving at the
  // lip it fires a tick or two in, while the feet are still within 30 px.
  const make = (below, opts = {}) => {
    const s = fixture([
      { id: "from", x: 0, y: 500, width: 300 },
      { id: "to", x: 600, y: 430, width: 300 },
    ]);
    Object.assign(s.player, { x: 600 - 16 - 1, y: 430 + below, vy: opts.vy ?? 120, grounded: false, jumps: 1 });
    s.anchorY = 500;
    s.launched = opts.launched ?? true;
    update(s, 1 / 20);
    return s;
  };
  const near = make(15);
  assert.equal(near.player.grounded, true);
  assert.equal(near.player.y, 430);
  assert.equal(near.lipCatches, 1);
  assert.equal(make(32).player.grounded, false, "too deep");
  assert.equal(make(15, { launched: false }).player.grounded, false, "walking off never earns it");
  assert.equal(make(15, { vy: -300 }).player.grounded, false, "not while she can still clear it herself");
});
test("step-up: an approach from below that tops out within 30 px of the top lands; clearly short ones never do", () => {
  // User report: "it looks like you made it, but you don't go up". Sweep
  // shelves above a floor, takeoffs from well before the lip to deep under
  // the shelf, held, tapped and double jumps; track how close the feet came
  // to the top while the body was over the shelf.
  const shelfX = 1000;
  let landed = 0,
    short = 0,
    assisted = 0;
  for (const rise of [40, 70, 90, 100, 104, 108, 112, 116, 120, 124, 128, 132, 140, 160, 180, 200])
    for (const dx of [-200, -150, -110, -80, -50, -20, 10, 40, 90])
      for (const kind of ["held", "tap", "double"]) {
        const top = 600 - rise;
        const s = fixture([
          { id: "floor", x: 0, y: 600, width: 3000 },
          { id: "shelf", x: shelfX, y: top, width: 400 },
        ]);
        Object.assign(s.player, { x: shelfX + dx - 80, y: 600, grounded: true });
        s.anchorY = 600;
        let jumped = false,
          doubled = kind !== "double",
          closest = Infinity,
          closestAir = Infinity,
          lipClosest = Infinity,
          result = null;
        for (let i = 0; i < 300 && s.status === "running"; i++) {
          const p = s.player;
          if (!jumped && p.x >= shelfX + dx) {
            jump(s);
            if (kind === "tap") releaseJump(s);
            jumped = true;
          } else if (jumped && !doubled && p.vy > -60) (jump(s), (doubled = true));
          update(s, 1 / 120);
          if (!jumped) continue;
          const overlap = Math.min(p.x + 16, shelfX + 400) - Math.max(p.x - 16, shelfX);
          const depth = p.y - top;
          if (overlap >= RULES.stepUpOverlap) closest = Math.min(closest, depth);
          if (overlap >= RULES.stepUpOverlap && !p.grounded) closestAir = Math.min(closestAir, depth);
          if (overlap > 0) lipClosest = Math.min(lipClosest, depth);
          if (p.grounded) {
            result = Math.abs(p.y - top) < 0.01 ? "shelf" : "floor";
            break;
          }
        }
        const where = `rise ${rise} dx ${dx} ${kind}: closest ${closest.toFixed(1)} px`;
        if (closest <= RULES.stepUpDepth) {
          assert.equal(result, "shelf", `${where} looked landed but fell back`);
          landed++;
          if (closestAir > 0 && Number.isFinite(closestAir)) assisted++; // never above the top: the assist did it
        } else if (Number.isFinite(lipClosest) && lipClosest > RULES.lipDepth + 1) {
          assert.notEqual(result, "shelf", `${where} was clearly short but stepped up`);
          short++;
        }
      }
  assert.ok(assisted >= 20 && landed >= 100 && short >= 40, `${landed} landed (${assisted} by the assist), ${short} short`);
  // Walking off an edge and diving never earn it.
  const walk = fixture([
    { id: "high", x: 0, y: 480, width: 500 },
    { id: "shelf", x: 500, y: 470, width: 300 },
  ]);
  Object.assign(walk.player, { x: 490, y: 490, vy: 50, grounded: false, jumps: 1 });
  walk.anchorY = 480;
  walk.launched = false;
  update(walk, 0.2);
  assert.equal(walk.stepUps ?? 0, 0, "no step-up without a jump or flight");
  const diver = fixture([{ id: "shelf", x: 0, y: 470, width: 400 }]);
  Object.assign(diver.player, { x: 200, y: 480, vy: -50, grounded: false, jumps: 1 });
  diver.launched = true;
  diver.anchorY = 600;
  dive(diver);
  update(diver, 0.05);
  assert.equal(diver.stepUps ?? 0, 0, "a dive never steps up");
  // No main route needs it (their takeoffs and landings are on the grid).
  for (const n of IDS) assert.equal(traverse("main", 1 / 120, null, null, n).s.stepUps ?? 0, 0, `L${n}`);
});
test("step-up bounds: 30 px on the span and at the lip, 24 in flight, 4 px of overlap; never collapsing, noPop or right after a smash", () => {
  // RESEARCH_PROGRESSION 7 (no visible lip sink): an apex up to about 30 px
  // under a top inside its span steps up, so the toe is never drawn through it.
  // Place Diana at her apex (vy = 0, so she cannot clear the top herself)
  // with her feet `depth` px under a top, `into` px past its left lip.
  const probe = (depth, into, opts = {}) => {
    const s = fixture([{ id: "top", x: 1000, y: 400, width: 400, ...(opts.platform ?? {}) }]);
    Object.assign(s.player, { x: 1000 + into - 16, y: 400 + depth, vy: 0, grounded: false, jumps: 1 });
    s.anchorY = 600;
    s.launched = true;
    s.speed = 0;
    if (opts.flight) s.dashRemaining = 0.3;
    if (opts.smash) s.lastSmashAt = s.time;
    update(s, 1 / 120);
    return s.player.grounded && Math.abs(s.player.y - 400) < 1e-6;
  };
  for (const d of [1, 10, 19.5, 29.5]) assert.ok(probe(d, 200), `span ${d}`);
  assert.ok(!probe(31, 200), "31 px on the span is short");
  assert.ok(probe(29.5, 20), "30 px within the lip's first 40 px");
  assert.ok(!probe(31, 20), "31 px at the lip is short");
  assert.ok(probe(23.5, 200, { flight: true }), "24 px during a flight");
  assert.ok(!probe(25.5, 200, { flight: true }), "25 px in flight is short");
  assert.ok(probe(10, 5), "5 px of overlap is over the top");
  assert.ok(!probe(10, 3), "under 4 px of overlap is not over the top");
  assert.ok(!probe(10, 200, { platform: { type: "crumble", crumbleAfter: 0.65, triggeredAt: 0 } }), "never onto a breaking shelf");
  assert.ok(!probe(10, 200, { platform: { noPop: true } }), "never onto a platform authored noPop");
  assert.ok(!probe(10, 200, { smash: true }), "never right after a smash");
});
test("fixed step: the same input gives the same arc at 30, 60, 120, 144 and 240 Hz (F4)", () => {
  const landings = [30, 60, 120, 144, 240].map((hz) => {
    const s = fixture([
      { id: "floor", x: 0, y: 600, width: 3000 },
      { id: "shelf", x: 900, y: 520, width: 300 },
    ]);
    Object.assign(s.player, { x: 700, y: 600, grounded: true });
    s.anchorY = 600;
    let jumped = false;
    for (let i = 0; i < hz * 3 && !(jumped && s.player.grounded && s.time > 0.6); i++) {
      if (!jumped && Math.abs(s.time - 0.5) < 1e-6) (jump(s), (jumped = true));
      update(s, 1 / hz);
    }
    return { hz, x: s.player.x, y: s.player.y, t: s.time };
  });
  for (const l of landings) {
    assert.ok(Math.abs(l.x - landings[0].x) < 0.01 && Math.abs(l.t - landings[0].t) < 1e-9 && l.y === landings[0].y, `${l.hz} Hz lands at ${l.x.toFixed(3)} / ${l.t.toFixed(4)} s, not ${landings[0].x.toFixed(3)} / ${landings[0].t.toFixed(4)}`);
  }
  assert.equal(landings[0].y, 520, "on the shelf");
});
test("crisp input: a press acts in the same step at any frame rate and every level's arc is identical at 30/60/120/240 Hz", () => {
  for (const n of IDS)
    for (const hz of [30, 60, 120, 240]) {
      const s = start(game(n));
      s.platforms = [{ id: "floor", x: -1000, y: 540, width: 1600, phase: 0, route: "low", crumbleAfter: null, triggeredAt: null, collapseAt: null, collapsed: false, cascade: null }];
      s.updrafts = [];
      Object.assign(s.player, { x: 220, y: 540, grounded: true });
      update(s, 0.013); // land the press between two ticks
      assert.equal(jump(s), true);
      assert.equal(s.player.vy, -s.physics.jump, `L${n} ${hz} Hz: the jump speed is set by the press itself`);
      const y0 = s.player.y;
      update(s, 1 / 120);
      assert.ok(s.player.y < y0, `L${n} ${hz} Hz: she is rising on the next tick`);
    }
  // The same held jump traces the same arc at every rate (fixed 1/120 s
  // step), including L1's apex hang and fall cap.
  for (const n of IDS) {
    const arcs = [30, 60, 120, 240].map((hz) => {
      const s = start(game(n));
      s.platforms = [{ id: "floor", x: -1000, y: 540, width: 1230, phase: 0, route: "low", crumbleAfter: null, triggeredAt: null, collapseAt: null, collapsed: false, cascade: null }];
      s.updrafts = [];
      Object.assign(s.player, { x: 220, y: 540, grounded: true });
      jump(s);
      // y by simulation tick, sampled wherever a call ends on a 1/30 s tick.
      const ys = new Map();
      for (let i = 0; i < 1.2 * hz; i++) {
        update(s, 1 / hz);
        const tick = Math.round(s.time * 120);
        if (tick % 4 === 0) ys.set(tick, +s.player.y.toFixed(6));
      }
      return ys;
    });
    for (const [tick, y] of arcs[0]) for (const a of arcs.slice(1)) assert.equal(a.get(tick), y, `L${n} tick ${tick}`);
  }
});
test("inputs act at their own timestamps: the frame clock and game.js catch the simulation up to each event", async () => {
  const fc = createFrameClock({ maxStep: 0.1 });
  assert.equal(fc.advance(1000), 0, "the first timestamp only starts the clock");
  assert.ok(Math.abs(fc.advance(1016.5) - 0.0165) < 1e-12);
  assert.equal(fc.advance(1010), 0, "an older event never runs time backwards");
  assert.equal(fc.advance(1600), 0.1, "a stall is clamped (the world slows, it does not jump)");
  // A press 13 ms into a 33 ms frame takes off on the tick it was made in,
  // as at 120 Hz, not at the frame's start.
  const at = (frameMs) => {
    const s = start(game(2));
    const clock = createFrameClock();
    clock.advance(0);
    for (let t = frameMs; t < 500; t += frameMs) update(s, clock.advance(t));
    const t0 = Math.floor(500 / frameMs) * frameMs;
    update(s, clock.advance(t0 + 13));
    jump(s);
    return s.events.at(-1).x;
  };
  assert.equal(at(1000 / 30), at(1000 / 120));
  const js = await read("game.js");
  assert.match(js, /function atInput\(e\)[^]*?advanceTo\(e\.timeStamp\)/);
  assert.ok((js.match(/atInput\(e\)/g) ?? []).length >= 6, "keys, touch buttons and the mouse");
});
test("the first gap forgives a first input (a held jump or a 0 ms tap clears it) but still needs one", async () => {
  const { followGlyph } = await import("./glyphs.mjs");
  const p = levelDef(1).prompts.find((q) => q.id === "p-jump");
  const w = createLevel(1).platforms;
  const gap = w.find((q) => q.id === "drift-a").x - (w.find((q) => q.id === "home").x + w.find((q) => q.id === "home").width);
  assert.ok(gap <= 110, `first gap ${gap} px`);
  // Walking off without any input misses the next island.
  const idle = start(game(1));
  for (let i = 0; i < 900 && idle.status === "running"; i++) update(idle, 1 / 120);
  assert.equal(idle.status, "dead", "the first jump is required");
  assert.ok(idle.player.x < gx(31));
  for (const [at, tap] of [
    [p.from, false],
    [p.inputX, false],
    [p.from, true],
    [p.inputX, true],
  ]) {
    const r = followGlyph(adapter(start(game(1))), p, { start: at, tap });
    assert.equal(r.status, "running", `start ${at} tap ${tap}`);
  }
});
test("following each glyph at its first valid moment succeeds (required ones also at the last), every level", async () => {
  const { followGlyph } = await import("./glyphs.mjs");
  for (const d of LEVELS)
    for (const q of d.prompts) {
      const route = q.optional ? q.route : "main";
      for (const at of q.optional ? ["from"] : ["from", "inputX"]) {
        const r = followGlyph(adapter(start(game(d.id))), q, { route, at });
        assert.equal(r.status, "running", `L${d.id} ${q.id} at ${at} (${r.phase} x=${Math.round(r.x)})`);
        assert.equal(r.phase, "after", `L${d.id} ${q.id} at ${at} was followed`);
      }
    }
});
test("the updraft cluster never shows more than one glyph at once", () => {
  const prompts = createLevel(2).prompts;
  for (let x = 17400; x <= 18800; x += 5) {
    const shown = shownPrompts(prompts, x).filter((q) => q.x > 17900 && q.x < 18800);
    assert.ok(shown.length <= 1, `${x}: ${shown.map((q) => q.id)}`);
  }
  // Each later one appears once the earlier is done.
  const done = prompts.map((q) => ({ ...q, done: q.id === "p-updraft" }));
  assert.ok(shownPrompts(done, 18090).some((q) => q.id === "p-wind"));
});
test("every star is reachable (some pilot collects it) and none sits inside an island, every level", () => {
  for (const n of IDS) {
    const got = new Set();
    for (const route of ["main", "upper", "ability", "safe"])
      for (const q of traverse(route, 1 / 120, null, null, n).s.pickups) if (q.collected) got.add(q.id);
    const w = createLevel(n);
    const missing = w.pickups.filter((q) => !got.has(q.id)).map((q) => q.id);
    assert.deepEqual(missing, [], `L${n}`);
    for (const star of w.pickups)
      for (const p of w.platforms)
        assert.ok(
          !(star.x > p.x - 4 && star.x < p.x + p.width + 4 && star.y > p.y - 12 && star.y < p.y + 64),
          `L${n} ${star.id} inside ${p.id}`,
        );
  }
});

/* ---------- UI contract (static) ---------- */
test("UI: no small type, no olive palette, no canvas text and none of the removed labels", async () => {
  const css = await read("style.css"),
    js = await read("game.js"),
    html = await read("index.html");
  for (const m of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(Number(m[1]) >= 16, `font-size ${m[1]}px`);
  for (const olive of ["#8c9877", "#b7c899", "#687d4c", "#3e4932", "#adb994"]) {
    assert.ok(!css.toLowerCase().includes(olive) && !js.toLowerCase().includes(olive), olive);
  }
  for (const token of ["--ink: #0c0c0f", "--paper: #fbfbea", "--hill: #cecec1", "--mute: #aeaea3", "--dim: #777771", "--earth: #6fa8dc"])
    assert.ok(css.includes(token), token);
  assert.ok(!/fillText|strokeText/.test(js), "world labels are glyphs, not canvas text");
  for (const removed of ["CAPE RECHARGE", "WIND GIVEN", "FRAGILE", "LIGHT REMEMBERED", "HIGH STAR TRAIL", "DIVE TO THE STAR WELL", "BEST JOURNEY", "EARTH IS OUT THERE", "FOLLOWING THE SIGNAL", "cape-fill", "distance"])
    assert.ok(!html.includes(removed) && !js.includes(`"${removed}`), removed);
  for (const id of ['id="start"', 'id="game"', 'id="touch-jump"', 'id="touch-cape"', 'id="touch-dive"', 'id="pause"'])
    assert.ok(html.includes(id), id);
  assert.ok(!html.includes("✦") && !js.includes("✦"), "the font has no ✦; stars are drawn");
  assert.ok(js.includes("Need a hand? Assists are in the pause menu."));
});
test("the unreferenced duplicate jump-landing.png stays in source but out of the itch ZIP", async () => {
  const exporter = await read("package-itch.mjs");
  assert.match(exporter, /'assets\/jump-landing\.png'/);
  const referenced = Object.values(manifest).filter((v) => v?.file).map((v) => v.file);
  assert.ok(!referenced.includes("assets/jump-landing.png"));
  for (const name of ["index.html", "game.js", "style.css", "embed.js", "embed.css", "model.mjs", "level.mjs"])
    assert.ok(!(await read(name)).includes("jump-landing"), name);
});
