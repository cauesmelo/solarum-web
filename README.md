# Solarum browser demo

**A Signal in the Dark** is the authored first chapter of the original Solarum runner. Diana runs on her own across floating islands toward a faint signal from Earth. The original cream-on-black hand-drawn art, Diana's cape, the stars, the solitude and the far door stay at the centre.

This revision (2026-11-09, "ink and starlight") implements the approved research brief ([RESEARCH.md](./RESEARCH.md)): a three-movement map built around one idea each (jump, crumble, cape), a cape that is its own meter, dive-smash, singing constellations, a beat cascade, solar-wind updrafts, a real super jump, three Great Fallen Stars with a colour memory of Earth, a fair camera, a 1.1 s respawn without a death card, and a new UI made from the game's own font, palette and art. The approved character animations are unchanged.

**Revision five (2026-11-09, "the path is the score")** implements the approved music brief ([RESEARCH_MUSIC.md](./RESEARCH_MUSIC.md)): the main route is re-timed on the soundtrack's 107 BPM grid, and a generative score in the soundtrack's language is played by Diana's own movements. Follow the intended path and the song draws itself exactly where it belongs; make mistakes and the world drifts gently out of tune until clean play retunes it (see [Sound](#sound)). Every mechanic, the fairness rules and the approved animations are unchanged.

