/* Scripted world moments, decor, II's asteroid eye and the per-level island
 * marks and particles (moments.mjs, islands.mjs; RESEARCH_PROGRESSION 2.1,
 * 4.4, 4.5 and 5): every kind a level authors has its art, timelines land
 * where the level says, the eye stays inside the GET's quiet bar, and the
 * marks keep the walkable tops plain and the cracked stone's language. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LEVELS } from "../level.mjs";
import { SIXTEENTH } from "../score.mjs";
import { LOOK_IDS, TOKENS } from "../backdrop.mjs";
import { SIXTEENTH_SIM, MOMENT_KINDS, DECOR_KINDS, scriptedMoments, FALL, fallAt, flashAt, asteroidAt, plumeAt, farPlace, eyeAt, eyeTimes, eyeSeconds, rideAt, slopeAt } from "../moments.mjs";
import { ISLAND_LOOKS, MARK_TOP, islandShape, undersidePoints, markable, paintMarks, particlesOf, paintParticles } from "../islands.mjs";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");

test("every authored moment and decor kind has its art (unknown kinds fall back, reported)", (t) => {
  assert.equal(SIXTEENTH_SIM, SIXTEENTH, "the model's sixteenth (score.mjs)");
  const seen = { moments: new Set(), decor: new Set() };
  for (const d of LEVELS) {
    for (const m of d.moments ?? []) seen.moments.add(m.kind);
    for (const q of d.decor ?? []) seen.decor.add(q.kind);
    const list = scriptedMoments(d);
    for (const m of list) assert.ok(Math.abs(m.at - m.k * SIXTEENTH) < 1e-12, `${d.key} ${m.id}`);
    // Falls aim at something that exists: a pickup (star or chain star) or a GET.
    const ids = new Set([...d.stars.map(([id]) => id), ...d.chains.flatMap((c) => c.stars.map((_, i) => `${c.id}-${i}`)), ...(d.gets ?? []).map((g) => g.id)]);
    for (const m of list) if (m.kind === "fall") assert.ok(ids.has(m.target), `${d.key}: fall ${m.id} lands on ${m.target}`);
    // Helpers aim at a GET or a wind column (or nothing: just ahead of her).
    const helpers = new Set([...(d.gets ?? []).map((g) => g.id), ...d.updrafts.map((u) => u.id)]);
    for (const m of list) if (m.kind === "helper" && m.target) assert.ok(helpers.has(m.target), `${d.key}: helper ${m.id} -> ${m.target}`);
  }
  const unknown = [...seen.moments].filter((k) => !MOMENT_KINDS[k]).concat([...seen.decor].filter((k) => !DECOR_KINDS[k]));
  // A builder's new kind draws the generic burst until its art lands: say so, do not fail.
  if (unknown.length) t.diagnostic(`kinds drawn by the fallback burst: ${unknown.join(", ")}`);
  for (const k of ["fall", "flash", "crash", "helper", "ripple", "necklace"]) assert.ok(MOMENT_KINDS[k], k);
  for (const k of ["cluster", "plume", "helper", "glint", "asteroid"]) assert.ok(DECOR_KINDS[k], k);
});

test("I's shower: each star falls from the upper left and lands on its moment; the flash, the asteroid and the plume", () => {
  // Falling: from up and to the left (heading right, the signal's way), it reaches the target exactly at 0.
  const before = fallAt(-FALL.lead * 0.5);
  assert.equal(before.phase, "fall");
  assert.ok(before.dx < 0 && before.dy < 0, "it comes from the upper left");
  assert.equal(fallAt(-FALL.lead - 0.01), null, "not drawn before its lead");
  const at = fallAt(0);
  assert.equal(at.phase, "land");
  assert.equal(at.dx, 0);
  assert.equal(at.dy, 0);
  assert.equal(fallAt(FALL.land), null, "the landing ring ends");
  const soft = fallAt(-0.05, { soft: true }),
    hard = fallAt(-0.05);
  assert.ok(Math.hypot(soft.dx, soft.dy) < Math.hypot(hard.dx, hard.dy), "the GET's star slows to a rest");
  // The shower lands every star at least 2.2 s ahead of Diana (brief §4.5 I).
  const I = LEVELS.find((d) => d.key === "waking"),
    lead = (14 * SIXTEENTH) / I.clock;
  assert.ok(lead >= 2.2, `${lead.toFixed(2)} s`);
  // The flash: 120 ms, or a gentler 400 ms fade under reduced motion; never brighter than 0.32.
  assert.ok(flashAt(0) <= 0.32 && flashAt(0.1) > 0 && flashAt(0.121) === 0);
  assert.ok(flashAt(0.3, true) > 0 && flashAt(0.4, true) === 0 && flashAt(0, true) <= 0.2);
  // The asteroid: from where the star was to the plume's base exactly on the crash, speeding up.
  const crash = scriptedMoments(I).find((m) => m.kind === "crash"),
    flash = scriptedMoments(I).find((m) => m.kind === "flash"),
    span = (crash.at - flash.at) / I.clock;
  let last = -1;
  for (let t = 0.1; t <= span; t += span / 50) {
    const a = asteroidAt(t, span);
    assert.ok(a && a.e >= last, `monotonic at ${t}`);
    last = a.e;
  }
  assert.ok(Math.abs(asteroidAt(span, span).e - 1) < 1e-9);
  assert.equal(asteroidAt(span + 0.01, span), null);
  // One beat of silence before the boom: the crash sits on a downbeat at least a beat after the flash.
  assert.equal(crash.k % 16, 0, "the boom on a downbeat");
  assert.ok(crash.k - flash.k >= 4);
  // The plume rises over 1.6 s and stays; it is placed between Diana and the view's right edge, growing as she nears.
  assert.equal(plumeAt(-0.1), null);
  assert.ok(plumeAt(1.6).rise > 0.999 && plumeAt(60).rise > 0.999 && plumeAt(0.6).impact === 0);
  let prev = { x: Infinity, scale: 0 };
  for (const d of [5000, 3400, 2000, 984, 400, 0]) {
    const f = farPlace(d, 1012);
    assert.ok(f.x <= prev.x && f.scale >= prev.scale, `nearer at ${d}`);
    assert.ok(f.x >= 1012 * 0.23 && f.x <= 1012 * 0.78 && f.scale <= 1);
    prev = f;
  }
});

test("II's asteroid eye: opens, a beat, the light, the cape; within 1.5 s and inside the GET's quiet bar at every tempo", () => {
  for (const bpm of [88, 94, 100, 107, 112, 118, 123, 128]) {
    const beat = 60 / bpm,
      T = eyeTimes(beat);
    assert.ok(eyeSeconds(beat) <= 1.5 + 1e-9, `${bpm}: ${eyeSeconds(beat)}`);
    assert.ok(eyeSeconds(beat) <= 4 * beat, "inside one bar: no required input can fall in it");
    assert.ok(T.light - T.open >= Math.min(beat, 0.64) - 1e-9, "a beat between the open eye and the light");
    assert.equal(eyeAt(-0.1, beat).open, 0, "closed before the GET");
    assert.ok(eyeAt(T.open, beat).open > 0.999, "open");
    assert.ok(eyeAt(T.open + 0.2, beat).earth > 0.9, "the small blue world in its pupil");
    assert.equal(eyeAt(T.light - 0.01, beat).cape, 0, "the cape waits for the light");
    assert.ok(eyeAt((T.light + T.cape) / 2, beat).light > 0, "the light travels");
    assert.ok(Math.abs(eyeAt(T.end - 1e-9, beat).cape - 1) < 1e-6, "the cape has settled when it ends");
    assert.ok(eyeAt(T.end, beat).done && eyeAt(T.end, beat).open < 1e-9, "and the eye has closed");
  }
  // II has its cape GET (the eye's trigger) and nothing required in its bar (levels.test checks the spacing).
  const II = LEVELS.find((d) => d.key === "gift");
  assert.deepEqual(II.gets.map((g) => g.verb), ["cape"]);
});

test("helpers: VI's rides its wind column up and out within 1.6 s; III's drifts down its slope after the loop", () => {
  let up = 0;
  for (let t = 0; t < 1; t += 0.05) {
    const r = rideAt(t, 180);
    assert.ok(r.dy <= up + 1e-9, "it only rises in the column");
    up = r.dy;
  }
  assert.ok(Math.abs(up + 180) < 20);
  assert.ok(rideAt(1.3, 180).dx > 0, "out of the top to the right");
  assert.equal(rideAt(1.6, 180), null);
  const bar = 2.4;
  assert.equal(slopeAt(0.2, bar).loop, true);
  const s1 = slopeAt(0.8, bar),
    s2 = slopeAt(1.2, bar);
  assert.ok(!s1.loop && s2.u > s1.u, "down the slope");
  assert.ok(slopeAt(bar, bar).alpha < 0.05, "gone within the bar");
  // VI's helper rides a breeze two bars before Diana's jump into it (she sees it first).
  const VI = LEVELS.find((d) => d.key === "borrowed-wind");
  const ride = scriptedMoments(VI).find((m) => m.kind === "helper");
  const column = VI.updrafts.find((u) => u.id === ride.target);
  const reach = (column.x - VI.level.startX) / VI.level.speed; // simulation s until she is under it
  assert.ok(reach - ride.at > (1.6 * VI.clock) * 0.9, "the ride is over (nearly) before she gets there");
});

/** A recording context: every call with its numeric arguments, every style. */
function recorder() {
  const calls = [],
    styles = [];
  const ctx = new Proxy(
    {},
    {
      get(_, k) {
        if (k === "calls") return calls;
        if (k === "styles") return styles;
        return (...a) => calls.push([k, ...a]);
      },
      set(_, k, v) {
        if (k === "strokeStyle" || k === "fillStyle") styles.push(v);
        return true;
      },
    },
  );
  return ctx;
}
/** The lowest y each drawing call can reach. */
function topOf([k, ...a]) {
  if (["moveTo", "lineTo"].includes(k)) return a[1];
  if (k === "quadraticCurveTo") return Math.min(a[1], a[3]);
  if (k === "arc") return a[1] - a[2];
  if (k === "ellipse") return a[1] - a[3];
  if (k === "rect") return a[1];
  return Infinity;
}
const alphaOf = (style) => Number(style.match(/,([\d.]+)\)$/)?.[1]);
const tokenOf = (style) => Object.entries(TOKENS).find(([, rgb]) => style.startsWith(`rgba(${rgb.join(",")},`))?.[0];

