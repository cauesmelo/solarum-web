/** Per-level island marks and particles (RESEARCH_PROGRESSION 4.4): each
 * level's islands carry a subtle surface signature matching its `look`, in
 * the existing line language, and a few small ambient particles under them.
 * Pure painters on a passed-in context (no DOM), so this loads in node.
 *
 * Readability rules (each is tested in tests/scripted.test.mjs):
 * - The walkable top stays plain paper: no mark is drawn above
 *   `MARK_TOP` px under the top (the top line, its lip and the optional
 *   stone's dotted rim and star tick live in those first px).
 * - Cracked stone (crumbling shelves, cascade tiles, lids) carries no mark:
 *   zigzag cracks, the star-shaped break and grey keep their one meaning.
 * - Marks are ink hairlines at low alpha on the paper body (never a fill,
 *   so never grey on a top); Saturn's ice nubs are small paper drips under
 *   the silhouette. Particles are paper at most 0.3 alpha, start under the
 *   island's underside and are drawn behind the islands, so they never
 *   cover Diana, glyphs or stars.
 * - The renderer clips marks and particles below the 56 px HUD band.
 * - Under reduced motion marks are still and particles are drawn still.
 *
 * Units: world px and seconds of real time. */
import { TOKENS } from "./backdrop.mjs";

const rgba = (token, a) => `rgba(${TOKENS[token].join(",")},${a})`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** The renderer's own hash (game.js): the same island gets the same shape. */
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Nothing is drawn within this many px under an island's top. */
export const MARK_TOP = 18;

/** Look id -> its island mark and particle kind (null: none). Home keeps the
 * existing ticks (its signature is the shower's landed stars); Pluto's
 * emptiness has no particles; the Moon's look has the most stars instead. */
export const ISLAND_LOOKS = Object.freeze({
  home: Object.freeze({ marks: null, particles: null }),
  pluto: Object.freeze({ marks: "frost", particles: null }),
  neptune: Object.freeze({ marks: "waves", particles: "rings" }),
  uranus: Object.freeze({ marks: "striations", particles: "flecks" }),
  saturn: Object.freeze({ marks: "nubs", particles: "ringFlecks" }),
  jupiter: Object.freeze({ marks: "strata", particles: "wind" }),
  mars: Object.freeze({ marks: "hatch", particles: "dust" }),
  "moon-earth": Object.freeze({ marks: "craters", particles: null }),
});
const CRACKED = new Set(["crumble", "lid", "cascade"]);
/** Whether an island carries its look's marks (stable stone only). */
export const markable = (q) => !CRACKED.has(q.type);

/** The island silhouette game.js draws (islandPath): the top runs along the
 * collider, the lips taper inward 9-12 px under it, and the underside is one
 * cubic (two lobes past 520 px). Returned as data so the renderer, the marks
 * and the particles share one shape. */
export function islandShape(q, x, w, thick, jitter = 0) {
  const y = q.y + jitter,
    h = hash(q.phase * 3.7 + 1),
    h2 = hash(q.phase * 5.3 + 2),
    depth = thick * (0.72 + h * 0.6),
    keel = 0.3 + h2 * 0.4,
    inset = Math.min(10, w * 0.06);
  let curves;
  if (w > 520) {
    // Long islands: two lobes instead of one giant wedge.
    const mid = x + w * (0.45 + h * 0.1);
    curves = [
      [[x + w - inset, y + 12], [x + w * 0.9, y + depth * 0.9], [mid + w * 0.12, y + depth * 0.95], [mid, y + depth * 0.62]],
      [[mid, y + depth * 0.62], [mid - w * 0.1, y + depth * 1.05], [x + w * 0.12, y + depth * 0.9], [x + inset, y + 12]],
    ];
  } else {
    curves = [[[x + w - inset, y + 12], [x + w * (keel + 0.45), y + depth + 12], [x + w * (keel - 0.25), y + depth + 8], [x + inset, y + 12]]];
  }
  return { q, x, y, w, thick, jitter, depth, inset, curves, seed: Number.isFinite(q.phase) ? q.phase : 0 };
}
const cubic = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
/** Points along the underside, right to left (n per curve). */
export function undersidePoints(shape, n = 16) {
  const out = [];
  for (const [p0, c1, c2, p3] of shape.curves)
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push({ x: cubic(p0[0], c1[0], c2[0], p3[0], t), y: cubic(p0[1], c1[1], c2[1], p3[1], t) });
    }
  return out;
}

