/** The owner's video, 2026-11-10: at every respawn in level VIII the whole
 * play area went completely black for about seven frames (120 ms) while the
 * HUD stayed. Cause: the renderer's iris and camera ride used RULES' unscaled
 * 0.45 + 0.25 s of simulation time while the model steps by the level's own
 * physics (x clock = BPM / 107: 1.196 in VIII), so the iris was shut 0.137 s
 * of simulation before the model restored the beacon's world. These tests run
 * the real model's death and respawn on every level and sample the view the
 * way the renderer does, 60 times a real second. */
import test from "node:test";
import assert from "node:assert/strict";
import { createGame, start, update } from "../model.mjs";
import { LEVELS } from "../level.mjs";
import { respawnTimes, irisAt, LANTERN } from "../geometry.mjs";

const W = 1050; // VIII's narrowest logical view width

/** One fall and respawn on level n, sampled each real 1/60 s: the dark at each
 * frame, the model's status, and the frame the world was restored. */
function fall(n, reduced = false) {
  const s = start(createGame(2021, { level: n }));
  s.platforms = [];
  s.checkpoint = null;
  Object.assign(s.player, { y: s.anchorY + 2000, grounded: false });
  update(s, 1 / 120);
  assert.equal(s.status, "dead");
  const frames = [];
  let swapped = null;
  for (let f = 0; f < 60 * 4 && s.status !== "running"; f++) {
    const before = s.status;
    update(s, (1 / 60) * s.def.clock);
    const dark = irisAt(s.status, s.respawn?.t ?? 0, s.physics, W, reduced);
    if (before === "dead" && s.status === "respawning") swapped = f;
    frames.push({ f, status: s.status, t: s.respawn?.t ?? null, dark });
  }
  return { s, frames, swapped };
}

test("every level: the view is never blank at a respawn, and the iris is shut exactly when the model restores the world", () => {
  for (const d of LEVELS) {
    const { s, frames, swapped } = fall(d.id);
    assert.notEqual(swapped, null, `L${d.id} respawned`);
    const T = respawnTimes(s.physics);
    // The phases are the model's own, in simulation seconds (not RULES').
    assert.ok(Math.abs(T.cut - (s.physics.respawnShatter + s.physics.respawnIris)) < 1e-12);
    const dark = frames.filter((x) => x.status === "dead" || x.status === "respawning");
    // Never a frame with no lit circle (radius under the lantern) while it is dark.
    for (const x of dark) if (x.dark) assert.ok(x.dark.radius >= LANTERN - 1e-9, `L${d.id} frame ${x.f}: radius ${x.dark.radius}`);
    // The closing ends at the lantern on the frame the world is restored, within one real frame.
    const swap = frames[swapped];
    assert.ok(swap.dark && swap.dark.radius < LANTERN + (W - LANTERN) * 0.12, `L${d.id}: iris at ${swap.dark?.radius} on the swap frame`);
    // It closes monotonically, then opens monotonically, no jump over a quarter of the view per frame.
    const radii = dark.filter((x) => x.dark).map((x) => x.dark.radius);
    const low = radii.indexOf(Math.min(...radii));
    for (let i = 1; i <= low; i++) assert.ok(radii[i] <= radii[i - 1] + 1e-9, `L${d.id}: closing is monotone`);
    for (let i = low + 1; i < radii.length; i++) assert.ok(radii[i] >= radii[i - 1] - 1e-9, `L${d.id}: opening is monotone`);
    for (let i = 1; i < radii.length; i++) assert.ok(Math.abs(radii[i] - radii[i - 1]) < W * 0.4, `L${d.id}: no cut between frames (${radii[i - 1]} -> ${radii[i]})`);
    // The wait between the iris shutting and the swap is under a frame (the video's was seven).
    const shut = dark.findIndex((x) => x.dark && x.dark.radius <= LANTERN + 1e-6);
    assert.ok(swapped - (shut < 0 ? swapped : dark[shut].f) <= 1, `L${d.id}: ${swapped - dark[shut]?.f} frames from shut to swap`);
    // The view is open again before control returns.
    assert.equal(frames.at(-1).dark, null, `L${d.id} open at the end`);
  }
});

test("the old renderer's unscaled timings left VIII blank: the numbers", () => {
  const door = LEVELS.find((d) => d.key === "door");
  const s = createGame(2021, { level: door.id });
  const T = respawnTimes(s.physics);
  // RULES' 0.45 + 0.25 = 0.70 s of simulation vs the model's 0.70 x 1.196 = 0.837.
  const blankSim = T.cut - 0.7;
  assert.ok(blankSim > 0.13 && blankSim < 0.14, `${blankSim}`);
  assert.ok(blankSim / door.clock > 0.11 && blankSim / door.clock < 0.12, "about 114 ms of real time, seven frames at 60 fps");
});

test("reduced motion cross-fades: no hard cut to black and back, never fully opaque", () => {
  for (const d of LEVELS) {
    const { frames } = fall(d.id, true);
    const alphas = frames.filter((x) => x.dark).map((x) => x.dark.alpha);
    assert.ok(alphas.length > 3);
    assert.ok(Math.max(...alphas) <= 0.94 + 1e-9 && Math.max(...alphas) > 0.5, `L${d.id}`);
    for (let i = 1; i < alphas.length; i++) assert.ok(Math.abs(alphas[i] - alphas[i - 1]) < 0.5, `L${d.id}: a gentle ramp (${alphas[i - 1]} -> ${alphas[i]})`);
  }
});
