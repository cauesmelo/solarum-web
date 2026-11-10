/** Drive a route through the real model the way the game does, for the score's
 * tests and the soundboard's offline renders. Faults make a "sloppy" run:
 *   failAt:      ["leap", ...]   block the first airborne press (second jump
 *                                or cape) in that beacon's challenge once, so
 *                                Diana falls and respawns there
 *   removeStars: [...]           fixture edit: a constellation breaks there
 *   late:        [[x0, x1, px]]  grounded jumps chosen in [x0, x1] are pressed
 *                                px later (off the beat; the route still wins)
 * musicRun feeds the conductor directly (no Web Audio); recordFrames returns
 * the frames (with their events) that audio.mjs renderRunOffline plays.
 * Every function takes { level } (1-4, default 2: Borrowed Wind, clock 1). */
import { createGame, start, update, jump, releaseJump, dash, dive } from "../model.mjs";
import { createLevel, levelDef, LEVELS, gx } from "../level.mjs";
import { createRouteMemory, chooseAction } from "./routes.mjs";
import { PATHS } from "../score-path.mjs";
import { createConductor, LAYERS } from "../score.mjs";

export const CRACKED = new Set(LEVELS.flatMap((d) => createLevel(d).platforms.filter((q) => q.type).map((q) => q.id)));
/** Where each beacon's challenge is (x range of the first airborne press to block). */
const CHALLENGE = {
  1: { drift: [gx(84), gx(96)] },
  2: { voids: [16000, 16700] },
  3: { voids: [16000, 16700], well: [11500, 11650] },
  4: { storm: [gx(68), gx(76) + 130] },
};
const ACTIONS = { jump, releaseJump, dash, dive, tap: (s) => (jump(s), releaseJump(s)) };
/** A sloppy run of each level: one fall, one broken constellation and a few
 * grounded jumps pressed late (still on the island). */
export const SLOPPY_RUNS = Object.freeze({
  1: { level: 1, failAt: ["drift"], removeStars: ["first-song-2"], late: [[gx(36) - 1, gx(36) + 1, 14], [gx(124) - 1, gx(124) + 1, 12]] },
  2: { level: 2, failAt: ["voids"], removeStars: ["flight-line-2"], late: [[19860, 19870, 10]] },
  3: { level: 3, failAt: ["well"], removeStars: ["split-song-1"], late: [[8090, 8100, 12]] },
  4: { level: 4, failAt: ["storm"], removeStars: ["finale-song-1"], late: [] },
});
export const SLOPPY = SLOPPY_RUNS[2];

/** Calls onEvent(e, s) for every model event and onStep(s, glide) after every
 * step; returns the final state. Wake is the first event. */
export function drive({ route = "main", level = 2, dt = 1 / 120, failAt = [], removeStars = [], late = [], maxSeconds = 160, onEvent, onStep } = {}) {
  const s = createGame(2021, { level });
  if (removeStars.length) s.pickups = s.pickups.filter((q) => !removeStars.includes(q.id));
  let seen = s.eventSerial;
  const drain = () => {
    for (const e of s.events)
      if (e.serial > seen) {
        seen = e.serial;
        onEvent?.({ ...e }, s);
      }
  };
  start(s);
  drain();
  const pending = new Set(failAt);
  let m = createRouteMemory(route),
    wasRunning = true,
    deferred = null;
  for (let i = 0; i < maxSeconds / dt && s.status !== "won"; i++) {
    if (s.status === "running") {
      if (!wasRunning) (m = createRouteMemory(route)), (deferred = null); // back at a beacon
      if (deferred) {
        if (s.player.x >= deferred.x) {
          if (s.player.grounded || s.coyote > 0) jump(s);
          deferred = null;
          drain();
        }
      } else {
        const a = chooseAction(s, m);
        if (a) {
          const cp = s.checkpoint?.id;
          const zone = CHALLENGE[level][cp];
          const shift = late.find(([x0, x1]) => s.player.x >= x0 && s.player.x <= x1)?.[2];
          if ((a === "jump" || a === "dash" || a === "tap") && !s.player.grounded && pending.has(cp) && zone && s.player.x > zone[0] && s.player.x < zone[1]) pending.delete(cp);
          else if ((a === "jump" || a === "tap") && s.player.grounded && shift) deferred = { x: s.player.x + shift };
          else ACTIONS[a](s);
          drain();
        }
      }
    }
    wasRunning = s.status === "running";
    update(s, dt, { glide: m.glide });
    drain();
    onStep?.(s, m.glide);
  }
  return s;
}

export function musicRun({ gentle = false, timeScale = 1, level = 2, ...options } = {}) {
  const c = createConductor({ level, path: PATHS[level], cracked: CRACKED, gentle });
  const notes = [],
    fx = [],
    tuning = [],
    events = [],
    mixes = [];
  let seq = 0; // one order for notes and events (sim time rewinds at a respawn)
  const s = drive({
    ...options,
    level,
    onEvent(e, st) {
      events.push({ ...e, seq: seq++ });
      const before = c.tuning.H;
      const r = c.event(e, { timeScale });
      notes.push(...r.notes.map((n) => ({ ...n, event: e.name, seq: seq++ })));
      fx.push(...r.fx.map((f) => ({ ...f, time: st.time, event: e.name })));
      if (c.tuning.H !== before) tuning.push({ time: st.time, H: c.tuning.H, after: e.name });
    },
    onStep(st) {
      const before = c.tuning.H;
      const r = c.frame({ t: st.time, x: st.player.x, status: st.status, timeScale, inWind: st.player.inWind, gliding: st.player.gliding, y: st.player.y, fallsHere: st.fallsHere });
      if (r) fx.push(...r.fx.map((f) => ({ ...f, time: st.time, event: "control" })));
      if (c.transport.running && st.status === "running") {
        const k = c.transport.pos(st.time);
        for (const n of c.ticks(k, c.transport.pos(st.time + 0.12 * timeScale))) notes.push({ ...n, event: "tick", seq: seq++ });
      }
      if (c.tuning.H !== before) tuning.push({ time: st.time, H: c.tuning.H, after: "tick" });
      mixes.push({ time: st.time, status: st.status, ...c.tuning.mix() });
    },
  });
  return { s, c, notes, fx, tuning, events, mixes, player: notes.filter((n) => !LAYERS[n.layer].bed) };
}

/** Game frames at `fps` for renderRunOffline: wall time keeps running while
 * Diana falls apart and reforms (the simulation clock does not). */
export function recordFrames({ fps = 60, level = 2, ...options } = {}) {
  const frames = [];
  let wall = 0,
    events = [];
  // A frame is 1/fps of wall time and clock/fps of simulation.
  const s = drive({
    ...options,
    level,
    dt: levelDef(level).clock / fps,
    onEvent(e) {
      events.push(e);
    },
    onStep(st, glide) {
      wall += 1 / fps;
      // The level's clock: wall time runs 1/clock as fast as simulation time.
      frames.push({ wall, simTime: st.time, x: st.player.x, y: st.player.y, status: st.status, timeScale: st.clock, inWind: st.player.inWind, gliding: st.player.gliding, glide, fallsHere: st.fallsHere, events });
      events = [];
    },
  });
  // The wake (and anything before the first step) belongs to the first frame.
  return { frames, status: s.status, time: s.time, deaths: s.deaths };
}

export const beaconX = (id, level = 2) => levelDef(level).checkpoints.find((q) => q.id === id).x;
