/** Revision eight's mix, measured in a real browser and written to
 * tests/mix-measured.json (tests/mix.test.mjs checks the rules on it and that
 * it is fresh). For every level's perfect main run, offline through the real
 * engine in Chrome (48 kHz, the full chain): BS.1770 integrated loudness of
 * the whole mix, Diana's notes (steps, stars, strings; with and without the
 * space), the soundtrack, the sky, the bed, the glide whistle and air, the
 * sample peak and the door's first 3 s; the same with the revision-seven mix
 * (`mix: "rev7"`: the saw sky, the old shimmer, no soundtrack) as "before".
 *   node scripts/mix-check.mjs [levels=1,2,...]
 * Playwright is not a dependency of this demo; PLAYWRIGHT_FROM names its folder
 * (default: the workspace's common/). Exit code 1 when a rule fails. */
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { createDemoServer } from "../serve.mjs";
import { mixSignature } from "../tests/mix-signature.mjs";
import { LEVELS } from "../level.mjs";

const from = process.env.PLAYWRIGHT_FROM ?? new URL("../../common/", import.meta.url).pathname;
const { chromium } = createRequire(from + "package.json")("playwright");
const server = createDemoServer(new URL("..", import.meta.url).pathname);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/soundboard.html`);
await page.addScriptTag({ type: "module", url: "/scripts/mix-page.mjs" });
await page.waitForFunction(() => window.__mixReady, null, { timeout: 30000 });
const NOTES = ["steps", "stars", "strings"],
  BED = ["sky", "signal", "pulse", "choir", "glass", "earth"];
const RUNS = {
  after: { full: { cues: true, air: true }, notes: { only: NOTES }, notesDry: { only: NOTES, dry: true }, tune: { only: ["tune"] }, sky: { only: ["sky"] }, bed: { only: BED }, whistle: { only: ["whistle"] }, air: { only: ["air"], air: true } },
  before: { full: { cues: true, air: true, mix: "rev7" }, notes: { only: NOTES, mix: "rev7" }, notesDry: { only: NOTES, dry: true, mix: "rev7" }, sky: { only: ["sky"], mix: "rev7" }, bed: { only: BED, mix: "rev7" } },
};
const P = (l) => 10 ** ((l + 0.691) / 10),
  L = (p) => -0.691 + 10 * Math.log10(p || 1e-20),
  r1 = (x) => (Number.isFinite(x) ? +x.toFixed(1) : null);
const ids = (process.argv[2] ? process.argv[2].split(",").map(Number) : LEVELS.map((d) => d.id)).filter((n) => LEVELS.some((d) => d.id === n));
const levels = {};
for (const level of ids) {
  const row = { key: LEVELS.find((d) => d.id === level).key };
  for (const [era, runs] of Object.entries(RUNS)) {
    const r = {};
    for (const [name, o] of Object.entries(runs)) r[name] = await page.evaluate((o) => window.__mixStem(o), { level, ...o });
    // Diana's gaps: 100 ms blocks where her dry notes are under -45 LUFS.
    const gaps = r.notesDry.ml.map((v, i) => (v < -45 ? i : -1)).filter((i) => i >= 0);
    const inGaps = (ml) => (gaps.length ? r1(L(gaps.reduce((p, i) => p + P(ml[i] ?? -200), 0) / gaps.length)) : null);
    const wash = r.notes.ml.map((v, i) => L(Math.max(0, P(v) - P(r.notesDry.ml[i]))));
    let run = 0, longest = 0;
    for (const x of wash) (run = x > -45 ? run + 0.1 : 0), (longest = Math.max(longest, run));
    row[era] = {
      full: r.full.lufs, peak: r.full.peak, door: r.full.door, doorOverRun: r1(r.full.door - r.full.lufs),
      diana: r.notes.lufs, dianaDry: r.notesDry.lufs, tune: r.tune?.lufs ?? null, sky: r.sky.lufs, bed: r.bed.lufs,
      whistle: r.whistle?.lufs ?? null, air: r.air?.lufs ?? null,
      skySounding: r.sky.sounding, skyPartials: r.sky.partials, skyCentroid: r.sky.centroid,
      gapsSeconds: r1(gaps.length / 10), skyInGaps: inGaps(r.sky.ml), washInGaps: inGaps(wash), washLongest: r1(longest), tuneInGaps: r.tune ? inGaps(r.tune.ml) : null,
      ...(r.tune ? { tunePlayed: r.tune.tune?.played, tuneLate: r.tune.tune?.lateNotes } : {}),
    };
    console.log(`L${level} ${era.padEnd(6)} ${JSON.stringify(row[era])}`);
  }
  levels[level] = row;
}
const chrome = browser.version();
await browser.close();
server.close();
if (errors.length) console.error(errors);
const out = { signature: mixSignature(), measured: new Date().toISOString(), chrome, method: "OfflineAudioContext 48 kHz, full chain, seed 3, each level's perfect main run to the door (+3 s for the door); BS.1770-4 integrated LUFS; gaps = 100 ms blocks with Diana's dry notes under -45 LUFS", levels };
await writeFile(new URL("../tests/mix-measured.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
const { rules } = await import("../tests/mix-rules.mjs");
let failed = 0;
for (const [n, row] of Object.entries(levels))
  for (const [name, ok] of rules(row.after)) if (!ok) (failed++, console.log(`FAIL L${n} ${name}`));
console.log(failed ? `${failed} rule(s) failed` : "every mix rule holds");
process.exit(failed || errors.length ? 1 : 0);
