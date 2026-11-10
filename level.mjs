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
 * 107 BPM units, at clock = BPM / 107 of real time, like Gentle pace, so px
 * per beat is 151.4 everywhere), physics overrides, the verbs it has taught,
 * its geometry, story, glyphs and the authored route pilots (tests/routes.mjs
 * reads them from the state, so the pilots stay self-contained).
 *
 * The chapter above is the source material: L2 keeps Movement III's geometry
 * and L3 Movement II's at their original coordinates (the x lattice and every
 * solved cell hold), L4 remixes translated copies of both, and L1 re-solves
 * Movement I's ideas on its own floaty cells. */
/** Grid x of sixteenth k on a route with no flights (a flight adds 3). */
export const gx = (k) => 220 + 37.85 * k;
const ALL_VERBS = Object.freeze({ cape: true, dive: true, glide: true });
/** The chapter's route pilots, as [x, action, when] (tests/routes.mjs). */
const CP = {
  waking: [[1090.3, "jump", "g"], [1432, "jump", "g"], [1733.5, "jump", "g"], [2113.5, "jump", "g"], [2642.5, "jump", "g"]],
  breaking: [[7108.5, "jump", "g"], [7790.5, "jump", "g"], [8094, "jump", "g"]],
  ridge: [[8548.1, "jump", "g"], [9002.6, "jump", "g"], [9229.6, "jump", "g"], [9607.6, "jump", "g"], [9985.2, "jump", "g"]],
  // The cascade is a bounce: every touch-down is the next takeoff.
  wave: [[11537.7, "jump", "g"], [11764.7, "jump", "g"], [11953.7, "jump", "g"], [12181.2, "jump", "g"], [12370.2, "jump", "g"], [12597.2, "jump", "g"]],
  crown: [[13353.7, "jump", "g"], [13545, "jump", "g"], [13695.7, "jump", "a"]],
  hearthVoid: [[14981.5, "jump", "g"], [15096, "dash", "a"]],
  splitVoids: [[16004, "jump", "g"], [16080.5, "dash", "a"], [16572, "jump", "g"], [16684.5, "dash", "a"], [17291, "jump", "g"]],
  updraft: [[18047, "jump", "g"], [18805, "jump", "g"], [19106.5, "jump", "g"]],
  finale: [[19865, "jump", "g"], [20168.5, "jump", "g"], [20243, "dash", "a"], [20507, "jump", "a"], [20583.5, "dash", "a"]],
  safeFinale: [[19852, "jump", "g"], [20430, "jump", "g"], [21080, "jump", "g"], [21390, "jump", "g"]],
};
const pick = (list, ids) => list.filter((q) => ids.includes(q[0]));
const byId = (list, ids) => list.filter((q) => ids.includes(q.id));
const starsIn = (from, to, drop = []) => chapterStars().filter(([id, x]) => x >= from && x < to && !drop.includes(id));
/** Translate a copy of chapter content by (dx, dy). dx is a whole number of
 * sixteenths (plus any super-jump offset), so the copy keeps the x lattice. */
function shift(list, dx, dy, kind, rename = (id) => id) {
  if (kind === "plat") return list.map(([id, x, y, w, t, e]) => [rename(id), x + dx, y + dy, w, t, e]);
  if (kind === "plan") return list.map(([x, a, w]) => [x + dx, a, w]);
  if (kind === "star") return list.map(([id, x, y, r]) => [rename(id), x + dx, y + dy, r]);
  if (kind === "xy") return list.map(([x, y]) => [x + dx, y + dy]);
  return list;
}

/* ---- I · Waking (88 BPM): floaty, calm; jump, then the double jump ----
 * RESEARCH_PROGRESSION 4.5 and 5. Diana wakes with the jump only (no cape,
 * no air jump), climbs three held hops to the lookout, sees the shower land
 * ahead of her, chooses the floor or the upper tier, takes the stepping
 * stones, sees a star cluster she cannot reach (the lock), runs through the
 * first star that lands softly (the GET: the double jump), reaches that
 * cluster (the key), then needs the double jump for distance (the leap) and
 * for height (the climb), climbs the double staircase while the brightest
 * star falls, and runs a confident double-jump line down to the crater rim.
 * 19 bars, the door on the downbeat of bar 20 (sixteenth 304), 51.8 s real.
 *
 * Physics (scripts/arcs.mjs, 1/120 s; RESEARCH_PROGRESSION 4.1): real
 * gravity 1109 px/s², jump 522, double 469, half gravity while the jump is
 * held and |vy| < 54 (the hang), fall capped at 560. In simulation units
 * (÷ clock, ÷ clock²) 1640 / 635 / 570, hang below 66, fall cap 681. A held
 * jump lands on flat ground 6/16 later (1.02 s real) with a 121 px apex.
 * Heights at exactly k sixteenths after a grid takeoff (up < 0):
 *   hold  2: -112  3: -121  4: -112  5: -73  6: -1 (flat)  7: +93  8: +188
 *   tap   1: -26   2: -20   3: +19   4: +90 (tap cap 308 px/s of simulation)
 *   double, second press at 3: 8: -157 9: -79 10: +16
 *            at 4: 9: -148 10: -70 11: +26     at 5: 11: -30 12: +65
 * Human holds (250-500 ms real) land up to 1/16 earlier, so every landing
 * starts 70-110 px before its grid point (the early side of the window and
 * the short hold both land there) and every song star sits on the first
 * two sixteenths of its arc, where every hold flies the same (L8).
 * Walk-offs land on the grid too: a 64.5 px drop takes exactly 2/16 and a
 * 115 px drop 2.67/16, so the lookout's edge sits 0.33/16 off the grid. */
const W_CLOCK = 88 / 107;
const W_SIX = 15 / 107;
/** The main route's heights (each solved from the one before). */
const WY = (() => {
  const lookout = 540 - 72 - 76 - 80;
  const floor = lookout + 115;
  const stoneB = floor - 19 - 19;
  const field = stoneB + 93;
  const shore = field + 65;
  const crown = shore - 148;
  const base = crown + 64.5;
  const stair2 = base - 70 - 70;
  const field2 = stair2 + 105.5;
  return { home: 540, c1: 540 - 72, c2: 540 - 72 - 76, lookout, floor, stoneA: floor - 19, stoneB, field, shore, crown, base, stair1: base - 70, stair2, field2, fin1: field2 + 65, fin2: field2 + 130, rim: field2 + 146 };
})();
/** A landing island: from `lead` px before grid landing point landK to 10 px
 * past the takeoff at takeoffK (coyote keeps about 27 px more). */
const wIsle = (id, landK, takeoffK, y, lead = 80) => [id, gx(landK) - lead, y, gx(takeoffK) + 10 - (gx(landK) - lead)];
const W_MAIN = [
  ["home", -700, WY.home, gx(24) + 10 + 700],
  // The first gap is 90 px: any first input clears it (a 0 ms tap lands
  // 2.6/16 later, 98 px on) and walking off does not.
  ["drift", gx(24) + 100, WY.home, gx(34) + 10 - (gx(24) + 100)],
  // To the highest point: three held hops up 72, 76 and 80 px, each landing
  // 5/16 later; the last is too high for anything but a held jump.
  wIsle("climb-1", 39, 42, WY.c1, 75),
  wIsle("climb-2", 47, 50, WY.c2, 75),
  // The lookout. Its edge is where the floor begins: walking off it drops
  // 115 px and lands on the grid at sixteenth 73.
  ["lookout", gx(55) - 75, WY.lookout, gx(70.33) - 16 - (gx(55) - 75)],
  ["floor", gx(72), WY.floor, gx(90) + 10 - gx(72)],
  // Stepping stones: two taps up 19 px (each lands 2/16 later; walking off
  // cannot climb, so both are needed), then a wide gap down 93 px that only
  // a held jump crosses (7/16; a tap comes down 50 px short of the lip).
  wIsle("stone-a", 92, 96, WY.stoneA, 60),
  wIsle("stone-b", 98, 102, WY.stoneB, 60),
  // The field of the first star: the GET at sixteenth 120 (bar 8, beat 3),
  // the key cluster over it, the beacon at 136 and the leap's edge at 152.
  wIsle("glint-field", 109, 152, WY.field, 70),
  // The leap: a late double (second press 5/16 after the first) lands 12/16
  // after the takeoff, 65 px lower, 374 px across.
  wIsle("far-shore", 164, 168, WY.shore, 80),
  // The climb: second press at 4/16, up 148 px 9/16 after the takeoff.
  ["climb-crown", gx(177) - 90, WY.crown, gx(180) - 16 - (gx(177) - 90)],
  // Walking off the crown drops 64.5 px and lands 2/16 later, on the grid.
  ["stair-base", gx(182) - 20, WY.base, gx(196) + 10 - (gx(182) - 20)],
  // The double staircase: second press at 4/16, up 70 px 10/16 after.
  wIsle("stair-1", 206, 210, WY.stair1, 90),
  // Walking off the top stair drops 105.5 px in 2.55/16: its edge sits
  // 0.45/16 past the grid so she lands on the crash field on sixteenth 227.
  ["stair-2", gx(220) - 90, WY.stair2, gx(224.45) - 16 - (gx(220) - 90)],
  ["crash-field", gx(226), WY.field2, gx(244) + 10 - gx(226)],
  // The confident finish: three doubles down to the rim, two presses a bar
  // (second press at 5/16: +65 at 12/16, twice; then at 3/16: +16 at
  // 10/16), no glyphs.
  wIsle("rim-1", 256, 260, WY.fin1, 100),
  wIsle("rim-2", 272, 276, WY.fin2, 100),
  ["crater-rim", gx(286) - 90, WY.rim, gx(304) + 520 - (gx(286) - 90)],
];
// Mastery lines. The upper tier off the lookout: three islets at its height
// taken with held jumps 6/16 apart (flat cells), Great Star 1 over the last
// hang. The floor runs 115 px under them. The high crown off the top stair
// (a double up 70 px) and the hang line, Great Star 3 at its end; the crash
// field runs 175 px under it.
const W_HIGH = [
  // (tier-1 starts 1.5/16 past the lookout's edge: walking off, Diana is
  // already 20 px under its top when her collider reaches it.)
  // The three hang jumps bounce (each touch-down is the next takeoff), so
  // the tier ends before the stones: a long tap's apex there stays 60+ px
  // under nothing.
  wIsle("tier-1", 74, 74, WY.lookout + 1, 80),
  wIsle("tier-2", 80, 80, WY.lookout + 2, 50),
  wIsle("tier-3", 86, 88, WY.lookout + 3, 50),
  wIsle("high-crown", 234, 236, WY.stair2 - 70, 70),
  // The hang line ends at 245, before the finish's first double rises
  // under it (her apex stays clear of its top, so she never steps up).
  wIsle("hang-1", 242, 245, WY.stair2 - 69, 50),
];
/** A song star on the rising part of a held jump from a takeoff at k on
 * ground y0, collected 2/16 after the takeoff (every hold is at -111 there). */
const riseStar = (k, y0, at = 2) => [gx(k + at) + 39.5, Math.round(y0 - 111 - 36)];
/** A song star at running height, collected on sixteenth k. */
const runStar = (k, y) => [gx(k) + 39.5, y - 40];
const W_CHAINS = [
  // The climb: one note per hop, on the way up.
  { id: "first-song", route: "low", stars: [riseStar(24, WY.home), riseStar(34, WY.home), riseStar(42, WY.c1), riseStar(50, WY.c2)] },
  // The shower: eight stars land on the floor ahead (each 14/16 = 2.4 s real
  // before Diana reaches it), and she runs through them on the eighths.
  { id: "shower-song", route: "low", stars: [74, 76, 78, 80, 82, 84, 86, 88].map((k) => runStar(k, WY.floor)) },
  // The upper tier's own four: they land on its islets, one per hop.
  { id: "tier-song", route: "high", stars: [riseStar(68, WY.lookout), riseStar(74, WY.lookout + 1), riseStar(80, WY.lookout + 2), runStar(87, WY.lookout + 3)] },
  // Home: the finish's second presses, falling toward the rim.
  { id: "home-song", route: "low", stars: [riseStar(244, WY.field2), riseStar(260, WY.fin1), riseStar(276, WY.fin2), runStar(288, WY.rim)] },
];
const W_GREAT = [
  { id: "great-1", x: gx(83) + 30, y: WY.lookout - 152, line: "the upper tier: a full hang over the last islet" },
  { id: "great-2", x: gx(172) + 20, y: WY.shore - 285, line: "above the climb: press the second jump early" },
  { id: "great-3", x: gx(239) + 20, y: WY.stair2 - 69 - 152, line: "the hang line over the crash: a full hang" },
];
/** The key: four stars on the optional double's arc (jump at 124, second
 * press at 127: 4: -183, 5: -215, 6: -219, 7: -204 px), each entering the
 * pickup box on a sixteenth; no single jump reaches them (its body peaks
 * 62+ px under the lowest). The lock over stone-b repeats the shape. */
