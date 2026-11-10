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
- No-cape override clips are source variants for pre-cape presentation. They were audited, but gameplay does not remove Diana’s cape, so those variants are not arbitrarily inserted into normal running. The no-cape dash body is the intentional exception required by the original layered dash.

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
- **The total.** 1.22 s + 0.33 s = 1.55 s from the press to running; the brief's ceiling was about 1.6 s.
- **Skipping.** A second press skips straight to the run.
- **Reduced motion.** A 0.36 s rise with no shiver, hop or crumbs.

### Sprite sets

`SPRITE_SETS` maps the roles the emergence draws to manifest clips:
- `cape`: `idle`, `start`, `run`.
- `nocape`: `nocapeIdle`, `nocapeStart`, `nocapeRun`. These are the names an extraction of the archive's `No Cape/nocape-idle`, `nocape-start` and `nocape-running` overrides would get.

A level chooses its set with `sprites: "nocape"` in its definition (or QA with `__game.setSpriteSet`). `resolveSet` falls back to the cape set, flagged `fallback`, while those clips are not in the manifest, so the emergence never draws a missing clip. Once they are extracted it uses them without a code change. The no-cape sheets are the same 200 px centred-pivot cells as the cape idle and start sheets, so the depths above apply to both.

### Unchanged

The approved clips, pivots, frame order, body-first / cape-second layering, `animation.mjs` and the model's animation state machine are all unchanged. The renderer draws the `idle` body clip itself during the emergence, and the model's `start` clip begins with the run.
