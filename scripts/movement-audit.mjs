/** Movement audit (common/docs/MOVEMENT_CRITERIA.md, MOVEMENT_AUDIT.md):
 * measurements on the pure model with ordinary inputs, shared by
 * tests/movement-audit.test.mjs and the printed report.
 *   node scripts/movement-audit.mjs            the full report (about a minute)
 *   node scripts/movement-audit.mjs sprites    one section: arcs, forgiveness,
 *                                              sprites, below, windows, hitches
 * Units: world px and seconds. "sim" values are in the simulation's 107 BPM
 * units; "real" values divide by the level's clock (BPM / 107), which is
 * what a player experiences. */
import { readFile } from "node:fs/promises";
import { decodePNG } from "../tests/png.mjs";
import { characterLayers } from "../animation.mjs";
import { createGame, start, update, jump, releaseJump, dash, dive, snapshot, TICK, RULES } from "../model.mjs";
import { LEVELS, levelDef } from "../level.mjs";
import { viewGeometry, VIEW } from "../geometry.mjs";

export const DRAW_SCALE = 0.42; // game.js drawDianaLayers
const ROOT = new URL("../", import.meta.url);
export const readManifest = async () => JSON.parse(await readFile(new URL("assets/manifest.json", ROOT)));

/* ---------- C1: every animation frame against the collider ---------- */
/** For every sheet frame Diana can show: where its drawn pixels (alpha > 64)
 * land relative to the collider's feet (x = centre, y = feet, y down) when
 * drawn exactly as game.js does (bottom pivot, 0.42 scale, baked `foot`).
 * Unity's rects are sometimes fractional (y -0.00003, h 200.333); the
 * browser samples them as the rounded cell, so they are rounded here (the
 * old lowest-row probe read those cells as empty). */
export async function frameTable(manifest) {
  const out = new Map();
  const images = new Map();
  const sheets = new Set();
  for (const [clip, a] of Object.entries(manifest.animations)) {
    if (["sprout", "cadent1", "cadent2"].includes(clip)) continue;
    for (const q of a.frames) sheets.add(q.sheet);
  }
  for (const sheet of sheets) {
    const def = manifest[sheet];
    if (!images.has(def.file)) images.set(def.file, decodePNG(await readFile(new URL(def.file, ROOT))));
    const im = images.get(def.file);
    def.frames.forEach((f0, frame) => {
      const f = { ...f0, x: Math.round(f0.x), y: Math.max(0, Math.round(f0.y)), w: Math.round(f0.w), h: Math.round(f0.h) };
      const rows = [];
      for (let y = f.y; y < Math.min(im.height, f.y + f.h); y++) {
        let a = Infinity,
          b = -Infinity;
        for (let x = f.x; x < f.x + f.w; x++) if (im.pixels[(y * im.width + x) * 4 + 3] > 64) ((a = Math.min(a, x - f.x)), (b = Math.max(b, x - f.x)));
        if (b >= 0) rows.push([y - f.y, a, b]);
      }
      if (!rows.length) return;
      const foot = f0.foot ?? 0;
      // Drawn top of the cell: feet - 42 - h (1 - pivotY) 0.42, plus the foot offset.
      const rowY = (r) => -42 - f0.h * (1 - f0.pivotY) * DRAW_SCALE + r * DRAW_SCALE + foot;
      const colX = (c) => -f0.w * f0.pivotX * DRAW_SCALE + c * DRAW_SCALE;
      const lowest = rowY(rows.at(-1)[0] + 1);
      // The feet: drawn pixels within 4 px of the lowest one.
      const band = rows.filter(([r]) => rowY(r + 1) >= lowest - 4);
      out.set(`${sheet}:${frame}`, {
        sheet,
        frame,
        foot,
        // > 0: the lowest drawn pixel is above the collider's feet.
        residual: -lowest,
        lift: foot - lowest,
        feetX0: colX(Math.min(...band.map((q) => q[1]))),
        feetX1: colX(Math.max(...band.map((q) => q[2])) + 1),
        bodyX0: colX(Math.min(...rows.map((q) => q[1]))),
        bodyX1: colX(Math.max(...rows.map((q) => q[2])) + 1),
        top: rowY(rows[0][0]),
      });
    });
  }
  return out;
}
/** Clips Diana uses in play and whether their pose is meant to be airborne. */
export const PLAY_CLIPS = {
  idle: "ground",
  start: "ground",
  run: "ground",
  stop: "ground",
  softLanding: "ground",
  hardLanding: "ground",
  jump: "air",
  air: "air",
  dash: "air",
  dive: "air",
};
/** Run-cycle flight phases: both feet are off the ground by design (the
 * stride's float), so they are reported, not drawn lower (that would invert
 * the run's bob). Ids are sheet:frame. */
