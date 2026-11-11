# Solarum: glyphs as background signage, and the automatic level transition

Prepared 2026-11-10 by the studio's UX and motion designer for the Solarum implementer. This is a **spec**: nothing here is implemented yet. It makes decisions, gives the reason for each and says what was rejected. Where a decision changes something the [DEVELOPMENT](./DEVELOPMENT.md) describes as built, this spec replaces that part:
- the World glyphs, "Glyphs never cover Diana", Victory and "Between levels" bullets of the UI section;
- "Between levels" under The campaign;
- the result-card item of [RESEARCH_PROGRESSION](./RESEARCH_PROGRESSION.md) §6.

[RESEARCH_PROGRESSION](./RESEARCH_PROGRESSION.md), [RESEARCH_MUSIC](./RESEARCH_MUSIC.md), [LEVEL_DESIGN](./LEVEL_DESIGN.md) and [MOVEMENT_AUDIT](./MOVEMENT_AUDIT.md) stay in force.

**Fixed constraints:**
- a 2D side-scrolling autorunner with the original Diana, cape, space, signal and Earth;
- the monochrome hand-drawn identity, where Earth's blue is the only colour;
- "the path is the score";
- no canvas text;
- one independent itch.io ZIP.

**The owner's feedback, in short (translated):**
1. *"The little arrows are very good, but they seem to change position when the player passes them. I don't want them to interact with the player. They'll be background elements, purely informational."*
2. *"I like the planets behind, but not the transition between levels. I want it smoother and automatic. Could there be a nice effect when the player reaches the end of a level? It would also be nice to show how many times the player fell and how many stars they accumulated."*

## 0. Decisions at a glance

1. **Glyphs become signs in the world.**
   - Each glyph row is anchored to one world point (parallax exactly 1) and drawn in the far plane of the playfield, behind the islands, stars and Diana.
   - Nothing about a sign depends on Diana: not her position, her actions, her falls or the route.
   - The lift that raised a row over her head, the 2 px bob, "hidden once done" and "shown again after a fall" are all removed.
   - A sign's only change over time is its opacity, set by its position in a fixed **signage window** of the camera. It fades in as it enters the window and fades out as it leaves.
2. **Placement replaces the lift.**
   - While Diana is still reading a sign (before its earliest valid input), the row never touches her, on any authored route, at any layout scale. This is tested.
   - After that, she may pass in front of it, because it is behind her. Inside a disc she gets a 2 px ink keyline, so her cream silhouette never merges with the paper.
   - Today's anchors fail these rules for **11 of 20 rows** (nine overlap Diana while she reads them, one sits in the HUD band, one is late in portrait), measured in §1.5. They are moved (only `x`/`y`, never the tested windows).
3. **The old guarantees are re-stated spatially** (§1.6):
   - a sign is at full opacity at least 1.5 s before its latest valid input;
   - at most one row is visible at a time, which today's spacing already satisfies;
   - no sign covers Diana while she reads it, or a stone, a star or the HUD band;
   - the level title card never covers a required input.
4. **The level end becomes one automatic, musical transition** of **8 beats**: 4 beats at the finished level's tempo and 4 beats of the next level's count-in. It takes 3.8–5.3 s at normal pace and 4.8–6.6 s under Gentle pace:
   1. the door blooms;
   2. Diana becomes light;
   3. the camera eases back into space while the closing chord holds;
   4. the planet she leaves recedes along a dotted orbit and the next one arrives;
   5. a small tally shows falls and stars;
   6. the next level's title fades in;
   7. on the count-in's downbeat Diana steps out of an arrival door, running.
5. **The tally** is non-blocking: no buttons, no focus, `pointer-events: none`, and visible for about 1.9–2.6 s. It shows:
   - **this level:** stars `n / total`, the three Great Star slots and falls;
   - **the journey:** stars accumulated (the best of each level, summed), Great Stars `n / 3 × levels`, and every fall in the save. Falls only ever add up, as Celeste's death count does.

   The journey line also lives permanently in the pause card.
6. **Input during the transition:**
   - Any key, click or tap skips it, except R (play the finished level again) and Esc/P (pause, which freezes the transition).
   - Skipping opens one beat after the door, and only for presses that begin after the door.
   - The skipping press is consumed. A key or touch held across the transition is stale until it is released.
7. **The victory card and the orbit-map veil are deleted.**
   - Retry = R or the pause card.
   - Main menu = the pause card.
   - The finished level's result is saved at the door, not when a card is dismissed.
8. **The last level ends the journey.**
   - The door blooms in Earth's blue, the Moon sinks and Earth turns full, and the final tally appears on the downbeat where the original recording begins.
   - The credits play the first time only, then the title follows with the orbit complete.
   - Any key skips to the title.
9. **Reduced motion keeps the same beat timeline and music.** Only the picture changes: cross-fades replace the zoom, the travel and the count-up.
10. **Save version 3** adds best stars per level, lifetime falls and whether the credits have been seen. A v2 save migrates without loss.

## 1. Glyphs as background signage

### 1.1 What is wrong today (measured in `game.js` at `8fa3bac`)

`drawPrompts()` makes each glyph depend on Diana in four ways, each of which the owner can perceive as "it moves when I pass it":

| Mechanism | Code | What the player sees |
| --- | --- | --- |
| The lift | `if (right > v.x - 26 && … ) gy -= bottom - (v.y - 90) + 8` | The row jumps up when Diana's head comes under it. This is the owner's complaint. |
| Lead-based fade | `alpha = (2.6 - (q.inputX - p.x) / speed) / 0.4` | The fade depends on Diana's distance to the input, so it can happen mid-screen. |
| Hide on done / show after a fall | `shownPrompts(state.prompts, p.x)`, `q.done`, `after` | A sign blinks out when she obeys it and pops back after a fall. |
| Bob | `Math.sin(clock * 3) * 2` | A constant 2 px float. It is not player-driven, but it is motion, and it makes the lift harder to read as "the sign is still". |

### 1.2 The model

**Decision.**
- A glyph row is a **sign**: a fixed object of the world, like an island, with no behaviour.
- Its geometry is computed once per level and layout, and its opacity is a function of the **camera** only.
- The pure function that draws it takes `(prompts, camera.x, W, refWidth, scale, coarse)`. It never takes `state.player`, `state.prompts[].done`, `status`, `deaths` or any route. That signature is the guarantee, and test T1 checks it.

