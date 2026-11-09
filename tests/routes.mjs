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
 * `glide`/`unglide` toggle the held cape. Steps fire in order, so a missed
 * grounded jump waits for the next landing rather than firing midair.
 * Route names: main (alias low), upper (aliases high, mastery: all three
 * Great Stars), ability (main route plus tap hop, lid smash, star well and
 * glide in the wind) and safe (the finale's lower stable line). */
export function createRouteMemory(route = "main") {
  return { route, i: -1, glide: false, actions: [], used: new Set() };
}
export function chooseAction(s, m) {
  const alias = { low: "main", high: "upper", mastery: "upper" };
  const name = alias[m.route] || m.route;
  const common = {
    waking: [
      [1080, "jump", "g"],
      [1430, "jump", "g"],
      [1742, "jump", "g"],
      [2122, "jump", "g"],
      [2690, "jump", "g"],
    ],
    leap: [
      [3305, "jump", "g"],
      [3415, "jump", "a"],
    ],
    climb: [
      [3978, "jump", "g"],
      [4468, "jump", "g"],
      [4572, "jump", "a"],
      [5010, "jump", "g"],
      [5338, "jump", "g"],
      [5470, "jump", "a"],
      [6118, "jump", "g"],
    ],
    breaking: [
      [7098, "jump", "g"],
      [7778, "jump", "g"],
      [8082, "jump", "g"],
    ],
    ridge: [
      [8688, "jump", "g"],
      [9162, "jump", "g"],
      [9372, "jump", "g"],
      [9782, "jump", "g"],
      [10288, "jump", "g"],
    ],
    over: [
      [10968, "jump", "g"],
      [11690, "jump", "g"],
    ],
    wave: [
      [11975, "jump", "g"],
      [12215, "jump", "g"],
      [12455, "jump", "g"],
      [12695, "jump", "g"],
      [12915, "jump", "g"],
      [13155, "jump", "g"],
    ],
    crown: [
      [13645, "jump", "g"],
      [13965, "jump", "g"],
      [14070, "jump", "a"],
    ],
    wind: [
      [15082, "jump", "g"],
      [15162, "dash", "a"],
      [16002, "jump", "g"],
      [16082, "dash", "a"],
      [16572, "jump", "g"],
      [16650, "dash", "a"],
      [17312, "jump", "g"],
    ],
    updraft: [
      [18052, "jump", "g"],
      [18790, "jump", "g"],
      [19210, "jump", "g"],
    ],
    finale: [
      [19852, "jump", "g"],
      [20172, "jump", "g"],
      [20252, "dash", "a"],
      [20505, "jump", "a"],
      [20645, "dash", "a"],
    ],
  };
  const plans = {
    main: [
      ...common.waking, ...common.leap, ...common.climb, ...common.breaking,
      ...common.ridge, ...common.over, ...common.wave, ...common.crown,
      ...common.wind, ...common.updraft, ...common.finale,
    ],
    upper: [
      ...common.waking, ...common.leap,
      [3975, "jump", "g"], [4050, "jump", "a"],
      [4150, "jump", "g"],
      [4268, "jump", "g"],
      [4572, "jump", "a"],
      [5010, "jump", "g"],
      [5338, "jump", "g"], [5390, "jump", "a"],
      [5628, "jump", "g"],
      [6118, "jump", "g"],
      ...common.breaking,
      [8688, "jump", "g"], [8760, "jump", "a"],
      [9060, "jump", "g"], [9390, "jump", "g"], [9720, "jump", "g"],
      [10288, "jump", "g"],
      [10968, "jump", "g"], [11250, "dive", "g"],
      [11640, "jump", "g"], [11720, "jump", "a"],
      [11900, "jump", "g"],
      ...common.wave.slice(1), ...common.crown, ...common.wind,
      [18052, "jump", "g"],
      [18080, "glide", "*"],
      [18262, "unglide", "*"],
      [18268, "dash", "a"], [18300, "jump", "a"],
      [18790, "jump", "g"], [19210, "jump", "g"],
      ...common.finale,
    ],
    ability: [
      // Tap for the low star row, hold for the high one (the opening lesson).
      [482, "jump", "g"], [484, "releaseJump", "*"],
      [748, "jump", "g"],
      ...common.waking, ...common.leap,
      ...common.climb.slice(0, 3),
      [5010, "jump", "g"], [5012, "releaseJump", "*"],
      ...common.climb.slice(4),
      ...common.breaking,
      ...common.ridge,
      [10968, "jump", "g"], [11250, "dive", "g"],
      [11640, "jump", "g"], [11720, "jump", "a"],
      [11900, "jump", "g"],
      ...common.wave.slice(1), ...common.crown,
      // The hearth breeze: jump into it and hold the cape to float up.
      [14300, "jump", "g"], [14330, "glide", "*"], [14500, "unglide", "*"],
      ...common.wind,
      [18052, "jump", "g"],
      [18080, "glide", "*"], [18300, "unglide", "*"],
      // Second dive: break the lid on the lifted shore into the star cache.
      [18600, "dive", "g"],
      [18885, "jump", "g"],
      [19210, "jump", "g"],
      ...common.finale,
    ],
    // The finale's lower safe line: stable islands and plain jumps only.
    safe: [
      ...common.waking, ...common.leap, ...common.climb, ...common.breaking,
      ...common.ridge, ...common.over, ...common.wave, ...common.crown,
      ...common.wind, ...common.updraft,
      [19852, "jump", "g"],
      [20430, "jump", "g"],
      [21080, "jump", "g"],
      [21390, "jump", "g"],
    ],
  };
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
  { route = "main", dt = 1 / 120, maxSeconds = 100 } = {},
) {
  const m = createRouteMemory(route);
  let state = api.getState();
  for (let i = 0; i < maxSeconds / dt && state.status === "running"; i++) {
    const action = chooseAction(state, m);
    if (action) {
      api[action]();
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
    state,
  };
}
