/** Measure how far each animation frame's lowest drawn pixel sits above
 * Diana's collider feet (RESEARCH_LEVELS 1.1, F1) and bake it into
 * assets/manifest.json as a per-frame `foot` (px at the 0.42 draw scale)
 * for the airborne poses. The renderer draws those frames that much lower,
 * so what you see is what collides. PNGs, pivots, timing and layers are
 * unchanged.
 *   node scripts/measure-feet.mjs          print every frame
 *   node scripts/measure-feet.mjs --json   the offsets to bake (scripts/bake-feet.py)
 * A frame's drawn top is feet - 42 - h (1 - pivotY) 0.42 (game.js
 * drawDianaLayers), so its lowest opaque row r draws at that + (r + 1) 0.42. */
import { readFile } from "node:fs/promises";
import { decodePNG, lowestOpaqueRow } from "../tests/png.mjs";

const SCALE = 0.42;
/** Clips whose poses are airborne (or, for hardLanding's first frame, a
 * landing pose drawn as if still airborne): these get a foot offset. Ground
 * clips keep their stride bob. */
export const AIRBORNE = { jump: "all", air: "all", hardLanding: [0] };

export async function measure(manifest) {
  const out = {};
  const cache = new Map();
  for (const [sheet, def] of Object.entries(manifest)) {
    if (!def?.frames || !def.file?.endsWith(".png") || !def.frames[0]?.pivotY) continue;
    if (!cache.has(def.file)) cache.set(def.file, decodePNG(await readFile(new URL(`../${def.file}`, import.meta.url))));
    const img = cache.get(def.file);
    out[sheet] = def.frames.map((f) => {
      const r = lowestOpaqueRow(img, f);
      const lift = 42 + f.h * (1 - f.pivotY) * SCALE - (r + 1) * SCALE;
      return Math.round(lift * 10) / 10;
    });
  }
  return out;
}
/** Which sheet frames the airborne clips use. */
export function airborneFrames(manifest) {
  const set = new Map();
  for (const [clip, which] of Object.entries(AIRBORNE)) {
    const frames = manifest.animations[clip].frames;
    frames.forEach((q, i) => {
      if (which === "all" || which.includes(i)) set.set(`${q.sheet}:${q.frame}`, { sheet: q.sheet, frame: q.frame, clip });
    });
  }
  return [...set.values()];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = new URL("../assets/manifest.json", import.meta.url);
  const manifest = JSON.parse(await readFile(url, "utf8"));
  const lifts = await measure(manifest);
  const air = airborneFrames(manifest);
  if (!process.argv.includes("--json")) for (const [sheet, list] of Object.entries(lifts)) console.log(sheet.padEnd(14), list.join(" "));
  // --json prints the offsets to bake; scripts/extract-assets.py's JSON style
  // (Python floats) is kept by baking with Python: see LEVEL_DESIGN, "Art".
  if (process.argv.includes("--json")) console.log(JSON.stringify(air.map((q) => ({ ...q, foot: Math.max(0, Math.round(lifts[q.sheet][q.frame])) }))));
}
