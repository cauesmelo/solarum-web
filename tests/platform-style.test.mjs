/* The meteor platform style (platform-style.mjs): an experiment that draws
 * the islands as the GDD's floating space rocks, switchable back to the
 * classic islands. Drawing only, so these tests check what a player reads:
 * the walkable top is the collider's, nothing is drawn where Diana could
 * seem to stand, only non-colliding parts move, the stone language holds,
 * and no rock reaches into a runner's air, a star or a glyph sign. Every
 * island of every level is checked, in its own level's look. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LEVELS, createLevel } from "../level.mjs";
import { outlineY } from "../geometry.mjs";
import { signRow } from "../signage.mjs";
import { MARK_TOP, paintMarks, particlesOf, undersidePoints } from "../islands.mjs";
import { LOOK_IDS } from "../backdrop.mjs";
import {
  PLATFORM_STYLES,
  DEFAULT_PLATFORM_STYLE,
  isPlatformStyle,
  platformStyleFrom,
  ROCK,
  METEOR_LOOKS,
  meteorRock,
  rockShape,
  traceRock,
  paintRock,
  paintDrift,
  driftAt,
  createRockCache,
} from "../platform-style.mjs";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const EPS = 1e-6;

/** A recording context: every call with its arguments, every style set. */
function recorder() {
  const calls = [],
    styles = [];
  return new Proxy(
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
}
/** Every (x, y) a path call names, control points included; ellipses and
 * rects as their bounding corners. */
function pointsOf([k, ...a]) {
  if (k === "moveTo" || k === "lineTo") return [[a[0], a[1]]];
  if (k === "quadraticCurveTo") return [[a[0], a[1]], [a[2], a[3]]];
  if (k === "bezierCurveTo") return [[a[0], a[1]], [a[2], a[3]], [a[4], a[5]]];
  if (k === "ellipse") return [[a[0] - a[2], a[1] - a[3]], [a[0] + a[2], a[1] + a[3]]];
  if (k === "rect") return [[a[0], a[1]], [a[0] + a[2], a[1] + a[3]]];
  return [];
}
/** Every island of every level with its level's world and look. */
function* everyIsland() {
  for (const d of LEVELS) {
    const world = createLevel(d);
    for (const q of world.platforms) yield { d, world, q, rock: meteorRock(q, { look: d.look, world }) };
  }
}

test("the switch: two styles, meteor by default, ?platforms= selects, anything else falls back", () => {
  assert.deepEqual(PLATFORM_STYLES, ["meteor", "classic"]);
  assert.equal(DEFAULT_PLATFORM_STYLE, "meteor", "the experiment is on by default (flip this constant to revert)");
  assert.equal(platformStyleFrom("?platforms=classic"), "classic");
  assert.equal(platformStyleFrom("?level=3&platforms=meteor"), "meteor");
  for (const junk of ["", "?platforms=", "?platforms=Classic", "?platforms=rocks", "?x=1"]) assert.equal(platformStyleFrom(junk), DEFAULT_PLATFORM_STYLE, junk);
  assert.equal(platformStyleFrom("", "classic"), "classic", "the fallback is the caller's");
  assert.ok(isPlatformStyle("classic") && isPlatformStyle("meteor") && !isPlatformStyle(null));
  assert.deepEqual(Object.keys(METEOR_LOOKS), LOOK_IDS, "a flavour per look");
});

test("walkable top = collider top, every island: the lip within ±2 px over exactly [x, x + width], nothing above it or past it", () => {
  let islands = 0;
  for (const { d, q, rock } of everyIsland()) {
    islands++;
    const g = recorder();
    traceRock(g, rock);
    const name = `${d.key} ${q.id}`;
    const path = g.calls.filter((c) => c[0] !== "beginPath" && c[0] !== "closePath");
    // The top runs from the first lineTo to the lineTo before the right corner's drop.
    const firstCurve = path.findIndex((c) => c[0] === "quadraticCurveTo");
    const top = path.slice(1, firstCurve - 1).map((c) => [c[1], c[2]]);
    assert.equal(top[0][0], q.x, `${name}: the top starts at the collider's left end`);
    assert.ok(Math.abs(top.at(-1)[0] - (q.x + q.width)) < EPS, `${name}: the top reaches the collider's right end`);
    for (const [x, y] of top) {
      assert.ok(Math.abs(y - q.y) <= 2, `${name}: drawn lip ${y.toFixed(2)} vs collider ${q.y} at x ${x.toFixed(1)}`);
      assert.ok(Math.abs(y - outlineY(q, x - q.x)) < EPS, `${name}: the classic contour`);
    }
    for (let i = 1; i < top.length; i++) assert.ok(top[i][0] > top[i - 1][0], `${name}: the top runs left to right`);
    // Nothing of the rock is above the lip or outside the collider's span;
    // under the lip every point leans in by at least the classic inset.
    for (const c of path)
      for (const [x, y] of pointsOf(c)) {
        assert.ok(y >= q.y - 2, `${name}: ${c[0]} at y ${y} above the top`);
        assert.ok(x >= q.x - EPS && x <= q.x + q.width + EPS, `${name}: ${c[0]} at x ${x} past the collider`);
        if (y >= q.y + 12 - EPS) assert.ok(x >= q.x + rock.inset - EPS && x <= q.x + q.width - rock.inset + EPS, `${name}: under the lip at x ${x}`);
      }
    // The sides keep leaning in with depth (0.2 px per px below the lip).
    for (const [x, y] of rock.verts) {
      const lean = rock.inset + (y - q.y - 12) * 0.2;
      assert.ok(x >= q.x + lean - EPS && x <= q.x + q.width - lean + EPS, `${name}: vertex (${x.toFixed(1)}, ${y.toFixed(1)}) tapers`);
    }
  }
  assert.ok(islands > 150, `${islands} islands`);
});

test("nothing drawn where Diana could seem to stand: details under the top, drift and rings out of the lip band", () => {
  for (const { d, q, rock } of everyIsland()) {
    const name = `${d.key} ${q.id}`;
    // paintRock: rim shadow, face edge, details, outline, Saturn's near ring.
    const g = recorder();
    paintRock(g, rock);
    for (const c of g.calls)
      for (const [x, y] of pointsOf(c)) {
        assert.ok(y >= q.y - 2, `${name}: ${c[0]} above the top`);
        if (x < q.x - EPS || x > q.x + q.width + EPS) assert.ok(y >= q.y + ROCK.lipBand, `${name}: ${c[0]} at (${x.toFixed(1)}, ${y.toFixed(1)}) beside the lip`);
      }
    // Craters, fissures, hatching, facets and seams sit under the plain top.
    for (const det of rock.details) {
      const ys = det.kind === "crater" ? [det.y - det.ry] : det.pts.map((p) => p[1]);
      for (const y of ys) assert.ok(y >= q.y + MARK_TOP - EPS, `${name}: ${det.kind} at ${y.toFixed(1)}`);
    }
    // Pebbles and the chunk, at any time: under the top, and outside the
    // span only well under it.
    for (const t of [0, 0.7, 2.3, 5.1, 11.9])
      for (const p of driftAt(rock, t)) {
        assert.ok(p.y - p.size >= q.y + ROCK.driftTop - EPS, `${name}: ${p.kind} at ${p.y.toFixed(1)}`);
        if (p.x - p.size < q.x || p.x + p.size > q.x + q.width) assert.ok(p.y - p.size >= q.y + ROCK.lipBand - EPS, `${name}: ${p.kind} beside the lip`);
        assert.ok(p.size <= 8, `${name}: a ${p.kind} too big to stand on (${p.size})`);
      }
    const back = recorder();
    paintDrift(back, rock, { t: 3 });
    for (const c of back.calls)
      for (const [x, y] of pointsOf(c)) if (x < q.x || x > q.x + q.width) assert.ok(y >= q.y + ROCK.lipBand - 1, `${name}: drift ${c[0]} beside the lip`);
  }
});

test("no bobbing: the rock (top, body, details) has no clock; only pebbles and the chunk move, and they are still under reduced motion", () => {
  assert.equal(traceRock.length >= 2 && !/\bt\b|clock|time/.test(traceRock.toString().split("{")[0]), true, "traceRock takes no time");
  assert.doesNotMatch(paintRock.toString().split(")")[0], /\bt\b/, "paintRock takes no time");
  let moved = 0;
  for (const { rock } of everyIsland()) {
    const a = driftAt(rock, 0.4),
      b = driftAt(rock, 3.9);
    moved += a.some((p, i) => p.x !== b[i].x || p.y !== b[i].y || p.angle !== b[i].angle) ? 1 : 0;
    assert.deepEqual(driftAt(rock, 0.4, true), driftAt(rock, 9.7, true), "still under reduced motion");
    for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i].y - b[i].y) <= 5.01 && Math.abs(a[i].x - b[i].x) <= 6.01, "a slow bob of a few px");
  }
  assert.ok(moved > 100, `drift moves on ${moved} rocks`);
});

