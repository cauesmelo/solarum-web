/** The owner's video (2026-11-10): Diana "dies in the middle of the map; she
 * does not fall into the pit". The doom line (anchorY + fallLimit) sits
 * anywhere from 55% to 99% of the screen height under the damped camera, so
 * the fall used to be declared (shards, fall sound, iris) while she was still
 * in plain view, over the Moon's limb. These tests pin the repaired rule
 * (geometry.mjs fallOutLine, model.mjs `doomed`): a fall counts only once her
 * drawn body is wholly under the bottom edge of the view, on every level and
 * every platform, through the real camera's easing, and the physics before it
 * are exactly the old rule's. */
import test from "node:test";
import assert from "node:assert/strict";
import { createGame, start, update, jump, dash, dive, releaseJump, RULES, snapshot } from "../model.mjs";
import { LEVELS, createLevel, levelDef } from "../level.mjs";
import { VIEW, FALL_OUT, fitStage, cameraTargetY, clampCameraY, stepCamera, fallOutLine } from "../geometry.mjs";

const REAL_DT = 1 / 60;
const plat = (id, x, y, width) => ({ id, x, y, width, phase: 0, route: "low", crumbleAfter: null, triggeredAt: null, collapseAt: null, collapsed: false, cascade: null });

/** One platform alone in the world, Diana grounded at its right end and
 * walking off (a lip walk-off is the quickest way to the line: the camera has
 * had no time to look down), the camera as game.js's updateCamera eases it
 * (stepCamera toward cameraTargetY, then clampCameraY) at 60 fps real. `rise`
 * starts the camera as if she had just landed that many px above the stone she
 * jumped from (a lagging camera is the worst case: its bottom edge is lower).
 * Returns the last frame she was drawn in, as the renderer sees it. */
function walkOff(level, q, { rise = 0, extra = [] } = {}) {
  const s = start(createGame(2021, { level }));
  s.platforms = [plat(q.id, q.x, q.y, q.width), ...extra];
  s.pickups = [];
  s.updrafts = [];
  // (No beacon to light and no door to win at: only the walk-off.)
  s.def = { ...s.def, checkpoints: [], level: { ...s.def.level, finishX: 1e9 } };
  Object.assign(s.player, { x: q.x + q.width - 4, y: q.y, vy: 0, grounded: true, jumps: 0 });
  s.anchorY = q.y;
  const clock = s.def.clock;
  const cam = { y: cameraTargetY(q.y + rise, 0) };
  let last = null;
  for (let frame = 0; frame < 60 * 6 && s.status === "running"; frame++) {
    update(s, REAL_DT * clock);
    cam.y = stepCamera(cam.y, cameraTargetY(s.anchorY, s.fallTime), REAL_DT);
    cam.y = clampCameraY(cam.y, s.player.y);
    if (s.status === "running") last = { y: s.player.y, cameraY: cam.y, doomed: s.doomed, anchorY: s.anchorY };
  }
  return { s, last };
}

test("every level, every platform: a fall is declared only after Diana has left the view (real camera easing, also right after a 267 px rise)", () => {
  let checked = 0,
    doomedInView = 0;
  for (const d of LEVELS) {
    for (const q of createLevel(d.id).platforms) {
      for (const rise of [0, 267]) {
        const { s, last } = walkOff(d.id, q, { rise });
        assert.equal(s.status, "dead", `L${d.id} ${q.id}: the walk-off ends in a fall`);
        assert.equal(s.deaths, 1, `L${d.id} ${q.id}: counted once`);
        const bottom = last.cameraY + VIEW.height,
          top = last.y - FALL_OUT.spriteUp;
        // The last frame she was drawn in is already wholly under the edge.
        assert.ok(top >= bottom, `L${d.id} ${q.id} rise ${rise}: her head (${top.toFixed(0)}) is above the bottom edge (${bottom.toFixed(0)}) on her last drawn frame`);
        if (last.y > last.anchorY + RULES.fallLimit) checked++;
        // (The doom line is where the old rule shattered her; it is often in view.)
        if (last.y - last.anchorY > RULES.fallLimit && last.y - FALL_OUT.spriteUp < bottom) doomedInView++;
      }
    }
  }
  assert.equal(doomedInView, 0);
  assert.ok(checked > 400, `${checked} walk-offs checked`);
});

