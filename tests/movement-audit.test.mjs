/** Movement audit (MOVEMENT_AUDIT.md, common/docs/MOVEMENT_CRITERIA.md):
 * each rubric item measured on the pure model with ordinary inputs, per
 * level, at the four levels' own clocks. The measuring code lives in
 * scripts/movement-audit.mjs (`node scripts/movement-audit.mjs` prints the
 * full report); these tests pin the results. Real = what a player feels
 * (simulation seconds / the level's clock). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createGame, start, update, jump, releaseJump, dash, dive, snapshot, togglePause, setAssist, capeReady, TICK, RULES } from "../model.mjs";
import { LEVELS, levelDef } from "../level.mjs";
import { viewGeometry, VIEW } from "../geometry.mjs";
import { createFrameClock } from "../frame-clock.mjs";
import { playRoute } from "./routes.mjs";
import {
  readManifest,
  frameTable,
  playFrames,
  belowSweep,
  approach,
  approachKinds,
  platformTypes,
  world,
  arc,
  physicsReal,
  coyoteMs,
  bufferMs,
  nominalRun,
  timingWindow,
  holdNeed,
  decisionLeads,
  ticksOf,
  realMs,
} from "../scripts/movement-audit.mjs";

const IDS = LEVELS.map((d) => d.id);
const manifest = await readManifest();
const table = await frameTable(manifest);
const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const range = (a, b, step) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);
function api(s) {
  return {
    getState: () => snapshot(s),
    step: (d, c) => (update(s, d, c), snapshot(s)),
    jump: () => jump(s),
    releaseJump: () => releaseJump(s),
    dash: () => dash(s),
    dive: () => dive(s),
    tap: () => (jump(s), releaseJump(s)),
  };
}
const run = (n, route = "main", dt = 1 / 120) => {
  const s = start(createGame(2021, { level: n }));
  playRoute(api(s), { route, dt });
  return s;
};
/** Every event a run produced, as one comparable string. */
function trace(s) {
  return s.allEvents.map((e) => `${e.name}@${e.time.toFixed(6)}:${e.x.toFixed(3)},${e.y.toFixed(3)}${e.platform ? `/${e.platform}` : ""}`).join(" ");
}
function recorder(s) {
  s.allEvents = [];
  let seen = s.eventSerial;
  return () => {
    for (const e of s.events) if (e.serial > seen) ((seen = e.serial), s.allEvents.push(e));
  };
}

