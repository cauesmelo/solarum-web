/** RESEARCH_REFILLS model rules: the cape star and the leaf star (lit only
 * while their resource is spent, dormant stars untouched: C11), their
 * contact buffers (C12), restore on respawn (C15), each verb's refill only
 * (C16), relics as pure data with their event, and the cape press buffer
 * (the milestone-A critic: a press up to 0.14 s real before a refill or a
 * column's edge flies when it can). Fixtures: a flat world built from IV's
 * definition (clock 1). */
import test from "node:test";
import assert from "node:assert/strict";
import { createGame, start, update, jump, dash, retry, snapshot, setAssist, TICK } from "../model.mjs";
import { levelDef, LEVEL_ID } from "../level.mjs";

function world({ verbs = {}, refills = [], gets = [], updrafts = [], checkpoints = [], clock = null, def: extra = {} } = {}) {
  const base = levelDef(LEVEL_ID["way-down"]);
  const def = {
    ...base,
    clock: clock ?? base.clock,
    capeRule: "breath",
    verbs: { double: true, cape: true, glide: true, dive: true, super: false, ...verbs },
    gets,
    level: { ...base.level, startX: 220, startY: 540, finishX: 1e6 },
    main: [["floor", -400, 540, 20000]],
    high: [],
    updrafts,
    cascades: [],
    chains: [],
    great: [],
    prompts: [],
    stars: [],
    checkpoints,
    refills,
    ...extra,
  };
  return start(createGame(1, { def }));
}
const ticks = (s, n, controls = {}) => {
  for (let i = 0; i < n; i++) update(s, TICK, controls);
};
const refillOf = (s, id) => snapshot(s).refills.find((q) => q.id === id);
/** Diana's body centre `n` ticks ahead of state s (a clone flies on). */
function ahead(s, n, controls = {}) {
  const c = structuredClone(s);
  ticks(c, n, controls);
  return { x: c.player.x, y: c.player.y - 36 };
}
/** Put refill star `id` of s on its own path `n` ticks ahead. */
function place(s, id, n, controls) {
  const q = s.refillStars.find((r) => r.id === id);
  Object.assign(q, ahead(s, n, controls));
  return q;
}

