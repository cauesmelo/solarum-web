# A Signal in the Dark — level design

This describes what `level.mjs`, `model.mjs` and `geometry.mjs` actually implement (2026-11-09), following the approved brief in [RESEARCH.md](./RESEARCH.md). Where the build departs from the brief, the reason is given.

## Structure

Three movements of one idea each, plus a coda (kishōtenketsu: introduce, develop, twist, conclude):

- **I · Waking — the jump.** Tap and hold, a two-beat hop grid, then the second jump for distance and for height.
- **II · The Breaking Constellation — crumble.** Shelves that break under Diana, a chain over a safe ridge, the dive-smash lid, the beat cascade, and a double jump off a breaking shelf.
- **III · Borrowed Wind — the cape.** A flight line, a required midair refill, the solar wind and the super jump, then everything at once with a safe line beneath.
- **Coda · The Far Door.** A long calm island.

Nominal time is `(x − 220) / 270`. The finish is at x = 22180 (81.3 s nominal; the QA routes take 79.1–80.1 s because flights add 230 px/s). The brief's chart was about 86 s; it was compressed by about 5 s so that the existing root QA budget (`maxSeconds ?? 85`) still completes the chapter.

## Units and envelope

World px, y down; a platform's y is its walkable top and Diana's y is her feet (32 × 58 px body). Measured with the same 1/120 s integrator, taking off at an edge:

| Rule | Value | Envelope (physical) | Main-route authoring limit |
| --- | --- | --- | --- |
| Run | 270 px/s | — | — |
| Gravity | 1500 px/s² | — | — |
| Jump | 570 px/s (tap: capped to 280) | 205 px flat, 106 px rise; tap 106 px, 30 px | 170 px gap, 90 px rise; tap 80 px |
| Double jump | 525 px/s | up to 373 px flat, 196 px rise | 280 px gap, 165 px rise |
| Flight | 0.5 s, vy = 0, +230 px/s | jump + flight ≈ 450 px | 400 px gap |
| Super jump | jump during flight: 720 px/s, once per flight | ≈ 173 px rise | optional lines only |
| Glide | hold cape: 350 px/s², fall ≤ 140 px/s | — | taught only in the wind |
| Updraft | −700 px/s² net, rise ≤ 240 px/s; ×1.4 while gliding | 180 px column: +106 px walking in, +186 gliding, +231 jumping in | — |
| Dive | ≥ 700 px/s down; through cracks ≥ 500 px/s | — | — |
| Crumble | collapses 0.65 s after first landing | — | — |
| Coyote / buffer | 0.12 s / 0.14 s | — | — |

Every required landing leaves ≥ 135 px of runway; every beacon leaves ≥ 400 px before the next required input (tested). Drops on any intended line stay under 240 px so the camera shows the landing and the death line never cuts a catch (tested).

## Fix round after the first real-input playtest (2026-11-09)

The playtester's findings and what changed: the updraft "hold →" no longer starts a level dash under the shore (no dash inside wind; a flight entering wind ends; one glyph at a time); near-miss jumps pop onto island lips (≤ 25 px, never for walk-offs) and lips are trimmed to the colliders; grey now only means "breaking now", optional stone has a dotted rim, lids a star-shaped break; the first gap is 90 px flat (full jump from x 960–1110, 0 ms tap from 1060–1110); the opening hops and the ridge vary; the cascade wave now outruns Diana; a second lid on the lifted shore opens a star cache and a breeze over the hearth teaches glide; stars inside the hearth and in voids were moved and every star is pilot-reachable; story lines sit on ink plates; the Saturn limb is gone (rings only); completion lines are hairlines between collected stars; world stars are always filled; a tiny Earth glint pulses the signal ahead. Tables below are current.

## Platforms

`type`: crumble (breaks 0.65 s after the first landing), lid (holds a run, breaks under a dive), cascade (drops on the beat wave), alt (optional mastery or safe line). Untyped = stable stone.

