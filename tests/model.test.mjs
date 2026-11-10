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
} from "../model.mjs";
import {
  LEVEL,
  BEAT,
  CARD,
  CHECKPOINTS,
  MOVEMENTS,
  createLevel,
  shownPrompts,
} from "../level.mjs";
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
import { playRoute } from "./routes.mjs";
import { visibleBounds } from "./png.mjs";
const manifest = JSON.parse(
  await readFile(new URL("../assets/manifest.json", import.meta.url)),
);
const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const t = (x) => (x - LEVEL.startX) / LEVEL.speed; // nominal run time of x

function adapter(s, block) {
  return {
    getState: () => snapshot(s),
    step: (dt, c) => {
      update(s, dt, c);
      return snapshot(s);
    },
    jump: () => (block === "double" && !s.player.grounded ? false : jump(s)),
    releaseJump: () => releaseJump(s),
    dash: () => (block === "dash" ? false : dash(s)),
    dive: () => (block === "dive" ? false : dive(s)),
  };
}
function traverse(route = "main", dt = 1 / 120, block, setup) {
  const s = start(createGame());
  setup?.(s);
  const result = playRoute(adapter(s, block), { route, dt });
  return { s, result };
}
/** A tiny isolated world for rule fixtures. */
function fixture(platforms, extra = {}) {
  const s = start(createGame());
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
const mainPlatforms = () =>
  createLevel()
    .platforms.filter((q) => q.route === "low")
    .sort((a, b) => a.x - b.x);

/* ---------- complete routes ---------- */
test("main, upper (all three Great Stars), ability and safe routes win at 30/60/120/240 Hz", () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 120, 1 / 240])
    for (const route of ["main", "upper", "ability", "safe"]) {
      const { s } = traverse(route, dt);
      assert.equal(s.status, "won", `${route} at ${Math.round(1 / dt)} Hz`);
      assert.equal(s.deaths, 0);
      assert.ok(s.time < 84, `${route} took ${s.time}`);
      if (route === "upper") assert.equal(s.greatBanked.length, 3);
    }
});
test("the main route reaches every beacon and uses the taught kit through public actions", () => {
  const { s, result } = traverse("main");
  assert.equal(s.player.x, LEVEL.finishX);
  assert.deepEqual(
    s.checkpointsReached,
    CHECKPOINTS.map((q) => q.id),
  );
  const count = (a) => result.actions.filter((q) => q.action === a).length;
  assert.ok(count("dash") >= 5);
  assert.ok(s.constellationsDone >= 5);
  assert.equal(s.ringsCrossed, s.constellationsDone);
  assert.ok(s.stars >= 40);
  assert.ok(s.platforms.some((q) => q.cascade && q.collapsed));
});
test("ability route smashes the lid, glides in the wind and keeps two refills for the QA contract", () => {
  const { s, result } = traverse("ability");
  assert.equal(s.status, "won");
  assert.ok(s.smashes >= 1);
  assert.ok(s.greatBanked.includes("great-2"));
  assert.ok(result.actions.some((q) => q.action === "dive"));
  assert.ok(result.actions.some((q) => q.action === "releaseJump"));
  assert.ok(s.ringsCrossed >= 2);
});
test("removing one taught action fails exactly at the challenge that teaches it", () => {
  const noDouble = traverse("main", 1 / 120, "double").s;
  assert.equal(noDouble.status, "dead");
  assert.ok(noDouble.player.x > 3350 && noDouble.player.x < 3650, `no double: ${noDouble.player.x}`);
  assert.equal(noDouble.checkpoint.id, "leap");
  const noCape = traverse("main", 1 / 120, "dash").s;
  assert.equal(noCape.status, "dead");
  assert.ok(noCape.player.x > 15060 && noCape.player.x < 15460, `no cape: ${noCape.player.x}`);
  assert.equal(noCape.checkpoint.id, "hearth");
});
test("missing the required midair constellation leaves the cape spent over the second void", () => {
  const { s } = traverse("main", 1 / 120, null, (g) => {
    // Remove only the last star of the split constellation (fixture edit).
    g.pickups = g.pickups.filter((q) => q.id !== "split-song-4");
  });
  assert.equal(s.status, "dead");
  assert.equal(s.checkpoint.id, "voids");
  assert.ok(s.player.x > 16590 && s.player.x < 16960);
});

