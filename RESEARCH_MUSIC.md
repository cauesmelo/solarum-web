# Solarum: interactive music brief, "the path is the score"

Prepared 2026-11-09 for the composer, audio programmer and level designer. This is a proposal; nothing here is implemented (README "Sound" describes the current build). Constraints stay: 2D autorunner, Diana / cape / signal / Earth, monochrome art, authoritative simulation, no external dependencies.

## The recommendation

1. **Keep the soundtrack's identity; generate the in-level score.** 107 BPM, D major / B minor, the original four-bar cycle and its 3+3+2 motif. The mp3 stays on the title and returns at the far door as the song the player just assembled. The level score is synthesised in Web Audio so it can leave gaps, rewind to beacons, slow with Gentle pace and be tested offline.
2. **The intended path is a timeline, not an x grid.** Bake the main-route pilot into a path clock π(x) (world x → beat). Place stars, takeoffs, landings and beacons so the pilot hits them on the grid (±35 ms). Today the map is at chance level.
3. **Harmony belongs to places, the pulse to time.** Chord cells are anchored in the world; a steady transport re-phases at sync anchors by whole sixteenths.
4. **Every action has two parts:** an immediate unpitched body sound (never delayed) and a pitched voice quantised to the grid under a hard cap, always from the current chord's safe notes.
5. **Your notes are the music.** Landings play the bass, stars the melody, constellations bring in the choir, flights hold vowels. A miss leaves a rest, not a wrong sound.
6. **Mistakes detune the world, never Diana's voice.** A hidden tuning value H detunes the bed after falls and broken constellations; clean play retunes it audibly. Falls tape-stop the music, play the last notes backwards while the shards fly home, and restart on the beacon's bar. Kindness caps and a Gentle option keep it humane.
7. **G♯ is the musical blue.** The Lydian ♯4 of D is reserved for Great Stars and the Earth reveal.

## 1. Local measurements (2026-11-09, scratch scripts, not committed)

Soundtrack (`assets/soundtrack.mp3`, decoded with ffmpeg to 22.05 kHz mono, analysed in Node):

| Property | Result |
|---|---|
| Length | 172.0 s; the music fades during bar 72 (≈160 s); the last ≈11 s are near-silent |
| Tempo | **107.00 BPM**, a strict DAW grid: onset comb score 10.5× mean at 107, ≤ 3.2× at 106.5, 107.5, 96 and 88. Tag `TBPM 107`, FL Studio 20 |
| First beat | 0.449 s |
| Feel | Onsets on beats 1 and 3 are ≈14× beat 2: a **half-time feel** (felt pulse 53.5 BPM), which is why it sounds calm |
| Harmony | From bar 6 a four-bar cycle `Bm │ F♯m · D │ F♯m · D │ G (G/B)` = vi │ iii · I │ iii · I │ IV (triad templates, approximate) |
| Top line (rough; verify by ear) | Intro bars 1–12, a 3+3+2-eighth figure: `D5 . . C♯5 . . B4 .` / `A4 F♯5 . . A4 . . .` |
| Sections | Bars 1–15 quiet (≈ −20 dB RMS), 16–25 build, 26–68 full (−13 to −15, a break at bar 45), 69–71 outro |
| Loudness | −15.0 LUFS integrated, LRA 5.3 LU |
| Colour | G♯ appears in the full section's chroma (D Lydian?); could be a C♯ overtone, so check the project file |

**The current map against a grid** (main, upper and safe pilots at 120 Hz, grid from wake). Of 169 main-route musical events (jumps, landings, stars, chain notes, beacons, tiles, flights), 54% are within ±35 ms of a 107 BPM 1/16 (chance 50%) and 15% of a beat (chance 12%). At the GDD's 88 BPM: 40% (chance 41%). The 368 px hop spacing does not survive takeoff choice and arc shape, so **the map is aligned to no tempo yet**. Already close: Movement II starts at bar 11.01 and every beacon is within 92 px of a half-bar line. Cascade tiles fall every 1.22 beats at 107.

**Physics and engine.** At 270 px/s a 1/16 is 140.2 ms (37.85 px), a beat 151.40 px, a bar 605.6 px. A flat full jump lasts 760 ms (5.42 sixteenths); a flight adds 115 px (3.04 sixteenths of run). Simulation time drives everything; `frame()` clamps steps at 50 ms; `s.time` rewinds on respawn; Gentle pace scales the simulation ×0.8; events carry simulation timestamps; the mp3 plays through a MediaElementSource.

