import { createLevel, levelDef, sectionAt, movementAt } from "./level.mjs";
/** Pure deterministic runner simulation. Units: world px, seconds, px/s and
 * px/s². player.y is the feet position and y grows downward. Nothing here
 * touches the DOM, images, audio, storage or wall-clock time. */
export const RULES = Object.freeze({
  gravity: 1500,
  jump: 570, // about 108 px of rise when held
  doubleJump: 525, // about +92 px on top of the first jump
  tapCap: 280, // released jumps are capped to this upward speed (~26 px)
  superJump: 720, // jump during flight: about 173 px of rise, once per flight
  // 'landing' (default): one flight per airtime; refilled by stable ground, a
  // beacon or a completed constellation. 'cooldown': the archived 6 s timer.
  capeRule: "landing",
  // 'breath' (RESEARCH_PROGRESSION 3): the cape holds one flight and breathes
  // it back over capeBreathBeats of running on stable stone (one bar, 605.6
  // px, in every level); a loose star adds starCharge; a constellation, a
  // beacon, a Great Star and a respawn fill it at once. A flight that the
  // wind cuts short within windRefund s (real; x clock) gets its charge back.
  capeBreathBeats: 4,
  starCharge: 1 / 8,
  windRefund: 0.15,
  dashCooldown: 6,
  dashDuration: 0.5,
  // Added to the 270 px/s run while the cape is open. 227.1 px/s x 0.5 s =
  // 113.55 px = 3 x 37.85 px, i.e. three sixteenths of run at 107 BPM, so a
  // full flight keeps Diana on the score's x lattice (RESEARCH_MUSIC 5.2;
  // was 230, 1.3% faster, which drifted 1.6 ms of grid per flight).
  dashSpeed: 227.1,
  glideGravity: 350,
  glideFall: 140,
  updraftLift: 700, // net upward acceleration inside a solar-wind column
  updraftRise: 240, // rise cap inside a column
  updraftGlideBoost: 1.4, // holding the cape catches 40% more wind
  diveSpeed: 700,
  smashCarry: 500, // Diana keeps falling at least this fast through smashed stone
  crumbleAfter: 0.65,
  cascadeShake: 0.35, // every cascade tile shakes this long before it drops
  constellationGap: 1.2, // longest pause between two stars of one chain
  playerWidth: 32,
  playerHeight: 58,
  coyote: 0.12,
  jumpBuffer: 0.14,
  // Ledge forgiveness: arriving up to 30 px below a top surface right at its
  // lip (the first 40 px) while falling or barely rising pops Diana onto it,
  // so a near miss never reads as sinking through the drawn island edge.
  // One step-up rule (RESEARCH_LEVELS F2), hidden margin like Canabalt's
  // building edges: launched (a jump or flight, never a walk-off), not
  // diving, not in the wind, the collider over the top by stepUpOverlap px,
  // the feet below the top by at most a depth, and a predicted remaining rise
  // (vy^2 / 2g) smaller than that depth, so she provably cannot clear it on
  // her own. Depth: lipDepth within the first lipReach px of the lip,
  // stepUpDepth on the span, flightStepDepth during a flight (Celeste's
  // dash nudge is 6 px on an 11 px body; 24 px is 41% of Diana's 58). Never
  // onto a collapsing top, within smashGrace after a smash, or onto a
  // platform authored `noPop`. It replaces the old single-substep lip catch.
  // RESEARCH_PROGRESSION 7, no visible lip sink: the drawn toe reaches about
  // 30 px under the feet's line at an apex, so 30 px on the span and at the
  // lip (was 20 / 25) and 4 px of overlap (was 10) step her up before the
  // art can be seen sinking through a top she visibly reached.
  lipDepth: 30,
  lipReach: 40,
  stepUpDepth: 30,
  flightStepDepth: 24,
  stepUpOverlap: 4,
  smashGrace: 0.1,
  // A dive through a lid lowers the fall allowance (and the camera) by this
  // much: a well may be deeper than the 265 px a walk-off survives, so only
  // the dive reaches its floor (L3's broken well).
  smashDrop: 120,
  // Death line sits a fixed distance below the camera anchor (the last
  // grounded y). With the vertical camera in geometry.mjs this is about 60 px
  // below the visible bottom, instead of the old fixed y=850 far off-screen.
  fallLimit: 265,
  // Respawn budget: shards fly to the beacon, iris closes, sprout pops.
  // 0.45 + 0.25 + 0.4 = 1.1 s, inside the 1.2 s "back in control" target.
  respawnShatter: 0.45,
  respawnIris: 0.25,
  respawnPop: 0.4,
});
const CRACKED = new Set(["crumble", "lid", "cascade"]);
/** One beat of simulation time (the simulation always runs at 107 BPM). */
const BEAT_SIM = 60 / 107;
const SIXTEENTH_SIM = BEAT_SIM / 4;
const DURATIONS = {
  start: 1 / 3,
  jump: 5 / 12,
  softLanding: 10 / 12,
  hardLanding: 13 / 12,
  dive: 0.5,
  dash: 23 / 24,
  stop: 0.75,
};
/** The movement constants in force (per level: see level.mjs physics). */
export function physicsOf(s) {
  return s.physics ?? RULES;
}
export function isCracked(platform) {
  return CRACKED.has(platform?.type);
}
/** Level n's movement constants in simulation units. Each level runs the
 * simulation at clock = BPM / 107 of real time, so human-time forgiveness
 * (coyote, buffer, respawn, the cascade's shake telegraph) is multiplied by
 * the clock to stay constant in real seconds (RESEARCH_LEVELS 3, 7). */
