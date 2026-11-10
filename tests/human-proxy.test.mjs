/* Human proxies (scripts/human-proxy.mjs): three people fly every level's
 * main route on the model with real-time timing error (first-timer σ 90 ms
 * and a 280 ms reaction to what each committing press lands on entering the
 * view, casual σ 60 / 230 ms, expert σ 30 / 190 ms), keys held through
 * falls. The studio's lesson: a level proven possible by a perfect pilot can
 * still be impassable for a person, or too easy. These bands are the falls
 * per run a level may cost each of them (10 seeds, deterministic), rising
 * gently from I to VIII; MOVEMENT_AUDIT records the 20-seed numbers. */
import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../level.mjs";
import { proxyStats } from "../scripts/human-proxy.mjs";

/** Mean falls per run, at most (index = level - 1). Round 8 (2026-11-10)
 * tightened IV-VIII after the hot spots were fixed: the measured 10-seed
 * means are first-timer 0 / 0.4 / 0.1 / 0.1 / 1.0 / 1.3 / 0.9 / 3.6, casual
 * 0 / 0 / 0.1 / 0 / 0.2 / 0.1 / 0.2 / 1.0 and expert clean except VIII's 0.1. */
const BANDS = {
  "first-timer": [1, 1, 1, 0.5, 1.5, 2, 1.5, 4.5],
  casual: [0.25, 0.25, 0.5, 0.25, 0.5, 0.5, 0.5, 1.5],
  expert: [0, 0, 0, 0, 0, 0.1, 0, 0.25],
};
const SEEDS = 10;

test("human proxies: every level is won by all three, within each one's falls band; the expert is clean in I-V and VII", (t) => {
  const rows = [];
  for (const d of LEVELS)
    for (const proxy of Object.keys(BANDS)) {
      const r = proxyStats(d.id, proxy, SEEDS);
      rows.push(`${d.numeral} ${proxy}: ${r.mean.toFixed(2)} falls a run (max ${r.max}, worst spot ${r.worstSpot} in a row) ${r.where.map(([w, k]) => `${w}×${k}`).join(" ")}`);
      assert.equal(r.won, SEEDS, `${d.numeral} ${proxy} wins every run`);
      const band = BANDS[proxy][d.id - 1];
      assert.ok(r.mean <= band + 1e-9, `${d.numeral} ${proxy}: ${r.mean.toFixed(2)} falls a run (band ${band})`);
      // No spot takes a first-timer three times in a row in I-V and VII; VI
      // and VIII (the wind's cracks, the last climb and the gauntlet) are
      // recorded at 3 (MOVEMENT_AUDIT has the 20- and 60-seed numbers).
      if (proxy === "first-timer") assert.ok(r.worstSpot <= (d.id === 6 || d.id === 8 ? 3 : 2), `${d.numeral}: ${r.worstSpot} falls in a row at one spot`);
    }
  for (const row of rows) t.diagnostic(row);
});