test("C11/C16: a cape star is lit only while the bar is not full; dormant, a touch leaves it in place, and a later lit touch in the same airtime works", () => {
  // Diana's body centre runs at y 504 on the floor; jump and fly through
  // the star twice: first with a full bar (dormant), then empty (lit).
  const s = world({ refills: [{ id: "c1", kind: "cape", x: 420, y: 504 }, { id: "c2", kind: "cape", x: 900, y: 440 }] });
  assert.equal(refillOf(s, "c1").lit, false, "a full bar: dormant");
  while (s.player.x < 470) update(s, TICK);
  assert.equal(refillOf(s, "c1").taken, false, "running through a dormant star leaves it");
  assert.equal(s.capeCharge, 1);
  jump(s);
  ticks(s, 12);
  assert.equal(dash(s), true);
  assert.equal(s.capeCharge, 0);
  assert.equal(refillOf(s, "c2").lit, true, "it wakes the instant the bar is spent");
  place(s, "c2", 30);
  const jumps = s.player.jumps;
  let serial = s.eventSerial;
  ticks(s, 31);
  const ev = s.events.filter((e) => e.serial > serial);
  assert.ok(ev.some((e) => e.name === "refill-star" && e.kind === "cape" && e.type === "refill-star"), "the refill-star event");
  assert.ok(ev.some((e) => e.name === "refill" && e.source === "cape-star"), "the breath refill event");
  assert.equal(s.capeCharge, 1);
  assert.equal(s.player.jumps, jumps, "a cape star never changes the jumps");
  assert.equal(refillOf(s, "c2").taken, true);
  // Neither counts as a star.
  assert.equal(s.stars, 0);
  assert.equal(snapshot(s).starsTotal, 0);
  // Endless cape: always dormant.
  const e = world({ refills: [{ id: "c", kind: "cape", x: 600, y: 504 }] });
  setAssist(e, "endlessCape", true);
  jump(e);
  ticks(e, 10);
  dash(e);
  assert.equal(refillOf(e, "c").lit, false);
});
test("C11/C16: a leaf star is lit only in the air with no air jump left; it gives one back and never touches the bar", () => {
  const s = world({ refills: [{ id: "l", kind: "leaf", x: 520, y: 360 }] });
  assert.equal(refillOf(s, "l").lit, false, "on the ground: dormant");
  jump(s);
  ticks(s, 6);
  assert.equal(refillOf(s, "l").lit, false, "the double still in hand: dormant");
  assert.equal(jump(s), true, "the double");
  assert.equal(refillOf(s, "l").lit, true, "it wakes the instant the double is spent");
  place(s, "l", 20);
  const charge = s.capeCharge;
  let got = false;
  for (let i = 0; i < 120 && !s.player.grounded; i++) {
    update(s, TICK);
    if (refillOf(s, "l").taken && !got) {
      got = true;
      assert.equal(s.player.jumps, 1, "one air jump back");
      assert.equal(s.capeCharge, charge, "a leaf star never changes the bar");
      assert.equal(jump(s), true, "a third jump");
      assert.equal(s.events.at(-1).name, "double-jump");
    }
  }
  assert.ok(got, "touched");
  // Without the double jump owned it never lights.
  const one = world({ verbs: { double: false }, refills: [{ id: "l", kind: "leaf", x: 400, y: 440 }] });
  jump(one);
  ticks(one, 20);
  assert.equal(refillOf(one, "l").lit, false);
});
test("C12: a cape press up to 0.14 s real before a lit cape star flies on the contact tick at every rate; 0.15 s before does nothing", () => {
  // A flight spends the bar, then a cape star sits on the fall after it; the
  // press comes `lead` s (real, x clock 1.15) before the contact. Frames of
  // 30-240 Hz deliver the press at the frame that contains its tick.
  const contact = (hz, lead) => {
    const s = world({ clock: 1.15, refills: [{ id: "c", kind: "cape", x: 0, y: 0 }] });
    jump(s);
    ticks(s, 10);
    dash(s);
    place(s, "c", 40);
    const probe = structuredClone(s);
    let t = 0;
    while (!probe.refillStars[0].taken && t < 400) (update(probe, TICK), t++);
    const pressAt = t - Math.round((lead * 1.15) / TICK);
    const n = Math.round(120 / hz);
    const flights = s.flights;
    let flew = null;
    for (let i = 0; i < 400 && !s.player.grounded; i += n) {
      if (pressAt >= i && pressAt < i + n) dash(s);
      if (flew === null && s.flights > flights) flew = i;
      update(s, n * TICK);
      if (flew === null && s.flights > flights) flew = i + n;
    }
    return { t, flew, n };
  };
  for (const hz of [30, 60, 120, 240]) {
    const a = contact(hz, 0.1);
    assert.ok(a.flew !== null && a.flew >= a.t && a.flew - a.t < a.n, `${hz} Hz: a press 0.10 s early flies at the contact (${a.flew} vs ${a.t})`);
  }
  const edge = contact(120, 0.135);
  assert.equal(edge.flew, edge.t, "0.135 s early: still on the contact tick");
  const early = contact(120, 0.16);
  assert.equal(early.flew, null, "0.16 s early: the press is gone, the star only fills the bar");
});
test("C12: a jump press up to 0.14 s real before a lit leaf star (no jump in hand) is the double on the contact tick", () => {
  const go = (lead) => {
    const s = world({ refills: [{ id: "l", kind: "leaf", x: 0, y: 0 }] });
    jump(s);
    ticks(s, 4);
    jump(s);
    place(s, "l", 60);
    const probe = structuredClone(s);
    let t = 0;
    while (!probe.refillStars[0].taken && t < 300) (update(probe, TICK), t++);
    const pressAt = t - Math.round(lead / TICK);
    let dbl = null;
    for (let i = 0; i < 300 && !s.player.grounded; i++) {
      if (i === pressAt) jump(s);
      const before = s.eventSerial;
      update(s, TICK);
      if (s.events.some((e) => e.serial > before && e.name === "double-jump")) dbl ??= i + 1;
    }
    return { t, dbl };
  };
  const a = go(0.1);
  assert.equal(a.dbl, a.t, "the double fires on the contact tick");
  const b = go(0.16);
  assert.equal(b.dbl, null, "0.16 s early: nothing (the press waited for a touch-down)");
});
test("the cape press buffer: a press just before a refill in the air, or inside a column, flies when it can; a touch-down drops it", () => {
  // A constellation-like refill: Endless off, bar empty, then refilled by a
  // cape star 6 ticks after the press.
  const s = world({ refills: [{ id: "c", kind: "cape", x: 0, y: 0 }] });
  jump(s);
  ticks(s, 8);
  dash(s);
  ticks(s, 70);
  assert.equal(s.capeCharge, 0);
  assert.equal(dash(s), false, "an empty bar: the press waits");
  assert.ok(s.capeBuffer > 0);
  ticks(s, 6);
  s.capeCharge = 1;
  let before = s.eventSerial;
  ticks(s, 1);
  assert.ok(s.events.some((e) => e.serial > before && e.name === "dash"), "it flies the tick the bar is full");
  // Inside a column the press waits for its edge.
  const w = world({ updrafts: [{ id: "u", x: 300, width: 200, top: 0, bottom: 900 }] });
  jump(w);
  while (w.player.x < 470) update(w, TICK);
  assert.equal(dash(w), false, "in the wind: no flight");
  before = w.eventSerial;
  let at = null;
  for (let i = 0; i < 60; i++) {
    update(w, TICK);
    if (at === null && w.events.some((e) => e.serial > before && e.name === "dash")) at = w.player.x;
  }
  assert.ok(at !== null && at > 500 && at < 520, `flies as she leaves the column (x ${at?.toFixed(1)})`);
  // A press too long before the refill is dropped, and so is one cut by a touch-down.
  const g = world();
  jump(g);
  ticks(g, 8);
  dash(g);
  ticks(g, 4);
  dash(g);
  for (let i = 0; i < 200 && !g.player.grounded; i++) update(g, TICK);
  assert.equal(g.capeBuffer, 0, "the touch-down drops a waiting press");
});
test("C15: refill stars after the beacon return on a fall and on Back to last light; those before it stay taken; none on a timer", () => {
  const s = world({
    refills: [{ id: "before", kind: "cape", x: 500, y: 470 }, { id: "after", kind: "cape", x: 1500, y: 470 }],
    checkpoints: [{ id: "b", x: 1000, y: 540, platform: "floor", story: "", tip: "" }],
  });
  const take = (x) => {
    while (s.player.x < x - 160) update(s, TICK);
    jump(s);
    ticks(s, 6);
    dash(s); // spend the bar so the star is lit
    while (!s.player.grounded) update(s, TICK);
  };
  take(500);
  assert.equal(refillOf(s, "before").taken, true);
  while (s.player.x < 1100) update(s, TICK);
  assert.equal(s.checkpoint.id, "b");
  take(1500);
  assert.equal(refillOf(s, "after").taken, true);
  ticks(s, 600);
  assert.equal(refillOf(s, "after").taken, true, "no timed respawn");
  retry(s);
  assert.equal(refillOf(s, "after").taken, false, "restored after the beacon");
  assert.equal(refillOf(s, "before").taken, true, "still taken before it");
});
test("relics: every GET is a relic in getState (id, verb, x, y, taken) and its pickup emits a relic event with the verb", () => {
  const s = world({ verbs: { double: false }, gets: [{ id: "leaf-relic", verb: "double", x: 700 }] });
  const r = snapshot(s).relics;
  assert.deepEqual(r, [{ id: "leaf-relic", verb: "double", x: 700, y: 500, taken: false }]);
  const serial = s.eventSerial;
  while (s.player.x < 710) update(s, TICK);
  const e = s.events.find((q) => q.serial > serial && q.name === "relic");
  assert.deepEqual({ type: e.type, verb: e.verb, x: e.x, y: e.y }, { type: "relic", verb: "double", x: 700, y: 500 });
  assert.ok(s.events.some((q) => q.serial > serial && q.name === "get" && q.verb === "double"), "the get event stays");
  assert.equal(snapshot(s).relics[0].taken, true);
  assert.equal(s.verbs.double, true);
});