const W_KEY = [[4, -183], [5, -215], [6, -219], [7, -204]].map(([j, dy]) => [gx(124 + j) + 33.5, Math.round(WY.field + dy - 36)]);
function wStars() {
  const out = [];
  // The opening lesson on the home ground: a tap row (a 0 ms tap's body
  // reaches it, running does not) and a hang row (only a held jump).
  // (Along a 0 ms tap from sixteenth 5: it peaks 29 px up 1.3/16 later.)
  [25, 50, 75].forEach((dx, i) => out.push([`tap-${i}`, gx(5) + dx, 447 - (i === 1 ? 4 : 0), "low"]));
  [15, 16, 17].forEach((j, i) => out.push([`hold-${i}`, gx(j) + 40, 385 - (i === 1 ? 4 : 0), "low"]));
  // The stones' taps and the key: four stars at double height over the
  // field, the same shape as the lock over stone-b (no single jump reaches).
  [91, 97].forEach((k, i) => out.push([`stone-star-${i}`, gx(k) + 33.5, WY.floor - 19 * i - 26 - 36, "low"]));
  // (Each on the optional double's arc where it enters the pickup box on a
  // sixteenth: the jump at 124, the second press at 127.)
  W_KEY.forEach(([x, y], i) => out.push([`key-${i}`, x, y, "low"]));
  // The crash field under the hang line, and the crown's run.
  // (Loose stars are taken within 34 px, constellation stars within 40.)
  [232, 236, 240].forEach((k, i) => out.push([`crash-star-${i}`, gx(k) + 33.5, WY.field2 - 40, "low"]));
  return out;
}
const WJ = (k, when = "g") => [gx(k) - 0.3, "jump", when];
const WTAP = (k) => [gx(k) - 0.3, "tap", "g"];
const W_PLAN_MAIN = [
  WJ(24), WJ(34), WJ(42), WJ(50),
  // (the lookout's edge: she walks onto the floor)
  WTAP(90), WTAP(96), WJ(102),
  // the safe first use: a double under the key (optional)
  WJ(124), WJ(127, "a"),
  WJ(152), WJ(157, "a"),
  WJ(168), WJ(172, "a"),
  // (the crown's edge: she walks onto the stair base)
  WJ(196), WJ(200, "a"), WJ(210), WJ(214, "a"),
  // (the top stair's edge: she walks onto the crash field)
  WJ(244), WJ(249, "a"), WJ(260), WJ(265, "a"), WJ(276), WJ(279, "a"),
];
const W_GET = gx(120);
const WAKING = {
  key: "waking",
  title: "Waking",
  look: "home",
  toward: "Home",
  introduces: "double",
  bpm: 88,
  clock: W_CLOCK,
  physics: {
    gravity: 1640,
    jump: 635,
    doubleJump: 570,
    apexHang: { below: 66, factor: 0.5 },
    maxFall: 560 / W_CLOCK,
    // A 0 ms tap rises 29 px (0.23 of a held jump, as in the other levels;
    // the global 280 would leave I's stronger gravity a 24 px stub).
    tapCap: 308,
    // Songs are one note per hop, up to 16/16 (2.24 s of simulation) apart
    // in the finish.
    constellationGap: 2.4,
  },
  verbs: { double: false, cape: false, glide: false, dive: false, super: false },
  gets: [{ id: "first-star", verb: "double", x: W_GET }],
  capeRule: "breath",
  view: null,
  level: { title: "Waking", speed: 270, startX: 220, startY: WY.home, finishX: gx(304), finishY: WY.rim, beat: BEAT },
  movements: [{ id: "I", x: -1000, numeral: "I", name: "Waking" }],
  sections: [
    { x: -1000, movement: "I", step: "introduce", name: "I · Waking" },
    { x: gx(32), movement: "I", step: "develop", name: "I · Waking — to the highest point" },
    { x: gx(56), movement: "I", step: "develop", name: "I · Waking — the shower" },
    { x: gx(88), movement: "I", step: "develop", name: "I · Waking — stepping stones" },
    { x: gx(112), movement: "I", step: "get", name: "I · Waking — the first star" },
    { x: gx(144), movement: "I", step: "need", name: "I · Waking — the leap" },
    { x: gx(160), movement: "I", step: "twist", name: "I · Waking — the climb" },
    { x: gx(184), movement: "I", step: "develop", name: "I · Waking — the staircase" },
    { x: gx(224), movement: "I", step: "set-piece", name: "I · Waking — the brightest star" },
    { x: gx(240), movement: "I", step: "conclude", name: "I · Waking — down to the crater" },
  ],
  // Beacons on half bars 4½, 9½, 12½ and 15½ (≤ 13.6 s real apart).
  checkpoints: [
    { id: "lookout", x: gx(56) - 3, y: WY.lookout, platform: "lookout", story: "From the highest point, every star was going the same way.", tip: "Hold the jump for the high stones. Or walk on: the floor is safe." },
    { id: "first-star", x: gx(136) - 3, y: WY.field, platform: "glint-field", story: "One star had come down gently, as if it meant to stay.", tip: "Jump, then jump again near the top to reach farther." },
    { id: "climb", x: gx(184) - 3, y: WY.base, platform: "stair-base", story: "The dark had steps in it, if she jumped twice.", tip: "Jump, then jump again near the top to climb." },
    { id: "crash", x: gx(232) - 3, y: WY.field2, platform: "crash-field", story: "Something enormous had fallen, just ahead.", tip: "Jump twice for each long gap, all the way down." },
  ],
  startTip: "Jump at the edge. Hold the jump to hang at the top.",
  main: W_MAIN,
  high: W_HIGH,
  updrafts: [],
  cascades: [],
  chains: W_CHAINS,
  great: W_GREAT,
  // Scripted moments (sixteenths of simulation time from the wake; the model
  // emits `moment` for the renderer and the score): the shower's stars land
  // on the beat 14/16 before Diana reaches them, the GET's star lands softly
  // two bars ahead, the brightest star flashes on bar 15 and the asteroid
  // strikes on the downbeat of bar 16.
  moments: [
    ...[74, 76, 78, 80, 82, 84, 86, 88].map((k, i) => ({ id: `shower-${i}`, k: k - 14, kind: "fall", target: `shower-song-${i}` })),
    ...[70, 76, 82, 87].map((k, i) => ({ id: `tier-${i}`, k: k - 14, kind: "fall", target: `tier-song-${i}` })),
    { id: "first-star", k: 104, kind: "fall", target: "first-star" },
    { id: "brightest-star", k: 224, kind: "flash" },
    { id: "crash", k: 240, kind: "crash" },
  ],
  // Decor: the lock (four stars at double-jump height over stone-b, out of
  // reach before the GET; the key over the field repeats its shape) and the
  // dust plume of the crash beyond the rim.
  decor: [
    { id: "lock", kind: "cluster", stars: W_KEY.map(([x, y]) => [x - gx(127) + gx(97), y - WY.field + WY.stoneB]) },
    { id: "plume", kind: "plume", x: gx(330), y: WY.rim, from: 240 },
  ],
  prompts: [
    { id: "p-jump", glyph: ["up"], action: "jump", x: gx(24) - 30, y: WY.home - 110, from: gx(24) - 20, to: gx(24) + 40, inputX: gx(24) + 20 },
    { id: "p-tap", glyph: ["tap-up"], action: "jump", x: gx(88), y: WY.floor - 110, from: gx(89), to: gx(90) + 30, inputX: gx(90) + 10 },
    // ↑ ↑: [from, inputX] is the first jump's window; `to` ends the second's.
    { id: "p-key", glyph: ["up", "up"], action: "double-jump", x: gx(125), y: WY.field - 300, from: gx(124) - 30, to: gx(130), inputX: gx(124) + 14, optional: true, route: "main" },
    { id: "p-leap", glyph: ["up", "up"], action: "double-jump", x: gx(153), y: WY.field - 250, from: gx(152) - 30, to: gx(160), inputX: gx(152) + 14 },
  ],
  stars: wStars(),
  routes: {
    main: W_PLAN_MAIN,
    // The three Great Stars: the upper tier (holds off the lookout), the
    // early second press on the climb, and the crown and hang line.
    upper: [
      ...W_PLAN_MAIN.filter(([x]) => x < gx(60)),
      // (off the tier's end she drops 100 px onto stone-a and taps on)
      WJ(68), WJ(74), WJ(80), WJ(88),
      ...W_PLAN_MAIN.filter(([x]) => x > gx(94) && x < gx(166)),
      WJ(168), WJ(170, "a"),
      ...W_PLAN_MAIN.filter(([x]) => x > gx(180) && x < gx(222)),
      WJ(223.5), WJ(227.5, "a"), WJ(236), WJ(245),
      ...W_PLAN_MAIN.filter(([x]) => x > gx(255)),
    ],
    // The opening lesson: tap for the low star row, hold for the high one.
    ability: [[gx(5) - 0.3, "tap", "g"], WJ(13), ...W_PLAN_MAIN],
    safe: W_PLAN_MAIN.filter(([x]) => x < gx(122) || x > gx(130)),
  },
};

/* ---- II · The Gift (94 BPM): calm, with marked beats; the cape and its breath ----
 * RESEARCH_PROGRESSION 4.5 and 3. II opens in the crater where I's door
 * left Diana: she runs through the asteroid's gift (the GET: the cape, the
 * bar appears empty and fills over the next bar of running), uses the cape
 * once over a short gap with a floor under it (safe), needs it over the
 * hearth void and the same void again (charged by the gift and void
 * beacons), learns that the bar breathes (after a flight two hop gaps look
 * flight-sized but are double-jump-sized while the bar is not full, then a
 * long stone fills it tick by tick), crosses the long void on a flight, the
 * void-song (which refills the cape in midair) and a second flight, and
 * descends Pluto's steps: three flights in four bars, charged by a long
 * stone with its beacon, by the steps-song after a short rock, and by the
 * Pluto beacon. 19 bars, the door on the downbeat of bar 20 (48.5 s real).
 *
 * Physics: II-VIII share the chapter's simulation physics (gravity 1500,
 * jump 570, double 525, no hang, no fall cap), so every cell is the one in
 * px and sixteenths that LEVEL_DESIGN lists; only the clock (94 / 107) and
 * so the real windows change. Cells used here (scripts/arcs.mjs 2):
 *   hold 4: -80 (80 up)  5: -26          double at 4: 10: +12 (12 lower)
 *   flight at 3/16 (the apex): level at -105 for 0.5 s, then 9: -17 (17 up),
 *   10: +70 (70 lower); two flights at 3 and 9 around a refill: 14: +15
 * A full flight adds exactly 113.55 px (three sixteenths) to the run, so a
 * grid x after F flights is 220 + 37.85 k + 113.55 F (gk below).
 * Every required flight has a charge source (RESEARCH_PROGRESSION 3.4): the
 * gift and void beacons for the hearth void and its repeat, the long stone's
 * breath and beacon for the long void's first flight and Pluto's first step,
 * the void-song and the steps-song (both completed before the press) for the
 * second flights, and the Pluto beacon for the last. */
const G_CLOCK = 94 / 107;
const gk = (k, F = 0) => 220 + 37.85 * k + 113.55 * F;
const gIsle = (id, landK, F, takeoffK, y, lead = 100) => [id, gk(landK, F) - lead, y, gk(takeoffK, F) + 10 - (gk(landK, F) - lead)];
/** Stars along a flight opened at sixteenth dK (F flights before it) from a
 * takeoff on ground y0: one entering the pickup box on each sixteenth of the
 * level flight (69.69 px of run each), then one on the way down at 8/16. */
