# Solarum: movement audit

Audited 2026-11-10 against the shared rubric [`common/docs/MOVEMENT_CRITERIA.md`](../common/docs/MOVEMENT_CRITERIA.md) (A–F, with the Solarum F block). The user asked for "crispy and precise" movement in the spirit of Celeste's principles, and gave one specific complaint about climbing onto a platform from below: "it looks like you made it, but you don't go up". Everything below is measured on the pure model with ordinary inputs. Each level runs at its own clock and physics, and times are **real** seconds, that is, what a player feels (simulation time divided by the level's clock, BPM / 107). Section A and C1 were then checked again in Chrome with real key events and the real assets and renderer.

**Reproduce**

| Command | What it does |
| --- | --- |
| `npm test` | 105 tests, about 22 s. `tests/movement-audit.test.mjs` holds the 16 audit tests; `tests/model.test.mjs` holds the 3 new focused tests. |
| `node scripts/movement-audit.mjs [arcs\|forgiveness\|sprites\|below\|windows\|hitches]` | Prints the full report. The fine sweep takes a few minutes. |
| `node serve.mjs --port 4403` then `node scripts/browser-movement.mjs` | Runs the browser checks. Playwright comes from `common/`; set `PLAYWRIGHT_FROM` to use another copy. |

Status uses the rubric's meaning. **WARN** means the value is within 25% of the band, or the deviation is a reasoned exception. **N/A** means the criterion has no object in an autorunner, and the reason is given.

## Revision five, progression (2026-11-10): what changed since this audit

The campaign now opens with the rebuilt **I · Waking** (88 BPM) and the new **II · The Gift** (94 BPM); the audit's levels II–IV play on as interim levels III–V with unchanged numbers. Measured on the new levels (`scripts/movement-audit.mjs` helpers, pinned in `tests/movement-audit.test.mjs` and `tests/levels.test.mjs`):

| Item | I · Waking (88) | II · The Gift (94) | Was (old I at 96) |
| --- | --- | --- | --- |
| B5 apex, held | 0.507 s | 0.427 s | 0.539 s |
| B6 0 ms tap / hold | 0.228 (tap cap 308 sim) | 0.236 | 0.234 |
| B6 50 ms keyboard tap | 0.432 | 0.484 | 0.449 |
| B7 fall cap | 560 px/s real | none (shared arc) | 560 |
| B8 hang extra | 0.098 s: **PASS** (≤ 0.12) | — | 0.13 s (WARN) |
| B9 coyote | 111 ms | 114 ms | — |
| F narrowest / median required window | 618 / 628 ms | 332 / 626 ms | 557 / 576 ms |

