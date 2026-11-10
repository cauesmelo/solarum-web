/** Drive a route through the real model the way the game does, for the score's
 * tests and the soundboard's offline renders. Faults make a "sloppy" run:
 *   failAt:      ["leap", ...]   block the first airborne press (second jump
 *                                or cape) in that beacon's challenge once, so
 *                                Diana falls and respawns there
 *   removeStars: [...]           fixture edit: a constellation breaks there
 *   late:        [[x0, x1, px]]  grounded jumps chosen in [x0, x1] are pressed
 *                                px later (off the beat; the route still wins)
 * musicRun feeds the conductor directly (no Web Audio); recordFrames returns
 * the frames (with their events) that audio.mjs renderRunOffline plays. */
import { createGame, start, update, jump, releaseJump, dash, dive } from "../model.mjs";
import { createLevel, CHECKPOINTS } from "../level.mjs";
import { createRouteMemory, chooseAction } from "./routes.mjs";
import { PATH } from "../score-path.mjs";
import { createConductor, LAYERS } from "../score.mjs";

export const CRACKED = new Set(createLevel().platforms.filter((q) => q.type).map((q) => q.id));
const CHALLENGE = { leap: [3330, 3700], breaking: [7700, 8300], voids: [16000, 16700] };
const ACTIONS = { jump, releaseJump, dash, dive };
export const SLOPPY = Object.freeze({ failAt: ["leap", "voids"], removeStars: ["first-song-2"], late: [[4400, 4470, 14], [8600, 8710, 16], [10900, 10980, 12]] });

/** Calls onEvent(e, s) for every model event and onStep(s, glide) after every
 * step; returns the final state. Wake is the first event. */
export function drive({ route = "main", dt = 1 / 120, failAt = [], removeStars = [], late = [], maxSeconds = 160, onEvent, onStep } = {}) {
  const s = createGame();
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
          const zone = CHALLENGE[cp];
          const shift = late.find(([x0, x1]) => s.player.x >= x0 && s.player.x <= x1)?.[2];
          if ((a === "jump" || a === "dash") && !s.player.grounded && pending.has(cp) && zone && s.player.x > zone[0] && s.player.x < zone[1]) pending.delete(cp);
          else if (a === "jump" && s.player.grounded && shift) deferred = { x: s.player.x + shift };
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

export function musicRun({ gentle = false, timeScale = 1, ...options } = {}) {
  const c = createConductor({ path: PATH, cracked: CRACKED, gentle });
  const notes = [],
    fx = [],
    tuning = [],
    events = [],
    mixes = [];
  const s = drive({
    ...options,
    onEvent(e, st) {
      events.push(e);
      const before = c.tuning.H;
      const r = c.event(e, { timeScale });
      notes.push(...r.notes.map((n) => ({ ...n, event: e.name })));
      fx.push(...r.fx.map((f) => ({ ...f, time: st.time, event: e.name })));
      if (c.tuning.H !== before) tuning.push({ time: st.time, H: c.tuning.H, after: e.name });
    },
    onStep(st) {
      const before = c.tuning.H;
      const r = c.frame({ t: st.time, x: st.player.x, status: st.status, timeScale, inWind: st.player.inWind, gliding: st.player.gliding, y: st.player.y, fallsHere: st.fallsHere });
      if (r) fx.push(...r.fx.map((f) => ({ ...f, time: st.time, event: "control" })));
      if (c.transport.running && st.status === "running") {
        const k = c.transport.pos(st.time);
        for (const n of c.ticks(k, c.transport.pos(st.time + 0.12 * timeScale))) notes.push({ ...n, event: "tick" });
      }
      if (c.tuning.H !== before) tuning.push({ time: st.time, H: c.tuning.H, after: "tick" });
      mixes.push({ time: st.time, status: st.status, ...c.tuning.mix() });
    },
  });
  return { s, c, notes, fx, tuning, events, mixes, player: notes.filter((n) => !LAYERS[n.layer].bed) };
}

/** Game frames at `fps` for renderRunOffline: wall time keeps running while
 * Diana falls apart and reforms (the simulation clock does not). */
export function recordFrames({ fps = 60, ...options } = {}) {
  const frames = [];
  let wall = 0,
    events = [];
  const s = drive({
    ...options,
    dt: 1 / fps,
    onEvent(e) {
      events.push(e);
    },
    onStep(st, glide) {
      wall += 1 / fps;
      frames.push({ wall, simTime: st.time, x: st.player.x, y: st.player.y, status: st.status, timeScale: 1, inWind: st.player.inWind, gliding: st.player.gliding, glide, fallsHere: st.fallsHere, events });
      events = [];
    },
  });
  // The wake (and anything before the first step) belongs to the first frame.
  return { frames, status: s.status, time: s.time, deaths: s.deaths };
}

export const beaconX = (id) => CHECKPOINTS.find((q) => q.id === id).x;
