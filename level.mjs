/** "A Signal in the Dark": three movements of one idea each (jump, crumble,
 * cape) plus a calm coda. Coordinates are world px; y grows downward and a
 * platform's y is its walkable top. Nominal time is (x - 220) / 270 s.
 *
 * Authoring limits for the MAIN route (physical maximum in brackets, measured
 * with the 1/120 s integrator): tap gap 80 [106], full-jump gap 170 [205],
 * full-jump rise 90 [106], double-jump gap 280 [335], double-jump rise 165
 * [196], jump + flight gap 400 [450]. Every required landing leaves at least
 * 135 px of runway; every beacon leaves at least 400 px before the next
 * required input. Downward drops on any intended line stay within 240 px so
 * the vertical camera shows the landing and the death line never cuts a catch.
 */
export const BEAT = 60 / 88; // GDD tempo (unconfirmed); 184 px of run per beat
export const LEVEL = Object.freeze({
  title: "A Signal in the Dark",
  speed: 270,
  startX: 220,
  startY: 540,
  finishX: 22180,
  finishY: 470,
  beat: BEAT,
});
/** Three movement title cards only; the coda arrives without a card. */
export const MOVEMENTS = Object.freeze([
  { id: "I", x: -1000, numeral: "I", name: "Waking" },
  { id: "II", x: 6280, numeral: "II", name: "The Breaking Constellation" },
  { id: "III", x: 14200, numeral: "III", name: "Borrowed Wind" },
  { id: "coda", x: 21440, numeral: "", name: "The Far Door" },
]);
/** Title-card and story timing, in SIMULATION seconds so they scroll with
 * the world (and never linger after a fast-forward, pause or respawn). Card
 * I appears 0.7 s after waking; II and III when Diana crosses their x. */
export const CARD = Object.freeze({
  wakeDelay: 0.7,
  fadeIn: 0.3,
  hold: 1.6,
  fadeOut: 0.5,
  storySeconds: 3,
  tipSeconds: 3,
});
/** Beat-chart steps (kept as `SECTIONS` for older QA that reads section names). */
export const SECTIONS = Object.freeze([
  { x: -1000, movement: "I", step: "introduce", name: "I · Waking" },
  { x: 1100, movement: "I", step: "develop", name: "I · Waking — four hops" },
  { x: 3300, movement: "I", step: "twist", name: "I · Waking — the long leap" },
  { x: 4000, movement: "I", step: "conclude", name: "I · Waking — the climb" },
  { x: 6280, movement: "II", step: "introduce", name: "II · The Breaking Constellation" },
  { x: 8270, movement: "II", step: "develop", name: "II · The Breaking Constellation — the ridge" },
  { x: 10440, movement: "II", step: "twist", name: "II · The Breaking Constellation — the well and the wave" },
  { x: 13300, movement: "II", step: "conclude", name: "II · The Breaking Constellation — the crown" },
  { x: 14200, movement: "III", step: "introduce", name: "III · Borrowed Wind" },
  { x: 15540, movement: "III", step: "develop", name: "III · Borrowed Wind — two voids" },
  { x: 17450, movement: "III", step: "twist", name: "III · Borrowed Wind — the updraft" },
  { x: 19350, movement: "III", step: "conclude", name: "III · Borrowed Wind — everything" },
  { x: 21440, movement: "coda", step: "coda", name: "The Far Door" },
]);
/** Beacons: right before each first required use of a mechanic and never more
 * than 14 s of nominal run apart (tested). `story` is the one line shown when
 * the beacon lights; `tip` appears only after three falls since that beacon. */
