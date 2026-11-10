/** Drive the conductor with a real route, the way audio.mjs does: every model
 * event goes to conductor.event, every step to conductor.frame, and the bed
 * is scheduled 120 ms ahead. No Web Audio. Faults make a "sloppy" run:
 *   failAt:      ["leap", ...]   block the first airborne press (second jump
 *                                or cape) in that beacon's challenge once, so
 *                                Diana falls and respawns there
 *   removeStars: [...]           fixture edit: a constellation breaks there
 *   late:        [[x0, x1, px]]  grounded jumps chosen in [x0, x1] are pressed
 *                                px later (off the beat; the route still wins)
 */
import { createGame, start, update, jump, releaseJump, dash, dive } from "../model.mjs";
import { createLevel, CHECKPOINTS } from "../level.mjs";
import { createRouteMemory, chooseAction } from "./routes.mjs";
import { PATH } from "../score-path.mjs";
import { createConductor, LAYERS } from "../score.mjs";

export const CRACKED = new Set(createLevel().platforms.filter((q) => q.type).map((q) => q.id));
const CHALLENGE = { leap: [3330, 3700], breaking: [7700, 8300], voids: [16000, 16700] };
const ACTIONS = { jump, releaseJump, dash, dive };

export function musicRun({ route = "main", dt = 1 / 120, gentle = false, failAt = [], removeStars = [], late = [], maxSeconds = 160, timeScale = 1 } = {}) {
  const s = start(createGame());
  if (removeStars.length) s.pickups = s.pickups.filter((q) => !removeStars.includes(q.id));
  const c = createConductor({ path: PATH, cracked: CRACKED, gentle });
  const notes = [],
    fx = [],
    tuning = [],
    events = [],
    mixes = [];
  let seen = 0;
  const pending = new Set(failAt);
  const drain = () => {
    for (const e of s.events)
      if (e.serial > seen) {
        seen = e.serial;
        events.push({ ...e });
        const before = c.tuning.H;
        const r = c.event(e, { timeScale });
        notes.push(...r.notes.map((n) => ({ ...n, event: e.name })));
        fx.push(...r.fx.map((f) => ({ ...f, time: s.time, event: e.name })));
        if (c.tuning.H !== before) tuning.push({ time: s.time, H: c.tuning.H, after: e.name });
      }
  };
  c.event({ name: "wake", time: 0, x: s.player.x });
  seen = s.eventSerial;
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
    const before = c.tuning.H;
    update(s, dt, { glide: m.glide });
    drain();
    const r = c.frame({ t: s.time, x: s.player.x, status: s.status, timeScale, inWind: s.player.inWind, gliding: s.player.gliding, y: s.player.y, fallsHere: s.fallsHere });
    if (r) fx.push(...r.fx.map((f) => ({ ...f, time: s.time, event: "control" })));
    if (c.transport.running && s.status === "running") {
      const k = c.transport.pos(s.time);
      for (const n of c.ticks(k, c.transport.pos(s.time + 0.12 * timeScale))) notes.push({ ...n, event: "tick" });
    }
    if (c.tuning.H !== before) tuning.push({ time: s.time, H: c.tuning.H, after: "tick" });
    mixes.push({ time: s.time, status: s.status, ...c.tuning.mix() });
  }
  return { s, c, notes, fx, tuning, events, mixes, player: notes.filter((n) => !LAYERS[n.layer].bed) };
}

export const beaconX = (id) => CHECKPOINTS.find((q) => q.id === id).x;
