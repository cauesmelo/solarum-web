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

/* ---- L1 · Waking (96 BPM): floating, calm, basics only ----
 * Cells re-solved on L1's own float (scripts/arcs.mjs, 1/120 s): gravity
 * 1050 px/s² real, jump 510, double 460, half gravity while |vy| < 70 px/s
 * real and jump held, fall capped at 560 px/s real. In sim units (÷ clock,
 * ÷ clock²) that is 1304 / 568 / 513, hang below 78, max fall 624. Heights at
 * exactly k sixteenths after a takeoff on the grid (down > 0):
 *   hold   5: -104  6: -63  7: +5 (flat lands ON the grid)  8: +91  9: +179
 *   tap    3: 0  4: +52
 *   double, second press at 3: 9: -146 10: -72; at 4: 10: -146 11: -72;
 *   at 5: 10: -177 11: -129 12: -55
 * A takeoff is on the grid with the island's edge 10 px later (coyote keeps
 * ~29 px more); landings start 60 px before the grid landing point, so the
 * window to press is about 0.45 s real and the island is at least 260 px. */
const L1_CLOCK = 96 / 107;
const L1_HOLD = [0, -66.5, -106.7, -121.9, -121.1, -104.4, -62.7, 4.7, 91.2, 178.6];
const L1_D3 = [0, -66.5, -106.7, -121.9, -179.3, -212.6, -222.3, -218.1, -195.1, -146.4, -72.1];
const L1_D5 = [0, -66.5, -106.7, -121.9, -121.1, -104.4, -159.5, -193.3, -203.4, -199.4, -176.9];
/** Heights after the stepping stones (each solved from the one before). */
const L1Y = { end: 502, field: 502 - 144 + 91, crown: 502 - 144 - 146, door: 502 - 144 + 91 - 58 + 91 };
const isle = (id, landK, takeoffK, y, lead = 60) => [id, gx(landK) - lead, y, gx(takeoffK) + 10 - (gx(landK) - lead)];
const L1_MAIN = [
  ["home", -700, 540, gx(24) + 10 + 700],
  // develop: four hops on flat-ish cells, one every three beats (hold 7, 6, 7, 8).
  // The first gap is only 90 px, so a first input of any kind clears it (a
  // 0 ms tap lands 3/16 later) while walking off still falls short.
  ["drift-a", gx(24) + 100, 545, gx(36) + 10 - (gx(24) + 100)],
  isle("drift-b", 42, 48, 482),
  isle("drift-c", 55, 60, 487),
  isle("drift-d", 67, 84, 492),
  // twist: a 384 px leap needs a late second jump (4/16 after the first,
  // landing 12/16 after it, 16 px lower); then a 177 px double climb (second
  // press 5/16 after the first).
  isle("far-shore", 96, 104, 508),
  isle("climb-crown", 114, 124, 331, 90),
  // ...and a 177 px drop (9/16) back down to the run.
  isle("crown-down", 133, 164, 508),
  // develop II, stepping stones: tap islets 6/16 apart. A held jump flies
  // 7/16 and passes the next islet's end by 28 px, so only taps chain them;
  // the wide gap after them needs a hold. (Solved for a tap released at
  // once; the pilots press and release in the same tick.)
  isle("stone-a", 167, 170, 508, 50),
  isle("stone-b", 173, 176, 508, 50),
  isle("stone-wide", 183, 192, 513),
  isle("stone-c", 196, 199, 565, 50),
  isle("stone-d", 202, 205, 565, 50),
  isle("stone-end", 211, 252, L1Y.end),
  // conclude: a double-jump staircase (second press 3/16 after the first,
  // up 72 px each), then a drop to the calm field.
  isle("stair-1", 262, 268, L1Y.end - 72),
  isle("stair-2", 278, 284, L1Y.end - 144),
  isle("field", 292, 344, L1Y.field),
  // coda: two gentle hops and the far door on bar 27.
  isle("coda-a", 351, 364, L1Y.field + 5),
  isle("coda-b", 370, 380, L1Y.field - 58),
  ["door-isle", gx(388) - 60, L1Y.door, gx(416) + 520 - (gx(388) - 60)],
];
// Mastery: the high crown (Great Star 2) off the top stair and the float
// line (Great Star 3): three islets only held, hanging jumps chain (a tap
// flies 113 px, the gaps are 215). The field lies under all of it, at most
// 232 px down, so a missed float is a soft landing, never a fall.
const L1_HIGH = [
  isle("high-crown", 292, 298, L1Y.crown),
  isle("float-1", 305, 307, L1Y.crown + 5, 40),
  isle("float-2", 314, 316, L1Y.crown + 10, 40),
  isle("float-3", 323, 325, L1Y.crown + 15, 40),
];
// On the hang apex 4/16 after each takeoff (an even sixteenth, so the
// completed song blooms on an eighth).
const apexStar = (k, y0) => [gx(k + 4) + 40, Math.round(y0 - 121 - 36)];
const L1_CHAINS = [
  { id: "first-song", route: "low", stars: [apexStar(24, 540), apexStar(36, 545), apexStar(48, 482), apexStar(60, 487)] },
  { id: "climb-song", route: "low", stars: [7, 8, 9, 10].map((j) => [gx(104 + j) + 40, Math.round(508 + L1_D5[j] - 36)]) },
  { id: "home-song", route: "low", stars: [2, 4, 6, 8].map((j) => [gx(380 + j) + 40, Math.round(L1Y.field - 58 + L1_HOLD[j] - 36)]) },
];
const L1_GREAT = [
  // Over the climb, where only an early second press (3/16, apex 222 px)
  // reaches: the main route's later press peaks 203 px up, 94 px too low.
  { id: "great-1", x: gx(110), y: 508 - 290, line: "above the climb: press the second jump early" },
  { id: "great-2", x: gx(295), y: L1Y.crown - 42, line: "the high crown above the staircase" },
  { id: "great-3", x: gx(324), y: L1Y.crown + 15 - 42, line: "the end of the float line" },
];
function l1Stars() {
  const out = [];
  [505, 533, 561].forEach((x, i) => out.push([`tap-${i}`, x, i === 1 ? 437 : 442, "low"]));
  // Hold stars sit at the hang apex: only a held jump (95+ px) takes them.
  [860, 900, 940].forEach((x, i) => out.push([`hold-${i}`, x, i === 1 ? 356 : 362, "low"]));
  // Loose stars sketch the stepping stones' taps and the field's run.
  // A tap's top (26 px up) is 1-2/16 after the press.
  [[164, 508], [170, 508], [192, 513], [199, 565]].forEach(([k, y], i) => out.push([`stone-star-${i}`, gx(k + 1) + 34, y - 26 - 36, "low"]));
  [300, 306, 312, 318].forEach((k, i) => out.push([`field-star-${i}`, gx(k) + 34, L1Y.field - 40, "low"]));
  [298, 307, 316].forEach((k, i) => out.push([`float-star-${i}`, gx(k + 4) + 34, L1Y.crown + 5 * i - 121 - 36, "high"]));
  return out;
}
const J = (k, when = "g") => [gx(k) - 0.3, "jump", when];
// A tap: pressed and released in the same tick (tests/routes.mjs "tap").
const TAP = (k) => [[gx(k) - 0.3, "tap", "g"]];
const L1_PLAN_MAIN = [
  J(24), J(36), J(48), J(60),
  J(84), J(88, "a"),
  J(104), J(109, "a"),
  J(124),
  ...TAP(164), ...TAP(170), J(176), ...TAP(192), ...TAP(199), J(205),
  J(252), J(255, "a"), J(268), J(271, "a"),
  J(284),
  J(344), J(364), J(380),
];
const L1 = {
  id: 1,
  key: "waking",
  numeral: "I",
  title: "Waking",
  bpm: 96,
  clock: L1_CLOCK,
  // Sim units (real ÷ clock, ÷ clock²). constellationGap is longer because
  // L1's songs are one star per hop apex, three beats apart.
  physics: {
    gravity: 1050 / L1_CLOCK ** 2,
    jump: 510 / L1_CLOCK,
    doubleJump: 460 / L1_CLOCK,
    apexHang: { below: 70 / L1_CLOCK, factor: 0.5 },
    maxFall: 560 / L1_CLOCK,
    constellationGap: 1.9,
  },
  verbs: { cape: false, dive: false, glide: false },
  view: null,
  level: { title: "Waking", speed: 270, startX: 220, startY: 540, finishX: gx(416), finishY: L1Y.door, beat: BEAT },
  movements: [{ id: "L1", x: -1000, numeral: "I", name: "Waking" }],
  sections: [
    { x: -1000, movement: "L1", step: "introduce", name: "I · Waking" },
    { x: gx(24), movement: "L1", step: "develop", name: "I · Waking — four hops" },
    { x: gx(80), movement: "L1", step: "twist", name: "I · Waking — the leap and the climb" },
    { x: gx(160), movement: "L1", step: "develop", name: "I · Waking — stepping stones" },
    { x: gx(240), movement: "L1", step: "conclude", name: "I · Waking — the staircase" },
    { x: gx(336), movement: "L1", step: "coda", name: "I · Waking — the field" },
  ],
  // Beacons on half bars 5½, 10½, 16 and 21½ (≤ 13.7 s real apart).
  checkpoints: [
    { id: "drift", x: gx(72) - 3, y: 492, platform: "drift-d", story: "Somewhere ahead, something was calling. She was light enough to follow.", tip: "Hold the jump to float longer at the top." },
    { id: "climb", x: gx(152) - 3, y: 508, platform: "crown-down", story: "The dark had steps in it, if she jumped twice.", tip: "Jump, then jump again near the top to reach farther or higher." },
    { id: "stones", x: gx(240) - 3, y: L1Y.end, platform: "stone-end", story: "Small stones, close together: she only had to touch them.", tip: "Tap the jump for the small stones; hold it for the wide gap." },
    { id: "crown", x: gx(328) - 3, y: L1Y.field, platform: "field", story: "A quiet field. The signal was singing now.", tip: "Run to the door at the end of the field." },
  ],
  startTip: "Jump when you reach the edge. Hold the jump to float.",
  main: L1_MAIN,
  high: L1_HIGH,
  updrafts: [],
  cascades: [],
  chains: L1_CHAINS,
  great: L1_GREAT,
  prompts: [
    // [from, inputX] is the window in which following the glyph works: from
    // the earliest press that still lands to the last one coyote allows.
    { id: "p-jump", glyph: ["up"], action: "jump", x: gx(24) - 30, y: 430, from: gx(24) - 20, to: gx(24) + 40, inputX: gx(24) + 20 },
    { id: "p-double", glyph: ["up", "up"], action: "double-jump", x: gx(86), y: 330, from: gx(84) - 30, to: gx(92), inputX: gx(84) + 14 },
    { id: "p-climb", glyph: ["up", "up"], action: "double-jump", x: gx(106), y: 340, from: gx(104) - 30, to: gx(110), inputX: gx(104) + 14 },
    { id: "p-tap", glyph: ["tap-up"], action: "jump", x: gx(162), y: 420, from: gx(163.5), to: gx(166), inputX: gx(164) + 20 },
  ],
  stars: l1Stars(),
  routes: {
    main: L1_PLAN_MAIN,
    // The three Great Stars: an early second press on the climb, then the
    // high crown and the float line off the top stair.
    upper: [
      ...L1_PLAN_MAIN.filter(([x]) => x < gx(100)),
      J(104), J(107, "a"),
      ...L1_PLAN_MAIN.filter(([x]) => x > gx(110) && x < gx(280)),
      J(282), J(286, "a"), J(298), J(307), J(316), J(325),
      ...L1_PLAN_MAIN.filter(([x]) => x > gx(330)),
    ],
    // The opening lesson: tap for the low star row, hold for the high one.
    ability: [[482, "tap", "g"], [748, "jump", "g"], ...L1_PLAN_MAIN],
    safe: L1_PLAN_MAIN,
  },
};

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
  cache: [[18600, "dive", "g"], [18850, "jump", "g"], [18930, "jump", "a"], [19106.5, "jump", "g"]],
};
const L2 = {
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
const L3 = {
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
    { ...CHECKPOINTS.find((q) => q.id === "well"), tip: "Press down on the cracked lid to break into the well." },
    ...byId(CHECKPOINTS, ["hearth", "voids"]),
  ],
  startTip: "Cracked stone gives way soon after you land. Jump off it quickly.",
  main: [
    ...pick(MAIN, ["gate-2", "first-crack"]),
    ["crack-floor", 7150, 569, 650],
    ...pick(MAIN, ["second-crack", "beat-isle", "ridge-a", "ridge-stone", "ridge-b", "ridge-c", "b3-isle", "well-rim-a", "lid"]),
    // 95 px under the lid, so a dive on the grid lands 1/16 later on the
    // grid, and long enough for a double jump (second press 4/16 later) up
    // 76 px onto the second tile, 9/16 after the takeoff.
    ["well-floor", 10847.2, 527, gx(296) + 10 - 10847.2],
    // (No first tile: the well's line comes up under it, onto the second.)
    ...pick(MAIN, ["tile-1", "tile-2", "tile-3", "tile-4", "tile-5", "cascade-end", "last-crack", "hearth", "wind-shore", "split-crack", "split-far"]),
    ["door-rock", 17450, 478, 1000],
  ],
  high: [
    ...pick(HIGH, ["chain-a", "chain-b", "chain-c", "chain-exit"]),
    // A cracked stair off the crown: two 4/16 hops up 80 px each.
    ["crown-stair-1", gx(370) - 40, 239, gx(372) + 10 - (gx(370) - 40), "crumble"],
    ["crown-stair-2", gx(376) - 40, 159, gx(378) + 10 - (gx(376) - 40), "crumble"],
  ],
  updrafts: [],
  // Five tiles; the first drops when Movement II's second did (one beat of
  // run, 151.4 px, after the first tile's 551 px lead, minus the 207 px pitch).
  cascades: [{ ...CASCADES[0], tiles: CASCADES[0].tiles.slice(1), lead: 551 + 151.4 - 207 }],
  chains: [
    // On the main line out of the well: one on the run, then every 2/16 up.
    { id: "well-song", route: "low", stars: [[gx(294) + 40, 487], [gx(298) + 40, 392], [gx(300) + 40, 411], [gx(302) + 40, 326], [gx(304) + 40, 356]] },
    ...byId(CHAINS, ["flight-line", "split-song"]),
  ],
  great: [
    { id: "great-1", x: 9330, y: 150, line: "the cracked chain above the ridge" },
    // An early second press (3/16) out of the well peaks 190 px up; the main
    // route's (4/16) peaks 165 px up, 70 px under this star.
    { id: "great-2", x: gx(301.5), y: 527 - 190 - 66, line: "out of the well: press the second jump early" },
    { id: "great-3", x: gx(380), y: 25, line: "the top of the cracked stair above the crown" },
  ],
  prompts: [
    ...byId(PROMPTS, ["p-crack"]),
    { id: "p-lid", glyph: ["down"], action: "dive", x: 11027.2, y: 380, from: 10937.2, to: 11120, inputX: 11000 },
    ...byId(PROMPTS, ["p-cape"]),
  ],
  stars: starsIn(6260, 17400).filter(([id]) => !id.startsWith("breeze")),
  routes: {
    main: [
      ...CP.breaking, ...CP.ridge,
      [10666.7, "jump", "g"], [gx(285) - 0.3, "dive", "g"], [gx(296) - 0.3, "jump", "g"], [gx(300) - 0.3, "jump", "a"],
      ...CP.wave.slice(1), ...CP.crown, ...CP.hearthVoid, ...CP.splitVoids,
    ],
    upper: [
      ...CP.breaking,
      [8536.6, "jump", "g"], [8608.6, "jump", "a"], [8908.6, "jump", "g"], [9238.6, "jump", "g"], [9568.6, "jump", "g"], [9935, "jump", "g"],
      [10666.7, "jump", "g"], [gx(285) - 0.3, "dive", "g"], [gx(296) - 0.3, "jump", "g"], [gx(299) - 0.3, "jump", "a"],
      ...CP.wave.slice(1), ...CP.crown,
      [gx(366) - 0.3, "jump", "g"], [gx(372) - 0.3, "jump", "g"], [gx(378) - 0.3, "jump", "g"],
      ...CP.hearthVoid, ...CP.splitVoids,
    ],
    ability: null,
    safe: null,
  },
};
L3.routes.ability = L3.routes.main;
L3.routes.safe = L3.routes.main;

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
// The finale: the hearth's takeoff at L4 sixteenth 202 is the chapter's 490
// (a whole number of bars), so the door lands on bar 18's downbeat.
const L4_DX_C = gx(202) + 2 * SUPER - (gx(490) + 3 * 113.55);
const L4_DY_C = -161;
// Jump on the grid, open the cape 2/16 later and jump again 2/16 into the
// flight (where the flight has added one SUPER of extra run).
const superAt = (k, shifts) => [[gx(k) + shifts * SUPER - 0.3, "jump", "g"], [gx(k + 2) + shifts * SUPER - 0.3, "dash", "a"], [gx(k + 4) + (shifts + 1) * SUPER - 0.3, "jump", "a"]];
const inX = (from, to) => (q) => q[1] >= from && q[1] < to;
// The hearth ends 10 px after the finale bridge's takeoff (sixteenth 202).
const L4_B_PLAT = MAIN.filter(inX(10100, 15100)).map((q) => (q[0] === "hearth" ? [q[0], q[1], q[2], gx(202) + 2 * SUPER + 10 - (q[1] + L4_DX_B)] : q));
const L4_C_PLAT = MAIN.filter(inX(19300, 23000));
const L4 = {
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
    { id: "finale", x: gx(208) + 2 * SUPER - 1, y: 412 + L4_DY_C, platform: "finale-gate", story: "Somewhere ahead, a little blue world is listening.", tip: "The low road is slower, but it is safe." },
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
      [gx(202) + 2 * SUPER - 0.3, "jump", "g"],
      ...shift(CP.finale, L4_DX_C, 0, "plan"),
    ],
    upper: null,
    ability: null,
    safe: null,
  },
};
L4.routes.upper = [
  ...superAt(24, 0),
  // Great Star 3: the school shore is stable, so the cape is back: again.
  ...superAt(38, 1),
  ...superAt(68, 1),
  [gx(81) + 2 * SUPER - 0.3, "jump", "g"],
  ...shift([[10666.7, "jump", "g"], [10947.2, "dive", "g"], [11337.2, "jump", "g"], [11390, "jump", "a"], [11597.2, "jump", "g"], ...CP.wave.slice(1, 4), ...CP.wave.slice(4)], L4_DX_B, 0, "plan"),
  // Great Star 1: a super jump off the cascade's end.
  ...shift([[13010, "jump", "g"], [13010 + 75.7, "dash", "a"], [13010 + 151.4 + 63.67, "jump", "a"], [13545, "jump", "g"], [13695.7, "jump", "a"]], L4_DX_B, 0, "plan"),
  [gx(202) + 2 * SUPER - 0.3, "jump", "g"],
  ...shift(CP.finale, L4_DX_C, 0, "plan"),
];
L4.routes.ability = L4.routes.main;
L4.routes.safe = [...L4.routes.main.slice(0, -5), ...shift(CP.safeFinale, L4_DX_C, 0, "plan")];

export const LEVELS = Object.freeze([L1, L2, L3, L4].map((d) => Object.freeze(d)));
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

