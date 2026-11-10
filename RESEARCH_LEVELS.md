# Solarum: movement feel and four-level progression brief

Prepared 2026-11-09 for the Solarum squad (gameplay programmer, level designer, composer). This is a proposal and nothing in it is implemented. [README](./README.md) and [LEVEL_DESIGN](./LEVEL_DESIGN.md) describe the build, and [RESEARCH_MUSIC](./RESEARCH_MUSIC.md) describes the score system this brief extends. These constraints stay: a 2D autorunner, Diana with her cape, the signal and Earth, monochrome ink art, the approved animations, a simulation that stays authoritative, and an independent itch.io ZIP.

Numbers marked *measured* come from scratch scripts (not committed) run against the real `model.mjs` and `assets/` with Node 22 and 1/120 s steps. Everything else is a target to bake and test.

## The recommendation

1. **The climb-up bug is mainly an art-versus-collider offset.** In every jump and air frame, Diana's lowest drawn pixel is 31–36 px above her collider's feet, so the drawing promises about 34 px of height the physics never delivers. Draw airborne frames anchored at the feet, and keep a bounded step-up as hidden margin.
2. **Keep one ruler and change the tempo.** Every level keeps 151.4 px per beat (37.85 px per sixteenth), so run speed = 151.4 × BPM / 60. The simulation stays on today's 107 BPM grid and runs at `clock = BPM / 107`, the same mechanism as Gentle pace. Cells, the bake and the alignment tests carry over to L2–L4 unchanged. L1 also gets a floatier jump.
3. **Four levels of 65–80 s each, a little faster each time, one headline mechanic each:**

   | Level | Tempo, run speed | Headline mechanic |
   |---|---|---|
   | L1 *Waking* | 96 BPM, 242 px/s | Basics: jump and double jump |
   | L2 *Borrowed Wind* | 107 BPM, 270 px/s | The cape, with wind and dive |
   | L3 *The Breaking Constellation* | 118 BPM, 298 px/s | Cracked stone |
   | L4 *The Far Door* | 128 BPM, 323 px/s | Super jump, plus everything at tighter windows |

   All of today's content is kept (§5).
4. **Forgiveness is human time; difficulty is geometry.** Coyote time, buffer, respawn, telegraph lead and lookahead stay constant in *real* seconds. Precision rises through windows, landing widths and density, never through stingier rules.
5. **Each level has its own feel in the soundtrack's language:**
   - L1: floating half-time pads.
   - L2: the original cycle with marked heartbeats.
   - L3: a call-and-response nocturne on a 3+3+2 groove, in which cracking stone calls and Diana answers.
   - L4: a storm on an F♯ pedal that exhales into the original recording at the last door.

## 1. The bug: "it looks like she made it, but she doesn't go up"

### 1.1 Diagnosis (measured)

**The art is lifted while airborne.** `drawDianaLayers` places every frame bottom-anchored (`feet − 42 − h·(1 − pivotY)·0.42`), which is faithful to the Unity pivots. But the airborne cells (`air.png`, 200×300 each) leave empty space below the pointed toe. Here is each frame's lowest opaque pixel (alpha > 64) relative to the collider's feet, at the 0.42 draw scale:

| Clip | Lowest drawn pixel vs feet | Drawn half-width (collider ±16) |
|---|---|---|
| `run`, `idle`, `softLanding`, `dive`, flight body | 0 to −7 (stride bob) | ±33–42 |
| `jump` frames 0–4 | 0, −15, −31, −34, −36 | ±38 |
| `air`, all 6 frames | −34 to −35 | ±36–39 |
| `hardLanding` frame 0 | −28 (Diana is already grounded) | ±35 |

What this means on screen:
- **Envelope mismatch.** The toe visibly reaches about 140 px on a full jump while the collider reaches 106 px. For a double jump the numbers are 228 px versus 194 px.
- **A 34 px drop** when a flight or dive starts from the air pose. The flight and dive poses are foot-aligned.
- **A 34 px pop up**, mid-fall, when the 0.958 s dash clip hands back to `air`.
- **A 28 px hover for 83 ms** after a hard landing.