export const STRIDE_FLOAT = new Set(["run:4", "run:9", "softLanding:4", "softLanding:9", "jumpLanding:13", "jumpLanding:18", "startStop:3"]);
export function playFrames(manifest, table) {
  const out = [];
  for (const [clip, kind] of Object.entries(PLAY_CLIPS))
    manifest.animations[clip].frames.forEach((q, i) => {
      const m = table.get(`${q.sheet}:${q.frame}`);
      out.push({ clip, index: i, kind, id: `${q.sheet}:${q.frame}`, ...m, stride: STRIDE_FLOAT.has(`${q.sheet}:${q.frame}`) });
    });
  return out;
}
/** Where the drawn toe and feet are this tick (renderer rule: the body
 * layer's frame, drawn at the feet plus its baked foot offset). */
export function drawnFeet(manifest, table, s) {
  const body = characterLayers(manifest, s.animation.name, s.animation.age)[0];
  const m = table.get(`${body.sheet}:${body.frame}`);
  return { y: s.player.y - m.residual, x0: s.player.x + m.feetX0, x1: s.player.x + m.feetX1, id: `${body.sheet}:${body.frame}` };
}

/* ---------- isolated worlds with a level's own physics ---------- */
/** Level n's rules (clock, physics, verbs) in a world of only `main`
 * platforms ([id, x, top, width, type?]) and optional cascades/updrafts. */
export function world(n, main, { cascades = [], updrafts = [], start: at = { x: 220, y: 540 }, endless = false } = {}) {
  const base = levelDef(n);
  const def = {
    ...base,
    level: { ...base.level, startX: at.x, startY: at.y, finishX: 1e7 },
    main,
    high: [],
    updrafts,
    cascades,
    chains: [],
    great: [],
    prompts: [],
    stars: [],
    checkpoints: [],
  };
  const s = start(createGame(1, { def, endlessCape: endless }));
  return s;
}
/** Real seconds -> whole simulation ticks on level n. */
export const ticksOf = (n, seconds) => Math.round((seconds * levelDef(n).clock) / TICK);
export const realMs = (n, ticks) => (ticks * TICK * 1000) / levelDef(n).clock;

/* ---------- from below onto every platform type ---------- */
/** Input recipes for an approach, as [tick offset from the takeoff, action].
 * Offsets are real seconds converted with the level's clock, i.e. what a
 * player does: tap releases, second presses, cape timings, super jumps. */
export function approachKinds(n, fine = false) {
  const c = (s) => ticksOf(n, s);
  const kinds = [["held", [[0, "jump"]]]];
  for (const h of fine ? [0, 0.03, 0.06, 0.1, 0.15] : [0, 0.06, 0.12]) kinds.push([`tap ${Math.round(h * 1000)}ms`, [[0, "jump"], [c(h), "release"]]]);
  for (const d of fine ? [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6] : [0.2, 0.3, 0.4, 0.5]) kinds.push([`double ${Math.round(d * 1000)}ms`, [[0, "jump"], [c(d), "jump"]]]);
  if (levelDef(n).verbs.cape) {
    for (const d of fine ? [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5] : [0.15, 0.3, 0.45]) kinds.push([`flight ${Math.round(d * 1000)}ms`, [[0, "jump"], [c(d), "dash"]]]);
    // Super jump: cape 2/16 after the jump, jump 2/16 into the flight (L4's school).
    kinds.push(["super", [[0, "jump"], [Math.round(2 * 15 / 107 / TICK), "dash"], [Math.round(4 * 15 / 107 / TICK), "jump"]]]);
  }
  return kinds;
}
/** One approach: Diana runs along a floor at y 600 and takes off `dx` px
 * before (negative) or after the shelf's left lip, which sits `rise` px
 * above the floor. Two things are watched while she is airborne:
 *   throughTop  the drawn toe crossed the shelf's top line going down while
 *               her drawn feet were over the shelf (>= 2 px), and she did not
 *               land: "it looked like she made it, but she fell"
 *   closest     how far below the top her collider's feet got at best while
 *               the collider was over the shelf (px, > 0 = below)
 * and the result is where she first lands: "shelf", "floor" or "fell". */
