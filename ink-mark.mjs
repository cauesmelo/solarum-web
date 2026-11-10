/** Hand-drawn UI marks: pure geometry, no DOM.
 *
 * The title panel and the cards get their drawn look from one SVG filter
 * (`ink-wobble` in index.html: feTurbulence + feDisplacementMap, its seed
 * boiled at about 8 fps). The marks inside them (level rings, connectors,
 * the sprout, the Earth dot, the orbit line, buttons, sliders, focus loops)
 * used to be CSS borders and perfect circles, and clashed with that line.
 * Here they are generated from a seed instead, as FILLED OUTLINES of a pen
 * stroke (not as SVG strokes), because a filled outline is the only way to
 * give a line an uneven width:
 *
 *   - a closed ring is one stroke that overshoots its own start, so the pen
 *     stroke visibly overlaps itself and the end sits a little inside or
 *     outside the start (a spiral of `drift` px), not a perfect circle;
 *   - the radius carries low harmonics (2-5, a few percent) and the loop is
 *     a hair elliptic, so no ring is round;
 *   - the width follows a pressure curve (heavier where the pen lands, thin
 *     where it lifts) with tapered ends;
 *   - a seed fixes everything, so a mark never changes between frames. The
 *     "boil" is `phase` (0-3): a small extra jitter, a few tenths of a pixel,
 *     that the UI steps at the same 8 fps as the panel's filter (and not at
 *     all under reduced motion, where the filter's seed is also frozen).
 *
 * Every function returns `{ d, box, meta }`: `d` is SVG path data (fill it),
 * `box` the control-polygon bounds [x0, y0, x1, y1] (a quadratic Bezier lies
 * inside its control polygon, so the drawn ink never leaves the box), `meta`
 * the numbers tests and the DOM glue read. Units are CSS px in the mark's own
 * frame. UI only: the world art and gameplay drawing never use this. */

const TAU = Math.PI * 2;
/** Path precision: 0.01 px (about a thousandth of a device pixel at 2x). */
const fmt = (v) => String(Math.round(v * 100) / 100);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (u) => {
  const t = clamp(u, 0, 1);
  return t * t * (3 - 2 * t);
};

/** FNV-1a over the parts, as an unsigned 32-bit seed: a node's seed is
 * hashSeed("stop", 3), so it never depends on how many other marks exist. */
export function hashSeed(...parts) {
  let h = 2166136261;
  for (const ch of parts.join("|")) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return h;
}
/** mulberry32: a small seeded generator, uniform in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A smooth random function of u with |f| <= 1: a few cosines at `freqs`
 * (integers for closed loops, so the shape closes on itself) with random
 * phases and 1/k amplitudes. */
function noise(seed, freqs) {
  const r = rng(seed),
    parts = freqs.map((k) => [k, (0.55 + r()) / k, r() * TAU]),
    norm = parts.reduce((s, p) => s + p[1], 0);
  return (u) => parts.reduce((s, [k, a, ph]) => s + a * Math.cos(TAU * k * u + ph), 0) / norm;
}

/** The pen's pressure along a stroke, s in [0, 1]: a slow swell, a second
 * faster one, a blunt landing and a long lift. Always > 0. */
function pressure(r, width) {
  const p1 = r() * TAU,
    p2 = r() * TAU,
    f1 = 0.9 + r() * 0.5,
    f2 = 2.3 + r() * 1.2;
  return (s, taper) => {
    const swell = 0.9 + 0.16 * Math.sin(TAU * f1 * s + p1) + 0.08 * Math.sin(TAU * f2 * s + p2);
    const land = 0.78 + 0.22 * smooth(s / 0.05);
    const lift = taper ? 0.2 + 0.8 * (1 - smooth((s - 0.8) / 0.2)) : 1;
    return width * swell * land * lift;
  };
}

/** A closed, smooth curve through polygon points: quadratic Beziers between
 * the midpoints, the points as controls (so sharp corners round off). */
