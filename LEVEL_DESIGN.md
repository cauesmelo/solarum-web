# Solarum — level design

This describes what `level.mjs`, `model.mjs` and `geometry.mjs` implement (2026-11-10, revision six: four levels, [RESEARCH_LEVELS.md](./RESEARCH_LEVELS.md)). The chapter *A Signal in the Dark* (revision five, below) is now source material: level II keeps Movement III's geometry and level III Movement II's at their original coordinates (so every solved cell and the x lattice hold), level IV remixes translated copies, and level I re-solves Movement I's ideas on its own floaty cells. Where the build departs from a brief, the reason is given.

## Four levels: one ruler, four tempos

Every level is simulated in 107 BPM units: a sixteenth is 15/107 s and 37.85 px of run, a grid x is `220 + 37.85 k` (plus 113.55 px per completed flight, and 63.67 px for a super jump opened 2/16 into a flight), and a level plays at clock = BPM / 107 of real time. Human windows are multiplied by the clock so they stay constant in real seconds (coyote 0.12 s, buffer 0.14 s, respawn 1.1 s, the cascade's shake telegraph 0.35 s). Score tolerances are real milliseconds (35 ms real = 35 × clock of simulation).

| | I · Waking | II · Borrowed Wind | III · The Breaking Constellation | IV · The Far Door |
| --- | --- | --- | --- | --- |
| BPM / clock | 96 / 0.897 | 107 / 1 | 118 / 1.103 | 128 / 1.196 |
| Run (real) | 242 px/s | 270 | 298 | 323 |
| Verbs | jump (tap / hold, float), double | + cape, wind, glide, dive | + cracked stone, cascade | + super jump (required) |
| Physics (real) | g 1050, jump 510, double 460, hang ×0.5 while held and \|vy\| < 70, fall ≤ 560 | 1500 / 570 / 525 | same, cracks break 5/16 (0.64 s) | same, cracks 0.59 s |
| Coordinates | own (x 220 → 15966) | chapter (13846 → 21984) | chapter (6276 → 18123) | own (220 → 10870) |
| Bars / real s | 26 / 65.0 | 22½ / 50.5 (a half-bar pickup) | 23 / 46.8 | 25 / 46.9 |
| Beacons | 4 | 5 (voids, updraft, bridge, currents, finale) | 4 (well, broken, hearth, voids) | 6 (storm, wave, crown, voids, finale, stair) |
| Min view (landscape / portrait) | 880 / 720 | 880 / 720 | 970 / 775 | 1050 / 840 |

`scripts/arcs.mjs <level> <move>` flies a move with the real model in free space and prints its height at exactly each sixteenth; the cells below were solved with it, then every main route was baked and audited (`npm run score:bake`).

### I · Waking (96 BPM): floating, calm, basics only

Cells (height at k/16 after a grid takeoff, + = lower): hold 5: −104, 6: −63, **7: +5 (flat ground lands on the grid)**, 8: +91, 9: +179; tap 3: 0, 4: +52; double, second press at 3: 9: −146, 10: −72; at 4: 10: −146, 11: −72, 12: +16; at 5: 10: −177. Takeoffs are on the grid with the island's edge 10 px later; landings start 60 px before the grid landing point (a ≈ 0.45 s real window, islands ≥ 260 px).

| k (bar) | Step | What |
| --- | --- | --- |
| 0–24 (1–2) | introduce | Home: three tap stars, three hold stars at the hang apex |
| 24–60 (2½–4) | develop | Four hops every three beats (hold 7, 6, 7, 7); the first gap is 90 px, so a 0 ms tap clears it and a walk-off does not; *first-song* on the four hang apexes |
| 72 (5½) | beacon *drift* | |
| 84–96 | twist | The leap: 384 px, second press 4/16 after the first, landing 12/16 after it |
| 104–114 | | The climb: 177 px, second press at 5/16. **GS1** floats where only an early (3/16) second press reaches (apex 222 px vs the main route's 203) |
| 124–133 | | A 177 px drop (9/16) |
| 152 (10½) | beacon *climb* | |
| 164–205 | develop II | Stepping stones: two tap islets 6/16 apart (a held jump overshoots each by 28 px), a wide hold gap, two more taps, a rise |
| 240 (16) | beacon *stones* | |
| 252–284 | conclude | Double staircase (second press at 3/16, up 72 px twice), then a drop to the field. Off the top stair at 282 a double (press at 4/16) reaches the **high crown** (**GS2**); three float islets (gaps 215 px: only held, hanging jumps chain) end with **GS3**; a miss lands softly on the field, ≤ 232 px down |
| 328 (21½) | beacon *crown* | |
| 344–416 | coda | Two gentle hops, *home-song* on the last arc, the door on bar 27 |

Sections are added with `insertSection(def, { cut, dx, dy, content })`: everything at x ≥ cut moves by whole sixteenths of run (plus three per inserted flight), so the rest of the level keeps its grid, beacons, pilots and music; the new section starts on an island where the cut's transition used to land and ends on a copy of the island that transition left from.

### II · Borrowed Wind (107 BPM): floating with marked beats

Added (2026-11-10): **the void again** (cut after the hearth void: it lands on a copy of the wind shore along its star line, a 4/16 hop climbs 80 px onto a second hearth, and the same void follows without stars; two bars); **the glide bridge** (beacon *bridge*; jump at 16th 540 into a column with the cape held, glide past its top across a void: no-glide runs come down about 150 px short, the held cape lands 20/16 after the jump on the grid; four bars); **the currents** (beacon *currents*; jump and flight, the flight ends over a low islet and a dive at 7/16 lands 44 px down 1/16 later; a jump into a column that carries Diana past the island beneath it, a dive at 16th 554 lands on it 1/16 later; jump and flight up 69 px onto the exit shore; three bars and two flights).

Movement III at its own coordinates; Diana wakes on the hearth at chapter sixteenth 360 (a half bar: the score enters on a pickup and the door falls on bar 14). Changes: the split voids are one **long void** (takeoff 16003.45: jump, flight at 3/16, the four-star *void-song* along the flight refills the cape, flight at 9/16, landing 14/16 later 15 px lower on the far rock); a tap from the far rock lands on the wind gate 4/16 later. **GS2** sits above the void for a double jump between the flights. The finale's cracked launch became stable rock (no cracked stone before III). **GS1** is in the star cache under the second lid (the dive); **GS3** at the top of the finale wind, reached only with the cape held in it.

### III · The Breaking Constellation (118 BPM): call and response

Added (2026-11-10): Movement II's lid is optional again (the main route runs over it; GS2 in its well). **The broken well**, after the crown's late double (beacon *broken*): jump and flight onto a 520 px cracked lid (it never refills the cape); the well under it is 276 px deep, deeper than the 265 px a walk-off survives, so walking, jumping or double jumping off the lid's end dies, while a dive through the lid lowers the allowance by `RULES.smashDrop` (120 px) and lands on the floor (dive half a sixteenth past the grid: the 2.6/16 fall lands on it); the floor refills the cape: jump, second press 3/16 later, flight 3/16 after that, 606 px out onto the far shore 13/16 later; a hop onto a copy of the last crack and the crown's late double. Four bars, two flights; the rest sits 28 px lower. The paragraph below describes the first version.

Movement II plus the hearth void and the split voids, at their own coordinates, from chapter sixteenth 160. Cracks break 5/16 after touch-down; the first crack's floor moved to 129 px below it so the fall lands 3/16 after the break, and a 4/16 hop climbs 80 px to the second crack. The upper path ends at the lid: the main route dives through it on the grid (k 285), lands in the well 95 px down 1/16 later, and leaves with a double jump (second press 4/16 later) straight up 76 px onto the second tile, 9/16 later, the same touch-down as Movement II's bounce; the cascade has five tiles (its first drops when the chapter's second did). **GS1** on the cracked chain, **GS2** for an early (3/16) second press out of the well, **GS3** on a two-step cracked stair above the crown. The split voids' constellation is required (cracks never refill). The door is on wind-gate's rock, bar 20.

### IV · The Far Door (128 BPM): agitated, precise but fair

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