/* ---------- A. Responsiveness ---------- */
test("A1: every verb changes state on the press itself, in every level and at any frame rate", () => {
  for (const n of IDS)
    for (const hz of [30, 60, 120, 240]) {
      const where = `L${n} ${hz} Hz`;
      const s = world(n, [["floor", -400, 540, 3000]]);
      update(s, 1 / hz + 0.003); // a press between two ticks
      assert.equal(jump(s), true, where);
      assert.equal(s.player.vy, -s.physics.jump, `${where}: jump speed set by the press`);
      assert.equal(s.animation.name, "jump", `${where}: the pose changes on the press`);
      update(s, 1 / 120);
      assert.ok(s.player.y < 540, `${where}: rising on the next tick`);
      const v = s.player.vy;
      releaseJump(s);
      assert.ok(s.player.vy > v && s.player.vy === -s.physics.tapCap, `${where}: the release cuts on its own step`);
      while (s.player.vy < 0) update(s, 1 / 120);
      assert.equal(jump(s), true);
      assert.equal(s.player.vy, -s.physics.doubleJump, `${where}: double jump on the press`);
    }
  for (const n of IDS.filter((k) => levelDef(k).verbs.cape)) {
    const s = world(n, [["floor", -400, 540, 3000]]);
    jump(s);
    update(s, 0.2);
    assert.equal(dash(s), true);
    assert.equal(s.player.vy, 0, `L${n}: the flight holds level at once`);
    assert.ok(s.dashRemaining > 0);
    assert.equal(jump(s), true);
    assert.equal(s.player.vy, -s.physics.superJump, `L${n}: super jump on the press`);
    assert.equal(dive(s), true);
    assert.ok(s.player.vy >= s.physics.diveSpeed, `L${n}: the dive's speed is set by the press`);
  }
});
test("A2/A4: a timestamped human input script gives a bit-identical run at 30/60/120/240 Hz and under random 0-100 ms hitches", () => {
  for (const n of IDS) {
    const c = levelDef(n).clock;
    // The main route at 120 Hz, as press times: each press sits in the middle
    // of the tick it was made in (what a key event's timeStamp gives).
    const nom = nominalRun(n);
    const presses = nom.plan
      .map(([, a], i) => ({ a, t: ((nom.steps[i].tick + 0.5) * TICK) / c }))
      .filter((q) => Number.isFinite(q.t));
    const play = (frameTimes) => {
      const s = start(createGame(2021, { level: n }));
      const drain = recorder(s);
      const fc = createFrameClock({ maxStep: 0.1 });
      let glide = false,
        k = 0;
      fc.advance(0);
      for (const now of frameTimes) {
        // Events stamped before this frame are handled first, in order,
        // each after catching the simulation up to its own time (game.js).
        while (k < presses.length && presses[k].t * 1000 <= now) {
          const { a, t } = presses[k++];
          update(s, fc.advance(t * 1000) * c, { glide });
          drain();
          if (a === "glide" || a === "unglide") glide = a === "glide";
          else if (a === "tap") (jump(s), releaseJump(s));
          else ({ jump, dash, dive })[a](s);
          drain();
        }
        update(s, fc.advance(now) * c, { glide });
        drain();
        if (s.status !== "running") break;
      }
      return s;
    };
    const steady = (hz) => range(1, Math.ceil(90 * hz), 1).map((i) => (i * 1000) / hz);
    let seed = 7 * n;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const hitchy = [];
    for (let t = 0; t < 90000; ) hitchy.push((t += rnd() < 0.15 ? 20 + rnd() * 80 : 4 + rnd() * 30));
    const ref = play(steady(120));
    assert.equal(ref.status, "won", `L${n} reference`);
    assert.equal(ref.deaths, 0);
    const want = createHash("sha256").update(trace(ref)).digest("hex");
    for (const [name, times] of [["30 Hz", steady(30)], ["60 Hz", steady(60)], ["240 Hz", steady(240)], ["hitches", hitchy]]) {
      const s = play(times);
      assert.equal(s.status, "won", `L${n} ${name}`);
      assert.equal(createHash("sha256").update(trace(s)).digest("hex"), want, `L${n} ${name}: the run differs from 120 Hz`);
      assert.equal(s.time, ref.time, `L${n} ${name}`);
    }
    // A4: and the same run twice is identical.
    assert.equal(trace(play(steady(120))), trace(ref), `L${n} determinism`);
  }
});
test("A2: game.js applies each key and pointer at its own timestamp and clamps long gaps at 100 ms", async () => {
  const js = await read("game.js");
  assert.match(js, /createFrameClock\(\{ maxStep: 0\.1 \}\)/);
  assert.match(js, /function atInput\(e\)[^]*?advanceTo\(e\.timeStamp\)/);
});
test("A3: presses at landing, respawn, pause and level start are honoured or ignored by rule, never doubled", async () => {
  for (const n of IDS) {
    // Landing: a press 100 ms before touch-down is a ground jump on the
    // landing tick, whether or not the double jump is still in hand.
    for (const jumps of [1, 2]) {
      const drop = () => {
        const s = world(n, [["floor", -400, 540, 5000]]);
        Object.assign(s.player, { y: 380, grounded: false, jumps, vy: 0 });
        s.coyote = 0;
        s.launched = true;
        return s;
      };
      const probe = drop();
      let ticks = 0;
      for (; !probe.player.grounded; ticks++) update(probe, TICK);
      const s = drop();
      for (let i = 0; i < ticks - ticksOf(n, 0.1); i++) update(s, TICK);
      assert.equal(jump(s), false, `L${n} jumps ${jumps}: buffered, not spent in the air`);
      const drain = recorder(s);
      for (let i = 0; i < 40 && s.allEvents.every((e) => e.name !== "jump"); i++) (update(s, TICK), drain());
      const names = s.allEvents.map((e) => e.name);
      assert.deepEqual(names.slice(0, 2), ["land", "jump"], `L${n} jumps ${jumps}: ${names}`);
      assert.equal(s.player.jumps, 1, "the double jump is still there");
    }
    // Respawn: a press while falling apart fires when control returns; a
    // press and release there is a tap.
    for (const released of [false, true]) {
      const s = start(createGame(2021, { level: n }));
      Object.assign(s.player, { y: 1200, grounded: false });
      update(s, TICK);
      assert.equal(s.status, "dead");
      jump(s);
      if (released) releaseJump(s);
      while (s.status !== "running") update(s, TICK);
      assert.equal(s.player.vy, released ? -s.physics.tapCap : -s.physics.jump, `L${n} respawn ${released ? "tap" : "held"}`);
    }
    // Pause: presses are ignored; a release behind the pause card counts.
    const s = world(n, [["floor", -400, 540, 5000]]);
    jump(s);
    update(s, 0.02);
    togglePause(s);
    assert.equal(jump(s), false, "no jump while paused");
    releaseJump(s);
    togglePause(s);
    assert.ok(s.player.vy >= -s.physics.tapCap && !s.jumpHeld, `L${n}: the release during pause cut the jump`);
  }
  // A press that waited for a touch-down which a held glide postponed still
  // fires (as the double jump) when the buffer runs out: never lost.
  const g = world(2, [["floor", -400, 540, 5000]]);
  Object.assign(g.player, { y: 520, grounded: false, jumps: 1, vy: 300 });
  g.coyote = 0;
  g.launched = true;
  assert.equal(jump(g), false);
  g.player.gliding = true;
  g.player.vy = 0;
  g.player.y = 440;
  const drain = recorder(g);
  for (let i = 0; i < 30; i++) (update(g, TICK, { glide: true }), drain());
  assert.ok(g.allEvents.some((e) => e.name === "double-jump"), "the double jump fired at the buffer's end");
  // The browser layer: auto-repeat never jumps again; the wake press only wakes.
  const js = await read("game.js");
  assert.match(js, /if \(e\.repeat\) return;/);
  // (The wake press starts Diana's emergence; a second press only skips it.)
  assert.match(js, /state\.status === "ready" && \["Space", "Enter", "ArrowUp", "KeyW"\]\.includes\(e\.code\)\) return pressWake\(\)/);
  assert.match(js, /addEventListener\("blur", \(\) => \{[^}]*releaseJump\(state\)/);
});

