# Original animation audit

This audit checked the supplied Unity archive rather than inferring states from PNG names. The audit covers the main Diana Animator, its no-cape override clips, the cape child renderer, the Player prefab, and the title sprout.

## Main restored clips

| Browser state | Original Unity clip | Source frames | Source timing | Playback in this demo |
| --- | --- | --- | --- | --- |
| run | `Animations/Diana/running.anim` | 10 | 0.833s | loop |
| idle | `Animations/Diana/idle.anim` | 12 | 1.000s | loop |
| air | `Animations/Diana/airbourne.anim` | 6 | 0.500s | loop |
| dash | `Animations/Diana/dash-lateral.anim` | 14 | 0.958s | one shot, last frame held |
| cape | `Animations/Diana/capedash.anim` | 14 | 0.958s | one shot, last frame held |
| dive | `Animations/Diana/drop-roll.anim` | 6 | 0.500s | one shot, last frame held |
| jump | `Animations/Diana/jump-1.anim` | 5 | 0.417s | one shot, last frame held |
| softLanding | `Animations/Diana/soft-landing.anim` | 10 | 0.833s | one shot, last frame held |
| hardLanding | `Animations/Diana/hard-landing.anim` | 13 | 1.083s | one shot, last frame held |
| start | `Animations/Diana/start.anim` | 4 | 0.333s | one shot, last frame held |
| stop | `Animations/Diana/stopping.anim` | 9 | 0.750s | one shot, last frame held |
| sprout | `Animations/Diana/sprout.anim` | 18 | 2.250s | loop |

## Findings

- The original primary Animator routes both `jump1` and `jump2` to `jump-1.anim`. The browser resets the same clip on both actions.
- `dash-lateral.anim` uses the no-cape body sprites. `capedash.anim` uses a separate cape sheet. The Player prefab places the cape child at zero local offset with sorting order one above the body. The browser reproduces body-first/cape-second drawing.
- The body dash sheet has 200×200 source rectangles cropped from x=300 of a 500-pixel-wide image; treating the full 500-pixel row as a body would include large empty space.
- Cape frames use custom pivot x=0.8,y=0.5. Airborne and takeoff frames use x=0.5,y=0.333. Other centered frames use the effective center pivot regardless of the unused serialized {0,0} pivot value under alignment=0.
- All restored transition clips had loop flags enabled in Unity. The Animator transitions, not that flag alone, defined their actual on-screen duration. Browser transition states are explicitly one-shot and interruptible.
- `diana-jump-hard-landing.png` contains five takeoff frames followed by thirteen hard landing frames. Source fileIDs select the correct subset; a naive array cycle would show landing during takeoff.
- The original start/stop sheet likewise contains distinct four-frame start and nine-frame stopping sequences.
- The undercape sheet is preserved, but neither the main dash body clip nor the cape clip references it. Adding it as a third layer would duplicate art without source evidence.
- The sprout/title animation is retained and mapped, but the gameplay character begins with the cape and uses the actual idle state.
- No-cape override clips are source variants for pre-cape presentation. They were audited, but gameplay did not remove Diana’s cape, so those variants were not arbitrarily inserted into normal running. The no-cape dash body is the intentional exception required by the original layered dash. **Since 2026-11-10** the eight-level campaign takes the cape away in level I, so the override clips are extracted and drawn there (see the last section).

## All original Diana clips inspected

