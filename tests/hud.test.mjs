/* The HUD's readings of the progression fields (hud.mjs) and the GET
 * moments (moments.mjs), on the eight-level model (RESEARCH_PROGRESSION 2.1,
 * 2.3, 3.3), plus the fallbacks for a state without those fields.
 * tests/hud-ui.test.mjs holds the renderer's static contract. */
import test from "node:test";
import assert from "node:assert/strict";
import { createGame, start, update, jump, releaseJump, dash, snapshot } from "../model.mjs";
import { owns, spriteSetName, capeMeter, capeTint, tintForCharge, TINT_STEPS, doubleInHand, assistTipDue, ASSIST_TIP_FALLS } from "../hud.mjs";
import { ANCHORS, momentSeconds, riseAt, settleAt, helperApproach, helperAfter, rippleAt, necklaceAt } from "../moments.mjs";
import { LEVELS, LEVEL_ID } from "../level.mjs";

const running = (level = 2) => {
  const s = createGame(2021, { level });
  start(s);
  update(s, 0.6);
  return s;
};
/** The breath rule's fields set to a known state. */
const withBreath = (s, extra = {}) => Object.assign(s, { capeRule: "breath", capeCharge: 0, verbs: { double: true, cape: true, glide: false, dive: false, super: false } }, extra);

test("breath bar: absent without a capeCharge field or the cape; continuous charge otherwise", () => {
  const s = running(LEVEL_ID["still-water"]);
  assert.equal(typeof s.capeCharge, "number");
  assert.equal(snapshot(s).capeCharge, s.capeCharge);
  // A state without the field (revision seven's model): no bar.
  assert.equal(capeMeter({ ...s, capeCharge: undefined }), null);
  // Level I: the cape is not owned, so the bar is absent, not empty.
  assert.equal(capeMeter(running(1)), null);
  // The breath rule: the charge as it is, full only at 1.
  withBreath(s, { capeCharge: 0.62 });
  assert.deepEqual(capeMeter(s), { charge: 0.62, full: false });
  s.capeCharge = 1;
  assert.deepEqual(capeMeter(s), { charge: 1, full: true });
  // Not owned: absent, not empty.
  s.verbs.cape = false;
  assert.equal(capeMeter(s), null);
  s.verbs.cape = true;
  // Endless cape: always full. Other rules: full or empty (the snapshot's rule).
  s.capeCharge = 0.2;
  s.assist.endlessCape = true;
  assert.equal(capeMeter(s).charge, 1);
  s.assist.endlessCape = false;
  s.capeRule = "landing";
  s.capeCharges = 1;
  assert.deepEqual(capeMeter(s), { charge: 1, full: true });
  s.capeCharges = 0;
  assert.deepEqual(capeMeter(s), { charge: 0, full: false });
  // Garbage never draws a bar.
  s.capeCharge = Number.NaN;
  assert.equal(capeMeter(s), null);
});

test("the cape tint has four steps (60/45/30/15% dim, clear at full) and keeps today's rule without a bar", () => {
  assert.deepEqual(TINT_STEPS, [0.6, 0.45, 0.3, 0.15]);
  const cases = [[0, 0.6], [0.24, 0.6], [0.25, 0.45], [0.49, 0.45], [0.5, 0.3], [0.74, 0.3], [0.75, 0.15], [0.999, 0.15], [1, 0]];
  for (const [charge, dim] of cases) assert.equal(tintForCharge(charge), dim, `charge ${charge}`);
  // VIII (its breath bar, before the GET): clear when ready, 60% once a
  // flight is spent, nothing in flight.
  const s = running(LEVEL_ID.door);
  assert.equal(capeTint(s, "cape"), 0);
  jump(s);
  update(s, 0.05);
  assert.ok(dash(s), "VIII owns the cape");
  assert.ok(s.dashRemaining > 0.08);
  assert.equal(capeTint(s, "cape"), 0, "the cape is out: no tint while she flies");
  update(s, 0.6);
  assert.equal(capeTint(s, "cape"), 0.6, "spent after the flight");
  // With the bar: its step. Without a cape: never.
  withBreath(s, { capeCharge: 0.5, dashRemaining: 0 });
  assert.equal(capeTint(s, "cape"), 0.3);
  assert.equal(capeTint(s, "nocape"), 0);
});

test("the leaf glint: the double jump is in hand on the ground and after the first jump, spent by the double, back on landing", () => {
  // (II owns the double jump from the start; I's comes at its GET.)
  assert.equal(doubleInHand(running(1)), false, "level I before its GET");
  const s = running(2);
  assert.equal(s.player.grounded, true);
  assert.equal(doubleInHand(s), true, "running: in hand");
  jump(s);
  releaseJump(s);
  update(s, 0.08);
  assert.equal(s.player.jumps, 1);
  assert.equal(doubleInHand(s), true, "after the first jump: still in hand");
  // Press again high in the arc (not just before touch-down, which buffers).
  jump(s);
  assert.equal(s.player.jumps, 2);
  assert.equal(doubleInHand(s), false, "the double is spent");
  let landed = false;
  for (let i = 0; i < 400 && !landed; i++) {
    update(s, 1 / 120);
    landed = s.player.grounded;
  }
  assert.ok(landed);
  assert.equal(doubleInHand(s), true, "landing restores it");
  // Owned only with the double jump; never while not running.
  s.verbs = { double: false, cape: false };
  assert.equal(doubleInHand(s), false);
  delete s.verbs;
  s.status = "paused";
  assert.equal(doubleInHand(s), false);
});

