/* The hand-drawn UI marks (ink-mark.mjs): pure geometry, so everything is
 * checked on the numbers: a seed fixes a mark for good, no two seeds draw the
 * same ring, the boil's phases differ by a few tenths of a pixel only, every
 * mark stays inside the box the glue gives it, and a ring really overshoots
 * its own start. The drawing itself is judged in Chrome (the root QA and the
 * screenshots in common/artifacts/revision-5/solarum-ink-ui). */
import test from "node:test";
import assert from "node:assert/strict";
import * as m from "../ink-mark.mjs";

const SEEDS = Array.from({ length: 40 }, (_, i) => m.hashSeed("stop", i + 1));
const finite = (d) => !/NaN|Infinity|undefined/.test(d) && d.length > 20;
const within = (box, [x0, y0, x1, y1], slack) => box[0] >= x0 - slack && box[1] >= y0 - slack && box[2] <= x1 + slack && box[3] <= y1 + slack;

test("seeds are stable: the same name always gives the same number, and the generator is deterministic", () => {
  // Pinned: a node's drawing must not change between releases or loads.
  assert.equal(m.hashSeed("stop", 3), m.hashSeed("stop", 3));
  assert.equal(m.hashSeed("stop", 3), 530282296);
  assert.notEqual(m.hashSeed("stop", 3), m.hashSeed("stop", 4));
  const a = m.rng(7),
    b = m.rng(7);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  for (let i = 0; i < 200; i++) {
    const v = m.rng(i)();
    assert.ok(v >= 0 && v < 1);
  }
});

test("a ring is deterministic: the same seed and phase draw the same path, every call", () => {
  for (const seed of SEEDS.slice(0, 8)) {
    const one = m.ring({ seed, cx: 22, cy: 22, r: 20 }),
      two = m.ring({ seed, cx: 22, cy: 22, r: 20 });
    assert.equal(one.d, two.d);
    assert.deepEqual(one.box, two.box);
  }
  // A frozen path: change this only on purpose (it re-draws every level ring).
  const pinned = m.ring({ seed: m.hashSeed("stop", 1), cx: 22, cy: 22, r: 20 });
  assert.match(pinned.d, /^M[-\d.]+ [-\d.]+Q/);
  assert.equal(pinned.d.length, m.ring({ seed: m.hashSeed("stop", 1), cx: 22, cy: 22, r: 20 }).d.length);
});

test("no two rings are alike: 40 seeds draw 40 different paths, sweeps and drifts", () => {
  const rings = SEEDS.map((seed) => m.ring({ seed, cx: 0, cy: 0, r: 20 }));
  assert.equal(new Set(rings.map((r) => r.d)).size, rings.length, "40 distinct paths");
  assert.ok(new Set(rings.map((r) => r.meta.drift.toFixed(2))).size > 30, "the drift differs too");
  assert.ok(new Set(rings.map((r) => r.meta.start.map((v) => v.toFixed(1)).join())).size > 30, "the pen lands in different places");
});

test("a ring overshoots its own start: it sweeps past a full turn, drifts off its start radius, and no ring is a circle", () => {
  for (const seed of SEEDS) {
    const r = m.ring({ seed, cx: 0, cy: 0, r: 20 });
    // The overlap is 5.5-13% of the loop: 0.35-0.82 rad past one turn.
    assert.ok(r.meta.sweep > Math.PI * 2 * 1.05 && r.meta.sweep < Math.PI * 2 * 1.14, `sweep ${r.meta.sweep}`);
    assert.ok(r.meta.overlap >= 0.055 - 1e-9 && r.meta.overlap <= 0.13 + 1e-9);
    // The end is off the start's radius by the drift (a spiral, so the two passes are two lines).
    assert.ok(Math.abs(r.meta.drift) >= 0.9 - 1e-9 && Math.abs(r.meta.drift) <= 1.8 + 1e-9, `drift ${r.meta.drift}`);
    // Not a circle: the ink's box is not a square of side 2r (ellipse, harmonics, drift).
    const w = r.box[2] - r.box[0],
      h = r.box[3] - r.box[1];
    assert.ok(Math.abs(w - h) > 0.02 || Math.abs(r.box[0] + r.box[2]) > 0.05, "the box is not a perfect circle's");
  }
});

test("uneven stroke width: every ring's pen swells and thins, never reaches zero, never blobs", () => {
  for (const seed of SEEDS) {
    const [lo, hi] = m.ring({ seed, cx: 0, cy: 0, r: 20, width: 2.4 }).meta.widths;
    assert.ok(lo > 0.3, `thinnest ${lo}`);
    assert.ok(hi < 3.4, `thickest ${hi}`);
    assert.ok(hi - lo > 0.9, `uneven: ${lo} to ${hi}`);
  }
});