**The committed forgiveness misses the "from below" case.** The one-way landing test (`previousY ≤ top + 0.6 && y ≥ top && vy ≥ 0`) is correct. The lip catch, however, fires only on the single substep in which the leading edge crosses the platform's left x, and only if both of these hold:
- Diana is rising slower than 120 px/s;
- her feet are no more than 25 px below the top.

When she rises *into* a span from underneath, she crosses the lip at roughly −300 to −500 px/s, so that substep is skipped. If her apex then ends 1–34 px under the top, the toe shows above the lip and she sinks through.

**Sweep** (real model). Flat takeoff, a 300 px target, every rise × gap × 4 press points. "Looked OK, fell" means that at apex or on the way down, the drawn toe was at or above the top inside its span, yet Diana never landed.

| Jump | Trials | `22d6192` (before step-up) | `fd8639b` (step-up, 20 px) | Art aligned | Art aligned + F2 |
|---|---|---|---|---|---|
| Full | 17,812 | **13.6%** | 6.3% | 0.0% | 0.0% |
| Double | 23,652 | **15.2%** | 7.5% | 0.8%\* | 0.5%\* |
| Jump + flight | 14,892 | **10.0%** | 8.6% | 1.8%\* | 2.2%\* |

\*The residuals are honest misses: overshoots, and flights skimming 0–6 px over a top and past its end.

Before the step-up, rises of 110–130 px at 0–80 px gaps always ended "looked OK, fell", while the lip catch saved the same rises at gaps of 120 px and more. That asymmetry is exactly the complaint. The step-up committed in `fd8639b` while this brief was written (depth 20 px, overlap 10 px, predicted remaining rise) fixes rises up to about 126 px. It still leaves the 127–140 px band, because the 34 px lift is the root cause.

### 1.2 The fix (exact rules)

**F1, feet-anchored drawing (renderer only).** Bake a derived per-frame `foot` value (the measured lift) into `manifest.json`: `jump` 0 / 15 / 31 / 34 / 36 px, `air` 34–35, `hardLanding` frame 0 28. Draw those frames that much lower, eased over 50 ms. Leave the run bob alone. PNGs, pivots, timing and layers do not change, so the `ANIMATION_AUDIT` statement still holds. Jumps will *look* about 34 px lower, which is the truth.

The alternative, moving the collider's landing probe up to the toe, would raise the physical envelope by 34 px and turn every landing into a 34 px snap. It is not recommended.

**F2, one step-up rule (keep `fd8639b`'s version, with these bounds).** Check every substep while Diana is airborne, not diving and `launched` (walk-offs never qualify):
1. The collider overlaps the top by at least 10 px horizontally.
2. Her feet are below the top by more than 0 px and no more than `depth`.
3. Her predicted remaining rise, vy²/2g, is smaller than that depth, so she provably cannot clear the top herself.
4. The platform is not collapsed and not collapsing.

`depth` is 25 px within the first 40 px of the lip, 20 px elsewhere, and 24 px during a flight. The flight value mirrors Celeste's semi-solid nudge (`DashHJumpThruNudge` = 6 px on an 11 px body; 24 px is 41% of Diana's 58 px).

