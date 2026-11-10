/* The original art added for the eight-level campaign: the no-cape sheets
 * and clips (level I wears no cape) and the HUD's breath bar, checked like
 * the caped set's metadata (frame rectangles, pivots, keyframe times), plus
 * the CSS crop of the bar's PNGs and the manifest's usage record. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { decodePNG } from "./png.mjs";
import { NOCAPE_CLIPS, LOOPS, clipFor, frameForClip, characterLayers } from "../animation.mjs";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const manifest = JSON.parse(await read("assets/manifest.json"));
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
/** Bounds of the drawn pixels (alpha > 64; ink lines count too). */
function alphaBounds(buffer) {
  const { width, height, pixels } = decodePNG(buffer);
  let x0 = width,
    y0 = height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (pixels[(y * width + x) * 4 + 3] > 64) ((x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y)));
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The archive's no-cape override clips (Animations/Diana/No Cape/*.anim):
 * source, keyframe count, sample rate, the sheet frames they show. */
const NOCAPE = {
  nocapeRun: ["nocape-running", 10, 12, "nocapeRun", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
  nocapeIdle: ["nocape-idle", 1, 12, "nocapeIdle", [0]],
  nocapeAir: ["nocape-airbourne", 2, 12, "nocapeAir", [0, 1]],
  nocapeDash: ["nocape-dash", 14, 24, "bodyDash", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]],
  nocapeDive: ["nocape-drop-roll", 6, 12, "nocapeDrop", [0, 1, 2, 3, 4, 5]],
  nocapeJump: ["nocape-jump1", 5, 12, "nocapeJumpLanding", [0, 1, 2, 3, 4]],
  nocapeSoftLanding: ["nocape-soft-landing", 10, 12, "nocapeSoftLanding", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
  nocapeHardLanding: ["nocape-hard-landing", 14, 12, "nocapeJumpLanding", [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]],
  nocapeStart: ["nocape-start", 4, 12, "nocapeStartStop", [0, 1, 2, 3]],
  nocapeStop: ["nocape-stop", 10, 12, "nocapeStartStop", [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]],
};
/** The no-cape sheets: source, size, slices (Unity 200 px cells). */
const SHEETS = {
  nocapeRun: ["no-cape-diana-run.png", 1000, 400, 10],
  nocapeIdle: ["no-cape-diana-idle.png", 1000, 601, 12],
  nocapeAir: ["no-cape-diana-airbourne.png", 1000, 600, 6],
  nocapeDrop: ["no-cape-diana-drop.png", 1000, 400, 6],
  nocapeJumpLanding: ["no-cape-diana-jump-hard-landing.png", 1000, 1000, 19],
  nocapeSoftLanding: ["no-cape-diana-soft-landing.png", 1000, 450, 10],
  nocapeStartStop: ["no-cape-diana-start-stop.png", 1000, 601, 15],
};

test("no-cape sheets: unchanged originals sliced into 200 px cells with the archive's pivots", async () => {
  for (const [key, [file, w, h, n]] of Object.entries(SHEETS)) {
    const d = manifest[key];
    assert.equal(d.source, `Sprites/Diana/No Cape/${file}`, key);
    assert.equal(d.file, `assets/${key}.png`);
    const png = decodePNG(await readFile(new URL(`../${d.file}`, import.meta.url)));
    assert.deepEqual([png.width, png.height, d.width, d.height], [w, h, w, h], key);
    assert.equal(d.frames.length, n, key);
    for (const [i, f] of d.frames.entries()) {
      // Cells on the 200 px grid (Unity's rects can be off by a pixel or a
      // third: y -0.00003, h 200.333, x 201), inside the sheet.
      assert.ok(f.w === 200 && [200, 250, 300].includes(Math.round(f.h)), `${key}[${i}] ${f.w}x${f.h}`);
      assert.ok(Math.abs(f.x - Math.round(f.x / 200) * 200) <= 1, `${key}[${i}] x ${f.x}`);
      assert.ok(f.x >= 0 && f.y >= -0.001 && f.x + f.w <= w && f.y + f.h <= h + 0.5, `${key}[${i}] inside`);
      // Tall cells carry the archive's custom pivot (airborne and takeoff
      // 0.5/0.333, the soft landing's first frame 0.5/0.4); the rest centre.
      const pivot = Math.round(f.h) === 300 ? 0.333 : Math.round(f.h) === 250 ? 0.4 : 0.5;
      assert.ok(near(f.pivotX, 0.5) && near(f.pivotY, pivot), `${key}[${i}] pivot ${f.pivotX},${f.pivotY}`);
      assert.match(f.sourceID, /^-?\d+$/);
    }
  }
});

test("no-cape clips: the archive's keyframes and timing, one per model state, looping like the caped set", () => {
  for (const [clip, [src, count, fps, sheet, frames]] of Object.entries(NOCAPE)) {
    const a = manifest.animations[clip];
    assert.equal(a.source, `Animations/Diana/No Cape/${src}.anim`, clip);
    assert.equal(a.frames.length, count, clip);
    assert.equal(a.fps, fps);
    assert.ok(a.frames.every((q) => q.sheet === sheet), `${clip} on ${sheet}`);
    assert.deepEqual(a.frames.map((q) => q.frame), frames, clip);
    // Keyframes one sample apart from 0 (the flight holds its last frames
    // as the caped dash does), the duration one sample past the last.
    if (clip === "nocapeDash") assert.deepEqual(a.frames.map((q) => q.time), manifest.animations.dash.frames.map((q) => q.time));
    else a.frames.forEach((q, i) => assert.ok(Math.abs(q.time - i / fps) < 1e-3, `${clip} key ${i} at ${q.time}`));
    assert.ok(near(a.duration, a.frames.at(-1).time + 1 / fps, 1e-6));
  }
  // Every model state has its no-cape clip; dash is the body alone (no cape layer).
  for (const [state, clip] of Object.entries(NOCAPE_CLIPS)) {
    assert.ok(manifest.animations[clip], clip);
    assert.equal(clipFor(manifest, state, "nocape"), clip);
    assert.equal(clipFor(manifest, state, "cape"), state);
  }
  assert.deepEqual(characterLayers(manifest, "nocapeDash", 0.2).map((l) => l.sheet), ["bodyDash"]);
  assert.equal(characterLayers(manifest, "dash", 0.2).length, 2);
  // Loops: run, idle and air (as their caped clips); transitions hold.
  for (const name of ["nocapeRun", "nocapeIdle", "nocapeAir"]) assert.ok(LOOPS.has(name), name);
  const run = manifest.animations.nocapeRun;
  assert.deepEqual(frameForClip(manifest, "nocapeRun", 0.05), frameForClip(manifest, "nocapeRun", run.duration + 0.05));
  for (const name of ["nocapeJump", "nocapeSoftLanding", "nocapeHardLanding", "nocapeStart", "nocapeStop"]) {
    const f = manifest.animations[name].frames.at(-1);
    assert.deepEqual(frameForClip(manifest, name, 10), { sheet: f.sheet, frame: f.frame }, name);
  }
  // A partial manifest falls back to the caped clip instead of drawing nothing.
  const partial = { ...manifest, animations: { ...manifest.animations } };
  delete partial.animations.nocapeAir;
  assert.equal(clipFor(partial, "air", "nocape"), "air");
});

test("breath bar art: unchanged originals, measured where style.css crops them", async () => {
  const sources = { breathDisc: "DianaCooldownCircle.png", breathFrame: "barrinha.png", breathFill: "recheioBarra.png", meteor: "meteoroCheio.png" };
  for (const [key, file] of Object.entries(sources)) {
    assert.equal(manifest[key].source, `Sprites/UI/${file}`);
    assert.equal(manifest[key].hud, true, `${key} is HUD art (CSS, not the canvas)`);
    assert.deepEqual(manifest[key].frames, []);
  }
  const png = async (key) => readFile(new URL(`../assets/${key}.png`, import.meta.url));
  // The frame's visible box and its hole (the alpha < 64 run inside it).
  assert.deepEqual(alphaBounds(await png("breathFrame")), { x: 25, y: 77, w: 390, h: 94 });
  const frame = decodePNG(await png("breathFrame"));
  const alpha = (x, y) => frame.pixels[(y * frame.width + x) * 4 + 3];
  assert.ok(alpha(53, 124) > 64 && alpha(54, 124) <= 64 && alpha(385, 124) <= 64 && alpha(386, 124) > 64, "hole x 54-386");
  assert.ok(alpha(220, 107) > 64 && alpha(220, 108) <= 64 && alpha(220, 140) <= 64 && alpha(220, 141) > 64, "hole y 108-141");
  assert.deepEqual(alphaBounds(await png("breathFill")), { x: 129, y: 453, w: 822, h: 102 });
  // The disc and the meteor share one circle, so the switch never jumps.
  assert.deepEqual(alphaBounds(await png("breathDisc")), alphaBounds(await png("meteor")));
});

test("usage record: the no-cape and breath art are on screen; the meteor's star quota is recorded as not used", () => {
  const u = manifest.usage;
  for (const key of [...Object.keys(SHEETS), "breathDisc", "breathFrame", "breathFill", "meteor"]) assert.ok(u.onScreen[key], key);
  assert.match(u.meaningsNotUsed.meteor, /star quota/);
  assert.ok(u.archiveOnly["No Cape/running.anim"], "the stray clip copy is recorded");
  // Everything the manifest lists as a file exists in exactly one usage list.
  for (const [key, v] of Object.entries(manifest)) if (v?.file?.endsWith(".png")) assert.ok(u.onScreen[key] || u.archiveOnly[key], key);
});