function closedPath(pts) {
  const m = pts.length,
    mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const q = (c, e) => `Q${fmt(c[0])} ${fmt(c[1])} ${fmt(e[0])} ${fmt(e[1])}`;
  const start = mid(pts[m - 1], pts[0]);
  let d = `M${fmt(start[0])} ${fmt(start[1])}`;
  for (let i = 0; i < m; i++) d += q(pts[i], mid(pts[i], pts[(i + 1) % m]));
  return `${d}Z`;
}
function boxOf(polys) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const poly of polys)
    for (const [x, y] of poly) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  return [x0, y0, x1, y1].map((v) => Math.round(v * 100) / 100);
}
/** The two sides of a pen stroke along a centre line with a width at each
 * point, as one closed polygon (left side out, right side back). */
function outline(pts, widths) {
  const n = pts.length,
    left = [],
    right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0],
      ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const hw = widths[i] / 2;
    left.push([pts[i][0] - ty * hw, pts[i][1] + tx * hw]);
    right.push([pts[i][0] + ty * hw, pts[i][1] - tx * hw]);
  }
  return left.concat(right.reverse());
}
function polygonOf(strokes) {
  const polys = strokes.map(([pts, widths]) => outline(pts, widths));
  return { d: polys.map(closedPath).join(""), box: boxOf(polys) };
}

/* ---------- loops: rings and rounded rectangles ---------- */

/** A circle (or a hair of an ellipse), parametrised by u in [0, 1). */
function circleBase(cx, cy, rx, ry, tilt) {
  const c = Math.cos(tilt),
    s = Math.sin(tilt);
  return {
    perimeter: Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry))),
    point(u) {
      const a = u * TAU,
        ex = rx * Math.cos(a),
        ey = ry * Math.sin(a);
      // The outward normal of an ellipse is (ry cos a, rx sin a), then tilted.
      const nx0 = ry * Math.cos(a),
        ny0 = rx * Math.sin(a),
        nl = Math.hypot(nx0, ny0) || 1;
      return [cx + ex * c - ey * s, cy + ex * s + ey * c, (nx0 * c - ny0 * s) / nl, (nx0 * s + ny0 * c) / nl];
    },
  };
}
/** A rounded rectangle from (0, 0) to (w, h), clockwise from the top edge's
 * start, by arc length (so noise along it does not bunch up in the corners). */
function roundRectBase(w, h, radius) {
  const r = clamp(radius, 0, Math.min(w, h) / 2),
    sx = w - 2 * r,
    sy = h - 2 * r,
    q = (r * Math.PI) / 2;
  const corner = (cx, cy, a0) => (s) => {
    const a = a0 + s / r;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a)];
  };
  const segs = [
    [sx, (s) => [r + s, 0, 0, -1]],
    [q, corner(w - r, r, -Math.PI / 2)],
    [sy, (s) => [w, r + s, 1, 0]],
    [q, corner(w - r, h - r, 0)],
    [sx, (s) => [w - r - s, h, 0, 1]],
    [q, corner(r, h - r, Math.PI / 2)],
    [sy, (s) => [0, h - r - s, -1, 0]],
    [q, corner(r, r, Math.PI)],
  ].filter(([len]) => len > 1e-9);
  const perimeter = segs.reduce((t, [len]) => t + len, 0);
  return {
    perimeter,
    point(u) {
      let s = (((u % 1) + 1) % 1) * perimeter;
      for (const [len, at] of segs) {
        if (s <= len) return at(s);
        s -= len;
      }
      const [len, at] = segs.at(-1);
      return at(len);
    },
  };
}

/** The pen's path round a loop: where it starts, which way it turns, how far
 * it overshoots and drifts, and the shape's low harmonics, all from the seed.
 * `size` is the loop's nominal radius (ring radius, or half the short side);
 * it scales every irregularity, so a tick mark stays a tick mark. */
