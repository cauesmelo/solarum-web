/** Platform styles (an experiment the owner asked for, 2026-11-10): the GDD's
 * first concept drew Diana's platforms as meteors and space rocks she hops
 * across (GDD p. 9, the boulder panel by the ringed planet). "meteor" draws
 * each island as a floating rock; "classic" keeps revision seven's islands
 * exactly. The style is drawing only: colliders, the model and the levels
 * never read it, so switching is instant and lossless.
 *
 * How to revert: flip DEFAULT_PLATFORM_STYLE to "classic" (one line), or open
 * the game with ?platforms=classic, or call __game.setPlatformStyle("classic").
 *
 * Readability rules (each is tested in tests/platform-style.test.mjs):
 * - The walkable top is the classic top, point for point: it follows the
 *   collider (geometry.mjs outlineY, within 1.5 px) from x to x + width
 *   exactly, then the same lip tapers 9-12 px inward. Below the lip every
 *   point of the rock stays inside the collider's x span and leans further
 *   in with depth, so a near miss never looks like a landing.
 * - Nothing is drawn above the top, and nothing outside the collider's span
 *   comes within LIP_BAND px under it: pebbles, the turning chunk and
 *   Saturn's dust ring float below where Diana could seem to stand.
 * - The top never moves. Only non-colliding parts drift (pebbles, the chunk
 *   turning under big rocks, the look's dust in islands.mjs), and under
 *   reduced motion they are still.
 * - Stone language is unchanged: stable tops are plain paper; the optional
 *   stone's dotted rim and star tick, the crumbling and cascade stones'
 *   zigzag edge cracks, the lid's star-shaped break and the grey of a stone
 *   breaking now are drawn by game.js on the same top. Craters and hairline
 *   fissures live only on stable rock, at least MARK_TOP px under the top;
 *   cracked rock gets seams that continue its edge cracks down to the
 *   underside instead (it will split there).
 * - A rock never reaches into the running air of a stone under it, over a
 *   star under it, or over a glyph sign (clearance()).
 *
 * Units: world px and seconds of real time. Pure data and painters on a
 * passed-in context (no DOM), so this loads in node. */
import { TOKENS } from "./backdrop.mjs";
import { hash, MARK_TOP } from "./islands.mjs";
import { outlineY } from "./geometry.mjs";
import { signRow } from "./signage.mjs";

/* ---------- the switch ---------- */
export const PLATFORM_STYLES = Object.freeze(["meteor", "classic"]);
/** The experiment's default. Set to "classic" to revert in one line. */
export const DEFAULT_PLATFORM_STYLE = "meteor";
export const isPlatformStyle = (v) => PLATFORM_STYLES.includes(v);
/** The style a page asks for: ?platforms=classic|meteor, else the default. */
export function platformStyleFrom(search = "", fallback = DEFAULT_PLATFORM_STYLE) {
  let v = null;
  try {
    v = new URLSearchParams(search).get("platforms");
  } catch {
    v = null;
  }
  return isPlatformStyle(v) ? v : fallback;
}

/* ---------- rock geometry ---------- */
export const ROCK = Object.freeze({
  // Size classes by collider width: small hop rocks, boulders, long slabs.
  hopMax: 150,
  slabMin: 520,
  // The shallowest a rock is drawn (the lip alone is 12 px).
  minDepth: 28,
  // A stone under a rock keeps this much air over its top (Diana's 58 px
  // drawn body plus 12), unless it is stacked closer than `stackedGap`,
  // where nobody runs between the two and the lower stone is drawn over.
  headroom: 70,
  stackedGap: 100,
  // Clear air between a rock's underside and a star or a glyph sign under it.
  starClear: 18,
  signClear: 10,
  // Nothing drawn outside the collider's x span comes within this many px
  // under its top; nothing at all comes within 20 px except the rock itself.
  lipBand: 24,
  driftTop: 20,
});

const rgba = (token, a) => `rgba(${TOKENS[token].join(",")},${a})`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const CRACKED = new Set(["crumble", "lid", "cascade"]);