const flightStars = (dK, F, y0, n = 3, down = true) => {
  const x0 = gk(dK, F);
  const out = Array.from({ length: n }, (_, i) => [x0 + 69.69 * (i + (n === 4 ? 0 : 1)) + 39.5, y0 - 141]);
  if (down) out.push([x0 + 248.6 + (dK + 5 - (dK + 3.567)) * 37.85 + 39.5, y0 - 110]);
  return out;
};
const GY = { crater: 300, step: 274, rim: 248, gift: 231, floor: 308, shore1: 301, hearth: 221, shore2: 291, hop: 303, long: 315, voidShore: 330, rock1: 400, rock2: 470, plain: 540, heart1: 514, heart2: 488, heart3: 462 };
const G_MAIN = [
  // The crater floor where I's door left her; the gift is on it.
  ["crater", -700, GY.crater, gk(23) + 10 + 700],
  // Out of the crater: two hops up 26 px (5/16 each) onto its rim, after
  // the title card has gone.
  gIsle("crater-step", 28, 0, 31, GY.step, 75),
  gIsle("rim", 36, 0, 40, GY.rim, 75),
  // The safe first use: a flight at the apex lands 17 px up 9/16 later; a
  // double also makes it (it steps up); a plain jump comes down on the floor
  // 60 px below and hops back up 77 px (4/16).
  gIsle("gift-stone", 49, 1, 68, GY.gift, 100),
  // The hearth void (382 px): a flight at the apex lands 70 px lower 10/16
  // after the takeoff, along flight-line.
  gIsle("hearth-shore", 78, 2, 82, GY.shore1, 100),
  // A held hop up 80 px (4/16) onto the second hearth and its beacon.
  gIsle("hearth-2", 86, 2, 100, GY.hearth, 80),
  // The same void, without stars.
  gIsle("void-shore-1", 110, 3, 112, GY.shore2, 100),
  // The breath lesson: two short stones and gaps a double jump crosses
  // (second press at 4/16, 12 px lower 10/16 later) while the bar shows a
  // quarter, then the long stone where it fills (sixteenth 146).
  gIsle("breath-1", 122, 3, 124, GY.hop, 100),
  gIsle("long-stone", 134, 3, 164, GY.long, 100),
  // The long void: jump, flight, the void-song refills the cape, flight;
  // 15 px lower 14/16 after the takeoff.
  gIsle("void-shore", 178, 5, 196, GY.voidShore, 110),
  // Pluto's steps: three flights in four bars, each 70 px lower.
  gIsle("step-rock", 206, 6, 208, GY.rock1, 90),
  gIsle("pluto-rock", 218, 7, 236, GY.rock2, 100),
  // Pluto's heart plain: three held hops up 26 px to the door (bar 20).
  gIsle("heart-plain", 246, 8, 252, GY.plain, 100),
  gIsle("heart-1", 257, 8, 262, GY.heart1, 75),
  gIsle("heart-2", 267, 8, 272, GY.heart2, 75),
  ["heart-door", gk(277, 8) - 75, GY.heart3, gk(304, 8) + 520 - (gk(277, 8) - 75)],
];
// The safe line: the floor under the first gap (a plain jump lands on it 60
// px down and hops 77 px back up onto the gift stone, 4/16).
const G_HIGH = [["crater-floor", gk(42), GY.floor, gk(50, 0) + 10 - gk(42)]];
const G_CHAINS = [
  { id: "first-flight", route: "low", stars: flightStars(43, 0, GY.rim) },
  { id: "flight-line", route: "low", stars: flightStars(71, 1, GY.gift) },
  // On the long void's first flight, one per sixteenth from the press: it
  // completes on 170 (an eighth), so the second flight (173) has its cape.
  { id: "void-song", route: "low", stars: flightStars(167, 3, GY.long, 4, false) },
  // After the short rock: three on the jump's rise and one at its takeoff;
  // complete on 210, before the second step's flight at 211.
  { id: "steps-song", route: "low", stars: [[gk(207, 6) + 39.5, GY.rock1 - 40], [gk(208, 6) + 39.5, GY.rock1 - 40], [gk(209, 6) + 39.5, GY.rock1 - 101], [gk(210, 6) + 39.5, GY.rock1 - 135]] },
  { id: "pluto-song", route: "low", stars: flightStars(239, 7, GY.rock2) },
];
const G_GREAT = [
  { id: "great-1", x: gk(48, 1) + 20, y: GY.rim - 165 - 46, line: "over the first flight: jump, jump again, then the cape" },
  { id: "great-2", x: gk(164, 3) + 486, y: GY.long - 249, line: "above the long void: a double jump between the flights" },
  { id: "great-3", x: gk(244, 8) + 10, y: GY.rock2 - 165 - 46, line: "over Pluto's last step: jump, jump again, then the cape" },
];
const GJ = (k, F, when = "g") => [gk(k, F) - 0.3, "jump", when];
const GD = (k, F) => [gk(k, F) - 0.3, "dash", "a"];
const G_PLAN_MAIN = [
  GJ(23, 0), GJ(31, 0),
  GJ(40, 0), GD(43, 0),
  GJ(68, 1), GD(71, 1),
  GJ(82, 2),
  GJ(100, 2), GD(103, 2),
  GJ(112, 3), GJ(116, 3, "a"), GJ(124, 3), GJ(128, 3, "a"),
  GJ(164, 3), GD(167, 3), GD(173, 4),
  GJ(196, 5), GD(199, 5),
  GJ(208, 6), GD(211, 6),
  GJ(236, 7), GD(239, 7),
  GJ(252, 8), GJ(262, 8), GJ(272, 8),
];
const GIFT = {
  key: "gift",
  title: "The Gift",
  look: "pluto",
  toward: "Pluto",
  introduces: "cape",
  bpm: 94,
  clock: G_CLOCK,
  physics: {},
  verbs: { double: true, cape: false, glide: false, dive: false, super: false },
  gets: [{ id: "asteroid-gift", verb: "cape", x: gk(4) }],
  capeRule: "breath",
  view: null,
  level: { title: "The Gift", speed: 270, startX: 220, startY: GY.crater, finishX: gk(304, 8), finishY: GY.heart3, beat: BEAT },
  movements: [{ id: "II", x: -1000, numeral: "II", name: "The Gift" }],
  sections: [
    { x: -1000, movement: "II", step: "get", name: "II · The Gift" },
    { x: gk(36), movement: "II", step: "safe", name: "II · The Gift — the first flight" },
    { x: gk(60, 1), movement: "II", step: "need", name: "II · The Gift — the hearth void" },
    { x: gk(104, 2), movement: "II", step: "develop", name: "II · The Gift — the breath" },
    { x: gk(152, 3), movement: "II", step: "twist", name: "II · The Gift — the long void" },
    { x: gk(190, 5), movement: "II", step: "conclude", name: "II · The Gift — Pluto's steps" },
    { x: gk(248, 8), movement: "II", step: "coda", name: "II · The Gift — the heart plain" },
  ],
  // Beacons on half bars 4½, 6½, 10½, 12½, 15 and 18½ (≤ 11.5 s real apart).
  checkpoints: [
    { id: "gift", x: gk(56, 1) - 3, y: GY.gift, platform: "gift-stone", story: "Gather the falling stars, and it will carry you there.", tip: "Jump, then press the cape near the top of the jump." },
    { id: "void", x: gk(88, 2) - 3, y: GY.hearth, platform: "hearth-2", story: "The same dark again. This time she knew how wide it was.", tip: "Jump at the edge, then press the cape near the top." },
    { id: "long", x: gk(152, 3) - 3, y: GY.long, platform: "long-stone", story: "The gift breathes when she runs. A long stone is a full breath.", tip: "Take every star of the song on the first flight; it gives the cape back." },
    { id: "steps", x: gk(184, 5) - 3, y: GY.voidShore, platform: "void-shore", story: "Below her the little world turned, cold and patient.", tip: "Short stones give no breath. The stars after them do." },
    { id: "pluto", x: gk(224, 7) - 3, y: GY.rock2, platform: "pluto-rock", story: "On Pluto's heart the frost held still, as if it were listening.", tip: "Jump, then press the cape near the top, down to the plain." },
    // On the door stone (bar 18½), so no beacon gap passes 13 s (the
    // ladder); it marks the glide lock below the ledge.
    { id: "lock", x: gk(280, 8) - 3, y: GY.heart3, platform: "heart-door", story: "Below the last ledge a line of stars drifted down, too slowly to follow.", tip: "Run on to the door." },
  ],
  startTip: "Run through the gift. Jump, then press the cape near the top.",
  main: G_MAIN,
  high: G_HIGH,
  updrafts: [],
  cascades: [],
  chains: G_CHAINS,
  great: G_GREAT,
  moments: [],
  // Decor: the glide lock (RESEARCH_PROGRESSION 2.1): a gently descending
  // star line below the final ledge that a flight cannot follow (III's glide
  // will); drawn, never collected.
  decor: [{ id: "glide-lock", kind: "cluster", stars: [0, 1, 2, 3, 4].map((i) => [gk(282, 8) + 60 * i, GY.heart3 + 60 + 22 * i]) }],
  prompts: [
    // ↑ · →: [from, inputX] is the jump's window; `to` ends the cape's.
    { id: "p-first-flight", glyph: ["up", "then", "right"], action: "dash", x: gk(40) + 20, y: GY.rim - 170, from: gk(40) - 30, to: gk(43) + 60, inputX: gk(40) + 14, optional: true, route: "main" },
    { id: "p-cape", glyph: ["up", "then", "right"], action: "dash", x: gk(69, 1), y: GY.gift - 170, from: gk(68, 1) - 30, to: gk(71, 1) + 60, inputX: gk(68, 1) + 14 },
    { id: "p-refill", glyph: ["right"], action: "dash", x: gk(172, 4), y: GY.long - 200, from: gk(171, 4), to: gk(175, 4), inputX: gk(173, 4) + 10 },
  ],
  stars: [
    // The crater's two hops and the plain's three: a star on each rise.
    ...[23, 31].map((k, i) => [`rim-star-${i}`, gk(k + 1) + 33.5, GY.crater - 26 * i - 64 - 36, "low"]),
    ...[252, 262, 272].map((k, i) => [`plain-star-${i}`, gk(k + 1, 8) + 33.5, GY.plain - 26 * i - 64 - 36, "low"]),
    // Running stars where the bar is already full (after a beacon or the
    // first fill), so they add notes but never change when it fills.
    ...[[58, 1, GY.gift], [61, 1, GY.gift], [64, 1, GY.gift], [90, 2, GY.hearth], [93, 2, GY.hearth], [96, 2, GY.hearth], [154, 3, GY.long], [157, 3, GY.long], [160, 3, GY.long], [186, 5, GY.voidShore], [189, 5, GY.voidShore], [192, 5, GY.voidShore], [226, 7, GY.rock2], [229, 7, GY.rock2], [232, 7, GY.rock2]].map(([k, F, y], i) => [`run-star-${i}`, gk(k, F) + 33.5, y - 40, "low"]),
    // The breath lesson's hops (each at the second press's rise).
    ...[116, 128].map((k, i) => [`breath-star-${i}`, gk(k + 1, 3) + 33.5, GY.shore2 + 12 * i - 120 - 36, "low"]),
  ],
  routes: {
    main: G_PLAN_MAIN,
    // The three Great Stars: jump, double and cape over the first gap and
    // over Pluto's last step, and the double between the long void's flights.
    upper: [
      GJ(23, 0), GJ(31, 0), GJ(40, 0), GJ(44, 0, "a"), GD(47, 0),
      ...G_PLAN_MAIN.filter(([x]) => x > gk(60, 1) && x < gk(160, 3)),
      GJ(164, 3), GD(167, 3), GJ(171, 4, "a"), GD(175, 4),
      ...G_PLAN_MAIN.filter(([x]) => x > gk(190, 5) && x < gk(230, 7)),
      GJ(236, 7), GJ(240, 7, "a"), GD(243, 7),
      ...G_PLAN_MAIN.filter(([x]) => x > gk(250, 8)),
    ],
    ability: G_PLAN_MAIN,
    // The safe line: no cape over the first gap (a jump onto the floor, a
    // hop back up), then the main route.
    safe: [GJ(23, 0), GJ(31, 0), GJ(40, 0), GJ(46, 0), ...G_PLAN_MAIN.filter(([x]) => x > gk(60, 1))],
  },
};

/* ---- III · Still Water (100 BPM): floating, flowing; the glide ----
 * RESEARCH_PROGRESSION 4.5 (III). Shared simulation physics (II-VIII), so
 * the cells are II's plus the held cape (scripts/arcs.mjs g/u, on the
 * interim III): after a flight or a jump the glide falls at most 140 px/s of
 * simulation, 19.6 px per sixteenth, and a release drops 33.6 px in the next
 * sixteenth and 96.6 in two. Cells (dy at k/16 after a grid takeoff, up < 0):
 *   walk off holding the cape: 8: +122.9
 *   jump, cape at 3, hold:     20: +134.8 (a flight alone lands +70 at 10)
 *   jump, cape at 3:            9: -16.8
 *   jump holding the cape:     13: +70.3 (a double lands +70 at 10.5)
 *   jump, cape 3, let go at 13: 15: +96.9; at 14: 15: +51.7
 *   jump, jump again at 3:       7: -160.2
 *   jump holding, let go at 6:  8: +29.7
 *   jump, cape 3, cape 9, hold: 17: +47.3 (two flights alone: +15 at 14)
 *   jump, cape 3, let go and jump again at 10: 14: -117.4
 *   jump, jump at 4, hold:      12: -84.7 (Great Star 1's float)
 * A grid x is gk(k, F) (F flights so far). Required releases are timed
 * presses of their own (`unglide` while airborne); a release after a
 * touch-down is not. Every pure glide (the cape held with no flight) starts
 * with the bar short of full, so the same key never flies there. */