/* ---------- marks (inside the silhouette; the renderer clips to it) ---------- */
const INSIDE = {
  // II Pluto: hairline frost cracks in the lower body: thin, mostly level
  // jagged lines with a short branch or two (a crumbling shelf's cracks are
  // thick zigzags running down from its top edge).
  frost(g, s) {
    g.strokeStyle = rgba("ink", 0.34);
    g.lineWidth = 0.8;
    g.lineJoin = "round";
    g.beginPath();
    for (let k = 20 + hash(s.seed + 1) * 30; k < s.w - 40; k += 70 + hash(s.seed + k) * 50) {
      let x = s.x + k,
        y = s.y + MARK_TOP + 5 + hash(s.seed + k * 3) * Math.max(2, s.depth * 0.35);
      g.moveTo(x, y);
      const n = 3 + Math.floor(hash(k * 1.3 + s.seed) * 3);
      for (let i = 0; i < n; i++) {
        const a = (hash(k + i * 9.1 + s.seed) - 0.5) * 1.4 + 0.25,
          len = 5 + hash(k * 2 + i + s.seed) * 6;
        x += Math.cos(a) * len;
        y += Math.sin(a) * len * 0.8;
        g.lineTo(x, y);
        if (i === 1 || (i === 3 && n > 4)) {
          // A branch off the crack, then back to its end.
          const b = a + (hash(i + k * 5 + s.seed) > 0.5 ? 0.9 : -0.9);
          g.lineTo(x + Math.cos(b) * 4, y + Math.sin(b) * 4);
          g.moveTo(x, y);
        }
      }
    }
    g.stroke();
  },
  // III Neptune: three slow wave lines on the underside.
  waves(g, s, { t, reduced }) {
    const phase = reduced ? 0 : t * 0.6;
    g.strokeStyle = rgba("ink", 0.26);
    g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const yy = s.y + MARK_TOP + 6 + (s.depth - 8) * (0.3 + i * 0.27);
      g.beginPath();
      for (let xx = s.x + 6; xx <= s.x + s.w - 6; xx += 6) {
        const wy = yy + Math.sin(xx * 0.09 + phase + i * 1.3) * 1.8;
        xx === s.x + 6 ? g.moveTo(xx, wy) : g.lineTo(xx, wy);
      }
      g.stroke();
    }
  },
  // IV Uranus: vertical striations, as if the island were tipped like its planet.
  striations(g, s) {
    g.lineWidth = 0.9;
    let i = 0;
    for (let k = 8; k < s.w - 6; k += 11 + hash(s.seed * 3 + k) * 7, i++) {
      g.strokeStyle = rgba("ink", i % 3 === 0 ? 0.3 : 0.18);
      g.beginPath();
      g.moveTo(s.x + k, s.y + MARK_TOP + 2 + hash(k + s.seed) * 8);
      g.lineTo(s.x + k + 1, s.y + s.depth + 14);
      g.stroke();
    }
  },
  // VI Jupiter: layered strata, long dashes with breaks.
  strata(g, s) {
    g.strokeStyle = rgba("ink", 0.24);
    g.lineWidth = 1;
    g.save();
    for (let i = 0; i < 3; i++) {
      const yy = s.y + MARK_TOP + 4 + (s.depth - 6) * (i * 0.31);
      g.setLineDash([42 + hash(s.seed + i) * 34, 7 + i * 2]);
      g.lineDashOffset = hash(s.seed * 2 + i) * 60;
      g.beginPath();
      for (let xx = s.x + 4; xx <= s.x + s.w - 4; xx += 12) {
        const wy = yy + Math.sin(xx * 0.02 + i * 2 + s.seed) * 2.2;
        xx === s.x + 4 ? g.moveTo(xx, wy) : g.lineTo(xx, wy);
      }
      g.stroke();
    }
    g.restore();
  },
  // VII Mars: dense diagonal hatching on the lower half (the darkest hatch stands for red).
  hatch(g, s) {
    const top = s.y + Math.max(MARK_TOP + 4, s.depth * 0.5 + 8),
      bottom = s.y + s.depth + 14;
    g.save();
    g.beginPath();
    g.rect(s.x, top, s.w, bottom - top);
    g.clip();
    g.strokeStyle = rgba("ink", 0.3);
    g.lineWidth = 0.8;
    g.beginPath();
    for (let xx = s.x - (bottom - top); xx < s.x + s.w; xx += 6) {
      g.moveTo(xx, bottom);
      g.lineTo(xx + (bottom - top), top);
    }
    g.stroke();
    g.restore();
  },
  // VIII the Moon: small crater rims on the face, under the top.
  craters(g, s) {
    const n = clamp(Math.round(s.w / 150), 1, 4);
    g.strokeStyle = rgba("ink", 0.35);
    g.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const rx = 5 + hash(s.seed * 7 + i) * 5,
        cx = s.x + s.w * ((i + 0.25 + hash(s.seed + i * 5) * 0.5) / n),
        cy = s.y + MARK_TOP + 4 + rx * 0.4 + hash(s.seed + i * 11) * Math.max(0, s.depth * 0.35 - 6);
      g.beginPath();
      g.ellipse(cx, cy, rx, rx * 0.38, 0, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      g.beginPath();
      g.ellipse(cx, cy, rx * 0.8, rx * 0.3, 0, Math.PI * 0.1, Math.PI * 0.9);
      g.stroke();
    }
  },
};
/* Marks drawn under the silhouette (not clipped to it). */
const UNDER = {
  // V Saturn: small ice nubs hanging from the underside where it runs
  // roughly level and deep enough (paper, the island's own material).
  nubs(g, s) {
    const pts = undersidePoints(s, 20);
    g.fillStyle = rgba("paper", 1);
    let last = -Infinity;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i],
        a = pts[i - 1],
        b = pts[i + 1],
        slope = Math.abs((b.y - a.y) / ((b.x - a.x) || 1e-6));
      if (p.y < s.y + 30 || slope > 0.55 || Math.abs(p.x - last) < 38) continue;
      if (hash(s.seed * 5 + i) < 0.35) continue;
      last = p.x;
      const half = 2.6 + hash(i + s.seed) * 1.6,
        len = 5 + hash(i * 3 + s.seed) * 5;
      g.beginPath();
      g.moveTo(p.x - half, p.y - 2);
      g.quadraticCurveTo(p.x - half * 0.6, p.y + len * 0.7, p.x, p.y + len);
      g.quadraticCurveTo(p.x + half * 0.6, p.y + len * 0.7, p.x + half, p.y - 2);
      g.closePath();
      g.fill();
    }
  },
};

