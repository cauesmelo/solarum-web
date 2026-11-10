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
  // Main-route thresholds sit on the 107 BPM grid: x = 220 + 37.85 k (plus
  // 113.55 px per completed flight), half a pixel early so the 120 Hz sample
  // that reaches sixteenth k fires (LEVEL_DESIGN, "Beat map").
  const common = {
    waking: [
      [1090.3, "jump", "g"],
      [1432, "jump", "g"],
      [1733.5, "jump", "g"],
      [2113.5, "jump", "g"],
      [2642.5, "jump", "g"],
    ],
    leap: [
      [3324, "jump", "g"],
      [3475, "jump", "a"],
    ],
    climb: [
      [3929.5, "jump", "g"],
      [4460.5, "jump", "g"],
      [4573, "jump", "a"],
      [4989, "jump", "g"],
      [5367, "jump", "g"],
      [5556, "jump", "a"],
      [6125.5, "jump", "g"],
    ],
    breaking: [
      [7108.5, "jump", "g"],
      [7790.5, "jump", "g"],
      [8094, "jump", "g"],
    ],
    ridge: [
      [8548.1, "jump", "g"],
      [9002.6, "jump", "g"],
      [9229.6, "jump", "g"],
      [9607.6, "jump", "g"],
      [9985.2, "jump", "g"],
    ],
    over: [
      [10666.7, "jump", "g"],
      [11348.7, "jump", "g"],
    ],
    // The cascade is a bounce: every touch-down is the next takeoff.
    wave: [
      [11537.7, "jump", "g"],
      [11764.7, "jump", "g"],
      [11953.7, "jump", "g"],
      [12181.2, "jump", "g"],
      [12370.2, "jump", "g"],
      [12597.2, "jump", "g"],
    ],
    crown: [
      [13353.7, "jump", "g"],
      [13545, "jump", "g"],
      [13695.7, "jump", "a"],
    ],
    wind: [
      [14981.5, "jump", "g"],
      [15096, "dash", "a"],
      [16004, "jump", "g"],
      [16080.5, "dash", "a"],
      [16572, "jump", "g"],
      [16684.5, "dash", "a"],
      [17291, "jump", "g"],
    ],
    updraft: [
      [18047, "jump", "g"],
      [18805, "jump", "g"],
      [19106.5, "jump", "g"],
    ],
    finale: [
      [19865, "jump", "g"],
      [20168.5, "jump", "g"],
      [20243, "dash", "a"],
      [20507, "jump", "a"],
      [20583.5, "dash", "a"],
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
      [8536.6, "jump", "g"], [8608.6, "jump", "a"],
      [8908.6, "jump", "g"], [9238.6, "jump", "g"], [9568.6, "jump", "g"],
      // From the chain's exit straight down to the beacon island.
      [9935, "jump", "g"],
      [10665.2, "jump", "g"], [10947.2, "dive", "g"],
      [11337.2, "jump", "g"], [11390, "jump", "a"],
      [11597.2, "jump", "g"],
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
      [10665.2, "jump", "g"], [10947.2, "dive", "g"],
      [11337.2, "jump", "g"], [11390, "jump", "a"],
      [11597.2, "jump", "g"],
      ...common.wave.slice(1), ...common.crown,
      // The hearth breeze: jump into it and hold the cape to float up.
      [13997.2, "jump", "g"], [14027.2, "glide", "*"], [14197.2, "unglide", "*"],
      ...common.wind,
      [18052, "jump", "g"],
      [18080, "glide", "*"], [18300, "unglide", "*"],
      // Second dive: break the lid on the lifted shore into the star cache.
      [18600, "dive", "g"],
      // The cache floor is 110 px under the landing beyond it: a double jump.
      [18850, "jump", "g"], [18930, "jump", "a"],
      [19106.5, "jump", "g"],
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
