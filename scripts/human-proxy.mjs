/** Human proxies (2026-11-10). The studio's lesson from the other two games:
 * levels proven *possible* by near-perfect bots were impassable for a real
 * person in one and too easy in the other. These three players fly a level's
 * main route on the pure model the way people do, so falls per level can be
 * set as targets and measured before and after every change.
 *
 *   first-timer  timing error σ 90 ms (real), reacts 280 ms after what a
 *                press answers enters the view, holds keys through falls,
 *                never reads text (it only follows the route a person learns
 *                from the level's shape and its wordless signs)
 *   casual       σ 60 ms, reacts 230 ms
 *   expert       σ 30 ms, reacts 190 ms
 *
 * What a press "answers" (decisionLeads in movement-audit.mjs): a press that
 * commits to a touch-down (the last press before it) answers the stone it
 * lands on, so it cannot come before that stone's near edge has been in view
 * for the reaction time at the level's narrowest landscape view. A person
 * who has fallen at a spot remembers everything that was in view there, so
 * a retry is limited by timing error only. Timing of each press:
 *   - airborne presses (double, cape, dive, a held cape's let-go) keep the
 *     route's rhythm from the player's own previous press, plus error;
 *   - a grounded press the route makes right after a touch-down ("land and
 *     go") is timed from the touch-down, predicted before it, plus error (an
 *     early one is buffered, a late one may walk off);
 *   - any other press is timed by position (Diana reaching the press's x).
 * Holds: a jump 250-500 ms, a tap 35-90 ms, a cape press 90-150 ms (unless
 * the route holds it to glide). Errors are Gaussian, clamped at ±2.5 σ.
 *
 *   node scripts/human-proxy.mjs [levels=1-8] [seeds=20] [proxy=all]
 * prints falls per run (mean, max), wins, the worst spot (falls in a row at
 * one beacon) and where the falls happen. Real = simulation / clock. */
import { createGame, start, update, jump, releaseJump, dash, dive, TICK } from "../model.mjs";
import { LEVELS, levelDef } from "../level.mjs";
import { viewGeometry, VIEW } from "../geometry.mjs";
import { nominalRun } from "./movement-audit.mjs";

export const PROXIES = Object.freeze({
  "first-timer": { sigma: 90, react: 280 },
  casual: { sigma: 60, react: 230 },
  expert: { sigma: 30, react: 190 },
});

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clone = (s) => {
  const { def, physics, ...rest } = s;
  return Object.assign(structuredClone(rest), { def, physics });
};
const keyOf = (a) => (a === "dash" || a === "glide" || a === "unglide" ? "cape" : a === "dive" ? "dive" : "jump");

/** The route as a person learns it: each step with its nominal time, the gap
 * to the step before, whether it is a land-and-go press and what it commits
 * to (the platform of the next touch-down, if it is the last press before). */
const learned = new Map();
export function learnRoute(n, route = "main") {
  const key = `${n}:${route}`;
  if (learned.has(key)) return learned.get(key);
  const nom = nominalRun(n, route);
  const plats = new Map(createGame(2021, { level: n }).platforms.map((q) => [q.id, q]));
  // Diana's grounded state at every tick of the nominal run, to tell a press
  // made right after a touch-down from one made on a long stone.
  const s = start(createGame(2021, { level: n }));
  const grounded = [];
  let k = 0,
    glide = false;
  for (let tick = 0; tick <= nom.ticks && s.status === "running"; tick++) {
    grounded.push(s.player.grounded);
    while (k < nom.steps.length && nom.steps[k].tick === tick) {
      const [, a] = nom.plan[k];
      if (a === "glide" || a === "unglide") glide = a === "glide";
      else if (a === "tap") (jump(s), releaseJump(s));
      else if (a === "jump") jump(s);
      else if (a === "dash") dash(s);
      else if (a === "dive") dive(s);
      k++;
    }
    update(s, TICK, { glide });
  }
  const lastBefore = new Map();
  nom.steps.forEach((q, i) => q.land && q.tick != null && lastBefore.set(q.land, i));
  const steps = nom.plan.map(([x, action, when], i) => {
    const q = nom.steps[i];
    if (q.tick == null) return null;
    let landTick = null;
    if (when === "g" && grounded[q.tick]) {
      // The touch-down this press follows, if it is within 3/16 of it.
      let t = q.tick;
      while (t > 0 && grounded[t - 1]) t--;
      if (q.tick - t <= 3 * (15 / 107) * 120 && t > 0) landTick = t;
    }
    const target = lastBefore.get(q.land) === i ? plats.get(q.land) : null;
    return { i, x, action, when, tick: q.tick, kind: q.kind, landTick, target: target ? { id: target.id, x: target.x } : null };
  });
  const out = { nom, steps };
  learned.set(key, out);
  return out;
}