function pen(base, { seed, phase, size, width, overlap }) {
  const r = rng(seed),
    u0 = r(),
    dir = r() < 0.5 ? -1 : 1,
    over = overlap ?? 0.055 + r() * 0.075,
    amp = Math.min(0.06 * size, 1.3),
    drift = (r() < 0.5 ? -1 : 1) * (0.5 + 0.5 * r()) * Math.min(0.09 * size + 0.4, 1.8),
    jit = Math.min(0.45, 0.03 * size + 0.12),
    shape = noise(seed ^ 0x9e3779b1, [2, 3, 4, 5]),
    // The boil: a different small wobble per phase, the same pen path.
    boil = noise(hashSeed(seed, "boil", phase), [3, 4, 5, 6, 7]);
  const stroke = (a, b, tag, taper = true) => {
    const rs = rng(hashSeed(seed, "stroke", tag)),
      press = pressure(rs, width),
      span = (b - a) * base.perimeter * (1 + over),
      n = Math.max(6, Math.ceil(span / 2.2)),
      pts = [],
      widths = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        s = a + (b - a) * t,
        u = u0 + dir * s * (1 + over),
        [x, y, nx, ny] = base.point(u),
        off = amp * shape(u) + drift * smooth(s) + jit * boil(u);
      pts.push([x + nx * off, y + ny * off]);
      widths.push(press(t, taper));
    }
    return [pts, widths];
  };
  return { stroke, over, drift, amp, jit, dir, u0 };
}

/** The most a loop's ink can lie outside its nominal outline, in px: the
 * shape harmonics, the drift, the boil, the ellipse (3.5% of the radius) and
 * the stroke's own half width. Tests and the DOM glue use it to size boxes. */
export function inkReach(size, width = 2.4) {
  return Math.min(0.06 * size, 1.3) + Math.min(0.09 * size + 0.4, 1.8) + Math.min(0.45, 0.03 * size + 0.12) + 0.035 * size + width * 0.7;
}

const widthRange = (strokes) => {
  const all = strokes.flatMap(([, w]) => w);
  return [Math.min(...all), Math.max(...all)];
};

/** A ring: one closed pen stroke around (cx, cy) with an overlapping end. */
export function ring({ seed, cx = 0, cy = 0, r, width = 2.4, phase = 0, overlap }) {
  const r0 = rng(hashSeed(seed, "ellipse")),
    e = (r0() * 2 - 1) * 0.035,
    base = circleBase(cx, cy, r * (1 + e), r * (1 - e), r0() * Math.PI),
    p = pen(base, { seed, phase, size: r, width, overlap }),
    stroke = p.stroke(0, 1, "ring"),
    out = polygonOf([stroke]);
  return {
    ...out,
    meta: { sweep: TAU * (1 + p.over), overlap: p.over, drift: p.drift, widths: widthRange([stroke]), start: stroke[0][0], end: stroke[0].at(-1), dir: p.dir },
  };
}
/** A dashed ring: irregular dashes with irregular gaps round the same wobbly
 * circle (a locked level). `period` is the mean dash + gap, in px. */
export function dashedRing({ seed, cx = 0, cy = 0, r, width = 2.2, phase = 0, period = 11 }) {
  const r0 = rng(hashSeed(seed, "ellipse")),
    e = (r0() * 2 - 1) * 0.035,
    base = circleBase(cx, cy, r * (1 + e), r * (1 - e), r0() * Math.PI),
    p = pen(base, { seed, phase, size: r, width, overlap: 0 }),
    rd = rng(hashSeed(seed, "dashes")),
    count = Math.max(3, Math.round(base.perimeter / period)),
    dashes = [];
  // Irregular dash and gap lengths that still add up to one loop: draw each
  // as a random share, then scale the shares to fill the loop exactly.
  const shares = [];
  for (let i = 0; i < count; i++) shares.push([0.5 + rd() * 0.55, 0.38 + rd() * 0.5]);
  const total = shares.reduce((t, [a, b]) => t + a + b, 0);
  // Start at 0: the loop then ends on a gap, so the last dash never touches the first.
  let at = 0;
  for (const [dash, gap] of shares) {
    dashes.push([at, at + dash / total]);
    at += (dash + gap) / total;
  }
  const strokes = dashes.map(([a, b], i) => p.stroke(a, Math.min(b, 1), `dash${i}`)),
    out = polygonOf(strokes);
  return { ...out, meta: { dashes, count: dashes.length, widths: widthRange(strokes), drift: p.drift } };
}
/** A rounded rectangle outline (w x h from the origin): the same pen, for
 * buttons, toggles, the pill and key caps. */