/* ---------- B. Jump, forgiveness, air resources ---------- */
test("B5-B8: apex time, tap/hold ratio, release cut and fall per level (L1 floats on purpose)", () => {
  const want = { 1: [0.5, 0.56], 2: [0.36, 0.39], 3: [0.33, 0.35], 4: [0.3, 0.33] };
  for (const n of IDS) {
    const held = arc(n),
      tap = arc(n, { release: 0 }),
      quick = arc(n, { release: 0.05 });
    assert.ok(held.apex >= want[n][0] && held.apex <= want[n][1], `L${n} apex ${held.apex.toFixed(3)} s`);
    if (n > 1) assert.ok(held.apex >= 0.3 && held.apex <= 0.45, `L${n} apex in the 0.30-0.45 s band`);
    const ratio = tap.height / held.height;
    assert.ok(ratio > 0.22 && ratio < 0.25, `L${n} 0 ms tap / hold ${ratio.toFixed(3)}`);
    assert.ok(quick.height / held.height >= 0.3 && quick.height / held.height <= 0.56, `L${n} 50 ms keyboard tap ${(quick.height / held.height).toFixed(3)}`);
    const ph = physicsReal(n);
    if (n === 1) {
      assert.equal(ph.maxFall.toFixed(0), "560");
      assert.ok(ph.hangExtra > 0.12 && ph.hangExtra < 0.14, `L1 hang adds ${ph.hangExtra.toFixed(3)} s`);
    } else assert.equal(ph.maxFall, null, "L2-L4 keep the symmetric, uncapped arc their cells are solved on");
  }
});
test("B9/B10: coyote and jump buffer are the same real time in every level, with or without the double in hand", () => {
  for (const n of IDS) {
    const coyote = coyoteMs(n),
      spent = bufferMs(n, 2),
      inHand = bufferMs(n, 1);
    assert.ok(coyote >= 108 && coyote <= 120, `L${n} coyote ${coyote.toFixed(0)} ms`);
    assert.ok(spent >= 130 && spent <= 140, `L${n} buffer ${spent.toFixed(0)} ms`);
    assert.ok(Math.abs(inHand - spent) < 1e-9, `L${n} buffer with the double in hand ${inHand.toFixed(0)} ms`);
  }
});
test("B13: air resources refresh only by the documented rules", () => {
  // Rising through a one-way top never refreshes the double jump or the cape.
  const s = world(2, [["floor", -400, 600, 5000], ["thin", 0, 520, 3000]]);
  Object.assign(s.player, { x: 300, y: 600, grounded: true });
  jump(s);
  update(s, 0.1);
  jump(s); // the double, rising
  assert.equal(s.player.jumps, 2);
  for (let i = 0; i < 12 && s.player.y > 520 - 30; i++) update(s, TICK);
  assert.equal(s.player.jumps, 2, "passing up through 'thin' changed nothing");
  // A flight cannot be reopened without a refill; a super jump once per flight.
  assert.equal(dash(s), true);
  assert.equal(dash(s), false, "one flight per airtime");
  assert.equal(jump(s), true);
  assert.equal(jump(s), false, "the super jump leaves no double");
  // Cracked stone never gives the cape back; stable stone and beacons do.
  const c = world(3, [["crack", -400, 540, 3000, "crumble"]]);
  c.capeCharges = 0;
  update(c, 0.05);
  assert.equal(capeReady(c), false);
  // In wind the cape does not dash.
  const w = world(2, [["floor", -400, 900, 5000]], { updrafts: [{ id: "u", x: 200, width: 300, top: 300, bottom: 700 }] });
  Object.assign(w.player, { x: 300, y: 600, grounded: false, jumps: 1 });
  assert.equal(dash(w), false);
});
test("B14: a flight is fixed: 0.5 s of simulation, +113.55 px (three sixteenths), level, at any frame rate", () => {
  for (const n of IDS.filter((k) => levelDef(k).verbs.cape))
    for (const hz of [30, 60, 120, 240]) {
      const s = world(n, [["floor", -400, 540, 3000]]);
      s.physics = { ...s.physics, fallLimit: 1e9 };
      jump(s);
      update(s, 0.25);
      const x0 = s.player.x,
        y0 = s.player.y,
        t0 = s.time;
      dash(s);
      while (s.dashRemaining > 0) update(s, 1 / hz);
      const t = s.time - t0;
      assert.ok(Math.abs(t - 0.5) < TICK, `L${n} ${hz} Hz flight ${t}`);
      assert.ok(Math.abs(s.player.x - x0 - 270 * t - RULES.dashSpeed * 0.5) < 0.01, `L${n} ${hz} Hz extra distance`);
      assert.ok(Math.abs(s.player.y - (y0 - 0.5)) < 1e-9, `L${n} ${hz} Hz the flight is level`);
      assert.ok(Math.abs(physicsReal(n).flight - 0.5 / levelDef(n).clock) < 1e-9);
    }
});