test("island marks: one per look, tops stay plain, cracked stone unmarked, ink hairlines only, still under reduced motion", () => {
  assert.deepEqual(Object.keys(ISLAND_LOOKS), LOOK_IDS);
  const kinds = Object.values(ISLAND_LOOKS).map((l) => l.marks).filter(Boolean);
  assert.equal(new Set(kinds).size, kinds.length, "every look its own mark");
  for (const type of ["crumble", "lid", "cascade"]) assert.equal(markable({ type }), false, type);
  assert.equal(markable({}), true);
  for (const look of LOOK_IDS)
    for (const [w, thick, phase] of [[120, 30, 3], [300, 64, 7], [640, 64, 11], [1300, 64, 23]]) {
      const q = { x: 1000, y: 400, width: w, phase },
        shape = islandShape(q, q.x, w, thick);
      for (const reduced of [false, true]) {
        const frame = (t, part) => {
          const g = recorder();
          paintMarks(g, look, shape, { t, reduced, part });
          return g;
        };
        const inside = frame(1, "inside"),
          under = frame(1, "under");
        for (const c of inside.calls) assert.ok(topOf(c) >= q.y + MARK_TOP - 1e-6, `${look} ${w}: ${c[0]} at ${topOf(c)} (top ${q.y})`);
        for (const c of under.calls) assert.ok(topOf(c) >= q.y + 12, `${look} ${w}: under-marks hang below the lip`);
        for (const s of inside.styles) assert.ok(tokenOf(s) === "ink" && alphaOf(s) <= 0.35, `${look}: ${s}`);
        for (const s of under.styles) assert.equal(tokenOf(s), "paper", `${look}: nubs are the island's paper`);
        if (reduced) assert.deepEqual(frame(1, "inside").calls, frame(7.3, "inside").calls, `${look} still under reduced motion`);
      }
    }
  // game.js draws the silhouette from the same shape, and only stable stone carries marks.
  return read("game.js").then((js) => {
    assert.match(js, /const shape = islandShape\(q, x, w, thick, jitter\)/);
    assert.match(js, /if \(islandLook && markable\(q\)\) drawIslandMarks\(shape\)/);
  });
});

