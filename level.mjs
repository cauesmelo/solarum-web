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
 *
 * The main route is authored on the soundtrack's 107 BPM grid (RESEARCH_MUSIC
 * 5.3, LEVEL_DESIGN "Beat map"): waking is beat 0 (bar 1) and a sixteenth is
 * 15/107 s = 140.19 ms = 37.85 px of run, so the lattice of grid x positions
 * is 220 + 37.85 k (a full flight adds exactly three sixteenths, see
 * model.mjs dashSpeed). Every main-route takeoff, landing, star, constellation
 * note and beacon falls within 35 ms of a sixteenth at 120 Hz (tested), and
 * each hop uses a "rhythm cell": with takeoff on the grid, a full jump lands
 * on it again 84 px higher after 4/16, 31 px higher after 5/16, 51 px lower
 * after 6/16 (flat ground lands 59 ms off the grid, so no main hop is flat).
 * Heights below were solved against the 1/120 s integrator, not the
 * closed-form arc. After a geometry change run `npm run score:bake`.
 */
/** One beat at the soundtrack's 107 BPM (measured, README "Sound"): 0.5607 s,
 * 151.4 px of run. The GDD's 88 BPM is retired; the cascade drops on it. */
export const BEAT = 60 / 107;
export const SIXTEENTH = BEAT / 4;
export const LEVEL = Object.freeze({
  title: "A Signal in the Dark",
  speed: 270,
  startX: 220,
  startY: 540,
  // Diana reaches the door on the downbeat of bar 36 (sixteenth 560).
  finishX: 21984,
  finishY: 470,
  beat: BEAT,
});
/** Three movement title cards only; the coda arrives without a card. */
export const MOVEMENTS = Object.freeze([
  { id: "I", x: -1000, numeral: "I", name: "Waking" },
  // Cards start on the main route's grid: II on the downbeat of bar 11
  // (sixteenth 160), III with the hearth beacon on bar 23 1/2 (360), the coda
  // (no card) on the downbeat of bar 35 (544).
  { id: "II", x: 6276, numeral: "II", name: "The Breaking Constellation" },
  { id: "III", x: 13845.2, numeral: "III", name: "Borrowed Wind" },
  { id: "coda", x: 21376, numeral: "", name: "The Far Door" },
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
  { x: 10137.2, movement: "II", step: "twist", name: "II · The Breaking Constellation — the well and the wave" },
  { x: 12997.2, movement: "II", step: "conclude", name: "II · The Breaking Constellation — the crown" },
  { x: 13897.2, movement: "III", step: "introduce", name: "III · Borrowed Wind" },
  { x: 15540, movement: "III", step: "develop", name: "III · Borrowed Wind — two voids" },
  { x: 17450, movement: "III", step: "twist", name: "III · Borrowed Wind — the updraft" },
  { x: 19350, movement: "III", step: "conclude", name: "III · Borrowed Wind — everything" },
  { x: 21440, movement: "coda", step: "coda", name: "The Far Door" },
]);
/** Beacons: right before each first required use of a mechanic and never more
 * than 14 s of nominal run apart (tested). `story` is the one line shown when
 * the beacon lights; `tip` appears only after three falls since that beacon.
 * Each sits on a half-bar line of the main route (bars 5 1/2, 11 1/2, 17 1/2,
 * 23 1/2, 26, 29, 32), a few px before the grid point so it lights on it, and
 * a respawn there restarts the score on that strong beat. */