export function levelPhysics(def) {
  const c = def.clock;
  return Object.freeze({
    ...RULES,
    coyote: RULES.coyote * c,
    jumpBuffer: RULES.jumpBuffer * c,
    respawnShatter: RULES.respawnShatter * c,
    respawnIris: RULES.respawnIris * c,
    respawnPop: RULES.respawnPop * c,
    cascadeShake: RULES.cascadeShake * c,
    windRefund: RULES.windRefund * c,
    ...def.physics,
  });
}
export function createGame(seed = 2021, options = {}) {
  // options.def: a level definition object (tests and authoring tools).
  const def = options.def ?? levelDef(options.level);
  const LEVEL = def.level;
  const world = createLevel(def);
  const capeRule = options.capeRule ?? def.capeRule ?? RULES.capeRule;
  const verbs = ownedVerbs(def);
  const physics = levelPhysics(def);
  // Refill stars (RESEARCH_REFILLS 1): cape stars and leaf stars, kept apart
  // from the stars (they are tools: never counted, never a constellation).
  const refillStars = (def.refills ?? []).map((q) => ({ id: q.id, kind: q.kind, x: q.x, y: q.y, required: !!q.required, taken: false }));
  return {
    seed,
    level: def.id,
    def,
    clock: def.clock,
    physics,
    capeRule,
    status: "ready",
    time: 0,
    distance: 0,
    stars: 0,
    highStars: 0,
    score: 0,
    speed: LEVEL.speed,
    capeCharges: 1,
    // Breath charge, 0-1 (capeRule 'breath'); full whenever the cape is owned
    // at the start (a cape GET empties it, then she breathes it in).
    capeCharge: 1,
    // The verbs owned right now: the level's own, plus any GET passed.
    verbs,
    gotten: [],
    ground: null, // the platform Diana stands on (breath needs stable stone)
    lastDashAt: -9,
    dashCooldown: 0,
    dashRemaining: 0,
    superUsed: false,
    launched: false, // a jump or flight began this airtime (lip catch)
    coyote: physics.coyote,
    jumpBuffer: 0,
    jumpBufferReleased: false,
    airTime: 0,
    fallTime: 0,
    anchorY: LEVEL.startY,
    lastStable: { x: LEVEL.startX, y: LEVEL.startY },
    event: "",
    eventSerial: 0,
    events: [],
    deaths: 0,
    fallsHere: 0,
    checkpoint: null,
    checkpointsReached: [],
    ringsCrossed: 0, // legacy QA name: completed constellations
    constellationsDone: 0,
    refills: 0,
    smashes: 0,
    lipCatches: 0,
    flights: 0,
    superJumps: 0,
    greatPending: [],
    greatBanked: [],
    respawn: null,
    queuedJump: false,
    queuedJumpReleased: false,
    bufferedDouble: false, // a press waiting for a predicted touch-down (jump())
    // A cape press that could not fly yet (empty bar, or inside the wind),
    // kept this long (sim s) for the moment it can (a refill, leaving a column).
    capeBuffer: 0,
    refillStars,
    starNetUsed: false,
    assist: {
      endlessCape: !!options.endlessCape,
      starNet: !!options.starNet,
    },
    section: sectionAt(LEVEL.startX, def),
    movement: movementAt(LEVEL.startX, def),
    animation: { name: "idle", age: 0 },
    player: {
      x: LEVEL.startX,
      y: LEVEL.startY,
      vy: 0,
      grounded: true,
      jumps: 0,
      diving: false,
      gliding: false,
      inWind: false,
    },
    ...world,
  };
}
function event(s, name, data = {}) {
  s.event = name;
  s.eventSerial++;
  s.events.push({
    name,
    serial: s.eventSerial,
    time: s.time,
    x: s.player.x,
    y: s.player.y,
    ...data,
  });
  // The renderer drains by serial; old entries are irrelevant to simulation.
  if (s.events.length > 48) s.events.splice(0, s.events.length - 48);
}
function animate(s, name) {
  s.animation = { name, age: 0 };
}
function markPrompts(s, action) {
  for (const q of s.prompts)
    if (
      !q.done &&
      q.action === action &&
      s.player.x >= q.from &&
      s.player.x <= q.to
    )
      q.done = true;
}
/** The verbs a level starts with (RESEARCH_PROGRESSION 2.5). Older level
 * definitions name only cape, dive and glide: the double jump is then owned,
 * and the super jump comes with the cape, as before. */
export function ownedVerbs(def) {
  const v = def.verbs ?? {};
  return { double: v.double ?? true, cape: !!v.cape, glide: !!v.glide, dive: !!v.dive, super: v.super ?? !!v.cape };
}
const maxJumps = (s) => (s.verbs.double ? 2 : 1);
/** A refill star is lit exactly while its resource is spent (RESEARCH_REFILLS
 * 1.1): a cape star while the cape is owned and the bar is not full (never
 * in Endless cape), a leaf star while the double jump is owned and Diana is
 * in the air with no air jump left. A dormant star is never consumed. */
export function refillLit(s, q) {
  if (q.taken || s.status !== "running") return false;
  if (q.kind === "cape") return !!s.verbs.cape && !s.assist.endlessCape && !capeReady(s);
  const p = s.player;
  return !!s.verbs.double && !p.grounded && s.coyote <= 0 && p.jumps >= maxJumps(s);
}
/** Where a relic (an ability's GET) is drawn: its own y, or chest height
 * over the run line's stone at its x. */
export function relicY(def, g) {
  if (g.y != null) return g.y;
  const q = def.main.filter(([, x, , w]) => g.x >= x && g.x <= x + w).sort((a, b) => a[2] - b[2])[0];
  return (q ? q[2] : def.level.startY) - 40;
}
export function capeReady(s) {
  if (s.assist.endlessCape) return true;
  if (s.capeRule === "breath") return s.capeCharge >= 1 - 1e-9;
  return s.capeRule === "cooldown" ? s.dashCooldown <= 0 : s.capeCharges > 0;
}
/** Add breath (0-1) to the cape; a refill event only when it becomes full. */
function breathe(s, amount, source) {
  if (s.capeRule !== "breath" || !s.verbs.cape || s.capeCharge >= 1) return;
  s.capeCharge = Math.min(1, s.capeCharge + amount);
  if (s.capeCharge >= 1 - 1e-9) {
    s.capeCharge = 1;
    s.refills++;
    event(s, "refill", { source });
  }
}
function refillCape(s, source) {
  const was = capeReady(s);
  s.capeCharges = 1;
  s.capeCharge = 1;
  s.dashCooldown = 0;
  if (!was) {
    s.refills++;
    event(s, "refill", { source });
  }
}
export function start(s) {
  if (s.status === "ready") {
    s.status = "running";
    animate(s, "start");
    event(s, "wake");
  }
  return s;
}
/**
 * Replace the world with level `level` in place (the automatic transition's
 * swap), keeping the assist options. createGame() would restart the event
 * serial at 0, but the renderer drains events by serial and remembers the
 * last one it voiced: after level I's ~100 events it would silently drop
 * level II's first ~100, the wake (which starts the song) among them. So the
 * serial stays monotonic across the swap, as in restart().
 */