const S_CLOCK = 100 / 107;
const SY = { plain: 90, cliff: 160, field: 283, far: 418, ledge: 401, shoreA: 471, gs2: 491, i1: 511, i2: 568, i3: 636, next: 408, stair1: 460, stair2: 490, stair3: 520, wide: 567, climb1: 450, climb2: 333, lid: 307, shelf: 281, floor: 457 };
const sIsle = gIsle;
const S_MAIN = [
  // Off Pluto's plain: the warm-up flight (jump 23, cape 26) lands 70 px
  // lower on the helper's cliff 10/16 later.
  ["pluto-edge", -700, SY.plain, gk(23) + 10 + 700],
  // The helper's cliff: the GET on 44; its lip at 48 is a walk-off (6 px
  // past the grid, as in arcs.mjs) onto the field 123 px below. Holding the
  // cape floats her down the float-song; without it she lands at about 51.5.
  ["helper-cliff", gk(33, 1) - 100, SY.cliff, gk(48, 1) + 6 - (gk(33, 1) - 100)],
  ["still-field", gk(51, 1) - 20, SY.field, gk(76, 1) + 10 - (gk(51, 1) - 20)],
  // The need: jump 76, cape 79 and hold: 135 px lower 20/16 later. A flight
  // alone is down at about 10.6/16 (515 px); the shore starts at 615.
  ["far-shore", gk(76, 1) + 615, SY.far, gk(116, 2) + 10 - (gk(76, 1) + 615)],
  // The cape floats when it cannot fly: a flight up 17 px onto a short
  // ledge (4/16 of breath), then a jump holding the cape off its edge, 70 px
  // down 13/16 later (a double alone reaches that height at 397 px).
  sIsle("glide-ledge", 125, 3, 129, SY.ledge, 90),
  ["shore-a", gk(129, 3) + 420, SY.shoreA, gk(156, 3) + 10 - (gk(129, 3) + 420)],
  // Letting go: jump 156, cape 159, hold, let go at 169 over the second
  // islet (97 px down on 171); it ends before the held glide comes down to
  // it, so only a release lands there. A jump and a double (173, 176) climb
  // 160 px to the next shore. The other islets are optional (high).
  ["islet-2", gk(171, 4) - 19, SY.i2, gk(173, 4) + 8 - (gk(171, 4) - 19)],
  sIsle("next-shore", 180, 4, 204, SY.next, 90),
  // The water stair: jump, cape, hold, let go at 14/16 (52 px down on 15);
  // then twice a jump holding the cape, let go at 6/16 (30 px down on 8).
  sIsle("stair-1", 219, 5, 223, SY.stair1, 60),
  sIsle("stair-2", 231, 5, 235, SY.stair2, 55),
  sIsle("stair-3", 243, 5, 260, SY.stair3, 55),
  // The widest void: jump 260, cape 263, the refill-song, cape 269 and hold:
  // 47 px down 17/16 later (870 px). Two flights alone are down by 14.6/16.
  ["wide-shore", gk(260, 5) + 820, SY.wide, gk(292, 7) + 10 - (gk(260, 5) + 820)],
  // The rise: jump, cape, hold, let go and jump again 7/16 after the cape:
  // 117 px up 14/16 after the takeoff, twice (the climb-song charges the second).
  sIsle("climb-1", 306, 8, 310, SY.climb1, 80),
  sIsle("climb-2", 324, 9, 327, SY.climb2, 80),
  // The dive lock: a glinting lid on the main line, 26 px up (a held hop,
  // 5/16), that she runs across and cannot open (no dive yet); a last hop
  // onto Neptune's shelf and the door (bar 23).
  sIsle("lock-lid", 332, 9, 336, SY.lid, 75).concat("lid"),
  ["neptune-shelf", gk(341, 9) - 75, SY.shelf, gk(352, 9) + 520 - (gk(341, 9) - 75)],
];
const S_HIGH = [
  // The letting-go islets the main route floats over: the first (a release
  // over it lands short of every shore), Great Star 2's tiny high islet (an
  // exact release at 163) and the third (too low to climb out of).
  ["islet-1", gk(167, 4), SY.i1, 76],
  ["islet-gs2", gk(165, 4) + 5, SY.gs2, 55],
  ["islet-3", gk(175, 4) + 10, SY.i3, 70],
  // The lid's catch.
  ["lock-floor", gk(330, 9), SY.floor, 37.85 * 8],
];
// Star y at sixteenth j of a cell from a takeoff on ground y0 (dy from the cells).
const at = (y0, dy) => Math.round(y0 + dy - 36);
const S_CHAINS = [
  // The safe first use: the descending line only a held cape follows.
  { id: "float-song", route: "low", stars: [[51, 24.9], [52, 44.4], [53, 64.1], [54, 83.7]].map(([k, dy]) => [gk(k, 1) + 39.5, at(SY.cliff, dy)]) },
  // The need: three along the flight, three down the held glide.
  { id: "still-song", route: "low", stars: [...flightStars(79, 1, SY.field, 3, false), ...[[86, -61.4], [88, -22.2], [90, 17.1]].map(([k, dy]) => [gk(k, 2) + 39.5, at(SY.field, dy)])] },
  // The cape floats when it cannot fly: down the pure glide off the ledge.
  { id: "ledge-song", route: "low", stars: [[134, -86], [136, -47.5], [138, -8.2], [140, 31]].map(([k, dy]) => [gk(k, 3) + 39.5, at(SY.ledge, dy)]) },
  // Letting go: along the flight and the first of the glide.
  { id: "drift-song", route: "low", stars: [...flightStars(159, 3, SY.shoreA, 3, false), ...[[166, -61.4], [168, -22.2]].map(([k, dy]) => [gk(k, 4) + 39.5, at(SY.shoreA, dy)])] },
  // The widest void: one per sixteenth from the cape, complete on 266, so
  // the second flight (269) has its cape.
  { id: "refill-song", route: "low", stars: flightStars(263, 5, SY.stair3, 4, false) },
  // ...and the second flight and the start of the hold (it refills the
  // cape in the air; the rise beacon refills it again before it matters).
  { id: "deep-song", route: "low", stars: [...[1, 2, 3].map((j) => [gk(269, 6) + 69.69 * j + 39.5, at(SY.stair3, -15.4)]), [gk(274, 7) + 39.5, at(SY.stair3, -6.4)]] },
  // The rise: two on climb-1 and two on the second jump's rise, complete on
  // 312, before the second cape (313).
  { id: "climb-song", route: "low", stars: [[gk(307, 8) + 39.5, SY.climb1 - 40], [gk(308, 8) + 39.5, SY.climb1 - 40], [gk(311, 8) + 39.5, at(SY.climb1, -64.7)], [gk(312, 8) + 39.5, at(SY.climb1, -99.3)]] },
  // Neptune's song: along the last flight and the top of the last jump.
  { id: "neptune-song", route: "low", stars: [...flightStars(313, 8, SY.climb1, 3, false), [gk(322, 9) + 39.5, at(SY.climb1, -146.7)]] },
];
const S_GREAT = [
  { id: "great-1", x: gk(60, 1) + 20, y: at(SY.cliff, -84.7), line: "the longest float: off the cliff, jump again, then hold the cape" },
  { id: "great-2", x: gk(165, 4) + 32, y: SY.gs2 - 40, line: "a tiny islet: let go of the cape exactly over it" },
  { id: "great-3", x: gk(268, 6) + 20, y: Math.round(SY.stair3 - 165 - 36), line: "over the widest void: jump, jump again, the cape, then hold it" },
];
const SJ = (k, F, when = "g") => [gk(k, F) - 0.3, "jump", when];
const SD = (k, F) => [gk(k, F) - 0.3, "dash", "a"];
const SG = (k, F, when = "*") => [gk(k, F) - 0.3, "glide", when];
const SU = (k, F, when = "a") => [gk(k, F) - 0.3, "unglide", when];
const S_PLAN_MAIN = [
  SJ(23, 0), SD(26, 0),
  // The safe first use: hold the cape at the lip; let go on the field.
  SG(46, 1, "g"), SU(57, 1, "g"),
  // The need.
  SJ(76, 1), SD(79, 1), SG(79, 1), SU(97, 2, "g"),
  // The cape floats when it cannot fly.
  SJ(116, 2), SD(119, 2), SJ(129, 3), SG(129, 3), SU(143, 3, "g"),
  // Letting go.
  SJ(156, 3), SD(159, 3), SG(159, 3), SU(169, 4), SJ(173, 4), SJ(176, 4, "a"),
  // The water stair.
  SJ(204, 4), SD(207, 4), SG(207, 4), SU(218, 5),
  SJ(223, 5), SG(223, 5), SU(229, 5),
  SJ(235, 5), SG(235, 5), SU(241, 5),
  // The widest void.
  SJ(260, 5), SD(263, 5), SD(269, 6), SG(269, 6), SU(278, 7, "g"),
  // The rise, twice.
  SJ(292, 7), SD(295, 7), SG(295, 7), SJ(302, 8, "a"), SU(302, 8),
  SJ(310, 8), SD(313, 8), SG(313, 8), SJ(320, 9, "a"), SU(320, 9),
  // Over the lid and onto the shelf.
  SJ(327, 9), SJ(336, 9),
];
const STILL = {
  key: "still-water",
  title: "Still Water",
  look: "neptune",
  toward: "Neptune",
  introduces: "glide",
  bpm: 100,
  clock: S_CLOCK,
  physics: {},
  verbs: { double: true, cape: true, glide: false, dive: false, super: false },
  gets: [{ id: "helper", verb: "glide", x: gk(44, 1) }],
  capeRule: "breath",
  view: null,
  level: { title: "Still Water", speed: 270, startX: 220, startY: SY.plain, finishX: gk(352, 9), finishY: SY.shelf, beat: BEAT },
  movements: [{ id: "III", x: -1000, numeral: "III", name: "Still Water" }],
  sections: [
    { x: -1000, movement: "III", step: "warm", name: "III · Still Water" },
    { x: gk(36, 1), movement: "III", step: "get", name: "III · Still Water — the helper" },
    { x: gk(64, 1), movement: "III", step: "need", name: "III · Still Water — the still void" },
    { x: gk(104, 2), movement: "III", step: "twist", name: "III · Still Water — floating, letting go" },
    { x: gk(192, 4), movement: "III", step: "develop", name: "III · Still Water — the water stair" },
    { x: gk(280, 7), movement: "III", step: "conclude", name: "III · Still Water — the rise" },
    { x: gk(326, 9), movement: "III", step: "coda", name: "III · Still Water — Neptune's shelf" },
  ],
  // Beacons on half bars 5, 7½, 10, 13, 16½ and 18 (11.7 s real apart at most).
  checkpoints: [
    { id: "float", x: gk(64, 1) - 3, y: SY.field, platform: "still-field", story: "Something small and kind drifted ahead of her, and the air held it up.", tip: "Jump, press the cape near the top, and keep holding it." },
    { id: "still", x: gk(104, 2) - 3, y: SY.far, platform: "far-shore", story: "Out here the dark lay still as water, and holding on was enough.", tip: "After a flight the cape cannot fly again, but held, it still floats." },
    { id: "drift", x: gk(144, 3) - 3, y: SY.shoreA, platform: "shore-a", story: "Some shores are only reached by letting go.", tip: "Let go of the cape over the second islet, then jump twice." },
    { id: "stair", x: gk(192, 4) - 3, y: SY.next, platform: "next-shore", story: "The little light went down the sea's stair, one step at a time.", tip: "Jump holding the cape, and let go above each step." },
    { id: "wide", x: gk(248, 5) - 3, y: SY.stair3, platform: "stair-3", story: "Below her Neptune turned, slow as a breath held under water.", tip: "Take every star of the first flight: it gives the cape back for a second." },
    { id: "rise", x: gk(280, 7) - 3, y: SY.wide, platform: "wide-shore", story: "Fly, float, let go, and rise: the water had taught her that.", tip: "Fly, hold, then let go and jump while you float." },
  ],
  startTip: "Run through the little light. Hold the cape to float.",
  main: S_MAIN,
  high: S_HIGH,
  updrafts: [],
  cascades: [],
  chains: S_CHAINS,
  great: S_GREAT,
  // The helper (RESEARCH_PROGRESSION 2.1): a small wandering light that
  // drifts down the slope of air at the cliff's lip from 36; Diana runs
  // through it on 44 (the GET), and the cape ripples for one bar.
  moments: [
    { id: "helper-drift", kind: "helper", k: 36, target: "helper" },
    { id: "cape-ripple", kind: "ripple", k: 44, target: "helper" },
  ],
  decor: [{ id: "helper", kind: "helper", x: gk(44, 1), y: SY.cliff - 40, to: [gk(56, 1), SY.field - 40] }],
  prompts: [
    { id: "p-float", glyph: ["hold-right"], action: "glide", x: gk(47, 1), y: SY.cliff - 150, from: gk(46, 1), to: gk(56, 1), inputX: gk(48, 1) + 10, optional: true, route: "main" },
    { id: "p-hold", glyph: ["up", "then", "hold-right"], action: "glide", x: gk(77, 1), y: SY.field - 170, from: gk(76, 1) - 30, to: gk(96, 2), inputX: gk(76, 1) + 14 },
  ],
  stars: [
    // Running stars where the bar is full or the next cape press is a
    // flight anyway (after the plain's wake and each beacon).
    ...[[12, 0, SY.plain], [15, 0, SY.plain], [18, 0, SY.plain], [106, 2, SY.far], [109, 2, SY.far], [112, 2, SY.far], [146, 3, SY.shoreA], [149, 3, SY.shoreA], [152, 3, SY.shoreA], [194, 4, SY.next], [197, 4, SY.next], [200, 4, SY.next], [250, 5, SY.stair3], [253, 5, SY.stair3], [256, 5, SY.stair3], [282, 7, SY.wide], [285, 7, SY.wide], [288, 7, SY.wide], [343, 9, SY.shelf], [346, 9, SY.shelf], [349, 9, SY.shelf]].map(([k, F, y], i) => [`run-star-${i}`, gk(k, F) + 33.5, y - 40, "low"]),
    // The field after the float, the end of the still void's glide and the
    // first stair step (one: the stair's held capes must not find a full bar).
    ...[58, 60, 62].map((k, i) => [`field-star-${i}`, gk(k, 1) + 33.5, SY.field - 40, "low"]),
    ...[[92, 56.3], [94, 95.6]].map(([k, dy], i) => [`still-star-${i}`, gk(k, 2) + 33.5, at(SY.field, dy), "low"]),
    ["stair-star-0", gk(220, 5) + 33.5, SY.stair1 - 40, "low"],
    // A star on each hop's rise.
    ...[[327, SY.climb2], [336, SY.lid]].map(([k, y], i) => [`hop-star-${i}`, gk(k + 1, 9) + 33.5, y - 64 - 36, "low"]),
  ],
  routes: {
    main: S_PLAN_MAIN,
    upper: [
      SJ(23, 0), SD(26, 0),
      // Great Star 1: jump at the lip, jump again, hold: the longest float.
      SG(46, 1, "g"), SJ(48, 1), SJ(52, 1, "a"), SU(71, 1, "g"),
      ...S_PLAN_MAIN.filter(([x]) => x > gk(74, 1) && x < gk(150, 3)),
      // Great Star 2: let go early (163) onto the tiny islet, hop to the second.
      SJ(156, 3), SD(159, 3), SG(159, 3), SU(163, 4), SJ(166, 4, "g"), SJ(173, 4), SJ(176, 4, "a"),
      ...S_PLAN_MAIN.filter(([x]) => x > gk(200, 4) && x < gk(258, 5)),
      // Great Star 3: jump, jump again, the cape, hold over the widest void.
      SJ(260, 5), SJ(264, 5, "a"), SD(267, 5), SG(267, 5), SU(285, 6, "g"),
      ...S_PLAN_MAIN.filter(([x]) => x > gk(290, 7)),
    ],
    ability: S_PLAN_MAIN,
    // The safe line: walk off the cliff without the cape, then the main route.
    safe: S_PLAN_MAIN.filter(([x, a]) => !(x > gk(40, 1) && x < gk(60, 1) && (a === "glide" || a === "unglide"))),
  },
};

/* ---- IV · The Way Down (107 BPM): the song at home; the dive ----
 * RESEARCH_PROGRESSION 4.5 (IV). Clock 1, shared simulation physics; the
 * glide is owned, the necklace (the GET on 44) gives the dive. Cells (dy at
 * k/16 after a grid takeoff, up < 0; scripts/arcs.mjs on the interim III):
 *   jump, cape 3, hold:            15: +36.7 (the warm-up)
 *   a dive on a lid falls 127 px in 1.4/16: pressed 0.4/16 (56 ms) before
 *   the grid its notes snap onto it and the landing is on the next one
 *   (the score's quantiser only waits forward, at most 70 ms)
 *   a dive from the air falls 427 px in 3/16; through a lid 77 px below
 *   the dive's height it breaks it 1.18/16 in (the shards snap onto the
 *   next eighth) and lands on the floor 276 px under the lid on the grid
 *   jump, cape 3, dive 6:           7: +2.2 (the dive cuts the flight 3/16
 *                                  in: +94.9 px instead of 113.55; without it
 *                                  the flight runs on over the islet)
 *   jump holding the cape, dive 8:  9: +84.2 (a dive cancels a glide)
 *   jump, cape 3, dive 8:           9: +38.4
 *   jump, cape 3, hold, dive 10:   11: +48.3
 *   jump, jump 3, cape 6:          11: -160.4 (out of the broken well)
 *   held hop 4: -79.9; jump, cape 3: 9: -16.8; jump, jump 3: 7: -160.2
 * A grid x is wk(k, F, C): F completed flights, C flights a dive cut 3/16 in. */
