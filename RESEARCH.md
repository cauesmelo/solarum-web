# Solarum: design research brief

Prepared 2026-11-09 for the level designer and gameplay programmer working on the next Solarum pass. This document recommends changes; it does not describe what is implemented. For the current build, see [LEVEL_DESIGN.md](./LEVEL_DESIGN.md) and the README.

The constraints stay in place: a 2D side-scrolling autorunner, Diana with her cape, space, the signal and Earth, and monochrome hand-drawn art. The current verbs stay (jump, double jump, cape flight/glide, dive), and so do the crumbling shelves the user liked.

## Local findings that shape this brief

- **Unused original art.** The archive (`../solarum-master.zip`) contains:
  - title and menu art: `fulltitle.png` (already in the demo as `assets/title.png` but never drawn), `menu-bg.png`, `menu-bg-2.png` and `titleground.png`;
  - shooting-star sheets `cadent1/2.png`;
  - original SFX: `Jump`, `Dash`, `star`, `death`, `successLevel` and `select` WAVs.

  The demo plays synthesized sine chimes instead of these sounds.
- **The sprout is Diana.** `sprout.png` comes from `title-diana-leaves.png`: Diana's own two leaves poking out of the soil, where she hides before coming up to watch the stars. It is not a plant prop, so it should not become a bounce pad.
- **Font.** `solarum.ttf` has 281 glyphs. It covers Latin-1, so Portuguese accents work, plus ←↑→↓ and ♫ ♥ ♦ ●. It has no ✦. It reads well at 18 px and above and gets thin at 12 px. Today it appears nowhere visible: menus use Georgia/Arial, and canvas labels are drawn in 8–9 px Arial.
- **Palette.** The original title art samples as ink `#0C0C0F`, paper `#FBFBEA`, and greys `#CECEC1`, `#AEAEA3` and `#777771`. The build has drifted to olive greens (`#8c9877`, `#b7c899`, `#687d4c`, and a green glow).
- **The original team saw the camera problem.** One of their tips (`UIUpdate.cs`, level 8) says, roughly: "very high jumps can make you lose sight of where to land."
- **Phone lookahead is short.** In a 390×844 iframe the visible world is about 312 logical px wide and Diana sits at x≈78. That leaves about 0.87 s of lookahead, against 2.9 s at 960×640.
- **The vertical camera is fixed.** On high shelves, Diana's jumps pass under the HUD (see `artifacts/revision-3/solarum-map-crumble-ridge.png`).
- **Longest replay.** The longest gap between beacons is 17.4 s (x 2820 to 7510).
- **Tempo is unconfirmed.** A rough onset-autocorrelation estimate was inconclusive (96–108 BPM candidates). The GDD says 88 BPM. Measure it in a DAW before beat-placing anything.

## Executive summary (ranked)

1. **Give the UI the game's own identity.** Use the Solarum font, the original title art and the true cream/black palette, and cut about 70% of HUD and in-world text. The current web-landing-page layout is the "generic and lifeless" look the user named.
2. **Make falling cheap.** Respawn in 1.2 s or less with no death card, and keep beacons 14 s or less apart.
3. **Show the cape state on the cape.** Journey uses the scarf, Sky the cape, Celeste the hair. Replace the invisible 6 s cooldown with **one flight per airtime**, refilled by stable ground or a completed constellation.
4. **Make crumble the chapter's signature.** Introduce it, develop it, twist it (dive-smash, beat cascade) and conclude with it, rather than only in two optional trails.
5. **Restructure into three movements of one idea each** (about 86 s, kishōtenketsu). Today there are seven passages, each using its mechanic once or twice.
6. **Fix fairness in the camera.** Keep at least 2 s of lookahead on every viewport (letterbox on phones), snap the vertical camera to platforms, allow no blind landings, telegraph required actions at least 1.5 s ahead, and keep a HUD-free band.
7. **Give stars a job.** Use about 60 stars in constellations that play a rising melody and refill the cape. Add three Great Fallen Stars per chapter that unlock the rare story color.
8. **Teach with world-space glyphs, not sentences.** Show a glyph on first need, hide it once the action is performed, and show it again after a fall at that spot.
9. **Change touch controls.** Use a left-half jump zone and right-thumb cape/dive buttons, landscape-first, with a portrait control deck.
10. **Turn sound on after the first gesture**, and use the original SFX.