export const CHECKPOINTS = Object.freeze([
  {
    id: "leap",
    x: 2900,
    y: 490,
    platform: "leap-shore",
    story: "There it was again: the signal, somewhere ahead. She ran toward it.",
    tip: "Jump at the edge, then jump again near the top to fly farther.",
  },
  {
    id: "breaking",
    x: 6670,
    y: 470,
    platform: "gate-2",
    story: "Some stars are too tired to hold her. She is light enough.",
    tip: "Cracked stone gives way soon after you land. Jump off it quickly.",
  },
  {
    id: "well",
    x: 10440,
    y: 480,
    platform: "b3-isle",
    story: "Under the cracks, something was still shining.",
    tip: "Hop as soon as you land. The falling wave is catching up.",
  },
  {
    id: "hearth",
    x: 14200,
    y: 340,
    platform: "hearth",
    story: "A warm stone. A breath. The signal is louder here.",
    tip: "Jump at the edge, then press the cape at the top of the jump.",
  },
  {
    id: "voids",
    x: 15540,
    y: 400,
    platform: "wind-shore",
    story: "The cape remembers the wind of home.",
    tip: "Gather every star of the constellation; it gives the cape back.",
  },
  {
    id: "updraft",
    x: 17480,
    y: 470,
    platform: "wind-gate",
    story: "Wind rises where the dark is deepest.",
    tip: "Jump into the wind at the edge. Hold the cape there to rise.",
  },
  {
    id: "finale",
    x: 19380,
    y: 470,
    platform: "finale-gate",
    story: "Somewhere ahead, a little blue world is listening.",
    tip: "The low road is slower, but it is safe.",
  },
]);
export const START_TIP = "Jump when you reach the edge. Hold for a higher leap.";
// [id, x, top y, width, type?] — types: crumble (drops 0.65 s after first
// landing), lid (cracked cover: holds a run, breaks under a dive), cascade
// (drops on the beat wave). Untyped platforms are stable stone.
const MAIN = [
  // I · Waking — introduce: 2.5 s of flat ground, tap / hold star rows.
  ["home", -700, 540, 1800],
  // develop: four different hops. The first is a forgiving 90 px flat gap a
  // 0 ms tap clears; then a rise onto a small rock, a short tap-hop onto a
  // higher slab, and a drop to a long low island.
  ["hop-a", 1190, 540, 260],
  ["hop-b", 1570, 500, 190],
  ["hop-c", 1840, 470, 300],
  ["hop-d", 2260, 520, 450],
  // B1, then the twist: a 260 px flat gap that only a late second jump spans.
  ["leap-shore", 2830, 490, 500],
  ["far-shore", 3590, 490, 410],
  // conclude: 165 px climb, tap hop, long late-double gap.
  ["climb-base", 4110, 500, 380],
  ["climb-crown", 4630, 335, 400],
  ["crown-step", 5110, 335, 250],
  ["long-landing", 5620, 400, 520],
  // II · The Breaking Constellation
  ["gate-2", 6260, 470, 860],
  ["first-crack", 7190, 430, 330, "crumble"],
  ["crack-floor", 7150, 560, 650],
  ["second-crack", 7900, 500, 300, "crumble"],
  ["beat-isle", 8220, 480, 480],
  // develop: the ridge changes rhythm: a wide island, a quick double hop over
  // a small stepping stone, a drop, then a rise.
  ["ridge-a", 8820, 450, 360],
  ["ridge-stone", 9270, 430, 120],
  ["ridge-b", 9480, 490, 320],
  ["ridge-c", 9930, 440, 370],
  ["b3-isle", 10420, 480, 560],
  ["well-rim-a", 11100, 470, 120],
  ["lid", 11220, 470, 220, "lid"],
  ["well-rim-b", 11440, 470, 260],
  ["tile-0", 11820, 470, 170, "cascade"],
  ["tile-1", 12060, 470, 170, "cascade"],
  ["tile-2", 12300, 470, 170, "cascade"],
  ["tile-3", 12540, 470, 170, "cascade"],
  ["tile-4", 12780, 470, 170, "cascade"],
  ["tile-5", 13020, 470, 170, "cascade"],
  ["cascade-end", 13300, 470, 360],
  ["last-crack", 13770, 460, 300, "crumble"],
  // conclude: a double jump off the cracked shelf onto the crown, which is
  // also the hearth (B4): three calm seconds and a story line.
  ["hearth", 14200, 340, 900],
  // III · Borrowed Wind — introduce: a 380 px void with a drawn flight line.
  ["wind-shore", 15480, 400, 540],
  // develop: two voids split by a cracked shelf that does not refill.
  ["split-crack", 16380, 400, 210, "crumble"],
  ["split-far", 16950, 400, 380],
  // twist: jump (or walk) into the updraft; it lifts Diana to the high shore.
  ["wind-gate", 17450, 470, 620],
  // The lifted shore carries a second cracked lid: an optional dive into a
  // star cache (a constellation) that rejoins the route below.
  ["lifted-shore", 18370, 300, 190],
  ["lid-2", 18560, 300, 250, "lid"],
  ["lifted-down", 18930, 400, 300],
  // conclude: fragile launch, flight, refill, flight, updraft.
  ["finale-gate", 19350, 470, 520],
  ["finale-crack", 19990, 440, 200, "crumble"],
  ["finale-high", 21080, 330, 300],
  // coda: a long calm island and the far door.
  ["far-door", 21440, 470, 1300],
];
// Optional mastery and safe alternate lines. They all rejoin the main route.
const HIGH = [
  ["gs1-ledge", 4080, 320, 200],
  ["high-crown", 5420, 215, 170],
  ["chain-a", 8880, 320, 200, "crumble"],
  ["chain-b", 9210, 300, 200, "crumble"],
  ["chain-c", 9540, 320, 200, "crumble"],
  ["chain-exit", 9880, 320, 220],
  ["well-floor", 11150, 640, 520],
  ["well-exit", 11700, 530, 210],
  ["star-cache", 18520, 470, 380],
  // the lower safe line of the finale: jumps only, slower, always stable.
  ["low-a", 20190, 560, 260],
  ["low-b", 20560, 560, 540],
  ["low-c", 21210, 560, 200],
];
/** Solar-wind columns: x / width in world px, top / bottom bound the body
 * centre. The whole column is drawn, so the decision is made with it in view. */
