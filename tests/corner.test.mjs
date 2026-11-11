/** Corner forgiveness (the owner's priority note on the video, 2026-11-10:
 * "she was about to land on the bowl and the game let her slip past it").
 * Diana lands on a platform's top; the model already forgives a miss of up to
 * 30 px under the top (24 in a cape flight) when her collider is over the top
 * by 4 px (RULES lipDepth, stepUpDepth, flightStepDepth, stepUpOverlap; the
 * "ledge assist" of MOVEMENT_AUDIT B12). That is far more than Celeste's 4-6
 * px corner correction on an 11 px body, and it is what these tests pin: a
 * corner clip of a few px can never slip past, from either side of the bowl's
 * left corner, in the air or in a flight. They also record why the video's
 * fall was NOT a corner clip: she flew 50-65 px under the rim.
 *
 * The same sweep as scripts/movement-audit.mjs approach(), in miniature. */
import test from "node:test";
import assert from "node:assert/strict";
import { createGame, start, update, jump, dash, RULES, TICK } from "../model.mjs";

const TOP = 400,
  X0 = 500,
  WIDTH = 261; // VIII's first rising-stair bowl is 261.4 px wide

/** Diana airborne and launched near the platform's left corner. `dx` is her
 * centre minus the platform's left edge (negative: left of it); `dy` is her
 * feet minus the top (negative: above it). Returns what happens. */
function approach({ dx, dy, vy = 0, flight = false }) {
  const s = start(createGame(2021, { level: 8 }));
  s.platforms = [{ id: "bowl", x: X0, y: TOP, width: WIDTH, phase: 0, route: "low", crumbleAfter: null, triggeredAt: null, collapseAt: null, collapsed: false, cascade: null }];
  s.pickups = [];
  s.updrafts = [];
  s.def = { ...s.def, checkpoints: [] };
  Object.assign(s.player, { x: X0 + dx, y: TOP + dy, vy, grounded: false, jumps: 1 });
  s.anchorY = TOP - 150;
  s.launched = true;
  s.coyote = 0;
  s.capeCharge = 1;
  s.capeCharges = 1;
  if (flight) {
    dash(s);
    s.player.y = TOP + dy;
    s.player.vy = 0;
  }
  let overBy = -Infinity,
    lowestOver = -Infinity,
    landed = null;
  for (let i = 0; i < 120 && s.status === "running"; i++) {
    const p = s.player;
    // The geometry the rule sees at the start of the tick.
    const overlap = Math.min(p.x + RULES.playerWidth / 2, X0 + WIDTH) - Math.max(p.x - RULES.playerWidth / 2, X0);
    if (overlap >= RULES.stepUpOverlap) overBy = Math.max(overBy, overlap);
    update(s, TICK);
    if (s.player.grounded) {
      landed = { tick: i, ground: s.ground?.id, y: s.player.y, stepUp: (s.stepUps ?? 0) > 0 };
      break;
    }
    if (Math.min(s.player.x + 16, X0 + WIDTH) - Math.max(s.player.x - 16, X0) >= RULES.stepUpOverlap) lowestOver = Math.max(lowestOver, s.player.y - TOP);
  }
  return { landed, lowestOver, status: s.status };
}

test("a corner clip of a few px never slips past: feet 1-3 px above the top and the collider 0-5 px short of the corner, falling or flying", () => {
  let trials = 0;
  for (const flight of [false, true])
    for (const vy of [0, 150, 400, 700])
      for (let dy = -3; dy <= 2; dy++)
        // Her centre 21 px left of the corner (collider 5 px short) to 14 px left (2 px over it).
        for (let dx = -21; dx <= -14; dx++) {
          trials++;
          const r = approach({ dx, dy, vy, flight });
          assert.equal(r.status, "running");
          assert.ok(r.landed && r.landed.ground === "bowl", `dx ${dx} dy ${dy} vy ${vy}${flight ? " flight" : ""}: slipped past the corner (${JSON.stringify(r)})`);
          assert.ok(Math.abs(r.landed.y - TOP) < 1e-6, "she stands on the top, not under it");
          // (A flight 1-3 px over the top flies on level until the cape closes, 0.5 s, then settles.)
          assert.ok(r.landed.tick <= (flight && dy < 0 ? 80 : 12), `landed in time (${r.landed.tick} ticks)`);
        }
  assert.ok(trials >= 380, `${trials} corner clips`);
});