| Archive clip | Keyframes | Referenced sprite GUIDs |
| --- | --- | --- |
| `Animations/Diana/No Cape/nocape-airbourne.anim` | 2 | `b296e05733f7e8a4dbdeef3c4b7cd37a` |
| `Animations/Diana/No Cape/nocape-dash.anim` | 14 | `5e2bf661e78ad2f4c9f9e89e04b7f24b` |
| `Animations/Diana/No Cape/nocape-drop-roll.anim` | 6 | `621b70b29ba187d48b3783839979126d` |
| `Animations/Diana/No Cape/nocape-hard-landing.anim` | 14 | `a4835a5eae6245b449282290f21e1e3e` |
| `Animations/Diana/No Cape/nocape-idle.anim` | 1 | `987d3ce7377507a46bc156a8b25b421c` |
| `Animations/Diana/No Cape/nocape-jump1.anim` | 5 | `a4835a5eae6245b449282290f21e1e3e` |
| `Animations/Diana/No Cape/nocape-running.anim` | 10 | `a82443e7bd0ce5644b8dfc8cc8b90611` |
| `Animations/Diana/No Cape/nocape-soft-landing.anim` | 10 | `b277c05cf8c38184a98b5523a1be93d6` |
| `Animations/Diana/No Cape/nocape-start.anim` | 4 | `7061c44163d869444aabc1285357267c` |
| `Animations/Diana/No Cape/nocape-stop.anim` | 10 | `7061c44163d869444aabc1285357267c` |
| `Animations/Diana/airbourne.anim` | 6 | `f06d7d6acd40db34ab7a953aed6e5978` |
| `Animations/Diana/capedash.anim` | 14 | `57fb9c78e2db46f409ca70d1a2f965d5` |
| `Animations/Diana/dash-lateral.anim` | 14 | `5e2bf661e78ad2f4c9f9e89e04b7f24b` |
| `Animations/Diana/drop-roll.anim` | 6 | `173fcc0405ffd9a4f8875a25abdf6ee0` |
| `Animations/Diana/hard-landing.anim` | 13 | `3759bff3f95693b4fb01b8858d780248` |
| `Animations/Diana/idle.anim` | 12 | `cd3b2460e2c767a4ea264b0c68ed7dbd` |
| `Animations/Diana/jump-1.anim` | 5 | `3759bff3f95693b4fb01b8858d780248` |
| `Animations/Diana/running.anim` | 10 | `0a7922041efdc874580fa92e71cbefb1` |
| `Animations/Diana/soft-landing.anim` | 10 | `672ad6adf94ce2243b7f49a6d6519565` |
| `Animations/Diana/sprout.anim` | 18 | `689d88375f175334ab9a399a5e1bc0df` |
| `Animations/Diana/start.anim` | 4 | `174e8c807f9681b4f8a20b3fdb0b87d1` |
| `Animations/Diana/stopping.anim` | 9 | `174e8c807f9681b4f8a20b3fdb0b87d1` |

## Reproducing the extraction

Run `python3 scripts/extract-assets.py` from this directory. The script resolves original sprite IDs, frame rectangles, pivots, and animation curve times and copies source PNGs unchanged. Then run `npm test`; metadata tests verify the body/cape layering and one-shot behavior. The runtime browser package does not need Python or the original archive.

## Revision "ink and starlight" (2026-11-09): how the approved clips are used

No clip, pivot, frame order or layer was changed. `animation.mjs` and the body / cape layering are untouched; the new uses below only choose *when* existing clips play.

