/* Glyph signs (RESEARCH_TRANSITIONS §1): each glyph row is a still sign of
 * the world, like an island. Its geometry comes from the level data and the
 * layout scale only, and its opacity from the camera only. Nothing here may
 * take the player, a prompt's `done`/`after`, the status, falls or a route:
 * that signature is the guarantee the owner asked for ("background elements,
 * purely informational"), and tests/signage.test.mjs (T1) checks it.
 *
 * Units: world px. A disc is radius 19·s with a paper ring at r + 4; discs
 * are spaced 48·s; "hold" adds three diamonds 10 px under the disc (14 px of
 * extra depth with their own radius). s = (optional ? 0.82 : 1) × the layout
 * scale clamp(0.9 / cssScale, 1, 1.8), which changes only on resize. */
import { VIEW } from "./geometry.mjs";

export const SIGN = Object.freeze({
  r: 19,
  ring: 4,
  spacing: 48,
  holdDepth: 14,
  optionalScale: 0.82,
  optionalAlpha: 0.75,
  // The signage window fades a row in over its right 64 px (0.20-0.29 s at
  // 222-323 px/s) and out over its left 48 px.
  fadeIn: 64,
  fadeOut: 48,
});
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** The layout constant: glyph discs keep about 20 css px of radius on small
 * (portrait) skies, up to 1.8×. `cssScale` is css px per logical px. */
export function layoutScale(cssScale) {
  return Math.min(1.8, Math.max(1, 0.9 / (cssScale || 1)));
}
/** The level's landscape reference width (its minimum landscape view). */
export function refWidthOf(def) {
  return Math.max(VIEW.minWidth, def?.view?.minWidth ?? 0);
}
/** The narrowest (portrait) sky the level ever shows. */
export function portraitWidthOf(def) {
  return Math.max(VIEW.portraitMinWidth, def?.view?.portraitMinWidth ?? 0);
}

/** One row's world geometry: disc centres, "then" diamonds and its rect
 * (ring and hold dots included). Pure function of the prompt and scale. */
export function signRow(q, layout = 1) {
  const s = (q.optional ? SIGN.optionalScale : 1) * layout,
    items = q.glyph,
    spacing = SIGN.spacing * s,
    count = items.filter((g) => g !== "then").length,
    discs = [],
    thens = [];
  let gx = q.x - ((count - 1) * spacing) / 2;
  for (const g of items) {
    if (g === "then") {
      thens.push({ x: gx - spacing / 2, y: q.y });
      continue;
    }
    discs.push({ x: gx, y: q.y, kind: g });
    gx += spacing;
  }
  const r = SIGN.r * s + SIGN.ring,
    hold = items.some((g) => g.startsWith("hold-"));
  return {
    id: q.id,
    x: q.x,
    y: q.y,
    optional: !!q.optional,
    scale: s,
    discs,
    thens,
    rect: { left: discs[0].x - r, right: discs.at(-1).x + r, top: q.y - r, bottom: q.y + r + (hold ? SIGN.holdDepth : 0) },
  };
}
/** The signage window in world x: a fixed share of the camera, never
 * Diana. P is the camera's player column; refW' = min(W, refW) caps it on
 * ultrawide screens so "one at a time" holds on any monitor. */
export function signWindow(cameraX, W, refWidth) {
  const P = cameraX + VIEW.playerFraction * W,
    w = Math.min(W, refWidth);
  return { left: P - VIEW.playerFraction * w, right: P + (1 - VIEW.playerFraction) * w };
}
/** A row's opacity in a window (linear over the fade spans). */
export function signAlpha(row, win) {
  const a = Math.min(clamp01((win.right - row.rect.right) / SIGN.fadeIn), clamp01((row.rect.left - win.left) / SIGN.fadeOut));
  return a * (row.optional ? SIGN.optionalAlpha : 1);
}
/** Every row with its alpha at this camera: (prompts, camera.x, W,
 * refWidth, layout scale, coarse). `coarse` only changes how the up disc is
 * drawn (the jump zone's rounded square), never where. */
export function signsAt(prompts, cameraX, W, refWidth, layout = 1, coarse = false) {
  const win = signWindow(cameraX, W, refWidth);
  return prompts.map((q) => {
    const row = signRow(q, layout);
    return { ...row, alpha: signAlpha(row, win), coarse: !!coarse };
  });
}
/** Diana's drawn box (feet-anchored): x ± 26, feet − 90 to the feet. */
export function dianaBox(x, feet) {
  return { left: x - 26, right: x + 26, top: feet - 90, bottom: feet };
}
export function rectsTouch(a, b, margin = 0) {
  return a.left < b.right + margin && a.right > b.left - margin && a.top < b.bottom + margin && a.bottom > b.top - margin;
}