**Reason.**
- In Fagerholt and Lorentzon's taxonomy, these glyphs are **spatial** UI: they sit in the game's space without belonging to its fiction ([Stonehouse 2014](https://www.gamedeveloper.com/design/user-interface-design-in-video-games), after [Beyond the HUD](https://www2.slideshare.net/DICEStudio/beyond-the-hud-user-interfaces-for-increased-player-immersion-in-fps-games)).
- A spatial element reads as "in the world" only while it obeys the world: anchored to its geometry, moving exactly as the islands move.
- The lift and the lead-based fade made them partly screen- and player-relative, a hybrid that reads as a creature reacting to Diana. The owner saw exactly that.
- Celeste's tutorial bird shows the same pattern. It is a character placed at the spot of the lesson, whose messages are "pictures of buttons and directions" ([Burns, *Castle Walls* level document](https://liammib.github.io/assets/files/CastleWalls.pdf); [Celeste characters](https://celestegame.fandom.com/wiki/List_of_characters)). The prompt belongs to a place, not to Madeline.
- The players' accounts of Ori I could find describe the same principle: an ability is taught in place, on an obstacle set right after the ability is given ([Steam discussion](https://steamcommunity.com/app/261570/discussions/0/617330406652829721)). I found no primary source on how Ori draws its prompts, so Ori is cited only for the placement principle.
- Mario's World 1-1 is the classic case of teaching with geometry rather than words ([Miyamoto via Game Developer](https://www.gamedeveloper.com/design/how-miyamoto-built-i-super-mario-bros-i-legendary-world-1-1)). Our signs are the one non-geometric hint we keep, so they should be as still as geometry.

**What stays exactly as today:**
- The disc: radius 19·s, an ink stroke, the paper ring at r + 4 drawn at 0.4 alpha, and the drawn arrow.
- The hold dots: three paper diamonds 10 px under the disc. The "then" diamond sits between discs, which are spaced 48·s apart.
- Touch devices show the up glyph as the jump zone's rounded square.
- Optional signs are smaller (×0.82) and dimmer (×0.75).
- The scale `s = (optional ? 0.82 : 1) × clamp(0.9 / cssScale, 1, 1.8)` is a **layout constant**, recomputed only on resize. The owner likes the discs, so their look is not redesigned.

**Removed:**
- the lift line and its regex test;
- the bob;
- the renderer's use of `shownPrompts`, `q.done` and `q.after`;
- the lead-based alpha.

The model may keep `markPrompts`/`done` for QA (the glyph follower), but no pixel may depend on it.

### 1.3 Layer

**Decision.** In `draw()`, inside the world transform, the order becomes:

1. updrafts;
2. the look's island particles and asteroids (the art squad's in-progress `drawIslandParticles` / `drawAsteroids`, if they land);
3. **signs**;
4. platforms, beacons, the portal, the scripted back layer, constellations, stars;
5. Diana (with the keyline of §1.4), moments, effects.

**Reason.**
- Signs are information *about* the playfield, so everything playable is in front of them.
- Wind columns are drawn under them, so a sign inside a column stays crisp (VI has three signs in wind).
- Because §1.5 keeps rows off stone and stars, this order only matters at the edges.

### 1.4 Overlap with Diana: allowed after the decision, with a keyline

**Decision.**
- Before Diana reaches a sign's **earliest valid input** (`from`) on any authored route, its row never touches her drawn box (§1.5).
- From `from` on, she may pass in front of it.
- On any frame where a visible row's rect intersects her drawn box (x ± 26, feet − 90 to feet, +8 px margin), the renderer draws her current frame first in **ink**, offset 2 px in 8 directions and **clipped to the union of the intersecting discs' outer circles (r + 4)**, then Diana as usual.
- Outside discs, nothing changes, so the approved animations look exactly as today.
- Implementation: tint the current sheet frame to ink once into a small offscreen canvas (`source-in`), cache the last 8 frames, and draw it 8 times. That costs well under 0.3 ms, and only on overlap frames.

**Reason.**
- Diana is cream with ink lines, and the discs are paper. Without a keyline her silhouette dissolves into a disc, which is why the lift was added.
- The keyline keeps her legible without moving the sign.
- In the act phase the player watches her, not the sign, and the sign has done its job.
- A sign that dims or steps aside while she passes is exactly the "interaction" the owner rejected.

**Rejected:**
- *Signs above every possible arc.* Sloppy or optional lines can reach anywhere, and VII's super jump climbs 173 px, which would push signs into the HUD band.
- *Signs carved into the island face under the lip.* That is safe for any trajectory, but it puts paper on paper (unreadable), forces a redesign of the discs the owner likes, and has no stone under mid-air acts.
- *Always-on keyline.* It changes her look against cream islands.

### 1.5 Placement rules and today's inventory

**Rules.** Each is tested; the implementer iterates like the authoring workflow in the progression handoff.

- **P1 · Clear while reading.** The row's rect (at s = 1 and s = 1.8, with hold dots) stays 8 px or more from Diana's box on every authored route (main, upper, ability, safe at 120 Hz) for every tick with `x < from`.
- **P2 · Off the playfield.** The row never intersects a platform's drawn top band (top − 8 to top + 24) or body, a star's pickup circle (34 px loose, 40 px constellation), a crack's zigzag or a lid's star break.
- **P3 · Under the HUD band.** While the row's alpha is above 0 in the reading phase, its top stays at least 8 px below the 56 px band at the real camera (stepped, as in play).
- **P4 · In time.** See §1.6, G1.
- **P5 · One at a time.** See §1.6, G2.
- **Two good spots, in this order:**
  1. *Over the run-up.* The row is centred over the stone she runs along before `from`, with its centre at least **150 px above that stone's top**. That leaves her head (feet − 90) + 8 px + the 1.8× disc (38 px) + hold dots (14 px).
  2. *Over the gap.* If the camera has no room above (high islands sit high on screen), place the row past the lip, with its left edge at least 34 px beyond `from` and clear of the landing (P2). She only reaches it while acting.
- **Never** move `from`, `to` or `inputX`. They are the tested timing windows (the "following each glyph succeeds" test), and the movement audit depends on them.

**Inventory: today's anchors drawn static** (no lift, no bob, fade-in 64 px).

How it was measured: a read-only scratch script against `8fa3bac` (not committed) replayed all four authored routes per level at 120 Hz through `tests/routes.mjs`. The HUD margin uses the settled camera target, so the implementer's T2 with the real stepped camera is authoritative. "Reading overlap" counts 120 Hz ticks with `x < from`, summed over the four routes.

| Level | Sign | Full opacity before latest input (landscape ref / portrait min at 1.8×) | Reading overlap (1× / 1.8×) | HUD margin | Verdict |
| --- | --- | --- | --- | --- | --- |
| I | p-jump ↑ | 2.88 / 2.26 s | 116 / 144 | 268 px | **move** (sits at head height over the home run-up) |
| I | p-tap | 3.05 / 2.42 | 157 / 189 | 251 | **move** |
| I | p-key ↑↑ (opt) | 2.48 / 1.80 | 0 / 0 | 84 | keep |
| I | p-leap ↑↑ | 2.44 / 1.73 | 0 / 0 | 130 | keep |
| II | p-first-flight (opt) | 2.40 / 1.76 | 0 / 0 | 100 | keep |
| II | p-cape ↑·→ | 2.29 / 1.62 | 0 / 0 | 86 | keep |
| II | p-refill → | 2.69 / 2.11 | 32 / 45 | 122 | **move** |
| III | p-float (opt) | 2.54 / 2.01 | 0 / 0 | 44 | keep |
| III | p-hold ↑·hold→ | 2.15 / 1.53 | 0 / 0 | 100 | keep (tight on time) |
| IV | p-break ↓ (opt) | 2.76 / 2.26 | 0 / 0 | **6** | **move** (P3) |
| IV | p-cut ↓ | 2.92 / 2.41 | 124 / 168 | 90 | **move** |
| V | p-crack ↑ | 2.37 / 1.82 | 0 / 0 | 184 | keep |
| V | p-split ↑·→ | 1.99 / **1.37** | 0 / 0 | 158 | **move** (P4 in portrait: about 37 px earlier) |
| V | p-through ↓ | 2.47 / 1.92 | 4 / 48 | 75 | **move** |
| VI | p-breeze (opt) | 2.21 / 1.61 | 0 / 0 | 144 | keep |
| VI | p-wind ↑ | 2.37 / 1.81 | 104 / 128 | 238 | **move** |
| VI | p-glide hold→ | 2.26 / 1.71 | 0 / 0 | 87 | keep |
| VI | p-top → | 2.25 / 1.69 | 36 / 59 | **−103** | **move** (inside the HUD band at the column's top) |
| VII* | p-super ↑·→·↑ | 2.44 / 1.77 | 252 / 348 | 286 | **move** |
| VII* | p-storm ↑·→·↑ | 2.36 / 1.70 | 253 / 349 | 257 | **move** |

\* VII is the interim Far Door. When VIII is built, its signs move with the content and must meet the same rules.

This is why the lift existed: 11 of 20 rows sit where Diana's head passes during the approach.

### 1.6 Visibility, and the guarantees re-stated

**The signage window** is in camera space and never uses Diana's position:
- `P = camera.x + 0.23 W` is the camera's player column (`VIEW.playerFraction`).
- `refW' = min(W, refW)`, where `refW` is the level's landscape minimum width (880 / 920 / 970 / 1050). Landscape views are never narrower than `refW` (they letterbox), so `refW' = refW` there; portrait views use their own width.
- `left = P − 0.23 refW'` and `right = P + 0.77 refW'`.
- **Fade in** over the window's right 64 px: `a_in = clamp((right − rowRight) / 64)`. That is 0.20–0.29 s at 222–323 px/s.
- **Fade out** over its left 48 px: `a_out = clamp((rowLeft − left) / 48)`.
- `alpha = min(a_in, a_out) × (optional ? 0.75 : 1)`.
- On ultrawide screens, signs therefore fade at the window's edges rather than the screen's. That keeps "one at a time" true on any monitor without making a sign depend on the player.

**Reason.**
- Signs come into view with the world they belong to, softened only at the edge. The brief asks for fades "on entering and leaving the view only".
- Linear opacity over a short distance reads as "coming into focus", not as "appearing because I arrived".

| Old guarantee (tested today) | New statement (tested) |
| --- | --- |
| Shown ≥ 1.5 s (real) before its latest valid input | **G1.** The row is at full opacity (`rowRight ≤ right − 64`) when the camera's player column is 1.5 s (real) before `inputX`. Checked at the landscape reference width with s = 1, and at the portrait minimum width with s = 1.8. Gentle pace only adds time. |
| One at a time (`after`; optional signs hidden while a required one is due within 540 px) | **G2.** At every camera position, at most one row has alpha > 0, at the reference width and at the portrait minimum. Spatially: consecutive anchors are at least `refW' + halfA + halfB` apart. That holds today everywhere: the smallest gap is 1060 px against 923–966 needed. Because nothing is ever visible alongside a required sign, the optional-hiding rule is subsumed. |
| Never over a required input (title card); glyph rows clear Diana | **G3.** The level title card never covers a required input. This is unchanged, and it is also checked against the transition's earlier card start (§2.7). **G4.** P1–P3: no sign over Diana while she reads it, over a stone or star she needs, or inside the HUD band. |
| Following the glyph at its first valid moment (and its last, if required) survives | **G5.** Unchanged: the windows `from`/`inputX` are untouched. |

### 1.7 After a fall

**Decision.** Nothing happens to signs.
- The shards fly back, the iris closes and the camera snaps to the beacon.
- Whatever signs fall inside the window at the new camera are drawn at their window opacity on the first frame after the cut, which the iris already hides.
- A sign between the beacon and the place she fell is simply still there.
- The three-falls tip and the five-falls assist hint are words on ink plates (`showTip`) and are unchanged.

**Reason.** "Shown again after a fall" becomes true by construction, with no event, so there is nothing to see react.

## 2. The automatic end-of-level transition

### 2.1 Why automatic, and what I did not take

**Decision.**
- The level end flows into the next level on the music's own pulse.
- There is no card and no choice to make. Retry and the menu stay one key away.

**Reason.**
- Solarum's loop is a calm, wordless, 47–56 s song per level. A modal card every 50 s halts the pulse the score has built and asks a menu question nobody needs answered: the common case is "go on". The owner felt this as "not smooth".
- **Sayonara Wild Hearts** is the closest relative, an album of levels:
  - it "never pauses to introduce the action";
  - it has a "continuous album arcade mode";
  - its bronze, silver and gold ranks never stop you going on ([Gaming Trend review](https://gamingtrend.com/reviews/picking-up-the-pieces-sayonara-wild-hearts-review/)).
- **Journey** separates its areas with short visual interludes at shrines rather than menus. Its ending runs the credits over a shooting star that retraces the traveller's path, then returns to the dune where it began ([Wikipedia](https://en.wikipedia.org/wiki/Journey_(2012_video_game))).
- **Super Mario Odyssey** makes the things you collect the vessel's fuel: Power Moons are "the power source of the Odyssey and grant access to new kingdoms" ([Wikipedia](https://en.wikipedia.org/wiki/Super_Mario_Odyssey)). Our journey tally borrows that: the level's stars pour into what Diana carries toward Earth.
- **Alto's Odyssey** is praised for changing landscapes inside a run without breaking it ([Pocket Gamer](https://www.pocketgamer.com/altos-odyssey/the-stunning-endless-runner-altos-odyssey-features-air-balloons-desert-winds-and/), a secondary source). That is the feel the owner wants between planets.

**Rejected:**
- *A blocking results screen.* Celeste's chapter end (strawberries, deaths, time; [secondhand description](https://cf-inc.shapes.inc/fandom/celeste/deep-dive)) and Geometry Dash's level complete suit games where retrying is the main loop and the screen waits for you. I could not find a written source for Geometry Dash's screen layout; RobTop's [leaderboard notes](https://robtopgames.com/files/GDLeaderboards.pdf) confirm it counts attempts and jumps per level. Solarum's retry is a key away and its pulse matters more.
- *Ranks and medals.* Rayman Legends tallies Lums at the end of a level with its "Lums Count Awards" and cups ([Gamewatcher](https://www.gamewatcher.com/reviews/rayman-legends-review/8882)). Grading conflicts with "stars never gate anything" and with the calm tone. We keep the count-up joy and drop the grade.
- *Time and song notes in the tally.* The owner asked for falls and stars. A tally read in about 2 s holds three things per row, not five. The song's completion is already heard at the door.

### 2.2 Duration (4 beats + 4 beats)

Let `b = 60 / (BPM_from × pace)` and `c = 60 / (BPM_to × pace)`, where `pace` is 1, or 0.8 under Gentle pace.
- **Phase A** has beats A0 … A4, at `A_k = A0 + k·b`.
- **Phase B** is the next level's count-in, at `B_k = A4 + k·c`.
- **B4 is bar 1 of the next level.**

| Transition | BPM | A (4 beats) | B (4 beats) | Total | Gentle pace |
| --- | --- | --- | --- | --- | --- |
| I → II | 88 → 94 | 2.73 s | 2.55 s | **5.28 s** | 6.60 s |
| II → III | 94 → 100 | 2.55 | 2.40 | **4.95** | 6.19 |
| III → IV | 100 → 107 | 2.40 | 2.24 | **4.64** | 5.80 |
| IV → V | 107 → 112 | 2.24 | 2.14 | **4.39** | 5.48 |
| V → VI | 112 → 118 | 2.14 | 2.03 | **4.18** | 5.22 |
| VI → VII | 118 → 123 (interim VII: 128) | 2.03 | 1.95 (1.88) | **3.99** (3.91) | 4.98 (4.89) |
| VII → VIII | 123 → 128 | 1.95 | 1.88 | **3.83** | 4.79 |

**Reason.**
- One bar of each tempo makes the transition a musical phrase: a cadence bar, then a count-in bar.
- It inherits the campaign's acceleration. The last transitions sit just under 4 s because a bar at 123–128 BPM is under 2 s. I prefer that to padding with silence.

**A0 is the beat on which the score sounds the door chord.** The score already quantises it, and on the main route it is the level's final downbeat. With sound off, A0 is the `win` event's time. Every visual below is locked to these beat times, never to fixed seconds, so it stays on the music at any tempo or pace.

### 2.3 Beat by beat

The times are I → II at pace 1, then VII → VIII in brackets.

| Beat | Time | Picture | Music | Input |
| --- | --- | --- | --- | --- |
| **A0** | 0.00 s | Diana stops in the far door, as today (the model's `won`). The door's opening fills with paper light from the threshold up (§3.2), and ring 1 leaves the door. The HUD's level items (stars, slots, orbit, breath bar) fade over ½ beat; pause, fullscreen and sound stay. **The result is saved now** (§2.11). | The door cadence and the soundtrack duck, unchanged. | Skip locked. R and Esc/P work. |
| **A1** | 0.68 (0.49) | Ring 2. Diana dissolves into the light (alpha 1 → 0 over 1 beat: she becomes light). 12 star motes and 3 tail-star streaks rise from the opening. **Pull-back begins:** zoom 1 → 0.55 about the door, with the door gliding toward the centre (§3.3). | — | **Skip opens**, for presses that begin after A0. |
| **A2** | 1.36 (0.98) | The world fades out (alpha 1 → 0, A2 → A3). The planet she leaves sets off along its arc (A2 → B1). The dotted orbit line draws itself from it (A2 → A3). **The tally fades in** (A2 → A2.5), with the level row at its final values. Screen-reader announcement. | **The closing chord's held pad enters.** It used to start a fixed 2 s after the door; at 88–128 BPM, A2 falls 1.36–0.94 s after it, overlapping the cadence's tail. | |
| **A3** | 2.05 (1.46) | Only space is left: sky, two bodies, the orbit line. Diana's two-leaf marker leaves the old stop (A3 → B2). The **journey row counts up** from the save's old totals to the new ones (A3 → A4, at most 12 steps). | One soft star sparkle when the count lands on A4, from the held chord's safe set, on the stars layer under Diana's notes. Silent if Sounds is 0. | |
| **A4 = B0** | 2.73 (1.95) | **Swap:** the next level loads unseen (`status: 'ready'`). The new planet has been entering since A2.5 and reaches its level-start box at B2 (§3.4). | **Count-in beat 1** (accented), at the next tempo. | R now reloads the finished level. |
| **B1** | 3.37 (2.42) | The old planet comes to rest, small, at the left. | Count-in 2 | |
| **B2** | 4.00 (2.89) | The leaf marker arrives at the new stop. **The next level's title card** fades in (300 ms) in its usual place at 17% of the stage height, then holds. **The new world fades in with a push-in** (zoom 1.12 → 1, alpha 0 → 1, B2 → B4), already framed exactly as the run will be. The arrival door at the start lights up (§2.7). | Count-in 3 | |
| **B2.5** | 4.32 (3.12) | The tally and hint fade out (B2.5 → B3). The orbit line and the old planet fade (B3 → B4). | | |
| **B3** | 4.64 (3.36) | Diana appears inside the arrival door's light (alpha 0 → 1). The next level's HUD fades in (0 stars, empty slots, orbit at 0, the breath bar if owned). Touch controls return. | Count-in 4 | |
| **B4** | 5.28 (3.83) | **Bar 1.** Diana steps out running: the original `start` clip runs into the run, as after the wake. The door's light ebbs over 1 beat; the door stays as scenery and scrolls away. | Bar 1 of the next score. Its sky swells in under the held chord's 1.4 s fade, the existing handover. | Live. Keys held from before are stale until released. |

**Reason for the staging.** These are the animation principles of Thomas and Johnston ([Twelve basic principles](https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation)):
- **Anticipation:** the light gathers for a beat before anything moves.
- **Staging:** one idea at a time, in order: door, space, travel, numbers, arrival.
- **Follow-through:** the motes keep rising after Diana is gone.
- **Arcs:** planets travel on curves.
- **Slow in and slow out:** every camera and body move eases (§3.7).
- **Timing:** all of it rides the beat.

### 2.4 The tally

**Content.**

| Row | Stars | Great Stars | Falls |
| --- | --- | --- | --- |
| **Level** (labelled with the level, e.g. "I · Waking") | `20 / 29`: the stars she carried through the door (`state.stars`), out of the level's loose and constellation stars | The three slots: banked filled, the rest hollow (the HUD's own art) | `1 fall` / `n falls`: this run's falls (`state.deaths` since the level was last started or restarted, star-net catches included; "back to last light" is not a fall) |
| **Journey** | `58`: the sum over levels of each level's **best** stars in one completed run | `4 / 24`: the sum of each level's best Great Stars, out of 3 × the number of levels | `5 falls`: every fall in this save, in any level and any run (restarted and abandoned runs included) |

**Why these semantics.**
- *Stars accumulated as best per level:* summing every run would let replays inflate the number until it meant nothing.
  - On a first play-through, best per level is exactly the running total the owner described.
  - On a replay it grows only by improvement, and the count-up shows that improvement.
  - Mario Odyssey's moons work the same way: a kingdom's moon counts once.
- *Falls as a lifetime total:* falls are things that happened on the journey, not things you keep, so they only add up. Celeste's save file treats deaths this way too; players compare totals in the thousands ([Steam thread](https://steamcommunity.com/app/504230/discussions/0/1628538707074318672)).
- The asymmetry, unique collectibles against cumulative deaths, is the Celeste convention, and players read it without explanation.

**Tone.**
- Falls are shown plainly: the word, a number, `--hill` text.
- There is no red, no animation and no "0 falls" trophy.
- A fall in Solarum costs 1.1 s and the bed goes slightly out of tune; the tally does not add a second penalty. The ending reframes the number once (§2.8).

**Look.**
- A small **ink panel with the paper frame**, the title panel's language (opaque `--ink`, the hand-drawn frame, no boil under reduced motion).
- Two rows of three items. The star sprite icon and the slot art are the HUD's own; numbers are 22 css px, labels 16 css px in `--mute`, in the Solarum font.
- Paper text on an ink plate reads over any planet. Jupiter's disc can sit behind the panel; its paper bands are at most 30%.
- No buttons, `pointer-events: none`, never focused. It is DOM, because the canvas has no text. It is animated by opacity and transform only.
- `role="status"` with `aria-live="polite"`, announced once at A2: "I · Waking complete. 20 of 29 stars, 2 of 3 Great Fallen Stars, 1 fall. Journey: 58 stars, 4 of 24 Great Fallen Stars, 5 falls. Next: II · The Gift."

**Count-up.**
- Only the journey stars and journey Great Stars count, from the save's previous totals to the new ones, over A3 → A4 in at most 12 integer steps (set `textContent` per step, never per frame).
- A Great Star improvement fills its slot icon with one pulse.
- Journey falls appear at their final value. A fall is not celebrated, and a counting-up fall total would dramatise it.

**Hint** (one line under the panel, `--mute`, fading with it):
- Keyboard: `R  again   ·   Esc  menu`.
- Touch: one 44 px ink button "↺ again". The HUD's existing II button is the menu.
- No "press to continue": nothing waits for you.

**Also in the pause card.**
- One line under the big orbit: `Journey  ★ 58 · ◆ 4/24 · 5 falls`.
- A player who skips the tally loses nothing, and the totals are always one key away. This follows the Game Accessibility Guidelines: "If using a long overarching narrative, provide summaries of progress" ([full list](https://gameaccessibilityguidelines.com/full-list/)).

### 2.5 Input across the transition

| Input | Effect |
| --- | --- |
| Any key except R, P, Esc, Tab and modifiers; a click or tap on the stage except the HUD buttons and ↺ | **Skip**, if it began after A0 and the time is ≥ A1 (the one-beat lockout). Before A1, nothing happens. |
| R or Shift+R | Play the finished level again: `restartChapter()` before the swap, `startLevel(finished)` after it. Allowed from A0. |
| Esc or P, or the HUD's II | Pause. The transition's timeline freezes with the game clock and the AudioContext suspends, as for any pause. The pause card offers Continue (resume the transition where it was), **Play I · Waking again** (the "Restart level" button relabelled; "Back to last light" hidden), Main menu, Sound, Assist and the sliders. |
| Blur or a hidden tab | Auto-pause, as today. |
| Precedence within a frame | R, then pause, then skip. |

**Skip.**
- Perform the swap if it has not happened yet, and cancel the count-in beats that have not sounded (15 ms fade, no click).
- Cut to the arrival state with a 0.3 s cross-dissolve: the new world at alpha 0 → 1 with no zoom, and Diana in the arrival door's light.
- The title card starts as usual.
- The run begins 0.3 s after the press, with bar 1 and the held chord's 1.4 s handover.
- Under reduced motion the dissolve is replaced by a cut.

**Consumed and stale presses** (no input lost or doubled):
- The skipping key or tap is consumed. It never reaches `jump`, `dash` or `dive`, and never feeds the 0.14 s jump buffer.
- Every key or pointer that is down at B4 (or at a skip's run start) is **stale**: its `keyup` or `pointerup` is swallowed, and it produces nothing until it has been released and pressed again.
- `held.glide` starts false.
- A fresh press after B4 acts on its own 1/120 s tick through `atInput`, exactly as in play.

This follows Corona Invaders' rule for its LAB REPORT: "a key held from the fight must be released first".

**Reason.** The lockout catches the reflex press of a player still jumping at the door. Requiring a press that begins after A0 catches a key held through the door.

### 2.6 Music continuity

Everything already exists in `audio.mjs`; this only re-times it.
- **A0:** the door cadence, unchanged. The last level's recording still begins two bars after the door, on a downbeat.
- **A2:** the closing chord's held bed pad, which used to start 2 s after the door. It is still re-voiced every 5.5 s and ended by any reset.
- **B0–B3:** `countIn({ bpm: BPM_to × pace, at: B0 })` returns a **handle with `cancel()`**. Skip, R, Main menu and a pause-then-Main-menu all cancel the beats that have not sounded. Four felt beats: the first accented, the Signal on the downbeat, as today.
- **B4:** the new score's bar 1, with the 1.4 s handover under the held chord.
- Under **reduced motion the count-in still plays.** Today `showMap` skips it there, but reduced motion is about motion, not sound.

**Reason.** The closing chord never stops before the count-in starts, so the two levels join as one phrase: a cadence, a breath of held harmony, then the new tempo's pulse. That is the RESEARCH_MUSIC promise of no silent transitions, kept.

### 2.7 Arrival: a door at the start

**Decision.** After a transition, the next level begins with the **original portal** standing behind Diana:
- it is centred at `startX − 60` on the start stone, base at `startY`, 110 px wide, using `portalPlacement`;
- its opening is lit (B2 → B4 at 0.85 paper, ebbing to 0 over B4 → B5);
- it stays as scenery for the arrival run, and is cleared by Restart level, `startLevel` or the title.

Every built level starts on a stone running from x −700 to about 1100 (VII's to 1850), and the first main-route press is 870 px or more after the start. That leaves room for the door and at least 2.7 s of free running.

**Arrival details:**
- `wake({ arrival: true })` skips the sprout pop, the title ground's 0.6 s fade and the 0.9 s wake pan. The camera is already at the run framing, so no world moves under her after the transition.
- The title card is shown from B2. Its envelope (0.3 s in, 1.6 s hold, 0.5 s out) is unchanged, so it ends about 2 beats earlier into the run than after a wake. It still covers no required input; T3 checks both schedules.
- A level started from the title (any open stop) still wakes from the earth, as today. A door behind a girl rising from the soil would mix two metaphors.

**Reason.** A door-to-door match cut tells the story without words: she went through the far door and came out at the next leg of the GDD's journey. It reuses the one piece of original art that already means "passage".

### 2.8 The last level: the ending, Earth, credits, title

This applies to the last entry of `LEVELS`: today the interim VII, later VIII. Beats are at the last tempo (`b`, with a bar = 4 b).

| When | Picture | Music |
| --- | --- | --- |
| A0–A2 | As §2.3, but **the door's light is `--earth` at 0.9**, the only time the bloom is blue. The motes stay paper. | The door cadence (Earth chord with three Great Stars), unchanged. |
| A1–A5 | A deeper pull-back (zoom → 0.35). The world fades A2 → A3. The Moon's limb sinks by 0.5 H (easeInCubic, A2 → A6). | |
| A2–A8 | **Earth turns to face her.** The look's crescent (`earthBox`) grows and moves to (0.5 W, 0.42 H), with r to 0.2 H. The ink disc that makes it a crescent slides off (offset 0.42 r → 1.6 r), so it becomes a whole blue disc. easeInOutCubic. | The held chord. |
| A8 = bar 2 | **The final tally:** the last level's row and the Journey row, then one line: "Earth, whole and blue, remembered every star." with every Great Star of the campaign, else "Earth. Small, blue, and listening. She was home." It holds through bar 4. | **The original recording begins** on this downbeat (the existing behaviour). |
| Bars 4–12 (**first completion only**) | **Credits**, one card at a time (each 1.5 bars, fading 0.25 bar in and out, no scrolling): the original logo (`logo.png`); "A Signal in the Dark"; "Cauê Melo · Daniel Calônico · Lucas Santos · Rafael Lima"; "Soundtrack: Amanda (meromei) · Bruno Mareto (Bu Maré)"; "Thank you for playing." Earth turns slowly behind them, still under reduced motion. Paper on ink, ≥ 18 css px, DOM. | The recording. |
| Then (1 bar) | The title fades in with the orbit line complete and Earth's stop lit, selecting the last level as `toTitle()` does. | The recording simply continues as the title song (same file, no restart). |

**Timing:**
- First completion: about 13 bars, 24.4 s at 128 BPM.
- Later completions: the credits are skipped automatically (save flag `credits`), about 5 bars, 9.4 s.

**Input:**
- After the one-beat lockout, any key or tap goes to the title with a 0.6 s fade; the recording continues.
- R plays the last level again.
- Esc/P pauses; Main menu leads to the same title.

The credits are well over 5 s of moving content, so they need this skip (WCAG 2.2 SC 2.2.2, "Pause, Stop, Hide": a [mechanism to pause, stop or hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)).

**Reason.**
- The journey deserves one longer breath, and the original recording is the payoff the music brief already planned.
- Journey's credits ride over the retracing of the path and end where the game began ([Wikipedia](https://en.wikipedia.org/wiki/Journey_(2012_video_game))). Our title is Diana's home, so ending there closes the circle.
- Credits only the first time respect players replaying VIII for its Great Stars.
- The falls line in the ending stays numeric. The tone comes from the Earth line, not from a comment on the player.

### 2.9 Reduced motion

**Decision.**
- `prefers-reduced-motion: reduce` ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)) keeps **the same beat timeline, durations, music and input rules**.
- Only the picture changes:
  - the door's light appears at full, without the rising front or rings;
  - no motes;
  - Diana stays visible until the world cross-fades out (A2 → A3);
  - no zoom, push-in, arcs or growth: both bodies are drawn at their end positions and cross-fade;
  - the orbit line is drawn complete and the leaf marker sits at the new stop;
  - the tally shows final values with no count-up;
  - the new world, the arrival door and Diana cross-fade in (B2 → B4).
- In the ending, the Moon and Earth are static at their end states and the credits fade.
- A skip is a cut.

**Reason.**
- One timeline means one implementation and one set of tests; reduced motion becomes a rendering mode, not a second flow.
- Cutting time as well would also cut the count-in. Motion sensitivity says nothing about sound.
- The Game Accessibility Guidelines ask to "Avoid any sudden unexpected movement or events" and to provide "an option to turn off / hide background movement" ([full list](https://gameaccessibilityguidelines.com/full-list/)).
- In every mode the light ramps over a beat and nothing flashes more than three times a second (WCAG [2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)): "Avoid flickering images and repetitive patterns".

### 2.10 Layouts

| Layout | Space animation | Tally | Hint and controls |
| --- | --- | --- | --- |
| Desktop / landscape (≥ 880 logical px; 960 × 640 css) | The whole sky | Centred; its top at 58% of the stage height; at most 440 css px wide. Clear of the title card at 17%. | Keyboard hint under the panel |
| Landscape phone (844 × 390 css; stage scale about 0.58) | The whole sky | Centred; top at 56%; at most 60% of the stage width and 34% of its height. Numbers stay at 22 css px and labels at 16 (never smaller). | "↺ again" (44 px) under the panel. Touch controls hidden A1 → B3. |
| Portrait phone (390 × 844 css: a 366 px sky over a 418 px deck) | The sky (bodies scale with H as in play) | **In the deck**, centred, 24 px under the sky. The sky stays free for the planets and the title card. | "↺ again" under the panel, in the deck. The jump zone, cape and dive buttons are hidden A1 → B3 and fade back with only the owned verbs. A tap anywhere else skips. |
| 320 × 568 | As portrait | As portrait. Rows may wrap the three items to two lines; the panel stays within the deck. | As portrait |

### 2.11 What the save records (version 3)

```json
{ "v": 3, "unlocked": 3,
  "great": { "waking": 2, "gift": 3 }, "done": { "waking": true, "gift": true },
  "stars": { "waking": 24, "gift": 41 }, "falls": 17, "credits": false }
```

- `stars[key]` is the best star count of one completed run of that level: loose plus constellation stars, with Great Stars separate.
- `falls` counts every fall since the save began. It is incremented and written at each `death` event, so restarts and Main menu never lose falls.
- `credits` records whether the ending's credits have been seen.
- **The completion is written at A0** (`unlocked`, `done`, `great`, `stars`), not at the end of the transition. A skip, R, Main menu or a closed tab mid-transition all keep it. Today `showVictory()` writes it 1.5 s after the door.
- **Migration:**
  - v2 → v3 adds `stars: {}`, `falls: 0` and `credits: false`, so journey stars start at 0 for levels finished before the update;
  - v1 → v2 is unchanged;
  - storage stays guarded: blocked storage means session-only totals, never a throw.
- `readSave` tolerates unknown fields.

## 3. The visual effect in Canvas 2D

All of it uses existing assets and tokens:
- the portal (`portal.png`), the star sheet (`star.png`), the tail-star streak (`tailStar.png`), the bodies in `backdrop.mjs`, the leaf path of the orbit marker, and `logo.png` (credits);
- `--ink #0C0C0F` and `--paper #FBFBEA` for everything, `--mute`/`--dim` for secondary marks, and `--earth #6FA8DC` only for Earth and the last door.

### 3.1 Layers, back to front

1. **Sky:** the ink fill, dust and the original twinkling stars. It reads a **sky camera**, `skyCam = camera + skyOffset`.
   - At the swap, `skyOffset` is re-based so the sky never jumps: `skyOffset = skyCam_at_swap − camera_new`. The offset persists harmlessly, because the starfield is procedural and wraps.
   - From A3 to B2, the sky camera advances an extra 0.6 W (easeInOutSine). Far stars barely move, which is the truth of parallax; the travel reads from the bodies.
   - No new shooting stars start during the transition; a running one finishes.
   - The Earth signal glint is unchanged.
2. **Bodies:** the old look's body, then the new one (§3.4).
3. **Accents:** the old look's accent fades with the world (A2 → A3) and the new one with the new world (B2 → B4).
4. **Orbit line, stops and leaf marker** (§3.5).
5. **World** under the transition's zoom (§3.3): the finished level A0 → A3, then the new level B2 → B4. Each uses its normal draw order (§1.3) and is culled to the zoomed view.
6. **Door light and glow, ring pulses** (§3.2), inside the zoom.
7. **Diana:** dissolving A1 → A2, appearing B3 → B4.
8. **Motes and streaks** (§3.6).
9. **DOM:** the HUD (fading), the title card, the tally, the hint and the pause card.

### 3.2 The door bloom

**The opening, measured on `portal.png`** (250 × 397):
- the interior spans 12–83% of the width from 30% of the height down to the base, about x 30–206;
- it narrows to 24–69% at 20%;
- the arch's crown is at about 17%; the emblem above it is opaque.

Build the clip path in sprite fractions: a rect from (0.12, 0.30) to (0.83, 1.0) plus a half-ellipse cap from 0.30 up to 0.17. Map it through `visibleBounds`, as `portalPlacement` does.

**Light (A0 → A1):**
- `u = easeOutCubic((t − A0) / b)`.
- A front rises from the threshold to the crown. Below it, paper at 0.85·u; above it, nothing. It is a vertical linear gradient whose stop moves with u.
- From A1 the opening is full at 0.85 until the world fades.
- A soft glow outside: a radial gradient from the opening's centre, paper 0.12 → 0 over 1.4 × the opening's width.

**Rings:** two paper strokes, at A0 and A1. Each runs radius 24 → 220 world px, alpha 0.55 → 0 and line width 2 → 1 over 1.2 b, easeOutCubic. This is the beacon's ring-pulse language.

**Diana:** her sprite's alpha 1 → 0 over A1 → A2 (linear). She stands in front of the light, so her cream fades into it.

**Last level:** the same, with `--earth` at 0.9 for the light and glow, and paper rings.

### 3.3 Camera: pull-back and push-in

**Pull-back.**
- World transform: `translate(S) · scale(z) · translate(−D)`.
- D is the door's world point, `(finishX, finishY − 60)`.
- S eases from the door's screen position at A0 to (0.5 W, 0.58 H).
- `z = 1 − 0.45 e` with `e = easeInOutCubic((t − A1) / 2b)`, reaching 0.55 at A3 (0.35 over A1 → A5 for the ending).
- Culling: draw world objects whose x lies in `[D.x − S.x / z, D.x + (W − S.x) / z]`.

**Push-in.**
- From B2, the new level is drawn at its run framing (`camera.x = startX − 0.23 W`; `camera.y` at the settled target of `startY`, snapped), scaled about Diana's screen point.
- `z = 1.12 → 1` with easeOutQuart over 2c, and world alpha by smoothstep over the same span.
- At B4 the transform is exactly the identity the run uses, so nothing moves when control begins.

**Reason.**
- Itay Keren's camera essay sets the goal "avoid sudden camera speed and direction changes" and describes physics smoothing as "EaseInOut" ([Scroll Back](https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers)).
- An ease-in-out pull-back starts and ends at rest. An ease-out push-in decelerates into the run framing, so the first frame of play is a settled frame.
- The same essay warns that visual motion mismatched to the body's sense of movement can cause discomfort, which is why the zoom changes by at most about 1.8× over two beats and reduced motion removes it.

### 3.4 The planets

- **Two bodies at once.** `createBackdrop`'s cache keeps one look (`cache.clear()`, commented "a level never shows two"). It becomes a two-entry cache: transitions show two.
- **Build the next body early.** Build the next body's cache when progress ≥ 0.85, in `requestIdleCallback` (fallback: `setTimeout(…, 0)`), so no transition frame paints a body from scratch. A large body such as Jupiter is a canvas of about 880 × 880 at 2×, with hatching.
- **The old body** starts at its level-end box (`bodyBox` at progress 1 with the door's drift).
  - A2 → B1 (easeInOutSine): a quadratic arc to (0.17 W, 0.36 H). Radius × 1 → 0.4.
  - Its control point sits 0.12 H above the chord's midpoint, but low enough that `bodyTop` stays ≥ HUD band + 8 at every sample.
  - It stays opaque (bodies hide the stars behind them) and fades B3 → B4.
- **The new body** enters A2.5 → B2 (easeOutCubic) from (1.15 W, its start y), at radius × 0.5. It travels on an arc whose control is 0.06 H above the midpoint, and ends **exactly** at its level-start box (progress 0, drift 0). When the level starts, nothing jumps.
- **Special looks:**
  - Home's bright star recedes as its sprite and halo.
  - The Moon (VIII) does not slide in: it **rises** 0.5 H from below into its box (easeOutCubic, A2.5 → B2), and Earth's crescent fades in at its `earthBox` (r0 9 px).
  - A level without a look cross-fades its sky.

### 3.5 The orbit line and the marker

- A dotted quadratic from the old body's end point to the new body's centre, with its control point 0.15 H above the midpoint.
- Paper at alpha 0.3, line width 1.5, dash [2, 7]. It is drawn on by its parameter over A2 → A3, sampled at 32 points.
- At each end, a stop like the title's: an ink dot with a paper ring, and the finished one with a small star at its rim.
- Diana's two-leaf marker (the existing path, × 1.6) slides along it A3 → B2 with easeInOutSine.
- All of it fades out B3 → B4.

This is the title's orbit line brought into the sky: the same idea as the old orbit-map veil, without the veil.

### 3.6 Motes

- **12 star-sheet sprites** (frames 0–2, scale 0.06–0.12): one every b/12 from A1, at random x across the opening's lower third.
  - Velocity −90 to −150 world px/s, swaying ±6 px at 1.2 Hz.
  - Life 1.5 b, alpha 1 → 0 (easeInQuad).
- **3 tail-star streaks:** angle −80° ± 10°, 40–70 px long, life 1 b.
- A seeded RNG (seed = the level id) makes the frames deterministic for screenshots and tests.

### 3.7 Easing summary

| Motion | Curve | Principle |
| --- | --- | --- |
| Door light front | easeOutCubic (1 beat) | Anticipation: it gathers, then holds |
| Rings | easeOutCubic (1.2 b) | Follow-through |
| Pull-back zoom and anchor | easeInOutCubic (2 b) | Slow in and slow out |
| Old body arc | easeInOutSine | Arcs; it leaves gently |
| New body arc | easeOutCubic | It arrives and settles |
| Leaf marker | easeInOutSine | Arcs |
| Push-in | easeOutQuart (2 c) | It settles into the run framing |
| Fades (world, tally, HUD) | Linear alpha over ½–1 beat; the new world uses smoothstep | Legible, no pop |
| Count-up | 12 integer steps, linear | Readable numbers |

### 3.8 Frame-time budget

**Rules:**
- No `shadowBlur`, `filter` or `getImageData`.
- Bodies come from caches built before the door.
- The world is drawn only while its alpha > 0.01 and culled to the zoomed view, about 1.8× the normal width at z = 0.55.
- At most 24 sprites of motes.
- The DOM is animated by opacity and transform only, with text set at most 12 times.
- The keyline only on overlap frames.

**Targets** (Chrome with SwiftShader at 960 × 640, the method of the root QA's frame-time checks):
- over the 8-beat window, median ≤ 16.7 ms, p95 ≤ gameplay p95 + 2 ms, no frame over 33.4 ms, and no long task over 50 ms;
- the next body's cache build time is recorded and falls before A0;
- `__game.getTransition().frames` reports `{ count, median, p95, max }`.

Phones are unmeasured. The implementer records a 4× CPU-throttle run, as the wake was measured.

## 4. Tests the implementer must add

**Pure modules, so these run in Node:**
- `signage.mjs`: sign rows and window alpha.
- `transition.mjs`: the beat plan, the tally, the save v3 math and easing.

Browser checks go in the game's `scripts/browser-*.mjs` and in the root QA (`common/tests/browser.mjs`, `ONLY=Solarum`) on the packaged ZIP.

| ID | Test | Asserts |
| --- | --- | --- |
| **T1** | Glyph positions are invariant to the player (Node) | For every level, sweep the camera x from `startX − W` to `finishX` in 5 px steps. At each step, evaluate the rows under at least 6 player states: x and y anywhere on the route, grounded or airborne, every `done` true and false, `deaths` 0 and 5, `status` running, dead and respawning, after `retry()`. Every disc's world (x, y) equals the level data exactly, and alpha is identical across the player states. Static checks on `game.js`: the sign drawing does not reference `state.player`, `viewPos`, `shownPrompts`, `.done`, `.after` or `Math.sin(clock`, and the lift line is gone. |
| **T1b** | The same in Chrome | `__game.getSigns()` → `[{ id, x, y, alpha, scale }]` in world px. Sample every frame of each level's main route, with real keys for I and II, including a forced fall and respawn. Each id's (x, y) is constant to 0.01 px while alpha > 0, before, during and after the act. |
| **T2** | Placement P1–P3 (Node) | Every authored route at 120 Hz, at s = 1 and 1.8 (optional × 0.82). No row touches Diana's box (+8 px) for x < `from`. No row touches a platform's top band or body, a star's pickup circle, a crack or a lid break. Each row's top stays ≥ 64 px on screen at the real stepped camera while its alpha > 0 in the reading phase. Every entry of the §1.5 inventory that says "move" fails before the change and passes after it. |
| **T3** | Timing G1, and the title card (Node) | G1 at the landscape reference width (s = 1) and the portrait minimum (s = 1.8). The existing title-card test also passes with the transition's earlier card start (B2 = 2 beats before the run). |
| **T4** | One at a time, G2 (Node) | Over every camera position, at most one row has alpha > 0, at the reference width, at the portrait minimum and at a 21:9 box (2100 × 900, so the window cap applies). Replaces "the wind's glyphs never show more than one at once (VI)". |
| **T5** | The transition starts automatically and advances (Node and Chrome) | Node: `transitionPlan` for every pair, at pace 1 and 0.8, gives monotonic beats and B4 = A0 + 4b + 4c. The total lies in 3.8–5.3 s at pace 1 and within 1.25× of that at 0.8. Chrome: finish level n's main route with the pilot, then send no input. `getTransition().phase` passes `door` → `space` → `arrive` → `null`, and `getState()` reaches `level === n + 1` with `status === 'running'` within **(4b + 4c) + 0.25 s** of the `win` event, for n = 1 … `LEVELS.length − 1`. The new body's centre on the first running frame equals `bodyBox(look, progress 0)` within 1 px. |
| **T6** | Any key or tap skips (Chrome) | Space, Enter, ↑, D, S, a mouse click and a touch tap (pointerType `touch`), each at beat A1 + ε, A3 and B2: the next level runs within 0.3 s plus one frame, and the remaining count-in is cancelled (`getAudio().countIn.cancelled > 0`, no beat scheduled after the skip). A press at A0.5 (the lockout) does not skip. A key held since before the door does not skip. R plays the finished level again, before and after the swap. Esc freezes the beat for 1 s, and Continue resumes it at the same beat. |
| **T7** | Tally values after scripted falls and stars (Node and Chrome) | Script level I: two falls (skip a required press twice), then the main route. The tally's level row equals `{ stars: state.stars at the door, total, great: banked, falls: 2 }`. The journey row equals the earlier save's sums plus this run (falls + 2; stars + max(0, run − best)). A replay with fewer stars leaves journey stars unchanged; a replay with more adds exactly the difference. Falls in a run abandoned through Restart or Main menu add to journey falls, not to the next run's level falls. A star-net catch counts as a fall; "back to last light" does not. The DOM's text, the `aria-live` announcement and the pause card's Journey line show the same numbers. |
| **T8** | Campaign totals persist (Node and Chrome) | After the door, the stored save already holds the new `stars`/`done`/`unlocked`/`great`, checked before the transition ends and after Esc → Main menu mid-transition. After a reload: the same totals in the tally, the pause card and `getSave()`. A v2 save → v3 with `stars {}`, `falls 0`, `credits false`, and its unlocked levels and Great Stars kept. Blocked storage → no throw, session-only totals. The credits play only while `credits` is false. |
| **T9** | Reduced motion (Chrome, emulated `reduce`) | The beat times equal the full mode's. The world transform's scale is 1 on every frame. The bodies are at their end boxes on every frame. The tally's text is final on its first visible frame. The count-in plays. No motes are drawn. A skip is a cut. The ending's Earth is static. |
| **T10** | No input lost or double-fired (Chrome, real keys) | (a) A key held from before the door until after B4 makes no `jump` and no glide at the start. (b) The skipping press yields no `jump` event and no buffered jump; the first `jump` in level n + 1 follows a fresh keydown. (c) A fresh Space 1 frame and 50 ms after B4 jumps on its own timestamp's tick. (d) Presses while the transition is paused do nothing. (e) R and a skip in the same frame load the finished level once, with no next level. (f) The tap that skips never triggers the jump zone (its `pointerup` is swallowed). (g) After a skip, the downbeat is not doubled: no count-in beat sounds after bar 1. |
| **T11** | Layouts and frame time (root QA) | At 960 × 640, 844 × 390, 390 × 844 and 320 × 568: at A3 the tally panel lies wholly inside the stage (portrait: inside the deck). It does not overlap the title card's box, the HUD buttons or the ↺ target (44 px), and its text is ≥ 16 css px. Frame-time targets of §3.8. The packaged ZIP plays I → II in a 960 × 640 sandboxed iframe with no console errors. |

**Existing tests to replace, not just delete:**
- `title.test.mjs` "victory card: Continue and Retry only": becomes a transition contract. There is no `#victory-card` or `#map-veil`; a `#tally` element has `role="status"`, no buttons and `pointer-events: none`; R and Esc are handled while the transition is active.
- `audio.test.mjs` "glyph rows clear Diana …": drops the lift regex (T1 and T2 replace it) and the regex for `countIn({ …, delay: 0.35 })` (T6 and T9 replace it).
- `model.test.mjs` "the wind's glyphs never show more than one at once (VI)": becomes T4.
- Root QA: the victory-card check and the map use, `__game.showMap`, become T5, T6 and a screenshot at A3 (`__game.previewTransition(n, { beat })`, which freezes a beat for evidence).

## 5. Risks and what humans must judge

- **Re-placing 11 signs** changes where the owner sees ↑ → today. They should look at the new positions in each level; screenshot every sign at full opacity at 960 × 640 and 390 × 844.
- **The keyline:** whether a 2 px ink edge inside a disc reads as Diana in front of a sign or as an artefact is a call for the art lead.
- **Skip and the tally:** a player who skips at A1 never sees the tally. It is also in the pause card, and that trade is deliberate. If playtests show players missing it, the first remedy is to keep the tally visible for 1 s into the arrival (it sits low, under the title card, while the first 2.7 s of every level need no input). Do not lengthen the transition.
- **Lifetime falls** will reach the hundreds. If the owner finds that discouraging, the fallback is the sum of falls in each level's best run; it is the same save field shape plus `fallsBest`.
- **The fastest transitions (3.8 s)** may feel hurried at 128 BPM. A human should confirm it reads as momentum, not rush.
- **Nothing here has been seen or heard.** The timings are derived from the score's tempo, the layout numbers from the current CSS and geometry, and the sign inventory from a scratch replay.

## Sources

- **Project:**
  - [DEVELOPMENT](./DEVELOPMENT.md) (UI, Sound, campaign);
  - [RESEARCH_PROGRESSION](./RESEARCH_PROGRESSION.md) §4.4–4.5 and §7;
  - [RESEARCH_MUSIC](./RESEARCH_MUSIC.md);
  - `game.js` (`drawPrompts`, `showVictory`, `showMap`, `startLevel`, `wake`, `draw`, `drawSky`), `level.mjs` (`shownPrompts`, `CARD`, `readSave`/`writeSave`, `prompts`), `model.mjs` (`die`, `markPrompts`, `restoreCheckpoint`), `geometry.mjs` (`VIEW`, `fitStage`, `cameraTargetY`), `backdrop.mjs` (`LOOKS`, `bodyBox`, `earthBox`, the one-look cache), `moments.mjs`;
  - `assets/portal.png`, measured here.
- **UI theory:**
  - E. Fagerholt and M. Lorentzon, *Beyond the HUD: User Interfaces for Increased Player Immersion in FPS Games*, Chalmers University of Technology, 2009 ([DICE slides](https://www2.slideshare.net/DICEStudio/beyond-the-hud-user-interfaces-for-increased-player-immersion-in-fps-games));
  - A. Stonehouse, [User interface design in video games](https://www.gamedeveloper.com/design/user-interface-design-in-video-games), Game Developer, 2014 (diegetic, non-diegetic, spatial, meta).
- **Teaching in place:**
  - Celeste's tutorial bird ([Celeste characters](https://celestegame.fandom.com/wiki/List_of_characters); L. Burns, [*Castle Walls* level design document](https://liammib.github.io/assets/files/CastleWalls.pdf));
  - Ori, players' accounts of in-place lessons ([Steam discussion](https://steamcommunity.com/app/261570/discussions/0/617330406652829721); weak, and used only for the placement principle);
  - [How Miyamoto built World 1-1](https://www.gamedeveloper.com/design/how-miyamoto-built-i-super-mario-bros-i-legendary-world-1-1).
- **Level ends and transitions:**
  - [Sayonara Wild Hearts review, Gaming Trend](https://gamingtrend.com/reviews/picking-up-the-pieces-sayonara-wild-hearts-review/);
  - [Journey (Wikipedia)](https://en.wikipedia.org/wiki/Journey_(2012_video_game));
  - [Super Mario Odyssey (Wikipedia)](https://en.wikipedia.org/wiki/Super_Mario_Odyssey);
  - [Alto's Odyssey, Pocket Gamer](https://www.pocketgamer.com/altos-odyssey/the-stunning-endless-runner-altos-odyssey-features-air-balloons-desert-winds-and/) (secondary);
  - [Rayman Legends review, Gamewatcher](https://www.gamewatcher.com/reviews/rayman-legends-review/8882);
  - Celeste's chapter end and death counts ([deep dive](https://cf-inc.shapes.inc/fandom/celeste/deep-dive), secondhand; [Steam thread](https://steamcommunity.com/app/504230/discussions/0/1628538707074318672));
  - Geometry Dash ([RobTop leaderboard notes](https://robtopgames.com/files/GDLeaderboards.pdf); the level-complete layout is from play, not a written source).
- **Motion and camera:**
  - [Twelve basic principles of animation](https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation) (F. Thomas and O. Johnston, *The Illusion of Life*, 1981);
  - I. Keren, [Scroll Back: The Theory and Practice of Cameras in Side-Scrollers](https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers), GDC 2015 and Game Developer.
- **Accessibility:**
  - [Game Accessibility Guidelines, full list](https://gameaccessibilityguidelines.com/full-list/);
  - WCAG 2.2 [2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) and [2.3.1 Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html);
  - [MDN, prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