export function loop({ seed, w, h, radius = 12, width = 2.4, phase = 0, overlap, dashed = false, period = 12 }) {
  const base = roundRectBase(w, h, radius),
    size = Math.min(w, h) / 2,
    p = pen(base, { seed, phase, size, width, overlap: dashed ? 0 : overlap });
  if (dashed) {
    const rd = rng(hashSeed(seed, "dashes")),
      count = Math.max(4, Math.round(base.perimeter / period)),
      shares = Array.from({ length: count }, () => [0.5 + rd() * 0.55, 0.38 + rd() * 0.5]),
      total = shares.reduce((t, [a, b]) => t + a + b, 0),
      dashes = [];
    let at = 0;
    for (const [dash, gap] of shares) {
      dashes.push([at, at + dash / total]);
      at += (dash + gap) / total;
    }
    const strokes = dashes.map(([a, b], i) => p.stroke(a, Math.min(b, 1), `dash${i}`));
    return { ...polygonOf(strokes), meta: { dashes, widths: widthRange(strokes), drift: p.drift } };
  }
  const stroke = p.stroke(0, 1, "loop");
  return { ...polygonOf([stroke]), meta: { sweep: 1 + p.over, overlap: p.over, drift: p.drift, widths: widthRange([stroke]), start: stroke[0][0], end: stroke[0].at(-1) } };
}

/* ---------- filled shapes: a disc and a plate with a hand-drawn edge ---------- */

/** A filled blob (the Earth dot, a ring's fill, the Sun of a key): a circle
 * whose edge carries the same low harmonics, a few percent of the radius. */
export function blob({ seed, cx = 0, cy = 0, r, phase = 0 }) {
  const shape = noise(seed ^ 0x51ed270b, [2, 3, 4]),
    boil = noise(hashSeed(seed, "blob-boil", phase), [3, 4, 5]),
    r0 = rng(hashSeed(seed, "blob")),
    e = (r0() * 2 - 1) * 0.04,
    n = Math.max(10, Math.ceil((TAU * r) / 2.2)),
    pts = [];
  for (let i = 0; i < n; i++) {
    const u = i / n,
      rr = r * (1 + 0.065 * shape(u)) + Math.min(0.3, 0.03 * r + 0.06) * boil(u);
    pts.push([cx + rr * (1 + e) * Math.cos(TAU * u), cy + rr * (1 - e) * Math.sin(TAU * u)]);
  }
  return { d: closedPath(pts), box: boxOf([pts]), meta: { reach: r * (0.065 + 0.04) + 0.3 } };
}
/** A filled rounded plate (a button's or the pill's body) with a wavering edge. */
export function plate({ seed, w, h, radius = 12, phase = 0 }) {
  const base = roundRectBase(w, h, radius),
    shape = noise(seed ^ 0x2545f491, [2, 3, 4, 5]),
    boil = noise(hashSeed(seed, "plate-boil", phase), [3, 5, 7]),
    amp = Math.min(0.045 * Math.min(w, h), 1),
    n = Math.max(16, Math.ceil(base.perimeter / 2.4)),
    pts = [];
  for (let i = 0; i < n; i++) {
    const u = i / n,
      [x, y, nx, ny] = base.point(u),
      off = amp * shape(u) + 0.3 * boil(u);
    pts.push([x + nx * off, y + ny * off]);
  }
  return { d: closedPath(pts), box: boxOf([pts]), meta: { reach: amp + 0.3 } };
}

/* ---------- open strokes: connectors, underlines, the orbit, arrows ---------- */

