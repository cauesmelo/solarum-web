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

/* ---------- scripted world moments and decor (level.mjs `def.moments`,
 * `def.decor`; the model emits event `moment` on each) ----------
 * A scripted moment sits on sixteenth `k` of simulation time from the wake,
 * so the renderer samples it from the simulation clock: `t` below is level
 * time (simulation seconds / the level's clock) since the moment, negative
 * before it. A respawn rewinds the clock, so what follows its beacon plays
 * again, exactly as the model's events do. Nothing here changes the
 * simulation. Every kind a level can author is listed with what it draws;
 * an unknown kind falls back to a small burst at its target (README "UI"). */

/** One sixteenth of simulation time: the model's grid (107 BPM, 4 a beat);
 * tests/scripted.test.mjs pins it to score.mjs SIXTEENTH. */
export const SIXTEENTH_SIM = 60 / 107 / 4;

export const MOMENT_KINDS = Object.freeze({
  fall: "a star falls from the upper left along a tail-star streak and lands on its target (a pickup id, or a GET id: on the run line) exactly on the moment; the target is hidden until then",
  flash: "the brightest star's paper flash across the sky (120 ms; a 400 ms fade under reduced motion), then the asteroid streaks across toward the level's next crash",
  crash: "one beat of silence before it (the score ducks), then the boom: a flash at the plume's base, the dust plume rising and the asteroid half buried there",
  helper: "the mysterious helper appears: toward its target GET (and after it down a helper decor's slope of air), riding its target wind column ahead of Diana, or just ahead of her",
  ripple: "Diana's cape ripples on each beat of one bar (the glide GET draws it when the two coincide)",
  necklace: "the necklace wakes at her chest: a glint and three rings of light on the beats (the dive GET draws it when the two coincide)",
});
export const DECOR_KINDS = Object.freeze({
  cluster: "stars drawn and never collected (a lock), joined by the unlinked constellation hairline",
  plume: "the crash's dust plume far ahead, from sixteenth `from`, with the asteroid half buried at its base; it grows as Diana nears it",
  helper: "the helper's slope of air: after its GET at x the helper drifts down to `to`",
  glint: "a glinting stone at (x, y): a twinkling sparkle until the stone under it breaks",
  asteroid: "the asteroid stone half buried at (x, y) with radius r (II's crater draws one beside every cape GET)",
});

/** The level's scripted moments with their simulation time `at`. */
export function scriptedMoments(def) {
  return (def?.moments ?? []).map((m) => ({ ...m, at: m.k * SIXTEENTH_SIM }));
}

/** A falling star (kind `fall`): where it is relative to its target.
 * Shower stars fall at a constant speed over `lead` seconds and land on the
 * moment; a soft fall (the GET's star, GDD §5) slows to a rest. The streak
 * heads down and to the right (every star goes the signal's way, brief §5).
 * After landing: a ring and the star sheet's burst frames for 0.4 s. */
export const FALL = Object.freeze({ angle: 1.0, distance: 430, lead: 0.55, softLead: 1.0, land: 0.4 });
export function fallAt(t, { soft = false } = {}) {
  const lead = soft ? FALL.softLead : FALL.lead;
  if (t < -lead || t >= FALL.land) return null;
  if (t < 0) {
    const u = (t + lead) / lead,
      e = soft ? easeOut(u) : u,
      d = (1 - e) * FALL.distance;
    return { phase: "fall", dx: -Math.cos(FALL.angle) * d, dy: -Math.sin(FALL.angle) * d, alpha: clamp01(u / 0.25), heading: FALL.angle };
  }
  const u = t / FALL.land;
  return { phase: "land", dx: 0, dy: 0, ring: 6 + easeOut(u) * 22, ringAlpha: 0.6 * (1 - u), burst: 4 + Math.min(3, Math.floor(u * 4)) };
}

/** The brightest star's flash (kind `flash`): paper over the sky, 120 ms
 * (a gentler 400 ms fade under reduced motion; brief §4.5 I, bar 15). */
export function flashAt(t, reduced = false) {
  if (t < 0) return 0;
  return reduced ? Math.max(0, 0.2 * (1 - t / 0.4)) : Math.max(0, 0.32 * (1 - t / 0.12));
}