test("the doom line was inside the view on most platforms before: the repair is not a no-op", () => {
  // The old rule: shatter at anchorY + fallLimit. Count the platforms where
  // her head was still on screen there (settled camera, no look-down yet).
  let inView = 0,
    all = 0;
  for (const d of LEVELS)
    for (const q of createLevel(d.id).platforms) {
      all++;
      const settledBottom = cameraTargetY(q.y, 0) + VIEW.height;
      if (q.y + RULES.fallLimit - FALL_OUT.spriteUp < settledBottom) inView++;
    }
  assert.ok(inView / all > 0.5, `${inView} of ${all} platforms had the old death line on screen`);
  // And the new line is under the lowest view the camera can have there.
  for (const d of LEVELS)
    for (const q of createLevel(d.id).platforms) assert.ok(fallOutLine(q.y, 0) - FALL_OUT.spriteUp >= cameraTargetY(q.y, 0) + VIEW.height + FALL_OUT.margin - 1e-9);
});

test("the owner's video: VIII's rising stair, a jump and an early cape flight under the first bowl, falls out of the view before it counts", () => {
  const s = start(createGame(2021, { level: 8 }));
  const P = Object.fromEntries(s.platforms.map((q) => [q.id, q]));
  const ledge = P["far-shore-2"];
  Object.assign(s.player, { x: ledge.x + ledge.width - 60, y: ledge.y, vy: 0, grounded: true, jumps: 0 });
  s.anchorY = ledge.y;
  s.capeCharge = 1;
  s.capeCharges = 1;
  const cam = { y: cameraTargetY(ledge.y, 0) };
  let t = 0,
    jumped = false,
    caped = false,
    declared = null,
    lastDrawn = null;
  for (let f = 0; f < 60 * 4 && !declared; f++) {
    if (!jumped && s.player.x >= ledge.x + ledge.width) (jump(s), (jumped = true));
    if (jumped && !caped && t >= 0.2) (dash(s), (caped = true));
    if (jumped) t += REAL_DT * s.def.clock;
    update(s, REAL_DT * s.def.clock);
    cam.y = clampCameraY(stepCamera(cam.y, cameraTargetY(s.anchorY, s.fallTime), REAL_DT), s.player.y);
    if (s.status === "dead") declared = { y: s.player.y, cameraY: cam.y };
    else lastDrawn = { y: s.player.y, cameraY: cam.y, doomed: s.doomed };
  }
  assert.ok(declared, "she fell");
  assert.ok(lastDrawn.doomed, "the last drawn frame was the doomed fall, not a death");
  assert.ok(lastDrawn.y - FALL_OUT.spriteUp >= lastDrawn.cameraY + VIEW.height, "her head was under the bottom edge on the last drawn frame");
  // The old rule would have shattered her at ledge.y... + 265: where is that on screen?
  const oldLine = s.anchorY + RULES.fallLimit - lastDrawn.cameraY;
  assert.ok(oldLine < VIEW.height * 0.9, `the old death line was at ${Math.round((oldLine / VIEW.height) * 100)}% of the screen height`);
});