export function approach(n, manifest, table, { type, width = 200, rise, dx, kind, cascade, ease = null }) {
  const shelfX = 1000,
    top = 600 - rise;
  const s = world(n, [["floor", -400, 600, 5000], ["shelf", shelfX, top, width, type]], {
    cascades: type === "cascade" ? [{ id: "wave", tiles: ["shelf"], lead: cascade?.lead ?? 80, interval: (15 / 107) * 4 }] : [],
    start: { x: shelfX + dx - 200, y: 600 },
  });
  s.physics = { ...s.physics, fallLimit: 1e9 };
  const [, recipe] = kind;
  const q = s.platforms.find((k) => k.id === "shelf");
  let t0 = null,
    throughTop = null,
    closest = Infinity,
    result = "fell",
    prev = null,
    footDraw = 0,
    renders = 0;
  // `ease` models the pre-audit renderer: the foot offset eased toward each
  // frame's baked value with a 17 ms time constant, drawn at `ease.hz`.
  const drawn = (py) => {
    const body = characterLayers(manifest, s.animation.name, s.animation.age)[0];
    const m = table.get(`${body.sheet}:${body.frame}`);
    footDraw += (m.foot - footDraw) * Math.min(1, 1 / ease.hz / 0.017);
    if (Math.abs(m.foot - footDraw) < 0.3) footDraw = m.foot;
    return { y: py + footDraw - m.lift, x0: s.player.x + m.feetX0, x1: s.player.x + m.feetX1, id: `${body.sheet}:${body.frame}` };
  };
  for (let tick = 0; tick < 600; tick++) {
    const p = s.player;
    if (t0 === null && p.x >= shelfX + dx) t0 = tick;
    if (t0 !== null)
      for (const [at, a] of recipe)
        if (tick === t0 + at) {
          if (a === "jump") jump(s);
          else if (a === "release") releaseJump(s);
          else if (a === "dash") dash(s);
        }
    const ser = s.eventSerial;
    update(s, TICK);
    if (t0 === null) continue;
    const fresh = s.events.filter((e) => e.serial > ser);
    const land = fresh.find((e) => e.name === "lip-catch") ?? fresh.find((e) => e.name === "land");
    // A step-up's depth is measured before it pops her up.
    if (land?.name === "lip-catch") closest = Math.min(closest, land.depth);
    // An ordinary landing crossed the top from above (one-way rule).
    else if (land?.platform === "shelf") closest = Math.min(closest, 0);
    if (land) {
      result = land.platform === "shelf" ? "shelf" : "floor";
      break;
    }
    if (p.grounded || q.collapsed) {
      prev = null;
      continue;
    }
    const frames = [];
    if (ease) {
      // Render frames that fall in this tick, at their interpolated y.
      const per = ease.hz / 120;
      const from = Math.floor(renders),
        to = Math.floor(renders + per);
      renders += per;
      for (let k = from + 1; k <= to; k++) {
        const alpha = (k - from) / Math.max(1, to - from);
        frames.push(drawn(p.py + (p.y - p.py) * (per >= 1 ? alpha : 1)));
      }
    } else frames.push(drawnFeet(manifest, table, s));
    for (const f of frames) {
      const over = Math.min(f.x1, q.x + q.width) - Math.max(f.x0, q.x) >= 2;
      if (over && prev?.over && prev.y <= top + 0.5 && f.y > top + 2 && !throughTop) throughTop = `${f.id} toe ${(prev.y - top).toFixed(1)} -> ${(f.y - top).toFixed(1)}`;
      prev = { y: f.y, over };
    }
    if (Math.min(p.x + RULES.playerWidth / 2, q.x + q.width) - Math.max(p.x - RULES.playerWidth / 2, q.x) > 0) closest = Math.min(closest, p.y - top);
    if (p.y > 900) break;
  }
  return { result, throughTop, closest, stepUps: s.stepUps ?? 0 };
}
/** The dense sweep for one level and platform type. */
export function belowSweep(n, manifest, table, { type, width, rises, dxs, fine = false, ease = null }) {
  const kinds = approachKinds(n, fine);
  const stats = { trials: 0, shelf: 0, assisted: 0, lookedLandedFell: [], landedShort: [], bands: { above: 0, assist: 0, lip: 0, short: 0 } };
  for (const rise of rises)
    for (const dx of dxs)
      for (const kind of kinds) {
        const r = approach(n, manifest, table, { type, width, rise, dx, kind, ease });
        stats.trials++;
        const tag = `L${n} ${type ?? "stable"} rise ${rise} dx ${dx} ${kind[0]}: ${r.result}, closest ${r.closest.toFixed(1)}${r.throughTop ? `, ${r.throughTop}` : ""}`;
        if (r.result === "shelf") stats.shelf++;
        if (r.result === "shelf" && r.stepUps) stats.assisted++;
        if (r.throughTop && r.result !== "shelf") stats.lookedLandedFell.push(tag);
        if (r.result === "shelf" && r.closest > RULES.lipDepth + 0.01) stats.landedShort.push(tag);
        if (Number.isFinite(r.closest)) {
          const c = r.closest;
          stats.bands[c <= 2 ? "above" : c <= RULES.stepUpDepth ? "assist" : c <= RULES.lipDepth ? "lip" : "short"]++;
        }
      }
  return stats;
}
/** Every platform type of every level, at its narrowest authored width. */
export function platformTypes(n) {
  const def = levelDef(n);
  const all = [...def.main.map((q) => [q, "low"]), ...def.high.map((q) => [q, "high"])];
  const out = new Map();
  for (const [[id, , , width, type], route] of all) {
    const key = `${type ?? "stable"}${route === "high" && !type ? " optional" : ""}`;
    const t = def.cascades.some((c) => c.tiles.includes(id)) ? "cascade" : type;
    if (!out.has(key) || out.get(key).width > width) out.set(key, { key, type: t, width });
  }
  return [...out.values()];
}

/* ---------- B5-B10: arcs and forgiveness per level ---------- */
/** A jump from flat ground in free space: apex height and time, air time.
 * `release` is the hold in real seconds (Infinity = held to the end). */
