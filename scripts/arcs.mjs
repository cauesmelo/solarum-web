/** Authoring helper (RESEARCH_LEVELS "re-solve, don't rescale"): flies a
 * move with the real model in free space and prints Diana's height on every
 * sixteenth after takeoff, so cells are solved against the integrator.
 *   node scripts/arcs.mjs <level> <move> [<move> ...]
 * A move is a comma list of action@sixteenth from the takeoff at a grid x:
 * j (jump, held), t (tap: jump then release), r (release), d (cape flight),
 * v (dive), g (hold the cape: glide from here), u (let it go). Shorthands: hold = j@0, tap = t@0, double:N = j@0,j@N,
 * flight:N = j@0,d@N. CAPE=endless keeps the cape ready (refill stand-in).
 * Rows: sixteenth, dx (run, sim px), dy at exactly that sixteenth (up < 0). */
import { createGame, update, jump, releaseJump, dash, dive, start } from "../model.mjs";
import { levelDef } from "../level.mjs";

const SIX = 15 / 107;
const expand = (m) =>
  m === "hold" ? "j@0" : m === "tap" ? "t@0" : m.startsWith("double:") ? `j@0,j@${m.slice(7)}` : m.startsWith("flight:") ? `j@0,d@${m.slice(7)}` : m;
export function fly(level, move, { sixteenths = 16, physics = null, clock = null, endless = false } = {}) {
  const base0 = levelDef(level);
  const base = { ...base0, clock: clock ?? base0.clock, physics: physics ?? base0.physics };
  const takeoff = 220 + 37.85 * 16;
  const def = {
    ...base,
    level: { ...base.level, startX: 220, startY: 540, finishX: 1e6 },
    main: [["runway", -400, 540, takeoff + 6 + 400]],
    high: [], updrafts: [], cascades: [], chains: [], great: [], prompts: [], stars: [], checkpoints: [],
  };
  const s = start(createGame(1, { def, endlessCape: endless }));
  s.physics = { ...s.physics, fallLimit: 1e9 };
  const acts = expand(move).split(",").map((a) => { const [c, n] = a.split("@"); return { c, n: +n, done: false }; });
  const t0 = (takeoff - 220) / 270;
  const out = [];
  let k = -1, launched = false, glide = false;
  while (s.time < t0 + sixteenths * SIX + 0.01 && s.status === "running") {
    if (!launched && s.player.x >= takeoff - 0.5) launched = true;
    if (launched)
      for (const a of acts) {
        if (a.done || (a.n === 0 ? false : s.time < t0 + a.n * SIX - 1e-9)) continue;
        a.done = true;
        if (a.c === "j" || a.c === "t") jump(s);
        if (a.c === "t" || a.c === "r") releaseJump(s);
        if (a.c === "d") dash(s);
        if (a.c === "v") dive(s);
        if (a.c === "g") glide = true;
        if (a.c === "u") glide = false;
      }
    const before = { t: s.time, y: s.player.y };
    update(s, 1 / 120, { glide });
    const n = Math.floor((s.time - t0) / SIX + 1e-6);
    if (launched && n > k) {
      k = n;
      // Height at exactly k sixteenths, interpolated between the two ticks.
      const tk = t0 + n * SIX, f = (tk - before.t) / (s.time - before.t);
      const y = before.y + (s.player.y - before.y) * Math.max(0, Math.min(1, f));
      out.push({ k: n, dx: +(s.player.x - takeoff).toFixed(1), dy: +(y - 540).toFixed(1), vy: Math.round(s.player.vy) });
    }
  }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const level = +(process.argv[2] ?? 1);
  const physics = process.env.PHYS ? JSON.parse(process.env.PHYS) : null;
  const clock = process.env.CLOCK ? +process.env.CLOCK : null;
  const n = +(process.env.N ?? 16);
  for (const move of process.argv.slice(3)) {
    const rows = fly(level, move, { physics, clock, sixteenths: n, endless: process.env.CAPE === "endless" });
    console.log(`L${level} ${move}: ` + rows.map((r) => `${r.k}:${r.dy}`).join(" "));
  }
}
