/** RESEARCH_PROGRESSION model rules: verbs owned per level and unlocked by
 * GETs (U2, U4), the double jump as the original's maxJumps, the super jump
 * gated, and the cape's breath charge (C5, C6). Fixtures use a tiny level
 * built from level 2's definition (clock 1). */
import test from "node:test";
import assert from "node:assert/strict";
import { createGame, start, update, jump, dash, dive, retry, snapshot, RULES } from "../model.mjs";
import { levelDef } from "../level.mjs";

const BEAT = 60 / 107;
/** A flat world: one long stable floor (optionally a crack) and nothing else. */
function world({ verbs = {}, gets = [], capeRule = "breath", platforms = null, updrafts = [], stars = [], checkpoints = [] } = {}) {
  const base = levelDef(2);
  const def = {
    ...base,
    capeRule,
    verbs: { double: true, cape: true, glide: true, dive: true, super: false, ...verbs },
    gets,
    level: { ...base.level, startX: 220, startY: 540, finishX: 1e6 },
    main: platforms ?? [["floor", -400, 540, 20000]],
    high: [],
    updrafts,
    cascades: [],
    chains: [],
    great: [],
    prompts: [],
    stars,
    checkpoints,
  };
  return start(createGame(1, { def }));
}
const run = (s, seconds, controls = {}) => {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 120) update(s, 1 / 120, controls);
};