test("marks stay inside their box: the ink never leaves nominal radius plus inkReach", () => {
  for (const r of [3.2, 4.6, 9.5, 12, 20, 25]) {
    const reach = m.inkReach(r, 2.4);
    for (const seed of SEEDS)
      for (const phase of [0, 1, 2, 3]) {
        const g = m.ring({ seed, cx: 50, cy: 60, r, width: 2.4, phase });
        assert.ok(finite(g.d));
        assert.ok(within(g.box, [50 - r, 60 - r, 50 + r, 60 + r], reach), `r ${r} seed ${seed} phase ${phase}: ${g.box}`);
        const d = m.dashedRing({ seed, cx: 50, cy: 60, r, width: 2.2, phase });
        assert.ok(within(d.box, [50 - r, 60 - r, 50 + r, 60 + r], m.inkReach(r, 2.2)), `dashed r ${r}`);
        const b = m.blob({ seed, cx: 50, cy: 60, r, phase });
        assert.ok(within(b.box, [50 - r, 60 - r, 50 + r, 60 + r], b.meta.reach + 0.01), `blob r ${r}`);
      }
  }
  for (const [w, h, radius] of [[64, 34, 16], [280, 48, 17], [110, 42, 17], [300, 70, 15], [22, 22, 6]])
    for (const seed of SEEDS.slice(0, 12)) {
      const l = m.loop({ seed, w, h, radius, width: 2.5, phase: 2 });
      assert.ok(finite(l.d));
      assert.ok(within(l.box, [0, 0, w, h], m.inkReach(Math.min(w, h) / 2, 2.5)), `loop ${w}x${h}: ${l.box}`);
      const p = m.plate({ seed, w, h, radius });
      assert.ok(within(p.box, [0, 0, w, h], p.meta.reach + 0.01), `plate ${w}x${h}`);
    }
});

test("the boil: four phases are four different drawings of the same ring, a few tenths of a pixel apart", () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const ph = [0, 1, 2, 3].map((phase) => m.ring({ seed, cx: 0, cy: 0, r: 20, phase }));
    assert.equal(new Set(ph.map((r) => r.d)).size, 4, "four variants");
    for (const p of ph) {
      // Same pen: the same start, direction and overlap...
      assert.equal(p.meta.overlap, ph[0].meta.overlap);
      assert.equal(p.meta.drift, ph[0].meta.drift);
      // ...and the boxes (the largest sideways moves) differ by well under a pixel and a half.
      for (let i = 0; i < 4; i++) assert.ok(Math.abs(p.box[i] - ph[0].box[i]) < 1.5, `box ${i}: ${p.box[i]} vs ${ph[0].box[i]}`);
    }
  }
  // Phase is a variant, not a seed: out-of-range phases still draw.
  assert.ok(finite(m.ring({ seed: 5, r: 10, phase: 99 }).d));
});

test("a locked ring is dashed with irregular dashes and gaps that never touch", () => {
  for (const seed of SEEDS) {
    const d = m.dashedRing({ seed, cx: 0, cy: 0, r: 20 });
    const dashes = d.meta.dashes;
    assert.ok(dashes.length >= 7 && dashes.length <= 16, `${dashes.length} dashes`);
    const lens = dashes.map(([a, b]) => b - a),
      gaps = dashes.slice(1).map(([a], i) => a - dashes[i][1]);
    assert.ok(Math.max(...lens) / Math.min(...lens) > 1.25, "dash lengths differ");
    assert.ok(Math.max(...gaps) / Math.min(...gaps) > 1.2, "gaps differ");
    assert.ok(Math.min(...gaps) > 0.01, "dashes never touch");
    assert.ok(dashes.at(-1)[1] <= 1 && dashes[0][0] >= 0, "within one turn");
    assert.ok(finite(d.d));
  }
  // The rounded-rectangle version too.
  const l = m.loop({ seed: 3, w: 120, h: 40, radius: 14, dashed: true });
  assert.ok(l.meta.dashes.length >= 8 && finite(l.d));
});

