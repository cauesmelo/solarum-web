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
 * the leftover height becomes the control deck). */
export function fitStage(boxWidth, boxHeight, hudBar = 0) {
  const aspect = boxWidth / Math.max(1, boxHeight);
  const minAspect = VIEW.minWidth / VIEW.height;
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
  // As tall a sky as the box allows, but never narrower than portraitMinWidth
  // and always leaving room for the HUD bar and a usable control deck.
  const room = Math.max(1, boxHeight - hudBar - VIEW.deckMin);
  const logicalWidth = Math.max(VIEW.portraitMinWidth, (VIEW.height * boxWidth) / room);
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