const UPDRAFTS = [
  // A gentle breeze over the hearth: solid stone below, so glide is learnt
  // where nothing can go wrong.
  { id: "breeze", x: 14330, width: 160, top: 150, bottom: 336, gentle: true },
  { id: "first-wind", x: 18080, width: 180, top: 160, bottom: 720 },
  { id: "finale-wind", x: 20860, width: 170, top: 150, bottom: 480 },
];
const CASCADES = [
  {
    id: "wave",
    tiles: ["tile-0", "tile-1", "tile-2", "tile-3", "tile-4", "tile-5"],
    // The wave drops one tile per beat (88 BPM, 0.68 s). Tiles are 240 px
    // apart, so the wave travels 352 px/s against Diana's 270: it starts
    // 430 px of run behind (tile 0 falls when she is 430 px past its start)
    // and gains 56 px per beat, until tile 5 drops when she is 150 px into
    // it. A hop at each edge always lands in time; a late coyote hop on the
    // last tiles does not.
    lead: 430,
    interval: BEAT,
  },
];
/** Constellations: 4–6 stars about one beat apart on a real arc or flight
 * line. Completion refills the cape midair; misses cost nothing. */
const CHAINS = [
  {
    id: "first-song",
    route: "low",
    stars: [
      [1560, 388],
      [1744, 418],
      [1928, 358],
      [2112, 388],
    ],
  },
  {
    id: "climb-song",
    route: "low",
    stars: [
      [4520, 420],
      [4600, 330],
      [4690, 270],
      [4800, 278],
    ],
  },
  {
    id: "well-song",
    route: "high",
    stars: [
      [11300, 552],
      [11480, 600],
      [11590, 600],
      [11714, 500],
      [11800, 418],
    ],
  },
  {
    id: "flight-line",
    route: "low",
    stars: [
      [15180, 205],
      [15290, 203],
      [15400, 205],
      [15480, 250],
    ],
  },
  {
    id: "split-song",
    route: "low",
    stars: [
      [16200, 262],
      [16310, 262],
      [16405, 322],
      [16510, 364],
      [16630, 284],
    ],
  },
  {
    // The second dive: under the lifted shore's lid, a cache that sings.
    id: "cache-song",
    route: "high",
    stars: [
      [18655, 400],
      [18740, 432],
      [18830, 432],
      [18925, 372],
    ],
  },
  {
    id: "finale-song",
    route: "low",
    stars: [
      [20330, 302],
      [20450, 302],
      [20560, 236],
      [20632, 222],
    ],
  },
];
/** Three Great Fallen Stars on mastery lines, each visible from the route
 * the player is already on. They never gate completion. */
