# Solarum browser demo

**A Signal in the Dark** is the authored first chapter of the original Solarum runner. Diana runs on her own across floating islands toward a faint signal from Earth. The original cream-on-black hand-drawn art, Diana's cape, the stars, the solitude and the far door stay at the centre.

This revision (2026-11-09, "ink and starlight") implements the approved research brief ([RESEARCH.md](./RESEARCH.md)): a three-movement map built around one idea each (jump, crumble, cape), a cape that is its own meter, dive-smash, singing constellations, a beat cascade, solar-wind updrafts, a real super jump, three Great Fallen Stars with a colour memory of Earth, a fair camera, a 1.1 s respawn without a death card, and a new UI made from the game's own font, palette and art. The approved character animations are unchanged.

It is still a 2D side-scrolling autorunner. There is one chapter; no endless assembler, new character art or genre pivot.

## Run independently

```sh
npm run dev          # http://127.0.0.1:4173
npm test             # 64 tests: model, map fairness, glyphs, camera, UI contract and audio
npm run build:itch   # dist/solarum-itch.zip
```

No install or build step is needed to play; use HTTP (the game loads ES modules and a manifest). The preview page is plain green `#168546` with only the game centred; in an iframe or fullscreen the game fills its host. All art, font, sound and code are local; there is no CDN, account or backend.

## Play

Reach the far door. Stars never gate anything.

| Action | Keyboard | Touch (landscape) | Touch (portrait) |
| --- | --- | --- | --- |
| Wake (title) | Space, Enter or ↑ | Tap anywhere | Tap anywhere |
| Jump / jump again in the air | Space, ↑ or W (release early for a hop) | Left half of the screen | Left half of the control deck |
| Cape flight (once per airtime) | D or → in the air | 76 px cape button, bottom right | Cape button in the deck |
| Glide (hold the cape) | Hold D or → | Hold the cape button | Hold the cape button |
| Super jump | Jump during a flight | Jump zone during a flight | Same |
| Dive / smash cracked stone | S or ↓ | 64 px dive button or swipe down on the right half | Same |
| Pause / resume | P or Esc | II button | II button |
| Back to last light / restart chapter | R / Shift+R | Pause card | Pause card |

Diana runs at 270 px/s. Coyote time is 0.12 s and the landing buffer 0.14 s; a jump pressed while she is falling apart is kept and spent the moment she is back.

### The rules a player learns

- **The cape is the meter.** One flight per airtime. Stable stone, a beacon or a completed constellation breathes it back in; drawn cracks never do. A spent cape is drawn dim on Diana, and a star burst at its tip marks the refill. (`RULES.capeRule = 'landing'`; `'cooldown'` keeps the archived 6 s timer for comparison.)
- **Cracks break.** Cracked shelves shake and fall 0.65 s after the first landing. A dive through any drawn crack breaks it at once and keeps Diana falling; every cracked lid has a catch below.
- **Constellations sing.** Four to six stars on a real jump or flight line; each climbs a pentatonic step and completion draws ink lines, plays a chord and refills the cape in midair. Missing one only fades the lines.
- **The beat cascade** drops one tile per beat (88 BPM from the GDD; unconfirmed), driven by simulation time. The wave is faster than Diana: it starts 430 px behind and gains 56 px a beat until the last tile drops when she is 150 px into it. Hopping at each edge always lands in time; late coyote hops on the last tiles are caught unless the second jump rescues them.
- **Solar wind** lifts Diana inside its column (−700 px/s², rise capped at 240 px/s); holding the cape catches 40% more. Inside wind the cape never dashes level (that used to run Diana under the shore she was rising to); a flight that enters a column ends and the wind takes over. A dive leaves the wind. A gentle breeze over the hearth teaches the held cape over solid stone.
- **Ledge forgiveness:** a jump or flight that arrives up to 25 px below an island's top at its lip pops onto it. Walking off an edge never earns it, so short gaps still need their hop. Island silhouettes taper right under the top so the drawn lip never extends past the collider.
- **Super jump:** a jump during a flight launches at 720 px/s (about 173 px), once per flight.
- **Great Fallen Stars:** three, each on a mastery line in view of the route. One counts once Diana touches ground or a beacon after taking it; a banked one is never lost to a later fall. All three paint Earth blue inside the far door.