| id | x | end | y | width | type | t (s) |
| --- | --- | --- | --- | --- | --- | --- |
| `home` | −700 | 1100 | 540 | 1800 | | 0.0 |
| `hop-a` | 1190 | 1450 | 540 | 260 | | 3.6 |
| `hop-b` | 1570 | 1760 | 500 | 190 | | 5.0 |
| `hop-c` | 1840 | 2140 | 470 | 300 | | 6.0 |
| `hop-d` | 2260 | 2710 | 520 | 450 | | 7.6 |
| `leap-shore` | 2830 | 3330 | 490 | 500 | | 9.7 |
| `far-shore` | 3590 | 4000 | 490 | 410 | | 12.5 |
| `gs1-ledge` | 4080 | 4280 | 320 | 200 | alt | 14.3 |
| `climb-base` | 4110 | 4490 | 500 | 380 | | 14.4 |
| `climb-crown` | 4630 | 5030 | 335 | 400 | | 16.3 |
| `crown-step` | 5110 | 5360 | 335 | 250 | | 18.1 |
| `high-crown` | 5420 | 5590 | 215 | 170 | alt | 19.3 |
| `long-landing` | 5620 | 6140 | 400 | 520 | | 20.0 |
| `gate-2` | 6260 | 7120 | 470 | 860 | | 22.4 |
| `crack-floor` | 7150 | 7800 | 560 | 650 | | 25.7 |
| `first-crack` | 7190 | 7520 | 430 | 330 | crumble | 25.8 |
| `second-crack` | 7900 | 8200 | 500 | 300 | crumble | 28.4 |
| `beat-isle` | 8220 | 8700 | 480 | 480 | | 29.6 |
| `ridge-a` | 8820 | 9180 | 450 | 360 | | 31.9 |
| `ridge-stone` | 9270 | 9390 | 430 | 120 | | 33.5 |
| `chain-a` | 8880 | 9080 | 320 | 200 | crumble (alt) | 32.1 |
| `chain-b` | 9210 | 9410 | 300 | 200 | crumble (alt) | 33.3 |
| `ridge-b` | 9480 | 9800 | 490 | 320 | | 34.3 |
| `chain-c` | 9540 | 9740 | 320 | 200 | crumble (alt) | 34.5 |
| `chain-exit` | 9880 | 10100 | 320 | 220 | alt | 35.8 |
| `ridge-c` | 9930 | 10300 | 440 | 370 | | 35.9 |
| `b3-isle` | 10420 | 10980 | 480 | 560 | | 37.8 |
| `well-rim-a` | 11100 | 11220 | 470 | 120 | | 40.3 |
| `well-floor` | 11150 | 11670 | 640 | 520 | alt | 40.5 |
| `lid` | 11220 | 11440 | 470 | 220 | lid | 40.7 |
| `well-rim-b` | 11440 | 11700 | 470 | 260 | | 41.6 |
| `well-exit` | 11700 | 11910 | 530 | 210 | alt | 42.5 |
| `tile-0` … `tile-5` | 11820 + 240·i | +170 | 470 | 170 | cascade | 43.0–47.4 |
| `cascade-end` | 13300 | 13660 | 470 | 360 | | 48.4 |
| `last-crack` | 13770 | 14070 | 460 | 300 | crumble | 50.2 |
| `hearth` | 14200 | 15100 | 340 | 900 | | 51.8 |
| `wind-shore` | 15480 | 16020 | 400 | 540 | | 56.5 |
| `split-crack` | 16380 | 16590 | 400 | 210 | crumble | 59.9 |
| `split-far` | 16950 | 17330 | 400 | 380 | | 62.0 |
| `wind-gate` | 17450 | 18070 | 470 | 620 | | 63.8 |
| `lifted-shore` | 18370 | 18560 | 300 | 190 | | 67.2 |
| `star-cache` | 18520 | 18900 | 470 | 380 | alt | 67.8 |
| `lid-2` | 18560 | 18810 | 300 | 250 | lid | 67.9 |
| `lifted-down` | 18930 | 19230 | 400 | 300 | | 69.3 |
| `finale-gate` | 19350 | 19870 | 470 | 520 | | 70.9 |
| `finale-crack` | 19990 | 20190 | 440 | 200 | crumble | 73.2 |
| `low-a` | 20190 | 20450 | 560 | 260 | alt (safe line) | 74.0 |
| `low-b` | 20560 | 21100 | 560 | 540 | alt (safe line) | 75.3 |
| `finale-high` | 21080 | 21380 | 330 | 300 | | 77.3 |
| `low-c` | 21210 | 21410 | 560 | 200 | alt (safe line) | 77.7 |
| `far-door` | 21440 | 22740 | 470 | 1300 | | 78.6 |