/* ---------- C. Collision fidelity ---------- */
test("C1: every frame Diana shows in play is drawn with its lowest pixel on the collider's feet (±2 px), except the stride's float", () => {
  const frames = playFrames(manifest, table);
  assert.ok(frames.length >= 80, `${frames.length} frames`);
  for (const f of frames) {
    const where = `${f.clip}[${f.index}] ${f.id}: toe ${f.residual.toFixed(1)} px above the feet`;
    if (f.stride) assert.ok(f.residual > 4 && f.residual < 7.5, `${where} (a stride's float)`);
    else assert.ok(Math.abs(f.residual) <= 2, where);
    // The collider (32 x 58, a support box: nothing hurts on contact) is
    // never larger than the drawn body.
    assert.ok(f.bodyX1 - f.bodyX0 >= RULES.playerWidth, `${where}: body narrower than the collider`);
    assert.ok(-f.top >= RULES.playerHeight, `${where}: body shorter than the collider`);
  }
});
test("C1/B12: from below onto every platform type of every level, nothing looks landed and falls, and nothing clearly short lands", () => {
  // The user's report: "it looks like you made it, but you don't go up".
  // Each approach is drawn as the renderer draws it (the frame's toe at
  // feet + foot); see scripts/movement-audit.mjs approach().
  const rises = range(24, 270, 18),
    dxs = range(-330, 70, 50);
  let trials = 0,
    landed = 0,
    assisted = 0;
  for (const n of IDS)
    for (const pt of platformTypes(n)) {
      const st = belowSweep(n, manifest, table, { type: pt.type, width: pt.width, rises, dxs });
      assert.deepEqual(st.lookedLandedFell, [], `L${n} ${pt.key}`);
      assert.deepEqual(st.landedShort, [], `L${n} ${pt.key}`);
      trials += st.trials;
      landed += st.shelf;
      assisted += st.assisted;
    }
  assert.ok(trials > 15000 && landed > 3000 && assisted > 700, `${trials} trials, ${landed} landed (${assisted} by the step-up)`);
  // The detector is real: the old renderer (foot offset eased over 17 ms)
  // drew the toe through tops at 240 Hz in this same sweep.
  const old = belowSweep(2, manifest, table, { type: undefined, width: 190, rises: [60], dxs: [-30, 20], ease: { hz: 240 } });
  assert.ok(old.lookedLandedFell.length > 0, "the eased renderer showed through-the-top frames");
});
test("C3: no tunnelling at the fastest falls and flights, at any frame rate or frame size", () => {
  for (const n of IDS)
    for (const dt of [1 / 30, 1 / 60, 1 / 240, 0.1, 1]) {
      // Straight down from 900 px above a 40 px wide top (a dive where the
      // level has one: about 2000 px/s, 17 px a tick, at contact).
      const s = world(n, [["floor", -400, 1600, 5000], ["thin", 800, 1000, 40]], { start: { x: 820, y: 100 } });
      s.physics = { ...s.physics, fallLimit: 1e9 };
      s.speed = 0;
      Object.assign(s.player, { grounded: false, jumps: 2, vy: 0 });
      s.launched = true;
      if (s.def.verbs.dive) dive(s);
      let fastest = 0;
      for (let t = 0; t < 4 && !s.player.grounded; t += dt) (update(s, dt), (fastest = Math.max(fastest, s.player.vy)));
      assert.equal(s.player.y, 1000, `L${n} dt ${dt}: landed on the thin top, not through it`);
      if (s.def.verbs.dive) assert.ok(fastest > 1500 || dt >= 0.1, `L${n}: ${fastest.toFixed(0)} px/s at contact`);
    }
  // A flight (497 px/s) skimming 10 px over 30 px wide tops touches down on
  // the one under it when the cape closes, however big the frames are.
  for (const dt of [1 / 30, 1 / 240, 0.5]) {
    const s = world(2, [["floor", -400, 900, 5000], ...range(0, 9, 1).map((i) => [`t${i}`, 600 + i * 70, 540, 30])]);
    s.physics = { ...s.physics, fallLimit: 1e9 };
    Object.assign(s.player, { x: 500, y: 530, grounded: false, jumps: 1, vy: 0 });
    s.launched = true;
    const drain = recorder(s);
    dash(s);
    for (let t = 0; t < 2 && !s.allEvents.some((e) => e.name === "land"); t += dt) (update(s, dt), drain());
    assert.equal(s.allEvents.find((e) => e.name === "land")?.platform, "t2", `flight at dt ${dt}`);
  }
});