test("links: a dotted orbit is irregular dots left to right; a drawn one is a tapering stroke that stays near its line", () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const dots = m.dots({ seed, x0: 0, x1: 14, y0: 7 });
    assert.ok(dots.meta.count >= 2 && dots.meta.count <= 4, `${dots.meta.count} dots in 14 px`);
    const xs = dots.meta.dots.map((q) => q[0]);
    assert.deepEqual(xs, [...xs].sort((a, b) => a - b), "left to right");
    assert.ok(xs[0] > -1 && xs.at(-1) < 15, "inside the link");
    const radii = dots.meta.dots.map((q) => q[2]);
    assert.ok(new Set(radii.map((v) => v.toFixed(2))).size === radii.length, "no two dots the same size");
    // (a dot is up to 1.7 px across from its centre, set up to 0.75 px off the line)
    assert.ok(within(dots.box, [0, 7, 14, 7], 3.2), `dots box ${dots.box}`);
    const line = m.line({ seed, x0: 0, x1: 14, y0: 7, width: 2.2, amp: 0.6 });
    assert.ok(within(line.box, [0, 7, 14, 7], line.meta.reach), `line box ${line.box}`);
    assert.ok(finite(line.d));
  }
  // The same seed draws the same link; a different seed does not.
  assert.equal(m.dots({ seed: 4, x1: 14 }).d, m.dots({ seed: 4, x1: 14 }).d);
  assert.notEqual(m.dots({ seed: 4, x1: 14 }).d, m.dots({ seed: 5, x1: 14 }).d);
  // A link keeps its ends on the line (it must still touch both rings).
  const pts = m.line({ seed: 9, x0: 0, x1: 40, y0: 0, width: 2 });
  assert.ok(pts.box[0] <= 0.5 && pts.box[2] >= 39.5, "spans the whole link");
});

test("the orbit line: dots along a curve follow it, and the road done is one stroke along the same curve", () => {
  const curve = m.quadPoints([10, 36], [132, -11], [254, 36], 48);
  assert.equal(curve.length, 49);
  assert.deepEqual(curve[0], [10, 36]);
  assert.deepEqual(curve.at(-1), [254, 36]);
  const xs = curve.map((p) => p[0]);
  assert.deepEqual(xs, [...xs].sort((a, b) => a - b), "x only grows (the progress clip relies on it)");
  const dotted = m.dotsAlong({ seed: 1, points: curve });
  assert.ok(dotted.meta.count > 30 && finite(dotted.d));
  const road = m.stroke({ seed: 2, points: curve, width: 2.5, amp: 0.55 });
  assert.ok(road.box[0] < 12 && road.box[2] > 252 && finite(road.d));
  assert.ok(road.meta.widths[1] - road.meta.widths[0] > 0.5, "uneven");
});

test("the sprout: two leaves, each node's pair its own drawing, inside its box", () => {
  const sprouts = SEEDS.map((seed) => m.sprout({ seed }));
  assert.equal(new Set(sprouts.map((s) => s.d)).size, sprouts.length);
  for (const s of sprouts) {
    assert.ok(finite(s.d));
    assert.equal((s.d.match(/Z/g) || []).length, 2, "two closed leaves");
    assert.ok(s.box[0] < -9 && s.box[2] > 8 && s.box[1] < -12 && s.box[3] >= 0);
  }
});

test("arrows and key caps: four directions, drawn from a seed, inside a 16 px cell", () => {
  for (const dir of ["up", "down", "left", "right"]) {
    const a = m.arrow({ seed: 5, dir, size: 14, cx: 8, cy: 8 });
    assert.ok(finite(a.d));
    assert.ok(within(a.box, [0, 0, 16, 16], 1.5), `${dir}: ${a.box}`);
    assert.equal(a.d, m.arrow({ seed: 5, dir, size: 14, cx: 8, cy: 8 }).d);
  }
  assert.notEqual(m.arrow({ seed: 5, dir: "up" }).d, m.arrow({ seed: 5, dir: "down" }).d);
  const cap = m.loop({ seed: 8, w: 24, h: 22, radius: 6, width: 1.5 });
  assert.ok(finite(cap.d) && within(cap.box, [0, 0, 24, 22], m.inkReach(11, 1.5)));
});

test("degenerate sizes do not break the pen: tiny, zero-radius corners and zero-length lines stay finite", () => {
  assert.ok(finite(m.ring({ seed: 1, r: 0.5 }).d));
  assert.ok(finite(m.loop({ seed: 1, w: 4, h: 4, radius: 0 }).d));
  assert.ok(finite(m.loop({ seed: 1, w: 30, h: 10, radius: 99 }).d));
  assert.ok(finite(m.plate({ seed: 1, w: 30, h: 10, radius: 0 }).d));
  assert.ok(Number.isFinite(m.line({ seed: 1, x0: 3, x1: 3, y0: 3 }).box[0]));
  assert.ok(finite(m.dots({ seed: 1, x0: 0, x1: 1 }).d));
});