export function arc(n, { release = Infinity } = {}) {
  const s = world(n, [["floor", -400, 540, 1000]], { start: { x: 300, y: 540 } });
  s.physics = { ...s.physics, fallLimit: 1e9 };
  const c = levelDef(n).clock;
  jump(s);
  if (release === 0) releaseJump(s);
  let t = 0,
    minY = 540,
    apex = 0,
    released = release === 0,
    maxVy = 0;
  while (t < 4) {
    update(s, TICK);
    t += TICK / c;
    if (!released && t >= release - 1e-9) ((released = true), releaseJump(s));
    if (s.player.y < minY) ((minY = s.player.y), (apex = t));
    maxVy = Math.max(maxVy, s.player.vy);
    if (s.player.grounded) break;
  }
  return { height: 540 - minY, apex, air: t };
}
/** Real-time rates per level: gravity, jump speeds, fall cap, hang. */
export function physicsReal(n) {
  const c = levelDef(n).clock,
    ph = createGame(1, { level: n }).physics;
  const hang = ph.apexHang;
  return {
    clock: c,
    run: ph === null ? 0 : levelDef(n).level.speed * c,
    gravity: ph.gravity * c * c,
    jump: ph.jump * c,
    doubleJump: ph.doubleJump * c,
    tapCap: ph.tapCap * c,
    maxFall: ph.maxFall ? ph.maxFall * c : null,
    // Extra time spent with |vy| under the threshold because of the hang.
    hangExtra: hang ? (2 * hang.below) / (ph.gravity * hang.factor) / c - (2 * hang.below) / ph.gravity / c : 0,
    coyote: ph.coyote / c,
    buffer: ph.jumpBuffer / c,
    flight: ph.dashDuration / c,
    flightExtra: ph.dashSpeed * ph.dashDuration,
    dive: ph.diveSpeed * c,
    superJump: ph.superJump * c,
  };
}
/** Coyote, measured: the last tick after the support ends on which a press is
 * still a ground jump (real ms). */
export function coyoteMs(n) {
  let last = -1;
  for (let k = 0; k < 60; k++) {
    const s = world(n, [["edge", -400, 540, 1000], ["catch", -400, 900, 5000]]);
    s.physics = { ...s.physics, fallLimit: 1e9 };
    let left = null,
      kind = null;
    for (let t = 0; t < 600 && kind === null; t++) {
      update(s, TICK);
      if (left === null && !s.player.grounded) left = t;
      if (left !== null && t === left + k) {
        const ser = s.eventSerial;
        jump(s);
        kind = s.events.find((e) => e.serial > ser)?.name ?? "none";
      }
    }
    if (kind !== "jump") break;
    last = k;
  }
  return realMs(n, last + 1);
}
/** Jump buffer, measured: how early before touch-down a press still becomes
 * a ground jump on the landing tick, with the double jump spent (`jumps` 2)
 * or still in hand (`jumps` 1, which used to fire the double at once). */
export function bufferMs(n, jumps = 2) {
  const drop = () => {
    const s = world(n, [["floor", -400, 540, 5000]]);
    Object.assign(s.player, { y: 360, grounded: false, jumps, vy: 0 });
    s.coyote = 0;
    s.launched = true;
    return s;
  };
  const probe = drop();
  let landTick = 0;
  while (!probe.player.grounded) (update(probe, TICK), landTick++);
  let best = 0;
  for (let k = 1; k < 60; k++) {
    const s = drop();
    let groundJump = false;
    for (let t = 0; t < landTick + 2; t++) {
      if (t === landTick - k) jump(s);
      const ser = s.eventSerial;
      update(s, TICK);
      const ev = s.events.filter((e) => e.serial > ser);
      if (ev.some((e) => e.name === "land")) {
        groundJump = ev.some((e) => e.name === "jump") && s.player.jumps === 1;
        break;
      }
      if (ev.some((e) => e.name === "double-jump")) break;
    }
    if (!groundJump) break;
    best = k;
  }
  return realMs(n, best);
}

/* ---------- F: timing windows of every action on a route ---------- */
const clone = (s) => {
  const { def, physics, ...rest } = s;
  return Object.assign(structuredClone(rest), { def, physics });
};
const ACTIONS = ["jump", "double-jump", "super-jump", "dash", "dive"];
function press(s, a) {
  if (a === "tap") return (jump(s), releaseJump(s));
  if (a === "jump") return jump(s);
  if (a === "dash") return dash(s);
  if (a === "dive") return dive(s);
}
const holds = (s, when) => (when === "g" ? s.player.grounded : when === "a" ? !s.player.grounded : true);
/** The route pilot's semantics (tests/routes.mjs) tick by tick at 120 Hz,
 * recording when each step fired, what it did (the event; a buffered press
 * counts as what it became) and where Diana next touched down after it. */