export function enterLevel(s, level) {
  const assist = { ...s.assist },
    serial = s.eventSerial;
  Object.assign(s, createGame(s.seed, { level, ...assist }));
  s.eventSerial = serial;
  return s;
}
export function restart(s) {
  const assist = { ...s.assist },
    serial = s.eventSerial;
  Object.assign(s, createGame(s.seed, { capeRule: s.capeRule, def: s.def, ...assist }));
  // Event serials stay monotonic so a renderer never mistakes new events for old.
  s.eventSerial = serial;
  return start(s);
}
/** Rebuild the world at the latest beacon. Great Stars that were already
 * banked survive (a fall must never take a banked reward away); stars,
 * constellations and Great Stars that were still pending roll back. */
function restoreCheckpoint(s) {
  const keep = {
    checkpoint: s.checkpoint,
    deaths: s.deaths,
    fallsHere: s.fallsHere,
    greatBanked: [...s.greatBanked],
    assist: { ...s.assist },
    starNetUsed: s.starNetUsed,
    eventSerial: s.eventSerial,
  };
  Object.assign(
    s,
    createGame(s.seed, { capeRule: s.capeRule, def: s.def, ...keep.assist }),
  );
  Object.assign(s, keep);
  s.status = "running";
  const cp = s.checkpoint;
  // A respawn owns what the beacon had: a GET passed after it is taken again.
  if (cp?.verbs) ((s.verbs = { ...cp.verbs }), (s.gotten = [...cp.gotten]));
  if (cp) {
    s.checkpointsReached = [...cp.reached];
    s.ringsCrossed = cp.ringsCrossed;
    s.constellationsDone = cp.ringsCrossed;
    s.player.x = cp.x;
    s.player.y = cp.y;
    s.anchorY = cp.y;
    s.lastStable = { x: cp.x, y: cp.y };
    s.stars = cp.stars;
    s.highStars = cp.highStars;
    s.time = cp.time;
    s.distance = (cp.x - s.def.level.startX) / 10;
    for (const q of s.pickups)
      q.collected = cp.collected.includes(q.id) || keep.greatBanked.includes(q.id);
    // Refill stars before the beacon stay taken; those after it return.
    for (const q of s.refillStars) q.taken = (cp.refillsTaken ?? []).includes(q.id);
    for (const c of s.chains) {
      const saved = cp.chains[c.id];
      if (saved) Object.assign(c, saved);
    }
    for (const q of s.prompts) q.done = q.to < cp.x;
  } else {
    for (const q of s.pickups) q.collected = keep.greatBanked.includes(q.id);
  }
  s.section = sectionAt(s.player.x, s.def);
  s.movement = movementAt(s.player.x, s.def);
  animate(s, "start");
}
export function retry(s) {
  // Manual retry (R / pause menu / QA) is immediate; the automatic fall
  // sequence below adds the short shatter / iris / pop presentation.
  restoreCheckpoint(s);
  s.respawn = null;
  event(s, "respawn", { source: "retry" });
  return s;
}
export function togglePause(s) {
  if (s.status === "running") s.status = "paused";
  else if (s.status === "paused") s.status = "running";
  return s.status;
}
export function setAssist(s, name, value) {
  if (!(name in s.assist)) return false;
  s.assist[name] = !!value;
  if (name === "endlessCape" && value) refillCape(s, "assist");
  return true;
}
export function jump(s) {
  // Jump pressed while falling apart is remembered and spent the moment
  // control returns, so a hurried retry press is never swallowed (released
  // before then, it is spent as a tap, like any buffered tap).
  if (s.status === "dead" || s.status === "respawning") {
    s.queuedJump = true;
    s.queuedJumpReleased = false;
    return false;
  }
  if (s.status !== "running") return false;
  const p = s.player;
  // Before the super jump is owned, a jump during a flight ends the flight and
  // is the double jump (if one is left): leap() closes the cape.
  if (s.verbs.super && s.dashRemaining > 0 && !s.superUsed && !p.grounded) {
    // M6: flight + jump = super jump, once per flight, whatever jumps remain.
    s.superUsed = true;
    s.dashRemaining = 0;
    p.vy = -s.physics.superJump;
    p.jumps = 2;
    p.grounded = false;
    p.diving = false;
    s.coyote = 0;
    s.superJumps++;
    s.launched = true;
    animate(s, "jump");
    markPrompts(s, "super-jump");
    event(s, "super-jump");
    return true;
  }
  // (Without the double jump there is no air jump: a press after coyote only
  // waits in the buffer for the next touch-down.)
  if (p.jumps >= maxJumps(s) && s.coyote <= 0) {
    s.jumpBuffer = s.physics.jumpBuffer;
    s.jumpBufferReleased = false;
    return false;
  }
  // A press just before touch-down is a buffered ground jump, not the double
  // jump (MOVEMENT_AUDIT A3/B10): falling with the double still in hand, she
  // would land within the buffer (predicted with tick()'s own rules). On the
  // land-and-go cells (the cascade, the ridge stone) an early press used to
  // spend the double jump a few px above the stone and break the bounce; the
  // ground jump is also the stronger of the two. If something intervenes (the
  // cape opens, a held glide stretches the fall) and the buffer runs out in
  // the air, the double jump fires then, so the press is never lost.
  if (!p.grounded && s.coyote <= 0 && touchdownTicks(s, s.physics.jumpBuffer) < Infinity) {
    s.jumpBuffer = s.physics.jumpBuffer;
    s.jumpBufferReleased = false;
    s.bufferedDouble = true;
    return false;
  }
  const bufferedTap = s.jumpBuffer > 0 && s.jumpBufferReleased;
  leap(s, p.grounded || s.coyote > 0, bufferedTap);
  return true;
}
/** The jump itself: a ground (or coyote) jump when `first`, else the double. */
function leap(s, first, bufferedTap) {
  const p = s.player;
  p.vy = -(first ? s.physics.jump : s.physics.doubleJump);
  // A tap released before landing must keep its short arc when consumed later;
  // otherwise input forgiveness would turn that tap into an unwanted full jump.
  if (bufferedTap) p.vy = Math.max(-s.physics.tapCap, p.vy);
  p.jumps = first ? 1 : 2;
  p.grounded = false;
  p.diving = false;
  s.launched = true;
  s.coyote = 0;
  s.jumpBuffer = 0;
  s.jumpBufferReleased = false;
  s.bufferedDouble = false;
  s.dashRemaining = 0;
  animate(s, "jump");
  // Apex hang only while the button is still down (a buffered tap is not).
  s.jumpHeld = !bufferedTap;
  markPrompts(s, first ? "jump" : "double-jump");
  event(s, first ? "jump" : "double-jump");
}
/** Ticks until Diana's next touch-down if nothing else is pressed, or
 * Infinity if it is not within `limit` s of simulation: tick()'s fall, glide,
 * apex hang, fall cap, collapses and one-way landing test, without step-ups
 * (a step-up is never predicted, so near a lip the double jump still fires).
 * Wind, a flight or a rise means no touch-down is predicted. */
