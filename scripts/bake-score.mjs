/** Bake the path clock: run the main-route pilot at 120 Hz and store world x
 * -> score position (in 107 BPM sixteenths from waking) plus every musical
 * anchor the pilot produces. The music engine uses it to tell which bar and
 * chord a place belongs to (respawns, sync anchors) and which stars are the
 * "intended" notes of the song; the tests use it to keep the level on grid.
 *
 *   npm run score:bake            writes score-path.mjs and prints the audit
 *   node scripts/bake-score.mjs --check   exit 1 if score-path.mjs is stale
 *
 * The audit lists every anchor's offset from its grid in ms and the px nudge
 * that would fix it (offset x local horizontal speed). Tolerances (120 Hz,
 * RESEARCH_MUSIC 5.3): stars, takeoffs, landings and chain notes within
 * 35 ms of a sixteenth; constellation completions on an eighth; beacons on
 * a half bar; cascade tiles on a beat. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createGame, start, update, jump, releaseJump, dash, dive, snapshot } from "../model.mjs";
import { playRoute } from "../tests/routes.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
export const SIXTEENTH = 15 / 107; // s
const STEP_PX = 25;
/** Event -> grid (in sixteenths) it must sit on. */
export const ANCHOR_GRID = {
  jump: 1,
  "double-jump": 1,
  dash: 1,
  "super-jump": 1,
  land: 1,
  star: 1,
  "chain-note": 1,
  constellation: 2,
  checkpoint: 8,
  "tile-drop": 4,
  movement: 8,
};

export async function sourceHash() {
  const h = createHash("sha256");
  for (const name of ["level.mjs", "model.mjs", "tests/routes.mjs"]) h.update(await readFile(new URL(`../${name}`, import.meta.url)));
  return h.digest("hex").slice(0, 16);
}

/** Run a route and record its trajectory and events (pure model, no DOM). */
export function record(route = "main", dt = 1 / 120) {
  const s = start(createGame());
  const events = [];
  const samples = [];
  let seen = s.eventSerial;
  const drain = () => {
    for (const e of s.events)
      if (e.serial > seen) {
        seen = e.serial;
        events.push({ ...e });
      }
  };
  const api = {
    getState: () => snapshot(s),
    step: (d, c) => {
      samples.push([s.time, s.player.x]);
      update(s, d, c);
      drain();
      return snapshot(s);
    },
    jump: () => (jump(s), drain()),
    releaseJump: () => releaseJump(s),
    dash: () => (dash(s), drain()),
    dive: () => (dive(s), drain()),
  };
  const result = playRoute(api, { route, dt });
  samples.push([s.time, s.player.x]);
  return { s, events, samples, result };
}

export function bake({ events, samples, s }) {
  // x is strictly increasing in time (Diana never stops before the door), so
  // invert x(t) by linear interpolation between 120 Hz samples.
  const path = [];
  let j = 0;
  const x0 = samples[0][1],
    x1 = s.player.x;
  for (let x = x0; x <= x1 + 1e-6; x += STEP_PX) {
    while (j < samples.length - 2 && samples[j + 1][1] < x) j++;
    const [ta, xa] = samples[j],
      [tb, xb] = samples[j + 1];
    const t = xb > xa ? ta + ((x - xa) / (xb - xa)) * (tb - ta) : ta;
    path.push([Math.round(x * 10) / 10, Math.round((t / SIXTEENTH) * 1000) / 1000]);
  }
  const anchors = events
    .filter((e) => ANCHOR_GRID[e.name])
    .map((e) => {
      const id = e.name === "chain-note" ? `${e.chain}-${e.step}` : e.id ?? e.platform ?? e.chain ?? null;
      return { name: e.name, id, x: Math.round(e.x * 10) / 10, k: Math.round((e.time / SIXTEENTH) * 1000) / 1000, grid: ANCHOR_GRID[e.name] };
    });
  return { path, anchors, end: Math.round((s.time / SIXTEENTH) * 1000) / 1000 };
}

export function auditAnchors(anchors) {
  return anchors.map((a) => {
    const g = a.grid,
      target = Math.round(a.k / g) * g,
      ms = (a.k - target) * SIXTEENTH * 1000;
    return { ...a, target, ms };
  });
}

async function main() {
  const check = process.argv.includes("--check");
  const hash = await sourceHash();
  if (check) {
    const { PATH } = await import(`../score-path.mjs?${Date.now()}`);
    if (PATH.hash !== hash) {
      console.error(`score-path.mjs is stale (${PATH.hash} != ${hash}); run npm run score:bake`);
      process.exit(1);
    }
    console.log("score-path.mjs is fresh", hash);
    return;
  }
  const rec = record("main");
  if (rec.s.status !== "won") throw new Error(`main pilot did not win: ${rec.s.status}`);
  const baked = bake(rec);
  const audit = auditAnchors(baked.anchors);
  let worst = 0;
  for (const a of audit) {
    const speed = a.name === "dash" ? 497.1 : 270;
    worst = Math.max(worst, Math.abs(a.ms));
    console.log(
      `${a.name.padEnd(13)} ${String(a.id ?? "").padEnd(16)} x ${a.x.toFixed(1).padStart(8)}  k ${a.k.toFixed(2).padStart(7)}  grid ${String(a.grid).padStart(2)}  ${a.ms.toFixed(1).padStart(6)} ms  nudge ${((-a.ms / 1000) * speed).toFixed(1).padStart(6)} px${Math.abs(a.ms) > 35 ? "  <<<" : ""}`,
    );
  }
  console.log(`${audit.length} anchors, worst ${worst.toFixed(1)} ms; route ${(baked.end / 16).toFixed(2)} bars (${rec.s.time.toFixed(3)} s)`);
  const body = `/** Generated by scripts/bake-score.mjs from the main-route pilot at 120 Hz;
 * do not edit. \`path\` maps world x to score position in 107 BPM sixteenths
 * from waking (one sample every ${STEP_PX} px); \`anchors\` are the pilot's
 * musical events. \`hash\` covers level.mjs, model.mjs and tests/routes.mjs, and
 * a test fails when it no longer matches (run \`npm run score:bake\`). */
export const PATH = ${JSON.stringify({ hash, bpm: 107, step: STEP_PX, end: baked.end, path: baked.path, anchors: baked.anchors })};
`;
  await writeFile(new URL("../score-path.mjs", import.meta.url), body);
  console.log(`wrote score-path.mjs (${baked.path.length} samples, hash ${hash})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