export function nominalRun(n, route = "main") {
  const s = start(createGame(2021, { level: n }));
  const plan = s.def.routes[route];
  const steps = plan.map(() => ({}));
  let i = plan.findIndex((q) => q[0] >= s.player.x - 1),
    glide = false,
    tick = 0,
    seen = s.eventSerial;
  const waiting = [];
  while (s.status === "running" && tick < 120 * 150) {
    while (i < plan.length) {
      const [x, a, w] = plan[i];
      if (s.player.x < x || !holds(s, w)) break;
      const step = steps[i++];
      step.tick = tick;
      if (a === "glide" || a === "unglide") {
        glide = a === "glide";
        step.snap = { s: clone(s), glide, tick };
        continue;
      }
      const ser = s.eventSerial;
      press(s, a);
      step.kind = s.events.find((e) => e.serial > ser && ACTIONS.includes(e.name))?.name ?? "buffered";
      step.snap = { s: clone(s), glide, tick };
      waiting.push(step);
      break;
    }
    update(s, TICK, { glide });
    tick++;
    for (const e of s.events)
      if (e.serial > seen) {
        seen = e.serial;
        for (const step of waiting) if (step.kind === "buffered" && (e.name === "jump" || e.name === "double-jump")) step.kind = e.name;
        if (e.name === "land") for (const step of waiting.splice(0)) step.land ??= e.platform;
      }
  }
  return { status: s.status, deaths: s.deaths, plan, steps, ticks: tick };
}
/** Replay step i shifted by `delta` ticks (a person pressing that much
 * earlier or later), from the state just after step i - 1. Later steps are
 * flown like a person would: a grounded step at its x once grounded (the
 * edge is visible), an airborne or held step at its rhythm after the step
 * before it. Success: no fall before the next beacon (or the door), and the
 * shifted press did the same thing (a jump stays a jump, not a double) and
 * led to the same next touch-down. `hold`: ticks until the jump is released. */
export function replayShifted(n, nom, i, delta, { hold = Infinity, skip = false, strict = true } = {}) {
  const { plan, steps } = nom;
  const base = i > 0 ? steps[i - 1].snap : null;
  const s = base ? clone(base.s) : start(createGame(2021, { level: n }));
  let tick = base ? base.tick : 0,
    glide = base ? base.glide : false;
  const at = steps[i].tick + delta;
  if (at <= (base ? base.tick : -1)) return { ok: null };
  const horizonX = nextBeacon(n, plan[i][0]);
  const fired = [];
  let j = i,
    releaseAt = null,
    kind = null,
    land = null,
    seen = s.eventSerial;
  for (let guard = 0; guard < 120 * 40; guard++) {
    if (s.status === "dead") return { ok: false, why: "fell", x: s.player.x };
    if (s.status === "won" || s.player.x >= horizonX) return { ok: skip || !strict || kind === steps[i].kind, why: kind };
    if (releaseAt !== null && tick >= releaseAt) ((releaseAt = null), releaseJump(s));
    while (j < plan.length) {
      const [x, a, w] = plan[j];
      if (j === i) {
        if (tick < at) break;
      } else if (w === "g") {
        if (s.player.x < x || !s.player.grounded) break;
      } else if (tick < fired[j - 1] + (steps[j].tick - steps[j - 1].tick) || !holds(s, w)) break;
      fired[j] = tick;
      if (a === "glide" || a === "unglide") {
        if (!(j === i && skip)) glide = a === "glide";
        j++;
        continue;
      }
      if (j === i) {
        if (!skip) {
          const ser = s.eventSerial;
          press(s, a);
          kind = s.events.find((e) => e.serial > ser && ACTIONS.includes(e.name))?.name ?? "buffered";
          seen = s.eventSerial;
          if (a === "jump" && Number.isFinite(hold)) releaseAt = tick + hold;
        }
      } else press(s, a);
      j++;
      break;
    }
    update(s, TICK, { glide });
    tick++;
    if (kind && land === null)
      for (const e of s.events)
        if (e.serial > seen) {
          seen = e.serial;
          if (kind === "buffered") {
            if (e.name === "jump" || e.name === "double-jump") kind = e.name;
          } else if (e.name === "land") {
            land = e.platform;
            if (strict && (land !== steps[i].land || kind !== steps[i].kind)) return { ok: false, why: `${kind} onto ${land}` };
          }
        }
  }
  return { ok: s.status !== "dead", why: "timeout" };
}
export function nextBeacon(n, x) {
  const d = levelDef(n);
  return d.checkpoints.map((c) => c.x).filter((cx) => cx > x + 60).sort((a, b) => a - b)[0] ?? d.level.finishX;
}
/** The contiguous range of press ticks around the authored one that work,
 * searched outward to ±maxMs real; widths are real ms (each tick a press can
 * land on covers one tick of time). `required`: skipping the step fails. */
