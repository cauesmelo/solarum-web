/** Pure render geometry: camera framing, letterboxing, contours and portal
 * contact. Kept free of the DOM so fairness contracts are testable in Node.
 * Units are logical world px (the canvas always shows VIEW.height of them
 * vertically) and seconds. */
export const VIEW = Object.freeze({
  height: 675,
  // Narrower viewports letterbox instead of cropping, so lookahead never drops
  // below 77% of 880 = 678 px = 2.51 s at 270 px/s (the 2.5 s target), on any
  // screen. 880 rather than 960 gives phones in portrait a 9% taller sky.
  minWidth: 880,
  // Letterboxed (portrait) skies may go down to 720 px: lookahead 554 px =
  // 2.05 s (>= the 2.0 s floor) in exchange for a 22% taller sky on phones.
  portraitMinWidth: 720,
  // The deck under a letterboxed sky keeps at least this much css height.
  deckMin: 200,
  playerFraction: 0.23,
  // The camera anchors on the last grounded y. follow < 1 damps the move so a
  // high shelf and the main route below it fit in one frame (no blind drop).
  anchorScreenY: 470,
  follow: 0.65,
  // After 0.35 s of falling the camera looks down, at most 120 px.
  lookDownDelay: 0.35,
  lookDownRate: 300,
  lookDownMax: 120,
  lerpTau: 0.35,
  // The top band holds the HUD; Diana's head is kept below it.
  topBand: 56,
  headroom: 64,
  bodyHeight: 58,
  runSpeed: 270,
});
export function outlineY(platform, localX) {
  const phase = Number.isFinite(platform.phase) ? platform.phase : 0;
  return platform.y + Math.sin(localX * 0.075 + phase) * 1.5;
}
export function portalPlacement(x, groundY, bounds, width = 110) {
  const height = (width * bounds.h) / bounds.w;
  return {
    source: { ...bounds },
    x: x - width / 2,
    y: groundY + 3 - height,
    width,
    height,
    baseY: groundY + 3,
    groundY,
  };
}
/** Horizontal framing for a logical width (already letterboxed). */
export function viewGeometry(width) {
  const w = Math.max(width, VIEW.portraitMinWidth);
  const playerScreenX = w * VIEW.playerFraction;
  const lookahead = w - playerScreenX;
  return {
    width: w,
    playerScreenX,
    lookahead,
    lookaheadSeconds: lookahead / VIEW.runSpeed,
  };
}
/** Fit the logical view into a CSS box. Wide boxes show more world; boxes
 * narrower than minWidth:height letterbox (the sky keeps its full width and
 * the leftover height becomes the control deck). `view` raises the minimum
 * widths for a faster level (RESEARCH_LEVELS 7: 2.5 s of landscape and
 * 2.0 s of portrait lookahead at L3's 298 and L4's 323 px/s real need 970 /
 * 775 and 1050 / 840 logical px). A landscape box between the two minimums
 * letterboxes thinly above and below instead of turning into a deck. */