test("island particles: under the undersides, faint paper, a pure function of time, still under reduced motion", () => {
  for (const look of LOOK_IDS) {
    const kind = ISLAND_LOOKS[look].particles;
    const q = { x: 2000, y: 300, width: 520, phase: 5 },
      shape = islandShape(q, q.x, q.width, 64);
    const lip = Math.min(...undersidePoints(shape).map((p) => p.y));
    for (let t = 0; t < 12; t += 0.37) {
      const list = particlesOf(look, shape, t);
      if (!kind) assert.equal(list.length, 0, `${look} has none`);
      for (const p of list) {
        assert.ok(p.y >= q.y + MARK_TOP && p.y >= lip, `${look}: ${p.kind} at ${p.y} is under the island`);
        assert.ok(p.alpha >= 0 && p.alpha <= 0.3, `${look}: alpha ${p.alpha}`);
      }
      assert.deepEqual(particlesOf(look, shape, t), list, "pure");
    }
    assert.deepEqual(particlesOf(look, shape, 1, true), particlesOf(look, shape, 9, true), `${look}: still under reduced motion`);
    const g = recorder();
    paintParticles(g, look, shape, { t: 2 });
    for (const s of g.styles) assert.equal(tokenOf(s), "paper");
  }
  // Small islands carry none (a stepping stone stays clean).
  assert.equal(particlesOf("neptune", islandShape({ x: 0, y: 0, width: 60, phase: 1 }, 0, 60, 30), 1).length, 0);
});