/** Resample a polyline at about `step` px along its length. */
function resample(points, step = 1.6) {
  const out = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1],
      [bx, by] = points[i],
      len = Math.hypot(bx - ax, by - ay);
    let at = step - carry;
    while (at <= len) {
      out.push([ax + ((bx - ax) * at) / len, ay + ((by - ay) * at) / len]);
      at += step;
    }
    carry = len - (at - step);
  }
  const last = points.at(-1),
    tail = out.at(-1);
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > 0.2) out.push(last);
  return out;
}
/** A pen stroke along any polyline: uneven width, a wavering line, tapered
 * ends. `amp` is the sideways waver in px (a few tenths for a short link). */
export function stroke({ seed, points, width = 2.2, amp = 0.7, phase = 0, taper = true }) {
  const pts = resample(points),
    n = pts.length,
    r = rng(hashSeed(seed, "line")),
    wave = noise(seed ^ 0x68e31da4, [1, 2, 3]),
    boil = noise(hashSeed(seed, "line-boil", phase), [3, 4, 6]),
    press = pressure(r, width),
    // A slow lean, so a straight link is never ruler-straight.
    lean = (r() * 2 - 1) * amp * 0.8,
    out = [],
    widths = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0,
      a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0],
      ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    // Ends stay put (a connector must still touch its rings); the middle wavers.
    const edge = smooth(t / 0.2) * smooth((1 - t) / 0.2),
      off = (amp * wave(t * 0.5) + lean * Math.sin(Math.PI * t) + Math.min(0.3, 0.45 * amp) * boil(t * 0.5)) * edge;
    out.push([pts[i][0] - ty * off, pts[i][1] + tx * off]);
    widths.push(press(t, taper));
  }
  const res = polygonOf([[out, widths]]);
  return { ...res, meta: { widths: widthRange([[out, widths]]), points: out.length, reach: amp * 1.8 + 0.3 + width } };
}
/** A straight-ish line from (x0, y0) to (x1, y1) drawn by hand. */
export function line({ seed, x0 = 0, y0 = 0, x1, y1 = y0, ...rest }) {
  return stroke({ seed, points: [[x0, y0], [x1, y1]], ...rest });
}
/** A dotted line: irregular little dots with uneven spacing, each a blob of
 * its own size (the title's unfinished orbit between levels). */
export function dots({ seed, x0 = 0, y0 = 0, x1, y1 = y0, r = 1.3, spacing = 4.4, phase = 0 }) {
  const rr = rng(hashSeed(seed, "dots")),
    len = Math.hypot(x1 - x0, y1 - y0),
    count = Math.max(2, Math.round(len / spacing)),
    ux = (x1 - x0) / (len || 1),
    uy = (y1 - y0) / (len || 1),
    boil = noise(hashSeed(seed, "dots-boil", phase), [1, 2]),
    polys = [],
    centres = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5 + (rr() - 0.5) * 0.45) / count,
      side = (rr() - 0.5) * 1.1 + 0.18 * boil(t),
      radius = r * (0.72 + 0.6 * rr()),
      cx = x0 + (x1 - x0) * t - uy * side,
      cy = y0 + (y1 - y0) * t + ux * side,
      pts = [],
      k = 7,
      ph = rr() * TAU;
    for (let j = 0; j < k; j++) pts.push([cx + radius * (1 + 0.16 * (rr() * 2 - 1)) * Math.cos(ph + (TAU * j) / k), cy + radius * (1 + 0.16 * (rr() * 2 - 1)) * 0.92 * Math.sin(ph + (TAU * j) / k)]);
    polys.push(pts);
    centres.push([cx, cy, radius]);
  }
  return { d: polys.map(closedPath).join(""), box: boxOf(polys), meta: { dots: centres, count } };
}
/** Dots along any polyline (the orbit line before the ship has passed). */
export function dotsAlong({ seed, points, r = 1.4, spacing = 5.5, phase = 0 }) {
  const pts = resample(points, 0.8),
    lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = lens.at(-1),
    count = Math.max(2, Math.round(total / spacing)),
    rr = rng(hashSeed(seed, "orbit-dots")),
    boil = noise(hashSeed(seed, "orbit-boil", phase), [1, 2]),
    polys = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const at = ((i + 0.5 + (rr() - 0.5) * 0.4) / count) * total;
    while (j < lens.length - 2 && lens[j + 1] < at) j++;
    const [x, y] = pts[j],
      side = (rr() - 0.5) * 1.0 + 0.2 * boil(at / total),
      radius = r * (0.72 + 0.6 * rr()),
      ph = rr() * TAU,
      k = 6,
      ring = [];
    for (let q = 0; q < k; q++) ring.push([x + radius * (1 + 0.16 * (rr() * 2 - 1)) * Math.cos(ph + (TAU * q) / k), y + side + radius * (1 + 0.16 * (rr() * 2 - 1)) * 0.92 * Math.sin(ph + (TAU * q) / k)]);
    polys.push(ring);
  }
  return { d: polys.map(closedPath).join(""), box: boxOf(polys), meta: { count } };
}
/** A point list along a quadratic Bezier (p0, p1, p2), `n` segments. */
export function quadPoints(p0, p1, p2, n = 40) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
  return out;
}

