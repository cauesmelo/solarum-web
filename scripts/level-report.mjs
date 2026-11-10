/** Authoring report for one level (RESEARCH_PROGRESSION 7-8): the checks a
 * builder needs while solving a level, in one run, before `npm test`.
 *   node scripts/level-report.mjs <level> [--windows] [--holds] [--anchors]
 * Prints: every route at 30/60/120/240 Hz; the main route's grid audit (each
 * anchor's offset in real ms, > 35 flagged); inputs per bar, the peak bar and
 * the longest stretch without an input or a scripted event; beacon gaps and
 * the run from each beacon to the next required input. --windows adds the
 * press window of every main step (real ms, narrowest and median of the
 * required ones) and the decision leads; --holds the shortest hold each held
 * jump needs and how long a tap may be held. Real = simulation / clock. */
import { createGame, start, update, jump, releaseJump, dash, dive, snapshot } from "../model.mjs";
import { levelDef } from "../level.mjs";
import { playRoute } from "../tests/routes.mjs";
import { record, bake, auditAnchors } from "./bake-score.mjs";
import { nominalRun, timingWindow, holdNeed, decisionLeads, inputsOf } from "./movement-audit.mjs";
import { viewGeometry, VIEW } from "../geometry.mjs";

const n = +(process.argv[2] ?? 1);
const flag = (f) => process.argv.includes(f);
const d = levelDef(n);
const SIX = 15 / 107;
const real = (simS) => simS / d.clock;
function run(route, dt) {
  const s = start(createGame(2021, { level: n }));
  const api = {
    getState: () => snapshot(s),
    step: (t, c) => (update(s, t, c), snapshot(s)),
    jump: () => jump(s),
    releaseJump: () => releaseJump(s),
    dash: () => dash(s),
    dive: () => dive(s),
    tap: () => (jump(s), releaseJump(s)),
  };
  const r = playRoute(api, { route, dt });
  return { s, r };
}
console.log(`L${n} ${d.numeral} · ${d.title} — ${d.bpm} BPM, clock ${d.clock.toFixed(3)}`);
for (const route of ["main", "upper", "ability", "safe"]) {
  const out = [30, 60, 120, 240].map((hz) => {
    const { s } = run(route, 1 / hz);
    return `${hz}:${s.status === "won" ? "won" : `${s.status}@${Math.round(s.player.x)}`}${s.deaths ? `/${s.deaths}d` : ""}`;
  });
  const { s } = run(route, 1 / 120);
  console.log(`  ${route.padEnd(7)} ${out.join(" ")}  ${real(s.time).toFixed(1)} s real, stars ${s.stars}, great ${s.greatBanked.length}, constellations ${s.constellationsDone}/${s.chains.length}, step-ups ${s.stepUps ?? 0}`);
}
const rec = record("main", 1 / 120, n);
const baked = bake(rec);
const audit = auditAnchors(baked.anchors);
const worst = Math.max(...audit.map((a) => Math.abs(a.ms)));
console.log(`  grid: ${audit.length} anchors, worst ${real(worst / 1000) * 1000 | 0} ms real; ${(baked.end / 16).toFixed(2)} bars`);
for (const a of audit) if (flag("--anchors") || Math.abs(a.ms) / d.clock > 35) console.log(`    ${a.name.padEnd(12)} ${String(a.id ?? "").padEnd(18)} x ${a.x.toFixed(1).padStart(8)} k ${a.k.toFixed(2).padStart(7)} /${a.grid} ${(a.ms / d.clock).toFixed(1).padStart(6)} ms${Math.abs(a.ms) / d.clock > 35 ? "  <<<" : ""}`);
// Inputs per bar, from the pilot's presses; events that count as "something
// happens" for the 2-bar rule (beacons, GETs, scripted world events).
const presses = rec.result.actions.filter((q) => q.action !== "releaseJump");
const bars = Math.round(baked.end / 16);
// Inputs (movement-audit inputsOf): presses plus held-cape presses and
// releases in the air, from the nominal 120 Hz run.
const nom = nominalRun(n);
const inputs = inputsOf(nom).map((q) => ({ time: q.tick / 120, kind: q.kind }));
const perBar = Array.from({ length: bars }, () => 0);
for (const p of inputs) perBar[Math.min(bars - 1, Math.floor(p.time / SIX / 16))]++;
console.log(`  inputs: ${inputs.length} in ${bars} bars = ${(inputs.length / bars).toFixed(2)}/bar (${presses.length} presses), peak ${Math.max(...perBar)}; per bar ${perBar.join(" ")}`);
const marks = [0, ...inputs.map((p) => p.time / SIX), ...rec.events.filter((e) => ["checkpoint", "get", "moment"].includes(e.name)).map((e) => e.time / SIX), baked.end].sort((a, b) => a - b);
let gap = 0, at = 0;
for (let i = 1; i < marks.length; i++) if (marks[i] - marks[i - 1] > gap) ((gap = marks[i] - marks[i - 1]), (at = marks[i - 1]));
console.log(`  longest stretch without an input or event: ${(gap / 16).toFixed(2)} bars from k ${at.toFixed(1)}`);
const xs = [d.level.startX, ...d.checkpoints.map((c) => c.x), d.level.finishX];
console.log(`  beacon gaps (s real): ${xs.slice(1).map((x, i) => (real((x - xs[i]) / 270)).toFixed(1)).join(" ")}`);
if (flag("--windows") || flag("--holds")) {
  const windows = nom.plan.map(([, a], i) => (a === "glide" || a === "unglide" ? null : timingWindow(n, nom, i))).filter(Boolean);
  const req = windows.filter((w) => w.required);
  if (flag("--windows")) {
    for (const w of windows) console.log(`    ${String(w.i).padStart(2)} ${w.step.join(" ").padEnd(24)} ${w.required ? "REQ" : "opt"} ${w.works ? `${w.widthMs.toFixed(0).padStart(4)} ms (-${w.earlyMs.toFixed(0)} +${w.lateMs.toFixed(0)}) ${w.loEnd}/${w.hiEnd}` : "FAILS AS AUTHORED"}  ${nom.steps[w.i].kind} -> ${nom.steps[w.i].land}`);
    const ms = req.map((w) => w.widthMs).sort((a, b) => a - b);
    console.log(`  windows: ${req.length} required, narrowest ${ms[0]?.toFixed(0)} ms, median ${ms[Math.floor(ms.length / 2)]?.toFixed(0)} ms`);
    const view = viewGeometry(Math.max(VIEW.minWidth, d.view?.minWidth ?? 0));
    for (const l of decisionLeads(n, nom, windows, view))
      if ((l.edgeLeadS !== null && l.edgeLeadS < 1.5) || (l.commits && !(l.landingLeadS > 0))) console.log(`    LEAD step ${l.i} ${l.step.join(" ")}: edge ${l.edgeLeadS?.toFixed(2)} s, landing ${l.landingLeadS?.toFixed(2)}`);
  }
  if (flag("--holds"))
    nom.plan.forEach(([, a], i) => {
      if (a !== "jump" && a !== "tap") return;
      const h = holdNeed(n, nom, i, { maxMs: 400 });
      const bad = h.tap ? !(h.longestMs >= 200) : !(h.shortestMs !== null && h.shortestMs <= 250);
      console.log(`    hold ${String(i).padStart(2)} ${nom.plan[i].join(" ").padEnd(24)} ${h.tap ? `tap ok to ${h.longestMs?.toFixed(0)} ms` : `needs ${h.shortestMs?.toFixed(0)} ms`}${bad ? "  <<<" : ""}`);
    });
}
