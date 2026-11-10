# Solarum — level design

This describes what `level.mjs`, `model.mjs` and `geometry.mjs` implement (2026-11-10, revision five's progression, [RESEARCH_PROGRESSION.md](./RESEARCH_PROGRESSION.md)). The campaign has eight planned stages (`CAMPAIGN`); **I · Waking, II · The Gift, III · Still Water, IV · The Way Down, V · The Breaking Constellation, VI · Borrowed Wind and VII · The Falling Road are built**. Revision six's Far Door (below, unchanged) plays after them as interim level VIII until VIII is built; V and VI replaced revision six's Breaking Constellation and Borrowed Wind, which are retired. Tests and tools name the interim level by key (`LEVEL_ID.door`), so building a stage renumbers nothing by hand. The chapter *A Signal in the Dark* (further below) is source material. Where the build departs from a brief, the reason is given.

## One ruler, one tempo per level

Every level is simulated in 107 BPM units: a sixteenth is 15/107 s and 37.85 px of run, a grid x is `220 + 37.85 k` (plus 113.55 px per completed flight, and 63.67 px for a super jump opened 2/16 into a flight), and a level plays at clock = BPM / 107 of real time. Human windows are multiplied by the clock so they stay constant in real seconds (coyote 0.12 s, buffer 0.14 s, respawn 1.1 s, the cascade's shake telegraph 0.35 s). Score tolerances are real milliseconds (35 ms real = 35 × clock of simulation).

| | I · Waking | II · The Gift | III · Still Water | IV · The Way Down | V · The Breaking Constellation | VI · Borrowed Wind | VII · The Falling Road |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BPM / clock | 88 / 0.822 | 94 / 0.879 | 100 / 0.935 | 107 / 1 | 112 / 1.047 | 118 / 1.103 | 123 / 1.150 |
| Run (real) | 222 px/s | 237 | 252 | 270 | 283 | 298 | 310 |
| Owns at the start | jump | jump, double | jump, double, cape | jump, double, cape, glide | jump, double, cape, glide, dive | the same | the same |
| GET | double jump, sixteenth 120 (bar 8) | cape, sixteenth 4 (bar 1) | glide (the helper), 44 (bar 3) | dive (the necklace), 44 (bar 3) | none: cracked stone is the world's | none: the solar wind is the world's | none: the beat cascade is the world's |
| Cape rule | (no cape) | breath | breath | breath | breath | breath (and the wind refund) | breath (refill stars: one cape, one leaf, required) |
| Physics (sim) | g 1640, jump 635, double 570, hang ×0.5 below 66, fall ≤ 681 (560 real), tap cap 308 | 1500 / 570 / 525 | same (glide 350 px/s², ≤ 140 px/s) | same | same, cracks 5/16 | same, cracks 5/16, wind 700 px/s² ≤ 240 (×1.4 held) | same, cracks 5/16, wind as VI |
| Bars / real s | 19 / 51.8 | 19 / 48.5 | 22 / 52.8 | 21 / 47.1 | 23 / 49.3 | 23 / 46.8 | 25 / 48.8 |
| Inputs (main; `inputsOf`) | 23, 1.21 a bar, peak 2 | 25, 1.32 a bar, peak 3 | 34 (26 presses, 4 held capes, 4 releases), 1.55 a bar, peak 3 | 36 (33 presses, 3 held capes), 1.71 a bar, peak 4 | 45 presses, 1.96 a bar, peak 3 | 52 (46 presses, 3 held capes, 3 releases), 2.26 a bar, peak 3 | 63 (61 presses, 1 held cape, 1 release), 2.52 a bar, peak 5 |
| Narrowest / median required window | 618 / 628 ms | 332 / 626 ms | 321 / 606 ms | 300 / 583 ms | 263 / 549 ms | 204 / 537 ms | 203 / 428 ms |
| Diana's own notes (perfect run) / bed onsets | 1.41 / 0.98 per s | 1.92 / 1.83 | 2.23 / 1.74 | 2.61 / 2.23 | 2.98 / 2.15 | 3.95 / 2.12 | 4.39 / 1.91 |
| Beacons (largest gap, real) | 4 (13.6 s) | 6 (10.7 s) | 6 (11.7 s) | 5 (9.8 s) | 5 (10.7 s) | 4 (10.2 s) | 5 (9.5 s) |
| Look | home | pluto | neptune | uranus | saturn | jupiter | mars |

**Inputs** (`scripts/movement-audit.mjs` `inputsOf`, used by the level report and the L3 ladder test): every press (jump, tap, cape, dive), every press of the cape that only holds it (a glide that does not start with a flight at the same x) and every release of a held cape in the air (a timed letting-go); a release after a touch-down is not one, like a jump's release, and letting go and jumping in the same instant is one gesture. I and II are unchanged by this rule (they have no glide).

**Authoring.** `scripts/arcs.mjs <level> <move>` flies a move with the real model in free space and prints its height at exactly each sixteenth (PHYS and CLOCK override the physics for a level still being solved). `scripts/level-report.mjs <level> [--windows] [--holds] [--anchors]` prints every route at 30–240 Hz, the main route's grid audit, presses per bar, the longest quiet stretch, beacon gaps, each press window (real ms) with its decision lead, and the holds each press needs. Every main route was then baked (`npm run score:bake`) and tested.

### I · Waking (88 BPM): floaty, calm; the jump, then the double jump

Cells (height at k/16 after a grid takeoff; up < 0): hold 2: −112, 3: −121, 4: −112, **5: −73**, **6: −1 (flat)**, 7: +93, 8: +188; tap (cap 308) 1: −26, **2: −20**, 3: +19, 4: +90; double, second press at 3: 8: −157, 9: −79, **10: +16**; at 4: **9: −148**, 10: −70, 11: +26; at 5: 11: −30, **12: +65**. A 64.5 px walk-off lands exactly 2/16 after the edge, a 115 px one 2.67/16 (so the lookout's edge sits 0.33/16 off the grid and the landing is on it). Human holds of 250–500 ms land up to 1/16 earlier than the held pilot, so landings start 70–110 px before their grid point and every song star sits on the first two sixteenths of its arc, where every hold is at −111.

| k (bar) | Step | What (y) |
| --- | --- | --- |
| 0–23 (1–2) | introduce | Home (540): a tap row (only a tap's body reaches it, not running) and a hang row (only a held jump); the ↑ glyph. The first gap is 90 px: any first input clears it, walking off does not |
| 24–55 (2–4) | develop | Held jumps at 24 (flat), 34, 42, 50, up 72, 76, 80 px (5/16 each) to the lookout (312); *first-song* on the four rises |
| 56 (4½) | beacon *lookout* | The shower: eight stars land on the floor ahead, one on each eighth from 60 to 74 (`moments`), 14/16 = 2.4 s real before Diana reaches each |
| 70–88 (5–6) | develop | Main: walk off the lookout's edge (70.33) and drop 115 px onto the floor (427) on 73; *shower-song* on the eighths 74–88. Upper: three hang jumps bounce along the tier at the lookout's height (68, 74, 80; *tier-song*), **GS1** over the last hang, then down 100 px onto stone-a |
| 90–108 (6–7) | develop | Stepping stones: taps at 90 and 96 up 19 px each (2/16; walking off cannot climb), then a held jump at 102 down 93 px across the wide gap (7/16; a tap falls 50 px short) onto the field (482). The lock: a four-star cluster at double height over stone-b (`decor`, drawn, never collected) |
| 104 / 120 (8) | **GET** | The first star lands softly at 104 (moment) and rests on the run line; Diana runs through it on 120 and owns the double jump. No required press within a bar of it |
| 124–134 (8–9) | safe first use | An optional double (124, second press 127) through the key: the same four-star shape, on the arc (the ↑↑ glyph, optional) |
| 136 (9½) | beacon *first-star* | |
| 152–164 (10) | need | The leap: jump 152, second press 157, 374 px across and 65 px down onto the far shore (547) 12/16 later (the ↑↑ glyph) |
| 168–177 (11) | twist | The climb: jump 168, second press 172, up 148 px onto the crown (399) 9/16 later. **GS2** where only an earlier second press (170) climbs |
| 180–184 (12) | | Walk off the crown (64.5 px, 2/16) onto the stair base (463.5) |
| 184 (12½) | beacon *climb* | |
| 196–220 (13–14) | develop | The double staircase: jump 196, second 200, up 70 px (10/16) twice to the top stair (323.5); walk off it (105.5 px, 2.55/16) onto the crash field (429) on 227 |
| 224 / 232 / 240 (15–16) | set piece | The brightest star flashes on 224; beacon *crash* on 232; the crash on the downbeat of 240 (`moments`). Upper: off the top stair a double up 70 px to the high crown (253.5), a hang to hang-1, **GS3** over it, then down onto rim-1 |
| 244–286 (16–18) | conclude | Three doubles down to the rim, two presses a bar, no glyphs: 244/249 (+65), 260/265 (+65), 276/279 (+16) to the crater rim (575); *home-song* on the four rises |
| 304 (20) | door | On the crater rim, the downbeat of bar 20. The lookout (312) and the rim (575) are 263 px apart |

Platforms (x from–to, y): home −700–1138 540; drift 1228–1517 540; climb-1 1621–1820 468; climb-2 1924–2123 392; lookout 2227–2866 312; floor 2945–3637 427; stone-a 3642–3864 408; stone-b 3869–4091 389; glint-field 4276–5983 482; far-shore 6347–6589 547; climb-crown 6829–7017 399; stair-base 7089–7649 463.5; stair-1 7927–8179 393.5; stair-2 8457–8699 323.5; crash-field 8774–9465 429; rim-1 9810–10071 494; rim-2 10415–10677 559; crater-rim 10955–12246 575. Upper: tier-1 2941–3031 313, tier-2 3198–3258 314, tier-3 3425–3561 315, high-crown 9007–9163 253.5, hang-1 9330–9503 254.5.

Why it departs from the brief's table: the second beacon moved from 7½ to 9½ (sixteenth 136), because §2.2/§7 also require no required press within a bar of the GET and a beacon at most one bar before the first required use; the shower lands on the floor only (an upper-tier song of its own keeps the mastery line in tune: passing an untouched constellation is silent); the stepping stones rise (a falling staircase can be walked); the stair-2 exit and the lookout's are walk-offs on the grid instead of taps ("never author against hidden forgiveness": a walk-off already worked). The lock, the plume, the falls, the flash and the crash are model data (`decor`, `moments`, event `moment`); the renderer's art for them, the leaf glint and the no-cape clips belong to the art squad.

### II · The Gift (94 BPM): calm with marked beats; the cape and its breath

Shared simulation physics, so the cells are the chapter's (scripts/arcs.mjs on the interim III): hold 4: −80, 5: −26; double at 4: 10: +12; a flight at the apex (3/16) holds −105 for 0.5 s, then 9: −17 (17 up), **10: +70** (70 lower); two flights at 3 and 9 around a refill: **14: +15**. A full flight adds 113.55 px, so after F flights a grid x is `220 + 37.85 k + 113.55 F` (`gk`).

| k (bar) | Step | What (y) |
| --- | --- | --- |
| 0–20 (1–2) | **GET** | The crater floor (300): the asteroid's gift on 4 owns the cape; the bar appears empty and breathes full over one bar of running (on 20, one refill) |
| 23, 31 (2) | | Two held hops up 26 px out of the crater onto its rim (248), after the title card |
| 40–49 (3) | safe first use | Jump 40, cape 43: lands 17 px up on the gift stone (231) 9/16 later, along *first-flight*; a double also makes it; a plain jump lands on the crater floor 60 px below and hops 77 px back up (the safe line). The ↑·→ glyph (optional). **GS1** over it for jump, double (44), cape (47) |
| 56 (4½) | beacon *gift* | |
| 68–78 (5) | need | The hearth void: jump 68, cape 71, 382 px across, 70 px down onto the hearth shore (301), along *flight-line*; the ↑·→ glyph. Charged by the gift beacon |
| 82–86 | | A held hop up 80 px (4/16) onto the second hearth (221) |
| 88 (6½) | beacon *void* | |
| 100–110 (7) | | The same void without stars (jump 100, cape 103) onto void-shore-1 (291). Charged by the void beacon |
| 112–134 (8–9) | breath lesson | Two gaps a double crosses (112/116 and 124/128, 12 px down each) while the bar shows a quarter (2/16 of stone each); then the long stone (315) fills it on 146, tick by tick |
| 152 (10½) | beacon *long* | |
| 164–178 (11) | twist | The long void: jump 164, cape 167, *void-song* on the flight completes on 170 and refills the cape, cape 173 (the → glyph), 15 px down onto the void shore (330) 14/16 after the takeoff. **GS2** for a double (171) between the flights |
| 184 (12½) | beacon *steps* | |
| 196–246 (13–16) | conclude | Pluto's steps, each 70 px down: from the void shore (jump 196, cape 199; charged by its long stone and beacon) onto the step rock (400); off that short rock (2/16, no breath) the *steps-song* on the jump's rise completes on 210, cape 211 onto Pluto's rock (470); beacon *pluto* on 224; jump 236, cape 239 along *pluto-song* onto the heart plain (540). **GS3** over the last step for jump, double, cape |
| 252–277 (17–18) | coda | Three held hops up 26 px each to the door stone (462); the glide lock (a gently descending star line below its edge that a flight cannot follow) is `decor` |
| 304 (20) | door | |

Charge sources (RESEARCH_PROGRESSION 3.4): (a) beacons for the hearth void, its repeat, the long void's first flight and Pluto's first and last steps; (b) constellations completed before the press for the long void's second flight (*void-song*) and the second step (*steps-song*). Running stars are only placed where the bar is already full, so they add Diana's notes without moving a fill. C1–C3 are tested on every route and rate and at every required press's window edges; an optional flight spent in any airtime with a full bar never empties a required one (C2). The safe first use's flight counts as optional (its gap has a floor and an optional glyph).

Platforms (x from–to, y): crater −700–1101 300; crater-step 1205–1403 274; rim 1508–1744 248; gift-stone 2088–2917 231; hearth-shore 3299–3561 301; hearth-2 3622–4242 221; void-shore-1 4624–4810 291; breath-1 5078–5264 303; long-stone 5533–6778 315; void-shore 7415–8216 330; step-rock 8608–8784 400; pluto-rock 9166–9958 470; heart-plain 10340–10677 540; heart-1 10781–11055 514; heart-2 11159–11434 488; heart-door 11538–13155 462. Safe line: crater-floor 1810–2123 308.

Departures from the brief's II table: 19 bars instead of 20 (48.5 s); beacons at 4½, 6½, 10½, 12½ and 15 so each required flight has its source and the breath lesson stays unrefilled; GS1 sits over the first flight rather than on a Pluto ledge (a ledge there leaves no rejoin under 255 px). A sixth beacon, *lock*, stands on the door stone at 280 (18½), over the glide lock, so the largest beacon gap is 10.7 s (it was 13.3 s, pluto to the door, over the ladder's 13).

### III · Still Water (100 BPM): floating, flowing; the glide

Shared simulation physics, so II's cells hold; the held cape adds its own (scripts/arcs.mjs `g`/`u` on the interim wind level): after a flight or a jump the glide falls at most 140 px/s of simulation (19.6 px a sixteenth), and a release drops 33.6 px in the next sixteenth and 96.6 in two. Cells (dy at k/16 after a grid takeoff, up < 0): walk off holding the cape **8: +122.9**; jump, cape 3, hold **20: +134.8** (a flight alone is down at 10.6); jump, cape 3 **9: −16.8**; jump holding the cape **13: +70.3** (a double alone reaches +70 at 10.5); jump, cape 3, let go at 13 **15: +96.9**, at 14 **15: +51.7**; jump holding, let go at 6 **8: +29.7**; jump, cape 3, the refill, cape 9, hold **17: +47.3** (two flights alone are down by 14.6); jump, cape 3, let go and jump again at 10 **14: −117.4**; jump, jump at 3 **7: −160.2**; jump, jump at 4, hold **12: −84.7**.

| k (bar) | Step | What (y) |
| --- | --- | --- |
| 23–33 (2–3) | warm-up | Off Pluto's plain (90): jump 23, cape 26, 70 px down onto the helper's cliff (160) on 33 |
| 36 / 44 (3) | **GET** | The helper (`moment` *helper-drift* on 36) drifts down the slope of air at the cliff's lip; Diana runs through it on 44 and owns the glide (`moment` *ripple*). No required input within a bar of it |
| 48–56 (4) | safe first use | The lip at 48 is a walk-off onto the field (283) 123 px below. Holding the cape (the *hold →* glyph, optional) floats her down the *float-song* onto it on 56; without it she lands at about 51.5 |
| 64 (5) | beacon *float* | |
| 76–96 (5–7) | need | The still void: jump 76, cape 79 and hold, 135 px down onto the far shore (418) 20/16 later, along the *still-song* (the ↑ · hold → glyph). Without the held cape she is down at 515 px; the shore starts at 615. (Jump and hold alone reaches its very edge: the flight is the comfortable way, holding is the required one) |
| 104 (7½) | beacon *still* | |
| 116–142 (8–9) | twist | The cape floats when it cannot fly: jump 116, cape 119 up 17 px onto a short ledge (401; 4/16 of breath); jump 129 holding the cape (the bar empty), 70 px down along the *ledge-song* onto shore A (471) on 142 |
| 144 (10) | beacon *drift* | |
| 156–180 (10–12) | twist | Letting go: jump 156, cape 159 and hold over three islets; let go on 169 over the second, 97 px down on 171 (it ends before the held glide comes down to it, so only a release lands there; release window about 3.5/16), then jump 173 and jump again 176, 160 px up onto the next shore (408) on 180. The first islet (a release over it lands short of every shore) and the third (too low to climb out of) are optional (`high`); Great Star 2 is on a tiny high islet for an exact release (163) |
| 192 (13) | beacon *stair* | |
| 204–243 (13–16) | develop | The water stair: jump 204, cape 207, hold, let go at 218 (52 px down on 219); twice a jump holding the cape (the bar a quarter and a half full), let go 6/16 later, 30 px down 8/16 after the jump (223/231, 235/243) |
| 248 (16½) | beacon *wide* | |
| 260–277 (17–18) | develop | The widest void: jump 260, cape 263, the *refill-song* (one star a sixteenth, complete on 266) gives the cape back, cape 269 and hold along the *deep-song*, 47 px down 17/16 after the takeoff (870 px) onto the wide shore (567). Great Star 3 over it for jump, double, cape, hold |
| 280 (18) | beacon *rise* | |
| 292–324 (19–21) | conclude | The rise, twice, no glyph: jump, cape 3/16 later, hold, then let go and jump again 7/16 after the cape: 117 px up 14/16 after the takeoff (292/295/302 onto climb-1, 310/313/320 onto climb-2); the *climb-song* on climb-1 and the second rise charges the second cape; the *neptune-song* along it |
| 327–352 (21–23) | coda | A held hop 26 px up onto the dive lock (a glinting lid on the main line she runs across and cannot open: no dive yet; its catch is `high`), a hop onto Neptune's shelf (281) and the door on the downbeat of bar 23 |

Charge sources (RESEARCH_PROGRESSION 3.4): (a) beacons for the warm-up (the level starts full), the need, the glide ledge's flight, letting go, the stair's first flight, the widest void's first flight and the rise's first; (b) the *refill-song* (on the widest void's first flight) and the *climb-song* (on the second rise's own line). Every held cape on its own (the field's float, the pure glide off the ledge, the stair's two) starts with the bar short of full, so the same key glides and never flies there (C1 checks it on every route and rate); the loose stars before them are counted (one on the stair). Great Stars: GS1 the longest float (jump at the lip, jump again at 52, hold to 71), GS2 the tiny islet, GS3 the double-cape-hold line.

Platforms (x from–to, y): pluto-edge −700–1101 90; helper-cliff 1483–2156 160; still-field 2244–3220 283; far-shore 3825–4848 418; glide-ledge 5202–5453 401; shore-a 5863–6475 471; islet-2 7128–7230 568; next-shore 7397–8406 408; stair-1 9017–9238 460; stair-2 9476–9693 490; stair-3 9930–10639 520; wide-shore 11449–12077 567; climb-1 12631–12872 450; climb-2 13425–13629 333; lock-lid 13733–13970 307 (lid); neptune-shelf 14074–15085 281. Upper: islet-gs2 6924–6979 491; islet-1 6995–7071 511; islet-3 7308–7378 636; lock-floor 13732–14035 457.

Departures from the brief's III table: 22 bars (52.8 s) instead of 20, because the title card covers sixteenths 5–22 and the GET needs a bar clear of required input on each side, so the warm-up flight (23/26) comes first and the GET is on 44 (bar 3) instead of 2½; beacons at 5, 7½, 10, 13, 16½ and 18 (six, at most 11.7 s apart; the brief's 4½ would put a required input inside the GET's bar); the need's far shore starts 615 px out (the portrait lookahead from the cape press), so holding alone, without the flight, reaches its edge; III's ladder band for Diana's own notes (3.2–4.0/s) is not met: they are 2.23/s, +16% over II, with the bed at 1.74/s under them (the user's restraint: the notes come from the glide lines, never from the bed). The glide whistle (audio.mjs) is not counted in those numbers.

### IV · The Way Down (107 BPM): the song at home; the dive

Clock 1, shared physics. Cells: jump, cape 3, hold **15: +36.7**; a dive on a lid falls 127 px in 1.4/16 (pressed 0.4/16, 56 ms, before the grid its notes snap forward onto it and the landing is on the next one: the score's quantiser only waits forward, at most 70 ms); a dive from the air falls 427 px in 3/16 (through a lid 77 px below the dive's height it breaks it 1.18/16 in, and the shards snap onto the next eighth); jump, cape 3, dive 6 **7: +2.2** (the dive cuts the flight 3/16 in: +94.9 px instead of 113.55, so a grid x is `wk(k, F, C)` with C such cuts); jump holding the cape, dive 8 **9: +84.2**; jump, cape 3, dive 8 **9: +38.4**; jump, cape 3, hold, dive 10 **11: +48.3**; jump, jump 3, cape 6 **11: −160.4**; held hop **4: −79.9**; jump, cape 3 **9: −16.8**; jump, jump 3 **7: −160.2**.

| k (bar) | Step | What (y) |
| --- | --- | --- |
| 23–38 (2–3) | warm-up | Flight and held cape (jump 23, cape 26, hold) along the *warm-song*, 37 px down onto the glinting stone (99) on 38 |
| 44 (3) | **GET** | From 42 the stone is a lid. The necklace wakes on 44 (`moment` *necklace-wake*; `decor` *glint-stone*) |
| 53.6–55 (4) | safe first use | A dive breaks the lid (the ↓ glyph, optional) into the star row 127 px below (226) on 55. Running on, she crosses the lid and walks off the ledge after it onto the same floor |
| 64 (5) | beacon *down* | |
| 76–83 (5–6) | need | The cut: jump 76, cape 79, a dive on 82 cuts the flight over the islet (228) and lands on it on 83 (the ↓ glyph). Without the dive the flight runs on past its end (60 px after the landing) and the fall after it misses everything |
| 84–105 (6–7) | develop | A held hop up 80 (84) onto the cut shore, then a jump holding the cape (the bar short of full) and a dive that cancels the glide onto the rock (232) (96, 104, 105) |
| 112 (8) | beacon *glint* | |
| 124–145 (8–10) | twist | The glint: a held hop onto a lid (152) that holds a run; the *glint-song* on it and the next rise charges the flight off its end (jump 136, cape 139) 17 px up onto the broken gate (135). Great Star 1 is in the star cache under the lid (a dive; out by jump, double and flight) |
| 152 (10½) | beacon *broken* | |
| 164–196 (11–13) | twist | The broken well: jump 164, cape 167 over a long lid (212) on a well 276 px deep, deeper than a walk-off survives; the dive at 172 breaks the lid from the air and lands on the well floor (488) on 175 (a flight alone lands on the lid, and a dive there still opens it); out by jump, double and flight (185, 188, 191), charged by the *well-song* on the floor and the rise, 160 px up onto the well shore (328) on 196 |
| 204–213 (13–14) | | A jump holding the cape and a dive out of it onto the ring gate (412) |
| 216 (14½) | beacon *rings* | |
| 228–265 (15–17) | conclude | The way down into Uranus's rings: fly and dive (228/231/236, onto ring-1, 450), hold and dive (241/249, ring-2, 534), fly, hold and dive (254/257/264, ring-3, 582; charged by the *ring-song* on ring-2 and its own rise). Great Star 3 on a tiny islet for an early dive out of the held cape (260.6); Great Star 2 under the ring's lid (optional: a dive, then a jump and an early second jump out) |
| 280 (18) | beacon *plane* | |
| 292–311 (19–20) | conclude | A double up 160 px (292/295) onto ring-high, the *plane-song* on it and the next rise, a last fly and dive (302/305/310) onto the ring plane (460) |
| 336 (22) | door | On the ring plane, the downbeat of bar 22 |

Charge sources: (a) beacons for the cut, the broken well's flight and the first fly-and-dive; (b) the *glint-song*, the *well-song*, the *ring-song* and the *plane-song*, each on its flight's own line (an optional flight spent in an earlier airtime cannot take their charge: C2). The way down's dives are on the beat but optional (without them the held cape or the flight lands later on the same stone); the required dives are the cut and the broken well (and the lid's in the safe use is optional). Every held cape on its own starts with the bar short of full; the loose stars before them are counted.

Platforms (x from–to, y): uranus-gate −700–1101 62; glint-rock 1691–1923 99; glint-lid 1923–2453 99 (lid); glint-floor 1923–3220 226; glint-ledge 2453–2611 99; cut-islet 3490–3630 228; cut-shore 3689–4072 148; glide-rock 4323–5132 232; cache-lid 5203–5586 152 (lid); broken-gate 5940–6759 135; broken-lid 7128–7608 212 (lid); well-floor 7128–7668 488; well-shore 8098–8501 328; ring-gate 8751–9409 412; ring-1 9783–10015 450; ring-2 10275–10507 534; ring-3 10946–11150 582; ring-lid 11150–11453 582 (lid); ring-3b 11453–12058 582; ring-high 12233–12437 422; ring-plane 12801–14347 460. Upper: star-cache 5311–5652 295; ring-islet 10898–10951 550; lid-well 11150–11491 702.

Departures from the brief's IV table: the GET is on 44 (bar 3), as in III; the need is a dive that cuts a flight short (a dive after a flight's end lands only about 25 px earlier than the fall without it, which cannot make the dive required with a runway on the islet); the brief's "today's currents" (interim V) and "broken well" (interim VI) are re-solved here at their own coordinates and stay in the interim levels until V and VI replace them; Movement II's well lid became the ring's lid at the end of the way down (Great Star 2); beacons at 5, 8, 10½, 14½ and 18 (at most 9.8 s apart). IV's own-note band (4.2–5.0/s) is not met: 2.61/s, +17% over III, bed 2.23/s under it.

### V · The Breaking Constellation (112 BPM): a nocturne; cracked stone

No GET: cracked stone (`crumble`) is the world's, and V teaches it with the GET's steps (RESEARCH_PROGRESSION 2.2) all the same. A crack gives way 5/16 of simulation after the first touch-down (`physics.crumbleAfter`), never breathes the cape and gives no bass (it is outside the score). Clock 1.047, shared physics, so IV's cells hold (scripts/arcs.mjs): hold **4: −79.9**, **5: −26.0**, **6: +57.3**; tap **3: +18.0** (a step down); jump, dive at the top (3/16) **5: +149.3**; jump, cape 2 **8: −11.5**; jump, cape 3 **10: +69.9**; jump, jump 3 **8: −100.9**, **10: +106.1**; jump, jump 4 (the late double) **8: −135.1**; a crack's collapse and a fall from rest of 3/16: **+132.6**; a grounded dive through a crack falls 127 px in 1.4/16 (pressed 0.4/16 early, as through IV's lids). Heights follow the main route's landings in order (`VY`).

| k (bar) | Step | What (y) |
| --- | --- | --- |
| 23–28 (2) | warm-up | Off the Saturn gate (150): jump 23 and a dive from its top (26) onto the low islet (299.3) on 28, along the *fall-song*; without the dive the jump lands on it later (about 29.9), off the beat |
| 32–51 (3–4) | safe meeting | A held hop (32) onto the first crack (273.3) on 37; it gives way on 42 and the floor (405.9) catches her on 45 (a walk-off from the islet lands there too: nothing is at stake); a tap (48) steps down onto the beacon's stone (423.9) on 51 |
| 56 (4½) | beacon *tired* | |
| 68–120 (5–8) | need | The second crack: jump 68 onto it (73) and off it (76) before it gives way (78), the ↑ glyph, down onto the isle (82); then land and go: a double (85, 88) up onto crack A (93), two sixteenths on each crack after it: 95 → crack B (100), 102 → crack C (108), 110 → the ridge gate (115), a tap down onto the beacon's stone (117, 120). *crack-song* on the second crack, the isle and the double's rise |
| 120 (8½) | beacon *ridge* | |
| 132–168 (9–11) | develop | The ridge: down onto a small cracked stone (138) and off it by the late double (140, 144) up 135 onto ridge B (148), the *ridge-song* on its rise; down 57 (150, 156), up 26 (158, 163), a tap onto the split beacon's stone (165, 168). Upper: off the ridge gate by a double (116, 119) onto the cracked chain (three cracks over the gate's run, land and go 127, 134, 141; **GS1** on the second), down onto ridge B |
| 168 (11½) | beacon *split* | |
| 180–232 (12–15) | twist | The split voids: jump 180, cape 182 onto the cracked islet (337.6) on 188, no breath there; the required *split-song* (two stars on the flight's line, its descent, the islet, the jump off it, complete on 192) gives the second flight (191, 194) its cape, down onto the far shore (201). Then land and go: 204 → crack S1 (208), a double (211, 214) up onto crack S2 (219), 221 → crack S3 (227), a tap onto the beacon's stone (229, 232) |
| 232 (15½) | beacon *through* | |
| 244–288 (16–19) | twist | Through the stone: a held hop (244) onto a crack (249); a dive through it (249.6, the ↓ glyph) lands on the short stone 127 px under it on 251. Waiting, the crack gives way on 254 and the fall lands on 256.9, past the stone's end. A double up (255, 258) onto the middle stone (263); a jump (267) and a dive from its top (270) through a short crack 40 px under it (broken on 271.3, so the shards snap onto 272 with the landing) onto the stone 149 px under the middle one (272): without the dive she lands on that crack and walks off its end. *stone-song* along it. A double (275, 278) onto crack T (283) and a tap onto the crown gate (285, 288). Upper: the cracked stair over the crown gate (two hops up 80, 291 and 296; **GS3** on the second step), then at once down onto the last crack |
| 288 (19) | beacon *crown* | |
| 300–357 (19–23) | conclude | Up 80 onto the last crack (304); the late double (307, 311) up 135 onto the crown (153.5) on 315, the *crown-song*; **GS2** for an early second press (309). Then the run down, two sixteenths on each crack, no glyph: 317 (c1, 323), 325 (c2, 331), a double 333/336 down 106 (c3, 343), 345 (c4, 351), up 80 onto the ring plain (353, 357); the *plain-song* on the first three |
| 368 (24) | door | On the ring plain, the downbeat of bar 24 |

Platforms (x from–to, y): saturn-gate −700–1101 150; low-islet 1200–1441 299.3; first-crack 1540–1885 273.3 (crumble); crack-floor 1441–2047 405.9; crack-floor-2 2090–2804 423.9; second-crack 2903–3107 397.9 (c); beat-isle 3244–3447 455.2; crack-a 3680–3810 354.3 (c); crack-b 3950–4075 328.3 (c); crack-c 4253–4378 385.6 (c); ridge-gate 4518–4658 359.6; ridge-gate-2 4702–5226 377.6; ridge-stone 5383–5513 434.9 (c); ridge-b 5742–5892 299.8; ridge-c 6070–6194 357.1; split-shore 6335–6475 331.1; split-shore-2 6519–7027 349.1; split-crack 7379–7573 337.6 (c); split-far 7965–8179 407.5; crack-s1 8250–8443 327.6 (c); crack-s2 8676–8806 226.7 (c); crack-s3 8984–9125 284 (c); stone-shore 9168–9693 302; stone-crack-1 9802–10085 276 (c); under-1 9877–10109 403; stone-mid 10322–10563 302.1; stone-crack-2 10686–10818 342.1 (c); under-2 10672–10866 451.4; crack-t 11099–11244 350.5 (c); crown-gate 11288–11812 368.5; last-crack 11884–12077 288.6 (c); crown 12300–12440 153.5; crown-c1 12618–12742 210.8 (c); crown-c2 12920–13061 268.1 (c); crown-c3 13370–13499 374.2 (c); crown-c4 13677–13802 431.5 (c); ring-plain 13900–14896 351.6. Upper: chain-a 4853–5037 258.7, chain-b 5156–5302 232.7, chain-c 5458–5567 290, crown-stair-1 11553–11661 288.6, crown-stair-2 11742–11812 208.7 (all cracked).

**Windows.** The ladder asks V for a narrowest window of 220–290 ms and a median of at least 330 (and no wider than IV's 583). On a stone she lands on and leaves two sixteenths later, a press buffered before the touch-down jumps on it and the lip catches the early landing, so the window's early side is long whatever the lead. V narrows the late side instead: land-and-go stones end 6 px before the takeoff's grid x (a later press is a walk-off and coyote; 6 px keeps a 30 Hz pilot's press on the stone) and their landing leads are 55–60 px. The narrowest window (263 ms) is the split voids' first jump (its stone also ends 6 px early, and an early jump flies under the song's first stars). The dives through the stone are required (skipping them falls past the stone's end); jumping off the crack instead is a player's own way over, not authored.

Charge sources (RESEARCH_PROGRESSION 3.4): (a) the split beacon for the first flight; (b) the *split-song* on the first flight's own line and the jump off the islet for the second. There is no held cape on its own (C1). Great Stars: GS1 on the cracked chain, GS2 the early second press of the late double, GS3 on the cracked stair; none gates (D2).

Departures from the brief's V table: 23 bars (49.3 s) instead of 22, and beacons at 4½, 8½, 11½, 15½ and 19, each lit by a landing on its own half bar (a beacon lights only under a grounded Diana, and the score checks that it does so on the half bar); the beacons' stones run at least 400 px past them, so the steps down are taps just before each beacon. The warm-up's dive is optional (the islet catches both); the ridge is left by the late double and the cracked chain sits over the ridge gate's run, where the main route only runs (above the ridge's own arcs it would be in reach of a long tap). The brief's "ridge", "split voids", "last crack and crown" and "cracked stair" are re-solved at their own coordinates (revision six's geometry used the 0.65 s crumble and the landing rule); revision six's Breaking Constellation, the interim level that held them, is retired. The own-note band of 4.3 (5.0–6.0/s) is not met under the user's restraint: Diana's own notes are 2.98/s (IV 2.61, +14%), the bed 2.15/s (under IV's 2.23).

### VI · Borrowed Wind (118 BPM): storm-bright; the solar wind

No GET: the solar wind is the world's (a column lifts her at 700 px/s² up to 240 px/s, 40% more with the cape held; a flight that enters it ends, and gets its charge back if it began within 0.15 s real; no breath inside it), and VI teaches it with the GET's steps. Clock 1.103; cracks give way 5/16 after the touch-down, as in V. A standard column starts 30 px past the jump's grid x, is 180 px wide, and its body-centre band runs from 307 px over the takeoff's top to 253 under it (a breeze: 160 wide, from 200 over the stone to the stone). Cells (a scratch probe on the real model, dy at k/16 after the jump, up < 0): jump in **9: −154.4**; jump in and again at its top (7) **13: −141.3**; jump in with the cape held **16: −163.7** (gliding 19.6 px a sixteenth down), let go at 12 **15: −53.2**; jump in, cape at its top (6) **12: −147.2**; jump in, dive at its top (6) **8: +16.2**; the breeze with the cape held and let go at 8 lands back on its stone at about 10.8 (23 ms real off the grid); the finale: jump, cape 3, double 9, cape 11 (refilled between) **17: −16.8**; plus V's hold, tap, double and jump-and-dive cells. Heights follow the main route's landings in order (`JY`); the crack runs descend so the wind's climbs stay inside the world.

| k (bar) | Step | What |
| --- | --- | --- |
| 23–47 (2–3) | warm-up | Cracks, land and go: 23 down onto crack 1 (29), a double (31, 34) onto crack 2 (39), 41 down onto the breeze stone (47) |
| 50–72 (4–5) | safe first use | The hearth breeze over solid stone: jump 50 into it holding the cape (the optional ↑ · hold → glyph), it lifts her, let go (58) and she lands on the same stone (about 60.8), along the *breeze-song*; the helper rides it ahead (`moment` *helper-breeze*). Running on, nothing happens. A tap (69) onto the beacon's stone |
| 72 (5½) | beacon *breeze* | A breeze over the beacon's stone: an optional hop (73) lands on the beat 9/16 later with a star at its top (as after every beacon) |
| 84–123 (6–8) | need | The first wind: jump into it (84, the ↑ glyph) and again at its top (91): she lands 141 px up on the lifted shore (97), where no jump reaches. Land and go: 99 onto crack L1, a double (107, 110) down onto crack L2 (117), 119 onto the bridge gate (123) |
| 125–144 (8–10) | develop | The glide bridge: jump 125 into its column, the cape held (the hold → glyph), glide past its top and let go (137) over the far shore (140); without the cape the jump comes down short of it. A tap (141) onto the beacon's stone. Upper: a flight out of the column's top (131) onto the ledge over the bridge (**GS2**) |
| 144 (10) | beacon *bridge* | |
| 156–215 (10–14) | twist | Out of the top: jump 156 into the column, the *wind-song* on its rise, the cape at its top (162, the → glyph) onto the column shore (168); the song gives the cape back in the wind, so a flight spent in the airtime before (or pressed just before the column and refunded) never empties this one. Upper: the cape held in the column takes **GS1** at its top. Land and go: 170, a double (178, 181), 190. Wind, dive, wind: jump into column D (196), dive out of its top (202) onto the islet (204), jump into column E (206) up onto the storm shore (215), the *storm-song*. Upper: the cape held in E takes **GS3** at its top and floats onto the storm shore (let go at 212) |
| 216 (14½) | beacon *storm* | |
| 228–287 (15–18) | conclude | The finale: a hop onto the launch stone (233); jump 235 and the cape at its top (238), charged by the required *launch-song* (the hop, the stone, the jump's rise, complete on 236); the double (244) and the required *finale-song* (the first flight's line and the double, complete on 244) charge the second flight (246), down onto the finale shore (252); the finale wind (254) lifts her onto the high stone (263); a jump and a dive from its top (265, 268) onto stone H1 (stable: a dive smashes a crack it lands on), a double (272, 275) onto crack H2, a tap onto the last beacon's stone (284, 287) |
| 288 (19) | beacon *last* | |
| 300–356 (19–23) | conclude | The last wind: jump into column F (300), dive out of its top (306) onto the islet (308), jump into column G (310) with the cape held, let go (322) over the shore (325), the *last-song*; then cracks down, no glyph (327, a double 335/338, 347) and a tap onto the plain of Jupiter's storm (353, 356) |
| 368 (24) | door | On the storm plain, the downbeat of bar 24 |

Platforms (x from–to, y): jupiter-gate −700–1101 515; w-crack-1 1263–1387 572.3 (c); w-crack-2 1636–1766 471.4 (c); breeze-stone 1944–2842 528.7; breeze-stone-2 2885–3409 546.7; lifted-shore 3811–3961 405.4; l-crack-1 4139–4264 462.7 (c); l-crack-2 4578–4718 568.7 (c); bridge-gate 4821–4961 488.8; bridge-shore 5449–5567 435.6; bridge-shore-2 5610–6135 453.6; column-shore 6612–6762 306.4; c-crack-1 6940–7065 363.7 (c); c-crack-2 7379–7519 469.7 (c); dive-gate 7621–7762 389.8; dive-islet 8005–8125 406; storm-shore 8391–8973 251.6; finale-launch 9093–9222 225.6; finale-shore 10009–10185 208.8; finale-high 10435–10585 54.4; h-stone-1 10725–10850 203.7; h-crack-2 11164–11304 309.7 (c); high-shore 11364–11926 327.7; f-islet 12168–12288 343.9; g-shore 12792–12932 290.7; g-crack-1 13110–13234 348 (c); g-crack-2 13549–13689 454 (c); g-crack-3 13791–13916 374.1 (c); storm-plain 13975–15009 392.1. Upper: bridge-ledge 5610–5800 294.3. Wind (x): hearth-breeze 2143–2303; breeze-1 3013–3173; first-wind 3429–3609; bridge-wind 4981–5161; breeze-2 5738–5898; top-wind 6155–6335; dive-wind 7782–7962; storm-wind 8161–8341; breeze-3 8577–8737; finale-wind 10205–10385; breeze-4 11529–11689; last-wind-f 11946–12126; last-wind-g 12324–12504.

**The wind refund.** VI's ability route presses the cape just before the fly-out column (a player's natural mistake): the wind ends that flight within 0.15 s and gives the charge back, and the flight out of the top still flies (tested on the real route, with no step-up). Every held cape starts inside a column (in the wind the cape glides, so a full bar never flies there: C1).

**Windows.** Narrowest 204 ms (the finale's second flight's jump and its first flight at the jump's top: the launch-song closes two sixteenths before it and the flight line must meet the finale-song), median 537 ms; land-and-go stones end 6 px before their takeoff, as in V.

Charge sources: (a) the bridge beacon and the *wind-song* for the fly-out; (b) the *launch-song* and the *finale-song*, each on its flight's own line. Great Stars: GS1 at the top of the fly-out wind and GS3 at the top of the storm wind (only a held cape climbs that high; the main route's jump peaks 76 px under them), GS2 on the ledge over the glide bridge; none gates (D2).

Departures from the brief's VI table: 23 bars (46.8 s) and four beacons (5½, 10, 14½, 19, each lit by a landing on its half bar, at most 10.2 s apart) instead of six, so that VI reaches the ladder's 2.2 inputs a bar; the beacons' runs carry optional breeze hops instead. The warm-up's cracks come in bar 2 (the title card covers bar 1). Revision six's currents (part 2) are not reused (IV re-solved the currents as the cut); the twist is new: out of the top, and wind, dive, wind. The finale's launch is stable stone, not a crack: a crack there would have no catch and its next stone 786 px on (the fragile-surfaces test); the low safe line is not built (VI has no separate safe route: the safe route is the main one). GS1 and GS3 sit in the fly-out and storm winds, not the finale's and the last wind (a held cape in the last wind is the main route's own line there). The own-note band of 4.3 (6.0–7.0/s) is not met: 3.95/s (V 2.98, +33%), bed 2.12/s, under V's.

### VII · The Falling Road (123 BPM): tense; the beat cascade

No GET: the beat cascade is the world's. Once Diana first touches a road (`cascades`), its tiles drop one per `interval` behind her, the first when her nominal run is `lead` px past tile 0's start, so every drop is on a beat (the tiles' knock is the world's marimba; her touch-down on a tile is her own stone-marimba note). A `null` in a road's tile list is a missing tile: its beat passes with no knock. Tiles are drawn cracks: they never breathe the cape and a dive smashes them, so VII's dives land on stable stones between tiles (the brief's "a dive keeps the rhythm"). Clock 1.150; shared physics and cracks (5/16), so V and VI's cells hold. Bounce tiles sit 5-6 px over the arc's grid height (+51 for a 6/16 hop down, -31 for 5/16 up, -84 for 4/16, -140 for a double's 8/16) so the touch-down comes a little early and the next jump leaves on the grid. New cells (scripts/arcs.mjs and a refill probe): jump, double 4, cape 6: **14: +120.6**; jump, double 3, leaf star, jump 6: **11: -181.2**; jump, cape 2: **8: -11.5**. Heights follow the main route's landings in order (`RY`).

| k (bar) | Step | What |
| --- | --- | --- |
| 23-36 (2-3) | warm-up | Jump into the warm wind (23) and again at its top (30): up 141 onto the warm shore |
| 38-62 (3-4) | safe first use | The first road: three tiles step down 51 px a 6/16 hop over the road's floor; a missed bounce falls onto the floor, nothing is lost (*road-song*) |
| 64 (5) | beacon *road* | A breeze over the floor (optional hop) |
| 76-118 (5-8) | need | Off the floor by a double onto the six-tile wave (the ↑ glyph), bounces of 6 and 5 sixteenths, down 51 and up 31 (*wave-song*); the wave closes in 2 then 1 sixteenth a tile |
| 120-133 (8-9) | | Into the lift wind and again at its top, up onto the road shore |
| 136 (9½) | beacon *wave* | A tap down and a breeze, optional |
| 147-189 (10-12) | develop | Cascade and dive: off the shore by a double onto c0; from each tile a jump and a dive at its top (the ↓ glyph) land on the stable stone 149 px under it on the beat; a full arc comes down 56 px past its end. Off each stone at once a hop climbs 84 px onto the next tile (*dive-song*). A double up onto the dive shore. **GS1**: off the last tile a double and a flight instead of the dive |
| 200 (12½) | beacon *dive* | |
| 211-246 (13-16) | twist | The missing tiles: hop onto d0; its next tile is gone: jump and fly (the → glyph) onto d2; the next is gone too: jump, double on the *gap-song*'s last star (the double's point on the falling arc) and fly onto d4, a small tile (40 px before its landing, 30 after; the narrowest window, 203 ms); bounce onto d5. **GS2**: a jump in the first flight (it ends the flight, which still lands on d2) |
| 251-266 (16-17) | twist (leaf need) | Up onto the crack k1, jump and double; a lit leaf star at the double's top gives the air jump back, and a third jump climbs 185 px onto k2 |
| 272 (17) | beacon *gap* | |
| 278-301 (18-19) | conclude | Flights on starlight (the owner's brief): the *spark-song* on the shore's run and rise, jump and fly onto the crack ka (no breath; four loose stars on the way show half a bar); a lit cape star on ka's jump charges the second flight onto the red stone |
| 303-340 (19-22) | conclude | The last road: four tiles, and from the last into Mars's wind with the cape held (the ↑ · hold → glyph); let go over Mars's shore. **GS3**: a jump at the wind's top. Over the shore, the super-jump lock: a ledge with a star 300 px up that no double and flight reach |
| 344 (22) | beacon *mars* | A tap down and a breeze, optional |
| 355-387 (23-25) | finish | The road home, no glyph: three tiles, the last stone, a double up onto Mars's plain (*home-song*) |
| 400 (26) | door | On Mars's plain, the downbeat of bar 26 |

Beacon gaps 7.8 / 8.8 / 7.8 / 9.5 / 9.5 / 6.8 s real (≤ 10). Charge sources (RESEARCH_PROGRESSION 3.4): (a) the *dive* beacon for the first missing tile (the only airtime before it is the hop onto d0, and a flight spent there falls into the first gap); (b) the required *gap-song* for the second; the *gap* beacon and the *spark-song* for the first flight on starlight; (refill) the required cape star `cape-ka` for the second. The leaf star `leaf-k1` is VII's required leaf. Removing either required refill fails at its gap, after its beacon (tested). Great Stars: GS1 above the dive road's end, GS2 over the first missing tile, GS3 at the top of Mars's wind; none gates (D2).

**Ladder (L3):** narrowest 203 ms (VI 204), median 428 (VI 537), 63 inputs in 25 bars = 2.52 a bar (VI 2.26), peak 5, beacon gap 9.5 s. **Music:** preset `falling-road`; Diana's own notes 4.39/s (VI 3.95, +11%), bed 1.91/s (VI 2.12), clave on 3 of 25 bars.

Departures from the brief's VII table: 25 bars and five beacons (5, 9½, 12½, 17, 22) instead of six, each lit by a landing on or before its beat (the beacons' runs carry optional breezes and taps); the six-tile wave is re-solved to exact cells (not copied); the dives land on stable stones (a dive smashes a tile); the missing tile is two missing tiles, the second charged by a required song (it gives the narrowest window) rather than a long stable run; the "cracks under the landing" are the cracked k1 and ka the flights reach; the leaf need is 3¾ bars after the *dive* beacon (the missing tiles come first; RESEARCH_REFILLS asks 2½). The addendum's sky road over the last road (two cape stars, three flights toward the lock) is not built yet. The brief's full backbeat and the onset band of 4.3 (7-8/s) are not adopted, under the user's restraint.

## Interim level VIII (revision six's IV) and the retired interim levels

### Retired: Borrowed Wind (107 BPM, revision six's II), interim until VI was built

Added (2026-11-10): **the void again** (cut after the hearth void: it lands on a copy of the wind shore along its star line, a 4/16 hop climbs 80 px onto a second hearth, and the same void follows without stars; two bars); **the glide bridge** (beacon *bridge*; jump at 16th 540 into a column with the cape held, glide past its top across a void: no-glide runs come down about 150 px short, the held cape lands 20/16 after the jump on the grid; four bars); **the currents** (beacon *currents*; jump and flight, the flight ends over a low islet and a dive at 7/16 lands 44 px down 1/16 later; a jump into a column that carries Diana past the island beneath it, a dive at 16th 554 lands on it 1/16 later; jump and flight up 69 px onto the exit shore; three bars and two flights).

Movement III at its own coordinates; Diana wakes on the hearth at chapter sixteenth 360 (a half bar: the score enters on a pickup and the door falls on bar 14). Changes: the split voids are one **long void** (takeoff 16003.45: jump, flight at 3/16, the four-star *void-song* along the flight refills the cape, flight at 9/16, landing 14/16 later 15 px lower on the far rock); a tap from the far rock lands on the wind gate 4/16 later. **GS2** sits above the void for a double jump between the flights. The finale's cracked launch became stable rock (no cracked stone before III). **GS1** is in the star cache under the second lid (the dive); **GS3** at the top of the finale wind, reached only with the cape held in it.

### Retired: The Breaking Constellation (118 BPM, revision six's III), interim until V was built

Added (2026-11-10): Movement II's lid is optional again (the main route runs over it; GS2 in its well). **The broken well**, after the crown's late double (beacon *broken*): jump and flight onto a 520 px cracked lid (it never refills the cape); the well under it is 276 px deep, deeper than the 265 px a walk-off survives, so walking, jumping or double jumping off the lid's end dies, while a dive through the lid lowers the allowance by `RULES.smashDrop` (120 px) and lands on the floor (dive half a sixteenth past the grid: the 2.6/16 fall lands on it); the floor refills the cape: jump, second press 3/16 later, flight 3/16 after that, 606 px out onto the far shore 13/16 later; a hop onto a copy of the last crack and the crown's late double. Four bars, two flights; the rest sits 28 px lower. The paragraph below describes the first version.

Movement II plus the hearth void and the split voids, at their own coordinates, from chapter sixteenth 160. Cracks break 5/16 after touch-down; the first crack's floor moved to 129 px below it so the fall lands 3/16 after the break, and a 4/16 hop climbs 80 px to the second crack. The upper path ends at the lid: the main route dives through it on the grid (k 285), lands in the well 95 px down 1/16 later, and leaves with a double jump (second press 4/16 later) straight up 76 px onto the second tile, 9/16 later, the same touch-down as Movement II's bounce; the cascade has five tiles (its first drops when the chapter's second did). **GS1** on the cracked chain, **GS2** for an early (3/16) second press out of the well, **GS3** on a two-step cracked stair above the crown. The split voids' constellation is required (cracks never refill). The door is on wind-gate's rock, bar 20.

### VIII (interim) · The Far Door (128 BPM, revision six's IV): agitated, precise but fair

Added (2026-11-10): **the voids at 128** after the crown (Movement III's hearth void and split voids translated so their first takeoff is the hearth's, at 16th 206; beacon *voids*; the split-song refill is required; the finale follows 159 px lower) and **the rising stair** before the door (beacon *stair*; two double jumps, second press 4/16 after the first, 135 px up each, along the six-star stair-song; the walk-off from the top step lands on the door island as from the finale's high shore).

The school: from the storm floor, jump, open the cape 2/16 later and jump again 2/16 into the flight (super jump, apex 267 px at 7/16, 233 px up at 9/16) onto a high shore; the floor runs on underneath, and a plain jump climbs from it to the step. The stable school shore gives the cape back for a second super jump (**GS3** at its apex). After the beacon *storm* the same super jump is required across a void to a shore 233 px up. Then Movement II's well and cascade (translated so chapter sixteenth 264 lands on 88, whole bars earlier, so every tile still drops on a beat; **GS1** for a super jump off the wave's end landing on the last crack 11/16 later, **GS2** in the well under the lid) and Movement III's finale with its cracked launch and low safe line (translated so chapter sixteenth 490 is 202; the door is on bar 18). Earth and the recording wait behind this door only.

# A Signal in the Dark (the chapter, revision five: source material)

This described what `level.mjs` implemented (2026-11-09, revision five: the map re-timed on the soundtrack's 107 BPM grid), following the approved briefs in [RESEARCH.md](./RESEARCH.md) and [RESEARCH_MUSIC.md](./RESEARCH_MUSIC.md). Where the build departs from a brief, the reason is given. The [Beat map](#beat-map-revision-five) section explains the grid; the tables below are current.

## Structure

Three movements of one idea each, plus a coda (kishōtenketsu: introduce, develop, twist, conclude):

- **I · Waking — the jump.** Tap and hold, four hops on the 107 BPM grid, then the second jump for distance and for height.
- **II · The Breaking Constellation — crumble.** Shelves that break under Diana, a chain over a safe ridge, the dive-smash lid, the beat cascade, and a double jump off a breaking shelf.
- **III · Borrowed Wind — the cape.** A flight line, a required midair refill, the solar wind and the super jump, then everything at once with a safe line beneath.
- **Coda · The Far Door.** A long calm island.

Times below are the main route's real times on the beat map (bar 1 starts at the wake; a bar is 2.243 s). The finish is at x = 21984, reached on the downbeat of bar 36 at 78.51 s; the four QA routes take 78.45–79.35 s, so the root QA budget (`maxSeconds ?? 85`) still completes the chapter. Nominal time `(x − 220) / 270` is still what the fairness tests use for beacon spacing and telegraphs.

## Units and envelope

World px, y down; a platform's y is its walkable top and Diana's y is her feet (32 × 58 px body). Measured with the same 1/120 s integrator, taking off at an edge:

| Rule | Value | Envelope (physical) | Main-route authoring limit |
| --- | --- | --- | --- |
| Run | 270 px/s | — | — |
| Gravity | 1500 px/s² | — | — |
| Jump | 570 px/s (tap: capped to 280) | 205 px flat, 106 px rise; tap 106 px, 30 px | 170 px gap, 90 px rise; tap 80 px |
| Double jump | 525 px/s | up to 373 px flat, 196 px rise | 280 px gap, 165 px rise |
| Flight | exactly 0.5 s, vy = 0, +227.1 px/s (113.55 px = 3/16 of run) | jump + flight ≈ 450 px | 400 px gap |
| Super jump | jump during flight: 720 px/s, once per flight | ≈ 173 px rise | optional lines only |
| Glide | hold cape: 350 px/s², fall ≤ 140 px/s | — | taught only in the wind |
| Updraft | −700 px/s² net, rise ≤ 240 px/s; ×1.4 while gliding | 180 px column: +106 px walking in, +186 gliding, +231 jumping in | — |
| Dive | ≥ 700 px/s down; through cracks ≥ 500 px/s | — | — |
| Crumble | collapses 0.65 s after first landing | — | — |
| Cascade | one tile per 107 BPM beat, 207 px pitch | — | bounce of 5 and 6 sixteenths |
| Coyote / buffer | 0.12 s / 0.14 s | — | — |
| Lip catch / step-up | arriving ≤ 25 px under a lip; topping out ≤ 20 px under a top with the body ≥ 10 px over it | jumps and flights only | the main route needs neither (tested) |

Every required landing leaves ≥ 135 px of runway; every beacon leaves ≥ 400 px before the next required input (tested). Drops on any intended line stay under 240 px so the camera shows the landing and the death line never cuts a catch (tested).

## Beat map (revision five)

The user asked for the music to "draw itself, harmonically, exactly where it should" when the intended path is followed. The brief's answer (RESEARCH_MUSIC 5.2–5.3) is to author the main route on the soundtrack's grid. Before this revision the map was at chance level: 54% of the main route's musical events were within 35 ms of a 107 BPM sixteenth (chance 50%).

**Grid.** 107 BPM (measured from `assets/soundtrack.mp3`), beat 0 at the wake. A sixteenth is 15/107 s = 140.19 ms = 37.85 px of run; a beat 151.4 px; a bar 605.6 px and 2.243 s. Because a full flight now adds exactly 113.55 px (three sixteenths, `dashSpeed` 227.1 px/s over exactly 0.5 s), every grid moment on the ground is at x = 220 + 37.85 k, flights included. Takeoff thresholds in `tests/routes.mjs` sit on that lattice, half a pixel early.

**Rhythm cells** (measured with the 1/120 s integrator; takeoff on the grid, landing height relative to takeoff):

| Move | Lands on the grid at |
| --- | --- |
| Full jump | +84 px at 4/16 · +31 px at 5/16 · −51 px at 6/16 · −163 px at 7/16 (flat ground lands 59 ms off, so no main hop is flat) |
| Double, second press at 3/16 | +166 px at 7/16 (the climb) |
| Double, second press at 4/16 | +142 px at 8/16 (onto the hearth) · −5 px at 10/16 (the leap) |
| Double, second press at 5/16 | −58 px at 11/16 (down to the long landing) |
| Cape at 2/16 | +14 px at 8/16 after takeoff (flight A) |
| Cape at 3/16 | −67 px at 10/16 (the hearth void, flight B) |

Heights were solved by a scratch harness that moved each landing platform until its landing sat on the planned sixteenth, then rounded to whole pixels; the cascade's alternating heights come straight from the cells.

**Main-route timeline** (bars are 1-based; `score.mjs` maps them to chords):

| Bars | Place | What lands on the grid |
| --- | --- | --- |
| 1–2 | Wake, home | first jump at sixteenth 23 |
| 3–4 | The hops | takeoffs 32, 40, 50, 64; the first constellation on 44, 48, 52, 56 (the motif's head D5 C♯5 B4 A4) |
| 5½ | Beacon *leap* (sixteenth 72) | the leap: jump 82, second jump 86, land 92 |
| 7–10 | Climb, crown, long landing | the double climb 112 / 115 / 119; climb-song on 113, 115, 117, 120 |
| 11 | Card II (160) | lands on gate-2 at 162 |
| 11½ | Beacon *breaking* (168) | first crack lands 187, falls to the floor at 194 |
| 15–17 | The ridge | 8 sixteenths shorter than before (see below) |
| 17½ | Beacon *well* (264) | |
| 19½–21¾ | The cascade | the bounce lands 299, 305, 310, 316, 321, 327, 333; tiles drop on 312, 316, … 332 (beats) |
| 23½ | Beacon *hearth* + card III (360) | the double off the last crack lands on the hearth on 360 |
| 26 | Beacon *voids* (400) | the hearth flight lands on it; flight-line on 392–398 |
| 27–28 | Two voids | split-song on 417, 419, 421, 424, 428; flight B at 429 |
| 29 | Beacon *updraft* (448) | lands on the beacon |
| 32 | Beacon *finale* (496) | lands on the beacon |
| 33–35 | Finale, coda (544) | finale-song 521–524; the walk-off lands on the door island at 548 |
| 36 | The far door (560) | win on the downbeat |

**Constraints that shaped it.**
- *Beacon spacing.* Leap (sixteenth 72) to the old well beacon (272) was 200 sixteenths, and one beacon in between cannot keep both gaps at or under 99 sixteenths (14 s). The ridge gave up eight sixteenths of ground (beat-isle and ridge-c are 151.4 px shorter each, which keeps the lattice) and the hearth got them back as calm after its beacon, so everything after the hearth is where it was. Every beacon is still on a half bar, at most 13.5 s apart.
- *The cascade at 107 BPM* (brief: 207 px pitch). A full jump covers about one pitch, so the line is a bounce: hops of 5 and 6 sixteenths alternate, up 31 and down 51 px, and every touch-down is the next takeoff. `lead` 551 puts the main route's first drop on beat 3 of bar 20 (sixteenth 312) and every drop on a beat; the bouncing line leaves tile k 13, 11, 10, 8, 7 and 5 sixteenths before it falls (tested), so the wave closes in visibly and a player can be about 0.1 s late on each hop. The tiles are 150 px with 57 px gaps.
- *The hearth.* Landing on it at the top of a double jump was fragile (the integrator's apex is a few px short, and a 30 Hz press misses), so the wave ends 51 px down, a 4/16 hop rises 84 px onto the last crack and a standard late double (4/16 + 4/16, still descending) climbs 139 px onto the hearth.
- *The first crack's floor* sits 80 px below it so the fall after the 0.65 s crumble lands seven sixteenths after the touch-down.
- *The optional cracked chain* over the ridge rose with it and stays more than 25 px above every main-line arc, so a ridge hop never lip-catches onto it.
- *Model precision fixes* that the grid needed: flights last exactly 0.5 s at every sampling rate (the last substep used to be dropped), and crumble / cascade collapses run in their own pass before collisions (a tile sorted after the surface Diana stood on used to drop seconds late).

**Audit** (`npm run score:bake`, `scripts/bake-score.mjs`): the main pilot at 120 Hz produces 171 anchors (38 jumps, 5 double jumps, 5 cape presses, 40 landings, 41 stars, 21 chain notes, 5 completions, 7 beacons, 3 movement cards, 6 tile drops); worst 16.5 ms. All are within 35 ms at 60, 120 and 240 Hz (tested); at 30 Hz the pilot only acts every 33 ms, and the test allows that sampling on top. The bake writes `score-path.mjs` (x → sixteenth every 25 px, every anchor, a hash of `level.mjs`, `model.mjs` and `tests/routes.mjs`); a stale table fails the tests. After any geometry or pilot change: `npm run score:bake`, then `npm test`.

**Root QA screenshots.** The chosen times still show their beats and nobody is dead: 26 s (low, in the air over the first crack), 40.6 s (mastery, in the star well), 45 s (low, on tile 4), 66 s (ability, just out of the solar wind over the lifted shore), 76 s (ability, on `finale-high` with the door ahead). Slightly better frames: 26.4 s (standing on the first crack), 65.3 s (inside the column) and 77 s (on the door island).

## Fix round after the first real-input playtest (2026-11-09)

The playtester's findings and what changed: the updraft "hold →" no longer starts a level dash under the shore (no dash inside wind; a flight entering wind ends; one glyph at a time); near-miss jumps pop onto island lips (≤ 25 px, never for walk-offs) and lips are trimmed to the colliders; grey now only means "breaking now", optional stone has a dotted rim, lids a star-shaped break; the first gap was 90 px flat (full jump from x 960–1110, 0 ms tap from 1060–1110; revision five makes it 105 px with a 44 px drop); the opening hops and the ridge vary; the cascade wave now outruns Diana; a second lid on the lifted shore opens a star cache and a breeze over the hearth teaches glide; stars inside the hearth and in voids were moved and every star is pilot-reachable; story lines sit on ink plates; the Saturn limb is gone (rings only); completion lines are hairlines between collected stars; world stars are always filled; a tiny Earth glint pulses the signal ahead. Tables below are current.

## Platforms

`type`: crumble (breaks 0.65 s after the first landing), lid (holds a run, breaks under a dive), cascade (drops on the beat wave), alt (optional mastery or safe line). Untyped = stable stone.

| id | x | end | y | width | type | main landing: sixteenth (bar) |
| --- | --- | --- | --- | --- | --- | --- |
| `home` | -700 | 1100 | 540 | 1800 |  |  |
| `hop-a` | 1205 | 1450 | 584 | 245 |  | 29 (bar 2.81) |
| `hop-b` | 1540 | 1760 | 501 | 220 |  | 36 (bar 3.25) |
| `hop-c` | 1840 | 2140 | 478 | 300 |  | 45 (bar 3.82) |
| `hop-d` | 2260 | 2710 | 527 | 450 |  | 56 (bar 4.50) |
| `leap-shore` | 2790 | 3350 | 496 | 560 |  | 69 (bar 5.31) |
| `far-shore` | 3610 | 4000 | 503 | 390 |  | 92 (bar 6.75) |
| `gs1-ledge` | 4080 | 4280 | 320 | 200 | alt |  |
| `climb-base` | 4110 | 4490 | 553 | 380 |  | 104 (bar 7.50) |
| `climb-crown` | 4630 | 5030 | 391 | 400 |  | 119 (bar 8.44) |
| `crown-step` | 5110 | 5380 | 359 | 270 |  | 131 (bar 9.18) |
| `high-crown` | 5420 | 5590 | 215 | 170 | alt |  |
| `long-landing` | 5620 | 6140 | 421 | 520 |  | 147 (bar 10.19) |
| `gate-2` | 6260 | 7120 | 471 | 860 |  | 162 (bar 11.12) |
| `crack-floor` | 7150 | 7800 | 520 | 650 |  | 194 (bar 13.12) |
| `first-crack` | 7190 | 7520 | 440 | 330 | crumble | 187 (bar 12.69) |
| `second-crack` | 7900 | 8200 | 489 | 300 | crumble | 205 (bar 13.81) |
| `beat-isle` | 8220 | 8548.6 | 457 | 328.6 |  | 213 (bar 14.31) |
| `ridge-a` | 8668.6 | 9028.6 | 425 | 360 |  | 225 (bar 15.06) |
| `chain-a` | 8728.6 | 8928.6 | 297 | 200 | crumble (alt) |  |
| `chain-b` | 9058.6 | 9258.6 | 277 | 200 | crumble (alt) |  |
| `ridge-stone` | 9148.6 | 9268.6 | 476 | 120 |  | 238 (bar 15.88) |
| `ridge-b` | 9328.6 | 9648.6 | 444 | 320 |  | 243 (bar 16.19) |
| `chain-c` | 9388.6 | 9588.6 | 297 | 200 | crumble (alt) |  |
| `chain-exit` | 9728.6 | 9948.6 | 297 | 220 | alt |  |
| `ridge-c` | 9748.6 | 9997.2 | 413 | 248.6 |  | 253 (bar 16.82) |
| `b3-isle` | 10117.2 | 10677.2 | 464 | 560 |  | 264 (bar 17.50) |
| `well-rim-a` | 10797.2 | 10917.2 | 432 | 120 |  | 281 (bar 18.56) |
| `well-floor` | 10847.2 | 11367.2 | 640 | 520 | alt |  |
| `lid` | 10917.2 | 11137.2 | 432 | 220 | lid |  |
| `well-rim-b` | 11137.2 | 11397.2 | 432 | 260 |  |  |
| `well-exit` | 11397.2 | 11607.2 | 530 | 210 | alt |  |
| `tile-0` | 11477.2 | 11627.2 | 400 | 150 | cascade | 299 (bar 19.69) |
| `tile-1` | 11684.2 | 11834.2 | 451 | 150 | cascade | 305 (bar 20.06) |
| `tile-2` | 11891.2 | 12041.2 | 419 | 150 | cascade | 310 (bar 20.37) |
| `tile-3` | 12098.2 | 12248.2 | 468 | 150 | cascade | 316 (bar 20.75) |
| `tile-4` | 12305.2 | 12455.2 | 437 | 150 | cascade | 321 (bar 21.07) |
| `tile-5` | 12512.2 | 12662.2 | 489 | 150 | cascade | 327 (bar 21.44) |
| `cascade-end` | 12719.2 | 13357.2 | 540 | 638 |  | 333 (bar 21.81) |
| `last-crack` | 13467.2 | 13767.2 | 458 | 300 | crumble | 351 (bar 22.94) |
| `hearth` | 13817.2 | 15060 | 319 | 1242.8 |  | 360 (bar 23.50) |
| `wind-shore` | 15435 | 16020 | 377 | 585 |  | 400 (bar 26.00) |
| `split-crack` | 16380 | 16590 | 360 | 210 | crumble | 422 (bar 27.37) |
| `split-far` | 16950 | 17330 | 427 | 380 |  | 436 (bar 28.25) |
| `wind-gate` | 17450 | 18070 | 478 | 620 |  | 448 (bar 29.00) |
| `lifted-shore` | 18370 | 18560 | 311 | 190 |  | 471 (bar 30.44) |
| `star-cache` | 18520 | 18900 | 470 | 380 | alt |  |
| `lid-2` | 18560 | 18810 | 311 | 250 | lid |  |
| `lifted-down` | 18930 | 19230 | 360 | 300 |  | 488 (bar 31.50) |
| `finale-gate` | 19314 | 19870 | 412 | 556 |  | 496 (bar 32.00) |
| `finale-crack` | 19990 | 20190 | 381 | 200 | crumble | 515 (bar 33.19) |
| `low-a` | 20190 | 20450 | 560 | 260 | alt (safe line) |  |
| `low-b` | 20560 | 21100 | 560 | 540 | alt (safe line) |  |
| `finale-high` | 21080 | 21402 | 340 | 322 |  | 539 (bar 34.69) |
| `low-c` | 21210 | 21410 | 560 | 200 | alt (safe line) |  |
| `far-door` | 21440 | 22740 | 470 | 1300 |  | 548 (bar 35.25) |

56 platforms (44 main, 12 alternate): 8 crumbling shelves, 2 lids, 6 cascade tiles. 90 stars, 30 of them in 7 constellations, plus 3 Great Fallen Stars; two updrafts plus the hearth breeze.

## Beat by beat

### I · Waking (bars 1–10, 0–22.4 s)

- **Introduce.** The title is the start island seen from the centre; the sprout (Diana's leaves) wakes into the start clip and the camera eases to the run framing. 2.6 s of flat ground. Three stars at tap height (y 437–442, a 30 px hop reaches them) and three at hold height (y 372–378, only a held jump). Stars teach; nothing is locked.
- **Develop.** Four hops on the grid (takeoff sixteenths 23, 32, 40, 50, 64): down 44 px over the forgiving 105 px gap (a 0 ms tap clears it, walking off does not), up 83 px onto a rock, up 23 px, down 49 px to the long island. *first-song* (4 stars, sixteenths 44–56) plays the soundtrack's motif head D5 C♯5 B4 A4 across hops b and c.
- **Beacon *leap*** (x 2943, bar 5½, 10.1 s).
- **Twist.** `leap-shore → far-shore` is a 260 px gap (7 px down): one full jump reaches about 237 px with the body overlap, so a second jump is needed, and it must come late enough to carry distance (the pilot presses it 4/16 after the first). Glyph ↑ ↑. Great Star 1 sits above `gs1-ledge` (y 320), reached by an early double jump off the far shore and visible from the main route.
- **Conclude.** A 50 px drop, the 162 px double climb (`climb-base → climb-crown`, second press 3/16 in; *climb-song* traces it), a 32 px hop up to `crown-step`, and a late double (5/16 + 6/16) down 62 px to `long-landing`. An early double instead lands on the optional `high-crown` (three upper stars) and drops back.

### II · The Breaking Constellation (bars 11–23, 22.4–50.5 s)

- **Card II** at x 6276, on the downbeat of bar 11 as Diana drops onto `gate-2`, finishing before the first input (tested; cards, story lines and tips are timed in simulation seconds). **Beacon *breaking*** (6577, bar 11½, 23.5 s).
- **Introduce.** `first-crack` (330 px) is long enough that the 0.65 s crumble always breaks under a runner; `crack-floor` 80 px below catches her seven sixteenths after the touch-down (tested). `second-crack` (300 px) breaks about 175 px after landing, so the jump must come before it, toward `beat-isle`. Glyph ↑.
- **Develop.** A stable ridge: a wide island, a drop onto the small `ridge-stone` and straight off it, then two rises; above it the optional chain of three cracked shelves (y 277–297) and `chain-exit`, from which the mastery line jumps on to `b3-isle`.
- **Beacon *well*** (10211, bar 17½, 37.0 s).
- **Twist 1, the lid.** `well-rim-a | lid | well-rim-b` form one continuous floor; the lid glints with starlight through its cracks and a dim optional ↓ glyph floats over it. A dive breaks it (instantly, ≥ 500 px/s carry) onto `well-floor` 170 px below: Great Star 2 and *well-song* (5 stars) lead along the floor and up the exit arc onto the cascade. Running across leaves the lid whole.
- **Twist 2, the beat cascade.** Six 150 px tiles with 57 px gaps (207 px pitch), stepping up 31 and down 51 px in turn. On first contact the wave is anchored to tile 0, which drops when Diana's nominal position is 551 px past its start; each later tile drops one 107 BPM beat (0.561 s) after the previous one, shaking for its last 0.35 s. The wave travels 369 px/s against her 270, gaining 55.6 px a beat. A full jump spans about one pitch, so the intended line is a bounce: every touch-down is the next takeoff, in hops of 5 and 6 sixteenths. The bouncing line leaves each tile 13 down to 5 sixteenths before it falls; a runner who lingers or hops late is caught (both tested).
- **Conclude.** The wave ends 51 px down on `cascade-end`; a 4/16 hop climbs 82 px onto `last-crack`, which breaks 0.65 s after landing, and a late double jump from it (4/16 + 4/16) climbs 139 px to the hearth crown.

### III · Borrowed Wind (bars 23½–34, 50.5–76.3 s)

- **Beacon *hearth*** (13843, bar 23½, 50.5 s) and **card III**, as Diana lands: four calm seconds and a story line (the hearth took back the ridge's eight sixteenths).
- **Introduce.** A 375 px void from the 319 px-high hearth. Glyph ↑ · →. *flight-line* (4 stars, sixteenths 392–398) lies on the flight altitude of a cape opened 3/16 after the jump; completing it re-inks the cape midair, so the player sees the refill rule before it is needed. Without the cape the main line dies in the void (tested); a frame-perfect late double from the very lip can also reach the far shore, as in earlier revisions.
- **Beacon *voids*** (15470, bar 26, 56.1 s), lit as the flight lands on it.
- **Develop.** Two voids split by `split-crack`. Flight A (cape 2/16 after the jump) spends the cape; the cracked landing does not refill it; *split-song* (5 stars: two on flight A's line, one on the descent, one on the shelf, one on the jump off it) refills it one sixteenth before flight B. Removing one of its stars makes void B fail (tested). This is the only required chain and its beacon is 5 s before it.
- **Beacon *updraft*** (17515, bar 29, 62.8 s), lit as the hop lands on it.
- **Twist, the wind.** The 180 px column *first-wind* (x 18080–18260) rises from below `wind-gate`; the whole column is drawn top to bottom. Jumping into it (glyph ↑) lifts Diana 231 px, enough for `lifted-shore` 170 px up across a 300 px gap; walking in and then double-jumping, or gliding, also works. Glyphs appear one at a time: ↑ at the edge, then (optional) "hold →" inside the column — the cape glides upward there, never dashing level — then (optional) → · ↑ just past the column top: cape, then super jump, reaches Great Star 3 at (18520, 80); a plain double jump falls short of it. Without the wind the main route dies here (tested). On the shore, an optional ↓ breaks `lid-2` into the star cache (*cache-song*), which rejoins at `lifted-down`.
- **Beacon *finale*** (19330, bar 32, 69.5 s), lit as the hop lands on it.
- **Conclude.** From `finale-crack` (cracked, no refill): jump, flight, double jump, *finale-song* (four sixteenths in a row, 521–524) refills the cape at the double, second flight (a full one: it ends 47 px before the column), then *finale-wind* (x 20880–21050, top 150, bottom 480) lifts Diana to `finale-high`; its end is placed so the walk-off lands on the door island on the grid. Under all of it lies the **safe line** `low-a/b/c` (y 560), reached by simply falling; it is stable and needs only jumps, and the column's bottom stops above it so it never lifts a low-line runner by surprise.

### Coda

`far-door` (1300 px) and the original portal at x 21984, grounded 3 px into the island; Diana reaches it on the downbeat of bar 36. With all three Great Stars, Earth glows blue inside the arch.

## Beacons

| id | x, y | Platform | Main-route time | Sixteenth (bar) | Gap | Protects | Story line |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `leap` | 2943, 496 | leap-shore | 10.09 s | 72 (5½) | 10.1 s | first double jump | "There it was again: the signal, somewhere ahead." |
| `breaking` | 6577, 471 | gate-2 | 23.54 s | 168 (11½) | 13.5 s | first crumble | "Some stars are too tired to hold her. She is light enough." |
| `well` | 10211, 464 | b3-isle | 37.00 s | 264 (17½) | 13.5 s | lid, cascade | "Under the cracks, something was still shining." |
| `hearth` | 13843, 319 | hearth | 50.46 s | 360 (23½) | 13.5 s | first flight | "A warm stone. A breath. The signal is louder here." |
| `voids` | 15470, 377 | wind-shore | 56.06 s | 400 (26) | 5.6 s | required constellation | "The cape remembers the wind of home." |
| `updraft` | 17515, 478 | wind-gate | 62.79 s | 448 (29) | 6.7 s | first updraft | "Wind rises where the dark is deepest." |
| `finale` | 19330, 412 | finale-gate | 69.52 s | 496 (32) | 6.7 s | finale | "Somewhere ahead, a little blue world is listening." |
| finish | 21984, 470 | far-door | 78.51 s | 560 (36) | 9.0 s | | |

A beacon lights when Diana stands on it (feet within 1 px of its y, x within [x, x+400]); flying over does not count. Every beacon sits on a half bar of the path clock (tested), so a fall's restart re-enters the score on a strong beat. Lighting saves stars, constellations and progress, banks any carried Great Star, refills the cape, resets the fall counter and the star net. Each has a one-line tip shown after three falls there.

## Rules in detail

**Cape (M1).** `RULES.capeRule = 'landing'`: `capeCharges` is 0 or 1. `dash()` needs an airborne Diana and a charge, sets vy = 0 for exactly 0.5 s at +227.1 px/s (three sixteenths of extra run). Refills: any landing on uncracked stone, any beacon, any completed constellation. Landing ends a flight. `'cooldown'` restores the archived 6 s timer (beacons and constellations reset it).

**Smash (M2).** A diving Diana that meets a crumble, lid or cascade surface breaks it in the same substep and keeps falling at ≥ 500 px/s, so a lower platform in the same substep still catches. A grounded dive breaks only cracked stone; ordinary stone ignores it. Chips and a 3 px shake are renderer-only and skipped under reduced motion.

**Constellations (M3).** Stars of one chain must be taken in order with at most 1.2 s between them; passing an untaken star (50 px) or waiting too long fades the chain. Taken stars still count. Completion increments `ringsCrossed` and `constellations` and refills the cape. Each star has an authored note (`score.mjs` PHRASES, tested against the chord where the main route takes it); completion blooms the chord and brings in the choir for four bars; a fade lets the last note sigh 50 cents down (README, "Sound").

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
| `p-double` | ↑ ↑ | over the long leap (window 3290–3340) | double jump |
| `p-climb` | ↑ ↑ | before the 162 px climb | double jump |
| `p-crack` | ↑ | over the second cracked shelf (window 8030–8120) | jump |
| `p-lid` (optional) | ↓ | over the lid | dive |
| `p-cape` | ↑ · → | edge of the hearth (jump window 14980–15060) | cape |
| `p-updraft` | ↑ | edge of `wind-gate` | jump |
| `p-wind` (optional) | hold → | inside the column | glide in the wind |
| `p-super` (optional) | → · ↑ | top of the column | super jump |

## Route evidence (tests/routes.mjs, 120 Hz)

Pilots read a fixed list of `[x, action, when]` steps and call only public actions.

| Route | What it does | Result |
| --- | --- | --- |
| `main` / `low` | Every required action on the grid, high line in the finale | won 78.508 s · 62 stars (3 upper) · 5 constellations · 7 beacons · 43 jumps / 5 flights · the whole song on time |
| `upper` / `high` / `mastery` | GS1 ledge, high crown, the cracked chain, lid smash and well, glide + flight + super jump for GS3 | won 78.450 s · 73 stars (14 upper) · **3 Great Stars** · 6 constellations · 1 smash · 1 super jump |
| `ability` | Main route plus a released-jump hop, the lid smash and the well, glide in the wind, the star cache | won 78.508 s · 77 stars (15 upper) · GS2 · 7 constellations · 2 smashes |
| `safe` | Main route, but drops to the finale's stable low line | won 79.350 s · 61 stars · 4 constellations · 3 flights |

All four win at 30, 60, 120 and 240 Hz. Failure checks: no second jump → dies over the leap (after beacon *leap*); no cape → dies in the first void (after *hearth*); one constellation star removed → dies over void B (after *voids*); no wind → dies at the updraft (after *updraft*). The upper, ability and safe lines are not grid-locked (they take other arcs); the score quantises them and re-phases at anchors.

## Risks and next tuning

- The required midair constellation is the most demanding read in the chapter. If players miss it, widen star tolerance or move its last star lower on the jump arc before touching the void width.
- The cascade is now a bounce (hop length ≈ pitch at 107 BPM). It is the most rhythmic stretch of the chapter; watch whether first-time players find the landing-is-takeoff rhythm, and whether 0.7 s of slack on the last tile is too generous or too tight.
- 165 px and 170 px climbs sit at the authoring limit; watch first-time players there.
- The map is authored on the soundtrack's measured 107 BPM; the GDD's 88 BPM is retired. Any geometry change needs `npm run score:bake` and the alignment test to stay green.
- The first void can be crossed without the cape by a frame-perfect late double jump from the very lip (also true before this revision). The test proves the main line needs the cape; tightening it would shrink an already narrow cape window.
- Human sessions should note where a glyph is first misread, which line people choose in the finale, and whether 1.1 s respawns feel instant enough.