function touchdownTicks(s, limit) {
  const p = s.player,
    ph = s.physics,
    half = RULES.playerWidth / 2;
  if (p.grounded || p.vy < 0 || s.dashRemaining > 0) return Infinity;
  let x = p.x,
    y = p.y,
    vy = p.vy,
    t = s.time;
  // Landing on tick k fires the buffer while k ticks have not used it up.
  for (let k = 1; k * TICK < limit - 1e-6; k++) {
    t += TICK;
    x += s.speed * TICK;
    if (!p.diving && windAt(s, x, y)) return Infinity;
    const glide = p.gliding && vy > 0;
    const hang = ph.apexHang && s.jumpHeld && Math.abs(vy) < ph.apexHang.below ? ph.apexHang.factor : 1;
    vy += (glide ? ph.glideGravity : ph.gravity * hang) * TICK;
    if (glide) vy = Math.min(ph.glideFall, vy);
    if (ph.maxFall && !p.diving) vy = Math.min(ph.maxFall, vy);
    const from = y;
    y += vy * TICK;
    for (const q of s.platforms) {
      if (q.collapsed || (p.diving && isCracked(q))) continue;
      if (q.crumbleAfter && q.triggeredAt !== null && t - q.triggeredAt >= q.crumbleAfter) continue;
      if (q.collapseAt != null && t >= q.collapseAt) continue;
      if (x + half > q.x && x - half < q.x + q.width && from <= q.y + 0.6 && y >= q.y) return k;
    }
  }
  return Infinity;
}
export function releaseJump(s) {
  // A release while falling apart turns the queued press into a tap; one
  // while paused still counts (the key may come up behind the pause card).
  if (s.status === "dead" || s.status === "respawning") {
    if (s.queuedJump) s.queuedJumpReleased = true;
    return;
  }
  if (s.status !== "running" && s.status !== "paused") return;
  s.jumpHeld = false;
  if (s.jumpBuffer > 0) s.jumpBufferReleased = true;
  if (s.player.vy < -s.physics.tapCap) s.player.vy = -s.physics.tapCap;
}
export function dash(s) {
  // A level that has not given Diana her cape yet ignores the button.
  if (!s.verbs.cape) return false;
  if (s.status !== "running" || s.player.grounded) return false;
  // Inside solar wind the cape does not dash level (a level flight there can
  // run under the shore it is meant to reach); holding it glides upward.
  // A press that cannot fly yet (an empty bar, or inside a column) waits
  // jumpBuffer (0.14 s real) for the moment it can: a refill in the air, a
  // lit cape star, the column's edge (the critic's IV and VI presses).
  if (!capeReady(s) || updraftAt(s)) {
    s.capeBuffer = s.physics.jumpBuffer;
    return false;
  }
  s.capeBuffer = 0;
  if (!s.assist.endlessCape) {
    s.capeCharges = 0;
    s.capeCharge = 0;
    if (s.capeRule === "cooldown") s.dashCooldown = s.physics.dashCooldown;
  }
  s.lastDashAt = s.time;
  // The cape is a new decision: a jump pressed just before it was waiting for
  // a touch-down the flight now postpones, so it is dropped (not fired midair).
  if (s.bufferedDouble) ((s.bufferedDouble = false), (s.jumpBuffer = 0));
  s.dashRemaining = s.physics.dashDuration;
  s.superUsed = false;
  s.launched = true;
  s.flights++;
  s.player.vy = 0;
  s.player.y -= 0.5;
  s.player.diving = false;
  animate(s, "dash");
  markPrompts(s, "dash");
  event(s, "dash");
  return true;
}
export function dive(s) {
  if (!s.verbs.dive || s.status !== "running") return false;
  const p = s.player;
  if (p.grounded) {
    // Only drawn cracks are smashable. Ordinary ground ignores a grounded dive.
    const q = supportOf(s);
    if (!q || !isCracked(q)) return false;
    smash(s, q);
    p.grounded = false;
    p.y += 1;
    p.vy = Math.max(s.physics.smashCarry, p.vy);
  } else p.vy = Math.max(s.physics.diveSpeed, p.vy);
  p.diving = true;
  p.gliding = false;
  s.dashRemaining = 0;
  // A dive may smash through the stone that press was waiting for; the dive wins.
  if (s.bufferedDouble) ((s.bufferedDouble = false), (s.jumpBuffer = 0));
  animate(s, "dive");
  markPrompts(s, "dive");
  event(s, "dive");
  return true;
}
function supportOf(s) {
  const p = s.player;
  return s.platforms.find(
    (q) =>
      !q.collapsed &&
      Math.abs(q.y - p.y) < 1 &&
      p.x + RULES.playerWidth / 2 > q.x &&
      p.x - RULES.playerWidth / 2 < q.x + q.width,
  );
}
function smash(s, q) {
  if (q.type === "lid") s.anchorY = Math.max(s.anchorY, q.y + RULES.smashDrop);
  q.collapsed = true;
  q.smashedAt = s.time;
  s.lastSmashAt = s.time;
  s.smashes++;
  event(s, "smash", { platform: q.id, px: q.x, py: q.y, width: q.width });
}
function advanceAnimation(s, dt) {
  s.animation.age += dt;
  const a = s.animation;
  if (a.name === "stop" && a.age >= DURATIONS.stop) animate(s, "idle");
  else if (a.name === "start" && a.age >= DURATIONS.start)
    animate(s, s.player.grounded ? "run" : "air");
  else if (
    ["softLanding", "hardLanding"].includes(a.name) &&
    a.age >= DURATIONS[a.name]
  )
    animate(s, s.player.grounded ? "run" : "air");
  else if (
    ["jump", "dash", "dive"].includes(a.name) &&
    a.age >= DURATIONS[a.name]
  )
    animate(s, s.player.grounded ? "run" : "air");
}
/** The beat cascade: on first contact the wave is anchored to tile 0, which
 * drops when Diana's nominal position (run speed, no flight in the cascade)
 * is `lead` px past its start; every later tile drops one `interval` (a beat)
 * after the previous one. The wave is faster than Diana, so it closes in on
 * her heels and finally forces hops right at the tile edges. */