test("no airborne tick ever leaves her inside the forgiveness zone over a top (the rule's postcondition, swept)", () => {
  let landed = 0,
    passed = 0,
    zoneTicks = 0;
  for (const flight of [false, true]) {
    const limit = flight ? RULES.flightStepDepth : RULES.lipDepth;
    for (const vy of [-120, 0, 200, 500, 800])
      for (let dy = -14; dy <= 40; dy += 2)
        for (let dx = -40; dx <= 120; dx += 4) {
          const s = start(createGame(2021, { level: 8 }));
          s.platforms = [{ id: "bowl", x: X0, y: TOP, width: WIDTH, phase: 0, route: "low", crumbleAfter: null, triggeredAt: null, collapseAt: null, collapsed: false, cascade: null }];
          s.pickups = [];
          s.updrafts = [];
          s.def = { ...s.def, checkpoints: [] };
          Object.assign(s.player, { x: X0 + dx, y: TOP + dy, vy, grounded: false, jumps: 1 });
          s.anchorY = TOP - 150;
          s.launched = true;
          s.coyote = 0;
          s.capeCharge = 1;
          s.capeCharges = 1;
          if (flight) {
            dash(s);
            s.player.y = TOP + dy;
            s.player.vy = 0;
          }
          for (let i = 0; i < 90 && s.status === "running"; i++) {
            update(s, TICK);
            const p = s.player;
            if (p.grounded) {
              landed++;
              break;
            }
            const overlap = Math.min(p.x + RULES.playerWidth / 2, X0 + WIDTH) - Math.max(p.x - RULES.playerWidth / 2, X0),
              depth = p.y - TOP,
              rise = p.vy < 0 ? (p.vy * p.vy) / (2 * RULES.gravity) : 0;
            if (overlap >= RULES.stepUpOverlap && depth > 0 && depth <= limit && rise < depth && s.dashRemaining > 0 === flight) zoneTicks++;
          }
          if (s.status === "dead") passed++;
        }
  }
  assert.equal(zoneTicks, 0, "no tick left her in the zone, airborne");
  assert.ok(landed > 1000 && passed > 200, `${landed} landed, ${passed} passed (a non-vacuous sweep)`);
});

test("the forgiveness has an end: 31 px under the rim in the air, 25 px in a flight, she passes through (a one-way top)", () => {
  assert.equal(RULES.lipDepth, 30);
  assert.equal(RULES.flightStepDepth, 24);
  assert.equal(RULES.stepUpOverlap, 4);
  // Well over the top by her width, falling past the rim at 40 px under it.
  const air = approach({ dx: 60, dy: 40, vy: 300 });
  assert.equal(air.landed, null, "40 px under the rim is a clear miss");
  const fl = approach({ dx: 60, dy: 40, vy: 0, flight: true });
  assert.equal(fl.landed, null, "a flight 40 px under the rim passes through the bowl's body");
});

test("the video's attempt: a jump and a cape press 0.1-0.3 s in flies 33-82 px under the first bowl's rim and cannot land; at the apex (0.35 s) it lands by the lip rule", () => {
  const s0 = createGame(2021, { level: 8 });
  const P = Object.fromEntries(s0.platforms.map((q) => [q.id, q]));
  const ledge = P["far-shore-2"],
    bowl = P["stair-1"];
  const trial = (capeAt) => {
    const s = start(createGame(2021, { level: 8 }));
    Object.assign(s.player, { x: ledge.x + ledge.width - 60, y: ledge.y, vy: 0, grounded: true, jumps: 0 });
    s.anchorY = ledge.y;
    s.capeCharge = 1;
    s.capeCharges = 1;
    let t = 0,
      jumped = false,
      caped = false,
      atEdge = null;
    for (let i = 0; i < 120 * 3 && s.status === "running"; i++) {
      if (!jumped && s.player.x >= ledge.x + ledge.width) (jump(s), (jumped = true));
      if (jumped && !caped && t >= capeAt) (dash(s), (caped = true));
      if (jumped) t += TICK;
      update(s, TICK);
      if (!atEdge && s.player.x + 16 >= bowl.x) atEdge = s.player.y - bowl.y;
      if (jumped && s.player.grounded) break;
    }
    return { landed: s.player.grounded ? s.ground?.id : null, under: atEdge };
  };
  for (const [capeAt, under] of [[0.1, 82], [0.15, 67], [0.2, 50], [0.25, 39], [0.3, 33]]) {
    const r = trial(capeAt);
    assert.equal(r.landed, null, `cape at ${capeAt}: ${JSON.stringify(r)}`);
    assert.ok(Math.abs(r.under - under) < 3, `cape at ${capeAt}: ${r.under.toFixed(1)} px under the rim at its left edge (expected ${under})`);
    assert.ok(r.under > RULES.flightStepDepth, "outside the forgiveness, so not a corner clip");
  }
  assert.equal(trial(0.35).landed, "stair-1", "the apex press lands (29 px under the rim, inside the 30 px lip rule)");
});