test("past the doom line nothing saves her: no platform, no press, no star; the old outcome, declared later", () => {
  const s = start(createGame(2021, { level: 8 }));
  s.platforms = [plat("a", 0, 300, 400), plat("deep", 380, 300 + RULES.fallLimit + 40, 2000)];
  s.pickups = [{ id: "bait", x: 600, y: 300 + RULES.fallLimit + 90, collected: false, route: "low" }];
  s.updrafts = [];
  s.def = { ...s.def, checkpoints: [] };
  Object.assign(s.player, { x: 380, y: 300, vy: 0, grounded: true, jumps: 0 });
  s.anchorY = 300;
  let doomedAt = null;
  while (s.status === "running" && s.time < 6) {
    update(s, 1 / 120);
    if (s.doomed && !doomedAt) {
      doomedAt = { y: s.player.y, vy: s.player.vy, time: s.time };
      // What she presses now is a press while falling apart: queued for the respawn.
      assert.equal(jump(s), false);
      assert.equal(dash(s), false);
      assert.equal(dive(s), false);
      assert.equal(s.queuedJump, true);
      releaseJump(s);
    }
  }
  assert.ok(doomedAt && doomedAt.y > 300 + RULES.fallLimit && doomedAt.y < 300 + RULES.fallLimit + 5, "doomed on the old rule's line");
  assert.equal(s.status, "dead", "she fell through the stone under the line instead of landing on it");
  assert.equal(s.deaths, 1);
  assert.equal(s.pickups[0].collected, false, "a star below the line is not hers");
  assert.ok(s.respawn.fromY > 300 + RULES.fallLimit + 90, "the fall was declared under the view, not on the line");
  const frozen = s.time;
  update(s, 0.5);
  assert.ok(s.time <= frozen + 1e-9 || s.status !== "dead", "the clock stood still while she fell out of sight");
});

test("where the old line is already below the view the fall counts at once, as before", () => {
  // A low anchor: the old line is under the screen already.
  const s = start(createGame(2021, { level: 8 }));
  s.platforms = [plat("low", 0, 1000, 400)];
  s.pickups = [];
  s.updrafts = [];
  s.def = { ...s.def, checkpoints: [] };
  Object.assign(s.player, { x: 380, y: 1000, vy: 0, grounded: true, jumps: 0 });
  s.anchorY = 1000;
  // (A fall of 265 px takes 0.59 s, 73 px of look-down: the view's bottom
  // edge plus a body and a margin is above the old line from anchors ~970.)
  assert.ok(fallOutLine(1000, 0.6) < 1000 + RULES.fallLimit, "the doom line is the later of the two here");
  let sawDoomed = false;
  while (s.status === "running" && s.time < 6) {
    update(s, 1 / 120);
    sawDoomed ||= s.doomed;
  }
  assert.equal(s.status, "dead");
  assert.equal(sawDoomed, false, "no doomed frames: she died on the line");
  assert.ok(s.respawn.fromY - (1000 + RULES.fallLimit) < 6, `declared on the old line (${s.respawn.fromY})`);
});

test("a press during the unseen fall respawns as a tap, a retry clears the flag, and the snapshot reports it", () => {
  const s = start(createGame(2021, { level: 8 }));
  s.platforms = [plat("a", 0, 300, 400)];
  s.pickups = [];
  s.def = { ...s.def, checkpoints: [] };
  Object.assign(s.player, { x: 380, y: 300, vy: 0, grounded: true, jumps: 0 });
  s.anchorY = 300;
  while (!s.doomed && s.status === "running") update(s, 1 / 120);
  assert.equal(snapshot(s).doomed, true);
  jump(s);
  releaseJump(s);
  while (s.status !== "running" || s.doomed) update(s, 1 / 120);
  assert.equal(s.doomed, false);
  assert.equal(s.player.vy, -RULES.tapCap, "the queued press fired as a tap on the first controllable frame");
});

test("the view is VIEW.height tall in every viewport, so no aspect shows more of the fall than the camera tests assume", () => {
  for (const [w, h] of [[960, 640], [1280, 720], [1920, 1080], [800, 1000], [400, 900], [1000, 300], [2560, 700], [640, 480]]) {
    for (const view of [null, levelDef(8).view]) {
      const fit = fitStage(w, h, 0, view);
      assert.ok(Math.abs(fit.cssHeight / fit.scale - VIEW.height) < 1e-6, `${w}x${h}: ${fit.cssHeight / fit.scale} logical px tall`);
    }
  }
});
