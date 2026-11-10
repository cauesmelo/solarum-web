/** The wordless GET moments (RESEARCH_PROGRESSION 2.1, 2.2): pure timelines
 * the renderer samples, built only from existing sprites (the star sheet,
 * the tail-star streak) and rings drawn in code. No DOM or canvas here.
 *
 * Units: seconds of real time since the moment began; px relative to
 * Diana's feet (x right, y down). A GET lasts at most one bar and the game
 * never stops (2.2), so every moment ends within `bar` seconds, and none of
 * them changes the simulation: they are drawn over it. */

const clamp01 = (u) => Math.max(0, Math.min(1, u));
const smooth = (u) => u * u * (3 - 2 * u);
const easeOut = (u) => 1 - (1 - u) ** 3;

/** Where Diana's marks sit, from her collider's feet at the 0.42 draw
 * scale (measured on the sheets' alpha): the tips of her leaves are 12-16 px
 * ahead of the centre and 83-91 px up in the run and air poses (109 px in
 * the takeoff's first frame), so the glint floats 10 px ahead and 100 px
 * up; her chest (the necklace) is 44 px up and 6 px ahead; the cape flows
 * behind her back. */
export const ANCHORS = Object.freeze({ glint: { dx: 10, dy: -100 }, chest: { dx: 6, dy: -44 }, cape: { dx: -20, dy: -50 } });

/** How long each moment is drawn, given the level's bar in real seconds. */
export function momentSeconds(verb, bar) {
  return { double: 0.5, cape: 0.6, glide: bar, dive: bar, super: Math.min(bar, 1.2) }[verb] ?? 0.5;
}

/** I (double jump): the landed star rises from her feet into the leaf glint. */
export function riseAt(t) {
  const u = clamp01(t / 0.5),
    e = easeOut(u);
  return { dx: ANCHORS.glint.dx * e, dy: -14 + (ANCHORS.glint.dy + 14) * e, scale: 0.16 - 0.07 * e, alpha: 1, done: u >= 1 };
}

/** II (cape): the cape settles on her: the caped clip fades in over the
 * no-cape one (they share pose and pivot), with a star burst at its tip. */
export function settleAt(t) {
  const u = clamp01(t / 0.6);
  return { cape: smooth(u), burst: t < 0.4, done: u >= 1 };
}

/** The mysterious helper before its GET (III glide; VIII super jump): a small
 * wandering light that drifts down a long slope of air to meet Diana at the
 * GET's x on her run line (glide), or runs ahead and leaps (super). `d` is
 * how far (world px) the GET still is ahead of her. Returns its offset from
 * the GET point (x, y above her run line) or null once she is past it. */
export function helperApproach(verb, d, t) {
  if (d < 0) return null;
  const wander = Math.sin(t * 2.3) * 5;
  if (verb === "super") {
    // Ahead of her at running height, then up out of a flight.
    const lift = d < 160 ? (160 - d) * 1.1 : 0;
    return { x: 40 + d * 0.15, y: -48 - lift + wander * 0.5, alpha: clamp01((1400 - d) / 300) };
  }
  // A long, slow slope down to the run line (about 11 degrees).
  return { x: d * 0.35, y: -52 - d * 0.2 + wander, alpha: clamp01((1400 - d) / 300) };
}

/** III after the GET: the helper loops once round Diana (0.5 s), then flies
 * off ahead and up, fading; her cape ripples on each beat of the bar. */
export function helperAfter(t, bar) {
  const loop = 0.5;
  if (t < loop) {
    const a = Math.PI * 0.2 + (t / loop) * Math.PI * 2;
    return { phase: "loop", dx: Math.cos(a) * 34, dy: -46 + Math.sin(a) * 26, alpha: 1, trail: a + Math.PI / 2 };
  }
  const u = clamp01((t - loop) / Math.max(0.2, bar - loop)),
    e = easeOut(u);
  return { phase: "away", dx: 34 + e * 520, dy: -46 - e * 180, alpha: 1 - u, trail: -0.33 };
}
/** The cape's ripple: one pulse per beat over the bar, 0-1. */
export function rippleAt(t, bar) {
  if (t < 0 || t >= bar) return 0;
  const beat = bar / 4,
    within = (t % beat) / beat;
  return Math.sin(Math.PI * within) * (1 - t / bar);
}

/** IV (dive): the necklace wakes. A glint at her chest and three rings of
 * light pulsing out from it, one per beat. */
export function necklaceAt(t, bar) {
  const beat = bar / 4;
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const u = (t - i * beat) / (beat * 1.6);
    if (u >= 0 && u < 1) rings.push({ r: 6 + easeOut(u) * 70, alpha: 0.7 * (1 - u) });
  }
  return { glint: t < bar ? 0.6 + 0.4 * Math.cos((t / beat) * Math.PI * 2) : 0, rings, fade: clamp01(1 - (t - bar * 0.75) / (bar * 0.25)) };
}
