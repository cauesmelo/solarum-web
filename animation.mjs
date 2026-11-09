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