On a pop: snap, call `landOn(…, hard = false)`, emit `lip-catch` (the score's grace scoop) and ease the drawn y over 50 ms. Never pop within 0.1 s after a smash, and never onto a platform authored `noPop`. Then remove the single-substep `lead − advance` lip catch, which this rule subsumes.

**F3, authoring clearance.** Extend the 25 px chain-clearance test to every non-main platform across its whole span: no main-route arc may pass under such a top within `depth + 8` px while it could still pop. Never author against F2. Limits stay on the physical arc, and the pop is hidden margin, like Canabalt's building edges extending 8 px past the art ([Tuning Canabalt](https://www.gamedeveloper.com/design/tuning-canabalt)).

**F4, fixed-step accumulator.** `update()` currently ends each frame with a variable remainder substep, so arcs differ slightly at 30, 60, 144 and 240 Hz. Change it to:
- `acc += real × gentle × clock`;
- tick exactly 1/120 s at a time;
- interpolate rendering between ticks ([Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/));
- apply inputs at the next tick.

### 1.3 Tests to add

| Test | Pass rule |
|---|---|
| Alignment | With F1, every airborne frame's drawn lowest pixel is within 3 px of the feet (ground frames within 8 px) |
| Sweep | The §1.1 sweep (tap, full, double, flight): no "looked OK, fell" trial except overshoots |
| Step-up bounds | Lands at 1–20 px below on the span, 1–25 px at the lip and 1–24 px in flight. Never at 21 px or more on the span, never while diving, never when she could still clear the top, never on a collapsing top, never on a walk-off |
| Intentional pops | Every pilot's pop count and positions are recorded; the main route has none unless authored |
| Clearance | F3 holds for every level |
| Rate invariance | With F4, landing x and time are identical to 0.01 px at 30, 60, 120, 144 and 240 Hz |

## 2. Movement-feel principles with Solarum numbers

| Principle | Source and value | Solarum now | Proposal |
|---|---|---|---|
| Coyote time | Celeste `JumpGraceTime` 0.1 s ([Player.cs](https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs)) | 0.12 s | **0.12 s real** everywhere (sim value = 0.12 × clock) |
| Buffer: jump on the exact landing frame | [Celeste & Forgiveness](https://maddymakesgames.com/articles/celeste_and_forgiveness/index.html) | 0.14 s, fired inside `landOn`; a buffered tap keeps its short arc | Keep, 0.14 s real |
| Variable height | Celeste sustains jump speed 0.2 s while held; Hollow Knight's is a [capped jump cancelled on release](https://ludonauta.itch.io/platformer-essentials/devlog/1069670/hollow-knight-inspired-movement-with-the-moving-character-recipe) | Release caps vy at 280: 25–106 px | Keep: the autorunner's main expressive input |
| Apex hang | Celeste: half gravity while \|vy\| < 40 and held (40/105 of jump speed) | None | **L1 only:** ×0.5 while \|vy\| < 70 px/s real and held |
| Asymmetric arc | Mario: held rise, heavier fall ([arXiv](https://arxiv.org/pdf/1707.03865)); v₀ = 2h·vₓ/xₕ, g = 2h·vₓ²/xₕ² ([Pittman, GDC 2016](https://gdcvault.com/play/1023148/Math-for-Game-Programmers-Building)) | Symmetric, 1500 px/s² | Keep L2–L4 symmetric (the cells are solved on it); use Pittman to set L1 |
| Corner and semi-solid pops | Celeste: 4 px around ceiling corners; dashing sideways through a semi-solid pops you up | No ceilings; one-substep lip catch | F2 |
| What you see is what you collide | Swink: input, response, context, polish, metaphor, rules ([Game Feel](https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient)) | Art lifted 34 px | F1 |
| Cheap retries | Super Meat Boy: [instant respawn, short levels](https://www.gamedeveloper.com/game-platforms/-i-super-meat-boy-i-s-mcmillen-explains-why-so-hard-) | 1.1 s respawn, beacons ≤ 14 s apart | Beacon gaps shrink as precision rises |
| One ability per world | Rayman Jungle Run: jump, hover, wall-run, punch, [each carried forward](https://toucharcade.com/2012/09/19/rayman-jungle-run-review-a-run-away-hit/) ([wiki](https://raymanpc.com/wiki/en/Jungle_Run)) | One chapter | One headline per level |
| Speed tiers | Geometry Dash portals ×0.81 / 1.0 / 1.24 / 1.50 ([Portals](https://geometrydash.wiki.gg/wiki/Portals)) | 270 px/s | Gentler steps: ×0.90 / 1.0 / 1.10 / 1.20 |
| Speed vs sync | Rayman Legends: [speed changes break sync](https://www.gamedeveloper.com/audio/the-musical-box-27-game-music-level-design) | A flight adds exactly 3/16 | Change speed only between levels; keep px per beat constant |

**Expression without steering.** The player chooses:
- **Height:** tap or hold.
- **When to spend the cape.**
- **The dive** as fast-fall, and to cancel a flight or a wind lift.
- **The super jump.**
- **High or low lines**, with Great Stars that reward technique but never gate.

As in Celeste, a verb can exist before it is taught: the super jump works in L2 and L3, and L4 teaches and requires it.

## 3. One ruler, four tempos

px per beat = speed × 60 / BPM = 151.4 in every level, so the world's graph paper never changes. Implement each level as a real-time multiplier on today's simulation, `clock = BPM / 107`, applied like Gentle pace:
- The simulation, `score-path`, cells, cascade pitch, the 3/16 flight and the alignment tests stay in 107 BPM sim units.
- The transport plays at 107 × clock.
- Human-time values are divided out: sim coyote = 0.12 × clock, buffer = 0.14 × clock, respawn × clock.
- Score tolerances stay in audio milliseconds. L1's sim tolerance is therefore 31.4 ms, and L3/L4's is 35 ms × clock.

L1 additionally overrides its jump for float.

| | L1 *Waking* | L2 *Borrowed Wind* | L3 *Breaking Constellation* | L4 *The Far Door* |
|---|---|---|---|---|
| BPM / clock | 96 / 0.897 | 107 / 1 | 118 / 1.103 | 128 / 1.196 |
| Run speed (real) | 242.2 px/s | 270 | 297.8 (+10%) | 323.0 (+8.5%) |
| Sixteenth / bar (real) | 156 ms / 2.50 s | 140 ms / 2.24 s | 127 ms / 2.03 s | 117 ms / 1.88 s |
| Gravity, jump, double (real) | 1050, 510, 460 (sim 1304, 568, 513) | 1500, 570, 525 | 1824, 629, 579 | 2147, 682, 628 |
| Apex hang, max fall | ×0.5 at \|vy\| < 70; 560 px/s | none | none | none |
| Flight (real; always +113.55 px = 3/16) | no cape | 0.50 s | 0.453 s | 0.418 s |
| Crumble / cascade tile (real) | — | — | 5/16 sim = 0.636 s / 0.508 s | 0.586 / 0.469 s |
| Length | 26 bars, 65.0 s, ≈15.7k px | 32 bars, 71.8 s, ≈20.1k px | 36 bars, 73.2 s, ≈22.2k px | 42 bars, 78.8 s, ≈26.3k px |
| Beacons (largest gap) | 4 (12.5 s) | 5 (12.3 s) | 6 (11.2 s) | 8 (9.4 s) |
| Min required takeoff window, real (median) | 300 ms (≥ 450) | 220 (≥ 300) | 170 (≥ 230) | 120 (≥ 170) |
| Min landing / runway after a required landing | 260 / 180 px | 180 / 135 | 140 / 120 | 100 / 97, or a bounce cell |
| Inputs per bar, average (peak) | ≤ 1 (2) | ≤ 2 (3) | ≤ 2.5 (4) | ≤ 3.5 (6) |
| Shortest gap between different verbs | — | 4/16 (0.56 s) | 3/16 (0.38 s) | 2/16 (0.23 s) |
| Lookahead at 880 px / 960×640 embed | 2.80 / 3.22 s | 2.51 / 2.89 | 2.28 / 2.62 | 2.10 / 2.41 |
| Min logical width (2.5 s landscape / 2.0 s portrait) | 880 / 720 | 880 / 720 | 970 / 775 | 1050 / 840 (or Diana at 20%: 1010 / 810) |

**Envelopes** (*measured* with a scratch integrator that mirrors `tick()`). L2 matches LEVEL_DESIGN. L3 and L4 equal L2 in px and sixteenths within ±5 px, because time-scaling preserves arcs.

| Move | L1: physical → author up to | L2–L4: physical → author up to |
|---|---|---|
| Tap, flat | 115 px, lands at 3/16 → 90 | ≈100 → 80 |
| Full jump, flat | 264 px, 1.092 s = **7/16, on the grid** → 210 | 205 px, 5.4/16 (off grid) → 170 |
| Full jump, rise | 124 → 100 | 106 → 90 |
| Double: best rise / best flat | 223 / 501 → 175 / 400 | 194 / 391 → 165 / 280 |
| Jump + flight, flat | — | ≈450 → 400 |

The widest flat gap for a takeoff window W is `range + 32 − W × speed`: L1 296 − 73 = 223 px, L4 237 − 39 = 198 px. In L4 the window, not the distance, is the binding limit.

**L1 rhythm cells** (sampled; re-solve with the bake's crossing detection). Unlike L2, flat ground lands on the grid, which makes L1 the place to learn the rhythm.

| Move | Lands at |
|---|---|
| Full jump | +106 @5/16, +64 @6/16, **0 @7/16**, −87 @8/16 |
| Tap | 0 @3/16 |
| Double, second press @3/16 | +150 @9/16, +76 @10/16, −7 @11/16 |

L2–L4 reuse LEVEL_DESIGN's cells:
- full jump +84 @4/16, +31 @5/16, −51 @6/16;
- double +166 @7/16 and +142 @8/16;
- cape +14 @8/16 and −67 @10/16;
- cascade pitch 207 px.

## 4. The four levels

Each level is a kishōtenketsu ([Hayashida](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design)) with:
- beacons on half bars;
- three Great Stars, each visible from the route;
- a far door on a downbeat.

Intensity runs 1–5, and times are real main-route seconds.

### L1 · Waking — floating, calm, basics only (96 BPM)

The verbs are jump (tap or hold), double jump, stars and singing constellations. There is no cape or dive button. Gaps are 120–210 px on flat cells and landings are at least 260 px: room to float and look.

| Bars (time) | Step | Content | Int. |
|---|---|---|---|
| 1–2 (0–5 s) | introduce | Sprout wake; three tap stars (−24 px) and three hold stars at the hang apex (−118) | 1 |
| 3–5 | develop | Four hops on flat grid cells; *first-song* on the apexes | 2 |
| 5½ (11.3 s) | Beacon *drift* | | |
| 6–10 | twist | A ≈380 px leap (late second jump); a ≈175 px double climb with *climb-song*; **GS1** on the ledge (early double) | 3 |
| 10½ (23.8 s) | Beacon *climb* | | |
| 11–15 | develop II | Stepping stones: short islets after short gaps need taps (a held jump overshoots); wide gaps need holds | 3 |
| 15½ (36.3 s) | Beacon *stones* | | |
| 16–20 | conclude | A double-jump staircase to the high crown (**GS2**); **GS3** on the "float line": three tiny high islets only held, hanging jumps chain | 3→2 |
| 20½ (48.8 s) | Beacon *crown* | | |
| 21–26 | coda | A calm field; the last constellation completes the phrase; door at bar 27 | 1 |

### L2 · Borrowed Wind — floating with marked beats (107 BPM, today's physics)

New in L2:
- **The cape:** one flight per airtime, refilled by stable ground or a constellation.
- **Its sky:** solar wind, and the held-cape glide.
- **Its counterweight:** the dive, as fast-fall and as the way out of the wind.

The user's "correct sequences" are 2–3-verb cells on the beat, with 4/16 between verb switches.

| Bars (time) | Step | Content | Int. |
|---|---|---|---|
| 1–5 (0–11.2 s) | introduce cape | Out of L1's door; today's 375 px hearth void with *flight-line*, twice (the second time without stars) | 2 |
| 5½ | Beacon *cape* | | |
| 6–10 | introduce wind | The breeze over stone (glide school), then *first-wind* up 170 px; columns swell on every beat | 2 |
| 11 (22.4 s) | Beacon *wind* | | |
| 11–16 | develop | A required ↓ out of a column onto the island under it; optional `lid-2` star cache (**GS1**) | 3 |
| 16½ (34.8 s) | Beacon *dive* | | |
| 17–22 | twist | The long void: jump → flight → constellation refill → flight, with nothing to land on; **GS2** above it | 3 |
| 22 (47.1 s) | Beacon *refill* | | |
| 23–27 | develop II | Cells: a flight ends over a low islet → a dive lands on the beat → jump into wind | 3 |
| 27½ (59.4 s) | Beacon *currents* | | |
| 28–32 | conclude | Today's finale from a *stable* launch, with the low safe line; **GS3** at the top of *finale-wind*; door at bar 33 | 4 |

### L3 · The Breaking Constellation — the cool intermediate (118 BPM)

New in L3: cracked stone. Shelves break 5/16 after touch-down, on the grid. Lid smashes are required. The beat cascade arrives, and cracks never refill the cape.

The idea is call and response. The world calls on the beat with shake ticks, cracks and tile drops, and Diana answers in the syncopated gaps. The cascade's alternating 5/16 and 6/16 hops are already a 3+3+2-like answer.

| Bars (time) | Step | Content | Int. |
|---|---|---|---|
| 1–4 | introduce | `first-crack` over `crack-floor`; `second-crack` (jump before it breaks) | 2 |
| 5 (8.1 s) | Beacon *cracks* | | |
| 5–10 | develop | The ridge; **GS1** on the cracked chain; split voids (the *split-song* refill is required) | 3 |
| 10½ (19.3 s) | Beacon *split* | | |
| 11–15 | twist 1 | The upper path ends: smashing the lid is required; **GS2** in the well | 3 |
| 16 (30.5 s) | Beacon *well* | | |
| 16–21 | twist 2 | The six-tile cascade (one tile per 0.508 s) | 4 |
| 21½ (41.7 s) | Beacon *wave* | | |
| 22–26 | develop II | A longer cascade: one missing tile crossed by flight, cracks under the landing | 4 |
| 27 (52.9 s) | Beacon | | |
| 27–31 | conclude | Late double off a breaking shelf to the crown; **GS3** on a cracked stair above | 3 |
| 32 (63.0 s) | Beacon *crown* | | |
| 32–36 | coda | Calm stone; door at bar 37 | 1 |

### L4 · The Far Door — agitated and tense, precise but fair (128 BPM)

New in L4: the super jump, required once right after its beacon. Then everything at tighter settings:
- windows ≥ 120 ms;
- landings ≥ 100 px, often bounces;
- denser cells;
- replays ≤ 9.4 s.

There is no new hazard type, and each hard stretch has a slower stable low line beneath it.

| Bars (beacon at the start) | Step | Content | Int. |
|---|---|---|---|
| 1–4 | introduce | Super jump to a high shore over a stable floor, then required once | 3 |
| 5–9 (*storm*) | develop | Cracked launch → flight → super jump; chained constellation refills | 3 |
| 10–14 | develop | Wind → dive → wind at 128 | 4 |
| 15–19 | twist 1 | Fast cascade (0.469 s per tile) with a super-jump exit; **GS1** | 4 |
| 20–24 | develop | Narrow islands, land-and-go bounces, two refills in one airtime | 4 |
| 25–29 | twist 2 | Two voids and one cracked islet; refills from a constellation and from a 100 px rock; **GS2** high | 5 |
| 30–34 | conclude | Today's finale plus a super jump to the high finish; safe low line | 5 |
| 35–39 | conclude II | A rising double-jump stair; **GS3** above (flight + super jump) | 4 |
| 39½–42 | coda | Far door at bar 43 (78.8 s); Earth; the original recording | 1 |

### Endings, map and links

Each level ends in the original portal on a downbeat. The win card shows stars, Great Star slots, time, falls and song completion, with **Continue** (primary), **Retry** and **Title**.

Continue plays this sequence:
1. The camera rises.
2. The orbit line grows into a four-station orbit map inside the canvas. Each station shows its three Great Star slots and its constellation, inked as fully as the player's song.
3. After two bars the next level begins.

Levels unlock in order. After that the title opens the orbit map as the level select, with progress saved through the guarded `localStorage` pattern. L1 opens with the sprout; L2–L4 open with Diana stepping out of the door she entered. The twelve Great Stars each paint part of Earth in the single `--earth` blue, and Earth is seen whole only at L4's door.

## 5. What moves where

| Today (`level.mjs`) | Goes to | Change |
|---|---|---|
| `home`, tap/hold stars, `hop-a…d`, *first-song* | L1 intro and develop | Re-solved on L1 cells; hold stars at the hang apex |
| Leap + GS1 ledge, climb + *climb-song*, crown-step, high-crown, long-landing | L1 twist and conclude | Gaps widened to the L1 envelope (260 → ≈380 px, climb 162 → ≈175 px); high crown becomes GS2 |
| Hearth breeze, hearth void + *flight-line* | L2 intro | Unchanged geometry |
| `wind-gate`, *first-wind*, `lifted-shore`, `lid-2` + *cache-song* | L2 | The super-jump GS3 line moves to L4 |
| Finale chain, low safe line, *finale-wind*, *finale-song* | L2 conclude (stable launch); L4 conclude (cracked launch) | Two variants |
| `gate-2`, cracks and floor, ridge, `chain-a/b/c`, split voids + *split-song* | L3 intro and develop | Crumble moved onto the grid (5/16) |
| `lid`, well, GS2, *well-song* | L3 twist 1 | The smash becomes required |
| Cascade, `cascade-end`, `last-crack` → crown | L3 twist 2 and conclude; faster variant in L4 | |
| Super jump (`p-super`, GS3) | L4 intro | Required once |
| `far-door`, Earth, the mp3 | A door in every level; Earth and the mp3 at L4 | |

## 6. Music and level coupling

RESEARCH_MUSIC's principles hold:
- The authored main route draws the song.
- Each action plays an immediate body sound plus a quantised voice from the chord's safe set.
- A miss leaves a rest.
- Only the bed detunes; Diana's voice never does.
- G♯ is reserved for Great Stars and Earth.

Per level, the work is a conductor preset (`LEVELS[n]`: chords, sections, phrases, layers, caps), one baked `score-path` and a transport at 107 × clock.

| | L1 floaty, calm | L2 floaty, marked beats | L3 call-and-response nocturne | L4 agitated, tense |
|---|---|---|---|---|
| Groove | Half-time, no drums; a breath swell on each downbeat | Heartbeat on 1 and 3, tick on 2 and 4, shaker 16ths at −30 dB; wind swells on beats | Half-time backbeat; tresillo (3+3+2) bass and rim clave; marimba calls | Felt kick on every beat, 16th ticks, eighth-note bass ostinato |
| Harmony | The cycle at half harmonic rhythm (Bm, F♯m D, F♯m D, G, two bars each), maj7/add9 voicings | The original cycle Bm │ F♯m D │ F♯m D │ G | E Dorian (D major's notes, so G♯ stays reserved): Em9 │ A7sus4 │ Dmaj9/F♯ │ Gmaj7♯11; the motif head D C♯ B A is the call | B Aeolian over an F♯ pedal: Bm/F♯ │ G/F♯ │ Em/F♯ │ F♯sus4 → F♯ (A♯ in pads only) |
| Voice of the new verb | Jump glides with slow (250 ms) attacks | Cape vowel, singing wind, dive glide | Marimba on tiles, the crack on the grid | Super jump as stacked open fifths; string ostinato |
| Notes per beat, perfect route | ≤ 0.75 | ≤ 1.5 | ≤ 2 | ≤ 3.5 |
| Space | 5.5 s reverb, shimmer 0.45 | 5.5 s, 0.4 (today) | 3.5 s, drier voice | 2.5 s, close |
| Mistakes (H) | Detune cap 10 cents; fall = one-octave, 0.35 s tape-stop | 15 cents; today's tape-stop | 20 cents; tape-stop plus the last call played backwards | 20 cents; tape-stop plus layer drop (ostinato and choir rest until the next constellation or beacon) |
| Perfect payoff | The Signal answers the motif at the door | The choir sings the motif | The last call is answered in unison | Tempo exhales 128 → 107 into the original recording; with Great Stars, the Earth chord |

**Tension from L1 to L4.**
- Tempo 96 → 128 BPM. In listening studies, [tempo mainly drives arousal and mode mainly drives mood](https://research.bond.edu.au/en/publications/effects-of-musical-tempo-and-mode-on-arousal-mood-and-spatial-abi/).
- Density 0.75 → 3.5 notes per beat.
- Harmonic rhythm from one chord per 2 bars to one per half bar.
- Percussion: none → heartbeat → clave → four-on-the-floor.
- Mode: major/Lydian → vi–iii–I–IV → Dorian → Aeolian over a dominant pedal.
- Reverb 5.5 s → 2.5 s.

Celeste likewise layers its music per chapter ([Game Audio Lookout](https://medium.com/game-audio-lookout/enhancing-gameplay-with-music-in-celeste-5da210bbc602)), and its chapters add their own objects, such as Golden Ridge's [bouncy clouds and green bubbles](https://celeste.ink/wiki/Golden_Ridge).

**Transitions.** The door plays two bars of cadence. The map then plays the Signal's head at the *next* tempo as a one-bar pickup, and the next wake lands on its downbeat. Tempo changes only over a sustained pad tail, never as a ramp under rhythm.

## 7. Pitfalls and fairness rules

- **Windows shrink by 1/clock.** Measure them in real milliseconds per level. Keep coyote, buffer, respawn (≤ 1.2 s real) and telegraph lead (≥ 1.5 s real, which is 363 / 405 / 447 / 485 px from L1 to L4) constant. Gentle pace multiplies on top: L4 at 0.8 is 102 BPM, slower than L2.
- **Lookahead.** At 880 px, L4 shows only 2.10 s ahead. Widen the minimum logical width by clock (L3 970, L4 1050, or place Diana at 20%), keep portrait at ≥ 2.0 s, and recheck the HUD band and death line at those widths.
- **Never author against forgiveness.** Step-up, lip catch and coyote are hidden margin.
- **Re-solve, don't rescale.** L1 needs its own cells and bake. L3 and L4 reuse L2's cells, but each needs its own `score-path` hash and alignment test.
- **Length.** Keep levels ≤ 80 s and the campaign about 4.8 minutes on the main route. Repetition at speed tires players ([Geometry Dash players mute the music](https://www.imore.com/geometry-dash-6-tips-tricks-and-cheats)).
- **No new fail states in L4.** Every crack keeps a catch or a visible next step, every required verb gets a glyph on first need, and there are no blind landings.
- **Verb load.** At most two plausible verbs per obstacle; glide is taught only in wind.
- **Bots are not fun.** Pilots prove reachability and timing. Each level needs human sessions that record the first misread cue, the first death, and whether each level reads as "a bit faster".

## Sources

- Celeste: [Celeste & Forgiveness](https://maddymakesgames.com/articles/celeste_and_forgiveness/index.html) · [`Player.cs`](https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs) (`JumpGraceTime`, `VarJumpTime`, `HalfGravThreshold`, `DashHJumpThruNudge`) · [Golden Ridge](https://celeste.ink/wiki/Golden_Ridge) · [music layering](https://medium.com/game-audio-lookout/enhancing-gameplay-with-music-in-celeste-5da210bbc602)
- Jump design: [Pittman, Building a Better Jump](https://gdcvault.com/play/1023148/Math-for-Game-Programmers-Building) · [Mario jump phases (arXiv)](https://arxiv.org/pdf/1707.03865) · [Hollow Knight movement](https://ludonauta.itch.io/platformer-essentials/devlog/1069670/hollow-knight-inspired-movement-with-the-moving-character-recipe)
- Feel and engine: [Swink, Game Feel](https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient) · [Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/) · [Tuning Canabalt](https://www.gamedeveloper.com/design/tuning-canabalt) · [Super Meat Boy](https://www.gamedeveloper.com/game-platforms/-i-super-meat-boy-i-s-mcmillen-explains-why-so-hard-)
- Runners and progression: [Rayman Jungle Run (TouchArcade)](https://toucharcade.com/2012/09/19/rayman-jungle-run-review-a-run-away-hit/) · [Jungle Run wiki](https://raymanpc.com/wiki/en/Jungle_Run) · [Geometry Dash portals](https://geometrydash.wiki.gg/wiki/Portals) · [Rayman Legends music levels](https://www.gamedeveloper.com/audio/the-musical-box-27-game-music-level-design) · [Hayashida](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design)
- Music psychology: [Husain, Thompson & Schellenberg 2002](https://research.bond.edu.au/en/publications/effects-of-musical-tempo-and-mode-on-arousal-mood-and-spatial-abi/)
- Not used for numbers: Ori and Bit.Trip Runner. This pass found no primary timing data for either.