function triggerCascade(s, group) {
  const first = s.platforms.find((q) => q.id === group.tiles[0]);
  group.t0 = s.time - (s.player.x - first.x) / s.def.level.speed + group.lead / s.def.level.speed;
  group.tiles.forEach((id, i) => {
    // A missing tile (null, VII's twist) keeps its beat: the wave rests there.
    const q = id && s.platforms.find((t) => t.id === id);
    if (q) q.collapseAt = group.t0 + i * group.interval;
  });
  event(s, "cascade", { group: group.id });
}
function updraftAt(s) {
  return windAt(s, s.player.x, s.player.y);
}
function windAt(s, x, y) {
  const cy = y - RULES.playerHeight / 2;
  return s.updrafts.find((u) => x >= u.x && x <= u.x + u.width && cy >= u.top && cy <= u.bottom);
}
function landOn(s, q, wasGrounded, hard) {
  const p = s.player;
  s.ground = q;
  if (q.type === "crumble" && q.triggeredAt === null) q.triggeredAt = s.time;
  if (q.cascade) {
    const g = s.cascades.find((c) => c.id === q.cascade);
    if (g && g.t0 === null) triggerCascade(s, g);
  }
  p.y = q.y;
  p.vy = 0;
  p.grounded = true;
  p.jumps = 0;
  p.diving = false;
  p.gliding = false;
  s.capeBuffer = 0; // a touch-down ends the airtime the press was for
  s.coyote = s.physics.coyote;
  s.anchorY = q.y;
  s.fallTime = 0;
  s.launched = false;
  // The hang belongs to the jump that set it: a key still down after a
  // touch-down must not slow the next walk-off (level I's lookout and crown
  // edges drop onto the grid in exactly 2.67/16 and 2/16).
  s.jumpHeld = false;
  if (!wasGrounded) {
    s.dashRemaining = 0; // touching down closes the cape
    animate(s, hard ? "hardLanding" : "softLanding");
    event(s, "land", { platform: q.id, hard });
    if (!isCracked(q)) s.lastStable = { x: p.x, y: q.y };
  }
  // M1: only uncracked stone gives the cape its breath back.
  if (!isCracked(q) && s.capeRule === "landing") refillCape(s, "ground");
  // M7: a Great Star counts once Diana touches any ground after taking it.
  if (s.greatPending.length) bankGreatStars(s);
  s.airTime = 0;
  // A just-early input becomes a new jump at the actual landing frame.
  if (s.jumpBuffer > 0) jump(s);
}
function bankGreatStars(s) {
  for (const id of s.greatPending) {
    if (!s.greatBanked.includes(id)) s.greatBanked.push(id);
    event(s, "great-banked", { id, count: s.greatBanked.length });
  }
  s.greatPending = [];
}
function collectStar(s, q) {
  q.collected = true;
  q.collectedAt = s.time;
  if (q.great) {
    s.greatPending.push(q.id);
    event(s, "great-star", { id: q.id });
    if (s.capeRule === "breath" && s.verbs.cape) breathe(s, 1, "great");
    return;
  }
  s.stars++;
  if (!q.chain) breathe(s, s.physics.starCharge, "star");
  if (q.route === "high") s.highStars++;
  const c = q.chain ? s.chains.find((k) => k.id === q.chain) : null;
  if (c && !c.complete && !c.broken) {
    if (c.got === 0 || s.time - c.lastAt <= s.physics.constellationGap) {
      c.got++;
      c.lastAt = s.time;
      c.links.push(q.id);
      event(s, "chain-note", { chain: c.id, step: c.got - 1, count: c.count });
      if (c.got === c.count) {
        c.complete = true;
        c.completedAt = s.time;
        s.ringsCrossed++;
        s.constellationsDone++;
        event(s, "constellation", { chain: c.id });
        refillCape(s, "constellation");
      }
      return;
    }
    breakChain(s, c);
  }
  event(s, "star", { id: q.id });
}
function breakChain(s, c) {
  // A miss only fades the lines. Remaining stars still count as stars.
  c.broken = true;
  c.brokenAt = s.time;
  if (c.got > 0) event(s, "chain-fade", { chain: c.id });
}
function die(s) {
  s.status = "dead";
  s.deaths++;
  s.fallsHere++;
  s.respawn = {
    t: 0,
    fromX: s.player.x,
    fromY: s.player.y,
    toX: s.checkpoint ? s.checkpoint.x : s.def.level.startX,
    toY: s.checkpoint ? s.checkpoint.y : s.def.level.startY,
    net: false,
  };
  if (s.assist.starNet && !s.starNetUsed && s.lastStable) {
    s.respawn.net = true;
    s.respawn.toX = s.lastStable.x;
    s.respawn.toY = s.lastStable.y;
  }
  s.greatPending = [];
  event(s, "death", { fallsHere: s.fallsHere });
}
/** Star net: return to the last stable landing without losing progress
 * before it. Everything ahead of that point is restored so no shelf, tile,
 * star or constellation that the next attempt needs stays consumed. */