export const CHECKPOINTS = Object.freeze([
  {
    id: "leap",
    x: 2943,
    y: 496,
    platform: "leap-shore",
    story: "There it was again: the signal, somewhere ahead. She ran toward it.",
    tip: "Jump at the edge, then jump again near the top to fly farther.",
  },
  {
    id: "breaking",
    x: 6577,
    y: 471,
    platform: "gate-2",
    story: "Some stars are too tired to hold her. She is light enough.",
    tip: "Cracked stone gives way soon after you land. Jump off it quickly.",
  },
  {
    id: "well",
    x: 10211.2,
    y: 464,
    platform: "b3-isle",
    story: "Under the cracks, something was still shining.",
    tip: "Hop as soon as you land. The falling wave is catching up.",
  },
  {
    id: "hearth",
    x: 13843.2,
    y: 319,
    platform: "hearth",
    story: "A warm stone. A breath. The signal is louder here.",
    tip: "Jump at the edge, then press the cape at the top of the jump.",
  },
  {
    id: "voids",
    x: 15470,
    y: 377,
    platform: "wind-shore",
    story: "The cape remembers the wind of home.",
    tip: "Gather every star of the constellation; it gives the cape back.",
  },
  {
    id: "updraft",
    x: 17515,
    y: 478,
    platform: "wind-gate",
    story: "Wind rises where the dark is deepest.",
    tip: "Jump into the wind at the edge. Hold the cape there to rise.",
  },
  {
    id: "finale",
    x: 19330,
    y: 412,
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
  // I · Waking — introduce: 2.4 s of flat ground, tap / hold star rows.
  ["home", -700, 540, 1800],
  // develop: four different hops on the grid (takeoff sixteenths 23, 32, 40,
  // 50, 64). The first is a forgiving 105 px gap down 44 px: a 0 ms tap still
  // clears it (it reaches 133 px on the way down), but walking off the edge
  // does not (it would reach the top only 81 px out). Then an 83 px rise onto
  // a rock, a 23 px hop onto a slab and a 49 px drop to a long island: cells
  // of 6, 4, 5, 6 and 5 sixteenths.
  ["hop-a", 1205, 584, 245],
  ["hop-b", 1540, 501, 220],
  ["hop-c", 1840, 478, 300],
  ["hop-d", 2260, 527, 450],
  // B1, then the twist: a 260 px gap that only a late second jump spans
  // (second press 4/16 after the first, landing 10/16 after it, 7 px lower).
  ["leap-shore", 2790, 496, 560],
  ["far-shore", 3610, 503, 390],
  // conclude: a drop, the 162 px double climb (3/16 + 4/16), a hop, and a
  // long late double down to the landing (5/16 + 6/16).
  ["climb-base", 4110, 553, 380],
  ["climb-crown", 4630, 391, 400],
  ["crown-step", 5110, 359, 270],
  ["long-landing", 5620, 421, 520],
  // II · The Breaking Constellation
  ["gate-2", 6260, 471, 860],
  // The first crack gives way 0.65 s after landing; the floor sits 80 px
  // below so the fall lands exactly seven sixteenths after the touch-down.
  ["first-crack", 7190, 440, 330, "crumble"],
  ["crack-floor", 7150, 520, 650],
  ["second-crack", 7900, 489, 300, "crumble"],
  ["beat-isle", 8220, 457, 328.6],
  // develop: the ridge changes rhythm: a wide island, a drop onto a small
  // stepping stone and straight off it, then two rises. Beat-isle and ridge-c
  // are 151.4 px (four sixteenths) shorter each so no beacon gap exceeds 14 s.
  ["ridge-a", 8668.6, 425, 360],
  ["ridge-stone", 9148.6, 476, 120],
  ["ridge-b", 9328.6, 444, 320],
  ["ridge-c", 9748.6, 413, 248.6],
  ["b3-isle", 10117.2, 464, 560],
  ["well-rim-a", 10797.2, 432, 120],
  ["lid", 10917.2, 432, 220, "lid"],
  ["well-rim-b", 11137.2, 432, 260],
  // The beat cascade: 150 px tiles at a 207 px pitch (one per 107 BPM beat).
  // A full jump covers about one pitch, so the line is a bounce: hops of 5
  // and 6 sixteenths alternate, up 31 and down 51 px, and every touch-down
  // is also the next takeoff.
  ["tile-0", 11477.2, 400, 150, "cascade"],
  ["tile-1", 11684.2, 451, 150, "cascade"],
  ["tile-2", 11891.2, 419, 150, "cascade"],
  ["tile-3", 12098.2, 468, 150, "cascade"],
  ["tile-4", 12305.2, 437, 150, "cascade"],
  ["tile-5", 12512.2, 489, 150, "cascade"],
  // The wave ends 51 px down; a 4/16 hop rises 84 px onto the last crack.
  ["cascade-end", 12719.2, 540, 638],
  ["last-crack", 13467.2, 458, 300, "crumble"],
  // conclude: a late double jump (4/16 + 4/16) off the cracked shelf climbs
  // 139 px onto the crown, which is also the hearth (B4), landing with the
  // beacon on bar 23 1/2: four calm seconds (it took back the eight
  // sixteenths the ridge gave up, see LEVEL_DESIGN "Beat map") and a story line.
  ["hearth", 13817.2, 319, 1242.8],
  // III · Borrowed Wind — introduce: a 375 px void under a drawn flight line.
  ["wind-shore", 15435, 377, 585],
  // develop: two voids split by a cracked shelf that does not refill.
  ["split-crack", 16380, 360, 210, "crumble"],
  ["split-far", 16950, 427, 380],
  // twist: jump (or walk) into the updraft; it lifts Diana to the high shore.
  ["wind-gate", 17450, 478, 620],
  // The lifted shore carries a second cracked lid: an optional dive into a
  // star cache (a constellation) that rejoins the route below.
  ["lifted-shore", 18370, 311, 190],
  ["lid-2", 18560, 311, 250, "lid"],
  ["lifted-down", 18930, 360, 300],
  // conclude: fragile launch, flight, refill, flight, updraft.
  ["finale-gate", 19314, 412, 556],
  ["finale-crack", 19990, 381, 200, "crumble"],
  // Its end is placed so the walk-off lands on the door island on the grid.
  ["finale-high", 21080, 340, 322],
  // coda: a long calm island and the far door.
  ["far-door", 21440, 470, 1300],
];
// Optional mastery and safe alternate lines. They all rejoin the main route.
const HIGH = [
  ["gs1-ledge", 4080, 320, 200],
  ["high-crown", 5420, 215, 170],
  // The cracked chain rises with the ridge and stays more than 25 px above the
  // main line's arcs, so a ridge hop never lip-catches onto it.
  ["chain-a", 8728.6, 297, 200, "crumble"],
  ["chain-b", 9058.6, 277, 200, "crumble"],
  ["chain-c", 9388.6, 297, 200, "crumble"],
  ["chain-exit", 9728.6, 297, 220],
  ["well-floor", 10847.2, 640, 520],
  ["well-exit", 11397.2, 530, 210],
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
  { id: "breeze", x: 14027.2, width: 160, top: 129, bottom: 315, gentle: true },
  { id: "first-wind", x: 18080, width: 180, top: 171, bottom: 731 },
  // The second finale flight ends 47 px before this column, so it is a full
  // flight (the score's x lattice holds) and the wind takes over from a fall.
  { id: "finale-wind", x: 20880, width: 170, top: 150, bottom: 480 },
];
const CASCADES = [
  {
    id: "wave",
    tiles: ["tile-0", "tile-1", "tile-2", "tile-3", "tile-4", "tile-5"],
    // The wave drops one tile per 107 BPM beat (0.5607 s). Tiles are 207 px
    // apart, so the wave travels 369 px/s against Diana's 270 and gains
    // 55.6 px a beat. `lead` is px of nominal run past tile 0's start at
    // which it drops; 551 puts the main route's first drop on beat 3 of bar
    // 20 (sixteenth 312) and every later drop on a beat.
    // The bouncing line leaves tile k 13, 11, 10, 8, 7 and 5 sixteenths before
    // it falls: the wave visibly closes in, and a player may run up to about
    // 0.1 s late on every hop before the last tile catches them.
    lead: 551,
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
      [1924, 420],
      [2075, 442],
      [2228, 337],
      [2379, 491],
    ],
  },
  {
    id: "climb-song",
    route: "low",
    stars: [
      [4536, 419],
      [4613, 376],
      [4687, 327],
      [4802, 355],
    ],
  },
  {
    id: "well-song",
    route: "high",
    stars: [
      [10997.2, 552],
      [11177.2, 600],
      [11287.2, 600],
      [11411.2, 500],
      [11465, 418],
    ],
  },
  {
    id: "flight-line",
    route: "low",
    stars: [
      [15096, 178],
      [15202, 178],
      [15343, 178],
      [15436, 243],
    ],
  },
  {
    id: "split-song",
    route: "low",
    stars: [
      [16187, 241],
      [16327, 241],
      [16421, 306],
      [16535, 324],
      [16686, 219],
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
      [20349, 246],
      [20419, 246],
      [20490, 246],
      [20547, 213],
    ],
  },
];
/** Three Great Fallen Stars on mastery lines, each visible from the route
 * the player is already on. They never gate completion. */
const GREAT = [
  { id: "great-1", x: 4180, y: 200, line: "the ledge above the far shore" },
  { id: "great-2", x: 11087.2, y: 592, line: "the star well under the lid" },
  { id: "great-3", x: 18520, y: 91, line: "above the lifted shore: wind, cape, then a super jump" },
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
  { id: "p-double", glyph: ["up", "up"], action: "double-jump", x: 3460, y: 330, from: 3290, to: 3620, inputX: 3340 },
  { id: "p-climb", glyph: ["up", "up"], action: "double-jump", x: 4560, y: 350, from: 4420, to: 4680, inputX: 4500 },
  { id: "p-crack", glyph: ["up"], action: "jump", x: 8120, y: 400, from: 8030, to: 8210, inputX: 8120 },
  { id: "p-lid", glyph: ["down"], action: "dive", x: 11027.2, y: 380, from: 10937.2, to: 11147.2, inputX: 11137.2, optional: true, route: "upper" },
  { id: "p-breeze", glyph: ["up", "then", "hold-right"], action: "glide", x: 14097.2, y: 219, from: 13987.2, to: 14197.2, inputX: 14017.2, optional: true, route: "ability" },
  { id: "p-cape", glyph: ["up", "then", "right"], action: "dash", x: 15020, y: 219, from: 14980, to: 15400, inputX: 15060 },
  { id: "p-updraft", glyph: ["up"], action: "jump", x: 18050, y: 380, from: 17990, to: 18100, inputX: 18080 },
  { id: "p-wind", glyph: ["hold-right"], action: "glide", x: 18170, y: 300, from: 18085, to: 18260, inputX: 18200, optional: true, after: "p-updraft", route: "ability" },
  { id: "p-super", glyph: ["right", "then", "up"], action: "super-jump", x: 18300, y: 190, from: 18262, to: 18340, inputX: 18300, optional: true, after: "p-wind", route: "upper" },
  { id: "p-lid2", glyph: ["down"], action: "dive", x: 18660, y: 231, from: 18580, to: 18790, inputX: 18780, optional: true, after: "p-super", route: "ability" },
];
/** Today's chapter's loose stars (tap and hold rows, the loose arcs, the hearth
 * breeze) as [id, x, y, route]. */
function chapterStars() {
  const out = [];
  const add = (id, x, y, route = "low") => out.push([id, x, y, route]);
  // Waking: three stars at tap height (a tap reaches them), then three at hold
  // height (only a held jump reaches them). Stars teach; they never gate.
  [505, 533, 561].forEach((x, i) => add(`tap-${i}`, x, i === 1 ? 437 : 442));
  [790, 830, 870].forEach((x, i) => add(`hold-${i}`, x, i === 1 ? 372 : 378));
  // Loose stars sketch the intended arcs over the remaining islands. Main-route
  // stars sit where the leading edge of Diana's pickup box reaches them on a
  // sixteenth, so each is collected on the beat it is scored on.
  const loose = [
    [2449, 491], [2523, 491], [2600, 491],
    [3054, 460], [3131, 460],
    [3432, 355], [3509, 343], [3583, 292],
    [5136, 270], [5286, 323],
    [5475, 200, "high"], [5552, 285, "high"], [5628, 212, "high"],
    [5894, 385], [5968, 385], [6045, 385],
    [6762, 435], [6839, 435],
    [7370, 404], [7444, 404],
    [8430, 421], [8504, 421],
    [8808.6, 262, "high"], [8878.6, 256, "high"],
    [9148.6, 240, "high"], [9218.6, 236, "high"],
    [9468.6, 262, "high"], [9538.6, 256, "high"],
    [9848.6, 260, "high"],
    [10320.2, 428], [10397.2, 428],
    [12971.2, 504], [13047.2, 504],
    [14637, 283], [14712, 283], [14788, 283],
    [15658, 341], [15734, 341],
    [18157, 311], [18231, 243],
    [19028, 284], [18951, 190], [18875, 179],
    [19671, 376], [20011, 291],
    [20480, 500, "high"], [20880, 500, "high"], [21260, 500, "high"],
    [21714, 434], [21791, 434], [21865, 434],
  ];
  loose.forEach(([x, y, route], i) => add(`star-${i}`, x, y, route ?? "low"));
  // The hearth breeze: a jump rises into the first two, holding the cape
  // in the wind carries Diana to the third.
  [
    [14102.2, 144],
    [14152.2, 97],
    [14202.2, 85],
  ].forEach(([x, y], i) => add(`breeze-${i}`, x, y, "high"));
  return out;
}

/* ---------- levels (RESEARCH_LEVELS) ----------
 * A level is a definition: tempo and clock (the simulation always runs in
 * 107 BPM units, at clock = BPM / 107 of real time, like Gentle pace), the
 * physics overrides, which verbs exist, and its geometry and story. */
const ALL_VERBS = Object.freeze({ cape: true, dive: true, glide: true });
const CHAPTER = Object.freeze({
  id: 1,
  key: "chapter",
  numeral: "I",
  title: "A Signal in the Dark",
  bpm: 107,
  clock: 1,
  physics: {},
  verbs: ALL_VERBS,
  level: LEVEL,
  movements: MOVEMENTS,
  sections: SECTIONS,
  checkpoints: CHECKPOINTS,
  startTip: START_TIP,
  main: MAIN,
  high: HIGH,
  updrafts: UPDRAFTS,
  cascades: CASCADES,
  chains: CHAINS,
  great: GREAT,
  prompts: PROMPTS,
  stars: chapterStars(),
});
export const LEVELS = Object.freeze([CHAPTER]);
export function levelDef(n = 1) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (n ?? 1) - 1))];
}
export function createLevel(n = 1) {
  const d = levelDef(n);
  const platforms = [
    ...d.main.map(([id, x, y, width, type, extra], phase) => ({ id, x, y, width, type, phase, route: "low", ...(extra ?? {}) })),
    ...d.high.map(([id, x, y, width, type, extra], phase) => ({ id, x, y, width, type, phase: phase + 60, route: "high", ...(extra ?? {}) })),
  ]
    .map((q) => ({
      ...q,
      crumbleAfter: q.type === "crumble" ? d.physics.crumbleAfter ?? 0.65 : null,
      triggeredAt: null,
      collapseAt: null,
      collapsed: false,
      cascade: d.cascades.find((c) => c.tiles.includes(q.id))?.id ?? null,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const pickups = [];
  const add = (id, x, y, route = "low", extra = {}) => pickups.push({ id, x, y, route, collected: false, ...extra });
  for (const [id, x, y, route] of d.stars) add(id, x, y, route);
  for (const c of d.chains) c.stars.forEach(([x, y], i) => add(`${c.id}-${i}`, x, y, c.route, { chain: c.id, index: i }));
  for (const g of d.great) add(g.id, g.x, g.y, "high", { great: true, line: g.line });
  const chains = d.chains.map((c) => ({ id: c.id, count: c.stars.length, got: 0, lastAt: -1, broken: false, complete: false, links: [] }));
  const updrafts = d.updrafts.map((u) => ({ ...u }));
  const cascades = d.cascades.map((c) => ({ ...c, tiles: [...c.tiles], t0: null }));
  const prompts = d.prompts.map((q) => ({ ...q, glyph: [...q.glyph], done: false }));
  return { platforms, pickups, chains, updrafts, cascades, prompts };
}
export function sectionAt(x, d = levelDef(1)) {
  return d.sections.filter((q) => x >= q.x).at(-1) || d.sections[0];
}
export function movementAt(x, d = levelDef(1)) {
  return d.movements.filter((q) => x >= q.x).at(-1) || d.movements[0];
}
export function checkpointIndex(id, d = levelDef(1)) {
  return d.checkpoints.findIndex((q) => q.id === id);
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