## The map

About 81 s of nominal run (79–80 s on the QA routes because flights are faster), in three movements and a coda. Seven beacons, never more than 14.0 s apart, each right before the first required use of a mechanic. See [LEVEL_DESIGN.md](./LEVEL_DESIGN.md) for every coordinate.

| Nominal time | Movement · step | What happens |
| --- | --- | --- |
| 0–3 s | I · Waking — introduce | The sprout wakes; flat ground, three tap-height and three hold-height stars |
| 3–9 s | develop | Four different hops: a forgiving 90 px first gap (a 0 ms tap clears it), a rise onto a small rock, a short hop onto a slab, a drop to a long island; the first constellation |
| 9.9 s | Beacon *leap* | |
| 10–14 s | twist | A 260 px flat gap that needs a late second jump; Great Star 1 on a ledge above |
| 14–22 s | conclude | 165 px double-jump climb, hop, long late-double gap, optional high crown |
| 22–24 s | II · The Breaking Constellation | Title card, beacon *breaking* (23.9 s) |
| 25–30 s | introduce | A shelf breaks under Diana over safe ground; a second one forces an early jump to an island one beat away |
| 30–37 s | develop | A ridge with a quick double hop over a stepping stone, a drop and a rise; optional three-shelf cracked chain above |
| 37.9 s | Beacon *well* | |
| 40–48 s | twist | A cracked lid over the star well (dive: Great Star 2 and a constellation); the six-tile beat cascade |
| 48–51 s | conclude | Double jump off a cracked shelf onto the crown |
| 51.8 s | Beacon *hearth* · III · Borrowed Wind | Three calm seconds, a story line and an optional breeze to learn the held cape |
| 55–56 s | introduce | A 380 px void; jump, then cape along a constellation's flight line |
| 56.7 s | Beacon *voids* | |
| 58–62 s | develop | Two 360 px voids split by a cracked shelf that does not refill: the midair constellation is required |
| 63.9 s | Beacon *updraft* | |
| 64–69 s | twist | Jump into the solar wind to reach a shore 170 px up; glide in the wind, then cape + super jump after it reaches Great Star 3; an optional second lid on the shore drops into a star cache (dive's rewarded second use) |
| 71.0 s | Beacon *finale* | |
| 73–78 s | conclude | Cracked launch → flight → constellation refill → flight → wind; a slower stable low line underneath |
| 78–81 s | Coda · The Far Door | A long calm island and the door |

## Camera, falling and fairness

- **Lookahead ≥ 2.5 s in landscape, ≥ 2.0 s in portrait.** Diana sits 23% from the left. Landscape views are never narrower than 880 logical px (2.51 s). Narrower boxes letterbox instead of cropping: the sky keeps at least 720 px of width (2.05 s) and as much height as leaves a ≥ 200 px control deck. On a 390 × 844 phone the sky is 366 css px tall above a 418 px deck. (The brief suggested a 960 px minimum; the lower portrait floor trades lookahead above the 2.0 s rule for a 22% taller phone sky.)
- **Vertical camera** anchors on the last grounded y with 65% follow (τ 0.35 s), looks down up to 120 px after 0.35 s of falling, and never lets Diana's head into the 56 px HUD band.
- **Death line** is 265 px below the anchor (≈60 px under the visible bottom), not a fixed far-off y.
- **No card on a fall.** Diana breaks into six star shards that ride the camera back to the last beacon (0.45 s), an ink iris closes (0.25 s) and the sprout pops her back up (0.4 s): 1.1 s to control. After three falls at one beacon a one-line tip appears for 3 s; after five, "Assist is in pause".
- **Assist (pause card):** Gentle pace (0.8× clock, so every arc stays identical), Endless cape, Star net (once per beacon a fall returns Diana to her last stable landing, with everything ahead restored).

## UI: ink and starlight

The Solarum font is used for every label (never below 16 px; its missing ✦ is replaced by the original star sprite). Colours are the original title-art tokens `--ink #0C0C0F`, `--paper #FBFBEA`, `--hill #CECEC1`, `--mute #AEAEA3`, `--dim #777771`; `--earth #6FA8DC` is the only colour and is reserved for Earth. Paper cards carry a hand-drawn ink frame (an SVG displacement filter that boils at 8 fps unless reduced motion is set).

- **Title:** the original logo over the original title ground (with a tinted copy as back hills) and the 18-frame sprout; "Press space or tap to wake"; ♫ and fullscreen in the corners. Waking drifts the logo away, pops Diana out of the leaves and eases the camera to the run framing. Sound is on by default and starts with that gesture (the choice persists with a guarded `localStorage` write); see [Sound](#sound).
- **HUD:** star count, three Great Star slots (hollow frame 0, filled frame 2, pulsing while carried), the orbit line home → Earth with beacon ticks and a two-leaf Diana marker, fullscreen and II. Nothing else.
- **World glyphs** instead of words: paper discs with drawn arrows (↑, ↑ ↑, ↑ · →, → · ↑, hold →, ↑ · hold →, ↓), shown about 2.2 s ahead of first need, hidden once the action is done, shown again after a fall. One at a time: a glyph can wait for an earlier one (`after`), and optional glyphs hide while a required one is due. Each glyph's window is tested: following it at its first valid moment (and, for required ones, its last) survives. Touch devices see the jump glyph as the rounded square of the jump zone.
- **Visual language:** stable stone is plain paper; optional stable stone has a dotted rim and a star tick; grey appears only on stone that is breaking now; crumbling shelves and cascade tiles have zigzag edge cracks; lids have one star-shaped break with light glinting out. World stars always use the filled frames (the hollow frame means an empty Great Star slot).
- **Why she runs:** a tiny Earth glint pulses the signal far ahead in the sky from the first second, and the first beacon's line names it.
- **Beacons** are ink cairns whose hollow star fills, with a ring pulse, a two-note chime, an orbit tick and one story line.
- **Movement cards** (I, II, III only), 42 px, 300/1600/500 ms of *simulation* time, never over a required input (tested). Story lines and tips also run on simulation time and are dropped on respawn, so nothing lingers after a pause, fast-forward or fall.
- **Pause card** with the large orbit, Continue / Back to last light / Restart chapter, Sound, Assist…; P/Esc resume, arrows and Tab move focus inside it; blur and hidden tabs auto-pause.
- **Victory:** Diana stops in the door, a small blue Earth rises, and after 1.5 s a card slides up beside (never over) the door: stars, Great Star slots, time, falls, "Run again" and "Title".
- **Touch:** targets ≥ 44 px, buttons at 35% until pressed. In landscape the cape (62 px) and dive (50 px) sit low in the right corner so the lower-right lookahead stays visible; touch devices see touch hints on the title. Story lines and tips sit on ink plates so they read over cream islands. The brief's remove-lists are gone entirely: there is no canvas text at all.

## Sound

Every effect is synthesised in `audio.mjs` (oscillators, two-operator FM bells, filtered noise, Karplus-Strong plucks, generated stone crackle); no sample is loaded. The six original Unity WAVs stay in `assets/sfx/` for provenance only and are left out of the itch ZIP. The soundtrack is unchanged.

- **Key: D major (relative B minor).** Measured from `assets/soundtrack.mp3`: decoded with ffmpeg to 16 kHz mono PCM, then a JS FFT peak-chroma profile correlated against Krumhansl-Kessler key profiles (D major r = 0.881; next F# minor 0.738). The strongest notes are A3, D4 and D5, a triad-template timeline cycles Bm-D-F#m-G, and tuning is within 4 cents of A440. Melodies use D major pentatonic (D E F# A B) so they never rub against those chords; pads and blooms use the diatonic set. Tempo, from the same decode: onset-autocorrelation peaks at 107 BPM, matching the MP3's own `TBPM 107` tag, not the GDD's 88 (the cascade is still tuned to 88 by design; see Known limits).
- **Signal flow:** each voice → SFX bus → gentle compressor (−18 dB, 3:1) → master → soft safety clipper (linear below 0.6, never above 0.89) → output; a shared reverb send feeds a ConvolverNode with a generated 2.4 s stereo impulse that darkens as it decays. The music runs through a MediaElementSource into its own gain (0.22, so the level also holds on iOS) and a lowpass.
- **Variation and limits:** every cue gets ±1 dB of level, ±3 cents of pitch (pads detune up to 8 cents for chorus), new noise read positions and new crackle grains, from a seeded RNG. Each cue has a voice limit (stars: 4; the oldest fades out in 40 ms) and a rate gate (stars: 45 ms); the whole engine holds at most 20 voices.
- **Ducking:** the music dips under constellations (−5 dB), Great Stars (−3), banking (−2), beacons (−5), movement cards (−4), falls (−6) and the far door (−8), and darkens to a 650 Hz lowpass from a fall until the respawn.
- **Pause freezes everything.** Every pause path (II, P / Esc, blur, hidden tab, the assist panel) suspends the AudioContext and pauses the music element, so tails, swells and the wind bed stop mid-air and continue on Continue; nothing new starts while paused, so the pause card is silent. Continue plays a two-tick resume.
- **Sound off** creates no AudioContext and no nodes. Storage that is empty, missing or throws reads as on.
- **Presentation only.** The simulation is untouched; `processEvents()` hands every event to `audio.event(e)` (`cuesForEvent` in `audio.mjs`), and the renderer watches cracked shelves (no model events exist for their shake or fall) and Diana's `inWind` / `gliding` flags for the air bed. Every call is guarded; without Web Audio the game is silent and the soundtrack falls back to the plain element.

| Cue | Event | Sound |
| --- | --- | --- |
| `wake` | wake | Leaf rustle, a rising breath and two kalimba notes (A5, D6) as the sprout pops |
| `jump` / `double-jump` | jump / double-jump | A soft pitched breath "hup" over a sine lifting D3→A3; the second is higher and lighter with an F#6 glint |
| `super-jump` | super-jump | A rising whoosh with a four-bell sparkle D6 F#6 A6 D7 |
| `cape` | dash | A breathy whoosh that opens and settles over the 0.5 s flight, with a 13-16 Hz fabric flutter |
| `dive` | dive | A descending air rush (2.6 kHz → 380 Hz) over a sine falling A3→D3 |
| `land-soft` / `land-hard` | land (`hard`) | A muted padded thump; hard landings are deeper and longer with a little gravel |
| `lip-catch` | lip-catch | A tiny pat and an E4→A4 lift |
| `crumble-shake` / `crumble-fall` | shelf state | Dry stone crackle that builds over the 0.65 s shake; a crunch, thud and pebbles when it gives |
| `cascade` / `tile-drop` | cascade / tile-drop | A distant rumble when the wave arms; a tuned stone-marimba knock per tile stepping down B4 A4 F#4 E4 D4 B3 |
| `smash` | smash | A glassy shatter of six pentatonic shards over a soft low boom |
| `wind-catch`, updraft bed, glide bed | wind-catch, `inWind`, `gliding` | An airy rising swell; a sustained breathing wind while inside a column; soft air with flutter while gliding |
| `star` | star | A music-box glass note; successive stars climb D5→F#6 and restart after 1.4 s without one |
| `chain-note` / `constellation` | chain-note / constellation | Kalimba notes D5 E5 F#5 A5 B5 D6 with a soft octave below; completion strums them again into a D add9 bloom with a shimmer tail |
| `chain-fade` | chain-fade | Two quiet notes settling A5→F#5 into the reverb |
| `refill` | refill (ground / net) | A reversed inhale ending on an A6 glint; beacon and constellation refills are voiced by those cues |
| `great-star` / `great-banked` | great-star / great-banked | A soft bell arpeggio D6-D7 over a kalimba D5; a gentle A5→D6 chime |
| `beacon` | checkpoint | A warm D3/A3/F#4 pad swell and the two-note chime A5, D6 |
| `movement` | movement | A low singing-bowl D3 under the card |
| `fall` / `respawn` | death / respawn | A soft gliss A4→D3 with a fifth above, closing into the dark; a reversed shimmer rising 0.34 s into a kalimba D5 |
| `win` | win (`earth`) | A slow D maj9 bloom and bell arpeggio; two more bells when Earth is blue |
| `ui-hover` / `ui-select` / `ui-resume` | menu buttons | A paper tick, a wooden A5 tock, two ticks rising F#5→A5 |

**Soundboard (dev only, not in the ZIP):** `npm run dev`, then open http://127.0.0.1:4173/soundboard.html. One keyboard-accessible button per cue and bed, 13 gameplay-timed sequences (constellation run, loose stars, rapid stars against the limiter, crumbling shelf, cascade, solar wind, fall and respawn, pause freeze...), a music toggle, a pause toggle and a peak meter. `window.__soundboard.render(name)` renders a cue offline and `renderWithMusic(name)` mixes it over the soundtrack.

## Architecture

| File | Responsibility |
| --- | --- |
| `level.mjs` | Authored platforms, stars, constellations, Great Stars, updrafts, cascade, prompts, beacons, movements |
| `model.mjs` | Pure simulation: movement, cape rule, smash, constellations, cascade, wind, super jump, banking, beacons, death and respawn timing, assists |
| `geometry.mjs` | Pure camera: letterboxing, lookahead, vertical anchor / look-down / headroom, contours, portal contact |
| `animation.mjs` | Source-timed clips and layered body / cape selection |
| `audio.mjs` | Procedural sound: key, cue recipes (pure data), event → cue map, Web Audio engine, offline render |
| `game.js` | Canvas drawing, HUD / cards, input, sound wiring, browser QA adapter |
| `soundboard.html`, `soundboard.js` | Dev-only cue board and offline render hooks (excluded from the ZIP) |
| `index.html`, `style.css`, `embed.*` | Game surface and UI; green preview / iframe / fullscreen layout |
| `assets/manifest.json` | Source paths, slices, pivots, clip timing, portal bounds, SFX and an on-screen vs archive `usage` record |
| `scripts/extract-assets.py` | Reproducible, byte-for-byte extraction from `../refs/solarum/solarum-master.zip` |
| `tests/model.test.mjs`, `tests/audio.test.mjs`, `tests/routes.mjs`, `tests/png.mjs` | Tests, route pilots, PNG alpha inspector |

The simulation uses world px and seconds with substeps of at most 1/120 s, and has no DOM, image, sound, storage or wall-clock dependency. Events (`s.events`, monotonic `eventSerial`) drive sound and particles in the renderer.

## Browser QA adapter

```js
__game.ready;                       // art decoded
__game.start();                     // wake from the title
__game.restart();                   // fresh chapter, running
__game.retry();                     // back to the last beacon, running
__game.toTitle();
__game.jump(); __game.releaseJump(); __game.dash(); __game.dive(); __game.pause();
__game.setAssist("gentle" | "endlessCape" | "starNet", true);
__game.getState();                  // snapshot (see below)
__game.getRenderGeometry();         // portal, visibleWorldWidth, lookahead(s), cameraX/Y, layout
__game.getAudio();                  // { on, unlocked, decoded, state, paused, suspended, musicPlaying, voices, played, ... }
__game.step(1 / 120, { glide: true }, { render: false });
__game.model;                       // isolated fixtures only
```

`getState()` keeps `status` ('ready' | 'running' | 'paused' | 'dead' | 'respawning' | 'won'), `time`, `stars`, `highStars`, `ringsCrossed` (now: completed constellations), `checkpointsReached`, `checkpoint`, `progress`, `deaths`, `player` (`x`, `y`, `vy`, `jumps`, `grounded`, …) and `platforms`. New fields: `capeCharges` (0/1), `capeReady`, `capeSpent`, `capeRule`, `constellations`, `greatStars`, `greatBanked`, `greatPending`, `smashes`, `flights`, `superJumps`, `refills`, `fallsHere`, `respawn`, `assist`, `anchorY`, `chains`, `prompts`, `updrafts`, `starsTotal`. `dashCooldown` stays but is 0 under the default landing rule: assert `capeSpent === true` (or `capeCharges === 0`) after an airborne D instead of `dashCooldown > 5`.

`getAudio()` keeps `on`, `unlocked` and `decoded` (now the generated buffers: noise colours and the reverb impulse; no WAV is decoded) and adds `state` (AudioContext state), `time` (audio clock, frozen while paused), `paused`, `suspended`, `musicWanted`, `musicPlaying`, `musicRouted`, `musicDark`, `air`, `voices`, `peakVoices`, `nodes` (created so far), `dropped` (rate-gated), `played` (count per cue) and `cues`.

A fall sets `status: 'dead'` for 0.7 s, then `'respawning'` for 0.4 s, then `'running'` (all in simulation time). `retry()` is immediate.

`tests/routes.mjs` exports `createRouteMemory`, `chooseAction` and `playRoute(api, { route, dt, maxSeconds = 100 })`; each is self-contained for `.toString()` serialisation. Routes: `main` (alias `low`), `upper` (aliases `high`, `mastery`), `ability`, `safe`. All finish within 80.1 s of simulation, so the root's existing `maxSeconds ?? 85` still works; 95 gives headroom.

## Validation evidence (2026-11-09, Node 22.14.0)

`npm test`: **64/64 pass** (about 6.5 s; 52 model / UI tests plus 12 audio tests in `tests/audio.test.mjs`). Every route wins at 30, 60, 120 and 240 Hz sampling with zero deaths. At 120 Hz:

| Route | Time | Stars (of 90) | Upper stars | Great Stars | Constellations | Beacons | Jumps / flights / dives / super | Smashes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| main | 79.292 s | 62 | 3 | 0 | 5 | 7 | 43 / 5 / 0 / 0 | 0 |
| upper | 79.233 s | 74 | 15 | 3 | 6 | 7 | 49 / 6 / 1 / 1 | 1 |
| ability | 79.292 s | 77 | 15 | 1 | 7 | 7 | 47 / 5 / 2 / 0 | 2 |
| safe | 80.083 s | 61 | 6 | 0 | 4 | 7 | 44 / 3 / 0 / 0 | 0 |

Every one of the 90 stars is collected by at least one pilot and none sits inside an island (tested). Other checks include: removing the second jump fails at the leap, removing the cape fails at the first void, removing one star of the required constellation fails at the second void, removing the wind fails at the updraft; landing / beacon / constellation refills and no refill on cracks; smash timing and catches; constellation completion, miss and 1.2 s timeout; cascade schedule and shake lead; updraft lift, cap, glide boost and dive exit; once-per-flight super jump; Great Star banking, loss before banking and survival after banking; beacon spacing and runway; authoring limits; no blind landings; telegraph lead time; lookahead on eight viewports; HUD band and death-line geometry; respawn ≤ 1.2 s with a buffered jump; star net; portal PNG bounds and contact; and a static UI contract (no type under 16 px, palette tokens, no olive colours, no canvas text, none of the removed labels).

Browser evidence on the extracted itch ZIP (Chrome via Playwright, scratch scripts, not part of `npm test`): green centred 960×640 preview; keyboard jump / double / cape / pause; root-style ability, low and high playthroughs win inside an 85 s budget; retry vs restart; sandboxed 960×640 iframe with identical canvas size and visible fullscreen control; 390×844 touch + reduced motion with every visible button ≥ 44 px and no overflow; zero page or console errors. Screens were reviewed at 960×640 and 390×844 for the title, every movement, cascade, updraft, death / respawn, pause, assist and victory. Route pilots prove reachability, not fun; human play is still the real test.

**Audio evidence (2026-11-09, Chrome via Playwright, scratch scripts, not part of `npm test`).** Every cue and both air beds were rendered through a real `OfflineAudioContext` at 48 kHz with the game's full chain (36 renders including step / index / earth variants): none silent (quietest: the paper hover tick, peak 0.017), every peak between 0.017 and 0.251 with the soft clipper bypassed and identical with it on (it never engages), every audible length (to −60 dBFS) within its bound. Against the soundtrack through the same chain (RMS −31.6 dBFS, peak −17.1 dBFS), active-RMS offsets are: blooms and story cues 0 to +3.7 dB (constellation +3.7, beacon +3.6, win +3.0 / +3.6, Great Star +2.9, fall +1.5), movement and stone −0.8 to −6.2 dB (jump −5.5, cape −3.0, star −3.2, chain note −3.1 to +0.9, tile knock −3.4), quiet details −6 to −17.5 dB (soft land −6.0, lip catch −12.8, glide bed −11.1, hover −17.5). Measured ducks: −5.0 dB under the constellation and beacon, −5.3 under a fall, −4.0 under a movement card, −6.7 under the win (still ramping to −8). Cue plus music never peaks above 0.364. Spectral centroids are 213 Hz to 3.7 kHz with at most 4.9% of energy above 6 kHz; only the leaf rustle (3.6 kHz), the respawn shimmer (3.7 kHz) and the hover tick (4.7 kHz, 17 dB under the music) exceed a 3.5 kHz brightness flag. In the real game (dev server, then the extracted ZIP in a sandboxed iframe): sound is on with empty storage and with storage that throws; no context or node exists before the wake gesture; 32 s of live play on the main route voiced 12 cue types with at most 4 voices and no drops; P, a blur auto-pause and the assist panel each suspend the context and pause the music, the audio clock stays frozen for 0.9 s and nothing new plays, and Continue resumes with one resume tick; sound switched on from the pause card stays frozen until Continue; a compressed full ability run (79.3 s of simulation in 1.65 s) voiced 24 of the 30 cues (that route never super-jumps, lip-catches, fades a chain or falls; those are covered by the renders and unit tests) with the voice cap holding at 20 and 107 repeats rate-gated; with sound off a run creates 0 nodes and no context; the victory card ticks and the title stops the music; zero page or console errors.

## itch.io export

`npm run build:itch` writes `dist/solarum-itch.zip` (39 files, 9.16 MiB; the soundboard and the archived WAVs are left out), `dist/itch/` and `dist/build-report.json`. `index.html` is at the root and every path is relative; `.mjs` runtime modules become `.js`. Use an HTML game page, 960×640 embed, click-to-play and fullscreen. See [ITCH_IO.md](./ITCH_IO.md). Nothing has been uploaded.

## Asset provenance and credits

Everything comes unchanged from the original Unity archive (`../refs/solarum/solarum-master.zip` in the workspace) (`solarum-master/solarum/Assets/`), extracted by `scripts/extract-assets.py`. New in this revision: the logo (`Sprites/Background/title.png`), the title ground (`titleground.png`), the shooting-star sheets and clips (`Sprites/Star/cadent1/2.png`, `Animations/stars/cadent1/2.anim`), the tail-star streak (`Sprites/Star/tail-star.png`, used for wind and Great Star tails) and six original sound effects (`Resources/Audio/Jump, Dash, star, death, successLevel, select .wav` → `assets/sfx/`), which are now archive-only: every effect is synthesised in `audio.mjs`. `assets/manifest.json` → `usage` lists what is drawn or played and what stays archive-only (`title.png` fulltitle, `undercape.png`, and `jump-landing.png`, an unreferenced byte-identical duplicate of `jumpLanding.png` from an earlier pass, kept in the source folder but excluded from the itch ZIP). Islands, cairns, glyphs, constellation lines and updraft edges are drawn in code in the original line language; no generated or new character art was added.

Original credits: Cauê Melo, Daniel Calônico, Lucas Santos and Rafael Lima; the GDD thanks Amanda (meromei) and Bruno Mareto (Bu Maré) for the soundtrack. Ownership stays with the original project.

## Known limits

- The cascade lag and constellation spacing use the GDD's 88 BPM, but the soundtrack measures 107 BPM (onset autocorrelation and the MP3's `TBPM` tag agree). The game is not beat-locked by design (simulation time is authoritative), so nothing breaks; retuning the beat is a level-design decision left open.
- M8 (comet slipstream) is not implemented: the finale already chains two flights and a wind column, and another speed source would hurt readability.
- The cape tint is a gradient over the trailing half of the sprite because most original sheets bake the cape into the body; it can lightly touch a trailing leg.
- Portrait phones get a smaller sky (366 css px tall at 390 px wide, 2.05 s lookahead); landscape is recommended and the game says so once.
- Safari / Firefox and physical touch devices are untested, including Web Audio there (Safari's MediaElementSource and suspend / resume behaviour in particular). The mix was balanced by measuring offline renders against the soundtrack (below); it still needs a human listen on speakers and headphones. Automated pilots read exact coordinates; they do not show where a first-time player misreads a cue.