test("stone language: cracked rock keeps its own marks (seams continue the edge cracks), stable rock gets craters and fissures, never seams", () => {
  const seen = { crater: 0, fissure: 0, hatch: 0, facet: 0, seam: 0 };
  for (const { d, q, rock } of everyIsland()) {
    const name = `${d.key} ${q.id}`;
    for (const det of rock.details) seen[det.kind]++;
    if (["crumble", "cascade", "lid"].includes(q.type)) {
      assert.ok(rock.details.every((x) => x.kind === "seam"), `${name}: only seams on cracked rock`);
      assert.equal(rock.drift.some((p) => p.kind === "chunk"), false, `${name}: no turning chunk under breaking stone`);
      assert.equal(rock.ring, null, `${name}: no ring on breaking stone`);
      // Seams start where game.js crackLines ends each zigzag (x + k - 2, top + 27).
      for (const s of rock.details) {
        const k = s.pts[0][0] - q.x + 2;
        assert.ok(k >= 26 && (k - 26) % 58 === 0 && Math.abs(s.pts[0][1] - (q.y + 27)) < EPS, `${name}: seam at ${k}`);
      }
      if (q.type === "lid") assert.equal(rock.details.length, 0, `${name}: the lid keeps its star break alone`);
    } else assert.ok(rock.details.every((x) => x.kind !== "seam"), `${name}: no seams on stable rock`);
  }
  for (const [k, n] of Object.entries(seen)) assert.ok(n > 0, `${k} drawn somewhere (${n})`);
  // The language itself stays in game.js on the same top, for both styles.
  return read("game.js").then((js) => {
    assert.match(js, /if \(q\.type === "crumble" \|\| q\.type === "cascade"\) crackLines\(q, x \+ jitter, w, q\.y, false\);/);
    assert.match(js, /else if \(q\.type === "lid"\) drawLid\(q, x, w\);/);
    assert.match(js, /\/\/ Optional stable stone: a dotted rim and a small star tick, never grey\./);
    assert.match(js, /\/\/ Grey means one thing only: this stone is breaking right now\./);
  });
});