export function timingWindow(n, nom, i, { maxMs = 400, hold } = {}) {
  const max = Math.ceil(ticksOf(n, maxMs / 1000));
  const ok = (d) => replayShifted(n, nom, i, d, { hold }).ok;
  const required = !replayShifted(n, nom, i, 0, { skip: true }).ok;
  let lo = 0,
    hi = 0,
    loEnd = "fail",
    hiEnd = "fail";
  if (!ok(0)) return { i, step: nom.plan[i], required, works: false, widthMs: 0 };
  for (let d = -1; ; d--) {
    const r = d < -max ? "limit" : ok(d);
    if (r === null || r === "limit") {
      loEnd = r === null ? "previous press" : "limit";
      break;
    }
    if (!r) break;
    lo = d;
  }
  for (let d = 1; ; d++) {
    if (d > max) {
      hiEnd = "limit";
      break;
    }
    if (!ok(d)) break;
    hi = d;
  }
  return { i, step: nom.plan[i], required, works: true, lo, hi, earlyMs: -realMs(n, lo), lateMs: realMs(n, hi), widthMs: realMs(n, hi - lo + 1), loEnd, hiEnd };
}
/** D3 recovery: how much later than the strict window's end a ground press
 * can come and still survive to the next beacon by whatever it becomes
 * (past coyote it is the double jump), real ms; capped at `maxMs`. */
export function lateRecovery(n, nom, w, { maxMs = 400 } = {}) {
  const max = Math.ceil(ticksOf(n, maxMs / 1000));
  let hi = w.hi;
  for (let d = w.hi + 1; d <= max && replayShifted(n, nom, w.i, d, { strict: false }).ok; d++) hi = d;
  return realMs(n, hi - w.hi);
}
/** The shortest hold (real ms) a held jump on the route needs, and for taps
 * the longest hold that still works (a person cannot release in 0 ms). */
export function holdNeed(n, nom, i, { maxMs = 700 } = {}) {
  const [, a] = nom.plan[i];
  const step = 1;
  if (a === "tap") {
    // Taps are replayed as a jump released after h ticks.
    const tapPlan = { ...nom, plan: nom.plan.map((q, k) => (k === i ? [q[0], "jump", q[2]] : q)) };
    let longest = -1;
    for (let h = 0; realMs(n, h) <= 250; h += step) {
      if (!replayShifted(n, tapPlan, i, 0, { hold: h }).ok) break;
      longest = h;
    }
    return { tap: true, longestMs: longest < 0 ? null : realMs(n, longest) };
  }
  let shortest = null;
  for (let h = 0; realMs(n, h) <= maxMs; h += step)
    if (replayShifted(n, nom, i, 0, { hold: h }).ok) {
      shortest = h;
      break;
    }
  return { tap: false, shortestMs: shortest === null ? null : realMs(n, shortest) };
}

/* ---------- F / E3: decision lead ---------- */
/** For every required step on the main route, at a level's narrowest
 * landscape or portrait view (geometry.mjs: the view's right edge is Diana's
 * x plus the lookahead), how long before the latest press that still works
 * (timingWindow) the player could see what the press answers:
 *   edgeLeadS     for a press made on the ground, the end of the stone
 *                 under her: the obstacle itself
 *   landingLeadS  for the press that commits to a touch-down (the last
 *                 press before it), the platform she lands on.
 * Times are real seconds. */
export function decisionLeads(n, nom, windows, view) {
  const c = levelDef(n).clock;
  const plats = createGame(2021, { level: n }).platforms;
  const byId = new Map(plats.map((q) => [q.id, q]));
  // Diana's x and support at every tick of the nominal run.
  const xs = [],
    support = [];
  const s = start(createGame(2021, { level: n }));
  const steps = nom.steps;
  let k = 0,
    glide = false;
  for (let tick = 0; tick <= nom.ticks && s.status === "running"; tick++) {
    xs.push(s.player.x);
    support.push(s.player.grounded ? plats.find((q) => !q.collapsed && Math.abs(q.y - s.player.y) < 1 && s.player.x + 16 > q.x && s.player.x - 16 < q.x + q.width)?.id : null);
    while (k < steps.length && steps[k].tick === tick) {
      const [, a] = nom.plan[k];
      if (a === "glide" || a === "unglide") glide = a === "glide";
      else press(s, a);
      k++;
    }
    update(s, TICK, { glide });
  }
  const seenAt = (x) => xs.findIndex((px) => px + view.lookahead >= x);
  const lastPressBefore = new Map();
  for (const w of windows) if (w.works) lastPressBefore.set(steps[w.i].land, w.i);
  return windows
    .filter((w) => w.required && w.works)
    .map((w) => {
      const step = steps[w.i];
      const late = step.tick + w.hi;
      const from = support[step.tick] ? byId.get(support[step.tick]) : null;
      const commits = lastPressBefore.get(step.land) === w.i;
      return {
        i: w.i,
        step: w.step,
        target: step.land,
        commits,
        // The obstacle a grounded press answers: the end of the stone under her.
        edgeLeadS: from ? ((late - seenAt(from.x + from.width)) * TICK) / c : null,
        landingLeadS: commits ? ((late - seenAt(byId.get(step.land).x)) * TICK) / c : null,
      };
    });
}