/** Draw a look's marks on one island. `inside` runs with the context
 * clipped to the silhouette (game.js); `under` after it, unclipped. */
export function paintMarks(g, look, shape, { t = 0, reduced = false, part = "inside" } = {}) {
  const kind = ISLAND_LOOKS[look]?.marks;
  const painter = kind && (part === "inside" ? INSIDE[kind] : UNDER[kind]);
  if (!painter) return false;
  g.save();
  painter(g, shape, { t, reduced });
  g.restore();
  return true;
}

/* ---------- particles (behind the islands, under their undersides) ---------- */
/** The particles of one island at time t: { kind, x, y, size, alpha, len }.
 * Each is a pure function of time and the island's seed (no state to
 * reset); under reduced motion t is held at 0 so they are drawn still. */
export function particlesOf(look, shape, t, reduced = false) {
  const kind = ISLAND_LOOKS[look]?.particles;
  if (!kind || shape.w < 90) return [];
  const pts = undersidePoints(shape, 12),
    T = reduced ? 0 : t,
    n = clamp(Math.round(shape.w / 160), 1, 5),
    out = [];
  for (let i = 0; i < n; i++) {
    const r1 = hash(shape.seed * 13 + i * 7.3),
      r2 = hash(shape.seed * 3.1 + i * 1.9),
      // An underside point away from the lips, where the particle lives.
      p = pts[Math.floor(pts.length * (0.18 + 0.64 * r1))],
      period = { rings: 8, flecks: 6, ringFlecks: 9, wind: 3.2, dust: 5 }[kind] * (0.8 + 0.4 * r2),
      u = (((T / period + r2) % 1) + 1) % 1,
      life = Math.sin(Math.PI * u);
    if (kind === "rings") {
      // III: tiny rings rising slowly toward the island and vanishing into it.
      out.push({ kind: "ring", x: p.x + Math.sin(T * 0.8 + i * 2) * 4, y: p.y + 8 + (1 - u) * 140, size: 1.4 + 1.2 * r1, alpha: 0.24 * life });
    } else if (kind === "flecks") {
      // IV: ice flecks drifting down from the underside.
      out.push({ kind: "fleck", x: p.x + Math.sin(T * 0.7 + i) * 6, y: p.y + 6 + u * 120, size: 1.2 + r1 * 0.9, alpha: 0.28 * (1 - u) * Math.min(1, u * 5) });
    } else if (kind === "ringFlecks") {
      // V: ring flecks drifting sideways under the island.
      out.push({ kind: "dash", x: shape.x - 30 + (shape.w + 60) * (1 - u), y: p.y + 10 + r1 * 26, len: 5 + r2 * 3, alpha: 0.22 * life });
    } else if (kind === "wind") {
      // VI: streaming wind lines under the island.
      out.push({ kind: "dash", x: shape.x - 40 + (shape.w + 80) * u, y: p.y + 8 + r1 * 40, len: 16 + r2 * 12, alpha: 0.2 * life });
    } else if (kind === "dust") {
      // VII: dust streaks drifting down and to the right.
      out.push({ kind: "streak", x: p.x - 20 + u * 60, y: p.y + 6 + u * 50, len: 7, alpha: 0.22 * life });
    }
  }
  return out;
}
/** Draw the particles of one island (paper on the ink sky). */
export function paintParticles(g, look, shape, { t = 0, reduced = false } = {}) {
  const list = particlesOf(look, shape, t, reduced);
  if (!list.length) return 0;
  g.save();
  g.lineCap = "round";
  for (const q of list) {
    if (q.alpha <= 0.005) continue;
    g.strokeStyle = g.fillStyle = rgba("paper", q.alpha);
    g.lineWidth = 1;
    g.beginPath();
    if (q.kind === "ring") {
      g.arc(q.x, q.y, q.size, 0, Math.PI * 2);
      g.stroke();
    } else if (q.kind === "fleck") {
      g.moveTo(q.x, q.y - q.size);
      g.lineTo(q.x + q.size * 0.7, q.y);
      g.lineTo(q.x, q.y + q.size);
      g.lineTo(q.x - q.size * 0.7, q.y);
      g.closePath();
      g.fill();
    } else if (q.kind === "dash") {
      g.moveTo(q.x, q.y);
      g.lineTo(q.x + q.len, q.y);
      g.stroke();
    } else {
      g.moveTo(q.x, q.y);
      g.lineTo(q.x + q.len * 0.8, q.y + q.len * 0.6);
      g.stroke();
    }
  }
  g.restore();
  return list.length;
}
