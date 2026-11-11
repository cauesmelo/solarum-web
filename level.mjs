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
 * The chapter above is the source material: until V and VI replaced them,
 * L2 and L3 kept Movement III's and Movement II's geometry at their original
 * coordinates; L4 (the interim Far Door) remixes translated copies of both
 * (the x lattice and every solved cell hold), and L1 re-solves Movement I's
 * ideas on its own floaty cells. */
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
  // after the takeoff, 65 px lower, 320 px across. The shore reaches back
  // so that a quick second press, 200 ms after the first (1.2/16, the
  // critic's double-tap, landing 8.3/16 on), lands too; a jump alone still
  // comes down 50 px short (6.7/16).
  wIsle("far-shore", 164, 168, WY.shore, 134),
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
    { id: "p-jump", glyph: ["up"], action: "jump", x: gx(24) - 30, y: WY.home - 150, from: gx(24) - 20, to: gx(24) + 40, inputX: gx(24) + 20 },
    { id: "p-tap", glyph: ["tap-up"], action: "jump", x: gx(88) + 120, y: WY.floor - 135, from: gx(89), to: gx(90) + 30, inputX: gx(90) + 10 },
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
 * RESEARCH_PROGRESSION 4.5 and 3, re-solved for the owner (2026-11-10:
 * "the cape is just handed over in level II with no merit ... it should come
 * at least around the middle of the map"). II now earns its gift:
 *   - first half (bars 1-10): Pluto's frost with only the jump and the double
 *     jump, a little harder than I (two doubles up, a long double leap, a
 *     land-and-go double, a climb that wants the second press early, two
 *     doubles down into the asteroid's crater);
 *   - the middle (bar 11): the asteroid's gift on the crater floor (the
 *     relic, the eye, the banner) gives the cape with a FULL bar (`full`);
 *   - second half: out of the crater, the safe first flight over a floor,
 *     the hearth void (the need; a habitual "double, then cape" from I also
 *     lands), the breath lesson (the bar is spent and the shore is short, so
 *     a required leaf star at the double's top carries her up and across),
 *     the long void (two flights around the void-song: the twist) and
 *     Pluto's steps (the finish), then the heart plain and the door.
 * 25 bars, the door on the downbeat of bar 26 (63.8 s real).
 *
 * Physics: II-VIII share the chapter's simulation physics (gravity 1500,
 * jump 570, double 525, no hang, no fall cap), so every cell is the one in
 * px and sixteenths that LEVEL_DESIGN lists; only the clock (94 / 107) and
 * so the real windows change. Cells used here (scripts/arcs.mjs 2; dy at
 * k/16 after a grid takeoff, up < 0):
 *   hold 4: -80  5: -26 (26 up)  6: +57  7: +170
 *   double, second press at d/16, onto level stone: d 1.25 lands 7.1/16
 *   (269 px), d 2 8.0, d 3 9.1, d 4 9.9 (373 px), d 5 10.25; up 70 at d 4:
 *   9.07; up 94 at d 3: 8.08 (d 1-5 climb it); down 67 at d 5: 11.0
 *   flight at 3/16 (the apex): level at -105 for 0.5 s, then 9: -17 (17 up),
 *   10: +70 (70 lower); two flights at 3 and 9 around a refill: 14: +15;
 *   jump, double at 4, cape at 7 (I's habit): 14.5: +70
 *   jump, double at 4, a leaf star at 7 (the apex, -167), jump at 9:
 *   15.0: +14 (568 px; the double alone lands +14 at most 10.4/16, 394 px)
 * A full flight adds exactly 113.55 px (three sixteenths) to the run, so a
 * grid x after F flights is 220 + 37.85 k + 113.55 F (gk below).
 * Every required flight has a charge source (RESEARCH_PROGRESSION 3.4): the
 * relic itself (full) for the optional first flight, the gift beacon for the
 * hearth void, the long stone's breath and beacon for the long void's first
 * flight and Pluto's first step, the void-song and the steps-song (both
 * completed before the press) for the second flights, and the Pluto beacon
 * for the last. */
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
/** The sixteenth of the gift (the relic on the crater floor, bar 11). */
const G_GET = 168;
const GY = {
  plain: 440, frost1: 414, frost2: 388, ledge1: 318, ledge2: 248, shore: 248, stoneA: 260, lip: 166, inner: 233,
  crater: 300, step: 274, rim: 248, gift: 231, floor: 308, shore1: 301, long: 315, voidShore: 387, rock1: 457, rock2: 527, plain2: 510, door: 484,
};
const G_MAIN = [
  // Pluto's frost plain, the title card over it.
  ["frost-plain", -700, GY.plain, gk(24) + 10 + 700],
  // Two held hops up 26 px (5/16 each).
  gIsle("frost-1", 29, 0, 32, GY.frost1, 75),
  gIsle("frost-2", 37, 0, 40, GY.frost2, 75),
  // Two doubles up 70 px (second press at 4/16, landing 9.07/16 after the
  // takeoff); a jump alone falls short into the gap under them.
  gIsle("ledge-1", 49, 0, 52, GY.ledge1, 90),
  gIsle("ledge-2", 61, 0, 64, GY.ledge2, 90),
  // The frost leap: level and long. Its near edge is 250 px past the
  // takeoff, so a jump alone (202 px) falls short and every second press
  // from 1.25/16 (200 ms real, I's quick double-tap) to 6/16 lands.
  ["frost-shore", gk(64) + 250, GY.shore, gk(92) + 10 - (gk(64) + 250)],
  // Land and go: a double down 12 px onto a short stone, then at once the
  // climb up 94 px onto the crater's lip (second press at 3/16, landing on
  // 8.08/16; anything from 1/16 to 5/16 climbs it, a jump alone cannot).
  gIsle("stone-a", 102, 0, 104, GY.stoneA, 90),
  gIsle("crater-lip", 112, 0, 120, GY.lip, 90),
  // Down into the crater: two late doubles (second press at 5/16), 67 px
  // down each, landing on 11/16; a jump alone falls short of each.
  gIsle("inner-1", 131, 0, 136, GY.inner, 90),
  // The crater floor and the asteroid's gift (sixteenth 168). From 1.25/16
  // (200 ms) a second press reaches it.
  ["crater", gk(136) + 300, GY.crater, gk(187) + 10 - (gk(136) + 300)],
  // Out of the crater: two hops up 26 px (5/16 each).
  gIsle("crater-step", 192, 0, 195, GY.step, 75),
  gIsle("rim", 200, 0, 204, GY.rim, 75),
  // The safe first use: a flight at the apex lands 17 px up 9/16 later; a
  // double also makes it (it steps up); a plain jump comes down on the floor
  // 60 px below and hops back up 77 px (4/16).
  gIsle("gift-stone", 213, 1, 232, GY.gift, 100),
  // The hearth void (382 px): a flight at the apex lands 70 px lower 10/16
  // after the takeoff, along flight-line. The shore runs 2/16 past I's habit
  // (jump, double, then the cape: 14.5/16), so that lands too, and it is
  // short: the bar breathes only 6/16 of a bar on it.
  gIsle("hearth-shore", 242, 2, 248, GY.shore1, 100),
  // The breath lesson: a double alone lands at most 394 px on; the long
  // stone starts 435 px past the takeoff, so the leaf star at the double's
  // top is the way across (545 px). There the bar fills, tick by tick.
  ["long-stone", gk(259.5, 2), GY.long, gk(292, 2) + 10 - gk(259.5, 2)],
  // The long void: jump, flight, the void-song refills the cape, flight;
  // 72 px lower 15/16 after the takeoff. The shore sits that low so a
  // second flight up to 1.2/16 (190 ms) late still flies over its top (a
  // flight holds the height it starts at; 24 px of step-up).
  gIsle("void-shore", 307, 4, 324, GY.voidShore, 110),
  // Pluto's steps: two flights, each 70 px lower; the short rock between
  // them gives no breath, a cape star on the jump's rise does.
  // (It runs 3.5/16 past the takeoff, so I's habit, jump, double, then the
  // cape, landing 14.5/16 after the void shore's edge, lands too; the run
  // from the landing to the jump is still 2/16.)
  ["step-rock", gk(334, 5) - 90, GY.rock1, gk(339.5, 5) + 16 - (gk(334, 5) - 90)],
  gIsle("pluto-rock", 346, 6, 364, GY.rock2, 100),
  // Pluto's heart plain: a flight at the apex lands 17 px up 9/16 later,
  // then one held hop up 26 px onto the door stone (bar 26). Its near edge
  // is only 10 px before that landing: II's narrowest window (the ladder's
  // 320-420 ms) is this last flight, right after the Pluto beacon.
  gIsle("heart-plain", 373, 7, 384, GY.plain2, 10),
  ["heart-door", gk(389, 7) - 75, GY.door, gk(400, 7) + 520 - (gk(389, 7) - 75)],
];
// The safe line: the floor under the first flight's gap (a plain jump lands
// on it 60 px down and hops 77 px back up onto the gift stone, 4/16).
const G_HIGH = [["crater-floor", gk(206), GY.floor, gk(214, 0) + 10 - gk(206)]];
/** A song star on the rise of a held jump from a takeoff at k on ground y0
 * (every hold is at -99 px 2/16 after the takeoff). */
const gRise = (k, y0, F = 0) => [gk(k + 2, F) + 39.5, Math.round(y0 - 99 - 36)];
/** A song star at a double's top (second press at 4/16): -165 px at 6/16. */
const gTop = (k, y0, F = 0) => [gk(k + 6, F) + 39.5, Math.round(y0 - 165 - 36)];
const G_CHAINS = [
  // The frost: one note per hop, then the double's top.
  { id: "frost-song", route: "low", stars: [gRise(24, GY.plain), gRise(32, GY.frost1), gRise(40, GY.frost2), gTop(40, GY.frost2)] },
  // The two doubles up and the leap: each double's top.
  { id: "frost-ledges", route: "low", stars: [gRise(52, GY.ledge1), gTop(52, GY.ledge1), gRise(64, GY.ledge2), gTop(64, GY.ledge2)] },
  { id: "first-flight", route: "low", stars: flightStars(207, 0, GY.rim) },
  { id: "flight-line", route: "low", stars: flightStars(235, 1, GY.gift) },
  // On the long void's first flight, one per sixteenth from the press: it
  // completes on 298 (an eighth), so the second flight (301) has its cape.
  { id: "void-song", route: "low", stars: flightStars(295, 2, GY.long, 4, false) },
  { id: "pluto-song", route: "low", stars: flightStars(367, 6, GY.rock2) },
];
const G_GREAT = [
  { id: "great-1", x: gk(212, 1) + 20, y: GY.rim - 165 - 46, line: "over the first flight: jump, jump again, then the cape" },
  { id: "great-2", x: gk(292, 2) + 486, y: GY.long - 249, line: "above the long void: a double jump between the flights" },
  { id: "great-3", x: gk(372, 7) + 10, y: GY.rock2 - 165 - 46, line: "over Pluto's last step: jump, jump again, then the cape" },
];
const GJ = (k, F, when = "g") => [gk(k, F) - 0.3, "jump", when];
const GD = (k, F) => [gk(k, F) - 0.3, "dash", "a"];
const G_PLAN_FROST = [
  GJ(24, 0), GJ(32, 0),
  GJ(40, 0), GJ(44, 0, "a"), GJ(52, 0), GJ(56, 0, "a"),
  GJ(64, 0), GJ(68, 0, "a"),
  GJ(92, 0), GJ(96, 0, "a"), GJ(104, 0), GJ(107, 0, "a"),
  GJ(120, 0), GJ(125, 0, "a"), GJ(136, 0), GJ(141, 0, "a"),
];
const G_PLAN_MAIN = [
  ...G_PLAN_FROST,
  GJ(187, 0), GJ(195, 0),
  GJ(204, 0), GD(207, 0),
  GJ(232, 1), GD(235, 1),
  // The leaf: jump, double, the leaf star at the top, jump again.
  GJ(248, 2), GJ(252, 2, "a"), GJ(257, 2, "a"),
  GJ(292, 2), GD(295, 2), GD(301, 3),
  GJ(324, 4), GD(327, 4),
  GJ(336, 5), GD(339, 5),
  GJ(364, 6), GD(367, 6),
  GJ(384, 7),
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
  // The relic fills the bar (RESEARCH_REFILLS 2.2): the first flight is the
  // gift's own, so the safe first use needs no wait.
  gets: [{ id: "asteroid-gift", verb: "cape", x: gk(G_GET), full: true }],
  capeRule: "breath",
  view: null,
  level: { title: "The Gift", speed: 270, startX: 220, startY: GY.plain, finishX: gk(400, 7), finishY: GY.door, beat: BEAT },
  movements: [{ id: "II", x: -1000, numeral: "II", name: "The Gift" }],
  sections: [
    { x: -1000, movement: "II", step: "introduce", name: "II · The Gift" },
    { x: gk(36), movement: "II", step: "develop", name: "II · The Gift — Pluto's frost" },
    { x: gk(60), movement: "II", step: "develop", name: "II · The Gift — the frost leap" },
    { x: gk(100), movement: "II", step: "develop", name: "II · The Gift — down to the crater" },
    { x: gk(148), movement: "II", step: "get", name: "II · The Gift — the asteroid's gift" },
    { x: gk(200), movement: "II", step: "safe", name: "II · The Gift — the first flight" },
    { x: gk(224, 1), movement: "II", step: "need", name: "II · The Gift — the hearth void" },
    { x: gk(244, 2), movement: "II", step: "develop", name: "II · The Gift — the breath" },
    { x: gk(284, 2), movement: "II", step: "twist", name: "II · The Gift — the long void" },
    { x: gk(318, 4), movement: "II", step: "conclude", name: "II · The Gift — Pluto's steps" },
    { x: gk(376, 7), movement: "II", step: "coda", name: "II · The Gift — the heart plain" },
  ],
  // Beacons on half bars 6, 10½, 14½, 18½, 20½ and 23 (≤ 12.8 s real apart),
  // each with 12/16 of running before the next required press.
  checkpoints: [
    { id: "frost", x: gk(80) - 3, y: GY.shore, platform: "frost-shore", story: "Pluto's frost rang under her feet, and far ahead a crater smoked.", tip: "Jump, then jump again near the top to reach the far ice." },
    { id: "crater", x: gk(152) - 3, y: GY.crater, platform: "crater", story: "At the bottom of the crater the asteroid lay half buried, and it opened one eye.", tip: "Run through the gift." },
    { id: "gift", x: gk(216, 1) - 3, y: GY.gift, platform: "gift-stone", story: "Gather the falling stars, and it will carry you there.", tip: "Jump, then press the cape near the top of the jump." },
    { id: "long", x: gk(280, 2) - 3, y: GY.long, platform: "long-stone", story: "The gift breathes when she runs. A long stone is a full breath.", tip: "Take every star of the song on the first flight; it gives the cape back." },
    { id: "steps", x: gk(312, 4) - 3, y: GY.voidShore, platform: "void-shore", story: "Below her the little world turned, cold and patient.", tip: "Short stones give no breath. The bright star over the rock does." },
    { id: "pluto", x: gk(352, 6) - 3, y: GY.rock2, platform: "pluto-rock", story: "On Pluto's heart the frost held still, as if it were listening.", tip: "Jump, then press the cape near the top, down to the plain." },
  ],
  startTip: "Jump at the edge, and jump again in the air.",
  main: G_MAIN,
  high: G_HIGH,
  updrafts: [],
  cascades: [],
  chains: G_CHAINS,
  great: G_GREAT,
  // The leaf need (RESEARCH_REFILLS 3, II): at the top of the double over
  // the breath gap, with the bar spent by the hearth void's flight. Pluto's
  // second step: a cape star on the rise of the jump off the short rock
  // (its ±44 × ±50 box takes a jump up to 1/16 early or late; it replaced a
  // four-star song that an early jump broke: the human proxies' worst spot).
  refills: [
    // (Each sits 44 px past a sixteenth, so its note is touched on the grid.)
    { id: "leaf-breath", kind: "leaf", x: gk(254, 2) + 44, y: GY.shore1 - 167 - 36, required: true },
    { id: "cape-steps", kind: "cape", x: gk(337, 5) + 44, y: GY.rock1 - 75 - 36, required: true },
  ],
  moments: [],
  // Decor: the glide lock (RESEARCH_PROGRESSION 2.1): a gently descending
  // star line below the door stone that a flight cannot follow (III's glide
  // will); drawn, never collected.
  decor: [{ id: "glide-lock", kind: "cluster", stars: [0, 1, 2, 3, 4].map((i) => [gk(392, 7) + 60 * i, GY.door + 60 + 22 * i]) }],
  prompts: [
    // ↑ ↑: [from, inputX] is the first jump's window; `to` ends the second's.
    { id: "p-double", glyph: ["up", "up"], action: "double-jump", x: gk(40) + 10, y: GY.frost2 - 250, from: gk(40) - 30, to: gk(46), inputX: gk(40) + 14 },
    // ↑ · →: [from, inputX] is the jump's window; `to` ends the cape's.
    { id: "p-first-flight", glyph: ["up", "then", "right"], action: "dash", x: gk(204) + 20, y: GY.rim - 170, from: gk(204) - 30, to: gk(207) + 60, inputX: gk(204) + 14, optional: true, route: "main" },
    // (The need's sign stands over the gift stone, 762+ px before the leaf's,
    // so only one row shows at once (T4); the leaf's sits as far right as
    // the 720 px portrait sky allows its 1.5 s lead (T3).)
    { id: "p-cape", glyph: ["up", "then", "right"], action: "dash", x: gk(227, 1), y: GY.gift - 170, from: gk(232, 1) - 30, to: gk(235, 1) + 60, inputX: gk(232, 1) + 14 },
    { id: "p-leaf", glyph: ["up", "up", "up"], action: "double-jump", x: gk(247, 2) - 30, y: GY.shore1 - 280, from: gk(248, 2) - 30, to: gk(257, 2), inputX: gk(248, 2) + 14 },
    { id: "p-refill", glyph: ["right"], action: "dash", x: gk(300, 3) + 48, y: GY.long - 175, from: gk(299, 3), to: gk(303, 3), inputX: gk(301, 3) + 10 },
  ],
  stars: [
    // The crater's two hops and the plain's: a star on each rise.
    ...[187, 195].map((k, i) => [`rim-star-${i}`, gk(k + 1) + 33.5, GY.crater - 26 * i - 64 - 36, "low"]),
    [`plain-star-0`, gk(385, 7) + 33.5, GY.plain2 - 64 - 36, "low"],
    // The short rock: one at running height (+1/8; the cape star fills).
    [`step-star-0`, gk(335, 5) + 33.5, GY.rock1 - 40, "low"],
    // Running stars on the long stones (the frost shore, the crater floor,
    // the gift stone after its beacon, the void shore, Pluto's rock).
    ...[[82, 0, GY.shore], [85, 0, GY.shore], [88, 0, GY.shore], [154, 0, GY.crater], [158, 0, GY.crater], [162, 0, GY.crater], [219, 1, GY.gift], [223, 1, GY.gift], [227, 1, GY.gift], [314, 4, GY.voidShore], [317, 4, GY.voidShore], [320, 4, GY.voidShore], [354, 6, GY.rock2], [357, 6, GY.rock2], [360, 6, GY.rock2]].map(([k, F, y], i) => [`run-star-${i}`, gk(k, F) + 33.5, y - 40, "low"]),
    // The land-and-go and the climb: one on each rise.
    [`frost-star-0`, gk(94) + 33.5, GY.shore - 99 - 36, "low"],
    [`frost-star-1`, gk(109) + 33.5, GY.stoneA - 190 - 36, "low"],
    // The doubles down into the crater: each second press's rise.
    ...[[125, GY.lip], [141, GY.inner]].map(([k, y], i) => [`crater-star-${i}`, gk(k + 2) + 33.5, y - 80 - 36, "low"]),
    // The breath gap: the jump's rise and the double's (the bar only fills
    // 1/8 a star; the leaf star itself is no star).
    [`breath-star-0`, gk(250, 2) + 33.5, GY.shore1 - 99 - 36, "low"],
    [`breath-star-1`, gk(253, 2) + 33.5, GY.shore1 - 137 - 36, "low"],
  ],
  routes: {
    main: G_PLAN_MAIN,
    // The three Great Stars: jump, double and cape over the first gap and
    // over Pluto's last step, and the double between the long void's flights.
    upper: [
      ...G_PLAN_FROST,
      GJ(187, 0), GJ(195, 0), GJ(204, 0), GJ(208, 0, "a"), GD(211, 0),
      ...G_PLAN_MAIN.filter(([x]) => x > gk(224, 1) && x < gk(288, 2)),
      GJ(292, 2), GD(295, 2), GJ(299, 3, "a"), GD(303, 3),
      ...G_PLAN_MAIN.filter(([x]) => x > gk(318, 4) && x < gk(358, 6)),
      GJ(364, 6), GJ(368, 6, "a"), GD(371, 6),
      ...G_PLAN_MAIN.filter(([x]) => x > gk(378, 7)),
    ],
    ability: G_PLAN_MAIN,
    // The safe line: no cape over the first gap (a jump onto the floor, a
    // hop back up), then the main route.
    safe: [...G_PLAN_FROST, GJ(187, 0), GJ(195, 0), GJ(204, 0), GJ(210, 0), ...G_PLAN_MAIN.filter(([x]) => x > gk(224, 1))],
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
  { id: "well-song", route: "low", stars: [[wk(180, 3, 1) + 39.5, DY.well - 40], [wk(182, 3, 1) + 39.5, DY.well - 40], [wk(184, 3, 1) + 39.5, DY.well - 40], [wk(186, 3, 1) + 39.5, atY(DY.well, -64.7)]] },
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
    { id: "p-break", glyph: ["down"], action: "dive", x: wk(52, 1), y: DY.lid - 145, from: wk(48, 1), to: wk(58, 1), inputX: wk(56, 1), optional: true, route: "main" },
    { id: "p-cut", glyph: ["down"], action: "dive", x: wk(80, 1), y: DY.floor - 255, from: wk(79, 1) + 2 * 69.69, to: wk(83, 1, 1), inputX: wk(79, 1) + 3.4 * 69.69 },
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

/* ---- V · The Breaking Constellation (112 BPM): cracked stone ----
 * RESEARCH_PROGRESSION 4.5 (V), toward Saturn, look 'saturn'. Nothing to
 * GET: the world brings cracked stone (`crumble`: it gives way 5/16 of
 * simulation after the first touch-down and never breathes the cape), taught
 * with the GET's steps all the same (2.2): the first crack breaks under her
 * and a floor catches her (nothing at stake); after the beacon the second
 * must be left before it breaks (the ↑ glyph), then land and go three times;
 * the ridge, with the cracked chain above it (Great Star 1); the split voids
 * (a cracked islet between two flights gives no breath: the split-song
 * does); through the stone (a dive through a crack onto the short stone
 * under it: waiting falls past its end), with the cracked stair above it
 * (Great Star 3); and a confident finish: the last crack, the late double
 * to the crown (Great Star 2 for an early second press) and three cracks
 * down to the ring plain, no glyph. 23 bars, the door on the downbeat of
 * bar 24 (sixteenth 368).
 * Shared physics (1500 / 570 / 525), so IV's cells hold (scripts/arcs.mjs,
 * dy at exactly k/16 after a grid takeoff, up < 0):
 *   hold 4: -79.9  5: -26.0  6: +57.3        tap 3: +18.0 (a step down)
 *   jump, dive 3 (at the top):  5: +149.3 (the warm-up's low islet, and the
 *                               second stone under a crack)
 *   jump, cape 2:  8: -11.5     jump, cape 3: 10: +69.9 (the split voids)
 *   jump, jump 3:  8: -100.9    jump, jump 4:  8: -135.1 (the late double)
 *   a crack gives way 5/16 after the touch-down; a fall from rest of 3/16
 *   is 132.6 px (the first crack's floor)
 *   a grounded dive through a crack falls 127 px in 1.4/16, so it is
 *   pressed 0.4/16 early (IV's lids) and lands on the grid
 * Steps down after the beacons are taps (18 px, 3/16): walking off them
 * works too (the beacons' calm), the tap lands on the beat and takes the
 * star at its top. Heights follow the main route's landings in order. */
const V_CLOCK = 112 / 107;
const V_SIX = 15 / 107;
const VY = (() => {
  const y = {};
  let at = 0;
  for (const [id, dy] of [
    ["gate", 150], ["islet", 149.3], ["crack1", -26], ["floor", 132.6], ["floor2", 18],
    ["crack2", -26], ["isle", 57.3], ["crackA", -100.9], ["crackB", -26], ["crackC", 57.3], ["ridgeGate", -26], ["ridgeGate2", 18],
    ["ridgeStone", 57.3], ["ridgeB", -135.1], ["ridgeC", 57.3], ["splitShore", -26], ["splitShore2", 18],
    ["splitCrack", -11.5], ["splitFar", 69.9], ["crackS1", -79.9], ["crackS2", -100.9], ["crackS3", 57.3], ["stoneShore", 18],
    ["stoneCrack1", -26], ["under1", 127], ["stoneMid", -100.9], ["under2", 149.3], ["crackT", -100.9], ["crownGate", 18],
    ["lastCrack", -79.9], ["crown", -135.1], ["c1", 57.3], ["c2", 57.3], ["c3", 106.1], ["c4", 57.3], ["plain", -79.9],
  ])
    y[id] = at = +(at + dy).toFixed(1);
  // The chain over the ridge gate and the stair over the crown gate (upper).
  y.chainA = +(y.ridgeGate - 100.9).toFixed(1);
  y.chainB = +(y.chainA - 26).toFixed(1);
  y.chainC = +(y.chainB + 57.3).toFixed(1);
  y.stair1 = +(y.crownGate - 79.9).toFixed(1);
  y.stair2 = +(y.stair1 - 79.9).toFixed(1);
  return y;
})();
const vIsle = (id, landK, F, takeoffK, y, lead = 80, type, edge = 10) => {
  const q = [id, gk(landK, F) - lead, y, gk(takeoffK, F) + edge - (gk(landK, F) - lead)];
  return type ? [...q, type] : q;
};
/** A step down onto a beacon's stone (an 18 px tap lands on it on the beacon's
 * half bar), from 60 px before the landing to the next takeoff. */
const vStep = (id, landK, F, takeoffK, y, edge = 10) => [id, gk(landK, F) - 60, y, gk(takeoffK, F) + edge - (gk(landK, F) - 60)];
const V_MAIN = [
  ["saturn-gate", -700, VY.gate, gk(23) + 10 + 700],
  // The warm-up: jump 23, dive from the top (26) onto the low islet on 28;
  // without the dive the jump lands on it later (about 29.9), off the beat.
  vIsle("low-islet", 28, 0, 32, VY.islet, 80),
  // The first meeting: a held hop (32) onto the first crack (37); it gives
  // way under her on 42 and the floor catches her on 45. Walking off the
  // islet instead lands on the floor too: nothing is at stake. A tap (48)
  // steps down onto the beacon's stone.
  ["first-crack", gk(37) - 80, VY.crack1, gk(44) - (gk(37) - 80), "crumble"],
  ["crack-floor", gk(32) + 10, VY.floor, gk(48) + 10 - (gk(32) + 10)],
  vStep("crack-floor-2", 51, 0, 68, VY.floor2),
  // The need: jump 68 onto the second crack (73) and off it (76) before it
  // gives way (78), down onto the isle (82); then land and go: a double
  // (85, 88) up onto crack A (93), and two sixteenths on each crack after
  // it: 95 onto crack B (100), 102 down onto crack C (108), 110 onto the
  // ridge gate (115), and a tap down onto the beacon's stone (120). Where
  // she lands and goes, the stone ends 6 px before the takeoff's grid x
  // (a later press is a walk-off and coyote) and the landing lead is
  // 55-60 px: a press buffered to the touch-down still lands (the lip
  // catch), so V's windows narrow on their late side.
  vIsle("second-crack", 73, 0, 76, VY.crack2, 80, "crumble"),
  vIsle("beat-isle", 82, 0, 85, VY.isle, 80),
  vIsle("crack-a", 93, 0, 95, VY.crackA, 60, "crumble", -6),
  vIsle("crack-b", 100, 0, 102, VY.crackB, 55, "crumble", -6),
  vIsle("crack-c", 108, 0, 110, VY.crackC, 55, "crumble", -6),
  vIsle("ridge-gate", 115, 0, 117, VY.ridgeGate, 55),
  vStep("ridge-gate-2", 120, 0, 132, VY.ridgeGate2),
  // The ridge: down onto a small cracked stone (138) and off it by the late
  // double (140, 144) up 135 onto ridge B (148), down 57 (150, 156), up 26
  // (158, 163) and a tap down onto the split beacon's stone (165, 168).
  vIsle("ridge-stone", 138, 0, 140, VY.ridgeStone, 60, "crumble", -6),
  vIsle("ridge-b", 148, 0, 150, VY.ridgeB, 80, undefined, -6),
  vIsle("ridge-c", 156, 0, 158, VY.ridgeC, 55, undefined, -6),
  vIsle("split-shore", 163, 0, 165, VY.splitShore, 55),
  // Its edge is 6 px before the takeoff's grid x (a 30 Hz press is still on
  // it): the flight's jump has the level's narrowest window (an early jump
  // flies under the first stars).
  vStep("split-shore-2", 168, 0, 180, VY.splitShore2, -6),
  // The split voids: jump 180, cape 182 onto the cracked islet (188): no
  // breath there; the split-song along the flight, the descent, the islet
  // and the jump off it (191) gives the cape back (complete on 192) for the
  // second flight (194) down onto the far shore (201). Then land and go:
  // 204 onto crack S1 (208), a double (211, 214) up onto crack S2 (219),
  // 221 down onto crack S3 (227) and a tap down onto the beacon's stone (229, 232).
  vIsle("split-crack", 188, 1, 191, VY.splitCrack, 70, "crumble"),
  vIsle("split-far", 201, 2, 204, VY.splitFar, 90),
  vIsle("crack-s1", 208, 2, 211, VY.crackS1, 70, "crumble"),
  vIsle("crack-s2", 219, 2, 221, VY.crackS2, 60, "crumble", -6),
  vIsle("crack-s3", 227, 2, 229, VY.crackS3, 55, "crumble"),
  vStep("stone-shore", 232, 2, 244, VY.stoneShore),
  // Through the stone: a held hop (244) onto a crack (249); a dive through
  // it (249.6) lands on the short stone 127 px under it on 251. Waiting,
  // the crack gives way on 254 and the fall lands on 256.9, past its end.
  ["stone-crack-1", gk(249, 2) - 70, VY.stoneCrack1, gk(254, 2) + 24 - (gk(249, 2) - 70), "crumble"],
  vIsle("under-1", 251, 2, 255, VY.under1, 70),
  // Up again by a double (255, 258) onto the middle stone (263); then a
  // jump (267) and a dive from its top (270) through the short crack ahead
  // (40 px under the middle stone: the dive breaks it on 271.3, so its
  // shards snap onto the next eighth with the landing), onto the stone 149
  // px under the middle one (272). Without the dive she lands on the crack
  // (about 273.2) and walks off its end, past the stone's.
  vIsle("stone-mid", 263, 2, 267, VY.stoneMid, 80),
  ["stone-crack-2", gk(270.5, 2), VY.stoneMid + 40, gk(274, 2) - gk(270.5, 2), "crumble"],
  vIsle("under-2", 272, 2, 275, VY.under2, 70),
  // A double (275, 278) up onto crack T (283) and a tap down onto the crown
  // gate (285, 288).
  vIsle("crack-t", 283, 2, 285, VY.crackT, 60, "crumble"),
  vStep("crown-gate", 288, 2, 300, VY.crownGate),
  // The crown: up 80 onto the last crack (304), the late double (307, 311)
  // up 135 onto the crown (315); then the run down, two sixteenths on each
  // crack, no glyph: 317 (c1, 323), 325 (c2, 331), a double 333/336 down
  // 106 (c3, 343), 345 (c4, 351) and up 80 onto the ring plain (353, 357).
  vIsle("last-crack", 304, 2, 307, VY.lastCrack, 70, "crumble"),
  vIsle("crown", 315, 2, 317, VY.crown, 70, undefined, -6),
  vIsle("crown-c1", 323, 2, 325, VY.c1, 55, "crumble", -6),
  vIsle("crown-c2", 331, 2, 333, VY.c2, 55, "crumble"),
  vIsle("crown-c3", 343, 2, 345, VY.c3, 60, "crumble", -6),
  vIsle("crown-c4", 351, 2, 353, VY.c4, 55, "crumble", -6),
  ["ring-plain", gk(357, 2) - 60, VY.plain, gk(368, 2) + 520 - (gk(357, 2) - 60)],
];
const V_HIGH = [
  // The cracked chain over the ridge gate's run (Great Star 1): off the gate
  // by a double (116, 119), along the chain (127, 134), down onto ridge B
  // (141, about 146.9). It starts past the reach of a long tap at 117 and
  // ends before the ridge-song's star under it.
  vIsle("chain-a", 124, 0, 127, VY.chainA, 60, "crumble"),
  vIsle("chain-b", 132, 0, 134, VY.chainB, 60, "crumble"),
  ["chain-c", gk(138.4), VY.chainC, gk(141) + 10 - gk(138.4), "crumble"],
  // The cracked stair over the crown gate (Great Star 3): two hops up 80
  // (291, 296), then at once down onto the last crack (300, about 306).
  vIsle("crown-stair-1", 295, 2, 296, VY.stair1, 60, "crumble"),
  vIsle("crown-stair-2", 300, 2, 300, VY.stair2, 60, "crumble"),
];
const vAt = (y0, dy) => Math.round(y0 + dy - 36);
// A constellation star entering the pickup box on sixteenth k: running
// (feet - 40), or at the arc's height dy (the body centre, feet - 36).
const vRun = (k, F, y) => [gk(k, F) + 39.5, y - 40];
const vArc = (k, F, y0, dy) => [gk(k, F) + 39.5, vAt(y0, dy)];
const V_CHAINS = [
  // The warm-up's jump and the dive from its top onto the low islet
  // (complete on 30).
  { id: "fall-song", route: "low", stars: [vArc(24, 0, VY.gate, -64.7), vArc(25, 0, VY.gate, -99.3), vArc(27, 0, VY.gate, 6.8), vRun(30, 0, VY.islet)] },
  // Land and go: the second crack, the isle and the double up (complete on 90).
  { id: "crack-song", route: "low", stars: [vRun(74, 0, VY.crack2), vArc(77, 0, VY.crack2, -64.7), vRun(83, 0, VY.isle), vArc(86, 0, VY.isle, -64.7), vArc(90, 0, VY.isle, -190.3)] },
  // The ridge: the small cracked stone, its rise, the late double (146).
  { id: "ridge-song", route: "low", stars: [vRun(139, 0, VY.ridgeStone), vArc(141, 0, VY.ridgeStone, -64.7), vArc(145, 0, VY.ridgeStone, -135.2), vArc(146, 0, VY.ridgeStone, -164.6)] },
  // Required: two stars on the first flight's line, one on its descent,
  // one on the cracked islet and one on the jump off it, complete on 192,
  // two sixteenths before the second flight; the islet gives no breath.
  { id: "split-song", route: "low", stars: [[gk(182) + 69.69 + 39.5, vAt(VY.splitShore2, -100)], [gk(182) + 2 * 69.69 + 39.5, vAt(VY.splitShore2, -100)], vRun(188, 1, VY.splitCrack), vRun(190, 1, VY.splitCrack), vArc(192, 1, VY.splitCrack, -64.7)] },
  // Through the stone: under the first crack, up the double, on the middle
  // stone, at the top of the jump before the dive, under the second (274).
  { id: "stone-song", route: "low", stars: [vRun(252, 2, VY.under1), vArc(256, 2, VY.under1, -64.7), vRun(264, 2, VY.stoneMid), vArc(269, 2, VY.stoneMid, -99.3), vRun(274, 2, VY.under2)] },
  // The crown: on the last crack, the jump, the late double's rise, the crown (316).
  { id: "crown-song", route: "low", stars: [vRun(305, 2, VY.lastCrack), vArc(308, 2, VY.lastCrack, -64.7), vArc(312, 2, VY.lastCrack, -135.2), vArc(313, 2, VY.lastCrack, -164.6), vRun(316, 2, VY.crown)] },
  // The run down: c1, its jump, c2, its jump and the double off it (338).
  { id: "plain-song", route: "low", stars: [vRun(324, 2, VY.c1), vArc(326, 2, VY.c1, -64.7), vRun(332, 2, VY.c2), vArc(334, 2, VY.c2, -64.7), vArc(338, 2, VY.c2, -190.3)] },
];
const V_GREAT = [
  { id: "great-1", x: gk(133) + 10, y: VY.chainB - 46, line: "the cracked chain above the ridge gate: land, jump twice, then land and go" },
  { id: "great-2", x: gk(310.5, 2), y: VY.lastCrack - 200, line: "the crown: jump twice early off the last crack" },
  { id: "great-3", x: gk(300, 2), y: VY.stair2 - 46, line: "the cracked stair above the crown gate" },
];
const V_STARS = [
  // Running stars after the beacons (the bar is full there anyway).
  ...[[58, 0, VY.floor2], [61, 0, VY.floor2], [64, 0, VY.floor2], [122, 0, VY.ridgeGate2], [125, 0, VY.ridgeGate2], [128, 0, VY.ridgeGate2], [170, 0, VY.splitShore2], [173, 0, VY.splitShore2], [176, 0, VY.splitShore2], [236, 2, VY.stoneShore], [239, 2, VY.stoneShore], [242, 2, VY.stoneShore], [290, 2, VY.crownGate], [297, 2, VY.crownGate], [360, 2, VY.plain], [363, 2, VY.plain]].map(([k, F, y], i) => [`run-star-${i}`, gk(k, F) + 33.5, y - 40, "low"]),
  // A star on the rise of each hop that no song crosses.
  ...[[32, 0, VY.islet], [68, 0, VY.floor2], [95, 0, VY.crackA], [102, 0, VY.crackB], [110, 0, VY.crackC], [150, 0, VY.ridgeB], [158, 0, VY.ridgeC], [204, 2, VY.splitFar], [211, 2, VY.crackS1], [221, 2, VY.crackS2], [244, 2, VY.stoneShore], [275, 2, VY.under2], [300, 2, VY.crownGate], [317, 2, VY.crown], [345, 2, VY.c3], [353, 2, VY.c4]].map(([k, F, y], i) => [`hop-star-${i}`, gk(k + 1, F) + 33.5, vAt(y, -64.7), "low"]),
  // The taps down onto the beacons' stones: a star at the top of each.
  ...[[48, 0, VY.floor], [117, 0, VY.ridgeGate], [165, 0, VY.splitShore], [229, 2, VY.crackS3], [285, 2, VY.crackT]].map(([k, F, y], i) => [`tap-star-${i}`, gk(k + 1, F) + 33.5, vAt(y, -23.7), "low"]),
];
const VJ = (k, F, when = "g") => [gk(k, F) - 0.3, "jump", when];
const VT = (k, F) => [gk(k, F) - 0.3, "tap", "g"];
const VD = (k, F) => [gk(k, F) - 0.3, "dash", "a"];
const VV = (x, when = "a") => [x - 0.3, "dive", when];
const V_PLAN_MAIN = [
  VJ(23, 0), VV(gk(26)), VJ(32, 0), VT(48, 0),
  VJ(68, 0), VJ(76, 0), VJ(85, 0), VJ(88, 0, "a"), VJ(95, 0), VJ(102, 0), VJ(110, 0), VT(117, 0),
  VJ(132, 0), VJ(140, 0), VJ(144, 0, "a"), VJ(150, 0), VJ(158, 0), VT(165, 0),
  VJ(180, 0), VD(182, 0), VJ(191, 1), VD(194, 1),
  VJ(204, 2), VJ(211, 2), VJ(214, 2, "a"), VJ(221, 2), VT(229, 2),
  VJ(244, 2), VV(gk(249.6, 2), "g"), VJ(255, 2), VJ(258, 2, "a"), VJ(267, 2), VV(gk(270, 2)), VJ(275, 2), VJ(278, 2, "a"), VT(285, 2),
  VJ(300, 2), VJ(307, 2), VJ(311, 2, "a"), VJ(317, 2), VJ(325, 2), VJ(333, 2), VJ(336, 2, "a"), VJ(345, 2), VJ(353, 2),
];
const BREAKING = {
  key: "breaking",
  title: "The Breaking Constellation",
  look: "saturn",
  toward: "Saturn",
  introduces: "cracks",
  bpm: 112,
  clock: V_CLOCK,
  // Cracked stone gives way 5/16 of simulation after the first touch-down.
  physics: { crumbleAfter: 5 * V_SIX },
  verbs: { double: true, cape: true, glide: true, dive: true, super: false },
  gets: [],
  capeRule: "breath",
  view: { minWidth: 920, portraitMinWidth: 740 },
  level: { title: "The Breaking Constellation", speed: 270, startX: 220, startY: VY.gate, finishX: gk(368, 2), finishY: VY.plain, beat: BEAT },
  movements: [{ id: "V", x: -1000, numeral: "V", name: "The Breaking Constellation" }],
  sections: [
    { x: -1000, movement: "V", step: "warm", name: "V · The Breaking Constellation" },
    { x: gk(30), movement: "V", step: "introduce", name: "V · The Breaking Constellation — the first crack" },
    { x: gk(56), movement: "V", step: "need", name: "V · The Breaking Constellation — land and go" },
    { x: gk(120), movement: "V", step: "develop", name: "V · The Breaking Constellation — the ridge" },
    { x: gk(168), movement: "V", step: "twist", name: "V · The Breaking Constellation — the split voids" },
    { x: gk(232, 2), movement: "V", step: "twist", name: "V · The Breaking Constellation — through the stone" },
    { x: gk(288, 2), movement: "V", step: "conclude", name: "V · The Breaking Constellation — the crown" },
    { x: gk(357, 2), movement: "V", step: "coda", name: "V · The Breaking Constellation — the ring plain" },
  ],
  // Beacons on half bars 4½, 8½, 11½, 15½ and 19 (at most 10.7 s real apart),
  // each lit by the landing on its own beat.
  checkpoints: [
    { id: "tired", x: gk(56) - 3, y: VY.floor2, platform: "crack-floor-2", story: "Saturn's stars were old. They could hold her for a breath, no longer.", tip: "Cracked stone breaks soon after you land. Jump off it quickly." },
    { id: "ridge", x: gk(120) - 3, y: VY.ridgeGate2, platform: "ridge-gate-2", story: "Above the ridge a chain of tired stars still glowed, too thin to trust.", tip: "Land and jump again at once: a crack holds you for half a beat." },
    { id: "split", x: gk(168) - 3, y: VY.splitShore2, platform: "split-shore-2", story: "The broken islet would not let the cape breathe. The song would.", tip: "Take every star of the song on the first flight and the islet; it gives the cape back." },
    { id: "through", x: gk(232, 2) - 3, y: VY.stoneShore, platform: "stone-shore", story: "Under the cracks there was older stone, and it held.", tip: "Land on the crack, then press down at once: the stone under it holds." },
    { id: "crown", x: gk(288, 2) - 3, y: VY.crownGate, platform: "crown-gate", story: "Saturn's rings leaned close, and the last crack led up to them.", tip: "Jump onto the crack, jump again, then once more near the top." },
  ],
  startTip: "Jump, then press down at the top to drop onto the low islet.",
  main: V_MAIN,
  high: V_HIGH,
  updrafts: [],
  cascades: [],
  chains: V_CHAINS,
  great: V_GREAT,
  moments: [],
  decor: [],
  prompts: [
    { id: "p-crack", glyph: ["up"], action: "jump", x: gk(75), y: VY.crack2 - 150, from: gk(74), to: gk(77), inputX: gk(76) + 10 },
    { id: "p-split", glyph: ["up", "then", "right"], action: "dash", x: gk(181) - 66, y: VY.splitShore2 - 170, from: gk(180) - 30, to: gk(183) + 60, inputX: gk(180) + 2 },
    { id: "p-through", glyph: ["down"], action: "dive", x: gk(250, 2) + 30, y: VY.stoneCrack1 - 165, from: gk(249, 2) + 5, to: gk(253, 2), inputX: gk(252, 2) },
  ],
  stars: V_STARS,
  routes: {
    main: V_PLAN_MAIN,
    // Great Stars 1-3: the cracked chain (land and go off the ridge gate by
    // a double, along the chain, down onto ridge B), the cracked stair and
    // the early second press off the last crack.
    upper: [
      ...V_PLAN_MAIN.filter(([x]) => x < gk(115)),
      VJ(116, 0), VJ(119, 0, "a"), VJ(127, 0), VJ(134, 0), VJ(141, 0),
      ...V_PLAN_MAIN.filter(([x]) => x > gk(146) && x < gk(288, 2)),
      VJ(291, 2), VJ(296, 2), VJ(300, 2), VJ(307, 2), VJ(309, 2, "a"),
      ...V_PLAN_MAIN.filter(([x]) => x > gk(316, 2)),
    ],
    // The other ways through the first bars: no dive in the warm-up (she
    // lands on the islet later), then a walk-off onto the first crack's floor.
    ability: [VJ(23, 0), ...V_PLAN_MAIN.filter(([x]) => x > gk(40))],
    safe: V_PLAN_MAIN,
  },
};

/* ---- VI · Borrowed Wind (118 BPM): storm-bright; solar wind ----
 * RESEARCH_PROGRESSION 4.5 (VI), toward Jupiter, look 'jupiter'. Nothing to
 * GET: the solar wind is the world's (a column lifts her at 700 px/s² up to
 * 240 px/s, 40% more with the cape held; a flight that enters it ends, and
 * gets its charge back if it began within 0.15 s; no breath inside), and VI
 * teaches it with the GET's steps: the hearth breeze over solid stone (hold
 * the cape there and it lifts her; nothing at stake; the helper rides it),
 * the first wind (jump into it: it lifts her to a shore no jump reaches),
 * the glide bridge (the cape held past the column's top and let go over the
 * far shore; Great Star 2 on a ledge for a flight out of its top), the
 * twist: flying out of the wind's top (its song gives the cape back, so a
 * flight pressed just before the column, refunded, or spent earlier still
 * leaves one) and wind, dive, wind; then the finale (a cracked launch, two
 * flights around a cape star at the double's top, the finale wind) and the last wind (the
 * cape held and let go; Great Star 3 for a flight out of its top). Great
 * Star 1 is at the top of the first fly-out column, which only the held
 * cape reaches. 23 bars, the door on the downbeat of bar 24 (368).
 * Shared physics; a standard column starts 30 px past the jump's grid x,
 * 180 px wide, its body-centre band from 307 px over the takeoff's top to
 * 253 under it (the breeze: 160 wide, 200 over, ending at the stone).
 * Cells (scratch probe on the real model, dy at k/16 after the jump):
 *   jump in:              9: -154.4  10: -69.8
 *   jump in, cape held:  16: -163.7 (gliding 19.6 px a sixteenth down)
 *     ...let go at 12:   15: -53.2;  at 11: 14: -71.9
 *   jump in, cape at 6 (out of its top): 12: -147.2  13: -61.5
 *   jump in, dive at 6:   8: +16.2
 *   breeze, cape held:   16.87: 0 (back on the same stone, 16 ms real off)
 *   jump, cape 3, jump 9, cape 11 (the finale, refilled between): 17: -16.8
 * plus V's hold 4/5/6 (-79.9, -26, +57.3), tap 3 (+18) and the double 3
 * (8: -100.9). */
const J_CLOCK = 118 / 107;
const J_SIX = 15 / 107;
const JY = (() => {
  const y = {};
  let at = 0;
  for (const [id, dy] of [
    ["gate", 515], ["crack1", 57.3], ["crack2", -100.9], ["breeze", 57.3], ["breeze2", 18],
    ["lifted", -141.3], ["lCrack1", 57.3], ["lCrack2", 106], ["bridgeGate", -79.9], ["bridgeShore", -53.2], ["bridgeShore2", 18],
    ["columnShore", -147.2], ["cCrack1", 57.3], ["cCrack2", 106], ["diveGate", -79.9], ["diveIslet", 16.2], ["stormShore", -154.4],
    ["finaleCrack", -26], ["finaleShore", -16.8], ["finaleHigh", -154.4], ["hCrack1", 149.3], ["hCrack2", 106], ["highShore", 18],
    ["fIslet", 16.2], ["gShore", -53.2], ["gCrack1", 57.3], ["gCrack2", 106], ["gCrack3", -79.9], ["plain", 18],
  ])
    y[id] = at = +(at + dy).toFixed(1);
  y.ledge = +(y.bridgeGate - 194.5).toFixed(1);
  return y;
})();
const jIsle = (id, landK, F, takeoffK, y, lead = 80, type, edge = 10) => {
  const q = [id, gk(landK, F) - lead, y, gk(takeoffK, F) + edge - (gk(landK, F) - lead)];
  return type ? [...q, type] : q;
};
/** A solar-wind column for a jump on sixteenth k (F flights so far) from a
 * stone at y: 30 px past the jump's grid x. */
const jCol = (id, k, F, y, extra = {}) => ({ id, x: gk(k, F) + 30, width: 180, top: y - 307, bottom: y + 253, ...extra });
const jBreeze = (id, k, F, y) => ({ id, x: gk(k, F) + 30, width: 160, top: y - 200, bottom: y, gentle: true });
const J_MAIN = [
  ["jupiter-gate", -700, JY.gate, gk(23) + 10 + 700],
  // Warm-up: cracks, land and go: 23 down onto crack 1 (29), a double (31,
  // 34) up onto crack 2 (39), 41 down onto the breeze stone (47).
  jIsle("w-crack-1", 29, 0, 31, JY.crack1, 55, "crumble", -6),
  jIsle("w-crack-2", 39, 0, 41, JY.crack2, 60, "crumble", -6),
  // The hearth breeze (safe first use): jump 50 into it holding the cape:
  // it lifts her; let go (58) and she lands on the same stone (about 60.8);
  // a tap (69) steps down onto the beacon's stone (72). Running on, nothing
  // happens; holding on, she floats down onto it later.
  jIsle("breeze-stone", 47, 0, 69, JY.breeze, 55),
  ["breeze-stone-2", gk(72) - 60, JY.breeze2, gk(84) + 10 - (gk(72) - 60)],
  // The need: jump into the first wind (84) and again at its top (91): she
  // lands 141 px up on the lifted shore (97); no jump reaches it.
  jIsle("lifted-shore", 97, 0, 99, JY.lifted, 80, undefined, -6),
  // Land and go: 99 down onto crack L1 (105), a double (107, 110) down onto
  // crack L2 (117), 119 up onto the bridge gate (123).
  jIsle("l-crack-1", 105, 0, 107, JY.lCrack1, 55, "crumble", -6),
  jIsle("l-crack-2", 117, 0, 119, JY.lCrack2, 70, "crumble", -6),
  jIsle("bridge-gate", 123, 0, 125, JY.bridgeGate, 55),
  // The glide bridge: jump 125 into its column with the cape held, glide
  // past its top and let go (137) over the far shore (140); without the
  // cape the jump comes down short of it. A tap (141) onto the beacon's stone (144).
  jIsle("bridge-shore", 140, 0, 141, JY.bridgeShore, 70),
  ["bridge-shore-2", gk(144) - 60, JY.bridgeShore2, gk(156) + 10 - (gk(144) - 60)],
  // Out of the top: jump 156 into the column, the wind-song on its rise,
  // the cape at its top (162) carries her onto the column shore (168).
  jIsle("column-shore", 168, 1, 170, JY.columnShore, 80, undefined, -6),
  jIsle("c-crack-1", 176, 1, 178, JY.cCrack1, 55, "crumble", -6),
  jIsle("c-crack-2", 188, 1, 190, JY.cCrack2, 70, "crumble", -6),
  jIsle("dive-gate", 194, 1, 196, JY.diveGate, 55),
  // Wind, dive, wind: jump into column D (196), dive out of its top (202)
  // onto the islet (204), jump into column E (206) up onto the storm shore (215).
  // (Its lead is 90 px, was 50: a dive pressed up to 290 ms early still
  // lands on it; early dives were the human proxies' second VI spot.)
  jIsle("dive-islet", 204, 1, 206, JY.diveIslet, 90, undefined, -6),
  ["storm-shore", gk(215, 1) - 80, JY.stormShore, gk(228, 1) + 10 - (gk(215, 1) - 80)],
  // The finale: a hop onto the launch stone (233); jump 235, cape at the
  // top (238; the launch-song on the hop, the stone and the jump's rise
  // charges it, whatever was spent before the hop), the
  // double (244), the cape star at its top, cape 246, down onto the finale
  // shore (252; 170 px of lead, so it is in view at the jump and a short
  // second flight lands too); jump into the finale wind (254)
  // up onto the high stone (263); a jump and a dive from its top (265, 268)
  // down onto stone H1 (270: stable, a dive smashes a crack it lands on), a
  // double (272, 275) down onto crack H2 (282)
  // and a tap onto the last beacon's stone (284, 287).
  // (Stable: a crack with no catch under it and its next stone 786 px on
  // would end a failed finale out of view; the launch-song still charges
  // the first flight after the hop.)
  jIsle("finale-launch", 233, 1, 235, JY.finaleCrack, 60, undefined, -6),
  jIsle("finale-shore", 252, 3, 254, JY.finaleShore, 170),
  jIsle("finale-high", 263, 3, 265, JY.finaleHigh, 80, undefined, -6),
  jIsle("h-stone-1", 270, 3, 272, JY.hCrack1, 55, undefined, -6),
  jIsle("h-crack-2", 282, 3, 284, JY.hCrack2, 70, "crumble", -6),
  ["high-shore", gk(287, 3) - 60, JY.highShore, gk(300, 3) + 10 - (gk(287, 3) - 60)],
  // The last wind: jump into column F (300), dive out of its top (306) onto
  // the islet (308), jump into column G (310) with the cape held, let go
  // (322) over the shore (325); then the cracks down, no glyph, and a tap
  // onto the plain of Jupiter's storm (353, 356).
  jIsle("f-islet", 308, 3, 310, JY.fIslet, 50, undefined, -6),
  jIsle("g-shore", 325, 3, 327, JY.gShore, 70, undefined, -6),
  jIsle("g-crack-1", 333, 3, 335, JY.gCrack1, 55, "crumble", -6),
  jIsle("g-crack-2", 345, 3, 347, JY.gCrack2, 70, "crumble", -6),
  jIsle("g-crack-3", 351, 3, 353, JY.gCrack3, 55, "crumble", -6),
  ["storm-plain", gk(356, 3) - 60, JY.plain, gk(368, 3) + 520 - (gk(356, 3) - 60)],
];
const J_HIGH = [
  // Great Star 2's ledge over the glide bridge: a flight out of its column's top.
  ["bridge-ledge", gk(141, 1) - 60, JY.ledge, 37.85 * 5],
];
const J_WIND = [
  jBreeze("hearth-breeze", 50, 0, JY.breeze),
  // Breezes over the beacons' stones: a jump into one lands on the grid
  // 9/16 later with a star at its top (optional).
  jBreeze("breeze-1", 73, 0, JY.breeze2),
  jCol("first-wind", 84, 0, JY.breeze2),
  jCol("bridge-wind", 125, 0, JY.bridgeGate),
  jBreeze("breeze-2", 145, 0, JY.bridgeShore2),
  jCol("top-wind", 156, 0, JY.bridgeShore2),
  jCol("dive-wind", 196, 1, JY.diveGate),
  jCol("storm-wind", 206, 1, JY.diveIslet),
  jBreeze("breeze-3", 217, 1, JY.stormShore),
  jCol("finale-wind", 254, 3, JY.finaleShore),
  jBreeze("breeze-4", 289, 3, JY.highShore),
  jCol("last-wind-f", 300, 3, JY.highShore),
  jCol("last-wind-g", 310, 3, JY.fIslet),
];
const jAt = (y0, dy) => Math.round(y0 + dy - 36);
const jRun = (k, F, y) => [gk(k, F) + 39.5, y - 40];
const jArc = (k, F, y0, dy) => [gk(k, F) + 39.5, jAt(y0, dy)];
const J_CHAINS = [
  // The breeze's float (complete on 56).
  { id: "breeze-song", route: "low", stars: [jArc(51, 0, JY.breeze, -61.8), jArc(52, 0, JY.breeze, -109.1), jArc(54, 0, JY.breeze, -195.9), jArc(56, 0, JY.breeze, -203.1)] },
  // In the fly-out column, one a sixteenth on the rise (complete on 160).
  { id: "wind-song", route: "low", stars: [157, 158, 159, 160].map((k, i) => jArc(k, 0, JY.bridgeShore2, [-61.8, -100.5, -134.2, -167.8][i])) },
  // Required: on the hop onto the cracked launch, the crack and the jump's
  // rise (complete on 236), three sixteenths before the first flight.
  { id: "launch-song", route: "low", stars: [jArc(229, 1, JY.stormShore, -61.8), jArc(232, 1, JY.stormShore, -79.9), jRun(234, 1, JY.finaleCrack), jArc(236, 1, JY.finaleCrack, -61.8)] },
  // Required: along the first flight and at the double (complete on 244), before the second.
  // Wind, dive, wind (complete on 212).
  { id: "storm-song", route: "low", stars: [jArc(198, 1, JY.diveGate, -100.5), jRun(205, 1, JY.diveIslet), jArc(208, 1, JY.diveIslet, -100.5), jArc(210, 1, JY.diveIslet, -167.8), jArc(212, 1, JY.diveIslet, -235.1)] },
  // The last wind's float (complete on 320).
  { id: "last-song", route: "low", stars: [jArc(312, 3, JY.fIslet, -109.1), jArc(314, 3, JY.fIslet, -203.3), jArc(316, 3, JY.fIslet, -293.7), jArc(318, 3, JY.fIslet, -308.1), jArc(320, 3, JY.fIslet, -281.5)] },
];
const J_GREAT = [
  { id: "great-1", x: gk(161.5), y: JY.bridgeShore2 - 330, line: "the top of the fly-out wind: hold the cape in it" },
  { id: "great-2", x: gk(142, 1), y: JY.ledge - 46, line: "the ledge over the glide bridge: fly out of the column's top" },
  { id: "great-3", x: gk(213, 1), y: JY.diveIslet - 347, line: "the top of the storm wind: hold the cape in it and float onto the storm shore" },
];
const J_STARS = [
  // The finale's first flight: three loose stars on its line (+1/8 each; the
  // cape star at the double's top is the second flight's charge).
  ...[1, 2, 3].map((i) => [`finale-star-${i - 1}`, gk(238, 1) + 69.69 * i + 33.5, jAt(JY.finaleCrack, -105.2), "low"]),
  // (The beacons' runs carry their breezes' stars instead.)
  ...[[359, 3, JY.plain], [362, 3, JY.plain], [365, 3, JY.plain]].map(([k, F, y], i) => [`run-star-${i}`, gk(k, F) + 33.5, y - 40, "low"]),
  ...[[23, 0, JY.gate], [41, 0, JY.crack2], [99, 0, JY.lifted], [119, 0, JY.lCrack2], [170, 1, JY.columnShore], [178, 1, JY.cCrack1], [190, 1, JY.cCrack2], [327, 3, JY.gShore], [335, 3, JY.gCrack1], [347, 3, JY.gCrack2]].map(([k, F, y], i) => [`hop-star-${i}`, gk(k + 1, F) + 33.5, jAt(y, -64.7), "low"]),
  // At the top of each beacon breeze's lift, and of the taps.
  ...[[73, 0, JY.breeze2], [145, 0, JY.bridgeShore2], [217, 1, JY.stormShore], [289, 3, JY.highShore]].map(([k, F, y], i) => [`breeze-star-${i}`, gk(k + 4, F) + 33.5, jAt(y, -167.8), "low"]),
  ...[[69, 0, JY.breeze], [141, 0, JY.bridgeShore], [284, 3, JY.hCrack2], [353, 3, JY.gCrack3]].map(([k, F, y], i) => [`tap-star-${i}`, gk(k + 1, F) + 33.5, jAt(y, -23.7), "low"]),
];
const JJ = (k, F, when = "g") => [gk(k, F) - 0.3, "jump", when];
const JT = (k, F) => [gk(k, F) - 0.3, "tap", "g"];
const JD = (k, F) => [gk(k, F) - 0.3, "dash", "a"];
const JV = (k, F) => [gk(k, F) - 0.3, "dive", "a"];
// The held cape is pressed at the column's own x (in the wind it glides);
// a release in the air is a timed letting-go.
const JG = (k, F) => [gk(k, F) + 30, "glide", "*"];
const JU = (k, F, when = "a") => [gk(k, F) - 0.3, "unglide", when];
const J_PLAN_MAIN = [
  JJ(23, 0), JJ(31, 0), JJ(34, 0, "a"), JJ(41, 0),
  JJ(50, 0), JG(50, 0), JU(58, 0), JT(69, 0),
  JJ(73, 0), JJ(84, 0), JJ(91, 0, "a"),
  JJ(99, 0), JJ(107, 0), JJ(110, 0, "a"), JJ(119, 0),
  JJ(125, 0), JG(125, 0), JU(137, 0), JT(141, 0),
  JJ(145, 0), JJ(156, 0), JD(162, 0),
  JJ(170, 1), JJ(178, 1), JJ(181, 1, "a"), JJ(190, 1),
  JJ(196, 1), JV(202, 1), JJ(206, 1),
  JJ(217, 1), JJ(228, 1), JJ(235, 1), JD(238, 1), JJ(244, 2, "a"), JD(246, 2),
  JJ(254, 3),
  JJ(265, 3), JV(268, 3), JJ(272, 3), JJ(275, 3, "a"), JT(284, 3),
  JJ(289, 3), JJ(300, 3), JV(306, 3), JJ(310, 3), JG(310, 3), JU(322, 3),
  JJ(327, 3), JJ(335, 3), JJ(338, 3, "a"), JJ(347, 3), JT(353, 3),
];
const BORROWED_WIND = {
  key: "borrowed-wind",
  title: "Borrowed Wind",
  look: "jupiter",
  toward: "Jupiter",
  introduces: "wind",
  bpm: 118,
  clock: J_CLOCK,
  physics: { crumbleAfter: 5 * J_SIX },
  verbs: { double: true, cape: true, glide: true, dive: true, super: false },
  gets: [],
  capeRule: "breath",
  view: { minWidth: 970, portraitMinWidth: 775 },
  level: { title: "Borrowed Wind", speed: 270, startX: 220, startY: JY.gate, finishX: gk(368, 3), finishY: JY.plain, beat: BEAT },
  movements: [{ id: "VI", x: -1000, numeral: "VI", name: "Borrowed Wind" }],
  sections: [
    { x: -1000, movement: "VI", step: "warm", name: "VI · Borrowed Wind" },
    { x: gk(44), movement: "VI", step: "safe", name: "VI · Borrowed Wind — the hearth breeze" },
    { x: gk(72), movement: "VI", step: "need", name: "VI · Borrowed Wind — the first wind" },
    { x: gk(115), movement: "VI", step: "develop", name: "VI · Borrowed Wind — the glide bridge" },
    { x: gk(144), movement: "VI", step: "twist", name: "VI · Borrowed Wind — out of the top" },
    { x: gk(190, 1), movement: "VI", step: "twist", name: "VI · Borrowed Wind — wind, dive, wind" },
    { x: gk(216, 1), movement: "VI", step: "conclude", name: "VI · Borrowed Wind — the finale" },
    { x: gk(288, 3), movement: "VI", step: "conclude", name: "VI · Borrowed Wind — the last wind" },
    { x: gk(356, 3), movement: "VI", step: "coda", name: "VI · Borrowed Wind — Jupiter's storm" },
  ],
  // Beacons on half bars 5½, 10, 14½ and 19 (at most 10.2 s real apart),
  // each lit by the landing on its own beat.
  checkpoints: [
    { id: "breeze", x: gk(72) - 3, y: JY.breeze2, platform: "breeze-stone-2", story: "The wind had come all the way from the Sun, and it would lend itself to anyone light enough.", tip: "Jump into the wind at the edge: it lifts you." },
    { id: "bridge", x: gk(144) - 3, y: JY.bridgeShore2, platform: "bridge-shore-2", story: "Jupiter's bands turned below her, slow and enormous, and the wind ran between them.", tip: "Jump into the wind, press the cape near the top, fly out." },
    { id: "storm", x: gk(216, 1) - 3, y: JY.stormShore, platform: "storm-shore", story: "In the storm's eye the stones broke and the wind held. She trusted the wind.", tip: "Take the songs on the cracked stone and in the first flight: each gives the cape back." },
    { id: "last", x: gk(288, 3) - 3, y: JY.highShore, platform: "high-shore", story: "One more gust, borrowed and given back, and Mars was a red point ahead.", tip: "Drop out of the first wind, hold the cape in the second, let go over the shore." },
  ],
  startTip: "Jump into the wind holding the cape: it lifts you.",
  main: J_MAIN,
  high: J_HIGH,
  updrafts: J_WIND,
  cascades: [],
  chains: J_CHAINS,
  great: J_GREAT,
  // The helper rides the hearth breeze ahead of her (RESEARCH_PROGRESSION 2.1).
  // The finale's second flight (critic, 2026-11-10): a cape star at the
  // top of the double, lit because the first flight spent the bar (the
  // three stars on its line give 3/8). It replaced the finale-song, whose
  // last star sat at the double itself: an early double, jump or cape broke
  // it and left the second flight empty (the human proxies' VI hot spot).
  refills: [{ id: "cape-finale", kind: "cape", x: gk(242, 2) + 36, y: jAt(JY.finaleCrack, -75), required: true }],
  moments: [{ id: "helper-breeze", kind: "helper", k: 36, target: "hearth-breeze" }],
  decor: [],
  prompts: [
    { id: "p-breeze", glyph: ["up", "then", "hold-right"], action: "glide", x: gk(50), y: JY.breeze - 230, from: gk(48) + 40, to: gk(60), inputX: gk(48) + 90, optional: true, route: "main" },
    { id: "p-wind", glyph: ["up"], action: "jump", x: gk(83) + 36, y: JY.breeze2 - 145, from: gk(83), to: gk(85), inputX: gk(84) + 8 },
    { id: "p-glide", glyph: ["hold-right"], action: "glide", x: gk(125), y: JY.bridgeGate - 230, from: gk(123) + 40, to: gk(137), inputX: gk(123) + 90 },
    // (From the column's far edge on: inside it the cape glides.)
    { id: "p-top", glyph: ["right"], action: "dash", x: gk(162) - 252, y: JY.bridgeShore2 - 215, from: gk(161.7), to: gk(164), inputX: gk(162) + 10 },
  ],
  stars: J_STARS,
  routes: {
    main: J_PLAN_MAIN,
    // Great Stars 2, 1 and 3: a flight out of the bridge column's top onto
    // its ledge (then down onto the beacon's stone), the cape held in the
    // fly-out column (let go after its flight, onto the column shore), and
    // the cape held in the storm wind (let go at 212 onto the storm shore).
    upper: [
      ...J_PLAN_MAIN.filter(([x]) => x < gk(124)),
      JJ(125, 0), JG(125, 0), JD(131, 0), JU(141, 1, "g"),
      JJ(156, 0), JG(156, 0), JD(162, 0), JU(166, 1),
      ...J_PLAN_MAIN.filter(([x]) => x > gk(168, 1) && x < gk(205, 1)),
      JJ(206, 1), JG(206, 1), JU(212, 1),
      ...J_PLAN_MAIN.filter(([x]) => x > gk(224, 1)),
    ],
    // No breeze hops, and the cape pressed just before the fly-out column:
    // the wind ends that flight within 0.15 s and gives its charge back, so
    // the flight out of the top still has it (the wind refund).
    ability: [
      ...J_PLAN_MAIN.filter(([x]) => ![73, 145, 217, 289].some((k) => Math.abs(x - gk(k, k > 200 ? (k > 280 ? 3 : 1) : 0) + 0.3) < 1) && x < gk(157)),
      [gk(156) + 24, "dash", "a"],
      ...J_PLAN_MAIN.filter(([x]) => x > gk(157) && ![217, 289].some((k) => Math.abs(x - gk(k, k > 280 ? 3 : 1) + 0.3) < 1)),
    ],
    safe: J_PLAN_MAIN,
  },
};

/* ---- VII · The Falling Road (123 BPM): tense; the beat cascade ----
 * RESEARCH_PROGRESSION 4.5. No GET: the beat cascade is the world's. A
 * cascade's tiles drop one per `interval` once Diana first touches it,
 * the first when her nominal run is `lead` px past tile 0's start, so every
 * drop is on a beat (the marimba knock) and the road falls behind her heels.
 * Tiles are drawn cracks: they never breathe the cape and a dive smashes
 * them, so the dives here land on stable stones between tiles. Clock 1.150,
 * shared physics (II-VI's cells, scripts/arcs.mjs): hold 4: -79.9, 5: -26.0,
 * 6: +57.3; tap 3: +18.0; jump, dive at 3: 5: +149.3; jump, cape 3: 10:
 * +69.9; jump, double 3: 8: -100.9; jump, double 4: 8: -135.1; jump, double
 * 2, cape 4: 11.6: +69.9 (GS2); into a standard column 9: -154.4, and again
 * at its top (7) 13: -141.3; into a column with the cape held and let go at
 * 12: 15: -53.2. Bounces on a tile are land-and-go: every touch-down is the
 * next takeoff (6/16 down 57.3 px, 5/16 up 26). 24 bars, the door on the
 * downbeat of bar 25 (sixteenth 384), 46.8 s real. */
const R_CLOCK = 123 / 107;
const RY = (() => {
  const y = {};
  let at = 0;
  for (const [id, dy] of [
    ["gate", 360], ["warmShore", -141.3], ["a0", 51], ["a1", 51], ["a2", 51], ["floor", 57.3],
    ["b0", -140], ["b1", 51], ["b2", -31], ["b3", 51], ["b4", -31], ["b5", 51], ["waveEnd", 57.3],
    ["roadShore", -141.3], ["roadShore2", 18],
    ["c0", -140], ["s0", 149.3], ["c1", -84], ["s1", 149.3], ["c2", -84], ["s2", 149.3], ["diveShore", -135.1], ["diveShore2", 18],
    ["d0", -31], ["d2", 60], ["d4", 115], ["d5", 51], ["k1", -26], ["k2", -185], ["gapShore", 57.3],
    ["ka", -11.5], ["redStone", -11.5],
    ["e0", -31], ["e1", 51], ["e2", -31], ["e3", 51], ["marsShore", -53.2], ["marsShore2", 18],
    ["f0", -31], ["f1", 51], ["f2", -31], ["lastStone", 57.3], ["plain", -135.1],
  ])
    y[id] = at = +(at + dy).toFixed(1);
  return y;
})();
const rIsle = jIsle;
/** A cascade tile landed on at sixteenth k and left at once (a bounce):
 * 80 px before the landing to 70 px after it. Bounce tiles sit 5-6 px over
 * the arc's grid height (51 for 6/16 down, -31 for 5/16 up, -84 for 4/16,
 * -140 for a double 8/16), so the touch-down comes a little early and the
 * next jump leaves on the grid. */
const rTile = (id, k, F, y, lead = 80, width = 150) => [id, gk(k, F) - lead, y, width, "cascade"];
/** The first tile drops `after` sixteenths after Diana's touch-down on it
 * (80 px into it): lead in px of nominal run. */
const rLead = (after, lead = 80) => 37.85 * after + lead;
const R_MAIN = [
  ["mars-gate", -700, RY.gate, gk(23) + 10 + 700],
  // Warm-up: jump into the column (23) and again at its top (30); she lands
  // 141 px up on the warm shore (36).
  rIsle("warm-shore", 36, 0, 38, RY.warmShore, 80, undefined, -6),
  // The safe meeting: three tiles step down over the road's floor, 6/16
  // apart; a missed bounce falls onto the floor and nothing is lost.
  rTile("a0", 44, 0, RY.a0),
  rTile("a1", 50, 0, RY.a1),
  rTile("a2", 56, 0, RY.a2),
  ["road-floor", gk(42), RY.floor, gk(76) + 10 - gk(42)],
  // The need: the six-tile wave. Off the floor by a double (76, 80) onto
  // b0 (84), then the bounce, 6 and 5 sixteenths, down 51 and up 31.
  rTile("b0", 84, 0, RY.b0),
  rTile("b1", 90, 0, RY.b1),
  rTile("b2", 95, 0, RY.b2),
  rTile("b3", 101, 0, RY.b3),
  rTile("b4", 106, 0, RY.b4),
  rTile("b5", 112, 0, RY.b5),
  rIsle("wave-end", 118, 0, 120, RY.waveEnd, 70, undefined, -6),
  // Jump into the column (120) and again at its top (127): up onto the
  // road shore (133); a tap down onto the beacon's stone is optional.
  rIsle("road-shore", 133, 0, 133, RY.roadShore, 80, undefined, 10),
  ["road-shore-2", gk(136) - 60, RY.roadShore2, gk(147) + 10 - (gk(136) - 60)],
  // Cascade and dive: off the shore by a double (147, 151) onto c0 (155);
  // each tile's stone is 149 px lower: a jump and a dive at its top land
  // on it 5/16 later, on the beat; a full arc comes down 56 px past its
  // end. Off each stone at once (1/16), a hop climbs 84 px onto the next
  // tile (4/16).
  rTile("c0", 155, 0, RY.c0),
  rIsle("s0", 160, 0, 161, RY.s0, 100, undefined, 30),
  rTile("c1", 165, 0, RY.c1),
  rIsle("s1", 170, 0, 171, RY.s1, 100, undefined, 30),
  rTile("c2", 175, 0, RY.c2),
  rIsle("s2", 180, 0, 181, RY.s2, 100, undefined, 30),
  // A double (181, 185) up onto the dive shore (189).
  rIsle("dive-shore", 189, 0, 197, RY.diveShore, 80),
  ["dive-shore-2", gk(200) - 60, RY.diveShore2, gk(211) + 10 - (gk(200) - 60)],
  // The missing tiles: a hop (211) onto d0 (216); the next tile is gone,
  // so jump (216) and fly (219) over its place onto d2 (226); the next is
  // gone too: jump (226), jump again as the arc falls (230) and fly (232)
  // onto d4 (240), 115 px down. The required gap-song charges that flight:
  // the first flight's line, d2, the jump's top and a star right at the
  // double (complete on 230; a double pressed early rises away under it).
  // The first flight's charge is the beacon's: the only airtime before it
  // is the hop, and a flight spent there falls into the first gap. Then
  // bounce onto d5 (246).
  rTile("d0", 216, 0, RY.d0),
  rTile("d2", 226, 1, RY.d2),
  // A small tile, 40 px before the grid landing and 30 after it: without
  // the double the flight comes down 91 px short, under its lip, and a late
  // double or flight overshoots it (the level's narrowest window).
  rTile("d4", 240, 2, RY.d4, 90, 190),
  rTile("d5", 246, 2, RY.d5),
  // The leaf need (RESEARCH_REFILLS 3): up onto the crack k1 (251), jump
  // (253) and double (256); a lit leaf star at the double's top gives the
  // air jump back, and a third jump (259) climbs 185 px onto the stone k2
  // (264): up, the leaf's job. Down onto the beacon's stone (272).
  rIsle("k1", 251, 2, 253, RY.k1, 55, "crumble", -6),
  rIsle("k2", 264, 2, 266, RY.k2, 80, undefined, -6),
  ["gap-shore", gk(272, 2) - 70, RY.gapShore, gk(283, 2) + 10 - (gk(272, 2) - 70)],
  // Flights kept alive by stars (the owner's brief, 2026-11-10): jump (283)
  // and fly (285) off the gap shore onto a crack (291), whose run gives no
  // breath; the red-song along that flight, the crack's touch-down and its
  // run (complete on 292) gives the cape back for the second flight (295)
  // onto the red stone (301). (The spark-song on the shore's run and the
  // jump's rise refills the first flight whatever was spent before it.)
  rIsle("ka", 291, 3, 293, RY.ka, 60, "crumble", -6),
  rIsle("red-stone", 301, 4, 303, RY.redStone, 70, undefined, -6),
  // The conclusion: a hop (303) onto e0 (308), bounce e1 (314), e2 (319),
  // e3 (325), and from e3 into the column with the cape held: it lifts her;
  // let go (337) over Mars's shore (340); a tap down onto the beacon's stone.
  rTile("e0", 308, 4, RY.e0),
  rTile("e1", 314, 4, RY.e1),
  rTile("e2", 319, 4, RY.e2),
  // (Its tail is 30 px: the wind column starts at its end.)
  rTile("e3", 325, 4, RY.e3, 80, 110),
  rIsle("mars-shore", 340, 4, 341, RY.marsShore, 80, undefined, 10),
  ["mars-shore-2", gk(344, 4) - 60, RY.marsShore2, gk(355, 4) + 10 - (gk(344, 4) - 60)],
  // The confident finish, no glyph: three tiles (360, 366, 371), down onto
  // the last stone (377) and a double (379, 383) up onto Mars's plain (387).
  rTile("f0", 360, 4, RY.f0),
  rTile("f1", 366, 4, RY.f1),
  rTile("f2", 371, 4, RY.f2),
  rIsle("last-stone", 377, 4, 379, RY.lastStone, 55, undefined, -6),
  ["red-plain", gk(387, 4) - 80, RY.plain, gk(400, 4) + 520 - (gk(387, 4) - 80)],
];
const R_HIGH = [
  // The super-jump lock (RESEARCH_PROGRESSION 2.1): a ledge with a star high
  // over Mars's shore that no double and flight reach (VIII's key).
  ["lock-ledge", gk(342, 4) + 40, RY.marsShore - 300, 150],
];
const R_WIND = [
  jCol("warm-wind", 23, 0, RY.gate),
  jBreeze("road-breeze", 65, 0, RY.floor),
  jCol("lift-wind", 120, 0, RY.waveEnd),
  jBreeze("shore-breeze", 137, 0, RY.roadShore2),
  jBreeze("dive-breeze", 201, 0, RY.diveShore2),
  jCol("mars-wind", 325, 4, RY.e3),
  jBreeze("shore-breeze-2", 345, 4, RY.marsShore2),
];
const R_CASCADES = [
  // Lead: the first drop `after` sixteenths after the touch-down on tile 0,
  // always on a beat; then one tile a beat (a, b, d, e, f) or every two
  // beats (c: its stones sit between tiles). A null is a missing tile: its
  // beat passes with no knock.
  { id: "first-road", tiles: ["a0", "a1", "a2"], lead: rLead(12), interval: BEAT },
  { id: "wave", tiles: ["b0", "b1", "b2", "b3", "b4", "b5"], lead: rLead(12), interval: BEAT },
  { id: "dive-road", tiles: ["c0", "c1", "c2"], lead: rLead(13), interval: 2 * BEAT },
  { id: "gap-road", tiles: ["d0", null, "d2", null, "d4", "d5"], lead: rLead(16), interval: BEAT },
  { id: "last-road", tiles: ["e0", "e1", "e2", "e3"], lead: rLead(12), interval: BEAT },
  { id: "home-road", tiles: ["f0", "f1", "f2"], lead: rLead(12), interval: BEAT },
];
const rAt = (y0, dy) => Math.round(y0 + dy - 36);
const rRun = (k, F, y) => [gk(k, F) + 39.5, y - 40];
const rArc = (k, F, y0, dy) => [gk(k, F) + 39.5, rAt(y0, dy)];
const R_CHAINS = [
  // The first road: a star on each touch-down (complete on 62).
  { id: "road-song", route: "low", stars: [rRun(44, 0, RY.a0), rRun(50, 0, RY.a1), rRun(56, 0, RY.a2), rRun(62, 0, RY.floor)] },
  // The wave: one on each tile's touch-down (complete on 112).
  { id: "wave-song", route: "low", stars: [[84, RY.b0], [90, RY.b1], [95, RY.b2], [101, RY.b3], [106, RY.b4], [112, RY.b5]].map(([k, y]) => rRun(k, 0, y)) },
  // Down the dives: each stone and each tile (complete on 180).
  { id: "dive-song", route: "low", stars: [rRun(160, 0, RY.s0), rRun(165, 0, RY.c1), rRun(170, 0, RY.s1), rRun(175, 0, RY.c2), rRun(180, 0, RY.s2)] },
  // Required: the first flight's line (1/16 into it), d2's touch-down,
  // the jump's top and the double's point on the falling arc (complete on
  // 230), two sixteenths before the second flight.
  { id: "gap-song", route: "low", stars: [rArc(218, 0, RY.d0, -75), [gk(219) + 69.69 + 39.5, rAt(RY.d0, -104.6)], [gk(219) + 2 * 69.69 + 39.5, rAt(RY.d0, -104.6)], rArc(228, 1, RY.d2, -75)] },
  // The gap shore's run and the jump's rise (complete on 284),
  // before the first flight of the pair.
  { id: "spark-song", route: "low", stars: [rRun(278, 2, RY.gapShore), rRun(280, 2, RY.gapShore), rRun(282, 2, RY.gapShore), rArc(284, 2, RY.gapShore, -64.7)] },
  // Home: the last tiles, the stone and the double's rise (complete on 382).
  { id: "home-song", route: "low", stars: [rRun(366, 4, RY.f1), rRun(371, 4, RY.f2), rRun(377, 4, RY.lastStone), rArc(382, 4, RY.lastStone, -135.2)] },
];
const R_GREAT = [
  { id: "great-1", x: gk(184) + 63.67, y: RY.c2 - 191 - 36, line: "off the falling road's end: a double and a flight instead of the dive" },
  { id: "great-2", x: gk(224) + 63.67, y: RY.d0 - 191 - 36, line: "over the missing tile: jump again in the flight" },
  // The held cape's own rise peaks 72 px under it (and 51 px before it).
  { id: "great-3", x: gk(331, 4) + 93, y: RY.e3 - 414, line: "the top of Mars's wind: jump again as it lets you go" },
];
const R_STARS = [
  ...[[387, 4], [390, 4], [393, 4]].map(([k, F], i) => [`run-star-${i}`, gk(k + 4, F) + 33.5, RY.plain - 40, "low"]),
  // Over each land-and-go hop, on its rise.
  ...[[38, 0, RY.warmShore], [120, 0, RY.waveEnd], [161, 0, RY.s0], [171, 0, RY.s1], [181, 0, RY.s2], [266, 2, RY.k2], [293, 3, RY.ka], [303, 4, RY.redStone], [379, 4, RY.lastStone]].map(([k, F, y], i) => [`hop-star-${i}`, gk(k + 1, F) + 33.5, rAt(y, -64.7), "low"]),
  // At the top of each beacon breeze's lift.
  ...[[65, 0, RY.floor], [137, 0, RY.roadShore2], [201, 0, RY.diveShore2], [345, 4, RY.marsShore2]].map(([k, F, y], i) => [`breeze-star-${i}`, gk(k + 4, F) + 33.5, rAt(y, -167.8), "low"]),
  // At the top of each bounce between tiles (a loose star: 1/8 of breath).
  ...[[44, 0, RY.a0], [50, 0, RY.a1], [84, 0, RY.b0], [90, 0, RY.b1], [95, 0, RY.b2], [101, 0, RY.b3], [106, 0, RY.b4], [308, 4, RY.e0], [314, 4, RY.e1], [319, 4, RY.e2], [360, 4, RY.f0], [366, 4, RY.f1], [371, 4, RY.f2]].map(([k, F, y], i) => [`bounce-star-${i}`, gk(k + 3, F) + 33.5, rAt(y, -104.3), "low"]),
  // Along the first flight of the pair and on its crack (loose: an eighth
  // of breath each, so the bar shows half when the cape star is reached).
  ...[[gk(287, 2) + 63.67, rAt(RY.gapShore, -100)], [gk(289, 3), rAt(RY.gapShore, -97)], [gk(291, 3), RY.ka - 40], [gk(292, 3), RY.ka - 40]].map(([x, y], i) => [`red-star-${i}`, x + 33.5, y, "low"]),
  // Along the second flight of the pair (loose: an eighth of breath each).
  ...[297, 299].map((k, i) => [`flight-star-${i}`, gk(k, 3) + (k === 297 ? 63.67 : 113.55) + 33.5, rAt(RY.ka, k === 297 ? -100 : -97), "low"]),
  // On the rise of each hop onto a road's first tile.
  ...[[211, 0, RY.diveShore2], [303, 4, RY.redStone], [355, 4, RY.marsShore2]].map(([k, F, y], i) => [`road-star-${i}`, gk(k + 2, F) + 33.5, rAt(y, -99.3), "low"]),
];
const RJ = (k, F, when = "g") => [gk(k, F) - 0.3, "jump", when];
const RT = (k, F) => [gk(k, F) - 0.3, "tap", "g"];
const RD = (k, F) => [gk(k, F) - 0.3, "dash", "a"];
const RV = (k, F) => [gk(k, F) - 0.3, "dive", "a"];
const RG = (k, F) => [gk(k, F) + 30, "glide", "*"];
const RU = (k, F, when = "a") => [gk(k, F) - 0.3, "unglide", when];
const R_PLAN_MAIN = [
  RJ(23, 0), RJ(30, 0, "a"),
  RJ(38, 0), RJ(44, 0), RJ(50, 0), RJ(56, 0),
  RJ(65, 0),
  RJ(76, 0), RJ(80, 0, "a"), RJ(84, 0), RJ(90, 0), RJ(95, 0), RJ(101, 0), RJ(106, 0), RJ(112, 0),
  RJ(120, 0), RJ(127, 0, "a"),
  RJ(137, 0),
  RJ(147, 0), RJ(151, 0, "a"), RJ(155, 0), RV(158, 0), RJ(161, 0), RJ(165, 0), RV(168, 0), RJ(171, 0), RJ(175, 0), RV(178, 0), RJ(181, 0), RJ(185, 0, "a"),
  RT(197, 0), RJ(201, 0),
  RJ(211, 0), RJ(216, 0), RD(219, 0), RJ(226, 1), RJ(230, 1, "a"), RD(232, 1), RJ(240, 2), RJ(246, 2), RJ(253, 2), RJ(256, 2, "a"), RJ(259, 2, "a"), RJ(266, 2),
  RJ(283, 2), RD(285, 2), RJ(293, 3), RD(295, 3),
  RJ(303, 4), RJ(308, 4), RJ(314, 4), RJ(319, 4), RJ(325, 4), RG(325, 4), RU(337, 4),
  RT(341, 4), RJ(345, 4),
  RJ(355, 4), RJ(360, 4), RJ(366, 4), RJ(371, 4), RJ(379, 4), RJ(383, 4, "a"),
];
const FALLING_ROAD = {
  key: "falling-road",
  title: "The Falling Road",
  look: "mars",
  toward: "Mars",
  introduces: "cascade",
  bpm: 123,
  clock: R_CLOCK,
  physics: { crumbleAfter: 5 * J_SIX },
  verbs: { double: true, cape: true, glide: true, dive: true, super: false },
  gets: [],
  capeRule: "breath",
  view: { minWidth: 1010, portraitMinWidth: 810 },
  level: { title: "The Falling Road", speed: 270, startX: 220, startY: RY.gate, finishX: gk(400, 4), finishY: RY.plain, beat: BEAT },
  movements: [{ id: "VII", x: -1000, numeral: "VII", name: "The Falling Road" }],
  sections: [
    { x: -1000, movement: "VII", step: "warm", name: "VII · The Falling Road" },
    { x: gk(38), movement: "VII", step: "safe", name: "VII · The Falling Road — the first road" },
    { x: gk(64), movement: "VII", step: "need", name: "VII · The Falling Road — the wave" },
    { x: gk(136), movement: "VII", step: "develop", name: "VII · The Falling Road — cascade and dive" },
    { x: gk(200), movement: "VII", step: "twist", name: "VII · The Falling Road — the missing tiles" },
    { x: gk(272, 2), movement: "VII", step: "conclude", name: "VII · The Falling Road — flights on starlight" },
    { x: gk(301, 4), movement: "VII", step: "conclude", name: "VII · The Falling Road — Mars's wind" },
    { x: gk(344, 4), movement: "VII", step: "conclude", name: "VII · The Falling Road — the road home" },
    { x: gk(387, 4), movement: "VII", step: "coda", name: "VII · The Falling Road — Mars" },
  ],
  // Beacons on half bars 5, 9½, 13½, 18 and 22½ (at most 9.5 s real apart),
  // each lit by the landing on or before its own beat.
  checkpoints: [
    { id: "road", x: gk(64) - 3, y: RY.floor, platform: "road-floor", story: "Behind her the road fell away, stone by stone, keeping time.", tip: "Bounce as soon as you land: the road falls on the beat." },
    { id: "wave", x: gk(136) - 3, y: RY.roadShore2, platform: "road-shore-2", story: "Mars hung red ahead, and the road was falling toward it.", tip: "Jump on each tile, dive at the top onto the stone below, hop up again." },
    { id: "dive", x: gk(200) - 3, y: RY.diveShore2, platform: "dive-shore-2", story: "Two stones of the road had never been laid. She would have to fly those beats.", tip: "Jump on the tile and press the cape over the gap; take the stars to fly again." },
    { id: "gap", x: gk(272, 2) - 3, y: RY.gapShore, platform: "gap-shore", story: "Every star she caught gave the cape a little more of the sky.", tip: "Fly off the shore, take the stars along the flight, and fly again from the crack." },
    { id: "mars", x: gk(344, 4) - 3, y: RY.marsShore2, platform: "mars-shore-2", story: "The dust of Mars rose to meet her in a warm wind, and the road ran home along it.", tip: "Bounce on the beat, then jump twice up onto the plain." },
  ],
  startTip: "Bounce as soon as you land: the road falls on the beat.",
  main: R_MAIN,
  high: R_HIGH,
  updrafts: R_WIND,
  cascades: R_CASCADES,
  chains: R_CHAINS,
  great: R_GREAT,
  // RESEARCH_REFILLS 3: the leaf need over the second missing tile's climb
  // (at the double's top) and the cape need of the pair (on the crack's
  // jump, the bar spent by the first flight).
  refills: [
    { id: "leaf-k1", kind: "leaf", x: gk(259, 2), y: RY.k1 - 145 - 36, required: true },
    { id: "cape-ka", kind: "cape", x: gk(295, 3), y: RY.ka - 99.3 - 36, required: true },
  ],
  moments: [],
  // The super-jump lock: a star on the high ledge over Mars's shore (drawn,
  // never collected; VIII's super jump reaches its like).
  decor: [{ id: "super-lock", kind: "cluster", stars: [[gk(322, 2) + 115, RY.marsShore - 300 - 40]] }],
  prompts: [
    { id: "p-road", glyph: ["up"], action: "jump", x: gk(84), y: RY.b0 - 120, from: gk(82), to: gk(86), inputX: gk(84) + 8 },
    { id: "p-dive", glyph: ["down"], action: "dive", x: gk(158) + 80, y: RY.c0 - 120, from: gk(157), to: gk(159) - 10, inputX: gk(158) + 30 },
    { id: "p-gap", glyph: ["up", "then", "right"], action: "dash", x: gk(218) - 20, y: RY.d0 - 210, from: gk(216) - 20, to: gk(221), inputX: gk(216) + 50 },
    { id: "p-mars", glyph: ["up", "then", "hold-right"], action: "glide", x: gk(325, 4), y: RY.e3 - 310, from: gk(324, 4), to: gk(337, 4), inputX: gk(325, 4) + 40 },
  ],
  stars: R_STARS,
  routes: {
    main: R_PLAN_MAIN,
    // Great Stars 1, 2 and 3: off the dive road's last tile a double and a
    // flight (177, 180, 182) instead of the dive, onto the dive shore; over
    // the first missing tile a jump in the flight (221, the double: it ends
    // the flight, which still lands on d2); in Mars's wind a jump at its top
    // (311), then the cape held out of it.
    // (GS1's flight is one more than the main route's: the upper route is
    // 3/16 ahead of the grid after it, the same arcs at the same stones.)
    upper: [
      ...R_PLAN_MAIN.filter(([x]) => x < gk(174)),
      RJ(175, 0), RJ(178, 0, "a"), RD(180, 0),
      ...[
        ...R_PLAN_MAIN.filter(([x]) => x > gk(186) && x < gk(220)),
        [gk(221) + 63.67 - 0.3, "jump", "a"],
        ...R_PLAN_MAIN.filter(([x]) => x > gk(222) && x < gk(326, 4)),
        RJ(331, 4, "a"),
        ...R_PLAN_MAIN.filter(([x]) => x > gk(326, 4)),
      ],
    ],
    // No breeze hops and no tap down: the beacons' runs walked.
    ability: R_PLAN_MAIN.filter(([x]) => ![[65, 0], [137, 0], [201, 0], [345, 4], [197, 0], [341, 4]].some(([k, F]) => Math.abs(x - gk(k, F) + 0.3) < 1)),
    safe: R_PLAN_MAIN,
  },
};
/* ---- VIII · The Far Door (128 BPM, toward the Moon, then Earth): tense but fair ----
 * RESEARCH_PROGRESSION 4.5 VIII and RESEARCH_REFILLS 3: the super jump (a
 * jump during a flight, once per flight) is the GET, the rising star at
 * sixteenth 24, right after the title card. Then revision six's super-jump
 * school and storm void at the same sixteenths, and new content built on
 * everything: a super out of a wind column's top, a super off a cascade's
 * last tile, the gauntlet (a cracked launch and a super across its void, a
 * dive stair), the required star road over a stable low line, the rising
 * stair, a super onto the summit, a dive stair down and a short last road
 * to Earth's door. Shared physics (V-VII's cells hold); clock 1.196.
 * Units: a grid x is ex(k, s, f) = 220 + 37.85 k + 63.67 s + 113.55 f (k
 * sixteenths, s super jumps opened 2/16 into a flight, f full flights).
 * Cells (scratch probe on the real model, dy at n/16 after a ground jump,
 * up < 0): super (jump, cape 2, jump 4) 9: -233.8, 10: -173, 11: -82.7,
 * 12: +37.1; jump into a column, cape 6, jump 8: 16: -94.2; the star road
 * (jump, cape 2, a cape star, jump 4, a leaf star, jump 10, cape 13, a cape
 * star, cape 17) 23: -163.8 and +290.77 px; V-VII's hop, tap, double and
 * jump-and-dive cells. Heights follow the main route's landings (EY). */
const E_CLOCK = 128 / 107;
const E_SIX = 15 / 107;
/** A super jump opened 2/16 into a flight keeps 2/16 of its extra run. */
const SUP = 64.34;
/** Grid x on sixteenth k after s super jumps and f full flights. */
const ex = (k, s = 0, f = 0) => 220 + 37.85 * k + SUP * s + 113.55 * f;
const EY = (() => {
  const y = {};
  let at = 0;
  for (const [id, dy] of [
    ["floor", 560], ["school", -233], ["school2", 18], ["step", 149.3], ["stepB", 18], ["step2", 18], ["high", -233], ["windGate", 16.1], ["windShore", -94.2], ["windShore2", 18], ["windShore3", 18],
    ["t0", -84], ["t1", 51], ["t2", -31], ["t3", 51], ["t4", -31], ["cascShore", -82.7], ["cascShore2", 18],
    ["crack", -31], ["gShore", 37.1], ["s1", 149.3], ["s2", 149.3], ["roadShore", -135.1], ["gate", 18],
    ["far", -199], ["far2", 149.3], ["stair1", -135.1], ["stair2", -135.1], ["summit", 37.1], ["summit2", 18],
    ["d1", 149.3], ["d2", 149.3], ["f0", -31], ["f1", 51], ["f2", -31], ["f3", 51], ["f4", -31], ["lastStone", 57.3], ["plain", -135.1],
  ])
    y[id] = at = +(at + dy).toFixed(1);
  // The low line under the star road: a tap down off the gate, a hop up and
  // a double up onto the far shore (only jumps; never 240 px under the road).
  y.lowFloor = +(y.gate + 6).toFixed(1);
  y.lowStep = +(y.lowFloor - 84).toFixed(1);
  return y;
})();
/** Super jumps and full flights before each stretch of the main route. */
const SF = { start: [0, 0], school: [1, 0], storm: [2, 0], wind: [3, 0], casc: [4, 0], launch: [5, 0], road: [6, 0], far: [6, 2], summit: [7, 2] };
const eIsle = (id, landK, takeoffK, y, [s, f], lead = 80, type, edge = 10) => {
  const a = ex(landK, s, f) - lead;
  const q = [id, a, y, ex(takeoffK, s, f) + edge - a];
  return type ? [...q, type] : q;
};
/** A cascade tile landed on at sixteenth k and left at once (VII's rTile). */
const eTile = (id, k, [s, f], y, lead = 80, width = 150) => [id, ex(k, s, f) - lead, y, width, "cascade"];
const eCol = (id, k, [s, f], y) => ({ id, x: ex(k, s, f) + 30, width: 180, top: y - 307, bottom: y + 253 });
/** A beacon's breeze: 160 px wide and 203 px tall (VI's are 200), so a hop
 * into it lands on its stone 9/16 later at 60, 120 and 240 Hz (8.91 at 200). */
const eBreeze = (id, k, [s, f], y) => ({ id, x: ex(k, s, f) + 30, width: 160, top: y - 203, bottom: y, gentle: true });
const eAt = (y0, dy) => Math.round(y0 + dy - 36);
const eRun = (k, [s, f], y) => [ex(k, s, f) + 39.5, y - 40];
const eArc = (k, [s, f], y0, dy) => [ex(k, s, f) + 39.5, eAt(y0, dy)];
const EJ = (k, [s, f], when = "g") => [ex(k, s, f) - 0.3, "jump", when];
const ET = (k, [s, f]) => [ex(k, s, f) - 0.3, "tap", "g"];
const ED = (k, [s, f]) => [ex(k, s, f) - 0.3, "dash", "a"];
const EV = (k, [s, f]) => [ex(k, s, f) - 0.3, "dive", "a"];
/** A hop into a beacon's breeze (optional; it lands on the beat 9/16 later). */
const EB = (k, [s, f]) => [ex(k, s, f) - 0.3, "jump", "g"];
/** Jump on the grid, open the cape 2/16 later and jump again 2/16 into the flight. */
const eSuper = (k, [s, f]) => [EJ(k, [s, f]), ED(k + 2, [s, f]), EJ(k + 4, [s + 1, f], "a")];
/** The star road from the gate (sixteenth 236): jump, cape (238), a cape
 * star, the super jump (240), a leaf star at its top, the double (245),
 * cape (249), a cape star, cape (253); down on the far shore on 259. */
const ROAD_K = 236;
// (The second flight is pressed 1.6 px early: the 60 Hz pilot, a sample
// late, otherwise opened it 36 ms after the grid.)
const eRoad = () => [EJ(ROAD_K, SF.launch), ED(ROAD_K + 2, SF.launch), EJ(ROAD_K + 4, SF.road, "a"), EJ(ROAD_K + 9, SF.road, "a"), [ex(ROAD_K + 13, ...SF.road) - 1.9, "dash", "a"], ED(ROAD_K + 17, [6, 1])];
const E_MAIN = [
  // The wake and the school: the floor runs under the school shore and ends
  // 150 px before the step, so a missed super is only a jump up onto it.
  ["moon-floor", -700, EY.floor, ex(44, 1) - 150 + 700],
  // A tap down (38) onto the school's second stone; a jump and a dive at
  // its top (43, 46) land 149 px down on the step (48); taps down (48, 53)
  // onto the storm beacon's stone (56). (The second stone runs 40 px past
  // its takeoff, so Great Star 1 is seen from it.)
  eIsle("school-shore", 37, 38, EY.school, SF.school, 60),
  eIsle("school-shore-2", 41, 43, EY.school2, SF.school, 60, undefined, 40),
  eIsle("storm-step", 48, 48, EY.step, SF.school, 70, undefined, 30),
  eIsle("storm-step-b", 51, 53, EY.stepB, SF.school, 60),
  ["storm-step-2", ex(56, 1) - 60, EY.step2, ex(68, 1) + 10 - (ex(56, 1) - 60)],
  // The need: across the storm void, a super jump onto a shore 233 px up
  // (9/16 after the takeoff). (Its lip reaches 160 px back: a super opened
  // late in the arc, as the glyph reads, flies shorter.)
  ["storm-high", ex(77, 2) - 160, EY.high, ex(79, 2) - 6 - (ex(77, 2) - 160)],
  // Develop: land and go, a double (79, 83) down onto the wind gate (89);
  // jump into the column (92), the rise-song on its rise, the cape at its
  // top (98) and the super jump (100): down on the wind shore (108).
  eIsle("wind-gate", 89, 92, EY.windGate, SF.storm, 80),
  eIsle("wind-shore", 108, 109, EY.windShore, SF.wind, 150),
  ["wind-shore-2", ex(112, 3) - 60, EY.windShore2, ex(123, 3) + 10 - (ex(112, 3) - 60)],
  eIsle("wind-shore-3", 126, 128, EY.windShore3, SF.wind, 60, undefined, 30),
  // Develop: a tap (123) onto the wind shore's third stone and a hop (128)
  // 84 px up onto the cascade, bounces of 6 and 5 sixteenths (down 51, up
  // 31), and a super jump off its last tile (154, 156, 158) onto the
  // cascade shore (165), 83 px up, a tap down onto the launch beacon's
  // stone; the cascade-song on the bounces, complete on the last tile,
  // gives the cape back for it.
  eTile("t0", 132, SF.wind, EY.t0),
  eTile("t1", 138, SF.wind, EY.t1),
  eTile("t2", 143, SF.wind, EY.t2),
  eTile("t3", 149, SF.wind, EY.t3),
  eTile("t4", 154, SF.wind, EY.t4),
  eIsle("cascade-shore", 165, 165, EY.cascShore, SF.casc, 50, undefined, 30),
  ["cascade-shore-2", ex(168, 4) - 60, EY.cascShore2, ex(180, 4) + 10 - (ex(168, 4) - 60)],
  // The gauntlet: a hop (180) onto the launch crack (185); jump (187), cape
  // and super jump across the long void (12/16, 37 px down) onto the
  // gauntlet shore (199); the launch-song on the crack and the jump's rise.
  eIsle("launch-crack", 185, 187, EY.crack, SF.casc, 90, "crumble", -6),
  eIsle("gauntlet-shore", 199, 201, EY.gShore, SF.launch, 80, undefined, -6),
  // The dive stair: a jump and a dive at its top (201/204, 207/210) land
  // 149 px down 5/16 later, on stable stones (a dive smashes cracks); a
  // double (213, 217) up onto the road shore (221), a tap onto the gate.
  eIsle("g-stone-1", 206, 207, EY.s1, SF.launch, 100, undefined, -6),
  eIsle("g-stone-2", 212, 213, EY.s2, SF.launch, 100, undefined, -6),
  eIsle("road-shore", 221, 221, EY.roadShore, SF.launch, 80, undefined, 30),
  ["road-gate", ex(224, 5) - 60, EY.gate, ex(ROAD_K, 5) + 10 - (ex(224, 5) - 60)],
  // The far shore starts where the road lands (259, 2 px high).
  ["far-shore", ex(259, ...SF.far) - 80, EY.far, ex(261, ...SF.far) + 60 - (ex(259, ...SF.far) - 80)],
  // A jump and a dive (261, 264) down onto the summit beacon's stone (266).
  ["far-shore-2", ex(266, ...SF.far) - 55, EY.far2, ex(284, ...SF.far) + 10 - (ex(266, ...SF.far) - 55)],
  // The rising stair: two doubles (284/288, 296/300), 135 px up each,
  // along the stair-song; then a super jump (308) across onto the summit
  // (12/16, 37 px down), charged by the summit-song on the second step.
  eIsle("stair-1", 292, 296, EY.stair1, SF.far, 100),
  eIsle("stair-2", 304, 308, EY.stair2, SF.far, 100),
  // Down from the summit: a tap (320) onto its second stone, then a jump and
  // a dive (325/328, 331/334) onto two stones; the home beacon on the second.
  eIsle("summit", 320, 320, EY.summit, SF.summit, 80, undefined, 30),
  eIsle("summit-2", 323, 325, EY.summit2, SF.summit, 60, undefined, 40),
  eIsle("d-stone-1", 330, 331, EY.d1, SF.summit, 100, undefined, -6),
  ["d-stone-2", ex(336, ...SF.summit) - 130, EY.d2, ex(347, ...SF.summit) + 10 - (ex(336, ...SF.summit) - 130)],
  // The last road: five tiles (352 ... 374), down onto the last stone (380)
  // and a double (380, 384) up onto Earth's plain (388).
  eTile("f0", 352, SF.summit, EY.f0),
  eTile("f1", 358, SF.summit, EY.f1),
  eTile("f2", 363, SF.summit, EY.f2),
  eTile("f3", 369, SF.summit, EY.f3),
  eTile("f4", 374, SF.summit, EY.f4),
  eIsle("last-stone", 380, 380, EY.lastStone, SF.summit, 100, undefined, 40),
  ["earth-plain", ex(388, ...SF.summit) - 80, EY.plain, ex(400, ...SF.summit) + 520 - (ex(388, ...SF.summit) - 80)],
];
/** The road's takeoff (X0) and its landing on the far shore (X0 + 1161). */
const ROAD_X0 = ex(ROAD_K, 5);
const E_HIGH = [
  // The low line under the star road: off the gate by a tap (236) down
  // onto the low floor, a hop (410 px on) 84 px up onto the low step and a
  // double from its far end (881 px on) 121 px up onto the far shore. The step reaches under the
  // far shore's lip and the floor under the step's, so a miss anywhere on
  // the road lands on one of them, never in the void.
  ["low-floor", ROAD_X0 + 60, EY.lowFloor, 520],
  ["low-step", ROAD_X0 + 520, EY.lowStep, 580],
];
const E_WIND = [
  eCol("rise-wind", 92, SF.storm, EY.windGate),
  eBreeze("wind-breeze", 113, SF.wind, EY.windShore2),
  eBreeze("launch-breeze", 169, SF.casc, EY.cascShore2),
  eBreeze("summit-breeze", 273, SF.far, EY.far2),
  eBreeze("home-breeze", 337, SF.summit, EY.d2),
  eBreeze("earth-breeze", 389, SF.summit, EY.plain),
];
const E_CASCADES = [
  { id: "storm-road", tiles: ["t0", "t1", "t2", "t3", "t4"], lead: 37.85 * 12 + 80, interval: BEAT },
  { id: "last-road", tiles: ["f0", "f1", "f2", "f3", "f4"], lead: 37.85 * 12 + 80, interval: BEAT },
];
const E_CHAINS = [
  // Along the school's super jump (complete on 36, before its landing): the
  // stable school shore does not breathe a whole bar, so this song is what
  // gives the cape back for Great Star 1's second super jump.
  { id: "school-song", route: "low", stars: [eArc(30, SF.start, EY.floor, -99.1), eArc(33, SF.school, EY.floor, -182.3), eArc(35, SF.school, EY.floor, -267), eArc(36, SF.school, EY.floor, -265)] },
  // Required: the column's rise (complete on 96) gives the cape back for
  // the flight out of its top (98).
  { id: "rise-song", route: "low", stars: [eRun(90, SF.storm, EY.windGate), eRun(91, SF.storm, EY.windGate), eArc(93, SF.storm, EY.windGate, -64), eArc(94, SF.storm, EY.windGate, -100)] },
  // Required: the bounces (complete on the last tile, 150), so a flight
  // spent between the tiles is given back before the super jump.
  { id: "cascade-song", route: "low", stars: [eRun(138, SF.wind, EY.t1), eRun(143, SF.wind, EY.t2), eRun(149, SF.wind, EY.t3), eRun(154, SF.wind, EY.t4)] },
  // Required: the crack and the launch's rise (complete on 188).
  { id: "launch-song", route: "low", stars: [eRun(178, SF.casc, EY.cascShore2), eRun(185, SF.casc, EY.crack), eRun(186, SF.casc, EY.crack), eArc(188, SF.casc, EY.crack, -64.3)] },
  // The climax phrase along the star road (complete on its landing).
  { id: "road-song", route: "low", stars: [[ex(ROAD_K + 6, ...SF.road) + 39.5, eAt(EY.gate, -239)], [ex(ROAD_K + 12, ...SF.road) + 39.5, eAt(EY.gate, -318)], [ex(ROAD_K + 19, 6, 1) + 63.67 + 39.5, eAt(EY.gate, -286)], [ex(ROAD_K + 22, ...SF.far) + 39.5, eAt(EY.gate, -255)], eRun(ROAD_K + 24, SF.far, EY.far)] },
  // The rising stair (the stair-song), complete on the second step.
  { id: "stair-song", route: "low", stars: [eArc(286, SF.far, EY.far2, -99), eArc(290, SF.far, EY.far2, -165), eRun(292, SF.far, EY.stair1), eArc(298, SF.far, EY.stair1, -99), eArc(300, SF.far, EY.stair1, -80)] },
  // Required: the second double's fall and the second step's run (complete
  // on 308, the super jump's takeoff), so a flight spent on the stair is
  // given back before it.
  { id: "summit-song", route: "low", stars: [eArc(302, SF.far, EY.stair1, -165), eRun(304, SF.far, EY.stair2), eRun(306, SF.far, EY.stair2), eRun(308, SF.far, EY.stair2)] },
  // Home: the last tiles and the double up onto Earth's plain.
  { id: "home-song", route: "low", stars: [eRun(363, SF.summit, EY.f2), eRun(369, SF.summit, EY.f3), eRun(374, SF.summit, EY.f4), eRun(380, SF.summit, EY.lastStone), eArc(386, SF.summit, EY.lastStone, -164)] },
];
const E_GREAT = [
  // A second super jump from the school shore (stable: the cape is back).
  { id: "great-1", x: ex(50, 2), y: EY.school2 - 267 - 46, line: "high above the school: a second super jump" },
  // A super jump in the road's second flight, right after its cape star.
  { id: "great-2", x: ex(ROAD_K + 18.4, 7, 0), y: EY.gate - 289 - 173 - 36 + 38, line: "high over the star road: a super jump in its second flight" },
  // A super jump off the last road's last tile, onto Earth's plain.
  { id: "great-3", x: ex(381, 8, 2), y: EY.f4 - 267 - 46, line: "over the last tile: a flight and a super jump" },
];
const E_STARS = [
  ...[[388, SF.summit], [391, SF.summit], [394, SF.summit]].map(([k, sf], i) => [`run-star-${i}`, ex(k + 4, ...sf) + 33.5, EY.plain - 40, "low"]),
  // Over each land-and-go hop, on its rise.
  ...[[79, SF.storm, EY.high], [207, SF.launch, EY.s1], [213, SF.launch, EY.s2], [261, SF.far, EY.far], [331, SF.summit, EY.d1]].map(([k, sf, y], i) => [`hop-star-${i}`, ex(k + 1, ...sf) + 33.5, eAt(y, -64.7), "low"]),
  // At the top of each beacon breeze's lift.
  ...[[113, SF.wind, EY.windShore2], [169, SF.casc, EY.cascShore2], [273, SF.far, EY.far2], [337, SF.summit, EY.d2], [389, SF.summit, EY.plain]].map(([k, sf, y], i) => [`breeze-star-${i}`, ex(k + 4, ...sf) + 33.5, eAt(y, -167.8), "low"]),
  // At the top of each bounce between tiles.
  ...[[132, SF.wind, EY.t0], [352, SF.summit, EY.f0], [358, SF.summit, EY.f1]].map(([k, sf, y], i) => [`bounce-star-${i}`, ex(k + 3, ...sf) + 33.5, eAt(y, -104.3), "low"]),
  // At the apex of the storm void's and the falling road's super jumps.
  ...[[75, SF.storm, EY.step2], [161, SF.casc, EY.t4]].map(([k, sf, y], i) => [`super-star-${i}`, ex(k, ...sf) + 33.5, eAt(y, -267), "low"]),
  // On each tap down's rise (her own notes, not the bed's).
  ...[[38, SF.school, EY.school], [48, SF.school, EY.step], [53, SF.school, EY.stepB], [109, SF.wind, EY.windShore], [123, SF.wind, EY.windShore2], [165, SF.casc, EY.cascShore], [221, SF.launch, EY.roadShore], [320, SF.summit, EY.summit]].map(([k, sf, y], i) => [`tap-star-${i}`, ex(k + 1, ...sf) + 33.5, eAt(y, -24), "low"]),
  // On each jump-and-dive's rise, before the dive.
  ...[[43, SF.school, EY.school2], [201, SF.launch, EY.gShore], [207, SF.launch, EY.s1], [261, SF.far, EY.far], [325, SF.summit, EY.summit2], [331, SF.summit, EY.d1]].map(([k, sf, y], i) => [`dive-star-${i}`, ex(k + 2, ...sf) + 33.5, eAt(y, -99), "low"]),
  // At the top of the land-and-go doubles.
  ...[[79, SF.storm, EY.high], [213, SF.launch, EY.s2]].map(([k, sf, y], i) => [`double-star-${i}`, ex(k + 6, ...sf) + 33.5, eAt(y, -164), "low"]),
  // At the top of the bounces on both falling roads.
  ...[[138, SF.wind, EY.t1], [143, SF.wind, EY.t2], [149, SF.wind, EY.t3], [363, SF.summit, EY.f2], [369, SF.summit, EY.f3], [374, SF.summit, EY.f4]].map(([k, sf, y], i) => [`tile-star-${i}`, ex(k + 3, ...sf) + 33.5, eAt(y, -104.3), "low"]),
];
const E_PLAN_MAIN = [
  ...eSuper(28, SF.start), ET(38, SF.school), EJ(43, SF.school), EV(46, SF.school), ET(48, SF.school), ET(53, SF.school),
  ...eSuper(68, SF.school),
  EJ(79, SF.storm), EJ(83, SF.storm, "a"),
  EJ(92, SF.storm), ED(98, SF.storm), EJ(100, SF.wind, "a"),
  ET(109, SF.wind), EB(113, SF.wind),
  ET(123, SF.wind), EJ(128, SF.wind), EJ(132, SF.wind), EJ(138, SF.wind), EJ(143, SF.wind), EJ(149, SF.wind), ...eSuper(154, SF.wind),
  ET(165, SF.casc), EB(169, SF.casc),
  EJ(180, SF.casc), ...eSuper(187, SF.casc),
  EJ(201, SF.launch), EV(204, SF.launch), EJ(207, SF.launch), EV(210, SF.launch), EJ(213, SF.launch), EJ(217, SF.launch, "a"), ET(221, SF.launch),
  ...eRoad(),
  EJ(261, SF.far), EV(264, SF.far), EB(273, SF.far),
  EJ(284, SF.far), EJ(288, SF.far, "a"), EJ(296, SF.far), EJ(300, SF.far, "a"),
  ...eSuper(308, SF.far),
  ET(320, SF.summit), EJ(325, SF.summit), EV(328, SF.summit), EJ(331, SF.summit), EV(334, SF.summit),
  [ex(337, ...SF.summit) + 1.2, "jump", "g"],
  EJ(347, SF.summit), EJ(352, SF.summit), EJ(358, SF.summit), [ex(363, ...SF.summit) + 0.7, "jump", "g"], EJ(369, SF.summit), EJ(374, SF.summit), EJ(380, SF.summit), EJ(384, SF.summit, "a"), [ex(389, ...SF.summit) + 2.5, "jump", "g"],
];
const FAR_DOOR = {
  key: "door",
  title: "The Far Door",
  look: "moon-earth",
  toward: "the Moon, then Earth",
  introduces: "super",
  bpm: 128,
  clock: E_CLOCK,
  physics: { crumbleAfter: 5 * E_SIX },
  verbs: { double: true, cape: true, glide: true, dive: true, super: false },
  gets: [{ id: "rising-star", verb: "super", x: ex(24) }],
  capeRule: "breath",
  view: { minWidth: 1050, portraitMinWidth: 840 },
  level: { title: "The Far Door", speed: 270, startX: 220, startY: EY.floor, finishX: ex(400, ...SF.summit), finishY: EY.plain, beat: BEAT, earth: true },
  movements: [{ id: "VIII", x: -1000, numeral: "VIII", name: "The Far Door" }],
  sections: [
    { x: -1000, movement: "VIII", step: "warm", name: "VIII · The Far Door" },
    { x: ex(24), movement: "VIII", step: "safe", name: "VIII · The Far Door — the rising star" },
    { x: ex(56, 1), movement: "VIII", step: "need", name: "VIII · The Far Door — the storm void" },
    { x: ex(79, 2), movement: "VIII", step: "develop", name: "VIII · The Far Door — out of the wind" },
    { x: ex(112, 3), movement: "VIII", step: "develop", name: "VIII · The Far Door — off the falling road" },
    { x: ex(168, 4), movement: "VIII", step: "twist", name: "VIII · The Far Door — the gauntlet" },
    { x: ex(224, 5), movement: "VIII", step: "twist", name: "VIII · The Far Door — the star road" },
    { x: ex(272, ...SF.far), movement: "VIII", step: "conclude", name: "VIII · The Far Door — the rising stair" },
    { x: ex(336, ...SF.summit), movement: "VIII", step: "conclude", name: "VIII · The Far Door — the last road" },
    { x: ex(388, ...SF.summit), movement: "VIII", step: "coda", name: "VIII · The Far Door — Earth" },
  ],
  // Beacons on half bars 3½, 7, 10½, 14, 17 and 21 (at most 9.5 s real
  // apart), each lit by a landing on or before its own beat.
  checkpoints: [
    { id: "storm", x: ex(56, 1) - 3, y: EY.step2, platform: "storm-step-2", story: "The Moon was near enough now to cast her shadow ahead of her.", tip: "Jump, press the cape, then jump again during the flight." },
    { id: "wind", x: ex(112, 3) - 3, y: EY.windShore2, platform: "wind-shore-2", story: "Out of the Moon's thin wind she rose higher than any star she had caught.", tip: "Bounce on the beat, then super jump off the last stone of the road." },
    { id: "launch", x: ex(168, 4) - 3, y: EY.cascShore2, platform: "cascade-shore-2", story: "Below her the old road ran on in the dark, the way she had come.", tip: "Jump from the crack and super jump across; jump and dive down the stones." },
    { id: "road", x: ex(224, 5) - 3, y: EY.gate, platform: "road-gate", story: "Every star of the road was lit for her, and she did not touch the ground.", tip: "Fly, take the star, super jump, take the leaf, jump, fly and fly again." },
    { id: "summit", x: ex(272, ...SF.far) - 3, y: EY.far2, platform: "far-shore-2", story: "The blue world filled half the sky, close enough to hear its oceans.", tip: "Jump twice up each step, then super jump to the summit." },
    { id: "home", x: ex(336, ...SF.summit) - 1.5, y: EY.d2, platform: "d-stone-2", story: "One last road, and at its end a door left open, as if someone waited.", tip: "Bounce on the beat, then jump twice up onto the plain." },
  ],
  startTip: "Jump, press the cape, then jump again during the flight: the super jump.",
  main: E_MAIN,
  high: E_HIGH,
  updrafts: E_WIND,
  cascades: E_CASCADES,
  chains: E_CHAINS,
  great: E_GREAT,
  // RESEARCH_REFILLS 3: the star road's three required refills, over the
  // low line (`low`: a miss lands on it, never in the void). Each cape star
  // is 40 px ahead of the press that spends the bar, so it is lit and taken
  // on that very tick, on the grid. The first
  // flight spends the bar, so the first cape star is lit at its start; the
  // super jump spends the air jumps, so the leaf star on its fall is lit; the
  // second flight spends the bar the first star filled, so the second cape
  // star is lit along it.
  refills: [
    { id: "cape-road-1", kind: "cape", x: ex(ROAD_K + 2, ...SF.launch) + 40, y: EY.gate - 100 - 36, required: true, low: true },
    { id: "leaf-road", kind: "leaf", x: ex(ROAD_K + 7, ...SF.road) + 44, y: EY.gate - 267 - 36, required: true, low: true },
    { id: "cape-road-2", kind: "cape", x: ex(ROAD_K + 13, ...SF.road) + 40, y: EY.gate - 289 - 36, required: true, low: true },
    // Optional (C2): on the summit jump's rise, before its cape. Dormant on
    // the main route (the summit-song filled the bar); lit only if a flight
    // was spent on the stair, so that flight never dooms the summit.
    { id: "cape-summit", kind: "cape", x: ex(308.5, ...SF.far), y: EY.stair2 - 60 - 36 },
  ],
  // The helper leaps out of a flight ahead as the rising star is taken.
  moments: [{ id: "helper-leap", kind: "helper", k: 24, target: "rising-star" }],
  decor: [],
  prompts: [
    { id: "p-super", glyph: ["up", "then", "right", "then", "up"], action: "super-jump", optional: true, x: ex(27), y: EY.floor - 235, from: ex(28) - 10, to: ex(34, 1), inputX: ex(28) + 8 },
    { id: "p-storm", glyph: ["up", "then", "right", "then", "up"], action: "super-jump", x: ex(66, 1), y: EY.step2 - 235, from: ex(67, 1), to: ex(74, 2), inputX: ex(68, 1) + 8 },
    { id: "p-road", glyph: ["up", "then", "right", "then", "up"], action: "super-jump", x: ex(ROAD_K - 2, 5), y: EY.gate - 235, from: ex(ROAD_K - 1, 5), to: ex(ROAD_K + 6, 6), inputX: ex(ROAD_K, 5) + 8 },
    // The rising stair's first step (owner's video: the cape was pressed in the
    // jump's rise and flew 50-65 px under the bowl). One ledge-tip sign says
    // what the step is: jump, and jump again. The second step's double has
    // none (the first one has been done by then).
    { id: "p-stair", glyph: ["up", "up"], action: "double-jump", x: ex(284.5, ...SF.far), y: EY.far2 - 250, from: ex(284, ...SF.far) - 30, to: ex(292, ...SF.far), inputX: ex(284, ...SF.far) + 8 },
  ],
  stars: E_STARS,
  routes: {
    main: E_PLAN_MAIN,
    upper: null,
    ability: null,
    safe: null,
  },
};
// Great Stars 1, 2 and 3: a second super jump from the school shore (42);
// a super jump in the road's second flight (251), then its last flight
// (255) from the refilled bar; a super jump off the last tile (374).
FAR_DOOR.routes.upper = [
  ...eSuper(28, SF.start), ET(38, SF.school), ...eSuper(43, SF.school),
  ...E_PLAN_MAIN.filter(([x]) => x > ex(60, 1) && x < ex(ROAD_K + 14, 6)),
  EJ(ROAD_K + 15, [7, 0], "a"), ED(ROAD_K + 19, [7, 0]),
  ...E_PLAN_MAIN.filter(([x]) => x > ex(ROAD_K + 24, ...SF.far) && x < ex(373, ...SF.summit)),
  ...eSuper(374, SF.summit),
];
// No breeze hops and no taps: the beacons' runs walked.
FAR_DOOR.routes.ability = E_PLAN_MAIN.filter(([x, a]) => !(a === "tap" || [[113, SF.wind], [169, SF.casc], [273, SF.far], [337, SF.summit], [389, SF.summit]].some(([k, sf]) => Math.abs(x - ex(k, ...sf) - 1) < 2)));
// The low line under the star road: a tap down off the gate, a hop up onto
// the low step and a double up onto the far shore.
FAR_DOOR.routes.safe = [
  ...E_PLAN_MAIN.filter(([x]) => x < ROAD_X0 - 30),
  [ROAD_X0 - 0.3, "tap", "g"], [ROAD_X0 + 410 - 0.3, "jump", "g"], [ROAD_X0 + 881 - 0.3, "jump", "g"], [ROAD_X0 + 881 + 4 * 37.85 - 0.3, "jump", "a"],
  ...E_PLAN_MAIN.filter(([x]) => x > ex(ROAD_K + 24, ...SF.far)),
];

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
    { stage: 5, key: "breaking", title: "The Breaking Constellation", toward: "Saturn", bpm: 112, introduces: "cracks", look: "saturn", def: BREAKING },
    { stage: 6, key: "borrowed-wind", title: "Borrowed Wind", toward: "Jupiter", bpm: 118, introduces: "wind", look: "jupiter", def: BORROWED_WIND },
    { stage: 7, key: "falling-road", title: "The Falling Road", toward: "Mars", bpm: 123, introduces: "cascade", look: "mars", def: FALLING_ROAD },
    { stage: 8, key: "door", title: "The Far Door", toward: "the Moon, then Earth", bpm: 128, introduces: "super", look: "moon-earth", def: FAR_DOOR },
  ].map((q) => Object.freeze(q)),
);
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
/** The interim levels (none since VIII replaced revision six's Far Door;
 * kept so a stage that is rebuilt later can play an old level meanwhile). */
const INTERIM = [];
/** The tail rule (human proxies, revision five round 8): a late land-and-go
 * press is the first-timer's commonest miss, and a small stone that ends
 * under the route's takeoff leaves only the coyote time (about 130 ms) for
 * it. From IV on, a stone is never shorter than `tail` px past the main
 * route's last ground takeoff on it (45 px = 165 ms more of late press at
 * 270 px/s), so the late window is about 300 ms. Not for cascade tiles (a
 * beat schedule) or lids (the dive breaks them), and never into the next
 * stone: dives and doubles that must not land on a stone keep the tail they
 * were solved with (`noTail`); nor a stone in front of a falling road. */
const TAIL = 45;
function withTails(d) {
  // (VIII keeps the tails it was solved with: its late-press rescue is at its
  // 35% ceiling and its windows are the campaign's narrowest.)
  if (d.id < 4 || d.id > 7 || !d.main) return d;
  const takeoffs = (d.routes.main ?? []).filter(([, a, w]) => (a === "jump" || a === "tap") && w === "g").map(([x]) => x);
  const noTail = new Set(d.noTail ?? []);
  const main = d.main.map((q) => {
    const [id, x, y, width, type, extra] = q;
    if (type === "cascade" || type === "lid" || noTail.has(id)) return q;
    const end = x + width;
    const t = takeoffs.filter((tx) => tx >= x && tx <= end + 12).at(-1);
    if (t == null || end >= t + TAIL) return q;
    const after = d.main.filter((p) => p[1] > x + 1).sort((m, p) => m[1] - p[1])[0];
    // (A stone in front of a falling road keeps its tail: the road's beat is
    // the clock the takeoff has to meet.)
    if (after?.[4] === "cascade") return q;
    const next = after ? after[1] : Infinity;
    const newEnd = Math.min(t + TAIL, next - 8);
    return newEnd > end ? [id, x, y, newEnd - x, ...(type !== undefined || extra !== undefined ? [type, extra] : [])] : q;
  });
  return { ...d, main };
}
function register(d0, i, extra) {
  const numeral = ROMAN[i];
  const d = withTails({ ...d0, id: i + 1 });
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