55 platforms (43 main, 12 alternate): 8 crumbling shelves, 2 lids, 6 cascade tiles. 90 stars, 30 of them in 7 constellations, plus 3 Great Fallen Stars; two updrafts plus the hearth breeze.

## Beat by beat

### I · Waking (0–22 s)

- **Introduce.** The title is the start island seen from the centre; the sprout (Diana's leaves) wakes into the start clip and the camera eases to the run framing. 2.6 s of flat ground. Three stars at tap height (y 437–442, a 30 px hop reaches them) and three at hold height (y 372–378, only a held jump). Stars teach; nothing is locked.
- **Develop.** Four hops whose takeoffs fall on a two-beat (368 px) grid, 120–130 px gaps and 30–45 px rises. *first-song* (4 stars) alternates jump apexes and running height across hops b and c.
- **Beacon *leap*** (x 2900, 9.9 s).
- **Twist.** `leap-shore → far-shore` is a 260 px flat gap: one full jump reaches 237 px with the body overlap, so a second jump is needed, and it must come late enough (≥ 0.2 s) to carry distance. Glyph ↑ ↑. Great Star 1 sits above `gs1-ledge` (y 320), reached by an early double jump off the far shore and visible from the main route.
- **Conclude.** A 165 px double-jump climb (`climb-base → climb-crown`, *climb-song* traces the arc), an 80 px hop, and a 260 px late-double gap down to `long-landing`. An early double instead lands on the optional `high-crown` (three upper stars) and drops back.

### II · The Breaking Constellation (22–51 s)

- **Card II** at x 6280, as Diana lands on `gate-2`, finishing before the first input (tested; cards, story lines and tips are timed in simulation seconds). **Beacon *breaking*** (6670, 23.9 s).
- **Introduce.** `first-crack` (330 px) is long enough that the 0.65 s crumble always breaks under a runner; `crack-floor` 130 px below catches her (tested). `second-crack` (300 px) breaks about 175 px after landing, so the jump must come before it, toward `beat-isle`, one beat past the break point. Glyph ↑.
- **Develop.** A stable three-island ridge; above it the optional chain of three cracked shelves (y 300–320) and `chain-exit`, which drops back onto `ridge-c`.
- **Beacon *well*** (10440, 37.9 s).
- **Twist 1, the lid.** `well-rim-a | lid | well-rim-b` form one continuous floor; the lid glints with starlight through its cracks and a dim optional ↓ glyph floats over it. A dive breaks it (instantly, ≥ 500 px/s carry) onto `well-floor` 170 px below: Great Star 2 and *well-song* (5 stars) lead along the floor and up the exit arc onto the cascade. Running across leaves the lid whole.
- **Twist 2, the beat cascade.** Six 170 px tiles with 70 px gaps (240 px pitch). On first contact the wave is anchored to tile 0, which drops when Diana's nominal position is 430 px past its start; each later tile drops one beat (0.68 s) after the previous one, shaking for its last 0.35 s. The wave travels 352 px/s against her 270, gaining 56 px a beat, so the last tile drops when she is 150 px into it: a hop at each edge lands in time, a late coyote hop on the last tiles is caught unless she spends her second jump (both tested).
- **Conclude.** `last-crack` breaks 0.65 s after landing; a double jump from it climbs 120 px to the hearth crown.

### III · Borrowed Wind (51–78 s)

- **Beacon *hearth*** (14200, 51.8 s) and **card III**: three calm seconds and a story line.
- **Introduce.** A 380 px void from the 340 px-high hearth. Glyph ↑ · →. *flight-line* (4 stars) lies on the flight altitude of a dash made near the jump apex; completing it re-inks the cape midair, so the player sees the refill rule before it is needed. Without the cape the void is not crossable (tested).
- **Beacon *voids*** (15540, 56.7 s).
- **Develop.** Two 360 px voids split by `split-crack`. Flight A spends the cape; the cracked landing does not refill it; *split-song* (5 stars: two on flight A's line, one on the descent, one on the shelf, one on the jump off it) refills it in time for flight B. Removing one of its stars makes void B fail (tested). This is the only required chain and its beacon is 5 s before it.
- **Beacon *updraft*** (17480, 63.9 s).
- **Twist, the wind.** The 180 px column *first-wind* (x 18080–18260) rises from below `wind-gate`; the whole column is drawn top to bottom. Jumping into it (glyph ↑) lifts Diana 231 px, enough for `lifted-shore` 170 px up across a 300 px gap; walking in and then double-jumping, or gliding, also works. Glyphs appear one at a time: ↑ at the edge, then (optional) "hold →" inside the column — the cape glides upward there, never dashing level — then (optional) → · ↑ just past the column top: cape, then super jump, reaches Great Star 3 at (18520, 80); a plain double jump falls short of it. Without the wind the main route dies here (tested). On the shore, an optional ↓ breaks `lid-2` into the star cache (*cache-song*), which rejoins at `lifted-down`.
- **Beacon *finale*** (19380, 71.0 s).
- **Conclude.** From `finale-crack` (cracked, no refill): jump, flight, double jump, *finale-song* refills the cape at the apex, second flight, then *finale-wind* (x 20860–21030, top 150, bottom 480) catches the end of the flight and lifts Diana to `finale-high`. Under all of it lies the **safe line** `low-a/b/c` (y 560), reached by simply falling; it is stable and needs only jumps, and the column's bottom stops above it so it never lifts a low-line runner by surprise.

### Coda

`far-door` (1300 px) and the original portal at x 22180, grounded 3 px into the island. With all three Great Stars, Earth glows blue inside the arch.

## Beacons

| id | x, y | Platform | Nominal t | Gap | Protects | Story line |
| --- | --- | --- | --- | --- | --- | --- |
| `leap` | 2900, 490 | leap-shore | 9.9 s | 9.9 s | first double jump | "The stars seemed to know the way." |
| `breaking` | 6670, 470 | gate-2 | 23.9 s | 14.0 s | first crumble | "Some stars are too tired to hold her. She is light enough." |
| `well` | 10440, 480 | b3-isle | 37.9 s | 14.0 s | lid, cascade | "Under the cracks, something was still shining." |
| `hearth` | 14200, 340 | hearth | 51.8 s | 13.9 s | first flight | "A warm stone. A breath. The signal is louder here." |
| `voids` | 15540, 400 | wind-shore | 56.7 s | 5.0 s | required constellation | "The cape remembers the wind of home." |
| `updraft` | 17480, 470 | wind-gate | 63.9 s | 7.2 s | first updraft | "Wind rises where the dark is deepest." |
| `finale` | 19380, 470 | finale-gate | 71.0 s | 7.0 s | finale | "Somewhere ahead, a little blue world is listening." |
| finish | 22180, 470 | far-door | 81.3 s | 10.4 s | | |

A beacon lights when Diana stands on it (feet within 1 px of its y, x within [x, x+400]); flying over does not count. Lighting saves stars, constellations and progress, banks any carried Great Star, refills the cape, resets the fall counter and the star net. Each has a one-line tip shown after three falls there.

## Rules in detail

**Cape (M1).** `RULES.capeRule = 'landing'`: `capeCharges` is 0 or 1. `dash()` needs an airborne Diana and a charge, sets vy = 0 for 0.5 s at +230 px/s. Refills: any landing on uncracked stone, any beacon, any completed constellation. Landing ends a flight. `'cooldown'` restores the archived 6 s timer (beacons and constellations reset it).

**Smash (M2).** A diving Diana that meets a crumble, lid or cascade surface breaks it in the same substep and keeps falling at ≥ 500 px/s, so a lower platform in the same substep still catches. A grounded dive breaks only cracked stone; ordinary stone ignores it. Chips and a 3 px shake are renderer-only and skipped under reduced motion.

**Constellations (M3).** Stars of one chain must be taken in order with at most 1.2 s between them; passing an untaken star (50 px) or waiting too long fades the chain. Taken stars still count. Completion increments `ringsCrossed` and `constellations` and refills the cape. Notes (synthesised, `audio.mjs`): kalimba D5 E5 F#5 A5 B5 D6, D major pentatonic, the soundtrack's key; completion re-strums them into a D add9 bloom.

**Great Stars (M7).** Taking one puts it in `greatPending` (it circles Diana and its HUD slot pulses). Touching any ground or a beacon banks it. A fall before banking returns it to the sky; banked ones survive every retry. Three banked → `win` carries `earth: true` and the door shows Earth.

**Respawn.** `status: 'dead'` for 0.7 s (shatter 0.45 + iris 0.25), then the checkpoint snapshot is restored (`'respawning'` 0.4 s while the sprout pops), then `'running'`. A jump pressed in between fires on the first controllable frame. Star net (assist): the first fall after each beacon returns Diana to her last stable landing instead, and every shelf, tile, constellation, prompt and unbanked Great Star ahead of that point is restored.

## Camera and readability (geometry.mjs, tested)

- Logical view height 675 px; width = 675 × aspect, never below 880 in landscape. Narrower boxes letterbox: the sky keeps ≥ 720 logical px of width and leaves a ≥ 200 px control deck. Diana at 23% → lookahead ≥ 2.51 s in landscape (960×640: 2.89 s; 844×390: 4.17 s) and ≥ 2.05 s in portrait (390×844: 366 css px of sky). Fairness tests use the narrowest 720 px sky.
- Camera top = 0.65 × (anchorY − 470), eased with τ = 0.35 s, plus up to 120 px look-down after 0.35 s of falling, then clamped so Diana's head stays ≥ 64 px below the top. No main-route platform's maximum apex (jump + double + super, 371 px) enters the 56 px HUD band, nor does any star.
- Death line = anchorY + 265 (735 when standing at 470, about 60 px under the view bottom).
- No blind landings: from every main-route takeoff, the next platform's first 40 px are within lookahead (or, in the finale, the stable safe line under the gap is) and inside the vertical band. Rejoins from optional lines are checked too.
- Telegraphs: every glyph prompt is on screen ≥ 1.5 s before its latest valid input at the narrowest (720 px) view; crumbling shelves shake for their whole 0.65 s; cascade tiles for 0.35 s; every cracked surface has a catch below or a visible next step.

## Glyph prompts

| id | Glyph | Where | Hidden by |
| --- | --- | --- | --- |
| `p-jump` | ↑ | end of the home island | jump |
| `p-double` | ↑ ↑ | over the long leap | double jump |
| `p-climb` | ↑ ↑ | before the 165 px climb | double jump |
| `p-crack` | ↑ | over the second cracked shelf | jump |
| `p-lid` (optional) | ↓ | over the lid | dive |
| `p-cape` | ↑ · → | edge of the hearth | cape |
| `p-updraft` | ↑ | edge of `wind-gate` | jump |
| `p-wind` (optional) | hold → | inside the column | glide in the wind |
| `p-super` (optional) | → · ↑ | top of the column | super jump |

## Route evidence (tests/routes.mjs, 120 Hz)

Pilots read a fixed list of `[x, action, when]` steps and call only public actions.

| Route | What it does | Result |
| --- | --- | --- |
| `main` / `low` | Every required action, high line in the finale | won 79.242 s · 52 stars · 5 constellations · 7 beacons · 42 jumps / 5 flights |
| `upper` / `high` / `mastery` | GS1 ledge, high crown, the cracked chain, lid smash and well, glide + flight + super jump for GS3 | won 79.133 s · 64 stars (15 upper) · **3 Great Stars** · 6 constellations · 1 smash · 1 super jump |
| `ability` | Main route plus a released-jump hop, the lid smash and the well, glide in the wind | won 79.242 s · 57 stars · GS2 · 6 constellations |
| `safe` | Main route, but drops to the finale's stable low line | won 80.083 s · 51 stars · 3 flights |

All four win at 30, 60, 120 and 240 Hz. Failure checks: no second jump → dies over the leap (after beacon *leap*); no cape → dies in the first void (after *hearth*); one constellation star removed → dies over void B (after *voids*); no wind → dies at the updraft (after *updraft*).

## Risks and next tuning

- The required midair constellation is the most demanding read in the chapter. If players miss it, widen star tolerance or move its last star lower on the jump arc before touching the void width.
- The cascade cannot catch a runner by construction; it is pressure, not a threat. If it needs teeth, the honest lever is narrower tiles, not a faster wave.
- 165 px and 170 px climbs sit at the authoring limit; watch first-time players there.
- Tempo is the GDD's 88 BPM, but the soundtrack measures 107 BPM (onset autocorrelation and its MP3 `TBPM` tag; README, Sound). Spacing still uses 88; retuning it is open.
- Human sessions should note where a glyph is first misread, which line people choose in the finale, and whether 1.1 s respawns feel instant enough.