- **No visible lip sink (§7):** the step-up reaches 30 px on the span and at the lip (was 20 / 25) with 4 px of overlap (was 10); flights keep 24 px. The C1/B12 sweep and the step-up tests pass at the new bounds, and no main route needs a step-up.
- **The hang ends at touch-down:** a key still held from the jump before no longer slows a walk-off (level I's lookout and crown edges drop onto the grid).
- **Verbs per level:** before I's GET there is no air jump (a late press waits in the buffer, U2); II's cape breathes (C1–C6).

## Per-level numbers, eight levels (2026-11-10, after VIII · The Far Door; I, II and VI re-measured after the human-proxy round)

Re-measured with `node scripts/movement-audit.mjs arcs` and `windows` and `scripts/level-report.mjs` (main route, real units). VIII is the built Far Door (it replaced revision six's interim level).

| | I · Waking | II · The Gift | III · Still Water | IV · The Way Down | V · Breaking Constellation | VI · Borrowed Wind | VII · The Falling Road | VIII · The Far Door |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BPM, run px/s | 88, 222 | 94, 237 | 100, 252 | 107, 270 | 112, 283 | 118, 298 | 123, 310 | 128, 323 |
| B5 apex (held), held height | 0.507 s, 121 px | 0.427, 106 | 0.401, 106 | 0.375, 106 | 0.358, 106 | 0.340, 106 | 0.326, 106 | 0.313, 106 |
| B6 0 ms tap / hold; 50 ms tap | 0.228; 0.432 | 0.236; 0.484 | 0.236; 0.484 | 0.236; 0.484 | 0.236; 0.522 | 0.236; 0.522 | 0.236; 0.522 | 0.236; 0.559 |
| F required actions (of all) | 20 / 23 | 33 / 35 | 24 / 26 | 27 / 33 | 35 / 45 | 25 / 46 | 37 / 61 | 33 / 71 |
| F narrowest window, smallest early side | 618 ms, 385 | 370, 142 | 321, 98 | 300, 92 | 263, 72 | 204, 60 | 203, 51 | 195, 56 |
| Median required window | 628 ms | 626 | 606 | 583 | 549 | 537 | 428 | 411 |
| Edge lead (landscape / portrait) | 3.22 / 2.66 s | 2.15 / 1.73 | 2.40 / 1.92 | 2.25 / 1.80 | 2.23 / 1.74 | 2.06 / 1.78 | 2.06 / 1.56 | 2.45 / 1.94 |
| Landing lead (landscape / portrait) | 2.66 / 2.11 s | 1.60 / 1.12 | 0.79 / 0.30 | 1.07 / 0.62 | 1.72 / 1.39 | 1.44 / 1.07 | 1.38 / 0.95 | 1.62 / 1.11 |
| Inputs a bar (peak) | 1.21 (2) | 1.40 (3) | 1.55 (3) | 1.71 (4) | 1.96 (3) | 2.26 (3) | 2.52 (5) | 2.84 (4) |
| Largest beacon gap | 13.6 s | 12.8 | 11.7 | 9.8 | 10.7 | 10.2 | 9.5 | 7.7 |

- **VII:** the narrowest window is the double on the *gap-song*'s last star over the second missing tile (a double pressed early rises away under the star; a late one overshoots the small tile d4). Every route wins at 30/60/120/240 Hz with 0 falls and 0 step-ups. Both of its required refill stars (RESEARCH_REFILLS) are touched lit on every route and rate.
- **VIII:** the narrowest window is the star road's double after its leaf star (an early super jump lowers the arc until the press would be a buffered ground jump onto the low floor; the double sits at 9/16, 234 px over the gate, to keep it clear); every route wins at 30/60/120/240 Hz with 0 falls and 0 step-ups; the road's three required refill stars are touched lit on main, upper and ability at every rate (the safe route is the low line under them). C1's shifted replay now moves the rest of a super jump's airtime at flight speed (a super ends its flight, so shifting it shifts the flight's end).
- **The cape press buffer (the milestone-A critic's item 1):** a cape press that cannot fly yet (an empty bar or inside a solar-wind column) now waits 0.14 s real and flies the tick it can (a refill in the air, a lit cape star, the column's edge); a touch-down drops it. This widens the early side of flights charged by a song or a star, and C1 counts such a press as empty only if it never flies.
- **Not measured this round:** L6's sloppy-bot ladder (σ 40 / 100 ms) for VII and VIII, and the critic's late-press rescue and death-curve findings (II-VI), which are queued for the next round (SHARED_MEMORY handoff).

## Human proxies (2026-11-10, the round after VIII)

The studio's lesson from the other two games: levels proven possible by near-perfect bots were impassable for a real person in one and too easy in the other. `scripts/human-proxy.mjs` flies each level's main route on the model as three people do; `tests/human-proxy.test.mjs` holds the bands below (10 seeds, deterministic, about 15 s of `npm test`).

- **First-timer:** timing error σ 90 ms (real, Gaussian, clamped at ±2.5 σ), a 280 ms reaction to the stone a committing press lands on entering the narrowest landscape view (forgotten nothing after a fall: what was in view there is known), keys held through falls, no text read. **Casual:** σ 60 ms, 230 ms. **Expert:** σ 30 ms, 190 ms.
- Timing: airborne presses keep the route's rhythm from the player's own previous press; a grounded press the route makes within 3/16 of a touch-down is timed from that touch-down (predicted before it) when it is the route's own, else at the stone's edge; any other press by position. Holds: a jump 250–500 ms, a tap 35–90 ms, a cape press 90–150 ms (or held when the route glides).
- **Targets (falls a run, mean):** first-timer I ≤ 1, II ≤ 1.5, III ≤ 2, IV ≤ 2.5, V ≤ 3.5, VI ≤ 4.5, VII ≤ 6, VIII ≤ 8, and no spot that takes three falls in a row; casual 0.25 … 2.5; the expert clean everywhere, with mastery lines that pay.

Falls a run, 20 seeds each (mean / max, worst spot in a row), before this round (161099b, harness at 092740d) → after (this round's tip):

| | First-timer | Casual | Expert |
| --- | --- | --- | --- |
| I | 0.10 / 2, 2 → 0.10 / 2, 2 | 0 → 0 | 0 → 0 |
| II | 0.70 / 3, 3 → **0.30 / 2, 2** | 0.35 / 2 → **0** | 0.10 / 1 → **0** |
| III | 0.10 / 1, 1 → 0.10 / 1, 1 | 0.05 → 0.05 | 0 → 0 |
| IV | 1.00 / 4, 4 → 1.00 / 4, 4 | 0.25 → 0.25 | 0.05 → 0.05 |
| V | 1.40 / 6, 5 → 1.40 / 6, 5 | 0.30 → 0.30 | 0.05 → 0.05 |
| VI | 2.40 / 8, 5 → **1.95 / 8, 4** | 0.50 → **0.30** | 0.15 → **0.05** |
| VII | 4.80 / 14, 9 → 4.80 / 14, 9 | 1.60 → 1.60 | 0.20 → 0.20 |
| VIII | 3.85 / 8, 4 → 3.85 / 8, 4 | 1.25 → 1.25 | 0.20 → 0.20 |

(The "before" II row is the old II, which the re-solve replaced: its worst spot was Pluto's steps, a four-star song an early jump broke. Every first-timer and casual mean is inside its band; the expert is clean in I–III only at 20 seeds: one fall in 20 runs in IV, V and VI, four in VII and VIII.)

What is left, by spot (first-timer): IV the broken well (14 of 20 falls; the dive through the long lid), V the split voids (15; the split-song), VI the finale's double (11; VI's narrowest window, kept for the ladder) and wind, dive, wind (4), VII the dive road (54; the dive onto the stone between tiles), VIII the storm void (13) and the road home. These, and the targets the table does not meet (no worst spot of 3 or more; a clean expert in IV–VIII), are the next round's queue (SHARED_MEMORY handoff).

**Late-press rescue** (`node scripts/human-proxy.mjs rescue`, RESEARCH_PROGRESSION 4.2: required ground jumps that still survive when pressed more than 30 ms past their strict window, the press becoming the double): II 82% → **53%** (ceiling 75%), III 69% (70%), IV 86% (60%: over), V 75% (55%: over), VI 85% (50%: over), VII 38% (40%), VIII 31% (35%). IV–VI need the geometry fix of 4.2 (a required double after one in three required ground jumps) and are queued.

**Chrome, real keys** (Playwright Chrome on port 4445, the real `game.js`, the critic's in-page human bot pressing `page.keyboard` at the bot's times; σ without the reaction model): II won with 0 falls at σ 0, 60 and 90 ms (the relic at x 6579, both refill stars taken, no console errors); VI won with 0 falls at σ 0 and 60 (the finale's cape star taken); I won with 0 falls at σ 90. At II's gift, `getHud().breath` goes from hidden (no cape) to shown and full (`charge 1`, disc `meteor`).

## Human proxies, round 8: the hot spots of IV-VIII (2026-11-10, level-tuning squad)

**What the falls had in common.** A proxy hook that prints the chain and cape state at every death showed one cause behind the biggest spots: a **required star placed at the very press that spends what it gives**. The cape needs the star's charge, a star is a 80 x 86 px box on an arc, and a press 50-100 ms early (a first-timer's σ is 90) either skipped the star or reached the next press before the star was taken (the cape press buffer is only 0.14 s). Windows measured 92 ms early (IV), 72 (V), 51 (VII), 60 (VI) while the late side was 200-400. The same mechanism made VIII's and VII's small landing stones (70 px) the target of two or three compounding presses. Second cause, level-wide: a land-and-go press that comes after the stone's end has only the coyote time (about 130 ms) left, and 6.5% of a first-timer's presses are later than that.

**Rules that came out of it** (LEVEL_DESIGN, "Round 8 rules"): a required star or song completes **2/16 or more before** the press that needs it and lies on the run, on a flight's flat line or on the plateau of a jump (never on a steep fall); a star that must be met by a double goes 45 px under the double's top (late presses are the common miss); a small stone that two presses must hit reaches 90-130 px back; from IV to VII a stone ends 45 px past the route's last ground takeoff (tail rule, tested).

Falls a run, 20 seeds (mean, worst spot in a row), before (d8276b2) -> after (this round's tip); 60 seeds in brackets:

| | First-timer | Casual | Expert |
| --- | --- | --- | --- |
| I | 0.10, 2 -> 0.10, 2 | 0 -> 0 | 0 -> 0 |
| II | 0.30, 2 -> 0.30, 2 | 0 -> 0 | 0 -> 0 |
| III | 0.10, 1 -> 0.10, 1 | 0.05 -> 0.05 | 0 -> 0 |
| IV | 1.00, 4 -> **0.20, 1** [0.12] | 0.25 -> **0** | 0.05 -> **0** [0 in 60] |
| V | 1.40, 5 -> **0.80, 2** [1.07] | 0.30 -> **0.20** | 0.05 -> **0** [0 in 60] |
| VI | 1.95, 4 -> **1.20, 3** [0.98] | 0.30 -> **0.15** | 0.05 -> 0.05 [0.03] |
| VII | 4.80, 9 -> **1.15, 2** [0.90] | 1.60 -> **0.25** | 0.20 -> **0** [0 in 60] |
| VIII | 3.85, 4 -> **1.95, 3** [2.42] | 1.25 -> **0.55** | 0.20 -> 0.15 [0.22] |

Runs of 60 first-timer seeds with three or more falls in a row at one beacon, before -> after: IV 3 -> **0**, V 5 -> **3**, VI 10 -> **5**, VII 14 -> **2**, VIII 22 -> **7** (worst chain 3, 3, 3, 6 in V-VIII). The 20-seed worst spot is 3 in VI and VIII, so the target "no spot three times in a row" is **met in IV, V and VII, not in VI and VIII** (a first-timer's σ 90 against any window under 400 ms is a 10-20% miss; the stretch between two beacons has half a dozen of them).

**Fixes, by level** (each a measured cell):
- **IV, the broken well (25 of 32 falls):** the well-song (the cape's charge for the flight out) now runs on the well's floor and the jump's rise and completes 5/16 before the flight; windows 300 -> 442-542 ms, the first-timer 1.00 -> 0.25.
- **V, the split voids (24 of 55):** the song keeps its two flight-line stars but drops the descent star (a steep fall: ±1/16 of timing moved it out of the box) for two stars on the cracked islet's run; the window of the flight press 72 ms early -> 151; the first-timer 1.40 -> 0.80.
- **VI, the finale (38 of 85):** the cape star sat at the double's top, so an early double reached the flight press before the star (the double's window was VI's narrowest, 204 ms); it now lies on the first flight's descent before the double (window 476 ms, -310/+159).
- **VII, the dive road (54 of 96):** d4 is 190 px wide (was 70); the gap-song's four stars are on the hop's arc, two on the first flight's line and on the double's rise under the arc (the old song missed a star in 34 of 34 deaths); the dive islets reach 100 px back and keep a 10 px tail so the dive is still required; the leaf star sits 45 px under the double's top. 4.80 -> 1.15.
- **VIII:** small stones reach 90-130 px back (wind shore 150); the rise-song completes 2/16 earlier; the proxy now takes the low line under the star road when it lands on it (a person sees the catch and uses it): 2.85 -> 1.95. Left: the last climb (a double 4/16 after the jump, whose late limit is +139 ms), the gauntlet's crack and the star road's third star.

**Ladder.** The narrowest required window was the star-gating accident in IV-VII (IV 300, V 263, VI 204, VII 203 ms), so with the cells fixed IV-VII's narrowest windows are 533, 486, 469 and 290 ms. The ladder test keeps every floor and the VIII band, keeps I-III monotone, and from VII on the median and lower-quartile windows fall again (VII 551, VIII 467 ms median); IV-VI sit at 640-700 ms because of the tail rule's +165 ms of late press. The proxies carry the rise (first-timer IV 0.2, V 0.8, VI 1.2, VII 1.15, VIII 1.95; casual 0, 0.2, 0.15, 0.25, 0.55).

**Late-press rescue** (ceiling): IV 78% (60, **not met**; was 86), V 70% (55, **not met**; was 75), VI 79% (50, **not met**; was 85), VII 32% (40), VIII 31% (35). The tail rule leaves IV-VI where they were (a longer stone also takes the late press). A real fix needs required jump + double cells in a third of IV-VI's ground jumps (a re-solve and re-bake of 4-5 cells per level); not done.

**Chrome, real keys** (Playwright Chrome on port 4446, the real `game.js`, the critic's in-page human bot, σ without the reaction model): IV, V, VI and VII won with 0 falls at σ 0 and 60 ms; at σ 90 IV and VII fell once, V and VI 0 times; VIII won with 0 falls at σ 60; no page errors.

## Scorecard

| # | Criterion | Before | After |
| --- | --- | --- | --- |
| A1 | Input → state on the same step | PASS | PASS |
| A2 | Frame-rate and hitch independence | **FAIL** | PASS |
| A3 | No lost or phantom inputs | **FAIL** | PASS |
| A4 | Determinism | PASS | PASS |
| B1–B4 | Run speed, stop, turnaround, air control | N/A | N/A |
| B5 | Time to apex | WARN (I) / PASS | WARN (I) / PASS |
| B6 | Tap/hold ratio; cut on the release step | WARN | WARN |
| B7 | Fall vs rise gravity; max fall | WARN | WARN |
| B8 | Apex hang | WARN | WARN |
| B9 | Coyote | PASS | PASS |
| B10 | Jump buffer | **FAIL** (none with the double in hand) | PASS |
| B11 | Corner correction | N/A | N/A |
| B12 | Ledge assist: never "looked landed but fell" | **FAIL** at 144–240 Hz | PASS |
| B13 | Air-resource refresh rules | PASS | PASS |
| B14 | Cape flight | PASS | PASS |
| C1 | Sprite vs collider in every frame | **FAIL** | WARN (horizontal and stride only) |
| C2 | Hazard colliders | N/A | N/A |
| C3 | No tunnelling | PASS | PASS |
| C4 | Contact rules readable | PASS | PASS |
| D1 | Optional techniques (≥ 2) | PASS | PASS |
| D2 | Skill gradient (≥ 15%) | PASS | PASS |
| D3 | Recovery | PASS | PASS |
| E1 | Action feedback on the same frame | PASS | PASS |
| E2 | Resource state shown on Diana | WARN (double jump) | WARN (double jump); **PASS** since the leaf glint (2026-11-10) |
| E3 | Telegraphs ≥ 1.5 s, lookahead ≥ 2 s | PASS | PASS |
| F | Windows ≥ 120 ms | PASS | PASS (wider) |
| F | Decision lead ≥ 1.5 s | WARN | WARN (landings of chains) |
| F | Beat alignment ±35 ms | PASS | PASS |

Before: 5 FAIL, 6 WARN. After: 0 FAIL, 7 WARN, because C1 moved from FAIL to WARN. Each remaining WARN has its reason in the last section. **Update 2026-11-10 (art squad):** the leaf glint gives the double jump a lasting cue on Diana, so E2 passes: 0 FAIL, 6 WARN. The no-cape frames (level I in the eight-level campaign) meet C1 too.

## The owner's gameplay video (2026-11-10): where she died, and what the corner rule already does

The video (25 s of level VIII, three falls) showed Diana "dying in the middle of the map" and apparently slipping off the first rising-stair bowl's corner. Two separate things, measured:

**1. The death line was in view, and above visible ground.** `fallLimit` (265 px under the last grounded y) sits at 74% to 110% of the 675 px view (median 91%) under the damped camera (65% follow plus up to 120 px of look-down), at the 0.59 s a 265 px fall takes: on all 245 platforms of the eight levels her head was still on screen there, and her feet on 218 (89%). Worse, eleven stone pairs lie 273-353 px under the stone above them, between that line and the view's bottom: VIII's summit and summit-2 to the home ledge (317 and 299 px) and the gauntlet's two stairs (299), VII's lock ledge to the tiles (287-338) and c0 to s2, VI's finale to the high shore (273), IV's gate to the well floor (353). The video's second and third falls are exactly VIII's summit-2 to the home ledge: she glided off the dive stair's second stone and shattered 40-80 px above the ledge, at 67-78% of the screen height (real-key replays, held cape 0.7 / 1.1 / 1.5 s: before 3 of 3 deaths, after 3 of 3 landings on the ledge). Repaired in `geometry.mjs` `fallOutLine` and `model.mjs` `doomed`: past the old line no key acts (the old rule's fairness), but a stone her fall meets in view catches her, and the fall counts once her drawn body is under the view; routes and the baked score are unchanged (the hash was re-baked, the paths are identical); VIII's proxies (20 seeds, first-timer / casual / expert falls per run) move 1.95 / 0.55 / 0.15 to 1.75 / 0.40 / 0.05 and the first-timer's worst chain 3 to 4 (seeds 12 and 20, at the stair's second step: seed 20 now skips a fall at the star road and arrives there, the rest is the proxy's chaotic retries). `tests/fall-out.test.mjs` plays every platform of every level through the real camera easing, also right after a 267 px rise, and the glide onto the home ledge.

**2. It was not a corner clip.** The first fall: a jump at the ledge's tip and the cape pressed 0.1-0.3 s into the rise flies level 82 to 33 px *under* the first bowl's rim at its left edge (the video's frames: about 55-65 px), through the one-way stone, and falls. The corner rule is far larger than a corner: a launched, non-diving Diana whose collider is over a top by 4 px is lifted onto it if her feet are at most 30 px under it (24 in a flight), `RULES.lipDepth`, `stepUpDepth`, `flightStepDepth`, `stepUpOverlap` (Celeste's corner correction is 4-6 px on an 11 px body). `tests/corner.test.mjs` sweeps feet 1-3 px above the top with the collider 0-5 px short of the corner (falling and flying, four fall speeds, 384 trials: every one lands within 12 ticks) and the rule's postcondition over 12k approaches (no airborne tick is left inside the zone). The same press at the jump's apex (0.35 s) lands (29 px under, the lip rule); at 0.3 s it is 33 px under and dies: the cliff is the forgiveness's edge, which the C1/B12 sweep (0 "looked landed but fell", 0 "landed when clearly short") fixes at 24-30 px, so it was not widened. The remedy is legibility: the stair's double jump is wide (any second press 0.15 s or more into the jump lands from 0 to 40 px before the tip) but unmarked, and the stair is the one place of VIII where a cape press looks natural, so a double-jump glyph now hangs over the gap (`p-stair`).

Where VIII's first-timer proxy falls (60 seeds, per run): the stair's first step 0.00, the second 0.15, the super jump onto the summit 0.08, the jump-and-dive descent after the summit (summit-2, d-stone-1, d-stone-2) 0.32 (casual 0.13, expert 0.12: the level's hottest spot for all three). The video's second and third falls are the descent, not the first bowl.

## The complaint: "it looks like you made it, but you don't go up"

Two earlier fixes were already in place: F1, the feet-anchored drawing (`4bf7606`), and F2, the step-up rule (`8f8cc46`). With the toe drawn exactly at the feet, the sweep below finds no bad case. The renderer, however, did not draw the toe exactly at the feet. It **eased** each frame's foot offset with a 17 ms time constant:
- At 60 Hz that is invisible.
- At 144 and 240 Hz the toe stayed up to 26 px off the feet for 2–4 frames after each pose change. These changes are air to flight, jump to double jump (the jump clip restarts) and air to landing.
- The result is that the toe was drawn dipping **through** the top of a platform Diana then flew past or fell beside, which is the complaint in a new form.

The flight body frames were also 2.5–3.8 px above the feet.

**Sweep** (`approach()` and `belowSweep()` in `scripts/movement-audit.mjs`)
- Every platform type of every level at its narrowest authored width: stable and optional, crumble, lid and cascade.
- A floor 20–280 px below in 4 px steps, and takeoffs from 340 px before the lip to 80 px past it in 10 px steps.
- Every approach kind:
  - held jumps;
  - taps released after 0–150 ms;
  - double jumps with the second press 150–600 ms after the first;
  - jump plus flight at 100–500 ms;
  - the super jump.

Each tick, the frame Diana shows is drawn as the renderer draws it: body frame, baked foot, measured lowest pixel. A trial counts as **"looked landed but fell"** if the drawn toe crosses the top line going down while her drawn feet are over the platform and she does not land on it. It counts as **"landed when clearly short"** if she lands although her feet never got within 25 px of the top while over it.

| Renderer | Trials | Landed | By step-up | Looked landed but fell | Landed when clearly short |
| --- | --- | --- | --- | --- | --- |
| Pre-audit (eased foot), 60 Hz | 81,872 (coarse) | 21,090 | 5,481 | 0 | 0 |
| Pre-audit, 144 Hz | 81,872 | 21,090 | 5,481 | **839** | 0 |
| Pre-audit, 240 Hz | 81,872 | 21,090 | 5,481 | **1,171** | 0 |
| **Now** (offset applied in full on the frame) | **970,596 (fine)** | 245,855 | 67,707 | **0** | **0** |

The figures are the same in every level and type, for example III's crumble at 126 px: 68,112 trials and 0 / 0. The test re-runs a coarse version on every type and level (≈ 23k trials). It also proves the detector works, because it still catches the eased renderer at 240 Hz. In Chrome with real keys, 693 drawn body frames covered every clip in play (start, run, jump, air, dash, dive, soft and hard landing). The worst toe-to-feet distance outside the stride's float was **0.91 px**. Before the fix it was 2.52 px, with 32 frames outside ±2 px.

## Results per level

The levels' physics in real units:
- **I:** g 1050 px/s², jump 510, double 460, apex hang ×0.5 while held and |vy| < 70, fall ≤ 560.
- **II–IV:** the same arc in px, time-scaled: g 1500 / 1824 / 2147 px/s², jump 570 / 629 / 682 px/s.
- **Run speed:** 242 / 270 / 298 / 323 px/s.

### A. Responsiveness

| # | Measured (I / II / III / IV) | Target | Status | Evidence |
| --- | --- | --- | --- | --- |
| A1 | Jump, release, double, flight, super and dive set velocity and pose inside the press call, and she moves on the next tick, at 30/60/120/240 Hz. In Chrome the first frame after a real keydown shows vy −545 px/s. | ≤ 1 step; ≤ 1 rendered frame | PASS | `A1: every verb…`; `browser-movement.mjs` A1 |
| A2 | **Before:** inputs were applied at the last frame boundary. Takeoffs moved up to 9.0 / 6.8 / 9.0 / 15.0 px at 30 Hz and 16 / 23 / 18 / 27 px under 0–100 ms hitches. In Chrome, a press 25–49 ms into an 80 ms hitch was applied 29–54 ms early. **Now:** each event first catches the simulation up to its own `timeStamp`, and frames clamp at 100 ms. A person's timestamped main-route presses give a **bit-identical** run (SHA-256 of every event) at 30/60/120/240 Hz and under random 0–100 ms hitches. In Chrome, a press during an 80 ms hitch lands −0.7 to −8.3 ms from its own time, that is, on its own 1/120 s tick. | ±1 px, same outcome | PASS | `A2/A4: a timestamped…`, `inputs act at their own timestamps…`, `movement-audit.mjs hitches`; browser A2 |
| A3 | <ul><li>A press just before landing is buffered.</li><li>A press while falling apart is kept, and a press and release there respawns as a **tap**.</li><li>A press while paused is ignored, but a **release** while paused or on blur now cuts the jump. Before, Chrome showed `held true, vy −520` after the pause.</li><li>The wake key only wakes; auto-repeat never jumps.</li><li>A press waiting for a touch-down that a glide postponed fires as the double when the buffer runs out (never lost), and a flight or dive drops it (never fires mid-flight).</li></ul> | Honoured or ignored by a documented rule; no double fire | PASS | `A3: presses at landing…`, `a press just before touch-down…`; browser A3 |
| A4 | Two runs give identical event traces. | Bit-identical | PASS | `A2/A4` |

### B. Jump and air (B1–B4 N/A: Diana runs at a constant speed and has no stop, turn or air steering)

| # | I | II | III | IV | Target | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B5 apex, held | 0.539 s | 0.375 s | 0.340 s | 0.313 s | 0.30–0.45 s | I WARN (float), II–IV PASS | `B5-B8` |
| Held height | 123.3 px | 105.9 | 105.9 | 105.9 | — | — | `arcs` |
| B6 ratio, 0 ms tap | 0.234 | 0.236 | 0.236 | 0.236 | 0.30–0.55 | WARN | `B5-B8` |
| B6 ratio, 50 ms keyboard tap | 0.449 | 0.484 | 0.522 | 0.559 | — | in band | `B5-B8` |
| B6 cut on the release step | yes (vy → −tapCap on the call) | yes | yes | yes | yes | PASS | `A1` |
| B7 fall/rise gravity | 1.0 | 1.0 | 1.0 | 1.0 | 1.3–2.2 | WARN | `B5-B8` |
| B7 max fall | 560 px/s cap | no cap; the death line bounds it at about 1060–1150 sim px/s (routes reach 756) | same (routes 893) | same (routes 1130) | capped | WARN | `physicsReal()`; route maxima measured with the pilots |
| B8 extra apex hang | 0.133 s | none | none | none | present, ≤ 0.12 s | WARN | `B5-B8` |
| B9 coyote (measured) | 111 ms | 117 | 113 | 118 | 80–120 ms, constant | PASS | `B9/B10` |
| B10 buffer, double spent | 139 ms | 133 | 136 | 139 | 100–150 ms | PASS | `B9/B10` |
| B10 buffer, double in hand | before **0**, now 139 | 0 → 133 | 0 → 136 | 0 → 139 | 100–150 ms | PASS | `B9/B10` |
| B13 refresh | Only landing refreshes the double. The cape is refilled by stable stone, beacons and constellations, never by cracks. Rising through a one-way top refreshes nothing. One flight per airtime, one super jump per flight, no cape flight in wind. A step-up is a landing (documented). | | | | documented, no exploit | PASS | `B13`, model tests |
| B14 flight | — | 0.500 s | 0.453 s | 0.418 s | fixed, no freeze, state visible | PASS | `B14` |

**B14 detail.** A flight lasts exactly 0.5 s of simulation at every frame rate and adds +113.55 px, which is three sixteenths. It is level (vy 0) and has no freeze. A spent cape is tinted on Diana.

**B12** is covered in the section above. **B11** is N/A: there are no ceilings, and every platform is one-way.

**Hold needed by human presses.** Held jumps on the main routes need at most 214 ms of hold (I's climb). Every other held jump needs ≤ 139 ms. I's stepping-stone taps work up to 241 ms, so a real keyboard tap works.

### C. Collision fidelity

| # | Measured | Target | Status | Evidence |
| --- | --- | --- | --- | --- |
| C1 vertical | 89 clip frames in play. The 31 airborne frames (jump, air, flight, dive) have the lowest drawn pixel within **1.3 px** of the feet; the 51 grounded frames are within **1.3 px**. Before: flight body 2.5–3.8 px, and 0–26 px eased transients at high refresh rates. Seven stride-float frames are 5.9–7.1 px above (see WARN). | ±2 px | PASS (stride WARN) | `C1: every frame…`; browser C1 |
| C1 vertical, no cape (2026-11-10) | 62 no-cape clip frames in play (level I wears no cape). The 13 airborne non-stride frames are within **0.5 px** of the feet (the no-cape hard landing has one more airborne frame, sheet frame 5, and the drop roll lifted 2.5–3.8 px: both baked), the 42 grounded ones within **1.3 px**, and the same seven stride floats are 5.9–7.1 px. The body is never smaller than the collider, except the stop's deepest crouch (45 px tall without the cape), which plays only in the door after the win. | ±2 px | PASS (stride WARN) | `C1 (no cape)…` |
| C1 horizontal | The collider is a fixed 32 × 58 box (±16 px). Drawn feet span −20…+37 px (air) and −17…+34 px (run stride); the airborne toe is centred (±1.7 px). | ±2 px | WARN | `sprites` report |
| C1 hurtbox | Nothing hurts on contact, so the collider is only a support box. It is never wider or taller than the drawn body. | ≤ drawn body | PASS | `C1` |
| C2 | No hazards or enemies: only falling below the death line ends a run. | — | N/A | — |
| C3 | One-way landing is a swept crossing test on a fixed 1/120 s step. Checked cases: <ul><li>A dive onto a 40 px top at about 2000 px/s (17 px a tick).</li><li>I's capped fall.</li><li>A flight at 497 px/s over 30 px tops.</li></ul> These hold at 30/60/240 Hz and in 0.1 s and 1 s frames. | No tunnelling | PASS | `C3` |
| C4 | <ul><li>Only falling kills.</li><li>Cracks are drawn, shake, and break 5/16 after touch-down.</li><li>Lids hold a run and break under a dive.</li><li>Every fragile surface telegraphs and has a catch or a visible next step.</li></ul> | Consistent and visible | PASS | model tests `fragile surfaces…` |

### D. Expression

| # | Measured | Target | Status | Evidence |
| --- | --- | --- | --- | --- |
| D1 | Each technique measurably changes the outcome: <ul><li>**Super jump:** apex 270 px vs 168 for a double at the same timing.</li><li>**Dive-cancel of a flight:** lands 269 px sooner.</li><li>**Held cape in wind:** 112 vs 80 px of lift in 0.5 s.</li><li>**I's early second press:** apex 223 vs 206 px (Great Star 1's line).</li><li>**Tap vs hold:** 25–106 px.</li><li>**Skim flight:** jump and cape at once flies level along the floor, and stable ground refills it.</li></ul> | ≥ 2 techniques | PASS | `D1` |
| D2 | Upper-line score vs main-route score: I 4900 / 2000, II 7300 / 3800, III 6700 / 2700, IV 6100 / 2600 (+92% to +148%). Main routes bank no Great Star. Time is nearly fixed in an autorunner: route times differ by at most 1.1 s, through flights. | ≥ 15%, not required | PASS | `D2` |
| D3 | Recovery options: <ul><li>A ground jump pressed after coyote becomes the double jump and still survives to the next beacon for 11/15, 8/11, 11/16 and 10/15 required ground jumps (up to 195–209 ms of extra lateness).</li><li>The step-up.</li><li>Low safe lines in II and IV.</li><li>The Star net assist.</li></ul> | Readable recovery | PASS | `lateRecovery()` in the script |

### E. Feedback

| # | Measured | Status | Evidence |
| --- | --- | --- | --- |
| E1 | Every movement verb emits its event inside the press call. Each has a body sound (`cuesForEvent`) and a same-frame visual: a pose change, plus dust or sparks for jump, double, super, hard landing and smash. | PASS | `E1/E2` |
| E2 | The cape is the meter: a spent cape is tinted on Diana (four steps with the breath bar: 60/45/30/15% dim, clear at full). The double jump has the leaf glint: one small original star just above her leaves while it is in hand (owned and unspent in this airtime), bursting when spent and back on landing (`hud.mjs` `doubleInHand`; Chrome with real keys: in hand, still after the first jump, gone after the double, back on landing). | PASS | `E1/E2`, `tests/hud.test.mjs`, browser |
| E3 | Lookahead ≥ 2.5 s landscape and ≥ 2.0 s portrait at every level's speed. Glyphs are on screen ≥ 1.5 s before their latest valid input. | PASS | model tests `lookahead…`, `every glyph prompt…` |

### F. Solarum

**Method.** Each authored press of the main route is shifted tick by tick, as a person pressing earlier or later would. Later grounded presses fire at their edge, as a person sees it, and airborne ones keep their rhythm. A shift succeeds when there is no fall before the next beacon and the press still does the same thing: a jump stays a jump, not a double, and leads to the same next landing. This is `timingWindow()`.

| | I | II | III | IV | Target | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Required presses | 22 | 21 | 25 | 28 | — | — |
| Narrowest required window, now | **529 ms** | **350** | **332** | **293** | ≥ 120 ms | PASS |
| Narrowest, before | 529 | 350 | 280 | 258 | ≥ 120 ms | PASS |
| Smallest early side, now | 251 ms | 58 | 83 | 42 | — | — |
| Early side on land-and-go hops | — | — | 8 → **144** ms | 7 → **146** ms | — | fixed (B10) |
| Obstacle lead (grounded presses), landscape / portrait | 2.96 / 2.45 s | 2.28 / 2.00 | 1.77 / 1.49 | 2.31 / 1.81 | ≥ 1.5 s | PASS (III portrait WARN) |
| Landing lead (committing press), landscape | 1.85 s | 0.35 (glide bridge); 0.92 (finale) | 1.77 | 1.04 (finale) | ≥ 1.5 s | WARN |
| Grid: worst main-route anchor at 120 Hz | 20.8 ms | 19.2 | 13.7 | 29.4 | ±35 ms | PASS |

The before row counts the same presses with the pre-audit model. The bounce hops were the narrowest, because an early press spent the double.

Evidence for this table: `F: every required action…`, `F: human holds…`, and `score.test.mjs` for the grid (all anchors within 35 ms at 60/120/240 Hz).

**Speed steps (F).** Every A–C item above holds in each level at its own speed.

## Fixes made (each green, pushed)

1. **`77f3c9a` Draw Diana at her feet on the frame the pose changes** (C1, B12).
   - The renderer applies each frame's baked foot in full (`animation.mjs footFor`) instead of easing it.
   - The flight body (`bodyDash`) gets baked feet of 1–4 px.
   - The afterimages use the same offset.
   - `tests/png.mjs` rounds Unity's fractional cells, which the old probe read as empty (84 px).
2. **`eb12f4b` Buffer a ground jump over the double just before touch-down** (B10, A3, F).
   - A press that `tick()`'s own rules predict will land within the 140 ms buffer waits and becomes the ground jump on the landing tick. The double stays in hand, and the ground jump is the stronger of the two.
   - If the landing does not come, the double fires at the buffer's end; a flight or dive drops the press.
   - Releases count while paused, and a queued respawn press that is released is a tap.
   - All routes and the baked score path are unchanged; only the hash differs.
3. **`bca9ef8` Apply each input at its own timestamp; release held keys on blur** (A2, A3). `frame-clock.mjs`:
   - Key, touch and mouse handlers catch the simulation up to `e.timeStamp` before acting.
   - Frames clamp at 100 ms instead of 50.
   - Blur and hidden tabs release the jump and the cape.
4. **`36b30f0` Measure every movement criterion and pin the results in tests.** `scripts/movement-audit.mjs`, `tests/movement-audit.test.mjs` (16 tests), `scripts/browser-movement.mjs`.

**Not changed:**
- the art, the approved clips' timing, the theme and the music grid;
- every level's routes: main, upper with its 3 Great Stars, ability and safe, each winning at 30/60/120/240 Hz with 0 falls;
- the root-QA API and the screenshot moments.

Both of the last two were rechecked in Chrome, where I 12.41, II 25.93, III 31.85 and IV 50.6 s are alive. The itch ZIP grows to 44 files with `frame-clock.js`. In a 960×640 sandboxed iframe it wakes and jumps on a real Space key and wins all four main routes with no errors.

## Remaining WARNs and why

- **B5, I's apex 0.539 s (band 0.30–0.45).** I is "floating, calm" by its approved brief: half gravity at the top while held, and a hold lands on flat ground exactly 7/16 later. II–IV are in band.
- **B6, 0 ms tap ratio 0.234–0.236 (band 0.30–0.55).**
  - Only a buffered tap (pressed and released in the air before landing) reaches the 0 ms floor. Real keyboard taps of 30–80 ms land in band (0.45–0.56 at 50 ms), and the height is continuous from 25 to 106 px.
  - I's stepping stones and II's rock tap are solved on this floor.
- **B7, symmetric arc, no explicit fall cap in II–IV.**
  - Every main-route cell, and so the music grid within ±35 ms, is solved on the symmetric 1500 px/s² arc ("re-solve, don't rescale", RESEARCH_LEVELS 7).
  - A 1.3× fall gravity shortens a full jump's descent by about 46 ms and its range by about 12 px. That would break every cell in four levels.
  - The death line already bounds falls at about 1060–1150 sim px/s; routes reach 756–1130. I has a 560 px/s cap.
  - Changing this means re-authoring the levels, which is the level designer's and the composer's call.
- **B8, apex hang only in I (0.133 s extra, target ≤ 0.12).**
  - Diana has no air steering, so the hang's purpose in Celeste (fine positioning at the apex) does not exist here. In II–IV, a hang would delay every held landing by about 27–53 ms and move it off the grid.
  - The held-cape glide in wind is the controllable hang.
  - I's 0.133 s is 11% over the band, and its float cells are solved on it.
- **C1 horizontal, and the stride's float.**
  - The support box is a fixed ±16 px. The drawn stride's feet swing from −17 to +34 px, and the airborne toe is centred.
  - A pose-dependent box would make walk-off and landing timing depend on the stride phase, which is unfair. A narrower one would remove the ±16 px lip margin, which is deliberate hidden forgiveness, as with Canabalt's building edges extending 8 px past the art (RESEARCH_LEVELS F3): she lands with the toe up to 16 px short of a lip, and the landing pose then plants both feet on it (+16…+24 px).
  - The seven stride-float frames (run 4 and 9, their soft-landing copies, hard landing 7 and 12, start 3) show both feet 6–7 px up by design. Drawing them lower would invert the run's bob.
- **E2, double jump: resolved 2026-11-10.** It had no lasting cue on Diana, only the spark burst when it was spent. RESEARCH_PROGRESSION 2.1 made the mark part of the fiction (the first star settles in her leaves at I's GET), and the art squad drew it with the original star sprite: the leaf glint. Its height lags her by 60 ms falling and landing; rising, it rides her head (a 60 ms lag of a 635 px/s jump would sink it 38 px into her leaves).
- **F, landing lead under 1.5 s at the committing press.** These are II's glide bridge (0.35 s landscape: the shore appears during the glide, which is the point) and the finale chains' last flight in II and IV (0.92 / 1.04 s). Also, in portrait at the 2.0 s floor, a few dashes are at 1.2–1.5 s.
  - The obstacle (the gap) is in view at least 1.77 s ahead in every level. The constellations trace the flight line, and the landing is in view before the press that commits to it (tested).
  - A level-design fix that keeps the grid would be either of two changes. One is to start the far shores 150–200 px further left. The other is to put a constellation star over the landing so it reads earlier. Both would need re-baking `score-path`, so they are left to the level designer.
- **F, III's portrait obstacle lead 1.49 s** (the lid dive). The 775 px portrait view is the brief's 2.0 s floor. Landscape is 1.77 s.