const WD_CUT = 94.9;
const wk = (k, F = 0, C = 0) => 220 + 37.85 * k + 113.55 * F + WD_CUT * C;
const wIsle4 = (id, landK, F, C, takeoffK, y, lead = 90) => [id, wk(landK, F, C) - lead, y, wk(takeoffK, F, C) + 10 - (wk(landK, F, C) - lead)];
const DY = { gate: 62, lid: 99, floor: 226, islet: 228, shore: 148, rock: 232, cacheLid: 152, cache: 295, gateB: 135, brokenLid: 212, well: 488, wellShore: 328, ringGate: 412, ring1: 450, ring2: 534, ring3: 582, ringHigh: 422, plane: 460, lidWell: 702, gs3: 550 };
const D_MAIN = [
  ["uranus-gate", -700, DY.gate, wk(23) + 10 + 700],
  // The glinting stone: the warm-up's flight and held cape land on 38, and
  // from 42 the stone is a lid. The necklace wakes on 44, and a dive breaks
  // the lid on 53.6 into the star row 127 px below (55). Running on, she
  // crosses the lid and walks off the ledge after it at 60 onto the same floor.
  ["glint-rock", wk(38, 1) - 81, DY.lid, wk(42, 1) - (wk(38, 1) - 81)],
  ["glint-lid", wk(42, 1), DY.lid, 37.85 * 14, "lid"],
  ["glint-ledge", wk(56, 1), DY.lid, wk(60, 1) + 6 - wk(56, 1)],
  ["glint-floor", wk(42, 1), DY.floor, wk(76, 1) + 10 - wk(42, 1)],
  // The need: jump 76, cape 79, dive 82 cuts the flight over the islet
  // (lands 83); without the dive the flight runs on past its end (60 px
  // after the landing) and the fall after it misses everything.
  ["cut-islet", wk(83, 1, 1) - 80, DY.islet, 140],
  // A held hop up 80 (84), then a jump holding the cape and a dive that
  // cancels the glide onto the rock (96, 104, 105).
  wIsle4("cut-shore", 88, 1, 1, 96, DY.shore, 70),
  wIsle4("glide-rock", 105, 1, 1, 124, DY.rock, 80),
  // The glint: a lid that holds a run (the cache under it is optional), a
  // jump and a flight up 17 px off its end (136, 139).
  wIsle4("cache-lid", 128, 1, 1, 136, DY.cacheLid, 70).concat("lid"),
  wIsle4("broken-gate", 145, 2, 1, 164, DY.gateB, 90),
  // The broken well: a jump and a flight (164, 167) over a long lid on a
  // well deeper than a walk-off survives; the dive at 172 breaks the lid
  // from the air and lands on the well's floor on 175 (a flight alone lands
  // on the lid, and a dive there still opens it); out by jump, double and
  // flight (185, 188, 191), 160 px up on 196.
  ["broken-lid", wk(171, 3, 1), DY.brokenLid, 480, "lid"],
  ["well-floor", wk(171, 3, 1), DY.well, wk(185, 3, 1) + 10 - wk(171, 3, 1)],
  wIsle4("well-shore", 196, 4, 1, 204, DY.wellShore, 90),
  // The way down into Uranus's rings: hold and dive, then fly and dive,
  // hold and dive, fly, hold and dive.
  wIsle4("ring-gate", 213, 4, 1, 228, DY.ringGate, 80),
  wIsle4("ring-1", 237, 5, 1, 241, DY.ring1, 70),
  wIsle4("ring-2", 250, 5, 1, 254, DY.ring2, 70),
  // (Its lid, the well's lid, is optional: Great Star 2 is under it.)
  wIsle4("ring-3", 265, 6, 1, 268, DY.ring3, 80),
  ["ring-lid", wk(268, 6, 1) + 10, DY.ring3, 37.85 * 8, "lid"],
  ["ring-3b", wk(276, 6, 1) + 10, DY.ring3, wk(292, 6, 1) + 10 - (wk(276, 6, 1) + 10)],
  // Up again (a double, 292/295), then a jump, a flight and a dive down to
  // the ring plane and the door (bar 22).
  wIsle4("ring-high", 299, 6, 1, 302, DY.ringHigh, 80),
  ["ring-plane", wk(311, 7, 1) - 80, DY.plane, wk(336, 7, 1) + 520 - (wk(311, 7, 1) - 80)],
];
const D_HIGH = [
  // The star cache under the glint (Great Star 1); out by a double.
  ["star-cache", wk(129, 1, 1), DY.cache, 37.85 * 9],
  // The well under the ring lid (Great Star 2); out by a double onto ring-3b.
  ["lid-well", wk(268, 6, 1) + 10, DY.lidWell, 37.85 * 9],
  // Great Star 3's tiny islet: a dive early out of the held cape (261).
  ["ring-islet", wk(261.6, 6, 1), DY.gs3, 37.85 * 1.4],
];
const atY = (y0, dy) => Math.round(y0 + dy - 36);
const D_CHAINS = [
  // The warm-up's flight and held cape.
  { id: "warm-song", route: "low", stars: [...flightStars(26, 0, DY.gate, 3, false), ...[[32, -95.6], [34, -61.4]].map(([k, dy]) => [wk(k, 1) + 39.5, atY(DY.gate, dy)])] },
  // On the glint's lid and the next jump's rise: complete on 138, before
  // the flight off its end (139): the lid gives no breath.
  { id: "glint-song", route: "low", stars: [[wk(132, 1, 1) + 39.5, DY.cacheLid - 40], [wk(134, 1, 1) + 39.5, DY.cacheLid - 40], [wk(137, 1, 1) + 39.5, atY(DY.cacheLid, -64.7)], [wk(138, 1, 1) + 39.5, atY(DY.cacheLid, -99.3)]] },
  // The cache (upper only).
  { id: "cache-song", route: "high", stars: [131, 132, 133, 134].map((k) => [wk(k, 1, 1) + 39.5, DY.cache - 40]) },
  // In the broken well: on its floor and out along the jump and the double,
  // complete on 190, before the flight (191).
  { id: "well-song", route: "low", stars: [[wk(183, 3, 1) + 39.5, DY.well - 40], [wk(186, 3, 1) + 39.5, atY(DY.well, -64.7)], [wk(188, 3, 1) + 39.5, atY(DY.well, -104.3)], [wk(190, 3, 1) + 39.5, atY(DY.well, -190.3)]] },
  // On ring-2 and the next jump's rise: complete on 256, before its flight
  // (257), on the flight's own line (an optional flight before it cannot
  // spend its charge).
  { id: "ring-song", route: "low", stars: [[wk(251, 5, 1) + 39.5, DY.ring2 - 40], [wk(252, 5, 1) + 39.5, DY.ring2 - 40], [wk(255, 5, 1) + 39.5, atY(DY.ring2, -64.7)], [wk(256, 5, 1) + 39.5, atY(DY.ring2, -99.3)]] },
  // On ring-high and the last jump's rise: complete on 304, before its flight (305).
  { id: "plane-song", route: "low", stars: [[wk(300, 6, 1) + 39.5, DY.ringHigh - 40], [wk(301, 6, 1) + 39.5, DY.ringHigh - 40], [wk(303, 6, 1) + 39.5, atY(DY.ringHigh, -64.7)], [wk(304, 6, 1) + 39.5, atY(DY.ringHigh, -99.3)]] },
];
const D_GREAT = [
  { id: "great-1", x: wk(133, 1, 1) + 20, y: DY.cache - 46, line: "the star cache under the glinting lid: dive" },
  { id: "great-2", x: wk(272, 6, 1) + 20, y: DY.lidWell - 46, line: "under the ring's lid: dive, then jump twice out" },
  { id: "great-3", x: wk(262, 6, 1) + 10, y: DY.gs3 - 40, line: "fly, hold the cape, then dive exactly onto the tiny islet" },
];
const DJ = (k, F, C, when = "g") => [wk(k, F, C) - 0.3, "jump", when];
const DD = (k, F, C) => [wk(k, F, C) - 0.3, "dash", "a"];
const DG = (k, F, C, when = "*") => [wk(k, F, C) - 0.3, "glide", when];
const DU = (k, F, C, when = "g") => [wk(k, F, C) - 0.3, "unglide", when];
const DV = (x, when = "a") => [x - 0.3, "dive", when];
const D_PLAN_MAIN = [
  DJ(23, 0, 0), DD(26, 0, 0), DG(26, 0, 0), DU(39, 1, 0),
  // The safe first use: a dive breaks the glinting lid.
  DV(wk(53.6, 1), "g"),
  // The need: jump, cape, and the dive that cuts the flight 3/16 in.
  DJ(76, 1, 0), DD(79, 1, 0), DV(wk(79, 1) + 3 * 69.69),
  DJ(84, 1, 1),
  DJ(96, 1, 1), DG(96, 1, 1), DV(wk(104, 1, 1)), DU(106, 1, 1),
  DJ(124, 1, 1), DJ(136, 1, 1), DD(139, 1, 1),
  // The broken well.
  DJ(164, 2, 1), DD(167, 2, 1), DV(wk(172, 3, 1)), DJ(185, 3, 1), DJ(188, 3, 1, "a"), DD(191, 3, 1),
  // The way down.
  DJ(204, 4, 1), DG(204, 4, 1), DV(wk(212, 4, 1)), DU(214, 4, 1),
  DJ(228, 4, 1), DD(231, 4, 1), DV(wk(236, 5, 1)),
  DJ(241, 5, 1), DG(241, 5, 1), DV(wk(249, 5, 1)), DU(251, 5, 1),
  DJ(254, 5, 1), DD(257, 5, 1), DG(257, 5, 1), DV(wk(264, 6, 1)), DU(266, 6, 1),
  DJ(292, 6, 1), DJ(295, 6, 1, "a"),
  DJ(302, 6, 1), DD(305, 6, 1), DV(wk(310, 7, 1)),
];
const WAY_DOWN = {
  key: "way-down",
  title: "The Way Down",
  look: "uranus",
  toward: "Uranus",
  introduces: "dive",
  bpm: 107,
  clock: 1,
  physics: {},
  verbs: { double: true, cape: true, glide: true, dive: false, super: false },
  gets: [{ id: "necklace", verb: "dive", x: wk(44, 1) }],
  capeRule: "breath",
  view: null,
  level: { title: "The Way Down", speed: 270, startX: 220, startY: DY.gate, finishX: wk(336, 7, 1), finishY: DY.plane, beat: BEAT },
  movements: [{ id: "IV", x: -1000, numeral: "IV", name: "The Way Down" }],
  sections: [
    { x: -1000, movement: "IV", step: "warm", name: "IV · The Way Down" },
    { x: wk(36, 1), movement: "IV", step: "get", name: "IV · The Way Down — the necklace" },
    { x: wk(64, 1), movement: "IV", step: "need", name: "IV · The Way Down — the cut" },
    { x: wk(112, 1, 1), movement: "IV", step: "twist", name: "IV · The Way Down — the glint" },
    { x: wk(152, 2, 1), movement: "IV", step: "twist", name: "IV · The Way Down — the broken well" },
    { x: wk(216, 4, 1), movement: "IV", step: "conclude", name: "IV · The Way Down — the rings" },
    { x: wk(311, 7, 1), movement: "IV", step: "coda", name: "IV · The Way Down — the ring plane" },
  ],
  // Beacons on half bars 5, 8, 10½, 14½ and 18½ (at most 9.8 s real apart).
  checkpoints: [
    { id: "down", x: wk(64, 1) - 3, y: DY.floor, platform: "glint-floor", story: "The stone at her throat woke, and showed her where the ground was thin.", tip: "Jump, press the cape near the top, then press down over the islet." },
    { id: "glint", x: wk(112, 1, 1) - 3, y: DY.rock, platform: "glide-rock", story: "Where stars had fallen through, the stone still glinted.", tip: "Hold the cape off the edge, then press down to drop out of the float." },
    { id: "broken", x: wk(152, 2, 1) - 3, y: DY.gateB, platform: "broken-gate", story: "Down was a way too. Uranus lay on its side, and so could she.", tip: "Fly over the long lid, then press down: only a dive opens the well." },
    { id: "rings", x: wk(216, 4, 1) - 3, y: DY.ringGate, platform: "ring-gate", story: "Below her the rings of Uranus stood upright, like doors left open.", tip: "Fly, then press down onto each ring stone on the beat." },
    { id: "plane", x: wk(280, 6, 1) - 3, y: DY.ring3, platform: "ring-3b", story: "One more ring, one more fall, and the plane of the rings held her.", tip: "Jump twice up, then fly and drop onto the plane." },
  ],
  startTip: "The necklace wakes on the glinting stone. Press down to break it.",
  main: D_MAIN,
  high: D_HIGH,
  updrafts: [],
  cascades: [],
  chains: D_CHAINS,
  great: D_GREAT,
  // The necklace (RESEARCH_PROGRESSION 2.1): the eye-stone she has carried
  // since II wakes over the glinting stone (44); a ring of light pulses from
  // her chest and the lids glint from then on.
  moments: [{ id: "necklace-wake", kind: "necklace", k: 44, target: "necklace" }],
  decor: [{ id: "glint-stone", kind: "glint", x: wk(44, 1), y: DY.lid }],
  prompts: [
    { id: "p-break", glyph: ["down"], action: "dive", x: wk(52, 1), y: DY.lid - 150, from: wk(48, 1), to: wk(58, 1), inputX: wk(56, 1), optional: true, route: "main" },
    { id: "p-cut", glyph: ["down"], action: "dive", x: wk(80, 1), y: DY.floor - 200, from: wk(79, 1) + 2 * 69.69, to: wk(83, 1, 1), inputX: wk(79, 1) + 3.4 * 69.69 },
  ],
  stars: [
    // The star row the safe dive drops her onto.
    ...[55, 57, 59, 61].map((k, i) => [`row-star-${i}`, wk(k, 1) + 33.5, DY.floor - 40, "low"]),
    // Running stars after the beacons (the bar is full there anyway).
    ...[[66, 1, 0, DY.floor], [69, 1, 0, DY.floor], [72, 1, 0, DY.floor], [114, 1, 1, DY.rock], [117, 1, 1, DY.rock], [120, 1, 1, DY.rock], [154, 2, 1, DY.gateB], [157, 2, 1, DY.gateB], [160, 2, 1, DY.gateB], [218, 4, 1, DY.ringGate], [221, 4, 1, DY.ringGate], [224, 4, 1, DY.ringGate], [282, 6, 1, DY.ring3], [285, 6, 1, DY.ring3], [288, 6, 1, DY.ring3], [316, 7, 1, DY.plane], [319, 7, 1, DY.plane], [322, 7, 1, DY.plane]].map(([k, F, C, y], i) => [`run-star-${i}`, wk(k, F, C) + 33.5, y - 40, "low"]),
    // Two along the cut flight (loose: the held capes after it must not find a full bar).
    ...[1, 2].map((j, i) => [`cut-star-${i}`, wk(79, 1) + 69.69 * j + 33.5, DY.floor - 141, "low"]),
    // Along the held capes after their presses, the broken lid, the flights
    // of the way down and the plane (loose: none before a held cape on its own).
    ...[[98, 1, 1, DY.shore, -99.3], [100, 1, 1, DY.shore, -99.1], [102, 1, 1, DY.shore, -67.1], [177, 3, 1, DY.well, -4], [179, 3, 1, DY.well, -4], [206, 4, 1, DY.wellShore, -99.3], [208, 4, 1, DY.wellShore, -99.1], [210, 4, 1, DY.wellShore, -67.1], [243, 5, 1, DY.ring1, -99.3], [245, 5, 1, DY.ring1, -99.1], [247, 5, 1, DY.ring1, -67.1], [325, 7, 1, DY.plane, -4], [328, 7, 1, DY.plane, -4]].map(([k, F, C, y, dy], i) => [`line-star-${i}`, wk(k, F, C) + 33.5, atY(y, dy), "low"]),
    ...[[231, 4, 1, DY.ringGate, 1], [231, 4, 1, DY.ringGate, 2], [257, 5, 1, DY.ring2, 1], [257, 5, 1, DY.ring2, 2]].map(([k, F, C, y, j], i) => [`flight-star-${i}`, wk(k, F, C) + 69.69 * j + 33.5, y - 141, "low"]),
    // A star on each held hop's rise.
    ...[[84, 1, 1, DY.islet], [124, 1, 1, DY.rock]].map(([k, F, C, y], i) => [`hop-star-${i}`, wk(k + 1, F, C) + 33.5, y - 64 - 36, "low"]),
  ],
  routes: {
    main: D_PLAN_MAIN,
    upper: [
      ...D_PLAN_MAIN.filter(([x]) => x < wk(120, 1, 1)),
      // Great Star 1: dive through the glint into the cache; out by jump,
      // double and flight (the bar is full: no flight off the lid's end).
      DJ(124, 1, 1), DV(wk(129.5, 1, 1), "g"), DJ(135, 1, 1), DJ(138, 1, 1, "a"), DD(141, 1, 1),
      ...D_PLAN_MAIN.filter(([x]) => x > wk(160, 2, 1) && x < wk(252, 5, 1)),
      // Great Star 3: fly, hold, dive early onto the tiny islet; walk off.
      DJ(254, 5, 1), DD(257, 5, 1), DG(257, 5, 1), DV(wk(260.6, 6, 1)), DU(263, 6, 1),
      // Great Star 2: dive through the ring's lid (120 px down), jump and
      // jump again early (before the jump's top could pop her onto the lip).
      DV(wk(269.5, 6, 1), "g"), DJ(273, 6, 1), DJ(275, 6, 1, "a"),
      ...D_PLAN_MAIN.filter(([x]) => x > wk(290, 6, 1)),
    ],
    ability: D_PLAN_MAIN,
    // The safe line: run on along the glinting lid and walk off its end.
    safe: D_PLAN_MAIN.filter(([x, a]) => !(a === "dive" && x < wk(60, 1))),
  },
};