function catchInStarNet(s) {
  const at = s.lastStable;
  s.starNetUsed = true;
  const fresh = createLevel(s.def);
  const freshById = new Map(fresh.platforms.map((q) => [q.id, q]));
  for (const q of s.platforms)
    if (q.x + q.width > at.x) Object.assign(q, freshById.get(q.id));
  for (const g of s.cascades) {
    const first = s.platforms.find((q) => q.id === g.tiles[0]);
    if (first.x + first.width > at.x) g.t0 = null;
  }
  for (const q of s.refillStars) if (q.x > at.x) q.taken = false;
  for (const c of s.chains) {
    const stars = s.pickups.filter((q) => q.chain === c.id);
    if (Math.min(...stars.map((q) => q.x)) <= at.x) continue;
    for (const q of stars)
      if (q.collected) {
        q.collected = false;
        s.stars--;
        if (q.route === "high") s.highStars--;
      }
    if (c.complete) {
      s.ringsCrossed--;
      s.constellationsDone--;
    }
    Object.assign(c, { got: 0, lastAt: -1, broken: false, complete: false, links: [] });
  }
  for (const q of s.pickups)
    if (q.great && q.collected && !s.greatBanked.includes(q.id)) q.collected = false;
  for (const q of s.prompts) if (q.from > at.x) q.done = false;
  Object.assign(s.player, {
    x: at.x,
    y: at.y,
    vy: 0,
    grounded: true,
    jumps: 0,
    diving: false,
    gliding: false,
  });
  s.anchorY = at.y;
  s.dashRemaining = 0;
  refillCape(s, "net");
  s.status = "running";
  animate(s, "start");
}
function tickRespawn(s, dt) {
  const r = s.respawn;
  r.t += dt;
  const out = s.physics.respawnShatter + s.physics.respawnIris;
  if (s.status === "dead" && r.t >= out) {
    const queued = s.queuedJump,
      released = s.queuedJumpReleased;
    if (r.net) catchInStarNet(s);
    else restoreCheckpoint(s);
    s.queuedJump = queued;
    s.queuedJumpReleased = released;
    s.status = "respawning";
    s.respawn = { ...r, t: out };
    event(s, "respawn", { source: r.net ? "net" : "beacon" });
  } else if (s.status === "respawning") {
    advanceAnimation(s, dt);
    if (r.t >= out + s.physics.respawnPop) {
      s.status = "running";
      s.respawn = null;
      if (s.queuedJump) {
        jump(s);
        if (s.queuedJumpReleased) releaseJump(s);
      }
      s.queuedJump = false;
      s.queuedJumpReleased = false;
    }
  }
}
function tick(s, dt, controls) {
  if (s.status === "won") {
    advanceAnimation(s, dt);
    return;
  }
  if (s.status === "dead" || s.status === "respawning") {
    tickRespawn(s, dt);
    return;
  }
  if (s.status !== "running") return;
  advanceAnimation(s, dt);
  const p = s.player;
  s.time += dt;
  s.dashCooldown = Math.max(0, s.dashCooldown - dt);
  // The cape is open for exactly dashDuration of simulation time whatever the
  // substep: the part of this substep it was still open carries the flight
  // speed and the level hold. (Decrementing first and testing afterwards used
  // to drop the last substep, so a flight lasted 0.5 s - dt and its shift
  // changed with the sampling rate. The score needs a full flight to move
  // Diana exactly 0.5 s x 227.1 px/s = 113.55 px = three 107 BPM sixteenths
  // of run, at 30, 60, 120 and 240 Hz alike.) Float residue below 1 ns is
  // treated as closed so it never adds a phantom hold substep.
  const flightDt = s.dashRemaining > 1e-9 ? Math.min(dt, s.dashRemaining) : 0;
  s.dashRemaining = s.dashRemaining - dt > 1e-9 ? s.dashRemaining - dt : 0;
  s.jumpBuffer = Math.max(0, s.jumpBuffer - dt);
  s.capeBuffer = Math.max(0, s.capeBuffer - dt);
  // The predicted touch-down did not come (see jump()): the double jump now.
  if (s.bufferedDouble && s.jumpBuffer <= 0) {
    s.bufferedDouble = false;
    if (!p.grounded && p.jumps < maxJumps(s)) leap(s, false, s.jumpBufferReleased);
  }
  const previousY = p.y,
    wasGrounded = p.grounded;
  const advance = s.speed * dt + s.physics.dashSpeed * flightDt;
  p.x += advance;
  s.distance = (p.x - s.def.level.startX) / 10;
  // Entering the wind ends a flight: the column takes over and lifts.
  if (s.dashRemaining > 0 && !p.grounded && !p.diving && updraftAt(s)) {
    s.dashRemaining = 0;
    event(s, "wind-catch");
    // The refund: D pressed just before the column (within windRefund) did
    // not mean to spend the flight the wind has now cancelled.
    if (s.capeRule === "breath" && s.time - s.lastDashAt <= s.physics.windRefund + 1e-9 && !s.assist.endlessCape) {
      s.capeCharge = 1;
      s.capeCharges = 1;
      event(s, "wind-refund");
    }
  }
  const wind = !p.grounded && !p.diving && s.dashRemaining <= 0 && updraftAt(s);
  p.inWind = !!wind;
  p.gliding = !!controls.glide && s.verbs.glide && !p.diving && !p.grounded && s.dashRemaining <= 0;
  if (p.gliding && wind) markPrompts(s, "glide");
  if (flightDt > 0) p.vy = 0;
  else if (wind) {
    // M5: inside a column gravity becomes lift. A fast upward jump keeps its
    // ordinary deceleration until it slows to the cap, so entering a column
    // never yanks Diana down.
    const boost = p.gliding ? s.physics.updraftGlideBoost : 1,
      cap = s.physics.updraftRise * boost;
    if (p.vy < -cap) p.vy = Math.min(-cap, p.vy + s.physics.gravity * dt);
    else p.vy = Math.max(-cap, p.vy - s.physics.updraftLift * boost * dt);
  } else {
    const glide = p.gliding && p.vy > 0;
    // L1's float: half gravity near the apex while the jump is held
    // (Celeste's half-gravity threshold), and a lower terminal speed.
    const hang = s.physics.apexHang && s.jumpHeld && Math.abs(p.vy) < s.physics.apexHang.below ? s.physics.apexHang.factor : 1;
    p.vy += (glide ? s.physics.glideGravity : s.physics.gravity * hang) * dt;
    if (glide) p.vy = Math.min(s.physics.glideFall, p.vy);
    if (s.physics.maxFall && !p.diving) p.vy = Math.min(s.physics.maxFall, p.vy);
  }
  p.y += p.vy * dt;
  p.grounded = false;
  // Collapses first, for every platform: the collision loop below stops at
  // the surface Diana lands on, so a shelf or cascade tile sorted after it
  // used to wait until she was airborne again (a tile under a lower-numbered
  // y could drop seconds late, off its beat).
  for (const q of s.platforms) {
    if (q.collapsed) continue;
    if (q.crumbleAfter && q.triggeredAt !== null && s.time - q.triggeredAt >= q.crumbleAfter) {
      q.collapsed = true;
      q.collapsedAt = s.time;
    } else if (q.collapseAt != null && s.time >= q.collapseAt) {
      q.collapsed = true;
      q.collapsedAt = s.time;
      if (q.cascade) event(s, "tile-drop", { platform: q.id }); // the beat
    }
  }
  // Platforms are sorted top-to-bottom: falling can land on a high route,
  // while rising passes through all one-way surfaces.
  for (const q of s.platforms) {
    if (q.collapsed) continue;
    if (
      p.x + RULES.playerWidth / 2 > q.x &&
      p.x - RULES.playerWidth / 2 < q.x + q.width &&
      previousY <= q.y + 0.6 &&
      p.y >= q.y &&
      p.vy >= 0
    ) {
      // M2: a dive through drawn cracks breaks the stone instantly and keeps
      // falling, so a lower platform in the same substep can still catch.
      if (p.diving && isCracked(q)) {
        smash(s, q);
        p.vy = Math.max(s.physics.smashCarry, p.vy);
        continue;
      }
      landOn(s, q, wasGrounded, p.vy > 630 || p.diving);
      break;
    }
  }
  if (!p.grounded && s.launched && !p.diving && !wind && s.time - (s.lastSmashAt ?? -9) >= RULES.smashGrace) {
    // The rise still ahead of her at this speed (none while falling or
    // flying). Platforms are sorted top-down, so the highest top she is just
    // under wins.
    const rise = p.vy < 0 ? (p.vy * p.vy) / (2 * physicsOf(s).gravity) : 0;
    const lead = p.x + RULES.playerWidth / 2;
    for (const q of s.platforms) {
      if (q.noPop || q.collapsed || q.triggeredAt != null || (q.collapseAt != null && s.time >= q.collapseAt - s.physics.cascadeShake)) continue;
      const overlap = Math.min(lead, q.x + q.width) - Math.max(p.x - RULES.playerWidth / 2, q.x);
      if (overlap < RULES.stepUpOverlap) continue;
      const depth = p.y - q.y,
        limit = flightDt > 0 ? RULES.flightStepDepth : lead - q.x <= RULES.lipReach ? RULES.lipDepth : RULES.stepUpDepth;
      if (depth <= 0 || depth > limit || rise >= depth) continue;
      p.vy = 0;
      landOn(s, q, wasGrounded, false);
      s.stepUps = (s.stepUps || 0) + 1;
      if (lead - q.x <= RULES.lipReach) s.lipCatches = (s.lipCatches || 0) + 1;
      event(s, "lip-catch", { platform: q.id, step: true, depth });
      break;
    }
  }
  if (!p.grounded) {
    s.airTime += dt;
    s.coyote = Math.max(0, s.coyote - dt);
    s.fallTime = p.vy > 0 ? s.fallTime + dt : 0;
    if (s.coyote <= 0 && p.jumps === 0) p.jumps = 1;
    if (wasGrounded && s.animation.name === "run") animate(s, "air");
  }
  for (const q of s.pickups) {
    if (q.collected) continue;
    const rx = q.great ? 40 : q.chain ? 40 : 34,
      ry = q.great ? 46 : 43;
    if (Math.abs(q.x - p.x) < rx && Math.abs(q.y - (p.y - 36)) < ry)
      collectStar(s, q);
  }
  // Refill stars: a box of +-44 x +-50 px around the body centre. Lit, one
  // acts and is taken; dormant, it is left in place (a later touch in the
  // same airtime still works once it is lit).
  for (const q of s.refillStars) {
    if (q.taken || Math.abs(q.x - p.x) >= 44 || Math.abs(q.y - (p.y - 36)) >= 50 || !refillLit(s, q)) continue;
    q.taken = true;
    event(s, "refill-star", { type: "refill-star", id: q.id, kind: q.kind, x: q.x, y: q.y });
    if (q.kind === "cape") refillCape(s, "cape-star");
    else {
      // One air jump back; a jump pressed within the buffer before the
      // contact (with none in hand) is the double on this tick.
      p.jumps = maxJumps(s) - 1;
      if (s.jumpBuffer > 0 && !s.bufferedDouble) leap(s, false, s.jumpBufferReleased);
    }
  }
  // A waiting cape press flies the moment it can (RESEARCH_REFILLS C12).
  if (s.capeBuffer > 0 && !p.grounded && capeReady(s) && !updraftAt(s)) dash(s);
  for (const c of s.chains) {
    if (c.complete || c.broken) continue;
    // Missing a star (passing it) or pausing too long fades the chain.
    const passed = s.pickups.some(
      (q) => q.chain === c.id && !q.collected && q.x + 50 < p.x,
    );
    if (passed || (c.got > 0 && s.time - c.lastAt > s.physics.constellationGap))
      breakChain(s, c);
  }
  s.score = s.stars * 100 + s.greatBanked.length * 1000;
  s.section = sectionAt(p.x, s.def);
  const movement = movementAt(p.x, s.def);
  if (movement.id !== s.movement.id) {
    s.movement = movement;
    event(s, "movement", { id: movement.id });
  }
  // Scripted moments (level.mjs `moments`, in sixteenths of simulation time
  // from the wake): a star landing ahead, the brightest star's flash, the
  // crash. They follow the clock, so a respawn replays those after its beacon.
  for (const m of s.def.moments ?? []) {
    const at = m.k * SIXTEENTH_SIM;
    if (s.time - dt < at - 1e-9 && s.time >= at - 1e-9) event(s, "moment", { id: m.id, kind: m.kind, target: m.target ?? null });
  }
  // GETs (RESEARCH_PROGRESSION 2.2): running through one owns its verb.
  for (const g of s.def.gets ?? []) {
    if (s.gotten.includes(g.id) || p.x < g.x) continue;
    s.gotten.push(g.id);
    s.verbs[g.verb] = true;
    // The cape's bar appears empty and breathes in over the next bar, or,
    // for a relic marked `full` (RESEARCH_REFILLS 2.2: II's gift on the
    // crater floor), full: its first flight is the gift's own.
    if (g.verb === "cape" && s.capeRule === "breath") ((s.capeCharge = g.full ? 1 : 0), (s.capeCharges = g.full ? 1 : 0));
    event(s, "get", { id: g.id, verb: g.verb });
    // The relic (RESEARCH_REFILLS 2): the renderer's banner and pickup.
    event(s, "relic", { type: "relic", id: g.id, verb: g.verb, x: g.x, y: relicY(s.def, g) });
  }
  // Breath: one bar (capeBreathBeats beats of simulation time) of running on
  // stable stone fills the cape; cracks, the air and wind add nothing.
  if (p.grounded && s.ground && !isCracked(s.ground) && !s.ground.collapsed) breathe(s, dt / (s.physics.capeBreathBeats * BEAT_SIM), "ground");
  for (const mark of s.def.checkpoints) {
    if (
      s.checkpointsReached.includes(mark.id) ||
      p.x < mark.x ||
      p.x > mark.x + 400 ||
      !p.grounded ||
      Math.abs(p.y - mark.y) > 1
    )
      continue;
    s.checkpointsReached.push(mark.id);
    bankGreatStars(s);
    s.checkpoint = {
      id: mark.id,
      x: mark.x,
      y: mark.y,
      stars: s.stars,
      highStars: s.highStars,
      time: s.time,
      collected: s.pickups.filter((q) => q.collected).map((q) => q.id),
      refillsTaken: s.refillStars.filter((q) => q.taken).map((q) => q.id),
      chains: Object.fromEntries(
        s.chains.map((c) => [c.id, { ...c, links: [...c.links] }]),
      ),
      ringsCrossed: s.ringsCrossed,
      reached: [...s.checkpointsReached],
      verbs: { ...s.verbs },
      gotten: [...s.gotten],
    };
    s.fallsHere = 0;
    s.starNetUsed = false;
    refillCape(s, "beacon");
    event(s, "checkpoint", { id: mark.id, index: s.def.checkpoints.indexOf(mark) });
  }
  if (p.y > s.anchorY + s.physics.fallLimit) die(s);
  else if (p.x >= s.def.level.finishX && p.grounded) {
    p.x = s.def.level.finishX;
    s.status = "won";
    bankGreatStars(s);
    animate(s, "stop");
    event(s, "win", { earth: s.greatBanked.length === 3 });
  }
}
/** The simulation's fixed step (RESEARCH_LEVELS F4). */
export const TICK = 1 / 120;
/** Advance by `seconds` of simulation time in exact 1/120 s ticks; the
 * remainder waits in an accumulator for the next call, so an arc is the same
 * at 30, 60, 120, 144 or 240 Hz (it used to end each call with a shorter
 * substep). Inputs applied between calls take effect on the next tick.
 * `s.alpha` is how far the next tick is, for rendering interpolation. */