## 2. What other games teach

| Game | Technique | Reception | Take |
|---|---|---|---|
| [Bit.Trip Runner](https://www.giantbomb.com/games/3030-29550/) / [Runner2](https://en.wikipedia.org/wiki/Runner2) | Actions add notes; gold and mode-ups add layers; obstacles on the beat | Loved; a crash [pulls layers back](https://www.pocketgamer.com/articles/054971/r); Runner 1 had no checkpoints | Layers; quick re-entry |
| Rayman Legends music levels | Constant-speed autorun authored on the song ([sync system](https://www.gamereactor.eu/?p=41722)) | Joy of recognition; [speed changes break sync](https://www.gamedeveloper.com/audio/the-musical-box-27-game-music-level-design) | Author on the timeline; flights are our problem |
| Sound Shapes | Collectibles are notes in a [16-step, eight-note sequencer](https://blog.playstation.com/?p=55622); an [invisible bar](https://www.gamedeveloper.com/audio/the-shifting-saga-of-i-sound-shapes-i-) plays them | The level *is* the song | Miss = rest |
| Rez / [Child of Eden](https://en.wikipedia.org/wiki/Child_of_Eden) | Shots [tonally aligned, on the beat](https://www.giantbomb.com/games/3030-17578/) | Musical at any skill | Quantise sound, not play |
| Planck ([Burns](https://www.gamedeveloper.com/design/planckogenesis-part-i-quantizing-events)) | Instant visual; audio waits for the next allowed note | Coarse grids feel late | Two parts, delay caps |
| Thumper | Failure drops percussion and [grinds](https://superjumpmagazine.com/the-helpful-harmful-sounds-of-thumper) | Whiplash causes more errors | No harshness here |
| Sayonara Wild Hearts | Miss = song and game blur into a [≈5 s rewind](https://gonintendo.com/stories/330336-new-gameplay-details-shared-for-sayonara-wild-hearts); skip option | Kind | Our fall |
| Just Shapes & Beats | The [song restarts at the checkpoint](https://www.nintendolife.com/reviews/switch-eshop/just_shapes_and_beats) | Frustration fades fast | Restart on the beacon's bar |
| Geometry Dash | Strict sync; [practice checkpoints](https://geometrydash.wiki.gg/wiki/Practice_Mode) | Players [mute it](https://www.imore.com/geometry-dash-6-tips-tricks-and-cheats) after hundreds of attempts | Vary re-entries |
| Hi-Fi Rush ([GDC 2024](https://gdcvault.com/play/1034256/Developing-Hi-Fi-RUSH-Backwards)) | World on the beat; actions [synced for you](https://press-start.com.au/?p=142818) | [Beat visualisation and assists](https://www.thesixthaxis.com/2023/04/10/hi-fi-rush-update-3-released-adds-additional-assistance-options/) praised | Soft visual beat |
| Patapon | [Fever](https://patapon.fandom.com/wiki/Fever_Mode) chant builds; one miss ends it | Chant throws timing; [fatigue](https://www.gamerevolution.com/?p=40264) | Never mistime the player |
| [NecroDancer](https://en.wikipedia.org/wiki/Crypt_of_the_NecroDancer) | A missed beat resets the multiplier | Polarising; Bard / No Beat loved | Gentle mode |
| Guitar Hero | Missed notes [drop out of the recording](https://typeset.io/pdf/schizophonic-performance-guitar-hero-rock-band-and-virtual-3q35e69xm2.pdf) | Legible | Gaps, not noise |
| [Tetris Effect](https://www.videogameschronicle.com/features/4-years-of-tetris-effect/) / [Lumines](https://www.harddrop.com/wiki/Lumines) | Music [from game SFX](https://wccftech.com/interview-tetsuya-mizuguchi-synesthesia-tetris-effect-rez-lumines/); a timeline sweep every two bars | Synaesthesia | SFX are the score |
| [Journey](https://www.gamedeveloper.com/audio/the-sound-design-of-i-journey-i-) | Pickup flourishes at 1 / 5+ / 10+; whistle stones in key; **singing detunes as the cold rises**; altitude-pitched wind | Beloved | Detune as state has precedent |
| [Proteus](https://www.gamedeveloper.com/audio/the-sound-and-music-of-proteus-an-academic-case-study) | Mix follows season, time, creatures | Walking composes | Harmony tied to places |
| [Fez](https://disasterpeace.com/blog/tag.FEZ.game) | Layers by state and altitude; parallel versions | Loops repeat | Altitude drives filter |
| [Electroplankton](https://www.shacknews.com/article/39048/electroplankton-review) | Only in-key, quantised notes | Can't sound wrong | Per-chord safe sets |
| [INSIDE](https://mcvuk.com/?p=68239) | Breathing audio drives the animation | Intimate | Breath is the jump voice |
| [Ape Out](https://giantbomb.com/users/3929/articles/gorilla-radio-improvisation-in-ape-out) | Intensity → denser, harder drumming | Never repeats | Density follows play |
| [Untitled Goose Game](https://digraa.org/wp-content/uploads/2020/01/DiGRAA_2020_paper_47.pdf) | One-beat stems of Debussy at two energies | Hand-played feel | Stems ≤ 1 beat if samples come |
| Spore / No Man's Sky | ["Composing in probabilities"](https://www.synthtopia.com/?p=8584); [Pulse](https://www.loudersound.com/features/how-65daysofstatic-ended-up-creating-no-man-s-sky-s-soundtrack) recombines fragments | Atmospheric, sometimes aimless | Generate inside a fixed plan |
| [Celeste](https://medium.com/game-audio-lookout/enhancing-gameplay-with-music-in-celeste-5da210bbc602) | FMOD layers build per chapter; [B-sides](https://www.materiacollective.com/music/celeste-b-sides-original-game-soundtrack) | Climbs with you | Layer by movement |
| [Melody's Escape](https://www.cubed3.com/games/reviews/pc/melodys-escape) / Audiosurf | Levels generated from songs | Some tracks bare | Author the map |

[Kondo (GDC 2007)](https://www.gamedeveloper.com/game-platforms/gdc-koji-kondo-s-interactive-musical-landscapes) frames it: **rhythm** (music follows the game's clock), **balance** (SFX and music share the spectrum and stereo field) and **interactivity** (Yoshi's percussion layer, Mario 64's instrumentation by place, NSMB enemies dancing to the stabs). Ocarina of Time stitched 12 random phrases into Hyrule Field's melody to stay fresh.

## 3. Techniques

- **Vocabulary.** Phillips: [vertical layering](https://www.gamedeveloper.com/game-platforms/pure-vertical-layering-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-), [horizontal resequencing](https://www.gamedeveloper.com/audio/horizontal-resequencing-and-dynamic-transitions-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-), [hybrids](https://www.gamedeveloper.com/game-platforms/hybrid-horizontal-vertical-structure-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-) (GDC 2021; *A Composer's Guide to Game Music*). Collins: interactive audio answers input, adaptive audio follows state ([*Game Sound*](https://mitpressbookstore.mit.edu/book/9780262033787)). Sweet: [transitions and stingers](https://www.oreilly.com/library/view/writing-interactive-music/9780133563528/ch10.html) wait for valid musical points. Solarum needs all three.
- **Scheduling.** Use the audio clock: a ~25 ms tick, ~100 ms lookahead on `currentTime` ([Wilson](https://web.dev/articles/audio-scheduling)). Scheduled notes are hard to recall, so the fall effect goes on the bus. [`outputLatency`](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency) (Baseline 2025) lets visuals follow the sound.
- **Latency.** Action-to-sound sensitivity is ≈10–30 ms for simple tasks ([Regensburg](https://epub.uni-regensburg.de/59003/1/JND_Audio_Latency.pdf)); added FPS audio latency (40–500 ms) raised tension, worst for skilled players ([GI](https://dl.gi.de/items/4ea932e9-ff53-45ed-a4f5-c507a1da561a/full)); interactivity raises the A/V threshold by ≈40 ms ([AES](https://www.aes.org/e-lib/browse.cfm?elib=12881)). So the body sound plays at once; voices wait ≤ 70 ms after inputs and ≤ 140 ms after pickups, whose sparkle is instant.
- **Harmonic safety.** D major pentatonic is safe over Bm, D and G, but its D is a ♭6 rub over F♯m: the constellation scale must know the chord.
- **Dissonance as feedback.** Sonification helps motor learning ([Effenberg 2016](https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2016.00219/text); [Boyer 2015](https://hal.sorbonne-universite.fr/tel-01191826v2/document)). Journey shows detune as state; Thumper and Patapon show punishing audio. So dissonance must follow only a visible error, stay brief and musical, heal with good play, and be capped and switchable.

## 4. The palette: mystical, spacey, floaty

Floatiness comes from slow attacks on sustained voices (soft fast transients on actions), upward portamento while rising, notes held through airtime, reverb with pre-delay and a *bloom* (the tail swells after the note), a filter that opens with altitude and closes in a fall, wide pads but Diana's voice narrow (pan ≈ −0.25, where she sits), chords without leading-tone pull (add9, sus2, maj7; Lydian over IV, since Gmaj7♯11 is diatonic to D), and half-time felted percussion with no snare. **Avoid Doppler pitch:** it detunes what we keep in tune; use pan, filter and level for motion.

| Voice | Web Audio recipe (no samples) | Role |
|---|---|---|
| Sky pad | Per chord tone, 2 saws ±6 ¢ + triangle −12 st; LP 900 Hz, LFO 0.07 Hz ±300 Hz; A 1.8 s / R 3 s; auto-pan ±0.6 | Bed |
| Choir "oo→ah" | 3 saws ±7 ¢ → two band-passes morphing F1 300→700, F2 870→1200 Hz (Q 6); vibrato 5 Hz ±8 ¢ after 300 ms | Constellations, flights |
| Glass harmonica | Sine + 3rd harmonic −20 dB; A 150–250 ms; 80 ms pink "rub" at 2·f0 (Q 12); R 1.2 s | Melody, Signal |
| Bells | Existing `glass` (ratio 4) and `bell` (3.5), plus an inharmonic 1.4 "celestial" variant | Stars |
| Kalimba / celesta | Existing Karplus-Strong `kalimba`; celesta = FM 4:1, index 1.5→0.1 in 60 ms | Chain notes, tiles |
| Felt bass | Root sine D2–B2, A 15 ms, D 0.6 s, LP 400 Hz; 8 ms noise "mallet"; pads dip 2 dB | Landings |
| Singing wind | Noise → 3 band-passes on chord tones (Q 25–30), level by speed and height | Updraft, glide |
| Space reverb | Generated 5.5 s stereo impulse, 30 ms pre-delay, 120 ms fade-in bloom, darkening tail | Pads, choir |
| Shimmer | Reverb → delay-line pitch shifter +12 st → HP 300 / LP 6 kHz → 0.3–0.45 feedback; the shifter supplies the [DelayNode](https://webaudio.github.io/web-audio-api/) a feedback loop needs ([technique](https://valhalladsp.com/2010/05/11/enolanois-shimmer-sound-how-it-is-made/)) | Blooms, Earth |
| Star dust | 30–80 ms Hann grains from a rendered bell, 20–40/s, ≤ 12 live, chord tones | Great Stars |
| Tape wow | Music bus through a 5 ms DelayNode, 0.45 Hz; 3.7 ms depth ≈ ±18 ¢ (pitch ratio = 2π·f·depth) | Mistakes only |

Lydian is the stock sound of [wonder and flight](https://markslater.net/unlocking-the-power-of-the-lydian-mode/), but its ♯4 is a tritone over the tonic: a colour note only.

## 5. The proposal

### 5.1 Grid and tempo

**107 BPM**, 4/4 felt in half time, D major / B minor. Not the GDD's 88: 107 is the real tempo (needed for title and door joins), half-time already gives the calm the GDD wanted, and one beat (151 px) is about one hop. Gentle pace runs the transport at 85.6 BPM; since everything is authored in simulation time, alignment holds.

| Unit | Time | Ground (270 px/s) | Flight (500 px/s) |
|---|---|---|---|
| 1/16 | 140.2 ms | 37.85 px | 70.1 px |
| 1/8 | 280.4 ms | 75.70 px | 140.2 px |
| Beat | 560.7 ms | 151.40 px | 280.4 px |
| Half bar (felt beat) | 1.1215 s | 302.8 px | — |
| Bar / 4-bar cycle | 2.243 / 8.972 s | 605.6 / 2422 px | — |

The main route is 36 bars (79.3 s) plus the door.

### 5.2 Two clocks

- **Transport.** Steady 107 BPM, beat 0 at wake (simulation t = 0), frozen by pause (the context is already suspended). Schedule from the rAF loop with 120 ms lookahead; a 25 ms interval is the fallback.
- **Simulation → audio.** An event at simulation time t sounds at `audioT₀ + (t − simT₀) / timeScale`, never before now + 6 ms. Drift up to 50 ms (the 50 ms clamp, hitches) is slewed at ≤ 3% tempo; beyond that, re-phase.
- **Path clock π(x).** `scripts/bake-score.mjs` runs the main pilot and stores x → beat every 25 px plus a hash of `level.mjs`; a stale table fails the tests.
- **Sync anchors:** beacon lit, movement card, cascade armed, first stable landing after a flight or super jump, respawn, star-net catch. At each, δ = π(x) − transport beat. If |δ| < 1/8 beat, do nothing. Otherwise round to sixteenths and apply at the next 1/8: sustained layers ride through, rhythmic layers skip or hold under a 150 ms air swell. At most one beat per anchor; reset to the bar if |δ| > 2 beats. Chord cells are indexed by path beat, so the harmony matches the place again.
- **Flights.** Rayman's lesson: speed changes break sync. **Set `dashSpeed` 230 → 227.1 px/s** (−1.5 px per flight) so a full flight shifts Diana by exactly 3/16 and stays on the 1/16 grid. Flights cut short (wind, super jump) are fixed at the next anchor.
- **Gameplay is never delayed.** The model never reads audio; quantisation lives only in the scheduler.

### 5.3 Rules for the level designer

1. **Author on the pilot's timeline.** After each geometry change run `npm run score:bake`; its audit prints every anchor's offset in ms and the px nudge (offset × local speed).
2. **Tolerances (main route, 120 Hz).** Stars, landings and chain notes within **±35 ms** of their authored 1/16 (±9.5 px on the ground, ±17.5 px in flight). Constellation completions on a 1/8 within ±35 ms. Beacons, tile drops and cards within **±20 ms**. Each takeoff window contains a 1/8 point, ideally mid-window.
3. **Rhythm cells.** Takeoff on a grid point; landing height relative to takeoff (after the apex):

| Move | Lands on the grid at |
|---|---|
| Full jump | +84 px at 4/16 (151 px run) · +31 px at 5/16 · **−51 px at 6/16 (dotted quarter)** · −163 px at 7/16 |
| Tap (released at once) | +20 px at 2/16 · −15 px at 3/16 |
| Double, second press at 4/16 | +83 px at 9/16 · −5 px at 10/16 · −123 px at 11/16 |
| Double, second press at 3/16 | +107 px at 8/16 · +18 px at 9/16 · −100 px at 10/16 |

   The 3+3+2 motif becomes geometry: two −51 px drop-hops (dotted quarters), then a 4/16 hop onto a +84 px rock. Use it for the Waking hops, with stars quoting the melody.
4. **Constellations.** Stars one 1/8 or one beat apart *in time*: 75.7 / 151.4 px on ground arcs, 140 / 280 px on flight lines (`flight-line` is 110 px today). Every star gets an authored pitch (§5.5).
5. **Beacons on half-bar lines**, so respawns re-enter on a strong beat. Re-check the 14 s spacing and 400 px runway tests after any move:

| Beacon | π(mark.x) | Nearest half bar | Move |
|---|---|---|---|
| leap | 9.933 s | 5½ | +43 px |
| breaking | 23.892 s | 11½ | −92 px |
| well | 37.858 s | 18 | +74 px |
| hearth | 51.783 s | 24 | −53 px leaves the island: move the hearth or use 24½ (+250 px) |
| voids | 56.325 s | 26 | −68 px |
| updraft | 62.675 s | 29 | +35 px |
| finale | 69.708 s | 32 | −47 px |

6. **Cascade at 107.** One tile per beat at a **207 px pitch** (e.g. 150 px tiles, 57 px gaps). Diana's position on tile k is `lead − (pitch − 151.4)·k`, so the wave still gains 56 px a beat from a 430 px lead. Tune `lead` so tile 0 drops on a downbeat. Half-time alternative: one tile every two beats at a 359 px pitch.

### 5.4 Score map and layers

| Bars | Place | Harmony | Layers |
|---|---|---|---|
| 1–2 | Wake, flat ground | Bm pedal | Sky, Signal |
| 3–10 | I: hops, leap, climb | Cycle ×2 | + Pulse; earned Steps, Stars, Choir |
| 11–22 | II: cracks, ridge, well, cascade | Cycle ×3 | + Glass; shaking shelves tick on 1/16 |
| 23–24 | Hearth (calm) | G → D (plagal) | Pulse rests; Choir holds |
| 25–34 | III: voids, wind, finale | Cycle with Gmaj7♯11, Dadd9 | + Strings (flights), singing wind |
| 35–36 + door | Coda | D; Lydian only with three Great Stars | Every earned layer plays the theme |

| Layer | Sound | Comes from | A miss leaves |
|---|---|---|---|
| Sky | Sky pad | Wake; never lost (only H detunes it) | — |
| Signal | Distant glass harmonica plays the motif's head every 4 bars from the right, drier and louder with progress | Wake | — |
| Pulse | Felt heartbeat on 1 and 3, shaker 1/16 at −30 dB | Bar 3; never earned or lost (it is the player's metronome) | — |
| Steps | Felt bass, chord root | Each stable landing | A rest |
| Stars | Glass / kalimba melody | Each star (authored note) | A rest |
| Choir | Formant pad | A completed constellation, for 4 bars | Silence |
| Glass | FM 1/16 arpeggio (II) | Great Star 2 or the lid smash | Nothing |
| Strings | Glass-harmonica sustain | Each flight; wind columns play rising runs | Nothing |
| Earth | Star dust + shimmer on G♯ | Great Stars (2 bars); the Earth reveal | Nothing |

### 5.5 Actions as notes

Safe notes per chord: **Bm** B D E F♯ A · **D** D E F♯ A B · **F♯m** F♯ A B C♯ E · **G** G A B D E · **Earth (D Lydian)** D E F♯ G♯ A B C♯. C♯ and F♯ over G, and C♯ over D, appear only in pads or authored notes.

| Event | Immediate (never delayed) | Musical voice | Grid / cap |
|---|---|---|---|
| Jump | Breath "hup", cloth flick | Glass harmonica gliding root → 5th over the 0.38 s rise | 1/16 / 70 ms |
| Double jump | Spark tick | Octave glide 5th → 9th | 1/16 / 70 |
| Super jump | Whoosh | Open fifths D A E F♯, 1/32 apart | 1/16 / 70 |
| Cape flight | Cloth opening | Choir vowel on the 5th, held through the flight | 1/16 / 70 |
| Glide | Air bed | Whistle snapping to chord tones by altitude, 120 ms portamento | Continuous |
| Dive | Air rush | Gliss an octave down to the root | 1/16 / 70 |
| Smash | Crack, chips | Glass crash (6 safe shards on 1/32) + low boom | 1/8 / 140 |
| Stable landing | Soft thump | Steps: root | 1/16 / 35; else root −6 dB at once |
| Cracked landing | Gravel | No bass: cracks are outside the score | — |
| Lip catch | Pat | Grace scoop into the 3rd | 1/16 / 35 |
| Loose star | 3 ms sparkle | Next chord-arpeggio note, rising | 1/16 / 140 |
| Chain note | Sparkle | Authored phrase note | Authored beat / 140 |
| Constellation | Ink lines | Bloom on the phrase chord; Choir enters | 1/8 / 140 |
| Beacon | Ring pulse | Chime + pad cadence | Half bar (scheduled ahead) |
| Great Star | Burst | Earth layer | Beat / 280 |
| Tile drop | Drop | Marimba note | On the beat by design |

A voice that cannot reach its grid point within the cap plays at once as "loose" (−3 dB, 20% more reverb), which is not an error. Constellations quote the theme over their chord: `first-song` (bars 3–4, Bm → F♯m) plays D5 C♯5 B4 | A4; `split-song` answers F♯5 E5 D5 C♯5 B4. The composer transcribes the original hook; a test checks every authored note against its cell.

### 5.6 Mistakes: the exact rules

H runs from 0.4 to 1 and starts at 1.

| Visible trigger | H | What you hear |
|---|---|---|
| Fall | On respawn min(H, 0.6); 0.8 after 3 falls at one beacon; 1.0 after 5 | The fall sequence below |
| Broken constellation | −0.15 | A sigh: the last note bends −50 ¢ over 0.4 s; the pad holds a sus4 that resolves on the next strong beat |
| Score note > 70 ms off its beat | −0.03 | It plays "loose" |
| On-grid score note / stable landing | +0.05 / +0.03 | Each step settles over a 0.8 s ramp |
| Constellation complete | +0.3 | Pads glide into unison over one beat: the "lock-in" reward |
| An error-free bar | +0.1 | — |
| Beacon lit (first pass) | = 1 | Cadence |

**Fall sequence (1.1 s).** 0–0.45 s tape-stop: a music-bus DelayNode ramp drops the pitch ≈2 octaves while the lowpass sweeps 8 kHz → 300 Hz and the level falls 12 dB. 0.45–0.70 s rewind: the last eight score notes play backwards, 32 ms apart, +12 st, −18 dB, panned toward the beacon. 0.70–1.10 s: the existing respawn shimmer rises. At control return the transport restarts at π(respawn x).

**H shapes only the music bus**, never the action voices: the player is the tuning fork. Pads detune ±(1 − H)·30 ¢ and wow adds (1 − H)·20 ¢, capped at 20 ¢ in total. Below 0.7 the choir mutes and shimmer feedback drops to 0.15. The lowpass sits at 2 kHz·2^(3H). At H = 0.6 that is gentle beating (±12 ¢, 7 kHz): out of tune, never ugly. *Back to last light* rewinds without tape-stop or penalty; *Restart chapter* sets H = 1 at bar 1. Re-entries rotate the arpeggio and Signal phrase (seeded by `fallsHere`) so retries never sound identical.

### 5.7 The mp3

| Option | Verdict |
|---|---|
| A. mp3 as the in-level bed, reactive SFX on its grid | The song is complete without the player (no gaps); rewinds need exact seeks; Gentle pace needs time-stretching; a detuned mix sounds broken |
| **B. Generative score in its language; mp3 on title and victory** | **Recommended:** gaps, rewinds, tempo scaling, chord-aware notes, offline tests; identity kept by tempo, key, progression, motif and both bookends |
| C. Stems from the original composers (Amanda / meromei, Bruno Mareto) | Best fidelity; ask them; B's layers can take stems later |
| D. AI separation of the mp3 | Artefacts; prototype listening only |

**Title:** as now. **Wake:** fade the mp3 out over 1.5 s while Sky enters on Bm (optionally fire `start()` on the mp3's next beat, ≤ 0.56 s, inside the wake transition). **Victory:** start the mp3 from 0 so its first beat (0.449 s) lands on a downbeat; the element's ≈±50 ms is masked by the bloom, and a decoded AudioBuffer (≈66 MB) is sample-accurate on desktop.

### 5.8 The perfect run

All five main-route constellations, every landing and star on the grid, no falls: the song is complete. Bass, melody and choir carry the theme through bars 25–36; the Signal, a faint call far right at the start, leads the coda. Mastery lines add descants (the well and cache songs as Glass countermelodies) but are never needed for a complete song. At the door, with three Great Stars, the **Earth chord** (Dmaj7♯11 with star dust, the chapter's only sustained G♯) blooms for two bars as Earth turns blue. Then the original recording begins: the title song, finished by the player. Otherwise a D add9 bloom leads into the same mp3. No score is shown.

### 5.9 Options

In the pause card's Sound panel, with guarded storage like `solarum.sound`:

- **Music and Effects volume.**
- **Harmony feedback: Expressive (default) / Gentle.** Gentle keeps H = 1 and swaps the tape-stop for a fade; gaps remain.
- **Reduced audio motion:** no sweeps, wow or tape-stop; narrower stereo.
- **Audio offset 0–300 ms,** prefilled from `outputLatency` (Bluetooth); shifts scheduled music and beat cues (actions can't move earlier).
- **Mono.**
- **Visual beat:** stars twinkle on beats, the Earth glint pulses on downbeats; off under reduced motion.

Every audio signal keeps a visual twin: chain lines fade, the cape dims, shards fly.

### 5.10 Implementation sketch

- **Files.** `score.mjs` (pure): BPM, cycle, cells, safe sets, authored notes keyed by star id, `pathBeat(x)`, `quantize(t, grid, cap)`, `harmonyStep(H, event)`, `pitchFor(...)`. `scripts/bake-score.mjs` writes `score-path.json`. `audio.mjs` gains the music engine (transport, layers, re-phase, H, tape-stop / rewind, mp3 bookends) and splits cues into immediate part + voice. `game.js` passes `{simTime, x, status, timeScale}` per frame.
- **Budget.** ≤ 28 music voices beside the 20 SFX voices; two convolvers plus the shimmer loop (4 s space reverb on phones). Keep handles for notes scheduled but not started so a re-phase or fall can stop them.
- **Phases.** (1) Transport, chord-safe action voices, landings as bass, stars as melody: works on today's map. (2) Bake / audit and level re-timing. (3) H, tape-stop, rewind. (4) Layers, coda, mp3 bookends. (5) Options and human listening.

## 6. Testing

| Check | Pass rule |
|---|---|
| Path alignment (main at 30 / 60 / 120 / 240 Hz) | Every anchor within §5.3 tolerances; worst offset reported |
| Baked table | Level hash matches |
| Harmonic safety (pure) | Free pitches in their chord's safe set; authored notes checked against cells; no minor 2nd against the bass |
| Dissonance only on errors | Clean main run: H = 1, detune 0 throughout; injected falls and breaks follow §5.6; Gentle keeps H = 1 |
| Delay caps | No voice beyond its cap; immediate parts never delayed |
| Drift (fake clock, 8–50 ms jitter, one 200 ms hitch) | Grid error < 2 ms; recovers within a bar; nothing scheduled in the past |
| Re-phase (upper, ability, safe) | Seams ≤ 1 beat; chord matches the place within a 1/8 |
| Respawn | Restart downbeat ±10 ms of control return at every beacon; rewind reverses the last notes |
| Pause / sound off | Transport frozen; 0 nodes when off |
| Offline renders | 80 s "perfect" and "sloppy" (3 falls, 2 breaks) runs: no clipping, ≈ −16 LUFS, expected layers per movement; WAVs kept |
| Browser | Real-time main run on the extracted ZIP logging H, delays and voices; zero errors |

**Human evaluation**, at least five players on headphones and laptop speakers (one on Bluetooth): a blind A/B against the current build; 1–7 ratings for "my movements made the music", "mistakes sounded punishing" and "sounds felt late"; think-aloud on whether detune reads as "I erred" or "it's broken"; ten forced falls at one beacon for fatigue; a musician on tuning and voice-leading; a non-musician in Gentle.

## 7. Risks

- **Synth cheapness:** gate every voice through soundboard renders and a human listen.
- **Detune read as a bug:** keep it musical, visibly caused, visibly healed.
- **Re-timing cost:** phase 1 works on today's map; only the perfect payoff needs §5.3.
- **Untested:** mobile CPU and Safari's Web Audio.
- **Scope:** one chapter's score, not a music game.

## Further sources

[Rayman Legends preview (Killscreen)](https://www.killscreen.com/preview-rayman-legends-picks-pace-co-op-and-rhythm-based-gameplay) · [Thumper postmortem, GDC 2017](https://gdcvault.com/play/1024291/Seven-Years-in-Alpha-Thumper) · [Sayonara Wild Hearts accessibility](https://www.familygamingdatabase.com/accessibility/Sayonara+Wild+Hearts) · [Hi-Fi Rush accessibility](https://support.krafton.com/hc/en-us/articles/52371575035801-Hi-Fi-RUSH-Accessibility-Settings) · [Lumines (Tetris Wiki)](https://tetris.wiki/Lumines) · [Proteus](https://en.wikipedia.org/wiki/Proteus_(video_game)) · [Electroplankton](https://en.wikipedia.org/wiki/Electroplankton) · [INSIDE audio (Audiokinetic)](https://audiokinetic.com/en/blog/inside-game-audio-using-wwise) · [Spore, GDC 2008](https://archive.org/details/GDC2008Jolly) · [Celeste (Bandcamp Daily)](https://daily.bandcamp.com/lena-raine-celeste-feature) · [Ape Out (MCV)](https://mcvuk.com/?p=178981) · [Sound Shapes (Kotaku)](https://kotaku.com/sound-shapes-is-the-vita-game-i-want-most-5893371)