/**
 * Open a level at `cut` and insert a section (RESEARCH_LEVELS: content, not
 * padding). Everything at x >= cut moves by (dx, dy): platforms, wind,
 * constellations, stars, Great Stars, glyphs, beacons, sections, the door
 * and the pilots' steps. dx is a whole number of sixteenths of run (plus
 * three per inserted flight, 63.67 px per super jump), so the rest of the
 * level keeps its grid; a whole number of bars keeps its music too.
 * `content` holds the new section in final coordinates; `drop` removes
 * chain or star ids from the moved part (a void repeated without stars).
 */
function insertSection(def, { cut, dx, dy = 0, content = {}, drop = [] }) {
  const moveX = (x) => (x >= cut ? x + dx : x);
  const moved = (x) => x >= cut;
  const plat = (list) => list.map(([id, x, y, w, t, e]) => (moved(x) ? [id, x + dx, y + dy, w, t, e] : [id, x, y, w, t, e]));
  const out = {
    ...def,
    level: { ...def.level, finishX: def.level.finishX + dx, finishY: def.level.finishY + dy },
    main: [...plat(def.main), ...(content.main ?? [])],
    high: [...plat(def.high), ...(content.high ?? [])],
    updrafts: [...def.updrafts.map((u) => (moved(u.x) ? { ...u, x: u.x + dx, top: u.top + dy, bottom: u.bottom + dy } : u)), ...(content.updrafts ?? [])],
    cascades: [...def.cascades, ...(content.cascades ?? [])],
    chains: [
      ...def.chains.filter((c) => !drop.includes(c.id)).map((c) => ({ ...c, stars: c.stars.map(([x, y]) => (moved(x) ? [x + dx, y + dy] : [x, y])) })),
      ...(content.chains ?? []),
    ],
    great: [...def.great.map((g) => (moved(g.x) ? { ...g, x: g.x + dx, y: g.y + dy } : g)), ...(content.great ?? [])],
    prompts: [...def.prompts.map((q) => (moved(q.x) ? { ...q, x: q.x + dx, y: q.y + dy, from: moveX(q.from), to: moveX(q.to), inputX: moveX(q.inputX) } : q)), ...(content.prompts ?? [])],
    stars: [...def.stars.filter(([id]) => !drop.includes(id)).map(([id, x, y, r]) => (moved(x) ? [id, x + dx, y + dy, r] : [id, x, y, r])), ...(content.stars ?? [])],
    checkpoints: [...def.checkpoints.map((c) => (moved(c.x) ? { ...c, x: c.x + dx, y: c.y + dy } : c)), ...(content.checkpoints ?? [])].sort((a, b) => a.x - b.x),
    sections: [...def.sections.map((q) => ({ ...q, x: moveX(q.x) })), ...(content.sections ?? [])].sort((a, b) => a.x - b.x),
    routes: {},
  };
  for (const [name, plan] of Object.entries(def.routes)) {
    const add = content.routes?.[name] ?? content.routes?.main ?? [];
    // Steps keep their order; inserted ones sit between the two parts.
    out.routes[name] = [...plan.filter(([x]) => x < cut), ...add, ...plan.filter(([x]) => x >= cut).map(([x, a, w]) => [x + dx, a, w])];
  }
  return out;
}

/* ---- L2 · Borrowed Wind (107 BPM): floating with marked beats ----
 * Movement III at its own coordinates and today's physics: the cape, solar
 * wind and the held-cape glide, and the dive as the way into the star cache.
 * There is no cracked stone yet: the split voids became one long void with
 * nothing to land on (jump, flight, a constellation gives the cape back,
 * flight again: solved with scripts/arcs.mjs, landing 14/16 after the
 * takeoff, 15 px lower) and the finale launches from stable rock. */
const L2_VOID = 16003.45; // takeoff, sixteenth 417 of the chapter's lattice
const vx = (j, flights = 1) => L2_VOID + 37.85 * j + 113.55 * flights;
const L2_PLAN = {
  breeze: [[13997.2, "jump", "g"], [14027.2, "glide", "*"], [14197.2, "unglide", "*"]],
  void: [[L2_VOID - 0.3, "jump", "g"], [vx(3, 0) - 0.3, "dash", "a"], [vx(9) - 0.3, "dash", "a"]],
  // Upper: a double jump between the flights reaches Great Star 2.
  voidHigh: [[L2_VOID - 0.3, "jump", "g"], [vx(3, 0) - 0.3, "dash", "a"], [vx(7) - 0.3, "jump", "a"], [vx(11) - 0.3, "dash", "a"]],
  // The far rock is 86 px above the wind gate: a tap lands 4/16 later.
  rock: [[vx(30, 2) - 0.3, "tap", "g"]],
  wind: [[18052, "jump", "g"], [18080, "glide", "*"], [18300, "unglide", "*"]],
  // (The second press comes early: later, the step-up already sets her on
  // the shore and the pilot would wait for an airborne moment.)
  cache: [[18600, "dive", "g"], [18850, "jump", "g"], [18895, "jump", "a"], [19106.5, "jump", "g"]],
};
const L2_BASE = {
  id: 2,
  key: "wind",
  numeral: "II",
  title: "Borrowed Wind",
  bpm: 107,
  clock: 1,
  physics: {},
  verbs: ALL_VERBS,
  view: null,
  level: { title: "Borrowed Wind", speed: 270, startX: gx(360), startY: 319, finishX: 21984, finishY: 470, beat: BEAT },
  movements: [{ id: "L2", x: -1000, numeral: "II", name: "Borrowed Wind" }],
  sections: [
    { x: -1000, movement: "L2", step: "introduce", name: "II · Borrowed Wind" },
    { x: 15540, movement: "L2", step: "develop", name: "II · Borrowed Wind — the long void" },
    { x: 17450, movement: "L2", step: "twist", name: "II · Borrowed Wind — the updraft" },
    { x: 19350, movement: "L2", step: "conclude", name: "II · Borrowed Wind — everything" },
    { x: 21440, movement: "L2", step: "coda", name: "II · Borrowed Wind — the far door" },
  ],
  checkpoints: byId(CHECKPOINTS, ["voids", "updraft", "finale"]),
  startTip: "Jump at the edge, then press the cape at the top of the jump.",
  main: [
    ...pick(MAIN, ["hearth", "wind-shore"]),
    ["far-rock", 16701, 392, 675],
    ...pick(MAIN, ["wind-gate", "lifted-shore", "lid-2", "lifted-down", "finale-gate"]),
    ["finale-rock", 19990, 381, 200],
    ...pick(MAIN, ["finale-high", "far-door"]),
  ],
  high: pick(HIGH, ["star-cache", "low-a", "low-b", "low-c"]),
  updrafts: UPDRAFTS,
  cascades: [],
  chains: [
    ...byId(CHAINS, ["flight-line"]),
    // On the first flight's line, one per sixteenth: complete by the end of
    // the flight, so the second flight (3/16 later) has its cape back.
    { id: "void-song", route: "low", stars: [3, 4, 5, 6].map((j) => [L2_VOID + 37.85 * j + 31.84 * (j - 3) + 40, 237]) },
    ...byId(CHAINS, ["cache-song", "finale-song"]),
  ],
  great: [
    { id: "great-1", x: 18760, y: 425, line: "the star cache under the cracked lid: dive" },
    { id: "great-2", x: 16490, y: 128, line: "above the long void: a double jump between the flights" },
    { id: "great-3", x: 21105, y: 100, line: "the top of the last wind: hold the cape in it" },
  ],
  prompts: [
    ...byId(PROMPTS, ["p-breeze", "p-cape"]),
    { id: "p-refill", glyph: ["right"], action: "dash", x: vx(8) + 20, y: 260, from: vx(7), to: vx(10), inputX: vx(9) },
    ...byId(PROMPTS, ["p-updraft", "p-wind"]),
    { ...PROMPTS.find((q) => q.id === "p-lid2"), after: "p-wind" },
  ],
  stars: starsIn(13817, 23000),
  routes: {
    main: [...CP.hearthVoid, ...L2_PLAN.void, ...L2_PLAN.rock, ...CP.updraft, ...CP.finale],
    upper: [...L2_PLAN.breeze, ...CP.hearthVoid, ...L2_PLAN.voidHigh, ...L2_PLAN.rock, ...L2_PLAN.wind, ...L2_PLAN.cache, ...CP.finale.slice(0, 4), [20583.5, "dash", "a"], [20880, "glide", "*"], [21060, "unglide", "*"]],
    ability: [...L2_PLAN.breeze, ...CP.hearthVoid, ...L2_PLAN.void, ...L2_PLAN.rock, ...L2_PLAN.wind, ...L2_PLAN.cache, ...CP.finale],
    safe: [...CP.hearthVoid, ...L2_PLAN.void, ...L2_PLAN.rock, ...CP.updraft, ...CP.safeFinale],
  },
};

/* L2's sections, inserted in order. (1) The hearth void twice: the first
 * time along its star line, then (after a 4/16 hop up 80 px onto a second
 * hearth) the same void with nothing to follow. Two bars and one flight:
 * dx = 37.85 x (32 + 3). */
const L2_X1 = 37.85 * (32 + 3);
const L2_S1 = insertSection(L2_BASE, {
  cut: 15098,
  dx: L2_X1,
  dy: -22,
  drop: ["flight-line"],
  content: {
    main: [
      ["wind-shore-1", 15435, 377, 15786.35 - 15435],
      ["hearth-2", 15867.75, 297, 16384.75 - 15867.75],
    ],
    chains: [{ id: "first-flight", route: "low", stars: [[15096, 178], [15202, 178], [15343, 178], [15436, 243]] }],
    sections: [{ x: 15440, movement: "L2", step: "introduce", name: "II · Borrowed Wind — the void again, without stars" }],
    routes: { main: [[15776.05, "jump", "g"], [14981.5 + L2_X1, "jump", "g"], [15096 + L2_X1, "dash", "a"]] },
  },
});
/* (2) Currents, before the finale: a flight ends over a low islet and a
 * dive lands on it on the beat (dive at 7/16, 44 px down 1/16 later); a jump
 * into a column of wind that would carry Diana over the island beneath it
 * and on into the dark: a dive out of the wind lands on it 1/16 later; then
 * jump and flight (the island gave the cape back) up 69 px onto the shore
 * 7/16 later. Four bars and two flights; the finale follows 27 px lower.
 * Lattice: x = 674.2 + 37.85 k before the section (four flights so far). */
const cx = (k, flights = 5) => 220 + 113.55 * flights + 37.85 * k;
const L2_X2 = cx(586, 6) - 20431.25;
const L2_S2 = insertSection(L2_S1, {
  cut: 20600,
  dx: L2_X2,
  dy: 27,
  content: {
    main: [
      ["gust-gate", 20638.75, 390, cx(540, 4) + 10 - 20638.75],
      ["dive-islet", cx(548) - 50, 434, cx(552) + 10 - (cx(548) - 50)],
      ["under-wind", 21720, 434, cx(559) + 10 - 21720],
      // Its lip is only 20 px before the landing: a run that never dives
      // comes down 25-40 px short of it.
      ["gust-exit", cx(566, 6) - 20, 365, cx(586, 6) + 123.5 - (cx(566, 6) - 20)],
    ],
    updrafts: [{ id: "dive-wind", x: 21700, width: 170, top: 60, bottom: 620 }],
    checkpoints: [{ id: "currents", x: cx(528, 4) - 1, y: 390, platform: "gust-gate", story: "The wind will carry you anywhere. Even past where you meant to go.", tip: "In the wind, press down to drop out of it onto the island below." }],
    prompts: [
      { id: "p-islet", glyph: ["down"], action: "dive", x: cx(545), y: 330, from: cx(546), to: cx(548), inputX: cx(547) + 10 },
      { id: "p-drop", glyph: ["down"], action: "dive", x: 21785, y: 230, from: 21712, to: 21860, inputX: 21840 },
    ],
    stars: [576, 580, 584].map((k, i) => [`gust-star-${i}`, cx(k, 6) + 34, 365 - 40, "low"]),
    sections: [{ x: 20640, movement: "L2", step: "develop", name: "II · Borrowed Wind — currents" }],
    routes: {
      main: [
        [cx(540, 4) - 0.3, "jump", "g"], [cx(542, 4) - 0.3, "dash", "a"], [cx(547) - 0.3, "dive", "a"],
        [cx(552) - 0.3, "jump", "g"], [cx(554) - 0.3, "dive", "a"],
        [cx(559) - 0.3, "jump", "g"], [cx(561) - 0.3, "dash", "a"],
        // ...and the jump down to the finale, as from the lifted shore.
        [20431.25 + L2_X2, "jump", "g"],
      ],
    },
  },
});
/* (3) The glide bridge, before the currents: a jump into a column with the
 * cape held rises 40% faster; held on past its top, the cape glides (fall
 * capped at 140 px/s) across a void too wide to fall across, onto a far
 * shore. Glide is required here, and only here, and only in wind. */