/* ---------- D. Expression ---------- */
test("D1: the optional techniques measurably change outcomes", () => {
  // Super jump vs double jump apex (L2+), from a jump 2/16 in.
  const apex = (n, acts) => {
    const s = world(n, [["floor", -400, 540, 3000]]);
    s.physics = { ...s.physics, fallLimit: 1e9 };
    let min = 540;
    for (let t = 0; t < 240; t++) {
      for (const [at, a] of acts) if (t === at) ({ jump, dash, dive })[a](s);
      update(s, TICK);
      min = Math.min(min, s.player.y);
    }
    return 540 - min;
  };
  const two = Math.round((2 * 15) / 107 / TICK);
  for (const n of [2, 3, 4]) {
    const sup = apex(n, [[0, "jump"], [two, "dash"], [2 * two, "jump"]]);
    const dbl = apex(n, [[0, "jump"], [2 * two, "jump"]]);
    assert.ok(sup - dbl > 60, `L${n} super ${sup.toFixed(0)} vs double ${dbl.toFixed(0)} px`);
  }
  // Dive-cancel: a flight cut by the dive lands well short of a full one.
  const reach = (cut) => {
    const s = world(2, [["floor", -400, 540, 5000]]);
    Object.assign(s.player, { x: 300, y: 400, grounded: false, jumps: 1, vy: 0 });
    s.launched = true;
    dash(s);
    for (let t = 0; t < 400 && !s.player.grounded; t++) {
      if (cut && t === 12) dive(s);
      update(s, TICK);
    }
    return s.player.x;
  };
  assert.ok(reach(false) - reach(true) > 100, `dive-cancel lands ${(reach(false) - reach(true)).toFixed(0)} px sooner`);
  // Glide in wind: the held cape catches 40% more lift.
  const lift = (glide) => {
    const s = world(2, [["floor", -400, 900, 5000]], { updrafts: [{ id: "u", x: 0, width: 4000, top: 0, bottom: 900 }] });
    Object.assign(s.player, { x: 300, y: 700, grounded: false, jumps: 1, vy: 0 });
    update(s, 0.5, { glide });
    return 700 - s.player.y;
  };
  assert.ok(lift(true) > lift(false) * 1.3, `glide ${lift(true).toFixed(0)} vs ${lift(false).toFixed(0)} px`);
  // L1: an early second press climbs higher (Great Star 1's line).
  const l1 = (k) => apex(1, [[0, "jump"], [Math.round((k * 15) / 107 / TICK), "jump"]]);
  assert.ok(l1(3) - l1(5) > 15, `L1 early double ${l1(3).toFixed(0)} vs late ${l1(5).toFixed(0)} px`);
});
test("D2: the expert line scores at least 15% more than the main route, and the main route never needs it", () => {
  for (const n of IDS) {
    const main = run(n, "main"),
      upper = run(n, "upper");
    assert.equal(main.status, "won");
    assert.equal(main.greatBanked.length, 0, `L${n}: the main route wins without a Great Star`);
    assert.ok(upper.score >= main.score * 1.15, `L${n} upper ${upper.score} vs main ${main.score}`);
  }
});