test("owned verbs and the sprite set read the progression fields defensively", () => {
  const s = running(1);
  // The model's field: level I starts with neither the double jump nor the cape.
  assert.equal(owns(s, "double"), false);
  assert.equal(owns(s, "cape"), false);
  assert.equal(spriteSetName(s), "nocape", "level I wears no cape");
  assert.equal(spriteSetName(s, "cape"), "cape", "QA override");
  // A state without the field: the level's def decides, and Diana keeps her cape.
  const old = { ...s, verbs: undefined };
  assert.equal(owns(old, "cape"), LEVELS[0].verbs.cape);
  assert.equal(spriteSetName(old), "cape", "no verbs field: Diana keeps her cape, as before");
  assert.equal(spriteSetName({ ...old, def: { ...old.def, sprites: "nocape" } }), "nocape", "a level's own sprites still apply");
  s.verbs = { double: true, cape: false };
  assert.equal(spriteSetName(s), "nocape", "the cape is not hers yet");
  assert.equal(owns(s, "cape"), false);
  s.verbs.cape = true;
  assert.equal(spriteSetName(s), "cape", "after the GET");
});

test("GET moments: each lasts at most one bar at every tempo; the helper meets Diana; the necklace pulses on the beats", () => {
  for (const bpm of [88, 94, 100, 107, 112, 118, 123, 128]) {
    const bar = 240 / bpm;
    for (const verb of ["double", "cape", "glide", "dive", "super"]) assert.ok(momentSeconds(verb, bar) <= bar + 1e-9, `${verb} at ${bpm}`);
    // The ripple: one pulse per beat over the bar, nothing after it.
    let peaks = 0,
      prev = 0,
      rising = false;
    for (let t = 0; t <= bar; t += bar / 400) {
      const r = rippleAt(t, bar);
      if (r < prev && rising) peaks++;
      rising = r > prev;
      prev = r;
    }
    assert.equal(peaks, 4, `${bpm} BPM ripple`);
    assert.equal(rippleAt(bar + 0.01, bar), 0);
    // The necklace: at most three rings, growing, gone by the bar's end.
    for (let t = 0; t < bar; t += 0.05) {
      const n = necklaceAt(t, bar);
      assert.ok(n.rings.length <= 3);
      for (const ring of n.rings) assert.ok(ring.r >= 6 && ring.r <= 76 && ring.alpha >= 0 && ring.alpha <= 0.7);
    }
    assert.ok(necklaceAt(bar, bar).fade < 1e-9);
    // After the GET the helper loops round her, then flies off ahead and up, fading out.
    const away = helperAfter(bar * 0.99, bar);
    assert.equal(away.phase, "away");
    assert.ok(away.dx > 300 && away.dy < -100 && away.alpha < 0.05);
  }
  // Before the GET it drifts down a long slope to her run line at the GET's x.
  let last = -Infinity;
  for (let d = 1400; d >= 0; d -= 50) {
    const a = helperApproach("glide", d, 0);
    assert.ok(a.y >= last - 6, "it only descends (within its wander)");
    last = a.y;
  }
  const meet = helperApproach("glide", 0, 0);
  assert.equal(meet.x, 0);
  assert.ok(meet.y <= -40 && meet.y >= -60, `meets her at head height (${meet.y})`);
  assert.equal(helperApproach("glide", 1500, 0).alpha, 0, "invisible far ahead");
  assert.equal(helperApproach("glide", -1, 0), null, "gone once she is past it");
  // I: the landed star rises into the leaf glint; II: the cape settles.
  const r = riseAt(1);
  assert.ok(r.done && r.dx === ANCHORS.glint.dx && r.dy === ANCHORS.glint.dy);
  assert.equal(settleAt(0).cape, 0);
  assert.equal(settleAt(0.6).cape, 1);
});

test("the assist hint is offered once per level and session, not after every respawn (the owner's video)", () => {
  // The video: five falls at VIII's summit beacon, then "Need a hand? Assists
  // are in the pause menu." came back after each of the next three respawns.
  const shown = new Set();
  const falls = [];
  for (let fallsHere = 1; fallsHere <= 9; fallsHere++) {
    const due = assistTipDue({ fallsHere, level: 8, shown, source: "beacon" });
    if (due) shown.add(8);
    falls.push(due);
  }
  assert.deepEqual(falls.map((d, i) => d && i + 1), [false, false, false, false, ASSIST_TIP_FALLS, false, false, false, false]);
  assert.equal(ASSIST_TIP_FALLS, 5);
  // Another level has its own first time; a beacon in between does not re-arm the same level.
  assert.equal(assistTipDue({ fallsHere: 5, level: 7, shown }), true);
  assert.equal(assistTipDue({ fallsHere: 6, level: 8, shown }), false);
  // Never after the player's own Back to last light, and never with an assist on.
  assert.equal(assistTipDue({ fallsHere: 9, level: 3, shown: new Set(), source: "retry" }), false);
  assert.equal(assistTipDue({ fallsHere: 9, level: 3, shown: new Set(), assistOn: true }), false);
  assert.equal(assistTipDue({ fallsHere: 9, level: 3, shown: undefined }), true, "no set yet: first time");
});