/* ---------- M1 cape rule ---------- */
test("cape rule defaults to one flight per airtime", () => {
  assert.equal(RULES.capeRule, "landing");
  const s = start(createGame());
  assert.equal(dash(s), false, "grounded cape does nothing");
  jump(s);
  update(s, 0.2);
  assert.equal(dash(s), true);
  assert.equal(snapshot(s).capeSpent, true);
  assert.equal(snapshot(s).capeCharges, 0);
  update(s, 0.6);
  assert.equal(dash(s), false, "a second flight needs a refill");
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
  const s = start(createGame());
  const cp = CHECKPOINTS[0];
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
  const s = start(createGame(2021, { capeRule: "cooldown" }));
  jump(s);
  update(s, 0.2);
  assert.equal(dash(s), true);
  assert.ok(snapshot(s).dashCooldown > 5);
  update(s, 1);
  assert.equal(dash(s), false);
});
test("Endless cape assist never spends the cape", () => {
  const s = start(createGame());
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
test("every lid in the level has a catch 140–220 px below it", () => {
  const all = createLevel().platforms;
  for (const lid of all.filter((q) => q.type === "lid")) {
    assert.ok(lid.width >= 160 && lid.width <= 260);
    const catches = all.filter(
      (q) => q !== lid && q.x < lid.x + lid.width && q.x + q.width > lid.x && q.y - lid.y >= 140 && q.y - lid.y <= 220,
    );
    assert.ok(catches.length, lid.id);
  }
});

/* ---------- M3 constellations ---------- */
test("constellations: 4–6 stars on the route, completed in order, a miss costs nothing", () => {
  const w = createLevel();
  for (const c of w.chains) {
    assert.ok(c.count >= 4 && c.count <= 6, c.id);
    const stars = w.pickups.filter((q) => q.chain === c.id).sort((a, b) => a.index - b.index);
    for (let i = 1; i < stars.length; i++) assert.ok(stars[i].x > stars[i - 1].x, `${c.id} runs forward`);
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
  // The only required chain is split-song (tested above); its beacon is the
  // last one before it and within 6 s of nominal run.
  const stars = createLevel().pickups.filter((q) => q.chain === "split-song");
  const before = CHECKPOINTS.filter((c) => c.x < stars[0].x).at(-1);
  assert.equal(before.id, "voids");
  assert.ok(t(stars[0].x) - t(before.x) < 6);
});

/* ---------- M4 beat cascade ---------- */
test("the beat cascade drops a tile on every 107 BPM beat and closes in on the bouncing line", () => {
  const s = start(createGame());
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
  assert.equal(traverse("main").s.status, "won");
  const late = start(createGame());
  const plan = adapter(late);
  playRoute(plan, { route: "main", maxSeconds: t(11800) });
  const tiles = late.platforms.filter((q) => q.cascade).sort((a, b) => a.x - b.x);
  // From here, hop 24 px after each edge (inside coyote time) and never use
  // the second jump as a rescue: the wave catches this runner on the last tiles.
  let next = 0;
  for (let i = 0; i < 2400 && late.status === "running" && late.player.x < 13400; i++) {
    const p = late.player;
    if (next < tiles.length && p.x >= tiles[next].x + tiles[next].width + 24) {
      if (p.grounded || late.coyote > 0) jump(late);
      next++;
    }
    update(late, 1 / 120);
  }
  assert.equal(late.status, "dead");
  assert.ok(late.player.x > tiles[3].x && late.player.x < 13300, `caught at ${late.player.x}`);
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
  for (const u of createLevel().updrafts) assert.ok(u.width >= 120 && u.width <= 180);
});

/* ---------- M6 super jump ---------- */
test("a jump during flight is a super jump, once per flight", () => {
  const s = start(createGame());
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
  const s = start(createGame());
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
  const s = start(createGame());
  const g = s.pickups.find((q) => q.id === "great-1");
  Object.assign(s.player, { x: g.x, y: g.y + 36, vy: 0, grounded: false, jumps: 2 });
  update(s, 1 / 120);
  Object.assign(s.player, { x: 4150, y: 300, vy: 0 });
  update(s, 0.2); // lands on the ledge at y=320
  assert.deepEqual(s.greatBanked, ["great-1"]);
  s.status = "dead";
  retry(s);
  assert.deepEqual(s.greatBanked, ["great-1"]);
  assert.equal(s.pickups.find((q) => q.id === "great-1").collected, true);
});
test("Great Stars are visible from the line the player is on and never gate the finish", () => {
  const w = createLevel();
  const greats = w.pickups.filter((q) => q.great);
  assert.equal(greats.length, 3);
  for (const g of greats) {
    // Some main-route platform within one screen sees it inside the band.
    const seen = mainPlatforms().some((q) => {
      const band = visibleBand(q.y);
      return Math.abs(g.x - (q.x + q.width / 2)) < 700 && g.y > band.hudBottom && g.y < band.bottom - 20;
    });
    assert.ok(seen, g.id);
  }
  assert.equal(traverse("main").s.status, "won"); // zero Great Stars still wins
});

/* ---------- map fairness ---------- */
test("beacons are at most 14 s of run apart and leave 400 px before the next required input", () => {
  const xs = [LEVEL.startX, ...CHECKPOINTS.map((c) => c.x), LEVEL.finishX];
  for (let i = 1; i < xs.length; i++) assert.ok(t(xs[i]) - t(xs[i - 1]) <= 14, `beacon gap ${i}: ${t(xs[i]) - t(xs[i - 1])}`);
  const platforms = createLevel().platforms;
  for (const c of CHECKPOINTS) {
    const q = platforms.find((p) => p.id === c.platform);
    assert.equal(q.y, c.y);
    assert.ok(c.x >= q.x && c.x < q.x + q.width);
    assert.ok(!q.type, `${c.id} stands on stable stone`);
    assert.ok(q.x + q.width - c.x >= 400, `${c.id} runway`);
  }
});
test("a beacon sits right before the first required use of each mechanic", () => {
  const firstUse = {
    "double-jump": 3324,
    fragile: 7900,
    cascade: createLevel().platforms.find((q) => q.id === "tile-0").x,
    flight: 14982,
    constellation: 16147,
    updraft: 18047,
  };
  for (const [mechanic, x] of Object.entries(firstUse)) {
    const before = CHECKPOINTS.filter((c) => c.x < x).at(-1);
    assert.ok(t(x) - t(before.x) <= 6, `${mechanic}: ${t(x) - t(before.x)} s after ${before.id}`);
  }
});
test("three movements, a coda, and about 80 s of nominal run", () => {
  assert.deepEqual(
    MOVEMENTS.map((m) => m.id),
    ["I", "II", "III", "coda"],
  );
  assert.ok(t(LEVEL.finishX) > 78 && t(LEVEL.finishX) < 84);
  const floor = createLevel().platforms.find((q) => LEVEL.finishX > q.x && LEVEL.finishX < q.x + q.width && q.y === LEVEL.finishY);
  assert.ok(floor && LEVEL.finishX - floor.x > 500, "a long calm island before the door");
});
/** Transitions carried by a solar-wind column are budgeted by the wind
 * (tested separately), not by the plain jump envelope. */
const windBetween = (a, b) =>
  createLevel().updrafts.some((u) => u.x >= a.x + a.width - 20 && u.x + u.width <= b.x + 20);
/** A stable line below the gap that catches a failed attempt. */
const catchUnder = (a, b) =>
  createLevel().platforms.some(
    (q) => !q.type && q.y > a.y && q.y - a.y < RULES.fallLimit - 10 && q.x < b.x && q.x + q.width > a.x + a.width,
  );
test("movement title cards (300/1600/500 ms of simulation time) never cover a required input", () => {
  const { result } = traverse("main");
  const { prompts } = createLevel();
  const span = (CARD.fadeIn + CARD.hold + CARD.fadeOut) * LEVEL.speed;
  assert.ok(Math.abs(span - 2.4 * LEVEL.speed) < 1e-6);
  // Card I starts wakeDelay after waking at the spawn; II and III at their x.
  const windows = MOVEMENTS.filter((q) => q.numeral).map((m) => {
    const from = m.id === "I" ? LEVEL.startX + CARD.wakeDelay * LEVEL.speed : m.x;
    return [m.id, from, from + span];
  });
  assert.equal(windows.length, 3);
  for (const [id, from, to] of windows) {
    assert.ok(!prompts.some((q) => !q.optional && q.inputX >= from && q.inputX <= to), id);
    assert.ok(!result.actions.some((a) => a.x >= from && a.x <= to), `${id}: pilot input under the card`);
  }
});
test("main-route gaps and rises respect the authoring limits", () => {
  const main = mainPlatforms();
  for (let i = 1; i < main.length; i++) {
    const a = main[i - 1],
      b = main[i],
      gap = b.x - (a.x + a.width),
      rise = a.y - b.y;
    if (gap <= 0 || windBetween(a, b)) continue;
    assert.ok(rise <= 165, `${a.id}→${b.id} rise ${rise}`);
    assert.ok(gap <= 400, `${a.id}→${b.id} gap ${gap}`);
    assert.ok(b.y - a.y <= 240, `${a.id}→${b.id} drop`);
  }
});
test("no blind landings: every required landing is in view from its takeoff", () => {
  const view = viewGeometry(VIEW.portraitMinWidth); // the narrowest sky we ever show
  const main = mainPlatforms();
  for (let i = 1; i < main.length; i++) {
    const a = main[i - 1],
      b = main[i];
    const takeoff = a.x + a.width,
      band = visibleBand(a.y);
    // Either the landing itself or a stable catch line under the gap is in
    // view when Diana leaves the ground (the finale's two-flight line is
    // backed by the visible low line).
    assert.ok(b.x + 40 - takeoff <= view.lookahead || catchUnder(a, b), `${b.id} beyond lookahead`);
    assert.ok(b.y > band.hudBottom && b.y < band.bottom - 20, `${b.id} outside the vertical view from ${a.id}`);
  }
  // Optional lines rejoin with their landing in view too.
  const all = createLevel().platforms;
  for (const [from, to] of [
    ["gs1-ledge", "climb-base"],
    ["high-crown", "long-landing"],
    ["chain-exit", "ridge-c"],
    ["lid", "well-floor"],
    ["finale-crack", "low-a"],
  ]) {
    const a = all.find((q) => q.id === from),
      b = all.find((q) => q.id === to),
      band = visibleBand(a.y);
    assert.ok(b.y > band.hudBottom && b.y < band.bottom, `${from}→${to}`);
    assert.ok(b.y - a.y < RULES.fallLimit - 10, `${from}→${to} above the death line`);
  }
});
test("fragile surfaces always telegraph and have a catch or a visible next step", () => {
  const all = createLevel().platforms;
  const view = viewGeometry(VIEW.portraitMinWidth);
  assert.ok(RULES.crumbleAfter >= 0.35 && RULES.cascadeShake >= 0.35);
  for (const q of all.filter((p) => p.type)) {
    const catchBelow = all.some(
      (p) => !p.type && p !== q && p.x < q.x + q.width && p.x + p.width > q.x && p.y > q.y && p.y - q.y < RULES.fallLimit,
    );
    const next = all.some((p) => p !== q && p.x > q.x + q.width && p.x - (q.x + q.width) < view.lookahead);
    assert.ok(catchBelow || next, q.id);
  }
});
test("every glyph prompt is on screen at least 1.5 s before its latest valid input", () => {
  const { lookahead } = viewGeometry(VIEW.portraitMinWidth);
  const { prompts } = createLevel();
  assert.ok(prompts.filter((q) => !q.optional).length >= 5);
  for (const q of prompts) {
    // Diana is 1.5 s before the input; the glyph must already be on screen.
    const diana = q.inputX - 1.5 * LEVEL.speed;
    assert.ok(q.x - diana <= lookahead - 20, `${q.id} visible ${(lookahead - (q.x - diana)) / LEVEL.speed} s late`);
    assert.ok(q.from < q.inputX && q.to >= q.inputX - 40, q.id);
  }
});
test("lookahead: ≥2.5 s in landscape, ≥2.0 s in letterboxed portrait, which keeps a control deck", () => {
  for (const [w, h] of [
    [960, 640],
    [1280, 720],
    [1920, 1080],
    [390, 844],
    [320, 568],
    [844, 390],
    [768, 1024],
    [600, 600],
  ]) {
    const fit = fitStage(w, h, 60),
      view = viewGeometry(fit.logicalWidth);
    if (w / h < VIEW.minWidth / VIEW.height) {
      assert.equal(fit.layout, "portrait");
      assert.ok(view.lookaheadSeconds >= 2.0, `${w}x${h}: ${view.lookaheadSeconds}`);
      assert.ok(fit.logicalWidth >= VIEW.portraitMinWidth);
      assert.ok(h - 60 - fit.cssHeight >= VIEW.deckMin - 0.5, "a control deck remains below the sky");
    } else {
      assert.equal(fit.layout, "landscape");
      assert.ok(view.lookaheadSeconds >= 2.5, `${w}x${h}: ${view.lookaheadSeconds}`);
      assert.ok(fit.logicalWidth >= VIEW.minWidth);
    }
  }
});
test("the vertical camera keeps apexes out of the HUD band and the death line near the view bottom", () => {
  const all = createLevel();
  // Highest possible rise: jump + double + flight + super jump.
  const maxRise = 106 + 92 + (RULES.superJump * RULES.superJump) / (2 * RULES.gravity);
  for (const q of all.platforms.filter((p) => p.route === "low")) {
    const apex = q.y - maxRise,
      top = clampCameraY(cameraTargetY(q.y), apex);
    assert.ok(apex - VIEW.bodyHeight - top >= VIEW.topBand, q.id);
    const bottom = visibleBand(q.y).bottom,
      death = q.y + RULES.fallLimit;
    assert.ok(death >= bottom - 120 && death <= bottom + 100, `${q.id} death ${death} vs view ${bottom}`);
  }
  for (const star of all.pickups) {
    const under = all.platforms
      .filter((q) => Math.abs(q.x + q.width / 2 - star.x) < q.width / 2 + 300 && q.y > star.y)
      .sort((a, b) => a.y - b.y)[0];
    if (!under) continue;
    assert.ok(star.y - visibleBand(under.y).top >= VIEW.topBand, star.id);
  }
  assert.ok(cameraTargetY(470, 2) - cameraTargetY(470, 0) === VIEW.lookDownMax);
  assert.equal(cameraTargetY(470, 0.3), cameraTargetY(470, 0));
});

/* ---------- respawn ---------- */
test("a fall returns control at the beacon within 1.2 s and keeps a buffered jump", () => {
  const s = start(createGame());
  const cp = CHECKPOINTS[1];
  Object.assign(s.player, { x: cp.x + 5, y: cp.y, grounded: true });
  update(s, 0.02);
  Object.assign(s.player, { x: 7600, y: 900, grounded: false });
  update(s, 1 / 120);
  assert.equal(s.status, "dead");
  assert.equal(s.deaths, 1);
  let elapsed = 0;
  jump(s); // pressed while falling apart
  while (s.status !== "running" && elapsed < 3) {
    update(s, 1 / 120);
    elapsed += 1 / 120;
  }
  assert.ok(elapsed <= 1.2, `back in control after ${elapsed} s`);
  assert.equal(s.player.x > cp.x - 1 && s.player.x < cp.x + 20, true);
  assert.ok(s.player.vy < 0, "the buffered jump fired on the first controllable frame");
  assert.equal(RULES.respawnShatter + RULES.respawnIris + RULES.respawnPop <= 1.2, true);
});
test("manual retry restores the beacon snapshot and repairs shelves; restart clears it", () => {
  const { s } = traverse("main");
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
  assert.equal(s.player.x, LEVEL.startX);
  assert.equal(s.checkpoint, null);
  assert.equal(s.ringsCrossed, 0);
});
test("Star net returns Diana to her last ground once per beacon and restores what lies ahead", () => {
  const s = start(createGame());
  setAssist(s, "starNet", true);
  const plan = adapter(s);
  // Play the main route to the second void, then fall on purpose.
  playRoute(plan, { route: "main", maxSeconds: t(16560) });
  assert.equal(s.status, "running");
  const stars = s.stars;
  Object.assign(s.player, { y: s.anchorY + RULES.fallLimit + 5 });
  update(s, 1 / 120);
  assert.equal(s.status, "dead");
  update(s, 1.2);
  assert.equal(s.status, "running");
  assert.ok(s.player.x < 16100 && s.player.x > 15400, `net at ${s.player.x}`);
  assert.equal(s.platforms.find((q) => q.id === "split-crack").collapsed, false);
  assert.ok(s.stars <= stars);
  assert.equal(s.starNetUsed, true);
  const result = playRoute(adapter(s), { route: "main" });
  assert.equal(result.status, "won");
});

/* ---------- portal ---------- */
test("portal crop matches actual visible original PNG pixels and stands on the far-door island", async () => {
  const pixels = visibleBounds(await readFile(new URL("../assets/portal.png", import.meta.url)));
  assert.deepEqual(manifest.portal.visibleBounds, pixels);
  const p = portalPlacement(LEVEL.finishX, LEVEL.finishY, pixels);
  assert.equal(p.y + p.height, p.baseY);
  assert.ok(p.baseY >= p.groundY && p.baseY <= p.groundY + 4);
  const floor = createLevel().platforms.find((q) => q.id === "far-door");
  assert.ok(LEVEL.finishX > floor.x && LEVEL.finishX < floor.x + floor.width);
  assert.equal(floor.y, p.groundY);
  assert.ok(LEVEL.finishY + 3 >= outlineY(floor, LEVEL.finishX - floor.x));
});

/* ---------- core movement and animation (kept from earlier revisions) ---------- */
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
  assert.equal(s.player.x, LEVEL.startX);
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
  const s = start(createGame());
  const q = s.platforms.find((p) => p.id === "first-crack");
  Object.assign(s.player, { x: q.x + 20, y: q.y, grounded: true });
  s.anchorY = q.y;
  update(s, 0.67);
  assert.equal(q.collapsed, true);
  assert.ok(s.player.x < q.x + q.width);
  assert.ok(s.coyote > 0);
  assert.equal(jump(s), true);
  const fall = start(createGame());
  const f = fall.platforms.find((p) => p.id === "first-crack");
  const floor = fall.platforms.find((p) => p.id === "crack-floor");
  Object.assign(fall.player, { x: f.x + 20, y: f.y, grounded: true });
  fall.anchorY = f.y;
  update(fall, 1.2);
  assert.equal(fall.status, "running");
  assert.equal(fall.player.y, floor.y, "the floor beneath catches the first break");
});

/* ---------- forgiveness, glyphs, stars ---------- */
test("lip catch: a jump that arrives up to 25 px below a lip pops onto it; walk-offs and deep misses do not", () => {
  const make = (below, opts = {}) => {
    const s = fixture([
      { id: "from", x: 0, y: 500, width: 300 },
      { id: "to", x: 600, y: 430, width: 300 },
    ]);
    Object.assign(s.player, { x: 600 - 16 - 1, y: 430 + below, vy: opts.vy ?? 120, grounded: false, jumps: 1 });
    s.anchorY = 500;
    s.launched = opts.launched ?? true;
    update(s, 1 / 30);
    return s;
  };
  const near = make(20);
  assert.equal(near.player.grounded, true);
  assert.equal(near.player.y, 430);
  assert.equal(near.lipCatches, 1);
  assert.equal(make(32).player.grounded, false, "too deep");
  assert.equal(make(20, { launched: false }).player.grounded, false, "walking off never earns it");
  assert.equal(make(20, { vy: -300 }).player.grounded, false, "not while rising fast");
});
test("the first gap forgives a first input: a held jump or a 0 ms tap clears it", async () => {
  const { followGlyph } = await import("./glyphs.mjs");
  const p = createLevel().prompts.find((q) => q.id === "p-jump");
  const gap = createLevel().platforms.find((q) => q.id === "hop-a").x - 1100;
  assert.ok(gap <= 90);
  for (const [start, tap] of [
    [p.from, false],
    [p.inputX, false],
    [1070, true],
    [p.inputX, true],
  ]) {
    const s = start === null ? null : startGame();
    const r = followGlyph(adapter(s), p, { start, tap });
    assert.equal(r.status, "running", `start ${start} tap ${tap}`);
  }
  function startGame() {
    return start(createGame());
  }
});
test("following each glyph at its first valid moment succeeds (required ones also at the last)", async () => {
  const { followGlyph } = await import("./glyphs.mjs");
  for (const q of createLevel().prompts) {
    const route = q.optional ? q.route : "main";
    for (const at of q.optional ? ["from"] : ["from", "inputX"]) {
      const s = start(createGame());
      const r = followGlyph(adapter(s), q, { route, at });
      assert.equal(r.status, "running", `${q.id} at ${at} (${r.phase} x=${Math.round(r.x)})`);
      assert.equal(r.phase, "after", `${q.id} at ${at} was followed`);
    }
  }
});
test("the updraft cluster never shows more than one glyph at once", () => {
  const prompts = createLevel().prompts;
  for (let x = 17400; x <= 18800; x += 5) {
    const shown = shownPrompts(prompts, x).filter((q) => q.x > 17900 && q.x < 18800);
    assert.ok(shown.length <= 1, `${x}: ${shown.map((q) => q.id)}`);
  }
  // Each later one appears once the earlier is done.
  const done = prompts.map((q) => ({ ...q, done: q.id === "p-updraft" }));
  assert.ok(shownPrompts(done, 18090).some((q) => q.id === "p-wind"));
});
test("every star is reachable (some pilot collects it) and none sits inside an island", () => {
  const got = new Set();
  for (const route of ["main", "upper", "ability", "safe"])
    for (const q of traverse(route).s.pickups) if (q.collected) got.add(q.id);
  const w = createLevel();
  const missing = w.pickups.filter((q) => !got.has(q.id)).map((q) => q.id);
  assert.deepEqual(missing, []);
  for (const star of w.pickups)
    for (const p of w.platforms)
      assert.ok(
        !(star.x > p.x - 4 && star.x < p.x + p.width + 4 && star.y > p.y - 12 && star.y < p.y + 64),
        `${star.id} inside ${p.id}`,
      );
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