// No-glide runs come down about 150 px short; the held cape lands 20/16 after the jump.
const L2_X3 = 37.85 * 64;
const L2_S3 = insertSection(L2_S2, {
  cut: 20600,
  dx: L2_X3,
  dy: -42,
  content: {
    main: [
      ["glide-gate", 20638.75, 390, cx(540, 4) + 10 - 20638.75],
      ["glide-shore", 21751.4, 322, cx(576, 4) + 10 - 21751.4],
      // A copy of the lifted shore's end: the currents begin with its jump.
      ["glide-exit", cx(581, 4) - 60, 296, cx(586, 4) + 123.5 - (cx(581, 4) - 60)],
    ],
    updrafts: [{ id: "glide-wind", x: cx(540, 4) + 30, width: 170, top: 60, bottom: 620 }],
    // Shown once she is in the wind: pressed before it, the cape would fly level.
    prompts: [{ id: "p-glide", glyph: ["hold-right"], action: "glide", x: cx(542, 4), y: 230, from: cx(540, 4) + 40, to: 21770, inputX: cx(540, 4) + 100 }],
    stars: [564, 567, 570].map((k, i) => [`glide-star-${i}`, cx(k, 4) + 34, 322 - 40, "low"]),
    // Along the held-cape line (where the pickup box meets it on 16ths 544-552).
    chains: [{ id: "glide-song", route: "low", stars: [[cx(544, 4) + 40, 149], [cx(546, 4) + 40, 61], [cx(548, 4) + 40, 56], [cx(550, 4) + 40, 77], [cx(552, 4) + 40, 119]] }],
    checkpoints: [{ id: "bridge", x: cx(528, 4) - 1, y: 390, platform: "glide-gate", story: "Hold on to the wind, and it holds on to you.", tip: "Jump into the wind with the cape held, and keep holding it past the top." }],
    sections: [{ x: 20640, movement: "L2", step: "develop", name: "II · Borrowed Wind — the glide bridge" }],
    routes: { main: [[cx(540, 4) - 0.3, "jump", "g"], [cx(540, 4) + 30, "glide", "*"], [21851, "unglide", "g"], [cx(576, 4) - 0.3, "jump", "g"], [20431.25 + 37.85 * 64, "jump", "g"]] },
  },
});
const L2 = L2_S3;

/* ---- L3 · The Breaking Constellation (118 BPM): the cool intermediate ----
 * Movement II plus the hearth void and the split voids, at their own
 * coordinates. New: cracked stone. Shelves break 5/16 (sim) after their
 * first touch-down, on the grid; the first crack's floor moved to 129 px
 * below it so the fall lands 3/16 after the break (0.415 s vs 0.421 s), and
 * a 4/16 hop climbs 80 px from it to the second crack. The upper path ends
 * at the lid: the dive is the way on, into the well, out by a double jump
 * (second press 4/16 later, up 135 px) and a 4/16 hop onto the second tile,
 * the same touch-down as Movement II's bounce. Cracks never refill the
 * cape, so the split voids need the split-song. */
const L3_SIX = 15 / 107;
// Half a sixteenth past the grid: the fall to the floor takes 2.6/16, so the
// landing is on the grid and the dive and its shards snap onto the next 16th/8th.
const L3_DIVE = 220 + 113.55 + 37.85 * 385.5;
const L3_BASE = {
  id: 3,
  key: "constellation",
  numeral: "III",
  title: "The Breaking Constellation",
  bpm: 118,
  clock: 118 / 107,
  physics: { crumbleAfter: 5 * L3_SIX },
  verbs: ALL_VERBS,
  view: { minWidth: 970, portraitMinWidth: 775 },
  level: { title: "The Breaking Constellation", speed: 270, startX: gx(160), startY: 471, finishX: gx(464) + 3 * 113.55, finishY: 478, beat: BEAT },
  movements: [{ id: "L3", x: -1000, numeral: "III", name: "The Breaking Constellation" }],
  // The first crack comes 3.1 s after waking: the title card starts at once
  // so it is gone before the first jump.
  cardDelay: 0.2,
  sections: [
    { x: -1000, movement: "L3", step: "introduce", name: "III · The Breaking Constellation" },
    { x: 8270, movement: "L3", step: "develop", name: "III · The Breaking Constellation — the ridge" },
    { x: 10137.2, movement: "L3", step: "twist", name: "III · The Breaking Constellation — the well and the wave" },
    { x: 12997.2, movement: "L3", step: "conclude", name: "III · The Breaking Constellation — the crown" },
    { x: 14900, movement: "L3", step: "develop", name: "III · The Breaking Constellation — the split voids" },
    { x: 17400, movement: "L3", step: "coda", name: "III · The Breaking Constellation — the far door" },
  ],
  checkpoints: [
    { ...CHECKPOINTS.find((q) => q.id === "well") },
    ...byId(CHECKPOINTS, ["hearth", "voids"]),
  ],
  startTip: "Cracked stone gives way soon after you land. Jump off it quickly.",
  main: [
    ...pick(MAIN, ["gate-2", "first-crack"]),
    ["crack-floor", 7150, 569, 650],
    // Movement II's well stays optional here (its lid can be run over);
    // the dive this level requires comes later, in the broken well.
    ...pick(MAIN, ["second-crack", "beat-isle", "ridge-a", "ridge-stone", "ridge-b", "ridge-c", "b3-isle", "well-rim-a", "lid", "well-rim-b"]),
    ...pick(MAIN, ["tile-0", "tile-1", "tile-2", "tile-3", "tile-4", "tile-5", "cascade-end", "last-crack", "hearth", "wind-shore", "split-crack", "split-far"]),
    ["door-rock", 17450, 478, 1000],
  ],
  high: [
    ...pick(HIGH, ["chain-a", "chain-b", "chain-c", "chain-exit", "well-floor", "well-exit"]),
    // A cracked stair off the crown: two 4/16 hops up 80 px each.
    ["crown-stair-1", gx(370) - 40, 239, gx(372) + 10 - (gx(370) - 40), "crumble"],
    ["crown-stair-2", gx(376) - 40, 159, gx(378) + 10 - (gx(376) - 40), "crumble"],
  ],
  updrafts: [],
  cascades: CASCADES,
  chains: [
    ...byId(CHAINS, ["well-song"]),
    ...byId(CHAINS, ["flight-line", "split-song"]),
  ],
  great: [
    { id: "great-1", x: 9330, y: 150, line: "the cracked chain above the ridge" },
    { id: "great-2", x: 11087.2, y: 592, line: "the star well under the first lid (an optional dive)" },
    { id: "great-3", x: gx(380), y: 25, line: "the top of the cracked stair above the crown" },
  ],
  prompts: [
    ...byId(PROMPTS, ["p-crack"]),
    ...byId(PROMPTS, ["p-lid"]),
    ...byId(PROMPTS, ["p-cape"]),
  ],
  stars: starsIn(6260, 17400).filter(([id]) => !id.startsWith("breeze")),
  routes: {
    main: [
      ...CP.breaking, ...CP.ridge,
      [10666.7, "jump", "g"], [11348.7, "jump", "g"],
      ...CP.wave, ...CP.crown, ...CP.hearthVoid, ...CP.splitVoids,
    ],
    upper: [
      ...CP.breaking,
      [8536.6, "jump", "g"], [8608.6, "jump", "a"], [8908.6, "jump", "g"], [9238.6, "jump", "g"], [9568.6, "jump", "g"], [9935, "jump", "g"],
      [10665.2, "jump", "g"], [10947.2, "dive", "g"], [11337.2, "jump", "g"], [11384, "jump", "a"], [11597.2, "jump", "g"],
      ...CP.wave.slice(1), ...CP.crown,
      [gx(366) - 0.3, "jump", "g"], [gx(372) - 0.3, "jump", "g"], [gx(378) - 0.3, "jump", "g"],
      ...CP.hearthVoid, ...CP.splitVoids,
    ],
    ability: null,
    safe: null,
  },
};
L3_BASE.routes.ability = L3_BASE.routes.main;
L3_BASE.routes.safe = L3_BASE.routes.main;
/* L3 (1) The broken well, after the crown's late double: a flight onto a
 * long cracked lid (no refill), whose end looks out over nothing. The well
 * is 276 px deep: walking (or jumping) off the lid's end falls past the 265 px
 * death line before reaching its floor, while a dive through the lid
 * lowers the allowance (RULES.smashDrop) and lands on it. The floor gives
 * the cape back: jump, jump again 3/16 later and fly 3/16 after that, out
 * 606 px onto the far shore 13/16 later (beyond any reach from the lid's
 * end), then a hop onto a copy of the last crack and the crown's late
 * double as before. Four bars, two flights; the rest sits 28 px lower. */
const bx = (k, flights) => 220 + 113.55 * flights + 37.85 * k;
// Seventy sixteenths of run (64 of time and two flights), so beacons stay on half bars.
const L3_X1 = 37.85 * 70;
const L3_LID = { x: bx(380, 1) - 60, y: 307.5, w: 520 };
const L3_S1 = insertSection(L3_BASE, {
  cut: 13800,
  dx: L3_X1,
  dy: 28,
  content: {
    main: [
      ["broken-gate", 13817.2, 319, gx(372) + 10 - 13817.2],
      ["broken-lid", L3_LID.x, L3_LID.y, L3_LID.w, "lid"],
      ["well-bottom", L3_LID.x, 584, bx(392, 1) + 10 - L3_LID.x],
      ["far-shore-3", bx(405, 2) - 60, 566, bx(411, 2) + 10 - (bx(405, 2) - 60)],
      ["last-crack-2", 13467.2 + L3_X1, 486, 300, "crumble"],
    ],
    checkpoints: [{ id: "broken", x: 13843.2, y: 319, platform: "broken-gate", story: "One star had fallen through the dark and left a door in it.", tip: "Land on the cracked lid, then press down: only a dive opens the well." }],
    prompts: [{ id: "p-break", glyph: ["down"], action: "dive", x: L3_LID.x + 200, y: 220, from: L3_LID.x + 70, to: L3_LID.x + 470, inputX: bx(392, 1) - 90 }],
    stars: [[384, 307.5], [388, 584], [390, 584]].map(([k, y], i) => [`broken-star-${i}`, bx(k, 1) + 34, y - 40, "low"]),
    sections: [{ x: 13820, movement: "L3", step: "twist", name: "III · The Breaking Constellation — the broken well" }],
    routes: {
      main: [
        [gx(372) - 0.3, "jump", "g"], [gx(374) - 0.3, "dash", "a"],
        [L3_DIVE - 0.3, "dive", "g"],
        [bx(392, 1) - 0.3, "jump", "g"], [bx(395, 1) - 0.3, "jump", "a"], [bx(398, 1) - 0.3, "dash", "a"],
        [bx(411, 2) - 0.3, "jump", "g"],
        [13545 + L3_X1, "jump", "g"], [13695.7 + L3_X1, "jump", "a"],
      ],
    },
  },
});
const L3 = L3_S1;

/* ---- L4 · The Far Door (128 BPM): agitated and tense, precise but fair ----
 * New: the super jump (a jump during a flight), taught over a stable floor
 * and then required once. Then everything at 128: Movement II's well and
 * cascade and Movement III's finale with its cracked launch, translated by
 * whole sixteenths. A super jump 2/16 into a flight keeps 2/16 of the
 * flight's extra run (63.67 px), so everything after the two required ones
 * is shifted by that much as well. Super jump arc (scripts/arcs.mjs): apex
 * 267 px up at 7/16; 233 px up at 9/16. */