**Revision six (2026-11-10, "four levels")** implements the approved movement and progression brief ([RESEARCH_LEVELS.md](./RESEARCH_LEVELS.md)): the climb hitbox fix (feet-anchored airborne frames, one bounded step-up rule, a fixed 1/120 s step) and four levels that each add one idea and run a little faster, each with its own musical feeling: **I · Waking** (96 BPM, floating and calm, basics only), **II · Borrowed Wind** (107, cape, wind and dive), **III · The Breaking Constellation** (118, cracked stone and the cascade) and **IV · The Far Door** (128, the super jump and everything, tense but fair). See [The four levels](#the-four-levels).

**Movement audit (2026-11-10)** ([MOVEMENT_AUDIT.md](./MOVEMENT_AUDIT.md)) measured every movement criterion per level, then made three fixes:
- Diana's toe is drawn on her feet on the very frame the pose changes; at 144–240 Hz it used to dip through tops she only flew past.
- A press just before touch-down is the ground jump, not a wasted double.
- Every input acts on its own timestamp, so the outcome is identical at any frame rate or hitch.

Routes, art, animation timing and the music grid are unchanged.

It is still a 2D side-scrolling autorunner with the original Diana / cape / signal / Earth story; no endless assembler, new character art or genre pivot.

## Run independently

```sh
npm run dev          # http://127.0.0.1:4173
npm test             # 86 tests: every level's routes and fairness, mechanics, glyphs, camera, UI, audio and the score
npm run score:bake   # re-bake the four path clocks after a geometry, model or pilot change
node scripts/arcs.mjs 1 hold tap double:4   # authoring: a move's height on every sixteenth
npm run build:itch   # dist/solarum-itch.zip
```

No install or build step is needed to play; use HTTP (the game loads ES modules and a manifest). The preview page is plain green `#168546` with only the game centred; in an iframe or fullscreen the game fills its host. All art, font, sound and code are local; there is no CDN, account or backend.

## Play

Reach the far door. Stars never gate anything.

| Action | Keyboard | Touch (landscape) | Touch (portrait) |
| --- | --- | --- | --- |
| Wake (title) | Space, Enter or ↑ | Tap anywhere | Tap anywhere |
| Choose an open level (title) | ← / → or click a station | Tap a station | Tap a station |
| Jump / jump again in the air | Space, ↑ or W (release early for a hop) | Left half of the screen | Left half of the control deck |
| Cape flight (once per airtime) | D or → in the air | 76 px cape button, bottom right | Cape button in the deck |
| Glide (hold the cape) | Hold D or → | Hold the cape button | Hold the cape button |
| Super jump | Jump during a flight | Jump zone during a flight | Same |
| Dive / smash cracked stone | S or ↓ | 64 px dive button or swipe down on the right half | Same |
| Pause / resume | P or Esc | II button | II button |
| Back to last light / restart level | R / Shift+R | Pause card | Pause card |

Diana runs 151.4 px per beat in every level: 242 / 270 / 298 / 323 px/s of real time at 96 / 107 / 118 / 128 BPM. The simulation always runs in 107 BPM units and a level plays it at clock = BPM / 107 (like Gentle pace), so every arc, gap and cell is the same in px and sixteenths, while coyote (0.12 s), the landing buffer (0.14 s), respawn and telegraphs stay constant in real seconds. A jump pressed while she is falling apart is kept and spent the moment she is back (released by then, it is a tap). A press just before touch-down is the ground jump on the landing tick even with the double jump still in hand. Every key, touch or click acts on the 1/120 s tick its own timestamp falls in, whatever the frame rate or a hitch ([MOVEMENT_AUDIT.md](./MOVEMENT_AUDIT.md)). The cape, glide and dive arrive in II; I ignores those buttons.

### The rules a player learns

- **The cape is the meter.** One flight per airtime. Stable stone, a beacon or a completed constellation breathes it back in; drawn cracks never do. A spent cape is drawn dim on Diana, and a star burst at its tip marks the refill. (`RULES.capeRule = 'landing'`; `'cooldown'` keeps the archived 6 s timer for comparison.)
- **Cracks break** (III and IV). Cracked shelves shake and fall 5/16 after the first landing, on the grid (0.64 s real in III, 0.59 s in IV). A dive through any drawn crack breaks it at once and keeps Diana falling; every cracked lid has a catch below.
- **Constellations sing.** Four to six stars on a real jump or flight line; each plays its authored note of the song, and completion draws ink lines, blooms the chord, brings in the choir and refills the cape in midair. Missing one only fades the lines (and the last note sighs).
- **The beat cascade** drops one tile per 107 BPM beat, driven by simulation time. The wave is faster than Diana (369 px/s against 270) and gains 56 px a beat. At this pitch a full jump spans about one tile, so the line is a bounce: land and jump again, hops of 5 and 6 sixteenths, up and down. The bouncing line leaves the last tile 0.7 s before it falls; lingering or late hops are caught.
- **Solar wind** lifts Diana inside its column (−700 px/s², rise capped at 240 px/s); holding the cape catches 40% more. Inside wind the cape never dashes level (that used to run Diana under the shore she was rising to); a flight that enters a column ends and the wind takes over. A dive leaves the wind. A gentle breeze over the hearth teaches the held cape over solid stone.
- **Ledge forgiveness:** a jump or flight that arrives up to 25 px below an island's top at its lip pops onto it. **Step-up:** rising into an island from below (or drifting under its lip) and topping out with the feet up to 20 px under the top while the body is at least 10 px over it, Diana steps up: if it looks landed, it is landed (it only applies when she could not clear the top on her own). Walking off an edge, diving and the solar wind never earn either, so short gaps still need their hop. The drawn island top spans exactly the collider (its outline wobbles ±1.5 px) and silhouettes taper right under the top, so the drawn lip never extends past it.
- **Super jump:** a jump during a flight launches at 720 px/s (about 173 px), once per flight. It works from II on and is taught and required in IV.
- **I floats:** half gravity near the top while the jump is held (|vy| < 70 px/s real, like Celeste's half-gravity threshold), gravity 1050 px/s² real, a 560 px/s fall cap; a held jump lands on flat ground exactly 7/16 later.
- **Great Fallen Stars:** three, each on a mastery line in view of the route. One counts once Diana touches ground or a beacon after taking it; a banked one is never lost to a later fall. All three paint Earth blue inside the far door.

## The four levels

Each is a short kishōtenketsu with beacons on half bars (never more than 14 s of real run apart), three Great Stars each visible from the route and never gating, and a far door on a downbeat. Levels open in order; progress (open levels, best Great Stars) is saved with a guarded `localStorage` write. The title shows the orbit map (four stations with their slots); the win card offers **Continue** (the next level, with its title card), **Retry** and **Title**. II–IV open with Diana stepping out of the door she entered. Each Great Star of the campaign paints a twelfth of Earth inside the arch; Earth is seen whole, and the original recording returns, only at IV's door. Coordinates, cells and beat charts: [LEVEL_DESIGN.md](./LEVEL_DESIGN.md).

| Level | BPM · bars · real time | New | Score | Content |
| --- | --- | --- | --- | --- |
| I · Waking | 96 · 26 · 65.0 s | Jump (tap / hold, float), double jump, constellations | Half-time harmony (a chord a bar, maj7 / add9), no drums, 5.5 s space, detune cap 10 ¢, a short 0.35 s fall | Tap and hold star rows; four hops on flat grid cells (the first gap forgives any first input); a 384 px late-double leap; a 177 px double climb (Great Star 1 above it for an early second press); tap-only stepping stones and a wide hold gap; a double staircase to the high crown (GS2) and the float line (GS3) over a calm field; the home song into the door |
| II · Borrowed Wind | 107 · 22½ · 50.5 s | Cape (one flight per airtime), solar wind and glide, dive | The soundtrack's cycle; heartbeat on 1 and 3 and ticks on 2 and 4, the shaker entering with the wind; the twist lifts (G A F♯m Bm) and the finale closes V → I; 15 ¢ | The hearth void twice, the second time without its star line; one long void with nothing to land on (jump, flight, a constellation gives the cape back, flight; GS2 for a double between the flights); the updraft, the star cache under a lid (GS1, the dive); **the glide bridge** (a held cape out of a column across a void only a glide spans); **the currents** (a flight ending over a low islet and a dive onto it on the beat, then a column that carries Diana past the island beneath it unless a dive drops her out of the wind); the finale from a stable launch with its low safe line (GS3 at the top of the last wind) |
| III · The Breaking Constellation | 118 · 23 · 46.8 s | Cracked stone (5/16 on the grid), the forced dive, the cascade | E Dorian (Em9 · A7sus4 · Dmaj9/F♯ · Gmaj7♯11), turning dark in the broken well (Bm7 G A F♯m); half-time backbeat, tresillo rim and marimba, 3.5 s space; 20 ¢, the last notes backwards on a fall | Cracks over a floor, the ridge with the cracked chain above (GS1); Movement II's well, now optional (GS2 under its lid); the six-tile cascade; **the broken well**: a flight onto a long cracked lid over a well 276 px deep, which only a dive reaches (walking or jumping off the lid's end falls past the death line), out by jump, double and flight; a cracked stair above the crown (GS3); the hearth void and the split voids (their constellation is required) |
| IV · The Far Door | 128 · 25 · 46.9 s | Super jump, taught over a floor and then required | B Aeolian over an F♯ pedal, climbing through the voids; a kick on every beat, an eighth-note ostinato, 2.5 s space; 20 ¢, the groove rests after a fall until the next constellation or beacon | The super-jump school (GS3 for a second super jump) and the storm void; the well and the cascade at 128 (GS1 off the wave's end, GS2 in the well); **the voids at 128** (hearth void and split voids, refill required); the finale with its cracked launch and low safe line; **the rising stair** (two double jumps up 135 px each along a constellation) to the door; Earth |

Between levels, **Continue** plays the orbit map: the line grows from the finished station to the next over one bar of the next tempo (any key or tap skips it), then the next level opens with its title card.

## Camera, falling and fairness

- **Lookahead ≥ 2.5 s in landscape, ≥ 2.0 s in portrait, in real seconds at every level's speed.** Diana sits 23% from the left. Landscape views are never narrower than 880 logical px (2.51 s at 270 px/s), 970 in III and 1050 in IV (a box between those widths letterboxes thinly above and below); portrait skies at least 720 / 775 / 840 px. Narrower boxes letterbox instead of cropping: the sky keeps at least 720 px of width (2.05 s) and as much height as leaves a ≥ 200 px control deck. On a 390 × 844 phone the sky is 366 css px tall above a 418 px deck. (The brief suggested a 960 px minimum; the lower portrait floor trades lookahead above the 2.0 s rule for a 22% taller phone sky.)
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
- **Victory:** Diana stops in the door (in IV a small blue Earth rises), and after 1.5 s a card slides up beside (never over) the door: the level, a line of story, stars, Great Star slots, time (real seconds), falls, the song's notes on time, **Continue**, **Retry** and **Title**.
- **Title:** under the wake button, the orbit map's four stations (numeral, name, three slots); locked ones are faint.
- **Touch:** targets ≥ 44 px, buttons at 35% until pressed. In landscape the cape (62 px) and dive (50 px) sit low in the right corner so the lower-right lookahead stays visible; touch devices see touch hints on the title. Story lines and tips sit on ink plates so they read over cream islands. The brief's remove-lists are gone entirely: there is no canvas text at all.

## Sound

**The path is the score** (revision five, [RESEARCH_MUSIC.md](./RESEARCH_MUSIC.md)). The music inside the level is no longer the mp3: it is a generative score in the soundtrack's own language, 107 BPM in D major / B minor on its measured cycle Bm | F♯m D | F♯m D | G with its 3 + 3 + 2 motif, and Diana's movements play it. The main route is authored on its grid ([LEVEL_DESIGN, "Beat map"](./LEVEL_DESIGN.md#beat-map-revision-five)), so following the intended path draws the song exactly where it belongs. Mistakes put the world gently out of tune; clean play retunes it. The original `assets/soundtrack.mp3` plays on the title and returns at the far door as the song the player just finished. Everything else is synthesised (`audio.mjs`, `score.mjs`); no sample is loaded.

### Every action has two parts

The **body** (breath, cloth, stone, sparkle, thump) plays at once and carries no free pitch. The **voice** is a note from the current chord's safe set, quantised to the grid: within 35 ms of a grid point it plays at once; otherwise it waits for the next point under a hard cap, or plays *loose* (3 dB softer, 20% wetter, slightly blurred). Safe sets: Bm B D E F♯ A · F♯m F♯ A B C♯ E · D D E F♯ A B · G G A B D E (D pentatonic's D rubs over F♯m, so each chord has its own set).

| Event | Voice (Diana's own notes are never detuned) | Grid / cap |
| --- | --- | --- |
| Jump | Glass harmonica gliding root → fifth over the 0.38 s rise | 1/16 / 70 ms |
| Double jump | Glide from the fifth to the ninth (or the next safe note) | 1/16 / 70 ms |
| Cape flight | A sung vowel (oo opening to ah) on the fifth, held through the flight | 1/16 / 70 ms |
| Super jump | Open fifths stacked a thirty-second apart | 1/16 / 70 ms |
| Dive | An octave glide down to the root | 1/16 / 70 ms |
| Stable landing | **Steps:** the chord's root on the felt bass (cracks give no bass) | 1/16 / 35 ms, else at once −6 dB |
| Ledge catch | A grace scoop into the third | 1/16 / 35 ms |
| Loose star | **Stars:** the next chord tone, climbing (a pause restarts the run) | 1/16 / 140 ms |
| Constellation star | Its authored note: the phrases quote the motif (first-song is D5 C♯5 B4 A4) | 1/16 / 140 ms |
| Constellation | The chord blooms in glass and the **choir** enters for four bars | 1/8 / 140 ms |
| Smash | Six glass shards from the chord; earns the celesta arpeggio | 1/8 / 140 ms |
| Beacon | Two bells on the half bar; the sky re-voices | 1/2 bar / 140 ms |
| Great Star | Star dust with **G♯**, the Earth colour (never over G) | beat / 280 ms |
| Cascade tile | A stone-marimba note stepping down the chord | beat / 140 ms |
| Glide | A whistle snapping to chord tones by altitude (120 ms portamento) | continuous |
| Solar wind | The wind sings on three chord tones; rising runs while she rises | 1/16 |

### The score map and its layers

Each level has its own conductor preset (`SCORES` in `score.mjs`: chords, sections, groove, Signal bars, detune cap, space, fall and payoff; see [The four levels](#the-four-levels)) and its own baked path (`PATHS` in `score-path.mjs`), and the transport plays at the level's tempo. The table below is the chapter map that level II's preset reuses (its bar 1 is the chapter's bar 23, entered on a half-bar pickup).

| Bars | Place | Harmony | Bed |
| --- | --- | --- | --- |
| 1–2 | Wake, home | Bm pedal | Sky, Signal |
| 3–10 | I | the cycle, twice | + heartbeat on beats 1 and 3 |
| 11–22 | II | the cycle, three times | + shaker; the celesta when earned |
| 23–24 | Hearth | G → D | the heartbeat rests |
| 25–34 | III | the cycle with Dadd9 and Gmaj7♯11 | as in II |
| 34–35, door | Coda | Gmaj7♯11, Dadd9 | the Signal plays the whole theme |

**Sky** (pads: saws 12 cents apart and a sub, under a breathing 900 Hz lowpass, 1.6 s in, 2.8 s out; one hands over to the next without a gap), **Signal** (a distant glass harmonica calling the motif's head from the right on each cycle's Bm bar, nearer with progress), **Pulse** (felt heartbeat, shaker, the cascade marimba), **Steps**, **Stars**, **Choir** (formant voices, four bars after each constellation), **Glass** (celesta, earned by the lid smash or Great Star 2), **Strings** (Diana's glides and vowels, the wind's runs), **Earth** (star dust after a Great Star). Chord changes are anchored to places: the transport ticks in simulation time and re-phases by whole sixteenths at sync anchors (beacons, cards, the cascade arming), so the bar always matches where Diana is.

### Mistakes go gently out of tune

A hidden tuning value H (0.4–1, starting at 1) moves only after visible errors: a fall (on respawn H ≤ 0.6; 0.8 after three falls at one beacon, 1 after five), a broken constellation (−0.15, and its last note sighs 50 cents down while the pad holds a sus4 to the next strong beat), and a score note taken more than 70 ms off its intended beat (−0.03, played loose). Only clean play heals it, one bar at a time: +0.1 per error-free bar (a beacon counts as one), so a fall is heard for about four bars. H shapes only the world's bed, never Diana's voice: the whole bed drifts **flat** of her in-tune notes by (1 − H) × 40 cents (at most 20; 16 right after a fall), plus a small spread between paired pad oscillators and tape wow, at most 25 cents in all; the lowpass closes to 2 kHz × 2^(3H); below 0.7 the choir rests and the shimmer thins. (A first version spread the pads symmetrically around true pitch and healed in 2–5 s; the audio critic measured it as nearly inaudible.) A clean main run stays at H = 1 and 0 cents throughout (tested).

**A fall** tape-stops the score (0–0.45 s: the music bus's delay ramps until the pitch is two octaves down, the lowpass closes from 8 kHz to 300 Hz, the level falls 12 dB), its last eight notes play backwards an octave up, 32 ms apart, while the shards fly home (0.45–0.70 s), the respawn shimmer rises, and when control returns the score restarts on the beacon's half bar. *Back to last light* restarts without the tape-stop or a penalty; *Restart chapter* goes back to bar 1 in tune. Re-entries vary the Signal's phrase.

**Gentle music** (Assist page; stored as `solarum.music` with the same guarded storage as sound) keeps H at 1 and swaps the tape-stop for a fade: rests remain, dissonance never comes.

### The payoff

All 62 intended stars on time, all five main constellations, no fall: the song is complete, and the door resolves on the downbeat of bar 36 with the theme's cadence over the closing chord. With three Great Stars the door blooms on the Earth chord (Dmaj7♯11, the chapter's only sustained G♯) as Earth turns blue. Either way, two bars later the original recording begins on a downbeat (its first beat is 0.449 s into the file).

### Clocks, scheduling and pause

- The score never delays or drives gameplay: the simulation runs on its own clock and the engine follows it. `game.js` passes `{ simTime, x, y, status, timeScale, inWind, gliding, fallsHere }` every frame; events go to the conductor even in quiet QA steps so the song keeps its place.
- Simulation seconds map to audio seconds through a clock that ignores the audio clock's 2.7 ms render-quantum steps (4 ms dead band), slews real drift at 1% of tempo (3% for a residual over 20 ms) and, after a hitch over 50 ms, re-anchors by **whole sixteenths** so the grid keeps its phase; the wake anchors on its first frame. Bed notes are scheduled from the rAF loop 120 ms ahead and sound 15 ms after their grid point, which centres Diana's notes (they arrive a frame after their event); a note whose grid point just went by sounds at once, never in the past. Gentle pace (0.8×) slows the transport to 85.6 BPM, so everything stays aligned. The simulation is never held for the audio (after a pause, `ctx.resume()` settles in the background and the clock slews the residual).
- **Pause freezes everything** with a 15 ms fade on each side (no click). Every pause path suspends the AudioContext and the soundtrack; the score's clock and transport hold with the frozen simulation and nothing is scheduled until Continue, which resumes in place. Sound off creates no context and no nodes (the conductor still follows, so switching sound on mid-run joins the song where it is). Sound is on unless the player turned it off.

### Palette and signal flow

Voices (`VOICES` in `audio.mjs`): sky pad, choir and cape vowel (saws through two formant band-passes with a vibrato that blooms in), glass harmonica (sine plus a third harmonic 20 dB down and a wet-finger noise rub at twice the pitch), music-box glass and felt kalimba for stars, felt bass (sine under 400 Hz with an 8 ms mallet), felt heartbeat, shaker, FM celesta, inharmonic star-dust bells, glass shards, stone marimba, bloom, beacon chime.

```
cue -> sfx bus -> compressor -> master -> safety clipper -> out    (+ 2.4 s room reverb)
bed voice -> bed bus -> tape wow (H) -> lowpass (H) ------> score bus
player voice ---------------------------------------------> score bus
voices -> 5.5 s space reverb (30 ms pre-delay, 120 ms bloom) + octave shimmer loop -> score bus
score bus -> tape delay (tape-stop) -> tape lowpass -> tape gain -> presence (+3.5 dB @ 3.8 kHz) -> score out (0.55) -> master
rewind notes -> master        soundtrack element -> music gain (0.32) -> master (title, door)
master -> output (+7.7 dB) -> limiter (-3 dBFS, ratio 20) -> safety clipper -> out
```

The shimmer is an octave-up granular shifter (two delay lines driven by looping ramp and window buffers) feeding back into the space reverb at 0.4 (0.15 below H 0.7). Phones get a 4 s space reverb. The score uses at most 28 voices beside the 20 cue voices; to keep CPU down the shaker is one persistent voice (an envelope per sixteenth), sky pads are grouped oscillator buses under one envelope and a choir chord shares one pair of formant filters, so a whole main run creates about 6.4k nodes (10.2k before). Each pad tone's two saws sit on opposite sides, the second 7–15 ms later; pads are re-voiced at every bar line with a 1.6 s crossfade, so a held chord never decays.

**The soundtrack's bookends.** On the title it starts on the plain element where the browser allows it (itch's click-to-play iframe does), otherwise with the first gesture that does not wake; waking fades it under the sky. It is preloaded, and one bar after the door it fades in on a downbeat at its full section (bar 26 of the file), 3 dB up to match the door's bloom.

### The mix (measured)

Offline renders through the full chain as shipped (Chrome `OfflineAudioContext`, 48 kHz, safety clipper on; WAVs kept outside the repo), against the soundtrack through its own path as reference (−16.5 LUFS, peak 0.806). The audio critic measured the first mix at −27.5 LUFS against the soundtrack file's −15; the output now gains 7.7 dB into a limiter.

| Render | LUFS | Peak |
| --- | --- | --- |
| Perfect run, bars 1–12 (cues + score) | −16.7 | 0.820 |
| The same, score only | −17.3 | 0.772 |
| Sloppy run, bars 1–12 (broken constellation, late hops, a fall) | −17.2 | 0.828 |
| Gentle music, same sloppy run | −17.0 | 0.832 |
| Fall and tape-stop (9 s) | −19.5 | 0.804 |
| Perfect run, Movement III | −15.7 | 0.834 |
| Perfect door / mastery door with Earth | −14.6 / −14.9 | 0.838 / 0.822 |

Stems (score only): stars −20.7, sky −21.1, steps −24.6, pulse −26.4, strings −27.6, Signal −27.8, glass −28.1, Earth −28.2, choir −28.7 LUFS. Nothing exceeds 0.84. A sloppy run now leaves the bed 16–21 cents flat for several bars after each fall (heard in the A/B on the soundboard).

### Body cues

Every cue gets ±1 dB, ±3 cents (pads up to 8), fresh noise positions and crackle grains from a seeded RNG; a voice limit per cue (stars: 4) and a rate gate (stars: 45 ms); the soundtrack ducks under story moments (constellation −5 dB, Great Star −3, banked −2, beacon −5, card −4, fall −6, door −8) and the world's bed breathes back by half as much.

| Cue | Event | Sound |
| --- | --- | --- |
| `wake` | wake | Leaf rustle, a rising breath and two kalimba notes (A5, D6) as the sprout pops |
| `jump` / `double-jump` | jump / double-jump | A soft breath "hup" over a felt lift; the second is higher and lighter with a spark tick |
| `super-jump` | super-jump | A rising whoosh with a glittering trail |
| `cape` | dash | A breathy whoosh that opens and settles over the flight, with a 13-16 Hz fabric flutter |
| `dive` | dive | A descending air rush (2.6 kHz → 380 Hz) |
| `land-soft` / `land-hard` | land (`hard`) | A muted padded thump; hard landings are deeper with a little gravel |
| `lip-catch` | lip-catch | A tiny pat |
| `crumble-shake` / `crumble-fall` | shelf state | Dry stone crackle that builds over the 0.65 s shake; a crunch, thud and pebbles when it gives |
| `cascade` / `tile-drop` | cascade / tile-drop | A distant rumble on the chord's root; a stone knock per tile |
| `smash` | smash | Cracking stone and chips over a soft low boom |
| `wind-catch`, updraft bed, glide bed | wind-catch, `inWind`, `gliding` | An airy swell with two chord tones; breathing wind that sings in a column; soft air with flutter while gliding |
| `star` / `chain-note` | star / chain-note | A 3 ms glass sparkle (warmer with an ink stroke for constellation stars) |
| `constellation` / `chain-fade` | constellation / chain-fade | Ink lines drawn in light, a rising shimmer; a soft falling breath |
| `refill` | refill (ground / net) | A reversed inhale ending on an A6 glint (A is safe on every chord) |
| `great-star` / `great-banked` | great-star / great-banked | A burst of light and glittering dust; two bells on the chord's tones |
| `beacon` | checkpoint | A ring of light: an airy swell and a soft low pulse |
| `movement` | movement | A low singing bowl on the chord's root and fifth |
| `fall` / `respawn` | death / respawn | A rush of air closing into the dark; a reversed shimmer into a kalimba on the beacon chord's root |
| `win` | win | The closing chord blooms with bells; the Earth chord's G♯ with three Great Stars; the motif's cadence when the song is complete |
| `ui-hover` / `ui-select` / `ui-resume` | menu buttons | A paper tick, a wooden A5 tock, two ticks rising F♯5→A5 |

**Soundboard (dev only, not in the ZIP):** `npm run dev`, then open http://127.0.0.1:4173/soundboard.html. *Runs* renders the real model and pilots offline and plays them: perfect bars 1–12, the same sloppy (broken constellation, late hops, a fall), the same with Gentle music, the fall and tape-stop on its own, Movement III, the perfect door and the mastery door with Earth, and the score without bodies. *Stems* renders each layer alone from a run. *Score voices* plays each voice over the chord chosen in the toolbar. The toolbar's *Tuning H* slider and *Hear H* play the bed at any tuning value under Diana's in-tune notes; *A/B* plays the perfect and sloppy bars 1–12 sample-locked and switches between them live; every render shows its BS.1770 loudness and peak. Below are the body cues and short sequences, a soundtrack toggle, pause and a peak meter. `window.__soundboard.renderRun({ kind: "main" | "sloppy" | "gentle" | "upper", from, seconds, only, cues })`, `render(cue)` and `renderWithMusic(cue)` return PCM for QA.

## Architecture

| File | Responsibility |
| --- | --- |
| `level.mjs` | Authored platforms, stars, constellations, Great Stars, updrafts, cascade, prompts, beacons, movements |
| `model.mjs` | Pure simulation: movement, cape rule, smash, constellations, cascade, wind, super jump, banking, beacons, death and respawn timing, assists |
| `geometry.mjs` | Pure camera: letterboxing, lookahead, vertical anchor / look-down / headroom, contours, portal contact |
| `animation.mjs` | Source-timed clips and layered body / cape selection |
| `score.mjs` | Pure adaptive score: 107 BPM grid, chord map and safe sets, authored phrases, quantiser, transport, sim → audio clock, tuning value H, the conductor |
| `score-path.mjs` | Generated path clock: world x → sixteenth of the main route, its anchors and a source hash (`npm run score:bake`) |
| `audio.mjs` | Sound: body cue recipes and score voice recipes (pure data), event → cue map, the Web Audio engine (cues, score buses, space reverb and shimmer, tape-stop, scheduler, soundtrack bookends), offline renders |
| `game.js` | Canvas drawing, HUD / cards, input, sound wiring (events and a per-frame score update), browser QA adapter |
| `frame-clock.mjs` | Frame and input-event timestamps → real seconds to simulate (inputs act at their own time; gaps clamp at 100 ms) |
| `soundboard.html`, `soundboard.js` | Dev-only board: runs, stems, score voices, body cues, offline render hooks (excluded from the ZIP) |
| `scripts/bake-score.mjs` | Bakes each level's main pilot into `score-path.mjs` and prints any anchor beyond its tolerance (all of them with `--verbose`) with the px nudge that would fix it |
| `scripts/movement-audit.mjs`, `scripts/browser-movement.mjs` | The movement audit's measurements and report ([MOVEMENT_AUDIT.md](./MOVEMENT_AUDIT.md)), and its Chrome checks with real keys |
| `scripts/arcs.mjs` | Authoring: flies a move (hold, tap, double:N, j@0,d@3,… with the real model and a level's physics) and prints its height on every sixteenth, to solve rhythm cells |
| `index.html`, `style.css`, `embed.*` | Game surface and UI; green preview / iframe / fullscreen layout |
| `assets/manifest.json` | Source paths, slices, pivots, clip timing, portal bounds, SFX and an on-screen vs archive `usage` record |
| `scripts/extract-assets.py` | Reproducible, byte-for-byte extraction from `../refs/solarum/solarum-master.zip` |
| `tests/model.test.mjs`, `tests/movement-audit.test.mjs`, `tests/audio.test.mjs`, `tests/score.test.mjs`, `tests/routes.mjs`, `tests/music-run.mjs`, `tests/glyphs.mjs`, `tests/png.mjs` | Tests, route pilots, the route driver with fault injection (score tests and soundboard renders), glyph follower, PNG alpha inspector |

The simulation uses world px and seconds with substeps of at most 1/120 s, and has no DOM, image, sound, storage or wall-clock dependency. Events (`s.events`, monotonic `eventSerial`) drive sound and particles in the renderer.

## Browser QA adapter

```js
__game.ready;                       // art decoded
__game.start();                     // wake from the title (the selected level)
__game.startLevel(2);               // open level n (1-4) and wake it; { wake: false } stays on its title
__game.levels();                    // [{ id, title, bpm, clock, verbs, unlocked, great }]
__game.restart();                   // fresh level, running
__game.retry();                     // back to the last beacon, running
__game.toTitle();
__game.jump(); __game.releaseJump(); __game.tap(); __game.dash(); __game.dive(); __game.pause();
__game.setAssist("gentle" | "endlessCape" | "starNet" | "gentleMusic", true);
__game.setMusic({ gentle: true });  // Gentle music (no dissonance); returns { gentle }
__game.getState();                  // snapshot (see below)
__game.getRenderGeometry();         // portal, visibleWorldWidth, lookahead(s), cameraX/Y, layout
__game.getAudio();                  // { on, unlocked, decoded, state, paused, suspended, musicPlaying, voices, played, score: {...}, ... }
__game.step(1 / 120, { glide: true }, { render: false });
__game.model;                       // isolated fixtures only
```

`getState()` adds `level` (1-4), `world` (its startX / finishX / speed …) and `routes` (the level's pilots, read by `chooseAction`); it keeps `status` ('ready' | 'running' | 'paused' | 'dead' | 'respawning' | 'won'), `time`, `stars`, `highStars`, `ringsCrossed` (now: completed constellations), `checkpointsReached`, `checkpoint`, `progress`, `deaths`, `player` (`x`, `y`, `vy`, `jumps`, `grounded`, …) and `platforms`. New fields: `stepUps` (step-up assists so far), `capeCharges` (0/1), `capeReady`, `capeSpent`, `capeRule`, `constellations`, `greatStars`, `greatBanked`, `greatPending`, `smashes`, `flights`, `superJumps`, `refills`, `fallsHere`, `respawn`, `assist`, `anchorY`, `chains`, `prompts`, `updrafts`, `starsTotal`. `dashCooldown` stays but is 0 under the default landing rule: assert `capeSpent === true` (or `capeCharges === 0`) after an airborne D instead of `dashCooldown > 5`.

`getAudio()` keeps `on`, `unlocked` and `decoded` (the generated buffers: noise colours, the room and space impulses; no WAV is decoded), `state` (AudioContext state), `time` (audio clock, frozen while paused), `paused`, `suspended`, `musicWanted`, `musicPlaying`, `musicRouted`, `musicDark`, `air`, `voices`, `peakVoices`, `nodes` (created so far), `dropped` (rate-gated), `played` (count per cue) and `cues`. `musicPlaying` now means the soundtrack **or the score** is audible (still `false` whenever paused); `soundtrackPlaying` is the mp3 alone. New: `score` = { `running`, `audible`, `bar`, `chord`, `section`, `H`, `detuneCents`, `gentle`, `choir`, `earth`, `voices`, `peakVoices`, `scheduled`, `lateNotes`, `maxLateMs`, `maxQuantizeMs`, `clock` { `drift`, `maxDrift`, `jumps` }, `song` { `notes`, `total`, `constellations`, `falls`, `complete` }, `layers`, `played` (per voice), `rephases`, `tapeStops`, `fades`, `restarts`, `door` }.

A fall sets `status: 'dead'` for 0.7 s, then `'respawning'` for 0.4 s, then `'running'` (all in simulation time). `retry()` is immediate.

`tests/routes.mjs` exports `createRouteMemory`, `chooseAction` and `playRoute(api, { route, level, dt, maxSeconds = 100 })`; each is self-contained for `.toString()` serialisation, and the plans travel with the level in `getState().routes`. `{ level }` calls `api.startLevel(level)` first. A plan step may be `tap` (press and release in one tick; `playRoute` does both). Routes per level: `main` (alias `low`), `upper` (aliases `high`, `mastery`; that level's 3 Great Stars), `ability` (I: tap and hold rows; II: glides and the cache dive; III and IV: as main) and `safe` (the low lines of II and IV; as main elsewhere). All win at 30/60/120/240 Hz; the longest takes 58.3 s of simulation (I), so `maxSeconds` 85 still works. `dt` is simulation seconds per step (a 60 Hz real frame is `clock / 60`).

For the root checks: press **D** in level II (`__game.startLevel(2)`, then Space, then D in the air): I has no cape. Screenshot moments on each main route, in simulation seconds after waking: I 12.41 s (the leap's floating second jump), II 25.93 s (gliding off the glide bridge's wind along its constellation), III 31.85 s (falling through the broken well's lid), IV 50.6 s (the rising stair). The longest pilot takes 58.3 s of simulation (I main; II 50.5, III 51.6, IV 56.9 at most), so `maxSeconds` 85 is unchanged. `__game.showMap(n)` plays the map between levels.

## Validation evidence (2026-11-10, Node 22.14.0)

`npm test`: **105/105 pass** (about 22 s): 62 model / UI tests (every level's routes at 30/60/120/240 Hz with zero deaths, the step-up sweep, F3 clearance, crisp input and identical arcs at every rate in every level, glyph windows, camera at each level's speed), 16 movement-audit tests ([MOVEMENT_AUDIT.md](./MOVEMENT_AUDIT.md)), 16 audio and engine tests and 11 score tests (every level). At 120 Hz (time in real seconds):

| Route | Time | Stars | Great Stars | Constellations | Beacons | Jumps / flights / dives / super | Smashes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| I main | 65.01 s | 20/29 | 0 | 3 | 4/4 | 23 / 0 / 0 / 0 | 0 |
| I upper | 65.01 s | 19/29 | 3 | 3 | 4/4 | 28 / 0 / 0 / 0 | 0 |
| II main | 50.47 s | 38/48 | 0 | 4 | 5/5 | 18 / 8 / 2 / 0 | 0 |
| II upper | 50.47 s | 43/48 | 3 | 5 | 5/5 | 21 / 8 / 3 / 0 | 1 |
| III main | 46.78 s | 27/39 | 0 | 2 | 4/4 | 29 / 5 / 1 / 0 | 1 |
| III upper | 46.78 s | 37/39 | 3 | 3 | 4/4 | 34 / 5 / 2 / 0 | 2 |
| IV main | 46.88 s | 26/34 | 0 | 3 | 6/6 | 27 / 7 / 0 / 2 | 0 |
| IV upper | 46.48 s | 31/34 | 3 | 4 | 6/6 | 28 / 9 / 1 / 4 | 1 |

Every star of every level is collected by some pilot and none sits inside an island; removing I's double jump, II's cape or IV's super jump fails exactly at the challenge that teaches it; removing one star of II's void-song or III's split-song leaves the cape spent over the void; the main routes never touch an optional platform; beacon spacing, runways, authoring limits, no blind landings (the landing is in view at the input that commits to it), telegraphs, lookahead, HUD band, death line, respawn ≤ 1.2 s real, star net and portal hold in every level.

**Movement audit (2026-11-10).** Every rubric item of `common/docs/MOVEMENT_CRITERIA.md` measured per level: 5 FAIL before, 0 after, 7 reasoned WARNs. A from-below sweep of 970,596 approaches onto every platform type of every level never shows Diana looking landed and falling, and never lands her when clearly short. The pre-audit eased foot offset showed 839 / 1,171 such cases at 144 / 240 Hz. Every required press has a window of at least 529 / 350 / 332 / 293 ms (I–IV). Coyote is 111–118 ms and the buffer 133–139 ms in every level. A person's timestamped presses replay bit-identically at 30/60/120/240 Hz and under 0–100 ms hitches. Chrome with real keys (`scripts/browser-movement.mjs`, 9/9): the drawn toe is within 0.91 px of the feet over 693 body frames; a press during an 80 ms hitch lands on its own tick; releases count behind the pause card and on blur; every main route wins and the screenshot moments are alive. The rebuilt ZIP (44 files) in a 960×640 sandboxed iframe jumps on a real Space key and wins all four main routes with no errors.

**Grid (bake).** All main-route anchors within 35 ms (real) of their grid at 60, 120 and 240 Hz: I 69 anchors (worst 20.8 ms at 120 Hz), II 91 (19.2), III 101 (13.7), IV 102 (29.4). Walking, jumping or double jumping off the broken well's lid dies; only the dive lands (tested).

**The score (tests).** Path clock fresh (hash of level, model and pilot); all 171 main-route anchors within 35 ms of their grid at 60, 120 and 240 Hz (worst 16.5 ms at 120 Hz), within the sampling at 30 Hz; constellations complete on eighths, beacons on half bars, flights move exactly 3/16, the cascade pitch is 207 px and every tile drops on a beat; the quantiser never waits past its cap (swept, and in real runs); every free note over five runs (main, upper, ability, safe, sloppy) is in its chord's safe set and G♯ sounds only as Great-Star dust; authored phrases fit their chords; a clean run stays at H = 1 and 0 cents, a sloppy run detunes only after its first error, never beyond 20 cents, and is back in tune by the door; Gentle never detunes and fades instead; a fall tape-stops with up to eight reversed notes and restarts on the beacon's half bar at the moment control returns; a perfect run fills all 62 intended notes and five constellations and plays every main layer, a sloppy one does not; a full-run scheduler simulation under 8–50 ms jitter and a 200 ms hitch holds the grid within 2 ms, recovers within a bar and schedules nothing in the past; through the real engine on a strict Web Audio mock a whole run schedules over 500 notes with no source started before the clock, at most 28 score voices, a completed song, and pause freezes scheduling, nodes and the transport.

**Audio renders (Chrome via Playwright, `OfflineAudioContext`, scratch scripts; WAVs kept outside the repo).** 17 run and stem renders (see [The mix](#the-mix-measured)): none silent, every peak below 0.48 with the clipper bypassed (it never engages), the score alone at −29.9 LUFS against −29.0 LUFS for the soundtrack through its old path. All 32 body cues and beds render audible (peaks 0.009–0.252) and within their length bounds.

**Real browser (Chrome via Playwright on the dev server, then the extracted ZIP in an itch-style sandboxed iframe).** Sound is on with empty storage; no context or node exists before the wake; after waking the score is audible and its bar and chord follow the run (for example Bm, Bm, F♯m, F♯m, G, Bm at 2.5 s steps) with H = 1 and 0 cents on the main route, notes at most 17 ms late (the event arrives a frame after it happens) and clock drift of a few ms; P suspends the context, the audio clock stays frozen over 0.8 s, nothing is scheduled, and Continue resumes audibly; a forced fall tape-stops and the score restarts on the leap beacon's bar with an audible 17.5-cent detune that heals; with Gentle music the next fall fades, H stays 1 and the setting is stored; a completed run's door hands over to the soundtrack about two bars later and the title keeps it; the ZIP in a 960×640 iframe plays the score, freezes on pause, tape-stops on a fall and restarts; zero page or console errors from the game.

Earlier browser evidence (layout at 960×640 and 390×844, touch targets, reduced motion, fullscreen control) is unchanged by this revision; route pilots prove reachability and timing, not fun, and the score has not had a human listen yet.

## itch.io export

`npm run build:itch` writes `dist/solarum-itch.zip` (44 files, 9.28 MiB; the soundboard, tests, scripts and the archived WAVs are left out), `dist/itch/` and `dist/build-report.json`. `index.html` is at the root and every path is relative; `.mjs` runtime modules become `.js`. Use an HTML game page, 960×640 embed, click-to-play and fullscreen. See [ITCH_IO.md](./ITCH_IO.md). Nothing has been uploaded.

## Asset provenance and credits

Everything comes unchanged from the original Unity archive (`../refs/solarum/solarum-master.zip` in the workspace) (`solarum-master/solarum/Assets/`), extracted by `scripts/extract-assets.py`. New in this revision: the logo (`Sprites/Background/title.png`), the title ground (`titleground.png`), the shooting-star sheets and clips (`Sprites/Star/cadent1/2.png`, `Animations/stars/cadent1/2.anim`), the tail-star streak (`Sprites/Star/tail-star.png`, used for wind and Great Star tails) and six original sound effects (`Resources/Audio/Jump, Dash, star, death, successLevel, select .wav` → `assets/sfx/`), which are now archive-only: every effect is synthesised in `audio.mjs`. `assets/manifest.json` → `usage` lists what is drawn or played and what stays archive-only (`title.png` fulltitle, `undercape.png`, and `jump-landing.png`, an unreferenced byte-identical duplicate of `jumpLanding.png` from an earlier pass, kept in the source folder but excluded from the itch ZIP). Islands, cairns, glyphs, constellation lines and updraft edges are drawn in code in the original line language; no generated or new character art was added.

Original credits: Cauê Melo, Daniel Calônico, Lucas Santos and Rafael Lima; the GDD thanks Amanda (meromei) and Bruno Mareto (Bu Maré) for the soundtrack. Ownership stays with the original project.

## Known limits

- **Movement WARNs** ([MOVEMENT_AUDIT.md](./MOVEMENT_AUDIT.md)):
  - I's floaty apex (0.54 s).
  - The 0 ms tap floor (0.24 of a full jump; real taps land at 0.45–0.56).
  - The symmetric arc and uncapped fall in II–IV, on which every cell is solved.
  - The apex hang in I only.
  - The fixed ±16 px support box against the swinging stride, and the stride's float.
  - No lasting double-jump cue on Diana.
  - Landings of the chained flights (II's glide bridge, the finales) come into view 0.35–1.04 s before the committing press, although the gap itself is in view at least 1.77 s ahead.
- **Still shorter than the brief.** I 65 s, II 50.5 s, III 46.8 s, IV 46.9 s: about 3.5 minutes on the main routes against the brief's 4.8 (and the 60-80 s asked for II-IV). Not built: III's flight across a missing cascade tile, IV's "wind, dive, wind" and narrow land-and-go bounces.
- II's dive out of the wind is required for plain play; holding the cape in that column and flying after it can still reach the far shore (an expert alternative).
- The four score presets are synthesised from the existing voices (no new instruments): L1's "breath" is the pad's bar-line re-voicing, L3's call and response is the tresillo marimba under the Signal, and the per-level payoffs (the Signal answering at I's door, the tempo exhaling into the recording at IV's) are the existing door cadence and recording. None has had a human listen.
- The map between levels draws the line and the marker but does not yet play the Signal's pickup at the next tempo.
- The score has not had a human listen. The mix was balanced by measuring offline renders (stems and runs against the soundtrack); it needs ears on speakers, headphones and a Bluetooth output (whose latency the score does not yet compensate: the brief's audio-offset option is not built).
- Only the main route is on the grid. Other lines are quantised and re-phase at anchors, so their notes are in key and in rhythm but not the authored song; a human will rarely fill all 62 intended notes, which is the intent (the payoff is for the path the level was written for).
- The first void can be crossed without the cape by a frame-perfect late double jump from the very lip, as in earlier revisions; the test proves the main line needs the cape.
- The door's soundtrack starts on a timer (about ±50 ms against the downbeat, masked by the bloom), and the title song needs a first gesture, so the very first title is silent until waking.
- Not built from the brief's options: separate music / effects volume, reduced audio motion, mono, audio offset and the visual beat. Built: sound on / off and Gentle music.
- M8 (comet slipstream) is not implemented: the finale already chains two flights and a wind column, and another speed source would hurt readability.
- The cape tint is a gradient over the trailing half of the sprite because most original sheets bake the cape into the body; it can lightly touch a trailing leg.
- Portrait phones get a smaller sky (366 css px tall at 390 px wide, 2.05 s lookahead); landscape is recommended and the game says so once.
- Safari / Firefox and physical touch devices are untested, including Web Audio there (Safari's MediaElementSource, ConstantSourceNode and suspend / resume behaviour in particular; without delay lines or constant sources the cues still play and only the score stays silent). Phone CPU for the score (pads, 4 s space reverb, shimmer) is unmeasured. Automated pilots read exact coordinates; they do not show where a first-time player misreads a cue.