export function update(s, seconds, controls = {}) {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new RangeError("seconds must be finite and nonnegative");
  s.acc = (s.acc ?? 0) + seconds;
  while (s.acc >= TICK - 1e-9) {
    s.acc -= TICK;
    s.player.px = s.player.x;
    s.player.py = s.player.y;
    tick(s, TICK, controls);
  }
  if (s.acc < 0) s.acc = 0;
  s.alpha = Math.min(1, s.acc / TICK);
  return s;
}
export function snapshot(s) {
  const ready = capeReady(s);
  return {
    status: s.status,
    time: s.time,
    distance: s.distance,
    score: s.score,
    stars: s.stars,
    starsTotal: s.pickups.filter((q) => !q.great).length,
    highStars: s.highStars,
    speed: s.speed,
    capeRule: s.capeRule,
    // Legacy QA field: 1 when a flight is ready (breath: a full bar).
    capeCharges: s.assist.endlessCape ? 1 : s.capeRule === "breath" ? (ready ? 1 : 0) : s.capeCharges,
    capeCharge: s.assist.endlessCape ? 1 : s.capeRule === "breath" ? s.capeCharge : ready ? 1 : 0,
    capeFull: ready,
    verbs: { ...s.verbs },
    gets: (s.def.gets ?? []).map((g) => ({ ...g, taken: s.gotten.includes(g.id) })),
    // RESEARCH_REFILLS: the relics (each ability's GET as a pickup on the run
    // line) and the refill stars, pure data for the renderer.
    relics: (s.def.gets ?? []).map((g) => ({ id: g.id, verb: g.verb, x: g.x, y: relicY(s.def, g), taken: s.gotten.includes(g.id) })),
    refills: s.refillStars.map((q) => ({ id: q.id, kind: q.kind, x: q.x, y: q.y, required: q.required, lit: refillLit(s, q), taken: q.taken })),
    capeReady: ready,
    capeSpent: !ready,
    dashCooldown: s.dashCooldown,
    dashRemaining: s.dashRemaining,
    superUsed: s.superUsed,
    progress: Math.max(
      0,
      Math.min(1, (s.player.x - s.def.level.startX) / (s.def.level.finishX - s.def.level.startX)),
    ),
    deaths: s.deaths,
    fallsHere: s.fallsHere,
    checkpoint: s.checkpoint ? { ...s.checkpoint } : null,
    checkpointsReached: [...s.checkpointsReached],
    ringsCrossed: s.ringsCrossed,
    constellations: s.constellationsDone,
    chains: s.chains.map((c) => ({ ...c, links: [...c.links] })),
    greatStars: s.greatBanked.length,
    greatBanked: [...s.greatBanked],
    greatPending: [...s.greatPending],
    // (The count of breath refills; `refills` is now the refill stars.)
    refillCount: s.refills,
    smashes: s.smashes,
    lipCatches: s.lipCatches,
    stepUps: s.stepUps ?? 0,
    flights: s.flights,
    superJumps: s.superJumps,
    anchorY: s.anchorY,
    fallTime: s.fallTime,
    respawn: s.respawn ? { ...s.respawn } : null,
    assist: { ...s.assist },
    section: { ...s.section },
    movement: { ...s.movement },
    animation: { ...s.animation },
    player: { ...s.player },
    platforms: s.platforms.map((q) => ({ ...q })),
    pickups: s.pickups.map((q) => ({ ...q })),
    prompts: s.prompts.map((q) => ({ ...q })),
    updrafts: s.updrafts.map((q) => ({ ...q })),
    event: s.event,
    eventSerial: s.eventSerial,
    level: s.level,
    world: { ...s.def.level },
    // The level's authored pilots (frozen data, shared, not copied).
    routes: s.def.routes,
  };
}