export function fitStage(boxWidth, boxHeight, hudBar = 0, view = null) {
  const minWidth = Math.max(VIEW.minWidth, view?.minWidth ?? 0),
    portraitMin = Math.max(VIEW.portraitMinWidth, view?.portraitMinWidth ?? 0);
  const aspect = boxWidth / Math.max(1, boxHeight);
  const minAspect = minWidth / VIEW.height;
  if (aspect >= minAspect) {
    return {
      layout: "landscape",
      top: 0,
      cssWidth: boxWidth,
      cssHeight: boxHeight,
      logicalWidth: VIEW.height * aspect,
      scale: boxHeight / VIEW.height,
    };
  }
  if (aspect >= VIEW.minWidth / VIEW.height) {
    const cssHeight = (boxWidth * VIEW.height) / minWidth;
    return {
      layout: "landscape",
      top: (boxHeight - cssHeight) / 2,
      cssWidth: boxWidth,
      cssHeight,
      logicalWidth: minWidth,
      scale: boxWidth / minWidth,
    };
  }
  // As tall a sky as the box allows, but never narrower than portraitMinWidth
  // and always leaving room for the HUD bar and a usable control deck.
  const room = Math.max(1, boxHeight - hudBar - VIEW.deckMin);
  const logicalWidth = Math.max(portraitMin, (VIEW.height * boxWidth) / room);
  const cssHeight = (boxWidth * VIEW.height) / logicalWidth;
  return {
    layout: "portrait",
    top: hudBar,
    cssWidth: boxWidth,
    cssHeight,
    logicalWidth,
    scale: boxWidth / logicalWidth,
  };
}
/** Camera top (world y at the top screen edge) the camera eases toward. */
export function cameraTargetY(anchorY, fallTime = 0) {
  const base = VIEW.follow * (anchorY - VIEW.anchorScreenY);
  const look =
    fallTime > VIEW.lookDownDelay
      ? Math.min(
          VIEW.lookDownMax,
          (fallTime - VIEW.lookDownDelay) * VIEW.lookDownRate,
        )
      : 0;
  return base + look;
}
/** Where a fall may count (the owner's video, 2026-11-10: Diana "died in the
 * middle of the map"). The doom line, anchorY + fallLimit (265 px), is where
 * nothing can save her any more; but with the damped camera (follow 0.65 and
 * a look-down of up to 120 px) it sat at 74% to 110% of the screen height
 * (median 91%, measured on the 245 platforms of the eight levels at the 0.59 s
 * a 265 px fall takes), so she used to shatter in plain view, her head on
 * screen on every platform and her feet on 89% of them, over the Moon's limb. The fall
 * counts only once her drawn body (spriteUp px above her feet: the leaf tips
 * reach 83-91 px in the air poses and 109 in the takeoff's first frame) is
 * wholly under the bottom edge of the view the camera can have at that moment,
 * plus `margin` px for the camera's lag after a rise (its lerp is 0.35 s, so a
 * 267 px super-jump landing leaves under 15 px of lag 0.9 s later, the
 * soonest a walk-off can reach the line). Between the two lines she is doomed
 * (model.mjs `doomed`): nothing she presses and nothing below her changes the
 * outcome, so physics, routes and fairness are exactly the old rule's; only
 * the moment the fall is declared moves down, out of sight. The vertical view
 * is VIEW.height in every viewport (wide, letterboxed or portrait only change
 * the logical width), so no aspect can show more than this. */
export const FALL_OUT = Object.freeze({ spriteUp: 112, margin: 48 });
export function fallOutLine(anchorY, fallTime = 0) {
  return cameraTargetY(anchorY, fallTime) + VIEW.height + FALL_OUT.spriteUp + FALL_OUT.margin;
}
/** The respawn's three phases in the model's own simulation seconds (the
 * numbers tickRespawn() steps by). They are the level's physics, not RULES:
 * the simulation runs at clock = BPM / 107 of real time, so a level above 107
 * BPM stretches 0.45 + 0.25 s to 0.54 + 0.30 s of simulation (VIII: 1.196).
 * The renderer used the unscaled RULES and so closed the iris, and finished
 * the camera's ride back, 16% early: the model then waited out the difference
 * with the view completely black (about 120 ms in VIII; the owner's video
 * shows seven blank frames at every respawn). */
export function respawnTimes(physics) {
  const close = physics.respawnShatter,
    cut = close + physics.respawnIris;
  return { close, iris: physics.respawnIris, cut, open: cut + physics.respawnPop, pop: physics.respawnPop };
}
/** The iris never closes below this radius (px): the beacon's light stays lit
 * through the swap, so the view goes dark but never blank. The model restores
 * the beacon's world on the tick the iris is at its smallest (t = cut). */
export const LANTERN = 26;
/** The dark of a respawn at simulation time t of `status` (dead | respawning):
 * { radius } of the lit circle round the beacon for the iris, or { alpha }
 * of an even dark for reduced motion (a slow cross-fade, never a cut), or
 * null while the view is fully open. `width` is the logical view width (the
 * circle is always wide enough to leave nothing dark when open). */
export function irisAt(status, t, physics, width, reduced = false) {
  const T = respawnTimes(physics);
  let u = null; // 0 = open to the whole view, 1 = the lantern alone
  if (status === "dead" && t > T.close) u = Math.min(1, (t - T.close) / T.iris);
  else if (status === "respawning") u = 1 - Math.min(1, (t - T.cut) / (T.pop * 0.6));
  if (u == null || u <= 0) return null;
  if (reduced) return { alpha: 0.94 * u };
  const e = u * u * (3 - 2 * u);
  return { radius: LANTERN + (1 - e) * (width - LANTERN) };
}
/** Hard limit applied after easing: Diana's head never enters the top band. */
export function clampCameraY(cameraY, playerY) {
  return Math.min(cameraY, playerY - VIEW.bodyHeight - VIEW.headroom);
}
export function stepCamera(current, target, dt) {
  return current + (target - current) * (1 - Math.exp(-dt / VIEW.lerpTau));
}
/** The world band a settled camera shows while Diana stands at anchorY. */
export function visibleBand(anchorY) {
  const top = cameraTargetY(anchorY, 0);
  return { top, bottom: top + VIEW.height, hudBottom: top + VIEW.topBand };
}
