/** Sample original Unity keyframe times instead of globally cycling sprite grids. */
export function frameForClip(manifest, name, age) {
  const clip = manifest.animations[name] || manifest.animations.air;
  const loop = ["idle", "run", "air", "sprout"].includes(name);
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
