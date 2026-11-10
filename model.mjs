import {
  LEVEL,
  CHECKPOINTS,
  createLevel,
  sectionAt,
  movementAt,
} from "./level.mjs";
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
  // Ledge forgiveness: arriving up to 25 px below a top surface right at its
  // lip (the first 40 px) while falling or barely rising pops Diana onto it,
  // so a near miss never reads as sinking through the drawn island edge.
  lipDepth: 25,
  lipReach: 40,
  lipRiseLimit: 120,
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
const DURATIONS = {
  start: 1 / 3,
  jump: 5 / 12,
  softLanding: 10 / 12,
  hardLanding: 13 / 12,
  dive: 0.5,
  dash: 23 / 24,
  stop: 0.75,
};
export function isCracked(platform) {
  return CRACKED.has(platform?.type);
}
export function createGame(seed = 2021, options = {}) {
  const world = createLevel();
  const capeRule = options.capeRule ?? RULES.capeRule;
  return {
    seed,
    capeRule,
    status: "ready",
    time: 0,
    distance: 0,
    stars: 0,
    highStars: 0,
    score: 0,
    speed: LEVEL.speed,
    capeCharges: 1,
    dashCooldown: 0,
    dashRemaining: 0,
    superUsed: false,
    launched: false, // a jump or flight began this airtime (lip catch)
    coyote: RULES.coyote,
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
    starNetUsed: false,
    assist: {
      endlessCape: !!options.endlessCape,
      starNet: !!options.starNet,
    },
    section: sectionAt(LEVEL.startX),
    movement: movementAt(LEVEL.startX),
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
export function capeReady(s) {
  if (s.assist.endlessCape) return true;
  return s.capeRule === "cooldown" ? s.dashCooldown <= 0 : s.capeCharges > 0;
}
function refillCape(s, source) {
  const was = capeReady(s);
  s.capeCharges = 1;
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
export function restart(s) {
  const assist = { ...s.assist },
    serial = s.eventSerial;
  Object.assign(s, createGame(s.seed, { capeRule: s.capeRule, ...assist }));
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
    createGame(s.seed, { capeRule: s.capeRule, ...keep.assist }),
  );
  Object.assign(s, keep);
  s.status = "running";
  const cp = s.checkpoint;
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
    s.distance = (cp.x - LEVEL.startX) / 10;
    for (const q of s.pickups)
      q.collected = cp.collected.includes(q.id) || keep.greatBanked.includes(q.id);
    for (const c of s.chains) {
      const saved = cp.chains[c.id];
      if (saved) Object.assign(c, saved);
    }
    for (const q of s.prompts) q.done = q.to < cp.x;
  } else {
    for (const q of s.pickups) q.collected = keep.greatBanked.includes(q.id);
  }
  s.section = sectionAt(s.player.x);
  s.movement = movementAt(s.player.x);
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
  // control returns, so a hurried retry press is never swallowed.
  if (s.status === "dead" || s.status === "respawning") {
    s.queuedJump = true;
    return false;
  }
  if (s.status !== "running") return false;
  const p = s.player;
  if (s.dashRemaining > 0 && !s.superUsed && !p.grounded) {
    // M6: flight + jump = super jump, once per flight, whatever jumps remain.
    s.superUsed = true;
    s.dashRemaining = 0;
    p.vy = -RULES.superJump;
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
  if (p.jumps >= 2 && s.coyote <= 0) {
    s.jumpBuffer = RULES.jumpBuffer;
    s.jumpBufferReleased = false;
    return false;
  }
  const bufferedTap = s.jumpBuffer > 0 && s.jumpBufferReleased;
  const first = p.grounded || s.coyote > 0;
  p.vy = -(first ? RULES.jump : RULES.doubleJump);
  // A tap released before landing must keep its short arc when consumed later;
  // otherwise input forgiveness would turn that tap into an unwanted full jump.
  if (bufferedTap) p.vy = Math.max(-RULES.tapCap, p.vy);
  p.jumps = first ? 1 : 2;
  p.grounded = false;
  p.diving = false;
  s.launched = true;
  s.coyote = 0;
  s.jumpBuffer = 0;
  s.jumpBufferReleased = false;
  s.dashRemaining = 0;
  animate(s, "jump");
  markPrompts(s, first ? "jump" : "double-jump");
  event(s, first ? "jump" : "double-jump");
  return true;
}
export function releaseJump(s) {
  if (s.status !== "running") return;
  if (s.jumpBuffer > 0) s.jumpBufferReleased = true;
  if (s.player.vy < -RULES.tapCap) s.player.vy = -RULES.tapCap;
}
export function dash(s) {
  if (s.status !== "running" || s.player.grounded || !capeReady(s))
    return false;
  // Inside solar wind the cape does not dash level (a level flight there can
  // run under the shore it is meant to reach); holding it glides upward.
  if (updraftAt(s)) return false;
  if (!s.assist.endlessCape) {
    s.capeCharges = 0;
    if (s.capeRule === "cooldown") s.dashCooldown = RULES.dashCooldown;
  }
  s.dashRemaining = RULES.dashDuration;
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
  if (s.status !== "running") return false;
  const p = s.player;
  if (p.grounded) {
    // Only drawn cracks are smashable. Ordinary ground ignores a grounded dive.
    const q = supportOf(s);
    if (!q || !isCracked(q)) return false;
    smash(s, q);
    p.grounded = false;
    p.y += 1;
    p.vy = Math.max(RULES.smashCarry, p.vy);
  } else p.vy = Math.max(RULES.diveSpeed, p.vy);
  p.diving = true;
  p.gliding = false;
  s.dashRemaining = 0;
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
  q.collapsed = true;
  q.smashedAt = s.time;
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
  group.t0 = s.time - (s.player.x - first.x) / LEVEL.speed + group.lead / LEVEL.speed;
  group.tiles.forEach((id, i) => {
    const q = s.platforms.find((t) => t.id === id);
    q.collapseAt = group.t0 + i * group.interval;
  });
  event(s, "cascade", { group: group.id });
}
function updraftAt(s) {
  const p = s.player,
    cy = p.y - RULES.playerHeight / 2;
  return s.updrafts.find(
    (u) => p.x >= u.x && p.x <= u.x + u.width && cy >= u.top && cy <= u.bottom,
  );
}
function landOn(s, q, wasGrounded, hard) {
  const p = s.player;
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
  s.coyote = RULES.coyote;
  s.anchorY = q.y;
  s.fallTime = 0;
  s.launched = false;
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
    return;
  }
  s.stars++;
  if (q.route === "high") s.highStars++;
  const c = q.chain ? s.chains.find((k) => k.id === q.chain) : null;
  if (c && !c.complete && !c.broken) {
    if (c.got === 0 || s.time - c.lastAt <= RULES.constellationGap) {
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
    toX: s.checkpoint ? s.checkpoint.x : LEVEL.startX,
    toY: s.checkpoint ? s.checkpoint.y : LEVEL.startY,
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
  const fresh = createLevel();
  const freshById = new Map(fresh.platforms.map((q) => [q.id, q]));
  for (const q of s.platforms)
    if (q.x + q.width > at.x) Object.assign(q, freshById.get(q.id));
  for (const g of s.cascades) {
    const first = s.platforms.find((q) => q.id === g.tiles[0]);
    if (first.x + first.width > at.x) g.t0 = null;
  }
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
  const out = RULES.respawnShatter + RULES.respawnIris;
  if (s.status === "dead" && r.t >= out) {
    const queued = s.queuedJump;
    if (r.net) catchInStarNet(s);
    else restoreCheckpoint(s);
    s.queuedJump = queued;
    s.status = "respawning";
    s.respawn = { ...r, t: out };
    event(s, "respawn", { source: r.net ? "net" : "beacon" });
  } else if (s.status === "respawning") {
    advanceAnimation(s, dt);
    if (r.t >= out + RULES.respawnPop) {
      s.status = "running";
      s.respawn = null;
      if (s.queuedJump) jump(s);
      s.queuedJump = false;
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
  const previousY = p.y,
    wasGrounded = p.grounded;
  const advance = s.speed * dt + RULES.dashSpeed * flightDt;
  p.x += advance;
  s.distance = (p.x - LEVEL.startX) / 10;
  // Entering the wind ends a flight: the column takes over and lifts.
  if (s.dashRemaining > 0 && !p.grounded && !p.diving && updraftAt(s)) {
    s.dashRemaining = 0;
    event(s, "wind-catch");
  }
  const wind = !p.grounded && !p.diving && s.dashRemaining <= 0 && updraftAt(s);
  p.inWind = !!wind;
  p.gliding = !!controls.glide && !p.diving && !p.grounded && s.dashRemaining <= 0;
  if (p.gliding && wind) markPrompts(s, "glide");
  if (flightDt > 0) p.vy = 0;
  else if (wind) {
    // M5: inside a column gravity becomes lift. A fast upward jump keeps its
    // ordinary deceleration until it slows to the cap, so entering a column
    // never yanks Diana down.
    const boost = p.gliding ? RULES.updraftGlideBoost : 1,
      cap = RULES.updraftRise * boost;
    if (p.vy < -cap) p.vy = Math.min(-cap, p.vy + RULES.gravity * dt);
    else p.vy = Math.max(-cap, p.vy - RULES.updraftLift * boost * dt);
  } else {
    const glide = p.gliding && p.vy > 0;
    p.vy += (glide ? RULES.glideGravity : RULES.gravity) * dt;
    if (glide) p.vy = Math.min(RULES.glideFall, p.vy);
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
        p.vy = Math.max(RULES.smashCarry, p.vy);
        continue;
      }
      landOn(s, q, wasGrounded, p.vy > 630 || p.diving);
      break;
    }
  }
  if (!p.grounded && s.launched && p.vy > -RULES.lipRiseLimit && !p.diving) {
    // Lip catch: the leading edge has just crossed a platform's left lip and
    // the feet are a little below its top. Pop up instead of sliding down the
    // drawn side. Only the first lipReach px count, so a body that is already
    // well under a platform (a drop from above) is never pulled up through it.
    // It forgives near misses of a jump or flight only: walking off an edge
    // never earns it, so short gaps still need their hop.
    const lead = p.x + RULES.playerWidth / 2;
    for (const q of s.platforms) {
      if (q.collapsed || (q.collapseAt != null && s.time >= q.collapseAt)) continue;
      if (lead < q.x || lead > q.x + RULES.lipReach || q.x + q.width < p.x) continue;
      if (p.y <= q.y || p.y - q.y > RULES.lipDepth) continue;
      // The previous step was outside the platform's span (just arrived).
      if (lead - advance > q.x + 1) continue;
      p.vy = Math.max(0, p.vy);
      landOn(s, q, wasGrounded, false);
      s.lipCatches = (s.lipCatches || 0) + 1;
      event(s, "lip-catch", { platform: q.id });
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
  for (const c of s.chains) {
    if (c.complete || c.broken) continue;
    // Missing a star (passing it) or pausing too long fades the chain.
    const passed = s.pickups.some(
      (q) => q.chain === c.id && !q.collected && q.x + 50 < p.x,
    );
    if (passed || (c.got > 0 && s.time - c.lastAt > RULES.constellationGap))
      breakChain(s, c);
  }
  s.score = s.stars * 100 + s.greatBanked.length * 1000;
  s.section = sectionAt(p.x);
  const movement = movementAt(p.x);
  if (movement.id !== s.movement.id) {
    s.movement = movement;
    event(s, "movement", { id: movement.id });
  }
  for (const mark of CHECKPOINTS) {
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
      chains: Object.fromEntries(
        s.chains.map((c) => [c.id, { ...c, links: [...c.links] }]),
      ),
      ringsCrossed: s.ringsCrossed,
      reached: [...s.checkpointsReached],
    };
    s.fallsHere = 0;
    s.starNetUsed = false;
    refillCape(s, "beacon");
    event(s, "checkpoint", { id: mark.id, index: CHECKPOINTS.indexOf(mark) });
  }
  if (p.y > s.anchorY + RULES.fallLimit) die(s);
  else if (p.x >= LEVEL.finishX && p.grounded) {
    p.x = LEVEL.finishX;
    s.status = "won";
    bankGreatStars(s);
    animate(s, "stop");
    event(s, "win", { earth: s.greatBanked.length === 3 });
  }
}
export function update(s, seconds, controls = {}) {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new RangeError("seconds must be finite and nonnegative");
  for (let left = seconds; left > 1e-9; ) {
    const dt = Math.min(left, 1 / 120);
    tick(s, dt, controls);
    left -= dt;
  }
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
    capeCharges: s.assist.endlessCape ? 1 : s.capeCharges,
    capeReady: ready,
    capeSpent: !ready,
    dashCooldown: s.dashCooldown,
    dashRemaining: s.dashRemaining,
    superUsed: s.superUsed,
    progress: Math.max(
      0,
      Math.min(1, (s.player.x - LEVEL.startX) / (LEVEL.finishX - LEVEL.startX)),
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
    refills: s.refills,
    smashes: s.smashes,
    lipCatches: s.lipCatches,
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
    level: { ...LEVEL },
  };
}