/** The asteroid between the flash and the crash: 0 where the brightest
 * star was, 1 at the plume's base exactly on the crash. It leaves slowly
 * and speeds up as it falls. `span` is the flash-to-crash time. null
 * outside the fall. */
export function asteroidAt(t, span) {
  const start = Math.min(0.1, span * 0.1);
  if (t < start || t > span) return null;
  const u = (t - start) / (span - start);
  return { u, e: 0.25 * u + 0.75 * u * u, alpha: clamp01(0.4 + u / 0.1) };
}

/** The dust plume after the crash (decor `plume`): it rises over 1.6 s and
 * stays, billowing slowly; the impact's flash on the horizon lasts 0.5 s. */
export function plumeAt(t, reduced = false) {
  if (t < 0) return null;
  return { rise: reduced ? clamp01(t / 0.4) : easeOut(clamp01(t / 1.6)), impact: t < 0.5 ? 1 - t / 0.5 : 0, billow: reduced ? 0 : t };
}

/** Where a far object (the plume, d world px ahead of Diana) is drawn: its
 * screen x approaches hers from the right as she nears it, never leaving
 * the view, and it grows (a cheap perspective; it is far beyond the
 * course). `near` is Diana's screen fraction. */
export function farPlace(d, W, near = 0.23) {
  const k = 1500 / (Math.max(0, d) + 1500);
  return { x: W * near + W * 0.55 * (1 - k), scale: 0.35 + 0.65 * k };
}

/** II's GET (RESEARCH_PROGRESSION 2.1): the asteroid opens its eye, a
 * small blue world shows in its pupil (Earth: the only colour), a beat
 * passes, and a light leaves the pupil for Diana; the cape settles as it
 * arrives, and the eye closes. `beat` is the level's beat in seconds (at
 * most 0.64 s is waited). Everything ends within EYE_SECONDS (≤ 1.5 s), so
 * no required input can fall inside it (the GET's bar is clear). */
export function eyeTimes(beat) {
  const open = 0.25,
    light = open + Math.min(beat, 0.64),
    cape = light + 0.18,
    close = cape + 0.1;
  return { open, light, cape, close, end: close + 0.3 };
}
export function eyeSeconds(beat) {
  return eyeTimes(beat).end;
}
export function eyeAt(t, beat) {
  const T = eyeTimes(beat);
  if (t < 0) return { open: 0, earth: 0, light: null, cape: 0, done: false };
  const open = t < T.close ? smooth(clamp01(t / T.open)) : 1 - smooth(clamp01((t - T.close) / (T.end - T.close)));
  const earth = open * smooth(clamp01((t - 0.12) / 0.2));
  const light = t >= T.light && t < T.cape ? (t - T.light) / (T.cape - T.light) : null;
  return { open, earth, light, cape: clamp01((t - T.cape) / 0.4), done: t >= T.end };
}

/** The helper riding a wind column ahead of Diana (VI's hearth breeze):
 * up the column's middle for 1 s, then out of its top and down to the
 * right, fading; 1.6 s in all. Offsets in px from the column's foot. */
export function rideAt(t, height) {
  if (t < 0 || t >= 1.6) return null;
  if (t < 1) {
    const e = smooth(t);
    return { dx: Math.sin(t * 9) * 4, dy: -e * height, alpha: clamp01(t / 0.25), angle: -Math.PI / 2 };
  }
  const u = (t - 1) / 0.6;
  return { dx: easeOut(u) * 150, dy: -height + u * u * 60, alpha: 1 - u, angle: 0.3 };
}

/** III after the GET with a helper decor: it loops once round Diana (as
 * helperAfter), then drifts down its slope of air ahead of her to `to`,
 * well ahead of her (she runs about as fast), and fades there. Returns
 * { loop: true, ... } relative to Diana, or { loop: false, u } along the
 * slope. */
export function slopeAt(t, bar) {
  const loop = 0.5,
    drift = Math.max(0.4, (bar - loop) * 0.6);
  if (t < loop) return { loop: true, ...helperAfter(t, bar) };
  const u = clamp01((t - loop) / drift);
  return { loop: false, u: smooth(u), alpha: t < loop + drift ? 1 : clamp01(1 - (t - loop - drift) / Math.max(0.2, bar - loop - drift)) };
}