| Moment | Clip / frames | Notes |
| --- | --- | --- |
| Title | `sprout` (18 frames, 2.25 s loop) | Diana hidden in the soil, centred on the original title ground |
| Wake | `sprout` fades for 0.16 s, then `start` | The leaves pop and Diana stands into the run (since revision seven only for wakes without the emergence: QA's `start()`, Restart) |
| Respawn | `sprout` for 0.14 s at the beacon, then `start` | Same pop as the wake, inside the 0.4 s respawn window |
| Victory | `stop`, then `idle` | Unchanged hold-last-frame behaviour |
| Flight | `dash` = `bodyDash` body + `dash` cape layer | Unchanged; faint after-images skipped under reduced motion |
| Spent cape | any clip, tinted | Offscreen copy of the current frame, `source-atop` fill of `--dim` at 60% across the trailing half of the sprite. Most original sheets bake the cape into the body, so a gradient (full at the back, fading out before the face) stands in for a cape mask; it can lightly touch a trailing leg. |
| Refill | `star` frames 4–7 at the cape tip | The same burst frames as a collected star |
| Pickups | `star` frames 0–3 live, 4–7 collected | Unchanged; constellation stars are drawn slightly larger |
| Great Stars | `star` frame 2, larger, slow tilt | Plus the original `tail-star` streak and a breathing halo |
| HUD / cards | `star` frame 0 (hollow) and 2 (filled) | Great Star slots, assist toggles, results |
| Death | `star` frame 2 ×6 | Shards that ride the camera back to the beacon |
| Sky | `cadent1` (19 frames) / `cadent2` (14 frames) at 24 fps | Original shooting-star clips (`Animations/stars/*.anim`), extracted with their keyframe times; never under reduced motion |
| Wind | `tail-star.png` turned upward | Rising streaks inside each updraft column |

The extractor now also resolves `Animations/stars/cadent1.anim` and `cadent2.anim`; note that `cadent1` starts at 0.0417 s on frame 1 and shows frame 0 at 0.708 s, exactly as authored.

## Revision seven (2026-11-10): Diana emerges from the earth on the wake

The user remembered an animation from the original game in which Diana comes out of the earth, and asked that pressing start should make her emerge and start running.

### Where the original animation is

- **It is not in the Unity archive.** The archive has the 18-frame `sprout` (her two leaves in the soil, the title) and the `start` / `stopping` clips, nothing in between.
- **It is in the original trailer** (`refs/solarum/…Solarum-Trailer_001_1080p.mp4`, about 91–99 s). It is thin black line art on cream, a different drawing from the game sprites:
  1. The sprout grows.
  2. A round head with two leaves rises out of the soil.
  3. It squints, opens its eyes and ducks.

### The choice: Diana's own sprites, masked by the soil

Option (b), rotoscoping the trailer, was rejected. Its frames are an outline-only chibi head on cream, not the game's cream-fill, ink-outline Diana, and it has no body or cape to hand over to the `start` clip. Cleaning it into the sprite style would mean drawing new character art, which this project avoids.

Option (a) keeps every approved clip, pivot and layer unchanged. `emergence.mjs` is a pure timeline and `game.js` draws it:

| Beat (trailer) | Time | What is drawn |
| --- | --- | --- |
| Leaves twitch | 0–0.26 s | `sprout` at 3× speed with a decaying 9 Hz shiver (±0.09 rad), lifted 3 px; two soil crumbs; the soil parts (two short ink strokes) |
| Head rises | 0.26–0.68 s | The body clip (`idle`, the 12-frame loop), feet from 92 px under the soil (fully hidden) to 40 px under it, ease-out: her leaves, head, eyes and chin come out. The big title leaves stay rooted and fade (and shrink to 0.32) as her own leaves reach them; three crumbs |
| A beat of looking | 0.68–0.98 s | Head out, the `idle` loop breathing (±1.5 px) |
| She pops up | 0.98–1.22 s | One small hop: feet from 40 px under to 12 px over the soil and down onto it; eight crumbs |
| Start → run | +0.333 s | The original `start` clip from the model (`animation.mjs`, unchanged), the unchanged wake camera move (0.9 s) and the title ground's fade (0.6 s) |

How it is drawn:
- **The mask.** The soil is the original title ground, which the renderer already draws after the world. Diana is drawn in the world layer, so whatever is still below the soil is hidden along the ground's own hand-drawn contour: no clip path and no new art.
- **The crumbs.** They are paper chips with an ink edge, drawn over the ground. Each one disappears when it falls back onto the soil line.
- **The total.** By design 1.22 s of emergence, then the 0.33 s start clip: about 1.55 s from the press to full stride; the brief's ceiling was about 1.6 s. The playtest critic measured `status: 'running'` 1.24 s after the press (the start clip plays after that, inside the run).
- **Skipping.** A second press skips straight to the run.
- **Reduced motion.** A 0.36 s rise with no shiver, hop or crumbs.

### Sprite sets

`SPRITE_SETS` maps the roles the emergence draws to manifest clips:
- `cape`: `idle`, `start`, `run`.
- `nocape`: `nocapeIdle`, `nocapeStart`, `nocapeRun`. These are the names an extraction of the archive's `No Cape/nocape-idle`, `nocape-start` and `nocape-running` overrides would get.

A level chooses its set with `sprites: "nocape"` in its definition (or QA with `__game.setSpriteSet`). `resolveSet` falls back to the cape set, flagged `fallback`, while those clips are not in the manifest, so the emergence never draws a missing clip. Once they are extracted it uses them without a code change. The no-cape sheets are the same 200 px centred-pivot cells as the cape idle and start sheets, so the depths above apply to both.

### Unchanged

The approved clips, pivots, frame order, body-first / cape-second layering, `animation.mjs` and the model's animation state machine are all unchanged. The renderer draws the `idle` body clip itself during the emergence, and the model's `start` clip begins with the run.

## Revision five (2026-11-10): no-cape Diana, the breath bar and the GET moments

RESEARCH_PROGRESSION 2.1–2.3 and 3.3: Diana has no cape in level I and gets it at II's GET, the cape gets a "breath" charge bar drawn with the original HUD art, and the double jump gets a lasting cue. The level-builder's model (branch `rev5-progression`) adds `verbs`, `capeCharge` and the `get` event; this build reads them defensively and falls back to revision seven where they are absent.

### Extraction

`scripts/extract-assets.py` now also copies, byte for byte:

| Manifest sheet | Original | Slices | Pivots |
| --- | --- | --- | --- |
| `nocapeRun` | `Sprites/Diana/No Cape/no-cape-diana-run.png` (1000 × 400) | 10 | centre |
| `nocapeIdle` | `…/no-cape-diana-idle.png` (1000 × 601) | 12 | centre |
| `nocapeAir` | `…/no-cape-diana-airbourne.png` (1000 × 600) | 6 | 0.5 / 0.333 |
| `nocapeDrop` | `…/no-cape-diana-drop.png` (1000 × 400) | 6 | centre |
| `nocapeJumpLanding` | `…/no-cape-diana-jump-hard-landing.png` (1000 × 1000) | 19 | 0.5 / 0.333 for the ten 300 px cells, centre for the rest |
| `nocapeSoftLanding` | `…/no-cape-diana-soft-landing.png` (1000 × 450) | 10 | 0.5 / 0.4 for the first (250 px) cell, centre for the rest |
| `nocapeStartStop` | `…/no-cape-diana-start-stop.png` (1000 × 601) | 15 | centre |
| `breathDisc`, `breathFrame`, `breathFill`, `meteor` | `Sprites/UI/DianaCooldownCircle.png`, `barrinha.png`, `recheioBarra.png`, `meteoroCheio.png` | single sprites | — (drawn by CSS) |

and the ten override clips with their keyframe times (the clips name sprites by fileID; the extractor now also checks each clip's guid against its sheet):

| Model state | Clip (`Animations/Diana/No Cape/`) | Frames | Caped clip for comparison |
| --- | --- | --- | --- |
| run | `nocape-running` → `nocapeRun` | 10 at 12 fps, loop | 10 |
| idle | `nocape-idle` → `nocapeIdle` | **1**, loop | 12 |
| air | `nocape-airbourne` → `nocapeAir` | **2**, loop | 6 |
| jump | `nocape-jump1` → `nocapeJump` | 5 | 5 |
| softLanding | `nocape-soft-landing` → `nocapeSoftLanding` | 10 | 10 |
| hardLanding | `nocape-hard-landing` → `nocapeHardLanding` | **14** (starts on the still-airborne sheet frame 5) | 13 |
| start | `nocape-start` → `nocapeStart` | 4 | 4 |
| stop | `nocape-stop` → `nocapeStop` | **10** | 9 |
| dive | `nocape-drop-roll` → `nocapeDive` | 6 | 6 |
| dash | `nocape-dash` → `nocapeDash` | 14 on `bodyDash` (the flight body without its cape layer) | 14 + cape |

Findings:
- The override controller (`no-cape-diana.overrideController`) maps ten clips. `Sprites/Diana/No Cape/running.anim` is a stray copy of `nocape-running` in the sprite folder, referenced by nothing; it is not extracted.
- The no-cape idle is a single frame and the no-cape air two, as authored. The model keeps its state durations (start 1/3 s, hard landing 13/12 s, stop 0.75 s), so the no-cape hard landing's and stop's last frame are cut, as a Unity transition would cut them.
- Feet (MOVEMENT_AUDIT C1): the airborne frames got baked `foot` offsets like the caped ones (`scripts/measure-feet.mjs`). The no-cape hard landing's first two frames are airborne, and the no-cape drop roll lifts the toe 2.5–3.8 px in frames 3–4 (the caped one 0.8–1.3), so the whole roll is baked. All 62 no-cape frames in play are within ±2 px of the collider's feet except the same seven stride floats (5.9–7.1 px), tested.

### Where each is used on screen

| Moment | Art | How |
| --- | --- | --- |
| Level I (no cape owned) | the no-cape clips | `animation.mjs` `clipFor` maps each model state to its override clip whenever the state's `verbs` lack the cape (`hud.mjs` `spriteSetName`); the emergence uses `nocapeIdle` / `nocapeStart` / `nocapeRun` |
| II's GET: the cape settles | caped clip over the no-cape clip | The caped clip fades in over the no-cape one for 0.6 s (same pose, pivot and body lines, so only the cape appears), with the star sheet's burst frames at the cape's tip |
| Breath bar (HUD, top-left) | `breathFrame`, `breathFill`, `breathDisc`, `meteor` | CSS crops of the unchanged PNGs: the frame 100 × 24 px, the fill clipped to `capeCharge`, three ink notches at the quarters, the disc becoming the meteor stone with one ring pulse when full. Absent until the cape is owned (or without `capeCharge`) |
| The cape on Diana | any caped clip, tinted | Four steps: 60 / 45 / 30 / 15% `--dim`, clear at full (60% when spent without a bar, as before) |
| Leaf glint (double jump in hand) | `star` frames 2–3 | One small star just above her leaves; height lagging 60 ms; burst frames 4–7 when spent; pops back on landing |
| I's GET | `star` frame 2 | The landed star circles on the run line, then rises into the glint |
| III's GET: the mysterious helper | `star` frame 2, `tailStar`, a code ring | Drifts down a long slope of air to Diana's run line, loops round her, flies off ahead and up; her cape ripples (three code strokes) on each beat of one bar |
| IV's GET: the necklace wakes | `star` frame 2, code rings | A glint at her chest and three rings of light on the beats; the next lid in view glints (`star` burst) |
| VIII's GET (super) | as III | The helper runs ahead and leaps |

The breath bar's original meaning is not all kept: in the original HUD the full meteor marked the star quota (a flight cost collected stars). Here it only means "the cape is full"; stars never gate a flight. `manifest.json → usage.meaningsNotUsed` records this, and that DianaCooldownCircle was the cooldown timer's disc.

### Still archive-only

`title` (fulltitle), `undercape`, the duplicate `jump-landing.png`, the archived WAVs and the stray `No Cape/running.anim`. The no-cape drop roll and dash clips are extracted but only play if a level grants the dive or a flight before the cape, which the campaign never does.

### Unchanged

Every caped clip, pivot, frame order, the body-first / cape-second layering and the model's animation state machine. The per-level backdrops (`backdrop.mjs`) are drawn in code, except Saturn's ring strokes (the original `saturn.png`) and home's bright star (the original star sprite).

## Revision five (2026-11-10): scripted moments, decor, II's asteroid eye and island marks

The builders' `def.moments` (event `moment`) and `def.decor` now have their art (`moments.mjs` `MOMENT_KINDS` / `DECOR_KINDS`, drawn in `game.js`). No new image was extracted; three originals gain new on-screen uses (recorded in `manifest.json → usage.onScreen` and `scripts/extract-assets.py`):

| Original | New use on screen | How |
| --- | --- | --- |
| `meteor` (`Sprites/UI/meteoroCheio.png`, until now HUD-only) | the world's asteroid | Drawn on the canvas at 60% over an opaque ink disc (under `--mute`, so Diana stays brightest): the head of the brightest star's fall in I (9 px), half buried under I's dust plume beyond the door, and half buried in II's crater, where it opens its eye. Rotated −0.35 rad, scaled by its 525 px disc radius |
| `star` frames 2–7 | I's falling shower and the GET's soft star, the brightest star's core, the locks' stars, glints, II's eye light | Frame 2 for stars at rest and in flight (the same 0.21 / 0.24 scales as the pickups they become), burst frames 4–7 for each landing |
| `tailStar` | the streaks of the falling stars, the asteroid's fall and the eye's light | Its head (520, 200) is placed on the falling thing and the streak turned onto its heading (the PNG travels at 0.37 rad); 0.13 for a shower star, 0.34 for the asteroid, 0.08 for the eye's light |

Drawn in code (ink and paper, Earth's blue only in the eye's pupil): the asteroid's eye (a lash line, then a paper almond with an ink iris and a small blue world for a pupil), the landing rings, the flash, the dust plume's billows, the lock hairlines, the glint's rays, and the island marks and particles of `islands.mjs` (frost cracks, waves, striations, ice nubs, strata, hatching, craters; rings, ice flecks, ring flecks, wind lines, dust). The `cadent1` / `cadent2` clips stay the sky's occasional shooting stars: the shower's stars must land on given pickups on the beat, which those fixed clips cannot aim, so they are drawn as the star sprite with a tail-star streak.

**Home's brightest star redrawn.** The owner read the old body (two stroked rings and full horizontal and vertical lines) as a sniper's crosshair. It is now a soft radial glow, five short tapering flares of unequal length at uneven angles, and the original star sprite as its core; it brightens toward its flash and is gone once it falls (it is the asteroid). Nothing about it resembles the Earth glint's ringed blue dot. Before / after: `common/artifacts/revision-4/solarum-brightstar-before.png`, `solarum-brightstar-after.png`.

**Unchanged:** every Diana clip, pivot and layering; the GET moments of I, III and IV (now timed on the simulation clock); II's cape settle is the same crossfade, held back a beat by the eye.

## Revision five (2026-11-10): still signs, the level transition, relics and refill stars

Front-end squad, from [RESEARCH_TRANSITIONS.md](./RESEARCH_TRANSITIONS.md) and [RESEARCH_REFILLS.md](./RESEARCH_REFILLS.md). No new art: every picture below is an existing sprite, the palette tokens or a line drawn in code.

### What is on screen, and from which asset

| Moment | Assets | Motion and timing |
| --- | --- | --- |
| Glyph signs | Drawn in code (paper disc, ink arrow, hold diamonds), as before | **No motion** (the lift and the 2 px bob are gone). Opacity only, from the camera's window: in over 64 px (0.20–0.29 s at 222–323 px/s), out over 48 px |
| Diana's keyline in a sign | Her current frame tinted to ink offscreen (`source-in`), stamped 8 × at 2 px | Only on frames where her drawn box meets a visible row, clipped to the discs' outer circles |
| Step-up / lip catch | Her normal clips | The drawn feet ease up over 70 ms (easeOutQuad); the collider is exact |
| Door bloom (A0–A1) | `portal.png`'s opening, measured: a rect from (0.12, 0.30) to (0.83, 1.0) with a half-ellipse cap to the crown at 0.17, mapped through `visibleBounds` | A paper front rising from the threshold over one beat (easeOutCubic), a radial glow (0.12 → 0 over 1.4 × the opening), two rings (24 → 220 px, 0.55 → 0, 1.2 beats); `--earth` at 0.9 at the journey's last door |
| Diana becomes light (A1–A2) | Her standing frame | Alpha 1 → 0 over one beat in front of the light |
| Motes (from A1) | `star.png` frames 0–2 (scale 0.06–0.12), `tailStar.png` | 12 stars one every b/12 rising 90–150 px/s with a ±6 px sway at 1.2 Hz, life 1.5 beats; 3 streaks at −80° ± 10°, life 1 beat; seeded by the level id |
| Pull-back and push-in | The world | Zoom 1 → 0.55 about the door (A1–A3, easeInOutCubic; 0.35 over A1–A5 at the last door); the next level 1.12 → 1 about Diana's screen point (B2–B4, easeOutQuart), the identity at bar 1 |
| Bodies (A2–B2) | `backdrop.mjs` bodies (cached, two looks) | The old body on a quadratic arc to (0.17 W, 0.36 H) at 0.4 × radius (easeInOutSine, top kept under the HUD band); the next from (1.15 W, its start y) at 0.5 × to exactly its level-start box (easeOutCubic); the Moon rises 0.5 H instead |
| Orbit line and marker | Drawn in code; Diana's two-leaf path (the title's) × 1.6 | Dotted paper line drawn on A2–A3; the marker slides A3–B2 (easeInOutSine); both fade B3–B4 |
| Arrival door (B2–B5) | `portal.png` at the start, 60 px behind her | Lit at 0.85 from B2; ebbs over the run's first beat; then scenery |
| The ending | The Moon body, Earth drawn in code (the only colour), `logo.png` on the first credit card | The Moon sinks 0.5 H (easeInCubic, A2–A6); Earth grows to (0.5 W, 0.42 H), r 0.2 H, while the ink disc that made it a crescent slides off (0.42 r → 2.05 r: the spec's 1.6 r left the 0.94 r disc biting the limb; easeInOutCubic, A2–A8) |
| Relics (ahead) | Double: `sprout.png` frame 0 at 60 px + `star.png` frame 2; cape: `meteor.png` at 64 px + `dash.png` frames 0–1 (6 fps); glide: the helper (`star.png` + `tailStar.png` + a ring); dive: a paper ring with `star.png` at 0.10 on a V of thread; super: `star.png` with `tailStar.png` turned straight up | A 40 px paper beam at 25% to the top of the view; three `star.png` frames at 0.08 circling once per bar; static under reduced motion |
| Relic pickup | The relic's own art, `star.png` burst frames 4–7 | The beam collapses into Diana in 150 ms; the relic rises over her head (150 ms) and is held for one beat with two rings (120 / 80 px, 0.6 s), then fades in 0.25 s. The simulation never stops |
| Cape star | `meteor.png` at 34 px, `star.png` frame 2 at 0.12 | A tenth of a turn per bar; lit 100% with a glow, dormant 40% without; one ring (0.25 s) when it lights; taken: a ring and burst frames, the breath bar pulses |
| Leaf star | `sprout.png` frame 0 at 34 px, `star.png` frame 2 at 0.14 | As above; taken: the star flies to her head in 120 ms and becomes the glint; the leaves fade over 0.3 s |

### Still archive-only

Unchanged from the sections above; this round uses no further archive art. `logo.png` was already on the title; `dash.png` frames 0–1 now also flutter on the gift relic.

### Verified (actual)

Screenshots on the packaged build (root QA, `common/artifacts/revision-4/`): `solarum-transition-*.png` (A0.5, A1.5, A3 at four layouts, B2.5, B3.5), `solarum-ending-tally.png`, `solarum-relic-*.png`, `solarum-banner-double.png`, `solarum-refill-stars.png`, and every sign at full opacity at 960 × 640 and 390 × 844 (`solarum-signs/`, contact sheet of the moved ones `solarum-signs-moved.png`). Nobody has judged the keyline, the relic hold or the necklace's read yet.