/** An arrow (one pen stroke for the shaft, one for the head) pointing
 * "up" | "down" | "left" | "right", `size` px long, centred on (cx, cy):
 * the key hints draw their own arrows because the type has no arrow glyphs
 * worth trusting at 16 px. */
export function arrow({ seed, dir = "right", size = 12, cx = 0, cy = 0, width = 1.8, phase = 0 }) {
  const turn = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir] ?? 0,
    c = Math.cos(turn),
    s = Math.sin(turn),
    at = (x, y) => [cx + x * c - y * s, cy + x * s + y * c],
    h = size * 0.38,
    half = size / 2,
    shaft = stroke({ seed: hashSeed(seed, "shaft"), points: [at(-half, 0), at(half, 0)], width, amp: 0.25, phase }),
    head = stroke({ seed: hashSeed(seed, "head"), points: [at(half - h, -h * 0.9), at(half, 0), at(half - h, h * 0.9)], width, amp: 0.2, phase, taper: false });
  return { d: shaft.d + head.d, box: [Math.min(shaft.box[0], head.box[0]), Math.min(shaft.box[1], head.box[1]), Math.max(shaft.box[2], head.box[2]), Math.max(shaft.box[3], head.box[3])], meta: { dir } };
}
/** A tick mark or small chevron: a short open stroke (the focus caret). */
export function chevron({ seed, dir = "right", size = 9, cx = 0, cy = 0, width = 2, phase = 0 }) {
  const turn = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir] ?? 0,
    c = Math.cos(turn),
    s = Math.sin(turn),
    at = (x, y) => [cx + x * c - y * s, cy + x * s + y * c],
    h = size / 2;
  return stroke({ seed, points: [at(-h * 0.6, -h), at(h * 0.6, 0), at(-h * 0.6, h)], width, amp: 0.2, phase, taper: false });
}

/* ---------- the sprout ---------- */

/** Diana's two leaves (the sprout of the title and the orbit's marker), the
 * outline game.js used to hard-code, with every control point nudged by up to
 * a pixel and a half so each node grows its own. Origin at the stem's foot,
 * the leaves up and to both sides (y negative). */
export function sprout({ seed, scale = 1 }) {
  const r = rng(hashSeed(seed, "sprout")),
    j = (v) => (v + (r() * 2 - 1) * 1.1) * scale,
    P = (x, y) => `${fmt(j(x))} ${fmt(j(y))}`,
    left = `M0 0C${P(-7, -2)} ${P(-9, -9)} ${P(-6, -13)}C${P(-1, -11)} ${P(1, -5)} 0 0Z`,
    right = `M0 0C${P(5, -1)} ${P(9, -6)} ${P(9, -11)}C${P(4, -11)} ${P(0, -6)} 0 0Z`;
  return { d: left + right, box: [-11 * scale - 1.5, -14 * scale - 1.5, 10 * scale + 1.5, 1.5], meta: { leaves: 2 } };
}
