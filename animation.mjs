/** Clips that loop on screen; every other clip holds its last frame. */
export const LOOPS = new Set(["idle", "run", "air", "sprout", "nocapeIdle", "nocapeRun", "nocapeAir"]);
/** The original no-cape override clips (Animations/Diana/No Cape, applied by
 * no-cape-diana.overrideController) for each model animation state. The
 * model keeps its state names and durations; only the drawing changes. Their
 * keyframe times are the archive's own: nocape-airbourne has 2 frames (the
 * caped one 6), nocape-idle 1 (12), nocape-stop 10 (9) and
 * nocape-hard-landing 14 (13, one more airborne frame first); the model's
 * state durations (start 1/3 s, hard landing 13/12 s, stop 0.75 s) cut the
 * longer ones a frame early, as Unity's transitions would. nocape-dash is
 * the bodyDash sheet alone: no cape layer. */
export const NOCAPE_CLIPS = Object.freeze({
  idle: "nocapeIdle",
  start: "nocapeStart",
  run: "nocapeRun",
  stop: "nocapeStop",
  jump: "nocapeJump",
  air: "nocapeAir",
  softLanding: "nocapeSoftLanding",
  hardLanding: "nocapeHardLanding",
  dive: "nocapeDive",
  dash: "nocapeDash",
});
/** The clip to draw for a model animation state in a sprite set ("cape" |
 * "nocape"). A no-cape clip missing from the manifest falls back to the
 * caped clip, so a partial extraction never draws nothing. */
export function clipFor(manifest, name, set = "cape") {
  if (set !== "nocape") return name;
  const clip = NOCAPE_CLIPS[name];
  return clip && manifest?.animations?.[clip] ? clip : name;
}
/** Sample original Unity keyframe times instead of globally cycling sprite grids. */
export function frameForClip(manifest, name, age) {
  const clip = manifest.animations[name] || manifest.animations.air;
  const loop = LOOPS.has(name);
  const cursor = loop
    ? Math.max(0, age) % clip.duration
    : Math.min(Math.max(0, age), clip.duration - 1e-7);
  let chosen = clip.frames[0];
  for (const f of clip.frames) {
    if (f.time > cursor + 1e-7) break;
    chosen = f;
  }
  return { sheet: chosen.sheet, frame: chosen.frame };
}
export function characterLayers(manifest, name, age) {
  const body = frameForClip(manifest, name, age);
  // The original dash body is the NO-CAPE sheet; its cape is a separate child
  // renderer with a custom .8 horizontal pivot. Drawing only capedash loses Diana.
  return name === "dash" ? [body, frameForClip(manifest, "cape", age)] : [body];
}
/** RESEARCH_LEVELS F1, MOVEMENT_AUDIT C1: how much lower to draw Diana's
 * current frame so that its lowest drawn pixel sits on the collider's feet:
 * the body frame's baked `foot` (px at the 0.42 draw scale, measured by
 * scripts/measure-feet.mjs). It applies in full on the frame the pose
 * changes. (It used to ease over about 50 ms, which at 144-240 Hz left the
 * toe up to 26 px off the feet for 2-4 frames after a pose change and drew
 * it through tops she was only flying over.) */
export function footFor(manifest, name, age) {
  const body = characterLayers(manifest, name, age)[0];
  return manifest[body.sheet]?.frames[body.frame]?.foot ?? 0;
}