test("U2: before it is owned a verb's input does nothing and emits nothing", () => {
  const s = world({ verbs: { double: false, cape: false, glide: false, dive: false } });
  jump(s);
  run(s, 0.25);
  const before = s.eventSerial;
  assert.equal(jump(s), false, "no air jump without the double jump");
  assert.equal(dash(s), false, "no cape");
  assert.equal(dive(s), false, "no dive");
  run(s, 0.05, { glide: true });
  assert.equal(s.player.gliding, false, "no glide");
  assert.ok(!s.events.some((e) => e.serial > before && ["double-jump", "dash", "dive"].includes(e.name)));
  assert.equal(snapshot(s).verbs.double, false);
});
test("the double jump is maxJumps 2; without it one jump per airtime (an air press waits in the buffer)", () => {
  const one = world({ verbs: { double: false } });
  jump(one);
  run(one, 0.2);
  assert.equal(jump(one), false);
  assert.equal(one.jumpBuffer > 0, true, "remembered for the next touch-down");
  const two = world({ verbs: { double: true } });
  jump(two);
  run(two, 0.2);
  assert.equal(jump(two), true);
  assert.equal(two.events.at(-1).name, "double-jump");
});
test("U4: a GET owns its verb from its x on; a respawn before it does not own it, after it does", () => {
  const gets = [{ id: "get-double", verb: "double", x: 600 }];
  const checkpoints = [
    { id: "before", x: 400, y: 540, platform: "floor", story: "a", tip: "a" },
    { id: "after", x: 900, y: 540, platform: "floor", story: "b", tip: "b" },
  ];
  const s = world({ verbs: { double: false }, gets, checkpoints });
  run(s, 0.8); // past the first beacon, before the GET (x ~ 436)
  assert.equal(s.checkpoint.id, "before");
  assert.equal(s.verbs.double, false);
  run(s, 0.7); // through the GET (x ~ 625)
  assert.equal(s.verbs.double, true);
  assert.ok(s.events.some((e) => e.name === "get" && e.verb === "double"));
  s.status = "dead";
  retry(s); // back to "before": the GET is not owned again until passed
  assert.equal(s.verbs.double, false, "a respawn before the GET does not own it");
  run(s, 2);
  assert.equal(s.checkpoint.id, "after");
  s.status = "dead";
  retry(s);
  assert.equal(s.verbs.double, true, "after it, it does");
  assert.equal(snapshot(s).gets[0].taken, true);
});
test("before the super jump is owned a jump during a flight ends it and is the double jump", () => {
  for (const owned of [false, true]) {
    const s = world({ verbs: { super: owned } });
    jump(s);
    run(s, 0.2);
    dash(s);
    run(s, 0.1);
    assert.equal(jump(s), true);
    assert.equal(s.dashRemaining, 0, "the flight ends");
    assert.equal(s.events.at(-1).name, owned ? "super-jump" : "double-jump");
    assert.equal(s.player.vy, owned ? -RULES.superJump : -s.physics.doubleJump);
  }
});
test("C5: breath fills over exactly four beats of stable running; a flight empties it; no breath in the air", () => {
  const s = world();
  assert.equal(s.capeCharge, 1, "owned at the start: full");
  jump(s);
  run(s, 0.2);
  assert.equal(dash(s), true);
  assert.equal(s.capeCharge, 0);
  const airborne = s.capeCharge;
  run(s, 0.3);
  assert.equal(s.capeCharge, airborne, "the air adds nothing");
  run(s, 2); // land
  assert.ok(s.player.grounded);
  const landedAt = s.time;
  // Run until full and measure how long it took on the ground.
  while (s.capeCharge < 1) update(s, 1 / 120);
  const ground = s.events.filter((e) => e.name === "refill" && e.source === "ground");
  assert.equal(ground.length, 1, "one refill event, when it becomes full");
  const breathTime = ground[0].time - landedAt;
  assert.ok(breathTime <= 4 * BEAT + 1 / 120 + 1e-9, `${breathTime} s`);
  assert.equal(snapshot(s).capeFull, true);
  assert.equal(snapshot(s).capeCharges, 1, "the legacy field follows");
});
test("C5: cracks never breathe; a loose star adds 1/8; a glide never changes the charge", () => {
  const s = world({ platforms: [["crack", -400, 540, 20000, "lid"]] });
  s.capeCharge = 0.25;
  run(s, 2);
  assert.equal(s.capeCharge, 0.25, "no breath on cracked stone");
  const t = world({ stars: [["loose", 262, 450, "low"]] });
  t.capeCharge = 0.25;
  jump(t); // airborne: no breath, only the star's
  run(t, 0.3);
  assert.ok(Math.abs(t.capeCharge - 0.375) < 1e-9, `star: ${t.capeCharge}`);
  const g = world();
  g.capeCharge = 0.5;
  jump(g);
  run(g, 0.4);
  assert.equal(dash(g), false, "a partial bar cannot fly");
  run(g, 0.4, { glide: true });
  assert.ok(g.player.gliding || g.player.grounded);
  assert.equal(g.capeCharge, 0.5, "gliding is free");
});
test("C5: a flight cut short by the wind within 0.15 s (real) gets its charge back", () => {
  const column = { id: "w", x: 300, width: 170, top: 0, bottom: 800 };
  for (const [gap, refund] of [[0.1, true], [0.3, false]]) {
    const s = world({ updrafts: [{ ...column, x: 230 + 270 * 0.2 + 497 * gap }] });
    jump(s);
    run(s, 0.2);
    assert.equal(dash(s), true);
    run(s, gap + 0.06);
    assert.ok(s.events.some((e) => e.name === "wind-catch"), `gap ${gap}: in the wind`);
    assert.equal(s.capeCharge === 1, refund, `gap ${gap}`);
    assert.equal(s.events.some((e) => e.name === "wind-refund"), refund);
  }
});
test("C6: the charge at every event is identical at 30/60/120/240 Hz", () => {
  const trace = (hz) => {
    const s = world();
    const out = [];
    let seen = 0;
    for (let i = 0; i < 4 * hz; i++) {
      if (i === Math.round(0.5 * hz)) jump(s);
      if (i === Math.round(0.7 * hz)) dash(s);
      update(s, 1 / hz);
      for (const e of s.events) if (e.serial > seen) (seen = e.serial), out.push(`${e.name}@${e.time.toFixed(6)}:${s.capeCharge.toFixed(9)}`);
    }
    return out.filter((q) => !q.startsWith("land"));
  };
  const ref = trace(120);
  for (const hz of [30, 60, 240]) assert.deepEqual(trace(hz).filter((q) => q.startsWith("refill")), ref.filter((q) => q.startsWith("refill")), `${hz} Hz`);
});
