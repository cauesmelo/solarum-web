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
| E2 | Resource state shown on Diana | WARN (double jump) | WARN (double jump) |
| E3 | Telegraphs ≥ 1.5 s, lookahead ≥ 2 s | PASS | PASS |
| F | Windows ≥ 120 ms | PASS | PASS (wider) |
| F | Decision lead ≥ 1.5 s | WARN | WARN (landings of chains) |
| F | Beat alignment ±35 ms | PASS | PASS |

Before: 5 FAIL, 6 WARN. After: 0 FAIL, 7 WARN, because C1 moved from FAIL to WARN. Each remaining WARN has its reason in the last section.

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
| E2 | The cape is the meter: a spent cape is tinted on Diana. The double jump only shows a spark burst when it is spent, and no lasting cue. | Cape PASS, double WARN | `E1/E2` |
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
- **E2, double jump.** It has no lasting cue on Diana, only the spark burst when it is spent. The rule never varies (one per airtime, and any landing restores it), whereas the cape, the resource that refills in mid-air, is drawn on her. Adding a mark means new art in the original monochrome identity, which is the art lead's call.
- **F, landing lead under 1.5 s at the committing press.** These are II's glide bridge (0.35 s landscape: the shore appears during the glide, which is the point) and the finale chains' last flight in II and IV (0.92 / 1.04 s). Also, in portrait at the 2.0 s floor, a few dashes are at 1.2–1.5 s.
  - The obstacle (the gap) is in view at least 1.77 s ahead in every level. The constellations trace the flight line, and the landing is in view before the press that commits to it (tested).
  - A level-design fix that keeps the grid would be either of two changes. One is to start the far shores 150–200 px further left. The other is to put a constellation star over the landing so it reads earlier. Both would need re-baking `score-path`, so they are left to the level designer.
- **F, III's portrait obstacle lead 1.49 s** (the lid dive). The 775 px portrait view is the brief's 2.0 s floor. Landscape is 1.77 s.