/* ---------- A2: inputs under frame-rate changes and hitches ---------- */
/** Replays a level's main route as a person's timestamped presses (each in
 * the middle of the tick the 120 Hz pilot pressed on) through frames at
 * `frameTimes` (ms). `atTimestamp` true is game.js now (catch up to the
 * event first); false is the old rule (apply at the last frame boundary).
 * Both clamp frames at `maxStep` (the old 50 ms clamp also lost world time
 * in every longer hitch; that is left out here so only the input rule
 * differs). Returns the run and the takeoff x of each press. */
export function replayFrames(n, frameTimes, { atTimestamp = true, maxStep = 0.1 } = {}) {
  const c = levelDef(n).clock;
  const nom = nominalRun(n);
  const presses = nom.plan.map(([, a], i) => ({ a, t: ((nom.steps[i].tick + 0.5) * TICK) / c })).filter((q) => Number.isFinite(q.t));
  const s = start(createGame(2021, { level: n }));
  let last = 0,
    glide = false,
    k = 0;
  const advance = (now) => {
    const real = Math.min(Math.max(0, now - last) / 1000, maxStep);
    if (now > last) last = now;
    update(s, real * c, { glide });
  };
  const xs = [];
  for (const now of frameTimes) {
    while (k < presses.length && presses[k].t * 1000 <= now) {
      const { a, t } = presses[k++];
      if (atTimestamp) advance(t * 1000);
      xs.push(s.player.x);
      if (a === "glide" || a === "unglide") glide = a === "glide";
      else press(s, a);
    }
    advance(now);
    if (s.status !== "running") break;
  }
  return { s, xs, nominalXs: presses.map((_, i) => nom.steps[i]?.snap?.s.player.x) };
}
export const steadyFrames = (hz, seconds = 90) => Array.from({ length: Math.ceil(seconds * hz) }, (_, i) => ((i + 1) * 1000) / hz);
export function hitchFrames(seed = 1, seconds = 90) {
  let x = seed;
  const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
  const out = [];
  for (let t = 0; t < seconds * 1000; ) out.push((t += rnd() < 0.15 ? 20 + rnd() * 80 : 4 + rnd() * 30));
  return out;
}

