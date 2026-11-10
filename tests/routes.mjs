/** Reusable QA pilots. They only call public actions (jump, releaseJump, dash,
 * dive and the held-cape `glide` control); no teleporting, physics edits,
 * pickup edits, checkpoint edits, time edits or invulnerability.
 *
 * These three functions are serialized into the browser with .toString(), so
 * each must stay self-contained: no imports and no module-scope references
 * other than each other by name.
 *
 * A plan step is [x, action, when]: fire `action` at the first sample where
 * Diana's x >= x and `when` holds ('g' grounded, 'a' airborne, '*' always).
 * `glide`/`unglide` toggle the held cape; `tap` is a jump released in the
 * same tick (callers press both). Steps fire in order, so a missed
 * grounded jump waits for the next landing rather than firing midair.
 * Route names: main (alias low), upper (aliases high, mastery: all three
 * Great Stars of the level), ability (the level's optional verbs: taps and
 * holds in L1, glides and the cache dive in L2) and safe (the lower stable
 * line where a level has one). The plans live with each level's geometry
 * (level.mjs `routes`) and reach the pilot through the state. */
export function createRouteMemory(route = "main") {
  return { route, i: -1, glide: false, actions: [], used: new Set() };
}
export function chooseAction(s, m) {
  const alias = { low: "main", high: "upper", mastery: "upper" };
  const name = alias[m.route] || m.route;
  // Each level authors its pilots next to its geometry (level.mjs routes,
  // exposed on the state). Main-route thresholds sit on the 107 BPM grid,
  // x = 220 + 37.85 k (plus 113.55 px per completed flight), a fraction of
  // a pixel early so the 120 Hz sample that reaches sixteenth k fires.
  const plans = s.routes ?? s.def.routes;
  const plan = plans[name] || plans.main;
  const p = s.player;
  if (m.i < 0) {
    m.i = plan.findIndex((q) => q[0] >= p.x - 1);
    if (m.i < 0) m.i = plan.length;
  }
  while (m.i < plan.length) {
    const [x, action, when] = plan[m.i];
    if (p.x < x) return null;
    if (when === "g" && !p.grounded) return null;
    if (when === "a" && p.grounded) return null;
    m.i++;
    if (action === "glide") m.glide = true;
    else if (action === "unglide") m.glide = false;
    else return action;
  }
  return null;
}
export function playRoute(
  api,
  { route = "main", level = null, dt = 1 / 120, maxSeconds = 100 } = {},
) {
  // { level } starts that level first (the browser's __game.startLevel).
  if (level != null && api.startLevel) api.startLevel(level);
  const m = createRouteMemory(route);
  let state = api.getState();
  for (let i = 0; i < maxSeconds / dt && state.status === "running"; i++) {
    const action = chooseAction(state, m);
    if (action) {
      // "tap": a jump released in the same tick (the shortest hop).
      if (action === "tap") (api.jump(), api.releaseJump());
      else api[action]();
      m.actions.push({ time: state.time, x: state.player.x, action });
    }
    state = api.step(dt, { glide: m.glide }, { render: false });
  }
  api.step(0, {}, { render: true });
  return {
    status: state.status,
    time: state.time,
    stars: state.stars,
    highStars: state.highStars,
    greatStars: state.greatStars,
    ringsCrossed: state.ringsCrossed,
    constellations: state.constellations,
    checkpointsReached: state.checkpointsReached,
    actions: m.actions,
    level: state.level,
    state,
  };
}