const GREAT = [
  { id: "great-1", x: 4180, y: 200, line: "the ledge above the far shore" },
  { id: "great-2", x: 11390, y: 592, line: "the star well under the lid" },
  { id: "great-3", x: 18520, y: 80, line: "above the lifted shore: wind, cape, then a super jump" },
];
/** World-space glyph prompts on first need. `inputX` is the latest valid
 * input on the intended line; `[from, to]` is where performing `action`
 * hides the glyph. Tests check every prompt is on screen ≥1.5 s before
 * `inputX` with the narrowest supported view. */
const PROMPTS = [
  // Required glyphs are always shown; an optional one only appears when no
  // required glyph is due within 2 s, and `after` keeps a cluster to one
  // glyph at a time. [from, inputX] is the real window in which following
  // the glyph works (tested at `from`; tap-tested for the first jump).
  { id: "p-jump", glyph: ["up"], action: "jump", x: 1075, y: 430, from: 1000, to: 1140, inputX: 1110 },
  { id: "p-double", glyph: ["up", "up"], action: "double-jump", x: 3460, y: 330, from: 3260, to: 3620, inputX: 3340 },
  { id: "p-climb", glyph: ["up", "up"], action: "double-jump", x: 4560, y: 330, from: 4420, to: 4680, inputX: 4500 },
  { id: "p-crack", glyph: ["up"], action: "jump", x: 8120, y: 400, from: 8000, to: 8210, inputX: 8120 },
  { id: "p-lid", glyph: ["down"], action: "dive", x: 11330, y: 380, from: 11240, to: 11450, inputX: 11440, optional: true, route: "upper" },
  { id: "p-breeze", glyph: ["up", "then", "hold-right"], action: "glide", x: 14400, y: 240, from: 14290, to: 14500, inputX: 14320, optional: true, route: "ability" },
  { id: "p-cape", glyph: ["up", "then", "right"], action: "dash", x: 15110, y: 240, from: 15000, to: 15400, inputX: 15110 },
  { id: "p-updraft", glyph: ["up"], action: "jump", x: 18050, y: 380, from: 17990, to: 18100, inputX: 18080 },
  { id: "p-wind", glyph: ["hold-right"], action: "glide", x: 18170, y: 300, from: 18085, to: 18260, inputX: 18200, optional: true, after: "p-updraft", route: "ability" },
  { id: "p-super", glyph: ["right", "then", "up"], action: "super-jump", x: 18300, y: 190, from: 18262, to: 18340, inputX: 18300, optional: true, after: "p-wind", route: "upper" },
  { id: "p-lid2", glyph: ["down"], action: "dive", x: 18660, y: 220, from: 18580, to: 18790, inputX: 18780, optional: true, after: "p-super", route: "ability" },
];
export function createLevel() {
  const platforms = [
    ...MAIN.map(([id, x, y, width, type], phase) => ({
      id,
      x,
      y,
      width,
      type,
      phase,
      route: "low",
    })),
    ...HIGH.map(([id, x, y, width, type], phase) => ({
      id,
      x,
      y,
      width,
      type,
      phase: phase + 60,
      route: "high",
    })),
  ]
    .map((q) => ({
      ...q,
      crumbleAfter: q.type === "crumble" ? 0.65 : null,
      triggeredAt: null,
      collapseAt: null,
      collapsed: false,
      cascade: CASCADES.find((c) => c.tiles.includes(q.id))?.id ?? null,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const pickups = [];
  const add = (id, x, y, route = "low", extra = {}) =>
    pickups.push({ id, x, y, route, collected: false, ...extra });
  // Waking: three stars at tap height (a tap reaches them), then three at hold
  // height (only a held jump reaches them). Stars teach; they never gate.
  [505, 533, 561].forEach((x, i) => add(`tap-${i}`, x, i === 1 ? 437 : 442));
  [790, 830, 870].forEach((x, i) => add(`hold-${i}`, x, i === 1 ? 372 : 378));
  // Loose stars sketch the intended arcs over the remaining islands.
  const loose = [
    [2420, 462], [2480, 452], [2540, 462],
    [3000, 432], [3060, 420],
    [3420, 360], [3500, 262], [3580, 330],
    [5200, 280], [5270, 270],
    [5480, 160, "high"], [5540, 150, "high"], [5600, 160, "high"],
    [5800, 340], [5880, 330], [5960, 340],
    [6800, 410], [6880, 400],
    [7320, 370], [7400, 362],
    [8460, 420], [8540, 410],
    [8960, 262, "high"], [9030, 256, "high"],
    [9300, 240, "high"], [9370, 236, "high"],
    [9620, 262, "high"], [9690, 256, "high"],
    [10000, 260, "high"],
    [10600, 420], [10680, 410],
    [13420, 410], [13500, 400],
    [14720, 290], [14800, 282], [14880, 290],
    [15700, 345], [15780, 337],
    [18100, 410], [18175, 296],
    [18990, 240], [18930, 175], [18870, 165],
    [19700, 420], [20020, 400],
    [20480, 500, "high"], [20880, 500, "high"], [21260, 500, "high"],
    [21700, 410], [21780, 400], [21860, 410],
  ];
  loose.forEach(([x, y, route], i) => add(`star-${i}`, x, y, route ?? "low"));
  // The hearth breeze: a jump rises into the first two, holding the cape
  // in the wind carries Diana to the third.
  [
    [14405, 165],
    [14455, 118],
    [14505, 106],
  ].forEach(([x, y], i) => add(`breeze-${i}`, x, y, "high"));
  for (const c of CHAINS)
    c.stars.forEach(([x, y], i) =>
      add(`${c.id}-${i}`, x, y, c.route, { chain: c.id, index: i }),
    );
  for (const g of GREAT)
    add(g.id, g.x, g.y, "high", { great: true, line: g.line });
  const chains = CHAINS.map((c) => ({
    id: c.id,
    count: c.stars.length,
    got: 0,
    lastAt: -1,
    broken: false,
    complete: false,
    links: [],
  }));
  const updrafts = UPDRAFTS.map((u) => ({ ...u }));
  const cascades = CASCADES.map((c) => ({ ...c, tiles: [...c.tiles], t0: null }));
  const prompts = PROMPTS.map((q) => ({ ...q, glyph: [...q.glyph], done: false }));
  return { platforms, pickups, chains, updrafts, cascades, prompts };
}
export function sectionAt(x) {
  return SECTIONS.filter((q) => x >= q.x).at(-1) || SECTIONS[0];
}
export function movementAt(x) {
  return MOVEMENTS.filter((q) => x >= q.x).at(-1) || MOVEMENTS[0];
}
export function checkpointIndex(id) {
  return CHECKPOINTS.findIndex((q) => q.id === id);
}
/** Which glyph prompts are on display for Diana at x (pure, shared with the
 * renderer). A prompt with `after` waits until that one is done or passed;
 * optional glyphs stay hidden while a required one is due within 2 s of run
 * (540 px), so a cluster never shows several instructions at once. */
export function shownPrompts(prompts, x) {
  const byId = new Map(prompts.map((q) => [q.id, q]));
  const ready = (q) => {
    const a = q.after && byId.get(q.after);
    return !a || a.done || x > a.to + 40;
  };
  const live = prompts.filter((q) => !q.done && x <= q.to + 40 && ready(q));
  const due = live.some((q) => !q.optional && q.inputX - x <= 540 && q.inputX - x >= -40);
  return live.filter((q) => !q.optional || !due);
}