/** One person playing one level's main route until the door (or `maxFalls`). */
export function playAsHuman(n, proxy = "first-timer", seed = 1, { route = "main", maxFalls = 30, width } = {}) {
  const d = levelDef(n);
  const P = typeof proxy === "string" ? PROXIES[proxy] : proxy;
  const c = d.clock;
  const view = viewGeometry(width ?? Math.max(VIEW.minWidth, d.view?.minWidth ?? 0));
  const { steps } = learnRoute(n, route);
  const rand = rng(seed * 7919 + n * 104729 + Math.round(P.sigma));
  const gauss = () => {
    let u = 0,
      v = 0;
    while (!u) u = rand();
    while (!v) v = rand();
    return Math.max(-2.5, Math.min(2.5, Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
  };
  const sim = (ms) => (ms / 1000) * c;
  const uni = (a, b) => sim(a + rand() * (b - a));
  const s = start(createGame(2021, { level: n }));
  const held = { jump: null, cape: null, dive: null }; // release time (sim s), or Infinity
  let i = -1,
    attempt = 0,
    knownX = -Infinity,
    lastFired = null,
    wasStatus = s.status,
    noise = [],
    commit = [],
    predicted = null;
  const entered = new Map();
  const falls = [];
  const log = [];
  const press = (key) => {
    if (key === "jump") jump(s);
    else if (key === "cape") dash(s);
    else dive(s);
  };
  const release = (key) => {
    if (key === "jump") releaseJump(s);
    held[key] = null;
  };
  // When the landing a land-and-go press follows will happen (sim s).
  const landingTime = () => {
    if (s.player.grounded) return s.time;
    if (predicted && predicted.serial === s.eventSerial) return predicted.t;
    const q = clone(s);
    let t = null;
    let up = held.jump;
    for (let k = 0; k < 480 && q.status === "running"; k++) {
      // The jump key comes up when this person lets go of it.
      if (up != null && q.time >= up) ((up = null), releaseJump(q));
      update(q, TICK, { glide: held.cape != null && q.time < held.cape });
      if (q.player.grounded) {
        t = q.time;
        break;
      }
    }
    predicted = { serial: s.eventSerial, t };
    return t;
  };
  let lastLand = s.time,
    wasGrounded = true;
  for (let tick = 0; tick < 120 * 400; tick++) {
    if (s.status !== wasStatus) {
      if (s.status === "dead") {
        falls.push({ x: s.player.x, attempt });
        // A fall teaches what was in view there.
        knownX = Math.max(knownX, s.player.x + view.lookahead);
      }
      wasStatus = s.status;
    }
    if (s.status === "won" || falls.length > maxFalls) break;
    const p = s.player;
    if (s.status === "running") {
      if (i < 0 || attempt !== falls.length) {
        // A new attempt from the beacon: find the route's place again.
        attempt = falls.length;
        i = steps.findIndex((q) => q && q.x >= p.x - 1);
        if (i < 0) i = steps.length;
        noise = [];
        commit = [];
        lastFired = null;
        entered.clear();
      }
      if (p.grounded && !wasGrounded) lastLand = s.time;
      wasGrounded = p.grounded;
      for (const q of steps) if (q?.target && !entered.has(q.target.id) && p.x + view.lookahead >= q.target.x) entered.set(q.target.id, s.time);
      // Fire every key event due before the next tick.
      for (let guard = 0; guard < 6; guard++) {
        const due = [];
        for (const k of Object.keys(held)) if (held[k] != null && held[k] < s.time + TICK) due.push({ at: held[k], up: k });
        while (i < steps.length && !steps[i]) i++;
        const q = steps[i];
        let at = null;
        if (q) {
          noise[i] ??= sim(gauss() * P.sigma);
          // By position: tracked until 0.5 s of simulation away, then kept.
          // A flight runs faster than the run for what is left of it.
          const dx = Math.max(0, q.x - p.x),
            v = s.speed,
            fast = s.dashRemaining > 0 ? s.dashRemaining : 0,
            dv = s.physics.dashSpeed;
          const dt = dx <= (v + dv) * fast ? dx / (v + dv) : fast + (dx - (v + dv) * fast) / v;
          const byX = commit[i] ?? s.time + dt;
          if (commit[i] == null && dt <= 0.5) commit[i] = byX;
          let base = byX;
          if (q.when === "a" && lastFired) base = lastFired.t + (q.tick - lastFired.tick) * TICK;
          else if (q.landTick != null) {
            // Land and go, timed from the touch-down, as long as that
            // touch-down is the route's (within 0.25 s of where the press
            // is); off the route a person presses at the stone's edge.
            const L = landingTime();
            const byLand = L == null ? null : (p.grounded ? lastLand : L) + (q.tick - q.landTick) * TICK;
            if (byLand != null && Math.abs(byLand - byX) < 0.25) base = byLand;
          }
          at = base + noise[i];
          if (q.target && q.target.x > knownX) {
            const seen = entered.get(q.target.id);
            at = seen == null ? Infinity : Math.max(at, seen + sim(P.react) + Math.abs(noise[i]) * 0.5);
          }
          // Glide/let-go steps that need no key change.
          if (q.action === "glide" && held.cape != null) {
            held.cape = Infinity;
            lastFired = { t: s.time, tick: q.tick };
            i++;
            continue;
          }
          if ((q.action === "unglide" && held.cape == null) || (q.action === "releaseJump" && held.jump == null)) {
            i++;
            continue;
          }
          if (at < s.time + TICK) due.push({ at, step: q });
        }
        if (!due.length) break;
        due.sort((a, b) => a.at - b.at);
        const e = due[0];
        if (e.up) {
          release(e.up);
          continue;
        }
        const key = keyOf(e.step.action);
        if (e.step.action === "unglide") {
          release("cape");
        } else {
          if (held[key] != null) release(key); // a key must come up before it goes down
          const ser = s.eventSerial;
          press(key);
          log.push({ i: e.step.i, a: e.step.action, t: +(s.time / c).toFixed(3), nominal: +((e.step.tick * TICK) / c).toFixed(3), x: Math.round(s.player.x), g: s.player.grounded, ev: s.events.filter((v) => v.serial > ser).map((v) => v.name).join("+"), attempt });
          if (e.step.action === "tap") held.jump = s.time + uni(35, 90);
          else if (e.step.action === "jump") held.jump = s.time + uni(250, 500);
          else if (e.step.action === "dive") held.dive = s.time + sim(60);
          else if (e.step.action === "glide") held.cape = Infinity;
          else if (e.step.action === "dash") {
            const nx = steps[e.step.i + 1];
            held.cape = nx && nx.action === "glide" && Math.abs(nx.x - e.step.x) < 1 ? Infinity : s.time + uni(90, 150);
          }
        }
        lastFired = { t: s.time, tick: e.step.tick };
        i = e.step.i + 1;
      }
    }
    // Keys held through a fall stay down until their own release (a person
    // does not let go because Diana shattered).
    for (const k of Object.keys(held)) if (held[k] != null && held[k] < s.time + TICK && s.status !== "running") release(k);
    update(s, TICK, { glide: held.cape != null });
  }
  const cps = [{ id: "start", x: d.level.startX }, ...d.checkpoints].sort((a, b) => a.x - b.x);
  const spotOf = (x) => cps.filter((q) => q.x <= x).at(-1)?.id ?? "start";
  // Falls in a row at one spot: consecutive falls with no beacon between.
  let worst = 0,
    run = 0,
    prev = null;
  for (const f of falls) {
    const spot = spotOf(f.x);
    run = spot === prev ? run + 1 : 1;
    prev = spot;
    worst = Math.max(worst, run);
  }
  return { level: n, proxy: typeof proxy === "string" ? proxy : "custom", seed, won: s.status === "won", falls: falls.length, worstSpot: worst, where: falls.map((f) => `${spotOf(f.x)}@${Math.round(f.x / 100) * 100}`), log, fallXs: falls.map((f) => Math.round(f.x)) };
}

/** Falls per run for one level and proxy over `seeds` seeds. */
export function proxyStats(n, proxy, seeds = 20) {
  const runs = Array.from({ length: seeds }, (_, k) => playAsHuman(n, proxy, k + 1));
  const where = {};
  for (const r of runs) for (const w of r.where) where[w] = (where[w] ?? 0) + 1;
  const falls = runs.map((r) => r.falls);
  return {
    level: n,
    proxy,
    seeds,
    won: runs.filter((r) => r.won).length,
    mean: falls.reduce((a, b) => a + b, 0) / seeds,
    max: Math.max(...falls),
    clean: runs.filter((r) => r.falls === 0).length,
    worstSpot: Math.max(...runs.map((r) => r.worstSpot)),
    where: Object.entries(where).sort((a, b) => b[1] - a[1]).slice(0, 4),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2] ?? "1-8";
  const levels = arg.includes("-") ? LEVELS.map((q) => q.id).filter((x) => x >= +arg.split("-")[0] && x <= +arg.split("-")[1]) : arg.split(",").map(Number);
  const seeds = +(process.argv[3] ?? 20);
  const names = process.argv[4] && process.argv[4] !== "all" ? process.argv[4].split(",") : Object.keys(PROXIES);
  for (const n of levels)
    for (const proxy of names) {
      const r = proxyStats(n, proxy, seeds);
      console.log(`L${n} ${proxy.padEnd(11)} won ${r.won}/${seeds}, falls mean ${r.mean.toFixed(2)} max ${r.max}, clean ${r.clean}/${seeds}, worst spot ${r.worstSpot} in a row; ${r.where.map(([w, k]) => `${w}×${k}`).join(" ")}`);
    }
}