test("clearance: no rock reaches into a lower stone's running air, over a star under it, or over a glyph sign", () => {
  for (const { d, world, q, rock } of everyIsland()) {
    const name = `${d.key} ${q.id}`,
      depth = rock.bottom - q.y;
    for (const o of world.platforms) {
      if (o === q || o.y <= q.y || o.x >= q.x + q.width || o.x + o.width <= q.x) continue;
      const gap = o.y - q.y;
      if (gap >= ROCK.stackedGap) assert.ok(depth <= Math.max(ROCK.minDepth, gap - ROCK.headroom) + EPS, `${name}: ${depth.toFixed(1)} deep over ${o.id} ${gap.toFixed(1)} below`);
    }
    for (const s of world.pickups)
      if (s.y > q.y && s.x > q.x - 14 && s.x < q.x + q.width + 14) assert.ok(depth <= Math.max(ROCK.minDepth, s.y - q.y - ROCK.starClear) + EPS, `${name}: over star ${s.id}`);
    // tests/signage.test.mjs T2 (P2), with the rock's underside.
    for (const p of world.prompts)
      for (const scale of [1, 1.8]) {
        const R = signRow(p, scale).rect;
        if (R.right < q.x || R.left > q.x + q.width) continue;
        const under = rock.points.filter((u) => u.x >= R.left - 20 && u.x <= R.right + 20);
        const bottom = Math.max(q.y + 24, ...under.map((u) => u.y));
        assert.ok(!(R.bottom > q.y - 8 && R.top < bottom), `${name}: over sign ${p.id} (×${scale})`);
      }
  }
});

