/** Diana emerges from the earth under the sprout (the original trailer, about
 * 91-99 s: the sprout twitches, a head rises out of the soil, looks, pops up).
 *
 * Pure timeline, no DOM or canvas: game.js samples it every frame while the
 * title's wake plays and draws Diana's own sprites with their feet `depth` px
 * below the soil line. The title ground is drawn after the world, so it masks
 * whatever is still under the soil along its exact contour (no clip path).
 * Units: seconds of real time, px in the logical view (Diana is drawn at the
 * 0.42 scale, so a 200 px source frame is 84 px tall from her feet).
 *
 * The sprite set is a parameter: `SPRITE_SETS` maps the roles the emergence
 * needs (body: the frame that rises, start: the original start clip, run) to
 * manifest clip names. A level that starts without the cape names the
 * `nocape` set; until its sheets are extracted into the manifest, `resolveSet`
 * falls back to the cape set, so the emergence never draws a missing clip. */

/** Real-seconds beats. Full: 0.26 twitch + 0.42 rise + 0.30 look + 0.24 pop =
 * 1.22 s, then the model's 0.333 s `start` clip runs into the run: 1.55 s from
 * the press to running (the brief's ceiling is about 1.6 s). Reduced motion
 * keeps only a short, unbouncing rise. */
export const EMERGE_BEATS = Object.freeze({
  full: Object.freeze({ twitch: 0.26, rise: 0.42, look: 0.3, pop: 0.24 }),
  reduced: Object.freeze({ twitch: 0, rise: 0.24, look: 0.06, pop: 0.06 }),
});
/** The model's start clip (Animations/Diana/start.anim: 4 frames at 12 fps). */
export const START_CLIP_SECONDS = 4 / 12;
/** Feet this far under the soil hide the whole 84 px frame plus her leaves. */
export const BURIED = 92;
/** At the end of the rise the head, eyes and chin are out (feet 40 px under
 * the soil: her leaves 44 px above it, the chin about 10 px above). */
export const HEAD_OUT = 40;
/** How high the pop lifts her feet over the soil at its top (px). */
export const POP_HOP = 12;

export const SPRITE_SETS = Object.freeze({
  // The approved clips (ANIMATION_AUDIT.md): idle rises, start, then run.
  cape: Object.freeze({ body: "idle", start: "start", run: "run" }),
  // The archive's override clips (Animations/Diana/No Cape/nocape-idle,
  // nocape-start, nocape-running) under the names an extraction would give.
  nocape: Object.freeze({ body: "nocapeIdle", start: "nocapeStart", run: "nocapeRun" }),
});

/** The set to draw: `name` if every clip it needs is in the manifest,
 * otherwise the cape set (flagged as a fallback). */
export function resolveSet(manifest, name = "cape") {
  const wanted = SPRITE_SETS[name] ?? SPRITE_SETS.cape;
  const has = (clip) => !!manifest?.animations?.[clip];
  const complete = Object.values(wanted).every(has);
  return complete ? { name: name in SPRITE_SETS ? name : "cape", ...wanted, fallback: false } : { name: "cape", ...SPRITE_SETS.cape, fallback: name !== "cape" };
}

export function emergenceSeconds(reduced = false) {
  const b = reduced ? EMERGE_BEATS.reduced : EMERGE_BEATS.full;
  return b.twitch + b.rise + b.look + b.pop;
}

const clamp01 = (u) => Math.max(0, Math.min(1, u));
const easeOut = (u) => 1 - (1 - u) ** 3;
const smooth = (u) => u * u * (3 - 2 * u);

/** The emergence at `t` seconds after the press.
 * Returns { phase, depth, sprout: { alpha, scale, lift, shake, rate },
 * crumbs (soil bits to throw on this phase's first frame), done }.
 * depth > 0 is under the soil; < 0 is a hop above it. */
export function emergenceAt(t, { reduced = false } = {}) {
  const b = reduced ? EMERGE_BEATS.reduced : EMERGE_BEATS.full;
  const t1 = b.twitch,
    t2 = t1 + b.rise,
    t3 = t2 + b.look,
    t4 = t3 + b.pop;
  const out = {
    phase: "twitch",
    depth: BURIED,
    sprout: { alpha: 1, scale: 0.42, lift: 0, shake: 0, rate: 1 },
    crumbs: 0,
    done: t >= t4,
    t,
    total: t4,
  };
  if (t < t1) {
    // Anticipation: the leaves shiver (a decaying 9 Hz wobble) and play fast.
    const u = t / t1;
    out.sprout.rate = 3;
    out.sprout.shake = reduced ? 0 : 0.09 * Math.sin(u * Math.PI * 2 * 2.4) * (1 - 0.4 * u);
    out.sprout.lift = 3 * smooth(u);
    out.crumbs = 2;
    return out;
  }
  if (t < t2) {
    // The head rises out of the soil; the big title leaves shrink and fade
    // into Diana's own leaves as they ride up on her head.
    const u = clamp01((t - t1) / b.rise),
      e = easeOut(u);
    out.phase = "rise";
    out.depth = BURIED + ((reduced ? 0 : HEAD_OUT) - BURIED) * e;
    // The leaves stay rooted while the head grows up into them, then fade
    // as her own leaves (drawn on her head) take their place.
    const fade = clamp01((u - 0.1) / 0.5);
    out.sprout.alpha = 1 - fade;
    out.sprout.scale = 0.42 - 0.1 * fade;
    out.sprout.lift = 3 + 5 * fade;
    out.crumbs = reduced ? 0 : 3;
    return out;
  }
  out.sprout.alpha = 0;
  if (t < t3) {
    // A beat of looking: head out, still, breathing (the idle clip plays).
    const u = (t - t2) / Math.max(1e-6, b.look);
    out.phase = "look";
    out.depth = reduced ? 0 : HEAD_OUT - Math.sin(u * Math.PI) * 1.5;
    return out;
  }
  if (t < t4) {
    // The pop: out of the soil in one small hop, landing on it.
    const u = clamp01((t - t3) / b.pop);
    out.phase = "pop";
    out.depth = reduced ? 0 : HEAD_OUT * (1 - easeOut(u)) - POP_HOP * Math.sin(Math.PI * u);
    out.crumbs = reduced ? 0 : 8;
    return out;
  }
  out.phase = "done";
  out.depth = 0;
  return out;
}