const SUPER = 227.1 * 2 * (15 / 107);
// The well beacon island: chapter sixteenth 264 lands on L4 sixteenth 88, a
// whole number of bars earlier, so the cascade still drops on the beat.
const L4_DX_B = gx(88) + 2 * SUPER - gx(264);
const L4_DY_B = -120;
// The finale: the hearth's takeoff at L4 sixteenth 206 is the chapter's 490;
// with the voids inserted after it (76 sixteenths) the door is on bar 23.
const L4_DX_C = gx(206) + 2 * SUPER - (gx(490) + 3 * 113.55);
const L4_DY_C = -161;
// Jump on the grid, open the cape 2/16 later and jump again 2/16 into the
// flight (where the flight has added one SUPER of extra run).
const superAt = (k, shifts) => [[gx(k) + shifts * SUPER - 0.3, "jump", "g"], [gx(k + 2) + shifts * SUPER - 0.3, "dash", "a"], [gx(k + 4) + (shifts + 1) * SUPER - 0.3, "jump", "a"]];
const inX = (from, to) => (q) => q[1] >= from && q[1] < to;
// The hearth ends 78.5 px after its takeoff (sixteenth 206), as Movement
// III's did after the hearth void's.
const L4_B_PLAT = MAIN.filter(inX(10100, 15100)).map((q) => (q[0] === "hearth" ? [q[0], q[1], q[2], gx(206) + 2 * SUPER + 78.5 - (q[1] + L4_DX_B)] : q));
// (The high shore 3 px lower: at 128 its landing came 36 ms early.)
const L4_C_PLAT = MAIN.filter(inX(19300, 23000)).map((q) => (q[0] === "finale-high" ? [q[0], q[1], q[2] + 3, q[3]] : q));
const L4_BASE = {
  id: 4,
  key: "door",
  numeral: "IV",
  title: "The Far Door",
  bpm: 128,
  clock: 128 / 107,
  physics: { crumbleAfter: 5 * L3_SIX },
  verbs: ALL_VERBS,
  view: { minWidth: 1050, portraitMinWidth: 840 },
  level: { title: "The Far Door", speed: 270, startX: 220, startY: 470, finishX: 21984 + L4_DX_C, finishY: 470 + L4_DY_C, beat: BEAT, earth: true },
  movements: [{ id: "L4", x: -1000, numeral: "IV", name: "The Far Door" }],
  sections: [
    { x: -1000, movement: "L4", step: "introduce", name: "IV · The Far Door" },
    { x: 3300, movement: "L4", step: "develop", name: "IV · The Far Door — the wave" },
    { x: 13000 + L4_DX_B, movement: "L4", step: "twist", name: "IV · The Far Door — the crown" },
    { x: 19300 + L4_DX_C, movement: "L4", step: "conclude", name: "IV · The Far Door — everything" },
    { x: 21440 + L4_DX_C, movement: "L4", step: "coda", name: "IV · The Far Door — Earth" },
  ],
  checkpoints: [
    { id: "storm", x: gx(56) + SUPER - 3, y: 407, platform: "storm-step", story: "The wind was hers now. So was the sky above it.", tip: "Jump, open the cape, then jump again during the flight." },
    { id: "wave", x: 10211.2 + L4_DX_B, y: 464 + L4_DY_B, platform: "b3-isle", story: "The constellation was falling faster now.", tip: "Hop as soon as you land. The falling wave is catching up." },
    { id: "crown", x: 13843.2 + L4_DX_B, y: 319 + L4_DY_B, platform: "hearth", story: "The little blue world was close enough to hear.", tip: "Jump at the edge, then press the cape at the top of the jump." },
    { id: "finale", x: gx(212) + 2 * SUPER - 1, y: 412 + L4_DY_C, platform: "finale-gate", story: "Somewhere ahead, a little blue world is listening.", tip: "The low road is slower, but it is safe." },
  ],
  startTip: "Jump, open the cape, then jump again in the air: the super jump.",
  main: [
    // The school: a super jump from the floor reaches a high shore; missing
    // it only means running on, and a plain jump climbs back to the step.
    ["storm-floor", -700, 470, 2550],
    ["school-shore", gx(33) + SUPER - 60, 237, gx(40) + SUPER + 10 - (gx(33) + SUPER - 60)],
    ["storm-step", gx(47) + SUPER - 60, 407, gx(68) + SUPER + 10 - (gx(47) + SUPER - 60)],
    // Required: across a void to a shore 233 px up, 9/16 after the takeoff.
    // (Its lip reaches 160 px back: a super jump opened late in the arc, as
    // the glyph reads, flies shorter.)
    ["storm-high", gx(77) + 2 * SUPER - 160, 174, gx(81) + 2 * SUPER + 10 - (gx(77) + 2 * SUPER - 160)],
    ...shift(L4_B_PLAT, L4_DX_B, L4_DY_B, "plat"),
    ...shift(L4_C_PLAT, L4_DX_C, L4_DY_C, "plat"),
  ],
  high: [
    ...shift(pick(HIGH, ["well-floor", "well-exit"]), L4_DX_B, L4_DY_B, "plat"),
    ...shift(pick(HIGH, ["low-a", "low-b", "low-c"]), L4_DX_C, L4_DY_C, "plat"),
  ],
  updrafts: byId(UPDRAFTS, ["finale-wind"]).map((u) => ({ ...u, x: u.x + L4_DX_C, top: u.top + L4_DY_C, bottom: u.bottom + L4_DY_C })),
  cascades: CASCADES,
  chains: [
    ...byId(CHAINS, ["well-song"]).map((c) => ({ ...c, stars: shift(c.stars, L4_DX_B, L4_DY_B, "xy") })),
    ...byId(CHAINS, ["finale-song"]).map((c) => ({ ...c, stars: shift(c.stars, L4_DX_C, L4_DY_C, "xy") })),
  ],
  great: [
    // A super jump off the cascade's end lands on the last crack 11/16 later.
    { id: "great-1", x: 13340 + L4_DX_B, y: 227 + L4_DY_B, line: "above the last crack: a super jump off the wave's end" },
    { id: "great-2", x: 11087.2 + L4_DX_B, y: 592 + L4_DY_B, line: "the star well under the lid" },
    // The school shore is stable stone, so the cape is back for a second
    // super jump; its apex (267 px up, 7/16 after the takeoff) is here.
    { id: "great-3", x: gx(45) + 2 * SUPER, y: -76, line: "high above the school: a second super jump" },
  ],
  prompts: [
    { id: "p-super", glyph: ["up", "then", "right", "then", "up"], action: "super-jump", x: gx(22), y: 380, from: gx(23), to: gx(30), inputX: gx(25) },
    { id: "p-storm", glyph: ["up", "then", "right", "then", "up"], action: "super-jump", x: gx(66) + SUPER, y: 320, from: gx(67) + SUPER, to: gx(74) + SUPER, inputX: gx(68) + SUPER + 14 },
  ],
  stars: [
    // (The hearth's last loose stars lay beyond its trimmed end.)
    ...shift(starsIn(10100, 14500).filter(([id]) => !id.startsWith("breeze")), L4_DX_B, L4_DY_B, "star"),
    ...shift(starsIn(19300, 23000), L4_DX_C, L4_DY_C, "star"),
  ],
  routes: {
    main: [
      ...superAt(24, 0),
      [gx(40) + SUPER - 0.3, "jump", "g"],
      ...superAt(68, 1),
      [gx(81) + 2 * SUPER - 0.3, "jump", "g"],
      ...shift([[10666.7, "jump", "g"], [11348.7, "jump", "g"], ...CP.wave, ...CP.crown], L4_DX_B, 0, "plan"),
      [gx(206) + 2 * SUPER - 0.3, "jump", "g"],
      ...shift(CP.finale, L4_DX_C, 0, "plan"),
    ],
    upper: null,
    ability: null,
    safe: null,
  },
};
L4_BASE.routes.upper = [
  ...superAt(24, 0),
  // Great Star 3: the school shore is stable, so the cape is back: again.
  ...superAt(38, 1),
  ...superAt(68, 1),
  [gx(81) + 2 * SUPER - 0.3, "jump", "g"],
  ...shift([[10666.7, "jump", "g"], [10947.2, "dive", "g"], [11337.2, "jump", "g"], [11384, "jump", "a"], [11597.2, "jump", "g"], ...CP.wave.slice(1, 4), ...CP.wave.slice(4)], L4_DX_B, 0, "plan"),
  // Great Star 1: a super jump off the cascade's end.
  ...shift([[13010, "jump", "g"], [13010 + 75.7, "dash", "a"], [13010 + 151.4 + 63.67, "jump", "a"], [13545, "jump", "g"], [13695.7, "jump", "a"]], L4_DX_B, 0, "plan"),
  [gx(206) + 2 * SUPER - 0.3, "jump", "g"],
  ...shift(CP.finale, L4_DX_C, 0, "plan"),
];
L4_BASE.routes.ability = L4_BASE.routes.main;
L4_BASE.routes.safe = [...L4_BASE.routes.main.slice(0, -5), ...shift(CP.safeFinale, L4_DX_C, 0, "plan")];
/* L4 (1) The voids at 128, after the crown: Movement III's hearth void and
 * split voids (two voids around one cracked islet that never refills, so
 * the split-song's refill is required) translated so their first takeoff
 * is the hearth's (sixteenth 206, as the chapter's 390 sat in its bar),
 * then the hop onto a copy of the wind gate. 76 sixteenths, three flights;
 * the finale follows 159 px lower. */
const L4_DX_V = gx(206) + 2 * SUPER - 14981.5;
const L4_DY_V = -120;
const L4_X1 = 37.85 * (76 + 9);
const L4_S1 = insertSection(L4_BASE, {
  cut: 8200,
  dx: L4_X1,
  dy: 159,
  content: {
    main: [
      ...shift(pick(MAIN, ["wind-shore", "split-crack", "split-far"]), L4_DX_V, L4_DY_V, "plat"),
      ["storm-gate", 17450 + L4_DX_V, 478 + L4_DY_V, gx(282) + 2 * SUPER + 3 * 113.55 + 10 - (17450 + L4_DX_V)],
    ],
    chains: byId(CHAINS, ["split-song"]).map((c) => ({ ...c, stars: shift(c.stars, L4_DX_V, L4_DY_V, "xy") })),
    stars: shift(starsIn(15400, 16100), L4_DX_V, L4_DY_V, "star").map(([id, x, y, r]) => [`v-${id}`, x, y, r]),
    checkpoints: [{ ...CHECKPOINTS.find((q) => q.id === "voids"), x: 15470 + L4_DX_V, y: 377 + L4_DY_V }],
    sections: [{ x: 15000 + L4_DX_V, movement: "L4", step: "develop", name: "IV · The Far Door — the voids" }],
    // (The hearth's own takeoff step stays; the flight follows it.)
    routes: { main: [...shift([...CP.hearthVoid.slice(1), ...CP.splitVoids], L4_DX_V, 0, "plan"), [gx(282) + 2 * SUPER + 3 * 113.55 - 0.3, "jump", "g"]] },
  },
});
/* L4 (2) The rising stair, before the door: two double jumps (second press
 * 4/16 after the first, landing 8/16 after it, 135 px up each), a
 * constellation along both, and the walk-off from the top step onto the
 * door island as from the finale's high shore. Three bars; the door sits
 * 140 px higher. Lattice: the door island's landing is sixteenth 340. */
const sx = (k) => 13784.2 + 37.85 * (k - 340);
const L4_X2 = 37.85 * 48;
const L4_S2 = insertSection(L4_S1, {
  cut: 13680,
  dx: L4_X2,
  dy: -140,
  content: {
    main: [
      ["stair-0", 13694.5, 468, sx(356) + 10 - 13694.5],
      ["stair-1", sx(364) - 60, 333, sx(368) + 10 - (sx(364) - 60)],
      // Its end is where the finale's high shore ended relative to the door
      // island: the walk-off lands 3.4/16 later, on the grid.
      ["stair-2", sx(376) - 60, 198, sx(384.63) - (sx(376) - 60)],
    ],
    chains: [{ id: "stair-song", route: "low", stars: [[358, 333], [360, 352], [362, 267], [370, 198], [372, 217], [374, 132]].map(([k, y]) => [sx(k) + 40, y]) }],
    checkpoints: [{ id: "stair", x: sx(344) - 1, y: 468, platform: "stair-0", story: "Up, and up. The blue was close enough to touch.", tip: "Jump, then jump again near the top, twice." }],
    sections: [{ x: 13690, movement: "L4", step: "conclude", name: "IV · The Far Door — the rising stair" }],
    routes: { main: [[sx(356) - 0.3, "jump", "g"], [sx(360) - 0.3, "jump", "a"], [sx(368) - 0.3, "jump", "g"], [sx(372) - 0.3, "jump", "a"]] },
  },
});
const L4 = L4_S2;

/**
 * The campaign (RESEARCH_PROGRESSION 4.1, 4.7): eight stages along the GDD's
 * journey, one new thing each, BPM rising. A stage is playable once its level
 * is built (`def`). LEVELS lists the built stages in order and then, until
 * III-VIII replace them, the revision-five levels II-IV as interim levels
 * (`interim: true`, stage null): they keep the campaign as long as before,
 * the root QA's cape/dive/wind/cascade/super-jump checks and their own
 * 'landing' cape rule, and they are renumbered after the built stages. Each
 * stage's `look` keys its backdrop (RESEARCH_PROGRESSION 4.4).
 */
export const CAMPAIGN = Object.freeze(
  [
    { stage: 1, key: "waking", title: "Waking", toward: "Home", bpm: 88, introduces: "double", look: "home", def: WAKING },
    { stage: 2, key: "gift", title: "The Gift", toward: "Pluto", bpm: 94, introduces: "cape", look: "pluto", def: GIFT },
    { stage: 3, key: "still-water", title: "Still Water", toward: "Neptune", bpm: 100, introduces: "glide", look: "neptune", def: STILL },
    { stage: 4, key: "way-down", title: "The Way Down", toward: "Uranus", bpm: 107, introduces: "dive", look: "uranus", def: WAY_DOWN },
    { stage: 5, key: "breaking", title: "The Breaking Constellation", toward: "Saturn", bpm: 112, introduces: "cracks", look: "saturn", def: null },
    { stage: 6, key: "borrowed-wind", title: "Borrowed Wind", toward: "Jupiter", bpm: 118, introduces: "wind", look: "jupiter", def: null },
    { stage: 7, key: "falling-road", title: "The Falling Road", toward: "Mars", bpm: 123, introduces: "cascade", look: "mars", def: null },
    { stage: 8, key: "far-door", title: "The Far Door", toward: "the Moon, then Earth", bpm: 128, introduces: "super", look: "moon-earth", def: null },
  ].map((q) => Object.freeze(q)),
);
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
/** The interim levels, in tempo order, with the look of the stage that will
 * take most of their content (VI, V and VIII). */
const INTERIM = [
  { ...L2, look: "jupiter", toward: "Jupiter" },
  { ...L3, look: "saturn", toward: "Saturn" },
  { ...L4, look: "moon-earth", toward: "the Moon, then Earth" },
];
function register(d, i, extra) {
  const numeral = ROMAN[i];
  return Object.freeze({
    ...d,
    ...extra,
    id: i + 1,
    numeral,
    movements: d.movements.map((m) => ({ ...m, numeral: m.numeral ? numeral : "" })),
    sections: d.sections.map((q) => ({ ...q, name: q.name.replace(/^[IVX]+ · /, `${numeral} · `) })),
  });
}
const BUILT = [];
for (const q of CAMPAIGN) {
  if (!q.def) break;
  BUILT.push({ ...q.def, stage: q.stage });
}
export const LEVELS = Object.freeze([...BUILT.map((d, i) => register(d, i, {})), ...INTERIM.map((d, i) => register(d, BUILT.length + i, { stage: null, interim: true }))]);
/** Level numbers by key (tests and tools name the interim levels this way,
 * so building a stage never renumbers them by hand). */
export const LEVEL_ID = Object.freeze(Object.fromEntries(LEVELS.map((d) => [d.key, d.id])));
/** Saved progress (game.js keeps it in guarded storage). Version 2 stores
 * the furthest open numeral (`unlocked`, a count along LEVELS) and the best
 * Great Stars by level key, so a later rebuild that inserts a level keeps
 * them. A version-1 save (revision five's four levels) maps its unlocked
 * count to the same numeral, and its Great Stars reset because I and II were
 * rebuilt (RESEARCH_PROGRESSION 4.7). Anything unreadable starts fresh. */
export const SAVE_VERSION = 2;
export function readSave(raw, levels = LEVELS) {
  const fresh = { unlocked: 1, great: {}, done: {} };
  if (!raw || typeof raw !== "object" || !Number.isInteger(raw.unlocked)) return fresh;
  const unlocked = Math.max(1, Math.min(levels.length, raw.unlocked));
  if (raw.v !== SAVE_VERSION) return { ...fresh, unlocked };
  const byKey = (o) => Object.fromEntries(levels.filter((d) => o?.[d.key] != null).map((d) => [d.id, o[d.key]]));
  return { unlocked, great: byKey(raw.great), done: byKey(raw.done) };
}
export function writeSave(progress, levels = LEVELS) {
  const byId = (o) => Object.fromEntries(levels.filter((d) => o?.[d.id] != null).map((d) => [d.key, o[d.id]]));
  return { v: SAVE_VERSION, unlocked: progress.unlocked, great: byId(progress.great), done: byId(progress.done) };
}
export function levelDef(n = 1) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (n ?? 1) - 1))];
}
export function createLevel(n = 1) {
  const d = typeof n === "object" ? n : levelDef(n);
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