test("variety and stability: hop rocks, boulders and slabs; each island always the same rock; flavours differ by look", () => {
  const kinds = new Set();
  for (const { d, world, q, rock } of everyIsland()) {
    kinds.add(rock.kind);
    assert.deepEqual(meteorRock(q, { look: d.look, world }), rock, `${d.key} ${q.id} is seeded`);
    assert.equal(rock.kind, q.width < ROCK.hopMax ? "hop" : q.width > ROCK.slabMin ? "slab" : "boulder");
  }
  assert.deepEqual([...kinds].sort(), ["boulder", "hop", "slab"]);
  // The same island in two looks is a different rock (flavour), same top.
  const q = { id: "probe", x: 1000, y: 400, width: 300, phase: 7 };
  const rocks = LOOK_IDS.map((look) => JSON.stringify(meteorRock(q, { look }).verts));
  assert.equal(new Set(rocks).size, LOOK_IDS.length, "every look its own rocks");
  // The renderer's cache returns the same rock and rebuilds on a new look.
  const cache = createRockCache(),
    a = cache.get(q, { levelKey: "x", look: "home", world: {} });
  assert.equal(cache.get(q, { levelKey: "x", look: "home", world: {} }), a);
  assert.notEqual(cache.get(q, { levelKey: "x", look: "mars", world: {} }), a);
});

test("islands.mjs marks and particles on rock shapes keep their rules (tops plain, under the underside)", () => {
  for (const { d, q, rock } of everyIsland()) {
    if (!d.look) continue;
    const shape = rockShape(rock),
      name = `${d.key} ${q.id}`;
    const inside = recorder();
    paintMarks(inside, d.look, shape, { t: 1, part: "inside" });
    for (const c of inside.calls) for (const [, y] of pointsOf(c)) if (c[0] !== "rect") assert.ok(y >= q.y + MARK_TOP - 3, `${name}: mark ${c[0]} at ${y}`);
    const lip = Math.min(...undersidePoints(shape).map((p) => p.y));
    for (const p of particlesOf(d.look, shape, 2.5)) assert.ok(p.y >= q.y + MARK_TOP && p.y >= lip, `${name}: particle at ${p.y}`);
  }
});

test("game.js hook: one style switch, the classic path untouched, the QA setter, rocks skip the classic ticks", async () => {
  const js = await read("game.js");
  assert.match(js, /import \{[^}]*platformStyleFrom[^}]*\} from "\.\/platform-style\.mjs";/);
  assert.match(js, /let platformStyle = platformStyleFrom\(location\.search\);/);
  assert.match(js, /function islandPath\(q, x, w, thick, jitter = 0\) \{\n {2}if \(platformStyle === "meteor"\) return meteorPath\(q, x, jitter\);\n {2}\/\/ The shape is islands\.mjs islandShape/);
  assert.match(js, /setPlatformStyle: \(style\) =>/);
  assert.match(js, /getPlatformStyle: \(\) => platformStyle/);
  assert.match(js, /if \(platformStyle === "meteor"\) return;\n {2}ctx\.fillStyle = INK;/);
  // The style never reaches the simulation.
  for (const f of ["model.mjs", "level.mjs"]) assert.doesNotMatch(await read(f), /platformStyle|platform-style/, f);
});