/* ---------- the printed report ---------- */
async function report(section) {
  const want = (k) => !section || section === k;
  const f1 = (v, d = 0) => (v === null || v === undefined ? "-" : Number(v).toFixed(d));
  if (want("arcs")) {
    console.log("\n## B5-B8 arcs (real units)");
    console.log("| L | run px/s | g px/s² | jump | double | apex s | held h | 0 ms tap h | ratio | 50 ms tap ratio | fall cap | hang extra s |");
    for (const n of LEVELS.map((d) => d.id)) {
      const ph = physicsReal(n),
        held = arc(n),
        tap = arc(n, { release: 0 }),
        q = arc(n, { release: 0.05 });
      console.log(`| ${n} | ${f1(ph.run)} | ${f1(ph.gravity)} | ${f1(ph.jump)} | ${f1(ph.doubleJump)} | ${held.apex.toFixed(3)} | ${held.height.toFixed(1)} | ${tap.height.toFixed(1)} | ${(tap.height / held.height).toFixed(3)} | ${(q.height / held.height).toFixed(3)} | ${f1(ph.maxFall)} | ${ph.hangExtra.toFixed(3)} |`);
    }
  }
  if (want("forgiveness")) {
    console.log("\n## B9/B10/B14 forgiveness and flight (real)");
    for (const n of LEVELS.map((d) => d.id)) {
      const ph = physicsReal(n);
      console.log(`L${n}: coyote ${coyoteMs(n).toFixed(0)} ms, buffer ${bufferMs(n, 2).toFixed(0)} ms (double spent) / ${bufferMs(n, 1).toFixed(0)} ms (double in hand); flight ${ph.flight.toFixed(3)} s +${ph.flightExtra.toFixed(2)} px; dive ${f1(ph.diveSpeed ?? ph.dive)} px/s; super ${f1(ph.superJump)} px/s`);
    }
  }
  const manifest = await readManifest();
  const table = await frameTable(manifest);
  if (want("sprites")) {
    console.log("\n## C1 frames: toe above the feet (px), feet and body x vs the ±16 px collider");
    for (const f of playFrames(manifest, table))
      console.log(`${f.clip}[${f.index}] ${f.id}: toe ${f.residual.toFixed(1)}${f.stride ? " (stride float)" : ""} feet x ${f.feetX0.toFixed(1)}..${f.feetX1.toFixed(1)} body x ${f.bodyX0.toFixed(1)}..${f.bodyX1.toFixed(1)} top ${f.top.toFixed(1)}`);
  }
  if (want("below")) {
    console.log("\n## C1/B12 from below: rise 20-280 px by 4, takeoff -340..+80 px by 10, every approach kind (taps 0-150 ms, doubles 150-600 ms, flights 100-500 ms, super)");
    const fine = { rises: range(20, 280, 4), dxs: range(-340, 80, 10) },
      coarse = { rises: range(24, 270, 9), dxs: range(-330, 70, 25) };
    for (const [ease, grid] of [[null, fine], [{ hz: 60 }, coarse], [{ hz: 144 }, coarse], [{ hz: 240 }, coarse]]) {
      const total = { trials: 0, landed: 0, byStepUp: 0, lookedLandedButFell: 0, landedShort: 0 };
      for (const n of LEVELS.map((d) => d.id))
        for (const pt of platformTypes(n)) {
          const st = belowSweep(n, manifest, table, { type: pt.type, width: pt.width, ...grid, fine: !ease, ease });
          total.trials += st.trials;
          total.landed += st.shelf;
          total.byStepUp += st.assisted;
          total.lookedLandedButFell += st.lookedLandedFell.length;
          total.landedShort += st.landedShort.length;
          if (!ease) console.log(`L${n} ${pt.key} (w ${pt.width.toFixed(0)}): ${st.trials} trials, ${st.shelf} landed (${st.assisted} by step-up), looked-landed-but-fell ${st.lookedLandedFell.length}, landed-short ${st.landedShort.length}, closest-approach bands ${JSON.stringify(st.bands)}`);
          else if (st.lookedLandedFell.length) console.log(`  e.g. ${st.lookedLandedFell[0]}`);
        }
      console.log(`${ease ? `pre-audit renderer (foot eased over 17 ms) drawn at ${ease.hz} Hz, coarse grid` : "current renderer, fine grid"}: ${JSON.stringify(total)}`);
    }
  }
  if (want("windows")) {
    console.log("\n## F timing windows, holds and decision leads (real)");
    for (const n of LEVELS.map((d) => d.id)) {
      const nom = nominalRun(n);
      const ws = nom.plan.map(([, a], i) => (a === "glide" || a === "unglide" ? null : timingWindow(n, nom, i))).filter(Boolean);
      const req = ws.filter((w) => w.required);
      const d = levelDef(n);
      const lead = (w) => decisionLeads(n, nom, ws, viewGeometry(w));
      const land = lead(Math.max(VIEW.minWidth, d.view?.minWidth ?? 0)),
        port = lead(Math.max(VIEW.portraitMinWidth, d.view?.portraitMinWidth ?? 0));
      const min = (list, k) => Math.min(...list.map((l) => l[k]).filter((v) => v !== null));
      console.log(`L${n}: ${req.length} required of ${ws.length}; narrowest window ${Math.min(...req.map((w) => w.widthMs)).toFixed(0)} ms, smallest early side ${Math.min(...req.map((w) => w.earlyMs)).toFixed(0)} ms; edge lead >= ${min(land, "edgeLeadS").toFixed(2)} s landscape / ${min(port, "edgeLeadS").toFixed(2)} s portrait; landing lead >= ${min(land, "landingLeadS").toFixed(2)} / ${min(port, "landingLeadS").toFixed(2)} s`);
      for (const w of ws) {
        const h = w.step[1] === "jump" || w.step[1] === "tap" ? holdNeed(n, nom, w.i) : null;
        const l = land.find((q) => q.i === w.i);
        console.log(`  ${String(w.i).padStart(2)} ${w.step[1].padEnd(5)} ${(nom.steps[w.i].kind ?? "").padEnd(11)} x ${Math.round(w.step[0])} ${w.required ? "REQ" : "opt"} -${f1(w.earlyMs)}/+${f1(w.lateMs)} = ${f1(w.widthMs)} ms${h ? (h.tap ? `, tap works to ${f1(h.longestMs)} ms` : `, hold >= ${f1(h.shortestMs)} ms`) : ""}${l ? `, edge ${l.edgeLeadS === null ? "-" : l.edgeLeadS.toFixed(2)} s${l.commits ? `, landing ${l.landingLeadS.toFixed(2)} s -> ${l.target}` : ""}` : ""}`);
      }
    }
  }
  if (want("hitches")) {
    console.log("\n## A2 timestamped presses vs the old frame-boundary rule (takeoff x error vs 120 Hz, px)");
    for (const n of LEVELS.map((d) => d.id))
      for (const [name, frames] of [["30 Hz", steadyFrames(30)], ["60 Hz", steadyFrames(60)], ["hitches 0-100 ms", hitchFrames(n)]]) {
        const ref = replayFrames(n, steadyFrames(120));
        const out = [];
        for (const atTimestamp of [false, true]) {
          const r = replayFrames(n, frames, { atTimestamp });
          const err = Math.max(...r.xs.map((x, i) => Math.abs(x - ref.xs[i])).filter(Number.isFinite));
          out.push(`${atTimestamp ? "now" : "old"}: ${r.s.status} (${r.s.deaths} falls), worst takeoff ${err.toFixed(1)} px`);
        }
        console.log(`L${n} ${name}: ${out.join("; ")}`);
      }
  }
}
const range = (a, b, step) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);
if (import.meta.url === `file://${process.argv[1]}`) await report(process.argv[2]);