## Comparable games

| Game | What works | Player complaints | Steal for Solarum |
|---|---|---|---|
| **Canabalt** | Hold-to-jump-higher, gaps generated from speed, forgiving hitboxes (building edges extend 8 px past the art) ([Tuning Canabalt](https://www.gamedeveloper.com/design/tuning-canabalt)) | Procedural sameness | Author gaps against the real jump envelope; check reaction time as view ÷ speed |
| **Bit.Trip Runner / Runner2** | Obstacles synced to the beat ([Runner2](https://en.wikipedia.org/wiki/Runner2)) | Runner 1 had no checkpoints: one hit sent you back to the start ([NWR](https://www.nintendoworldreport.com/review/23135/bittrip-runner-wii)) | Runner2's optional checkpoints: pass through to save, or jump over for a bonus ([Engadget](https://www.engadget.com/2013/03/01/runner-2-review/)); a beat-grid spacing grammar |
| **Rayman Jungle Run / Fiesta Run** | Handmade levels, most under a minute; each world built on one ability; 100 lums per level reveal routes ([Gameblog](https://www.gameblog.fr/tests/1390-rayman-jungle-run-iphone-ipod-touch-ipad), [Windows Central](https://www.windowscentral.com/rayman-jungle-run-review)) | Punch button placement; some hidden spots needed a guide ([Fiesta Run](https://www.gamezebo.com/reviews/rayman-fiesta-run-review/)) | One mechanic per section; collectibles that reveal routes |
| **Super Mario Run** | One-hand tap/hold jumping ([MacStories](https://www.macstories.net/?p=44709)); Pause Blocks as rest points ([Mario Wiki](https://mariowiki.com/Pause_Block)); colored-coin tiers ([Pink Coins](https://www.mariowiki.com/Pink_Coin_(Super_Mario_Run))) | Limited control, automatic vaulting ([Game Informer](https://gameinformer.com/games/super_mario_run/b/ios/archive/2016/12/15/super-mario-run-iphone-game-informer-review)); trial-and-error coins ([PostGameContent](https://postgamecontent.com/post/154657756148/heres-why-i-dont-care-for-the-coin-collecting)) | A fixed few special collectibles; rest beats; a paid rescue (the bubble) |
| **Geometry Dash** | Strict music sync; pads, orbs and portals vary one input ([Portals](https://geometrydash.wiki.gg/wiki/Portals)); practice checkpoints ([Practice Mode](https://geometrydash.wiki.gg/wiki/Practice_Mode)) | Memorization; hundreds of attempts ([gaming.net](https://www.gaming.net/reviews/geometry-dash-review-pc-mobile)) | Vary the input through objects. Avoid fake-outs. |
| **Alto's Adventure / Odyssey** | Calm flow, one-touch combos, sky and weather mood, Zen mode, deliberate minimalism ([Pocket Gamer](https://www.pocketgamer.com/altos-odyssey/interview-a-closer-look-at-team-altos-stunning-sequel-altos-odyssey)) | Goal and coin grind ([CGM](https://www.cgmagonline.com/review/game/altos-odyssey-review/)); rocks hard to see at night ([App Store](https://apps.apple.com/gb/app/id950812012)) | Mood through light with sparse UI, but mood never hides geometry |
| **Badland** | Generous checkpoints keep players trying ([Digitally Downloaded](https://www.digitallydownloaded.net/?p=49572)) | Deaths "out of nowhere" ([Game Informer](https://gameinformer.com/games/badland/b/ios/archive/2013/05/01/badland-review-elegance-through-simplicity)); untelegraphed traps ([TouchArcade](https://toucharcade.com/2013/04/12/badland-review/)); sparse late checkpoints ([Gaming Bolt](https://gamingbolt.com/badland-game-of-the-year-edition-review)) | Checkpoint density as a fairness tool; telegraph everything |
| **Celeste** | Hidden forgiveness: coyote time, buffering, half gravity at the peak ([thread via Gigazine](https://gigazine.net/news/20200317-celeste-action-feel-things)); green gems refill the dash in midair ([Wikipedia](https://en.wikipedia.org/wiki/Celeste_(video_game))); kind Assist Mode ([Vice](https://www.vice.com/en/article/celeste-difficulty-assist-mode)) | Early Assist wording felt like gatekeeping | Resource refills on landing or from pickups; the character shows the state; non-judgemental assists |
| **Journey / Sky** | No HUD; the scarf is the flight meter ([GameSpot](https://www.gamespot.com/reviews/journey-review/1900-6363693/)); Sky shows energy on the cape ([Sky wiki](https://sky-children-of-the-light.fandom.com/wiki/Cape)) | — | **The cape as the cape meter** |
| **Gris / Monument Valley** | No HUD, art upfront ([Gris hands-on](https://filmstories.co.uk/gaming/hands-on-with-nomada-studios-gris/), [MCV](https://mcvuk.com/?p=22112)); color returns as story progress; "every screen printable as art" ([Kill Screen](https://killscreen.com/podcast/monument-valleys-lea-schonfelder-designing-within-constraints)) | Gris: little challenge | Rare color as the reward (the GDD already reserves "story-important color") |

## Player feedback patterns

1. **Replaying from far back frustrates more than anything else.** Runner 1 had no checkpoints and Badland on console sent players back to the start, while Runner2's checkpoints were welcomed. Super Meat Boy's answer was near-instant respawn and short levels ([Game Developer](https://www.gamedeveloper.com/game-platforms/-i-super-meat-boy-i-s-mcmillen-explains-why-so-hard-)). Solarum currently shows a paragraph card plus a button after every fall.
2. **Untelegraphed or off-screen deaths read as unfair** (Badland reviews). Keren warns that a projected camera "may not work well in platforms, especially vertically" ([Scroll Back](https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers)). Solarum's phone lookahead and its fixed vertical camera both fall into this trap.
3. **Memorization polarizes.** A first-time player must be able to clear the main route by reading the screen. Only mastery collectibles should need a second look.
4. **Loss of control** comes from missing input forgiveness or unclear outcomes, not from autorun itself. Solarum already has coyote time, buffering and variable jump. The next step is to make outcomes visible.
5. **Mood must not hide hazards** (Alto's rocks at night). Reject darkness zones for any geometry the player has to read.
6. **What players love:** handcrafted short levels ([TouchArcade](https://toucharcade.com/2012/09/19/rayman-jungle-run-review-a-run-away-hit/)), jumps synced to music ([Slant](https://www.slantmagazine.com/games/rayman-legends/)), generous checkpoints ([Pure Nintendo](https://purenintendo.com/pn-review-badland-game-of-the-year-edition/)) and collectible tiers that reveal depth ([Vice](https://www.vice.com/en/article/the-surprising-depth-of-super-mario-run/?nb=1)).

## Principles to concrete changes

| Principle | Source | Change |
|---|---|---|
| One idea per level: introduce, develop, twist, conclude | Hayashida ([Game Developer](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design), [MCV video](https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps)) | Three movements (jump, crumble, cape); each mechanic used 5–8 times in changing contexts |
| Fun is pattern learning; boredom comes when it is mastered or unreadable | Koster ([GDC 2012](https://www.engadget.com/2012-10-10-gdc-online-2012-raph-kosters-keynote-on-a-theory-of-fun-10-ye.html)) | End each movement on a twist, not on a wider gap |
| Game feel = control + space + polish; responsiveness around 100 ms | Swink ([review](https://lizengland.com/blog/review-game-feel-by-steve-swink/)); the correction loop is roughly 240 ms ([MIT 6.813](https://web.mit.edu/6.813/www/sp18/classes/10-more-efficiency/)) | Same-frame feedback (squash, dust, chime) on every input; at least 1.5 s decision windows |
| More options mean slower choices | Hick–Hyman ([IxDF](https://ixdf.org/literature/article/the-hick-hyman-law-an-argument-against-complexity-in-user-interface-design)) | No more than two plausible verbs per main-route obstacle; glide taught only where wind needs it |
| Hidden forgiveness | Celeste | Keep coyote time at 0.12 s and the buffer at 0.14 s. Add ×0.5 gravity while jump is held and \|vy\| < 60. Give landing edges 4–6 px of grace. |
| Tension and release on a beat chart | Rogers, *Level Up!* ([O'Reilly](https://oreilly.com/library/view/level-up-the/9781118877197)) | A sawtooth beat chart (below), with a beacon and a calm island at each trough |
| Lenses: Punishment, Reward, Simplicity, Elegance | Schell ([Elsevier](https://shop.elsevier.com/books/the-art-of-game-design/schell/978-0-12-369496-6)) | A fall costs time, never progress. Stars do something. One rule per object. |
| Forward focus, platform snap, attractors | Keren | Diana at about 23% from the left; vertical snap on landing; ease the camera toward wells and forks |

## Mechanics proposals (priority order)

All values below are based on the current rules:

| Rule | Value | Envelope |
|---|---|---|
| Run speed | 270 px/s | — |
| Gravity | 1500 px/s² | — |
| Jump | 570 px/s | 108 px rise; 0.76 s and 205 px on the flat |
| Double jump | 525 px/s | +92 px (about 200 px combined) |
| Flight | 0.5 s at +230 px/s | 250 px |

**M1. One cape charge per airtime, displayed on the cape (high priority)**
- **What:** Remove the 6 s cooldown. Each airtime gets one flight. The cape refills on landing on *stable* ground, at a beacon, or by completing a constellation (M3). Fragile shelves do not refill it.
- **Why it's fun:** The resource becomes plannable, as in Celeste. An autorunner can't wait out a timer.
- **Theme:** The asteroid's gift breathes when Diana touches the ground.
- **Interactions:** Crumble routes become resource puzzles. Dive still cancels flight.
- **Tuning:**
  - Flight is unchanged.
  - Spent cape: tint the cape layer `#777771` at 60% opacity using an offscreen `source-atop` pass.
  - Refill: star-burst frames 4–7 at the cape tip, plus the chime.
  - Remove the HUD cape meter.
- **Risk:** This departs from the original code (6 s; the GDD says 7). Put it behind `RULES.capeRule = 'landing' | 'cooldown'`, and retune the 360/380 px voids.

**M2. Dive smashes cracked stone (high priority)**
- **What:** A dive landing on a fragile shelf collapses it within 0.05 s, and Diana keeps falling at ≥500 px/s. New *cracked lids* cover hidden wells.
- **Why it's fun:** It gives the liked mechanic a choice: land soft and stay high, or crash through to a secret line. The crash also feels great.
- **Theme:** The breaking constellation.
- **Tuning:**
  - Lid width 160–260 px, with a catch 140–220 px below.
  - Starlight glinting through the cracks telegraphs it.
  - Smash: 8 shards and 3 px of shake (none under reduced motion).
- **Risk:** Constant diving. Only drawn cracks are smashable, and every lid has a catch below.

**M3. Constellations: star chains that sing and refill (high priority)**
- **What:**
  - 4–6 stars along a real jump or flight arc.
  - Each pickup climbs a pentatonic step (C5 D5 E5 G5 A5).
  - Completion draws ink lines, plays a chord and refills the cape in midair.
  - A miss fades the lines, with no other penalty.
  - Replaces the text-labeled `CAPE RECHARGE` rings.
- **Why it's fun:** Rhythm, a melodic reward and route guidance in a single object.
- **Theme:** The asteroid asked Diana to gather fallen stars, and now they power the cape.
- **Tuning:** Space stars about one beat apart (`270×60/BPM` px, which is 184 px at 88 BPM). Allow up to 1.2 s between pickups. Keep the pickup radius at 34×43 px, or 40 px for chain stars.
- **Risk:** No required crossing may depend on a chain, except the final twist, and only with a beacon right before it.

**M4. Beat cascade (high to medium priority)**
- **What:** 5–7 fragile tiles collapse at `t0 + i×beat`, each shaking for 0.35 s first. Diana hops ahead of the wave.
- **Why it's fun:** It develops crumble into a short rhythm chase without adding a new fail state.
- **Tuning:** Tiles 160–180 px wide with 60–90 px gaps. The wave starts one beat behind Diana. Drive it from simulation time, never audio time.

**M5. Solar wind updrafts (medium priority)**
- **What:** Visible vertical columns, 120–180 px wide and 220–320 px tall. While Diana is airborne inside one, gravity becomes −700 px/s² with rise capped at 240 px/s. Holding cape (glide) adds 40% drift, and a dive exits.
- **Why it's fun:** "Drop into the void and be lifted" rewards trust, and it gives glide a job.
- **Theme:** Borrowed Wind, drawn with the tail-star streak language.
- **Risk:** Glide is a fourth verb, so teach it only here. The whole column must be on screen when the player decides.

**M6. A real super jump (medium priority)**
- **What:** The original tutorial taught "flight plus jump equals super jump." A jump during flight sets vy to −720 (about 173 px of rise) once per flight. Today's +50 px/s is imperceptible.
- **Risk:** It raises the height budget, so place high lines against it deliberately.

**M7. Great Fallen Stars and color memories (medium priority)**
- **What:** Three per chapter, each visible from the main route but reached only by a mastery line.
  - HUD slots use the original star frames: hollow frame 0, filled frame 2.
  - A Great Star counts once Diana lands or reaches a beacon after taking it, so a fall right after grabbing one doesn't take it away.
  - Collecting all three shows a colored memory of Earth at the portal.
- **Risk:** Spots that need a guide. Every Great Star must be visible from the route the player passes.

**M8. Comet slipstream set piece (low priority, finale only)**
- **What:** Landing on a comet tail (`cadent` art) adds +150 px/s for up to 3 s. Use it once, with no precision jumps while riding.

**Evaluated and not recommended now:**
- **Bounce sprouts:** the sprout art is Diana herself.
- **Gravity wells and orbit swings:** hard to read at this speed.
- **Darkness zones:** they hide geometry.
- **Headwind:** an invisible change to jump distance.
- **Meteor showers:** a second fail state. Defer them to chapter 2; if added, they should break islands with ≥1.5 s shadow telegraphs.
- **Generic speed zones:** they break the beat grid.

## Map plan: "A Signal in the Dark", three movements (about 86 s)

World x ≈ `220 + t×270`. Intensity runs from 1 to 5. Place a beacon (B) right before each new mechanic's first required use, and keep replay to about 14 s at most.

| t (s) | Step | Content | Int. | Optional |
|---|---|---|---|---|
| 0–4 | **I · Waking:** introduce | The sprout wakes Diana. 2.5 s of flat ground. Three stars at tap height, then three at hold height. | 1 | — |
| 4–11 | develop | Four gaps on two-beat spacing; 30–60 px rises; first constellation | 2 | — |
| 11–16 | twist | Double jump *for distance*: a long flat gap needing a late second jump | 3 | GS1 high line |
| 16 | **B1** | | | |
| 16–24 | conclude | 165 px climb, tap hop, long late-double gap | 3→1 | High crown |
| 24 | **B2 · II · The Breaking Constellation** | Title card | | |
| 24–30 | introduce | A shelf breaks under Diana over safe ground; then a shelf with a stable island one beat away | 2 | — |
| 30–38 | develop | Three-shelf high chain over a stable ridge | 3 | High / low |
| 38 | **B3** | | | |
| 38–46 | twist | Cracked lid over the star well (M2); six-tile cascade (M4) | 4 | GS2 under lid |
| 46–52 | conclude | Double jump off a fragile shelf to a stable crown | 4→1 | — |
| 52 | **B4 · hearth** | 3 s of calm; one story line | 1 | — |
| 53–58 | **III · Borrowed Wind:** introduce | Wide void, flight line drawn by a constellation; the cape inks back in on landing | 2 | — |
| 58–66 | develop | Two voids split by a fragile shelf (no refill), so the midair constellation is needed | 3 | — |
| 66 | **B5** | | | |
| 66–74 | twist | Drop *into* an updraft (M5); optional super jump | 4 | GS3 above |
| 74 | **B6** | | | |
| 74–80 | conclude | Fragile launch → flight → refill → flight → updraft; a lower safe line exists | 5 | Two lines |
| 80–86 | **Coda · The Far Door** | Long calm island; Earth in color | 1 | — |

**Main-route budget (physical maximum, then authoring limit):**

| Move | Physical max | Author up to |
|---|---|---|
| Tap jump, flat gap | 100 px | 80 px |
| Full jump, flat gap | 205 px | 170 px |
| Full jump, rise | 108 px | 90 px |
| Double jump, flat gap | 336 px | 280 px |
| Double jump, rise | 200 px | 165 px |
| Jump plus flight, flat gap | 455 px | 400 px |

Leave at least 135 px of runway after a required landing, and at least 400 px after a beacon before the next required input.

**Rules against unfair deaths:**
- **Lookahead:** at least 2.0 s (540 px) on every viewport, with 2.5 s as the target. In portrait, letterbox to a minimum visible width of 960 logical px instead of cropping.
- **Telegraphs:**
  - The cue for every required action is visible at least 1.5 s before the latest valid input.
  - Route forks are visible at least 2.0 s ahead.
  - Fragile surfaces always shake before they fall, and always have a catch or a visible next step.
- **No blind landings:** add a geometry test asserting, for each required gap, `landing.x − takeoff.x ≤ lookahead`.
- **Vertical camera:** snap to the last grounded y (lerp τ ≈ 0.35 s). After 0.35 s of falling, look down by up to 120 px. Keep the top 56 logical px free of jump apexes and gameplay.
- **Death trigger:** at `viewBottom + 60` (about 735) instead of 850.

## UI/UX spec

**Identity: ink and starlight.** UI marks have 2–3 px ink outlines, cream paper fills and slightly wobbly shapes. An optional 1 px line boil at 8 fps is turned off under reduced motion. Use the Solarum font everywhere, in mixed case with 0–1 px letter-spacing.

**Palette tokens:**

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0C0C0F` | Background, outlines |
| `--paper` | `#FBFBEA` | Fills, primary text |
| `--hill` | `#CECEC1` | Secondary fills |
| `--mute` | `#AEAEA3` | Secondary text |
| `--dim` | `#777771` | Spent and disabled states |
| `--earth` | `#6FA8DC` | **Only** Earth, the portal vision and Great Star memories |

**Type sizes at 960×640:**

| Use | Size |
|---|---|
| Title cards | 40–44 px |
| Prompts and buttons | 22–24 px |
| HUD numbers | 26 px |
| Minimum, mobile included | 16 px |

**Title screen**
- **Layout:** the original `fulltitle` composition, with the logo in the upper third and hills and ground below. The sprout loop (18 frames) sits centered on the ground.
- **Prompt:** "Press space or tap to wake" (24 px, opacity pulsing 0.5↔1 over 1.2 s), with a dim line under it: "↑ jump · → cape · ↓ dive" (16 px).
- **Corners:** ♫ sound at bottom-left and fullscreen at bottom-right, each with a 48 px target.
- **States:** while loading, the logo and "Gathering the stars…". If loading fails, one line and a retry button.
- **Wake transition:** the leaves wiggle, Diana pops up (the `start` clip), the logo drifts up and fades over 600 ms, and the run begins. There is no separate menu page. A native focusable button sits under the prompt.

**HUD**
- **Top-left:** star sprite (28 px) and count, then three Great Star slots.
- **Top-center:** orbit line (about 260 px, 55% opacity). A dotted arc runs from home to Earth, with beacon ticks and a two-leaf marker for Diana. It brightens for 1.5 s when a beacon lights.
- **Top-right:** "II" pause button (48 px).
- **On Diana:** cape state (M1).
- **Movement title cards:** three only. 40 px, upper third, timed 300 / 1600 / 500 ms (in / hold / out), never during a required input.
- **Glyph prompts:** an ink circle with ↑, → or ↓ (or "space"), in world space above the obstacle; touch devices show the zone icon instead. Show it 1.5 s before first need, hide it once the action is done, and show it again after a fall there. Combos read "↑ ↑" or "→ then ↑".
- **Remove:**
  - from the HUD: distance, score, best journey, level %, the bottom progress line, `FOLLOWING THE SIGNAL`, `EARTH IS OUT THERE` (it overlaps the fullscreen button), the cape seconds meter, the 26 s story ticker and the centered hint sentence;
  - from the world: every 8–9 px label (`FRAGILE`, countdowns, `CAPE RECHARGE`/`WIND GIVEN`, `CHECKPOINT`/`LIGHT REMEMBERED`, `↑ HIGH STAR TRAIL`, `↓ DIVE TO THE STAR WELL`, landmark names, `THE FAR DOOR`).

**Pause**
- **Layout:** dim the scene to 70% ink. A centered paper card (about 420×320, wobbly ink border) holds "Paused" (34 px) and a large orbit line with the movement names.
- **Buttons:** 48 px each. **Continue** (filled), Back to last light and Restart chapter. Then a row with ♫ Sound and Assist….
- **Assist:** "Gentle pace" (0.8× speed), "Endless cape" and "Star net" (once per beacon, a fall returns Diana to her last ground, like Mario Run's bubble). Word them kindly, as Celeste does.
- **Input:** Esc or P resumes. Arrow keys and Tab move focus. Blur and hidden-tab auto-pause stay.

**Death and retry: no card**
- **Sequence:** Diana breaks into six star shards that fly *toward the last beacon* (0.45 s, which also shows where she will reappear). An ink iris closes on the beacon (0.25 s). The sprout pops and the run resumes (0.4 s).
- **Budget:** 1.2 s or less from leaving the view to regaining control, with jump input buffered during respawn.
- **Escalation:** after three falls at the same beacon, show a one-line tip for 3 s. After five, show "Assist is in pause".

**Checkpoint**
- **Beacon:** an ink cairn with a hollow star on top.
- **On landing:** the star fills, a ring pulses from 20 to 60 px (500 ms), a two-note chime plays and the orbit tick fills.
- **Story lines:** five lines, one per beacon, shown 18 px at bottom-center for 3 s. They replace the timed ticker.

**Victory**
- **Arrival:** the camera holds. Diana stops inside the arch, the portal glows and a small **blue Earth** appears, the first color seen. Hold for 1.5 s.
- **Results:** a card slides up from the bottom without covering the portal. It shows stars (e.g. 48/60), the Great Star slots, time and falls. Buttons: "Run again" (primary) and "Title". One line of copy: "The signal is stronger now."

**Touch**
- **Landscape:**
  - Jump: the left 50% below the HUD band, marked by a faint 72 px ↑ hint at bottom-left.
  - Cape: a 76 px circle at bottom-right; hold to glide.
  - Dive: a 64 px circle up and left of Cape; swiping down on the right half also dives.
  - Look and spacing: buttons at 35% opacity, 100% while pressed. Targets at least 44 px ([WCAG 2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)), 12 px apart.
- **Portrait:** letterbox the playfield at the top and use the same layout as a control deck below it. Show "Turn sideways for a wider sky" once.

**Audio**
- Turn sound on after the wake gesture, and persist the setting with a guarded `localStorage` write.
- Use the original WAVs, and the constellation melodies from M3.

## Pitfalls to avoid

- **Too many verbs or hazards.** Each movement owns one idea. A second fail state should wait for user feedback.
- **Mandatory full collection.** The original tutorial itself warns that chasing every star can lead to a dead end. Optional lines must rejoin the main route, and stars must never act as hidden keys.
- **Text as the tutorial.** If a sentence is needed, the geometry or the glyph has failed. Keep words for story beats.
- **Mood over readability.** Nothing may cover landing surfaces or the 2 s lookahead.
- **Beat-locking to audio time.** Use the beat as world-px spacing; simulation time stays authoritative.
- **Long replays.** Keep every beacon gap at or under 14 s (the current worst is 17.4 s).
- **Identity drift.** No sprout as terrain, no olive palette, no new character art. Skip the archive's glossy 3D keycap sprites and draw ink glyphs instead.
- **Bots as proof of fun.** Route pilots prove reachability only. Add tests for visibility, telegraph lead time and replay cost per beacon, and run human sessions that note where a cue is first misread.