/** Per-look rock flavour, in the same line language as islands.mjs's marks
 * and backdrop.mjs's bodies (still monochrome):
 * round: how much each facet corner is rounded (0.5 = fully smooth);
 * jag: how far facets bite inward; ex: the bowl's squareness (chunkier
 * when higher); craters, fissures, pebbles: amounts (1 = home's);
 * chunk: a small fragment turning under big rocks; ice: facet hairlines
 * (Neptune, Uranus); tall: deeper, tipped rocks (Uranus); ring: Saturn's
 * dust ring round big rocks; terrace: Jupiter's stepped undersides;
 * shade: the Moon's shaded crater floors. */
export const METEOR_LOOKS = Object.freeze({
  home: Object.freeze({ round: 0.3, jag: 0.2, ex: 1, craters: 1, fissures: 1, pebbles: 1, chunk: true }),
  pluto: Object.freeze({ round: 0.22, jag: 0.22, ex: 1, craters: 0.6, fissures: 0.4, pebbles: 0.35, chunk: false }),
  neptune: Object.freeze({ round: 0.14, jag: 0.14, ex: 0.9, craters: 0.35, fissures: 0, pebbles: 0.8, chunk: true, ice: true }),
  uranus: Object.freeze({ round: 0.12, jag: 0.16, ex: 0.85, craters: 0.35, fissures: 0, pebbles: 0.8, chunk: true, ice: true, tall: true }),
  saturn: Object.freeze({ round: 0.32, jag: 0.18, ex: 1, craters: 0.6, fissures: 0.5, pebbles: 1, chunk: false, ring: true }),
  jupiter: Object.freeze({ round: 0.2, jag: 0.12, ex: 1.15, craters: 0.5, fissures: 0.5, pebbles: 1, chunk: true, terrace: true }),
  mars: Object.freeze({ round: 0.08, jag: 0.3, ex: 1, craters: 0.9, fissures: 1, pebbles: 1.25, chunk: true }),
  "moon-earth": Object.freeze({ round: 0.38, jag: 0.14, ex: 1, craters: 2, fissures: 0.3, pebbles: 0.7, chunk: true, shade: true }),
});
export const flavourOf = (look) => METEOR_LOOKS[look] ?? METEOR_LOOKS.home;

/** How deep the rock over `q` may reach: the running air of stones under it,
 * the stars under it and the glyph signs under it (at their largest layout
 * scale) stay clear. Infinity when nothing is under it. */
export function clearance(q, world = {}) {
  const x0 = q.x,
    x1 = q.x + q.width;
  let cap = Infinity;
  for (const o of world.platforms ?? []) {
    if (o === q || o.id === q.id || o.y <= q.y || o.x >= x1 || o.x + o.width <= x0) continue;
    const gap = o.y - q.y;
    if (gap >= ROCK.stackedGap) cap = Math.min(cap, gap - ROCK.headroom);
  }
  for (const s of world.pickups ?? []) if (s.y > q.y && s.x > x0 - 14 && s.x < x1 + 14) cap = Math.min(cap, s.y - q.y - ROCK.starClear);
  for (const p of world.prompts ?? []) {
    const R = signRow(p, 1.8).rect;
    if (R.top > q.y && R.left < x1 + 20 && R.right > x0 - 20) cap = Math.min(cap, R.top - q.y - ROCK.signClear);
  }
  return cap;
}