/* ---------- E. Feedback ---------- */
test("E1/E2: every movement action has a sound and a visual on its own tick; the cape's state is drawn on Diana", async () => {
  const audio = await read("audio.mjs"),
    js = await read("game.js");
  for (const name of ["jump", "double-jump", "super-jump", "dash", "dive", "land", "lip-catch", "smash"]) assert.match(audio, new RegExp(`case "${name}": return \\[\\{ cue`), name);
  for (const name of ["jump", "double-jump", "super-jump", "land", "smash"]) assert.match(js, new RegExp(`case "${name}":`), name);
  assert.match(js, /const spent = !capeReady\(state\)/, "a spent cape tints Diana");
  for (const n of IDS) {
    const s = world(n, [["floor", -400, 540, 3000]]);
    const serial = s.eventSerial;
    jump(s);
    assert.equal(s.events.at(-1).name, "jump");
    assert.equal(s.events.at(-1).serial, serial + 1, "emitted by the press itself");
  }
});

/* ---------- F. Solarum: windows, leads ---------- */
test("F: every required action in every level has a press window of at least 120 ms (real) and a readable cue", () => {
  const minimum = { 1: 500, 2: 330, 3: 320, 4: 280 };
  for (const n of IDS) {
    const nom = nominalRun(n);
    assert.equal(nom.status, "won");
    const windows = nom.plan.map(([, a], i) => (a === "glide" || a === "unglide" ? null : timingWindow(n, nom, i))).filter(Boolean);
    const required = windows.filter((w) => w.required);
    assert.ok(required.length >= 15, `L${n}: ${required.length} required actions`);
    for (const w of required) {
      assert.ok(w.works && w.widthMs >= 120, `L${n} step ${w.i} ${w.step.join(" ")}: ${w.widthMs.toFixed(0)} ms`);
      assert.ok(w.widthMs >= minimum[n], `L${n} step ${w.i}: ${w.widthMs.toFixed(0)} ms (regression)`);
    }
    // The obstacle a grounded press answers is in view 1.5 s before the
    // latest press that works, in landscape at the level's narrowest view.
    const d = levelDef(n);
    const view = viewGeometry(Math.max(VIEW.minWidth, d.view?.minWidth ?? 0));
    for (const l of decisionLeads(n, nom, windows, view)) {
      if (l.edgeLeadS !== null) assert.ok(l.edgeLeadS >= 1.5, `L${n} step ${l.i}: edge lead ${l.edgeLeadS.toFixed(2)} s`);
      if (l.commits) assert.ok(l.landingLeadS > 0, `L${n} step ${l.i}: the landing is in view before the last press commits to it`);
    }
  }
});
test("F: human holds are enough: held jumps need at most 0.25 s of hold, taps work up to at least 0.2 s", () => {
  for (const n of IDS) {
    const nom = nominalRun(n);
    nom.plan.forEach(([, a], i) => {
      if (a !== "jump" && a !== "tap") return;
      const h = holdNeed(n, nom, i, { maxMs: 400 });
      if (h.tap) assert.ok(h.longestMs >= 200, `L${n} step ${i} tap works up to ${h.longestMs} ms`);
      else assert.ok(h.shortestMs !== null && h.shortestMs <= 250, `L${n} step ${i} needs a ${h.shortestMs} ms hold`);
    });
  }
});