/** A seeded number stream for one island (same island, same rock). */
function stream(seed) {
  let k = 0;
  return () => hash(seed * 7.13 + ++k * 1.618 + 0.5);
}
/** Cubic chain from a polygon, each corner rounded by `r` of its edges. */
function roundedChain(pts, r) {
  const curves = [];
  let cur = pts[0];
  const line = (p) => {
    curves.push([cur, lerp(cur, p, 1 / 3), lerp(cur, p, 2 / 3), p]);
    cur = p;
  };
  const quad = (c, p) => {
    curves.push([cur, lerp(cur, c, 2 / 3), lerp(p, c, 2 / 3), p]);
    cur = p;
  };
  for (let i = 1; i < pts.length - 1; i++) {
    const V = pts[i];
    line(lerp(V, pts[i - 1], r));
    quad(V, lerp(V, pts[i + 1], r));
  }
  line(pts.at(-1));
  return curves;
}
const cubic = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
function chainPoints(curves, n = 8) {
  const out = [];
  for (const [p0, c1, c2, p3] of curves)
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push({ x: cubic(p0[0], c1[0], c2[0], p3[0], t), y: cubic(p0[1], c1[1], c2[1], p3[1], t) });
    }
  return out;
}
/** The underside's y at world x (the chain sampled), or the lip if outside. */
function bottomAt(rock, x) {
  const pts = rock.points;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    if ((x <= a.x && x >= b.x) || (x >= a.x && x <= b.x)) {
      const t = a.x === b.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return rock.y + 12;
}

/** The rock drawn for island `q` in a look, as data. `world` holds the
 * level's platforms, pickups and prompts (for clearance()). Everything is a
 * pure function of the island, the look and the world: stable per island. */
export function meteorRock(q, { look = null, world = {} } = {}) {
  const x = q.x,
    y = q.y,
    w = q.width,
    seed = Number.isFinite(q.phase) ? q.phase : 0,
    L = flavourOf(look),
    R = stream(seed + (q.route === "high" ? 0.37 : 0)),
    kind = w < ROCK.hopMax ? "hop" : w > ROCK.slabMin ? "slab" : "boulder",
    cracked = CRACKED.has(q.type),
    inset = Math.min(10, w * 0.06);
  // Depth by size class: hop rocks are round and deep for their width,
  // boulders chunky, slabs long and comparatively shallow with lumps.
  let depth = kind === "hop" ? clamp(w * (0.5 + 0.3 * R()), 34, 92) : kind === "boulder" ? clamp(46 + w * 0.13 + 36 * R(), 60, 128) : 88 + 40 * R();
  if (L.tall) depth *= 1.15;
  if (q.route === "high" && q.y < 600) depth *= 0.75;
  if (q.type === "lid") depth *= 0.8;
  const cap = clearance(q, world);
  const room = cap - depth;
  depth = Math.max(ROCK.minDepth, Math.min(depth, cap));
  // The underside polygon, right lip to left lip, on a superellipse round
  // the top's centre: near-vertical sides that lean in, a broad round belly
  // (squarer for bigger rocks), the keel deeper on one side, slabs lumpy
  // like several boulders fused, each vertex bitten in by up to `jag`.
  const n = kind === "hop" ? 5 + Math.floor(R() * 2) : kind === "boulder" ? 6 + Math.floor(R() * 3) : Math.max(12, Math.round(w / 48));
  const e = 2 / ({ hop: 2.0, boulder: 2.3, slab: 3.0 }[kind] * L.ex),
    keel = (R() - 0.5) * 1.2,
    // Slabs: several boulder bellies fused, about one per 260 px.
    lumps = clamp(Math.round(w / 260), 2, 7) + (R() > 0.5 ? 0.5 : 0),
    lumpPhase = R() * Math.PI * 2,
    cx = x + w / 2,
    half = w / 2 - inset;
  const pts = [[x + w - inset, y + 12]];
  for (let i = 1; i < n; i++) {
    const s = clamp((i + (R() - 0.5) * 0.7) / n, 0.03, 0.97),
      c = Math.cos(Math.PI * s),
      sn = Math.sin(Math.PI * s);
    let X = Math.sign(c) * Math.abs(c) ** e,
      Y = Math.abs(sn) ** e;
    if (kind === "slab") {
      X = X * 0.35 + (1 - 2 * s) * 0.65;
      Y *= 0.5 + 0.5 * Math.abs(Math.sin(Math.PI * s * lumps + lumpPhase)) ** 0.6;
    }
    Y *= 1 - 0.42 * clamp(keel * X * 2, 0, 1);
    if (L.terrace && kind !== "hop") Y = Math.max(0.25, Math.round(Y * 3) / 3);
    // Alternate vertices bite deeper, so facets read as planes, not a bowl.
    Y *= 1 - L.jag * (i % 2 ? 0.5 + 0.5 * R() : 0.4 * R());
    const py = y + 12 + (depth - 12) * Y;
    // Under the lip the sides lean inward: at least the lip's inset, plus
    // 0.2 px per px of depth (the rock tapers under its top).
    const lean = inset + (py - y - 12) * 0.2;
    const px = clamp(cx + half * X * (1 - L.jag * 0.4 * R()), x + lean, x + w - lean);
    pts.push([px, py]);
  }
  pts.push([x + inset, y + 12]);
  const curves = roundedChain(pts, L.round);
  const rock = { q, look, kind, cracked, x, y, w, depth, inset, room, seed, verts: pts, curves, points: chainPoints(curves) };
  rock.bottom = Math.max(...rock.points.map((v) => v.y));
  rock.keelX = rock.points.find((v) => v.y === rock.bottom).x;
  rock.details = cracked ? seamsOf(rock, R) : detailsOf(rock, L, R);
  rock.drift = driftOf(rock, L, R);
  rock.ring = L.ring && kind !== "hop" && !cracked ? ringOf(rock) : null;
  return rock;
}
/** The islands.mjs-compatible shape of a rock (marks and particles read
 * x, y, w, depth, seed and the underside curves), offset by a shake. */
export function rockShape(rock, dx = 0, dy = 0, thick = 64) {
  const curves = dx || dy ? rock.curves.map((c) => c.map(([a, b]) => [a + dx, b + dy])) : rock.curves;
  return { q: rock.q, x: rock.x + dx, y: rock.y + dy, w: rock.w, thick, jitter: dy, depth: rock.bottom - rock.y - 12, inset: rock.inset, curves, seed: rock.seed, rock };
}

/** Trace the rock's silhouette as the current path (any context or a
 * Path2D). The top and lips are the classic island's, with the top carried
 * to the collider's right end exactly; the underside is the rock's. */
export function traceRock(g, rock, dx = 0, dy = 0, begin = true) {
  const { q, x, y, w, inset } = rock;
  if (begin) g.beginPath?.();
  g.moveTo(x + dx, y + 3 + dy);
  for (let k = 0; k < w; k += 20) g.lineTo(x + k + dx, outlineY(q, k) + dy);
  g.lineTo(x + w + dx, outlineY(q, w) + dy);
  g.lineTo(x + w + dx, y + 3 + dy);
  g.quadraticCurveTo(x + w - inset * 0.4 + dx, y + 9 + dy, x + w - inset + dx, y + 12 + dy);
  for (const [, c1, c2, e] of rock.curves) g.bezierCurveTo(c1[0] + dx, c1[1] + dy, c2[0] + dx, c2[1] + dy, e[0] + dx, e[1] + dy);
  g.quadraticCurveTo(x + inset * 0.4 + dx, y + 9 + dy, x + dx, y + 3 + dy);
  g.closePath();
}

/* ---------- details (inside the silhouette) ---------- */
/** Stable rock: craters, hairline fissures from the underside, Neptune's
 * and Uranus's ice facets. All at least MARK_TOP px under the top. */
function detailsOf(rock, L, R) {
  const { x, y, w, kind } = rock,
    out = [];
  const room = (cx) => bottomAt(rock, cx) - y;
  // Craters: a rim arc and an inner arc, on the face under the top.
  const nCraters = Math.round({ hop: 0.8, boulder: 2, slab: 2 + w / 300 }[kind] * L.craters * (0.6 + 0.8 * R()));
  for (let i = 0, tries = 0; i < nCraters && tries < nCraters * 4; tries++) {
    const rx = (6 + 8 * R()) * (L.shade ? 1.3 : 1) * (kind === "hop" ? 0.7 : 1),
      ry = rx * 0.45,
      cx = x + w * (0.14 + 0.72 * R()),
      d = room(cx),
      lo = MARK_TOP + 4 + ry,
      hi = d - ry - 10;
    if (hi < lo || cx - rx < x + 8 || cx + rx > x + w - 8) continue;
    const cy = y + lo + (hi - lo) * R() * 0.7;
    if (out.some((c) => c.kind === "crater" && Math.hypot(c.x - cx, (c.y - cy) * 2) < c.rx + rx + 6)) continue;
    out.push({ kind: "crater", x: cx, y: cy, rx, ry, shade: !!L.shade });
    i++;
  }
  // Fissures: thin ink lines climbing from the underside, never near the top.
  const nFiss = kind === "hop" ? 0 : Math.round(L.fissures * (kind === "slab" ? 2 : 1) * R() * 1.4);
  for (let i = 0; i < nFiss; i++) {
    const sx = x + w * (0.22 + 0.56 * R()),
      sy = bottomAt(rock, sx) - 1,
      stop = y + MARK_TOP + 12,
      pts = [[sx, sy]];
    let px = sx,
      py = sy;
    for (let k = 0; k < 4 && py > stop + 6; k++) {
      px += (R() - 0.5) * 9;
      py = Math.max(stop, py - 6 - R() * 7);
      pts.push([px, py]);
    }
    if (pts.length > 2) out.push({ kind: "fissure", pts, branch: [pts[1], [pts[1][0] + (R() > 0.5 ? 5 : -5), pts[1][1] - 4]] });
  }
  // Shadow hatching: a few short parallel strokes up from the lower right of
  // the underside (light from the upper left), the GDD's hand-shaded rocks.
  // Mars's dense hatch mark stays the darker, denser one.
  if (kind !== "hop" || rock.bottom - y > 44) {
    const pts = rock.points,
      from = Math.floor(pts.length * 0.12),
      to = Math.floor(pts.length * (0.38 + 0.12 * R())),
      step = Math.max(1, Math.round((to - from) / (kind === "slab" ? 9 : 6)));
    for (let i = from; i < to; i += step) {
      const v = pts[i],
        len = 6 + 5 * R();
      const end = [v.x - len * 0.48, v.y - 2 - len * 0.88];
      if (end[1] < y + MARK_TOP + 6 || v.y < y + MARK_TOP + 14) continue;
      out.push({ kind: "hatch", pts: [[v.x - 0.6, v.y - 2], end] });
    }
  }
  // Ice facets: straight hairlines from underside vertices to one inner point.
  if (L.ice && kind !== "hop") {
    const ax = x + w * (0.35 + 0.3 * R()),
      ay = y + MARK_TOP + 6 + Math.max(0, (rock.bottom - y - MARK_TOP - 20) * (L.tall ? 0.2 : 0.35));
    for (const v of rock.verts.slice(1, -1)) if (R() < 0.55 && v[1] > ay + 10) out.push({ kind: "facet", pts: [[L.tall ? v[0] + (ax - v[0]) * 0.25 : v[0], v[1] - 2], [L.tall ? v[0] + (ax - v[0]) * 0.4 : ax, ay]] });
  }
  return out;
}
/** Cracked rock: the zigzag edge cracks game.js draws (crackLines: every 58
 * px from 26) continue down through the body as seams to the underside. */
function seamsOf(rock, R) {
  const { x, y, w, q } = rock,
    out = [];
  if (q.type === "lid" || rock.bottom - y < 40) return out;
  for (let k = 26; k < w - 14; k += 58) {
    let px = x + k - 2,
      py = y + 27;
    const end = bottomAt(rock, px) - 2,
      pts = [[px, py]];
    while (py < end - 4) {
      px += (pts.length % 2 ? 5 : -5) + (R() - 0.5) * 3;
      py = Math.min(end, py + 8 + R() * 6);
      px = clamp(px, x + rock.inset + 4, x + w - rock.inset - 4);
      pts.push([px, Math.min(py, bottomAt(rock, px) - 2)]);
    }
    if (pts.length > 1) out.push({ kind: "seam", pts });
  }
  return out;
}

/* ---------- drift (non-colliding, behind the islands) ---------- */
/** Pebbles near the underside and, under big stable rocks with air below
 * them, one small fragment that turns slowly. Anchors only; positions at a
 * time come from driftAt(). */
function driftOf(rock, L, R) {
  const { x, y, w, kind } = rock,
    out = [];
  const n = Math.round({ hop: 1.4, boulder: 2.4, slab: 4 }[kind] * L.pebbles * (0.7 + 0.6 * R()));
  for (let i = 0; i < n; i++) {
    const side = R();
    let ax, ay;
    if (side < 0.22 && rock.bottom - y > 40) {
      // Beside a lip, outside the span but well under the top.
      const right = R() > 0.5;
      ax = right ? x + w + 4 + 8 * R() : x - 4 - 8 * R();
      ay = y + ROCK.lipBand + 14 + R() * Math.max(4, rock.bottom - y - ROCK.lipBand - 20);
    } else {
      const u = 0.1 + 0.8 * R(),
        px = x + rock.inset + (w - 2 * rock.inset) * u;
      ax = px + (R() - 0.5) * 10;
      ay = bottomAt(rock, px) + 8 + 18 * R();
    }
    out.push({ kind: "pebble", ax, ay, size: (kind === "hop" ? 1.8 : 2.2) + 3 * R(), phase: R() * Math.PI * 2, period: 5 + 4 * R(), spin: (R() - 0.5) * 0.9, verts: [R(), R(), R(), R(), R()] });
  }
  if (L.chunk && kind !== "hop" && !rock.cracked) {
    const r = 4.5 + 3 * R();
    if (rock.room >= 2 * r + 16) out.push({ kind: "chunk", ax: rock.keelX, ay: rock.bottom + 9 + r, size: r, phase: R() * Math.PI * 2, period: 7, spin: 0.18, verts: [R(), R(), R(), R(), R(), R()] });
  }
  return out;
}
/** Where each drifting part is at real time t (still under reduced motion):
 * a slow bob of at most 3 px and a slow turn. Never above driftTop under the
 * top, never outside the span within lipBand of it. */
export function driftAt(rock, t, reduced = false) {
  const T = reduced ? 0 : t;
  return rock.drift.map((d) => {
    const w = (2 * Math.PI) / d.period;
    const bob = d.kind === "chunk" ? 1.5 : 2.5;
    let px = d.ax + (d.kind === "chunk" ? 0 : Math.sin(T * w * 0.7 + d.phase) * 3),
      py = d.ay + Math.sin(T * w + d.phase) * bob;
    const outside = px - d.size < rock.x || px + d.size > rock.x + rock.w;
    py = Math.max(py, rock.y + (outside ? ROCK.lipBand + 6 : ROCK.driftTop) + d.size);
    return { kind: d.kind, x: px, y: py, size: d.size, angle: d.phase + T * d.spin, verts: d.verts };
  });
}
/** Saturn: a faint dust ring round a big stable rock, its far half behind
 * the rock and its near half in front, under the lip band. */
function ringOf(rock) {
  const rx = rock.w / 2 + 12,
    ry = clamp((rock.bottom - rock.y) * 0.16, 5, 11),
    cy = Math.max(rock.y + ROCK.lipBand + 8 + ry, rock.y + (rock.bottom - rock.y) * 0.55);
  if (cy + ry > rock.bottom + 8) return null;
  return { cx: rock.x + rock.w / 2, cy, rx, ry };
}

/* ---------- painters ---------- */
function polygonPath(g, cx, cy, r, angle, verts) {
  g.beginPath();
  verts.forEach((v, i) => {
    const a = angle + (i / verts.length) * Math.PI * 2,
      rr = r * (0.7 + 0.3 * v);
    i ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  });
  g.closePath();
}
/** The drifting parts of one rock (paper, faint; drawn behind the islands)
 * and the far half of Saturn's ring. Returns how many were drawn. */
export function paintDrift(g, rock, { t = 0, reduced = false } = {}) {
  const list = driftAt(rock, t, reduced);
  g.save();
  for (const d of list) {
    g.fillStyle = rgba("paper", d.kind === "chunk" ? 0.72 : 0.5);
    polygonPath(g, d.x, d.y, d.size, d.angle, d.verts);
    g.fill();
  }
  if (rock.ring) {
    const { cx, cy, rx, ry } = rock.ring;
    g.strokeStyle = rgba("paper", 0.28);
    g.lineWidth = 1.2;
    g.setLineDash([5, 4]);
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  return list.length;
}
/** The rock's own ink and shading over its paper fill (game.js calls this
 * where the classic island draws its inner line and ticks): the faint rim
 * shadow inside the underside, the top face's front edge, the details and
 * the ink outline, and Saturn's near ring half. `dx, dy` is the shake. */
export function paintRock(g, rock, { dx = 0, dy = 0 } = {}) {
  const { x, y, w } = rock;
  g.save();
  g.translate(dx, dy);
  // Rim shadow: a soft band inside the underside, kept off the top.
  g.save();
  traceRock(g, rock);
  g.clip();
  const low = rock.points.filter((v) => v.y >= y + MARK_TOP + 2);
  if (low.length > 1) {
    g.strokeStyle = rgba("ink", 0.18);
    g.lineWidth = 9;
    g.lineJoin = "round";
    g.beginPath();
    low.forEach((v, i) => (i ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y)));
    g.stroke();
  }
  // The top face's front edge (the GDD's boulders): a hairline 9-14 px
  // under the top in the classic inner line's --mute, broken once on wide
  // rocks, its ends curling down onto the sides.
  const a = x + Math.min(16, w * 0.2),
    b = x + w - Math.min(14, w * 0.18),
    sag = Math.min(4, w * 0.02);
  if (b - a > 12) {
    g.strokeStyle = rgba("mute", 1);
    g.lineWidth = 0.9;
    g.lineCap = "round";
    const gap = w > 260 ? a + (b - a) * (0.55 + 0.2 * hash(rock.seed + 9)) : null;
    const edge = (u) => y + 10 + sag * Math.sin(Math.PI * u);
    g.beginPath();
    g.moveTo(a - 3, edge(0) + 4);
    g.quadraticCurveTo(a - 1, edge(0), a + 4, edge(0));
    for (let xx = a + 4; xx <= b - 4; xx += 8) {
      const u = (xx - a) / (b - a);
      if (gap != null && xx > gap && xx < gap + 14) {
        g.moveTo(xx + 8, edge((xx + 8 - a) / (b - a)));
        continue;
      }
      g.lineTo(xx, edge(u));
    }
    g.quadraticCurveTo(b + 1, edge(1), b + 3, edge(1) + 4);
    g.stroke();
  }
  paintDetails(g, rock);
  g.restore();
  // The ink outline: invisible on the sky, it separates overlapping rocks
  // and rocks in front of the paper bodies and rings behind them.
  g.strokeStyle = rgba("ink", 1);
  g.lineWidth = 1.6;
  g.lineJoin = "round";
  traceRock(g, rock);
  g.stroke();
  if (rock.ring) {
    // Saturn's near half: ink dashes over the rock, paper dashes over the sky.
    const { cx, cy, rx, ry } = rock.ring;
    g.setLineDash([5, 4]);
    g.lineWidth = 1.1;
    g.save();
    traceRock(g, rock);
    g.clip();
    g.strokeStyle = rgba("ink", 0.32);
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
    g.stroke();
    g.restore();
    g.save();
    g.beginPath();
    g.rect(cx - rx - 6, cy - ry - 4, 2 * rx + 12, 2 * ry + 8);
    traceRock(g, rock, 0, 0, false);
    g.clip("evenodd");
    g.strokeStyle = rgba("paper", 0.3);
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
    g.stroke();
    g.restore();
  }
  g.restore();
}
function paintDetails(g, rock) {
  for (const d of rock.details) {
    g.beginPath();
    if (d.kind === "crater") {
      // A bowl seen from above: a thin rim and the shadowed far wall
      // (never two lone arcs, which read as closed eyes).
      g.fillStyle = rgba("ink", d.shade ? 0.12 : 0.06);
      g.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = rgba("ink", 0.55);
      g.lineWidth = 1;
      g.stroke();
      g.beginPath();
      g.strokeStyle = rgba("ink", 0.8);
      g.lineWidth = 1.6;
      g.ellipse(d.x, d.y + d.ry * 0.22, d.rx * 0.82, d.ry * 0.72, 0, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
      continue;
    }
    const style = { fissure: ["ink", 0.5, 1], facet: ["ink", 0.3, 0.9], hatch: ["ink", 0.34, 1], seam: ["ink", 1, 1.5] }[d.kind];
    g.strokeStyle = rgba(style[0], style[1]);
    g.lineWidth = style[2];
    g.lineJoin = "round";
    d.pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    if (d.branch) {
      g.moveTo(...d.branch[0]);
      g.lineTo(...d.branch[1]);
    }
    g.stroke();
  }
}

/* ---------- a per-level cache ---------- */
/** Rocks are pure per island, so the renderer keeps them: one Map per
 * level key and look, rebuilt only when either changes. */
export function createRockCache() {
  let key = null,
    rocks = new Map();
  return {
    get(q, { levelKey, look, world }) {
      const k = `${levelKey}|${look}`;
      if (k !== key) {
        key = k;
        rocks = new Map();
      }
      const id = `${q.id}|${q.x}|${q.y}|${q.width}`;
      let r = rocks.get(id);
      if (!r) rocks.set(id, (r = meteorRock(q, { look, world })));
      return r;
    },
    get size() {
      return rocks.size;
    },
  };
}
