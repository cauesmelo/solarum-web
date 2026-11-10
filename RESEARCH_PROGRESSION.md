# Solarum: progression, cape charge and eight levels

Prepared 2026-11-10 by the lead game and level designer for the Solarum implementation squad. This brief makes **decisions**. Where a choice had real alternatives, it says what was rejected and why. Nothing here is implemented yet. [README](./README.md) and [LEVEL_DESIGN](./LEVEL_DESIGN.md) describe the build; [RESEARCH_LEVELS](./RESEARCH_LEVELS.md) (movement and four levels), [RESEARCH_MUSIC](./RESEARCH_MUSIC.md) (the score) and [MOVEMENT_AUDIT](./MOVEMENT_AUDIT.md) stay in force except where this brief replaces them.

Fixed constraints:
- Solarum stays a 2D side-scrolling autorunner. Diana, her cape, the stars, the signal and Earth stay; so do the monochrome hand-drawn art and the approved animations.
- The simulation runs in 107 BPM units and a level plays at `clock = BPM / 107`. Routes are authored at 151.4 px per beat and baked into score paths. "The path is the score" stays.
- Every game builds an independent itch.io ZIP.

## 0. Decisions at a glance

1. **The verbs unlock one per level, in the user's order**, each through a wordless in-world GET:
   - I: double jump. The first falling star lands softly in Diana's leaves.
   - II: cape flight. The asteroid's gift.
   - III: the held-cape glide ("float"). The mysterious helper.
   - IV: the dive. The necklace wakes.

   After those come cracked stone (V), solar wind (VI), the beat cascade (VII) and the super jump (VIII). Diana has **no cape in level I** and uses the original no-cape clips. A replay keeps that level's own verb set.
2. **The cape gets its charge bar back, in a fairer form ("breath").**
   - It holds one flight. A flight empties it.
   - It refills by **running on stable stone for one bar (4 beats, 605.6 px)**. That is 2.55 s of real time in II and 1.88 s in VIII.
   - Each loose star adds +1/8. A beacon, a completed constellation or a Great Star fills it at once.
   - The glide is free and never drains the bar. Cracks and wind do not refill it.
   - Respawn is always full. A flight that the wind cuts short within 0.15 s gets its charge back.
   - It is shown with the original HUD art (the bar frame and fill, with a disc that becomes the asteroid stone when full) and in four steps on Diana's cape.
3. **Eight levels, one per stop on the GDD's journey**: Home, then toward Pluto, Neptune, Uranus, Saturn, Jupiter, Mars, and the Moon to Earth.
   - BPM steps 88 → 94 → 100 → 107 → 112 → 118 → 123 → 128.
   - Levels last 47–56 s each, about 6.7 minutes in all.
   - Each level introduces exactly one new thing and has its own backdrop body.
   - No set piece appears in two levels.
4. **Level I is rebuilt around the GDD's opening night.** Diana:
   - wakes and climbs to her planet's highest point;
   - sees the star shower (stars that land on the beat ahead of her);
   - takes a low or high route, jump-only;
   - meets the lock-then-key star cluster and the GET;
   - sees the brightest star and hears the asteroid crash.

   I drops from 65 s to 52 s, and no stretch runs longer than 2 bars without an input or an event.
5. **Difficulty and music follow measured ladders.** The narrowest timing window, inputs per bar, beacon gaps, late-press rescue, sloppy-player deaths, onset density and mistake detune each move one way only from I to VIII, and each is tested.
6. **The parallel squad's items** have short specs in §6:
   - a result card without Title;
   - a pause card with a Main menu option;
   - an opaque title select for eight levels;
   - the emergence;
   - breathy jump and landing sounds.

## 1. What the sources say

**The GDD** (`Solarum Design Document.pdf`, v0.4, 2021-05-09):
- **§4–5 Story.** Diana lives alone on a tiny celestial body. She comes out of the soil where she hides to look at the stars, and runs to the highest point of her planet when they start to fall. Some stars land softly on it. One star lights the whole sky, and a big asteroid crashes. It opens its eyes and shows her colours: beings like her on a blue ball. It gives her a magic cape that will take her there if she gathers the falling stars.
- **§6.2–6.3 Structure.** Each level is the journey from one planet to the next. Its phases carry the start planet's theme, then the destination's. The planets are Pluto, Neptune, Uranus, Saturn, Jupiter, Mars, the Moon and Earth, each with traits (for example, Pluto is "rock, ice, empty, dark, dwarf").
- **§7.2–7.3 Characters.** A mysterious helper provides her a path. A magic necklace, the artifact from the asteroid that projected the vision, shows the path she must follow.
- **§8 Art.** Black and white, with small exceptions that reinforce the story.
- **§11 Mechanics.** Run, jump, double jump, forward flight (a straight line unaffected by gravity, "once every 7 seconds"), dive (a somersault downward) and super jump (flight plus jump).
- **§12 Controls.** ↑/W, →/D, ↓/S.
- **§13 Sound.** 88 BPM, calm, spacey.

**The original Unity code** (`refs/solarum/solarum-master.zip`, `Assets/Scripts`) shows what the shipped game did:
- **Gated verbs.** `Tutorial.cs` starts with `maxJumps = 1` and `canDash = false`, and gives the double jump after the first jump.
- **No cape at first.** `GameManager.NextLevel` sets `hasCape = true` only from level 2 on, and Diana uses the no-cape animator override before that.
- **Text tutorials in a fixed order.** The level-start texts are, in sequence: jump and double jump (1); D flight that "takes a few seconds to charge" (2); dive (3); super jump (5); dive after a super jump (6).
- **Two HUD meters.** `HUD.cs` fills `BarFill` (`barrinha.png` + `recheioBarra.png`) over `dashCooldown = 6` s after a flight. A radial `Meteor` (`meteoroCheio.png`) shows a per-level star quota (`starsRequired = {3, 4, 3, 6, 8, 10, 7, 9, 20, 0}`), and the portal sends Diana back if she is short.
- **Ten scenes.** The game has `Level_01` to `Level_10` after a tutorial `Level_00`.

So the user remembers correctly: the original gated its verbs and had a charging bar, though it taught everything with text. This brief keeps the gating and the bar but teaches through level design. It also drops the star quota, because stars still never gate the door.

**The trailer** (≈91–99 s) shows:
- the emergence;
- the HUD at top-left: a disc plus a bar that empties after a flight and refills;
- the asteroid-belt rocks and a big pale planet edge, which reappear on GDD p. 9.

**Playtest critic, 2026-11-10** (40+ real-key Playwright runs with 0–100 ms timing noise, on the current four levels):
- **Windows and density.** Windows do not tighten: the narrowest are 380 / 290 / 320 / 300 ms. Inputs per bar are 0.88 / 1.33 / 1.52 / 1.44, so IV is less dense than III.
- **Deaths.** Deaths for a σ = 100 ms bot rise from about 1 (II) to 5–7 (III) and 5–9 (IV). There are 0 deaths at σ ≤ 70 ms.
- **Length and repetition.** I is long and sparse (65 s, 23 inputs). IV is mostly remix. Story lines repeat across levels.
- **Too much in II.** II introduces four verbs at once.
- **No visual identity.** All four levels look identical.
- **Music.**
  - III and IV do not differ: onsets per second are I 1.4, II 4.6, III 7.5, IV 6.6.
  - Mistakes are inaudible except falls: a broken constellation detunes about 7.9 ¢ for about 2 bars, and a late note about 1.6 ¢.
  - I's songs need about 650 ms holds, while natural holds last 260–500 ms.
  - "Hold to float" is taught only after 3 falls.
- **Feel.** Late presses are always rescued by the air jump. D pressed just before a column fires a level flight. One lip-sink case remains.

The implementation squad fixes the feel, lip and buffer items. This brief sets the targets behind the rest.

## 2. Unlock progression

### 2.1 Order and fiction

| Verb | Level | GET (in world, no text) | What changes on screen | Lock shown in the level before |
| --- | --- | --- | --- | --- |
| Double jump | I, bar 8 | The first star that lands softly (GDD §5) slows, circles and settles on the run line. Diana runs through it, and it rises to float as a tiny glint just above her head | The glint: one small original star sprite above Diana's head, lagging her body by 60 ms. It shows while the double jump is in hand, bursts into the existing spark when she spends it, and returns on landing. This also clears the audit's E2 WARN (no lasting double-jump cue) | A four-star cluster at double-jump height in I's jump-only half, out of reach (bar 7) |
| Cape flight + bar | II, bars 1–2 | II opens at the crater. The asteroid opens its eye, and a small blue world shows in the pupil (the first sight of the only colour). The cape settles on Diana | Switch from the no-cape clips to the cape clips. The bar appears top-left, empty, and fills over the first bar of running. The touch cape button fades in with one pulse | From I's door, the dark void beyond the crater rim, never crossed |
| Glide ("float") | III, bar 2½ | The mysterious helper (GDD §7.2), a small wandering light built from the existing star and tail-star sprites, drifts slowly down a long slope of air at a cliff's lip. Diana runs through it, and her cape ripples for one bar | From now on, holding D keeps the cape open after a flight, or at once when the bar is not full | In II, a gently descending star line below a ledge that a flight cannot follow (it drops too fast) |
| Dive | IV, bar 2½ | The necklace (GDD §7.3), the asteroid's eye-stone she has carried since II, wakes. A ring of light pulses from her chest, and light glints out of the stone ahead | ↓/S works, and the touch dive button fades in. Lids show their star-shaped glint, which is what the necklace "shows" | In III, a glinting lid on the main line that she runs across but cannot open |
| Super jump | VIII, bar 1 | Under the Moon's light pull, Earth's crescent rises blue at the right. The helper flies ahead and leaps up out of a flight. Diana passes through its trail | A jump during a flight becomes the super jump | In VII, a high ledge with a star that a double jump plus a flight cannot reach |

Before VIII, a jump pressed during a flight ends the flight and is a double jump (if one is left), so the input always does something readable. **Rejected:** letting the super jump exist from II on as a hidden combination, as RESEARCH_LEVELS §2 allowed. The user explicitly dislikes moves that appear "magically". It also lets Great Star lines in II–VII be cheesed.

Environment mechanics have no GET. The world introduces them, and the helper demonstrates the first solar-wind column in VI by riding it ahead of Diana.

### 2.2 The GET pattern (every verb)

The pattern combines four ideas:
- **Miyamoto and Tezuka on World 1-1.** The level contains what players need to "gradually and naturally understand what they're doing". The mushroom bounces off a pipe back toward Mario, some pits have floors you can jump out of, and rising pipe heights teach the held jump ([World 1-1](https://en.wikipedia.org/wiki/World_1-1), citing Eurogamer 2015; [Game Developer](https://www.gamedeveloper.com/design/how-miyamoto-built-i-super-mario-bros-i-legendary-world-1-1)).
- **Hayashida's four steps**, introduce → develop → twist → conclude ([Game Developer](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design); Mark Brown, [GMTK on 3D World](https://www.nintendolife.com/news/2015/03/video_nintendos_four_step_stage_design_is_why_you_love_super_mario_games_so_much)).
- **Celeste's Prologue**, where the bird gives the dash exactly where the bridge collapses ([Celeste wiki](https://celestegame.fandom.com/wiki/List_of_characters)), and its chapters, which each add one mechanic ([Wikipedia](https://en.wikipedia.org/wiki/Celeste_(video_game)); [GDC 2017 workshop](https://gdcvault.com/play/1024307/Level-Design-Workshop-Designing-Celeste)).
- **Ori's ancestral trees**, each granting one skill that the next stretch needs ([SDA knowledge base](https://kb.speeddemosarchive.com/Ori/Skills_and_Abilities)). **Bit.Trip Runner** starts Commander Video with only a jump that floats while held and adds slide, kick and spring later ([Giant Bomb](https://www.giantbomb.com/bittrip-runner/3030-29550/)). Solarum's level I is the same opening. **Dan Cook's skill atoms**: action → simulation → feedback → model, where a new atom needs its feedback before the stakes ([Lostgarden](https://lostgarden.com/2021/03/13/the-chemistry-of-game-design-2/)).

The six steps:

1. **Lock.** The level before shows something this verb will reach (the table above). It is always optional and harmless: the "lock seen before the key" of Mark Brown's Boss Keys analyses ([GMTK](https://en.wikipedia.org/wiki/Game_Maker%27s_Toolkit)).
2. **GET.**
   - It sits on the main run line at running height, so every route passes it.
   - It lasts at most one bar, and the game never stops.
   - The score marks it with a chord bloom and the Signal's answer on the next strong beat.
   - No required input falls within one bar before or after it.
3. **Safe first use, within 2 bars.**
   - A stretch where using the verb earns stars and not using it costs nothing: a floor below, or ground that continues (the floored pits of World 1-1).
   - The verb's glyph disc appears once.
   - Nothing is required here.
4. **Need.**
   - The first required use, after the safe use.
   - At most one bar after a beacon, so a miss replays in about 3 s.
   - Its glyph is shown, and its window is at least the level's median.
5. **Twist.** The verb's second meaning:
   - the double jump for height after distance;
   - a constellation refilling the cape in midair;
   - releasing the glide to land;
   - the dive through stone.
6. **Confident finish.** Two or three uses chained on the beat with no glyph. Then a calm stretch, a constellation that completes the level's song, and the door.

**Text.** There is no text tutorial. The glyph discs stay as minimal hints for the first required use only. The tips shown after three falls stay as a last resort and are never the first teacher. The GET itself is wordless, and the beacon after it carries the story line.

### 2.3 Before and after a verb is owned

- **Input.** Before its GET, a verb's key does nothing, makes no sound and emits no event. Before I's GET, a jump pressed in the air after coyote does nothing (there is no air jump yet). That is the crisp, honest version of a late press, and the jump-only gaps are sized for it.
- **Character.** Diana wears no cape in I (the no-cape clips: run, jump, air, landings, start, stop, idle and drop-roll). The leaf glint is absent before I's GET.
- **HUD.**
  - The bar is not drawn at all before II's GET. It is absent, not empty.
  - The star count and the three Great Star slots are always there.
  - On touch, the cape and dive buttons are absent until owned, then fade in with one pulse at the GET.
- **Glyphs and title.**
  - A glyph for an unowned verb never appears.
  - The title's control legend lists only the verbs owned by the furthest level reached. On a first launch that is "↑ jump".
  - Each completed level's card shows the glyph of the verb it taught.
- **Assists.** Endless cape appears in the assist page only in levels that own the cape.
- **Naming.** I's held-jump apex hang is renamed **hang** in docs, tips and tests. "Float" now means only the held-cape glide.

### 2.4 Replays

**Decision:** replaying level n gives exactly level n's verb set. That is the verbs granted before n, plus n's own GET at its authored place, which replays in full and is at most a bar long. Everything unlocked later is ignored.

Why:
- Every level is solved for its verbs. With a glide, I's Great Star lines and gaps trivialise.
- The baked song belongs to the authored verbs.
- Each level is a chapter of one journey, as in Celeste's chapters.

**Rejected:** Metroid-style carry-forward. Solarum has no backtracking, so carried verbs open nothing; they only erase the level's lesson.

### 2.5 Data shape (for the model squad)

- **`def.verbs`** lists the verbs owned at the level's start: `{ double, cape, glide, dive, super }`.
- **`def.gets`** is `[{ id, verb, x }]`. A GET fires when `player.x ≥ x` and emits `get { verb }`.
- **Checkpoints** record the owned verbs, so a respawn before a GET does not own it.
- **`maxJumps`** is `verbs.double ? 2 : 1`, the original's own mechanism.
- **The super jump** in `jump()` requires `verbs.super`.
- **`getState()`** adds `verbs`, `gets`, `capeCharge` (0–1) and `capeFull`. The legacy `capeCharges` stays as `capeFull ? 1 : 0`, so the root QA keeps working.

## 3. The cape charge bar

### 3.1 Evaluation

Revision four removed the 6 s timer, arguing that "an autorunner can't wait out a timer". It replaced it with one flight per airtime, refilled on stable ground ([RESEARCH M1](./RESEARCH.md)). The user now says the infinite cape makes the game too easy. Under `capeRule = 'landing'`, every airtime that starts on stable stone has a full cape by construction, so the cape answers every gap and there is no resource decision at all. The options:

| Option | Fairness | Beat grid | Readability | Expression | Difficulty | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Keep landing refill | Trivially fair | Fine | Cape tint only | None: always available | The user's complaint | Rejected |
| GDD 7 s timer, refilling always (also in the air) | History-dependent and invisible in the world. An optional flight 4 s earlier silently dooms a required one | 7 s is 3.12 bars at 107 and no whole number of bars anywhere, so refills land off the grid | A bar, but the world gives no cue | Little | Hard to author: required flights need 7 s of spacing everywhere | Rejected |
| Stars only (each flight costs N stars, like the original meteor) | Loose stars become required, which breaks "stars never gate". Missing a star line dooms the flight | Fine | Good | High | High, and punishing | Rejected |
| **Breath:** stable stone refills over one bar; constellations, beacons and Great Stars refill at once; loose stars add a little | Plannable: the runway is visible geometry, and the refill sources are authored | One bar of the music is one breath | The bar plus the cape, which brightens in four steps | Spend now or keep it; optional stars charge sooner | Flights become events. Crack and wind levels starve the bar | **Chosen** |

Breath is the original's charging bar made readable. The world shows it: a long stone means a full cape, short hops and cracks mean an empty one. It keeps revision four's "the gift breathes when Diana touches the ground", and it puts the GDD's star promise in the constellations. Celeste works the same way: the dash refills on the ground or from a green crystal in midair ([Celeste & Forgiveness](https://maddymakesgames.com/articles/celeste_and_forgiveness/index.html)). Here the constellation is the crystal.

### 3.2 The rules

| Rule | Value |
| --- | --- |
| Capacity | 1 flight (`capeCharge` 0–1). A flight needs a full bar and sets it to 0 |
| Breath | +1/4 per beat while grounded on stable stone: any platform that is not crumble, lid or cascade, optional stable stone included. A full bar takes **4 beats = 605.6 px of running** in every level. It accumulates across islands and pauses (never resets) in the air, on cracks and in wind |
| Real time for a full breath | II 2.55 s · III 2.40 · IV 2.24 · V 2.14 · VI 2.03 · VII 1.95 · VIII 1.88 |
| Loose star | +1/8 (half a beat of breath). Never required (§3.5) |
| Instant full | A completed constellation, a beacon, taking a Great Star, a respawn (fall or Back to last light), the Star net return |
| Glide | Free. It never drains the bar and works at any charge. With a full bar, pressing D flies first and holding D past the flight's end glides; with a partial bar, D glides at once. The cape always flies if it can, and always floats |
| Super jump (VIII) | Free, because the flight already paid. Once per flight, as now |
| Solar wind (VI on) | No breath in a column. D in wind glides (no flight, as now). A flight that enters a column ends, as now. **Refund:** if it entered within 0.15 s real of the press (the critic's "D just before the column" case), the charge returns in full |
| Cracks | Never breathe (they pause the bar, as they never refilled before) |
| Endless cape (assist) | The bar is always full, the disc always shows the asteroid stone, and flights are unlimited |
| Physics constants | `RULES.capeRule = 'breath'` with `capeBreathBeats: 4`, `starCharge: 1/8`, `windRefund: 0.15` (real; × clock in sim). `'landing'` and `'cooldown'` stay for comparison tests |
| Events | `refill { source: ground \| star \| constellation \| beacon \| great \| net \| assist }` only when the bar becomes full, plus `wind-refund` |

**Rejected:** a capacity of two flights. It would let Diana chain two flights over any void without a constellation, which is the "too easy" problem again.

**Rejected:** quarter steps synchronised to beat boundaries. The worst case would depend on where Diana lands relative to a beat. Breath is continuous in simulation time, which is already on the grid, and only the display shows quarters.

### 3.3 Display

- **HUD (top-left, where the original had it).** The original `DianaCooldownCircle.png` disc sits at the left end of the hand-drawn `barrinha.png` frame (about 100 × 22 logical px). `recheioBarra.png` fills the frame's inner rectangle, clipped to `capeCharge`, with three ink notch ticks at the quarters. When the bar is full, the disc becomes `meteoroCheio.png` (the cracked asteroid stone, meaning "the gift is ready") with one ring pulse. The star count and Great Star slots move right to make room. The bar is drawn only once the cape is owned. All three files are extracted by `scripts/extract-assets.py`, and `manifest.json → usage` records that the original star-quota meaning of the meteor is not used.
- **On Diana.** The existing spent-cape tint becomes four steps: 60% dim at 0, then 45%, 30% and 15%, and clear at full. The existing star burst at the cape's tip and the `refill` cue (the A6 glint) mark full. Quarter steps make no sound.
- **Touch.** The cape button's rim fills as a paper arc with the charge and lights when full.

### 3.4 Authoring rules for flights

Every required flight needs a **charge source** that no surviving play can bypass. Use one of three patterns:
- **(a) Beacon.** The flight's beacon comes at most one bar before it, with no airtime in between.
- **(b) Constellation.** A required constellation completes on the flight's own line before the press (II's long void, V's split voids).
- **(c) Exact runway.** The previous flight lands so that mandatory stable contact refills the bar only on the takeoff island, so no earlier optional spend is possible.

Mastery lines that spend the cape must rejoin before a source.

Required flights stay sparse in II: at most one flight per two bars outside the long void. They get denser only when constellations carry them (VII, VIII).

### 3.5 Invariants (each becomes a test)

| # | Invariant |
| --- | --- |
| C1 | On the main route, and under every press shifted across its window (the audit's `timingWindow()` sweep, so the latest valid route is included), the bar is full at every required flight press, in every level and at 30/60/120/240 Hz |
| C2 | **No doomed approach.** The main route is run with an extra optional flight injected at every airtime moment (each sixteenth) where the bar is full, then continues with the main presses. Every run that survives to a required flight has a full bar there. The upper, ability and safe routes satisfy C1 too |
| C3 | Every respawn (fall, Back to last light, Star net) restores a full bar; Restart level starts at 0 in II (the GET fills it) and full in III–VIII |
| C4 | Loose stars never gate: with every non-constellation star removed, every level's main route still wins |
| C5 | Model unit tests: no breath while airborne, on crumble/lid/cascade or in wind; 4 beats of stable contact fill exactly; +1/8 per loose star; a refund within 0.15 s; a glide never changes the charge |
| C6 | The charge at every event is bit-identical at 30/60/120/240 Hz and under 0–100 ms hitches |
| C7 | Browser: the HUD fill width matches `capeCharge` within 1 px; the bar is absent in I and before II's GET; the disc switches when full; the touch rim matches |

## 4. Eight levels

### 4.1 Why eight

Eight matches the GDD's journey. Level I is home, and levels II–VIII are each named for the body Diana is crossing toward. Earth is never a level; it is the last door, as now. It also matches the original's scale of ten scenes.

Eight is also the smallest number that gives each of the eight new things (four verbs, then cracks, wind, the cascade and the super jump) its own level. That is exactly the critic's fix for II's four-verbs-at-once.

**Rejected: six levels** (glide with wind, cracks with the cascade). That would again introduce two things per level.

**Rejected: nine or ten**, one per GDD body including a crossing from Mars to the Moon. The extra levels would be remixes, which the critic has just flagged.

Each level follows GDD §6.2 in its backdrop: the body it left recedes off the left in the first two bars, and the body ahead grows from 0.5× to 1× of its size across the level.

| # | Name | Toward | BPM | Clock | Run (px/s) | Bar (s) | Bars | Length (s) | The one new thing |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| I | Waking | Home (the asteroid) | 88 | 0.822 | 222 | 2.73 | 19 | 51.8 | Double jump (GET) |
| II | The Gift | Pluto | 94 | 0.879 | 237 | 2.55 | 20 | 51.1 | Cape flight and its bar (GET) |
| III | Still Water | Neptune | 100 | 0.935 | 252 | 2.40 | 20 | 48.0 | Glide: hold the cape to float (GET) |
| IV | The Way Down | Uranus | 107 | 1.000 | 270 | 2.24 | 21 | 47.1 | Dive, and the glinting lids it breaks (GET) |
| V | The Breaking Constellation | Saturn | 112 | 1.047 | 283 | 2.14 | 22 | 47.1 | Cracked stone (breaks 5/16 after touch-down; never breathes the cape) |
| VI | Borrowed Wind | Jupiter | 118 | 1.103 | 298 | 2.03 | 24 | 48.8 | Solar wind |
| VII | The Falling Road | Mars | 123 | 1.150 | 310 | 1.95 | 25 | 48.8 | The beat cascade |
| VIII | The Far Door | The Moon, then Earth | 128 | 1.196 | 323 | 1.88 | 30 | 56.3 | Super jump (GET), then everything |

The campaign is about 399 s (6.7 min) on the main routes, against 3.5 min today.

**Tempo steps.** They run from 4.1% to 7.0%, above the roughly 3% tempo JND for multi-interval sequences ([Drake & Botte 1993](https://link.springer.com/article/10.3758/BF03205262)). Each level is a little faster, and the density ladder (§4.2) carries the rest.

**88 BPM for I.** This is the GDD's tempo and it widens the arc from I to VIII to +45%.

**I's physics.** I keeps its own physics and re-solves its cells at 88. Tune real gravity and jump speed so a held jump on flat ground lands exactly **6/16** later (1.02 s real), with an apex height of 115–125 px. The hang is limited to 0.12 s extra, which clears B8. The apex time comes down from 0.539 s toward 0.50 s, narrowing B5.

**II–VIII physics.** They share today's simulation physics (II–IV's 1500 / 570 / 525 in sim units), so every cell from LEVEL_DESIGN is the same in px and sixteenths. In real units, II's apex is 0.427 s and VIII's 0.313 s.

**Great Stars.** There are 24 (three per level). Each paints 1/24 of Earth inside the last door.

### 4.2 Difficulty ladder (tested; real units, main route unless stated)

| | I | II | III | IV | V | VI | VII | VIII |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Narrowest required window (`timingWindow`) | ≥ 400 ms | 320–420 | 280–370 | 250–330 | 220–290 | 190–260 | 160–230 | 120–200 |
| Median required window | ≥ 500 ms | ≥ 450 | ≥ 410 | ≥ 370 | ≥ 330 | ≥ 300 | ≥ 270 | ≥ 240 |
| Inputs per bar, average | 1.1–1.5 | 1.3–1.7 | 1.5–1.9 | 1.7–2.1 | 1.9–2.4 | 2.2–2.7 | 2.5–3.0 | 2.8–3.5 |
| Peak inputs in one bar | 2 | 3 | 3 | 4 | 4 | 5 | 5 | 6 |
| Shortest gap between different verbs | — | 4/16 | 4/16 | 3/16 | 3/16 | 3/16 | 2/16 | 2/16 |
| Largest beacon gap | 14 s | 13 | 12.5 | 12 | 11.5 | 11 | 10 | 9.5 |
| Late-press rescue (required ground jumps that survive when pressed 60–200 ms after coyote, `lateRecovery()`) | ≤ 85% after the GET; 0% before it | ≤ 75% | ≤ 70% | ≤ 60% | ≤ 55% | ≤ 50% | ≤ 40% | ≤ 35% |
| Sloppy bot σ = 100 ms, mean deaths per run (20 seeds) | ≤ 0.5 | ≤ 1.5 | ≤ 2.5 | ≤ 3.5 | ≤ 4.5 | ≤ 5.5 | ≤ 7 | ≤ 9 |
| Bot σ = 40 ms, deaths | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Telegraph lead 1.5 s, in px | 333 | 356 | 378 | 405 | 424 | 447 | 466 | 485 |
| Min logical width, landscape / portrait | 880 / 720 | 880 / 720 | 880 / 720 | 880 / 720 | 920 / 740 | 970 / 775 | 1010 / 810 | 1050 / 840 |

**Monotonicity is part of the test.** The narrowest and median windows never rise from one level to the next. Average inputs per bar, the sloppy-bot deaths and the BPM never fall.

**Lowering late-press rescue.** Lower it with geometry, never by removing the air jump. In V–VIII, at least one in three required ground jumps is followed by a required double jump in the same airtime, so a late jump that the game turns into the double fails the cell. Short landings help too. This answers the critic's "always rescued" while keeping the double jump's purpose as a recovery (rubric D3) in the early levels.

### 4.3 Music ladder

Each level has its own score preset and baked path. RESEARCH_MUSIC's principles hold:
- the main route draws the song;
- the bed detunes and Diana's voice never does;
- G♯ is reserved for Great Stars and Earth.

Every mode below uses only D major's notes; F♯ major's A♯ appears in pads only, as today.

| | Harmony | Groove | Feeling | Onsets/s, perfect run | Space reverb | Bed detune after a fall | After a broken constellation (≥ 2 bars) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| I | Today's I preset at 88: the cycle at half harmonic rhythm, maj7/add9 | None; a breath swell on each downbeat | Floaty, calm | 1.2–2.0 | 5.5 s | 12 ¢ | 10 ¢ |
| II | Bm7 · Gmaj7 · Dadd9 · A6 | Felt heartbeat on 1 and 3, a soft tick on 2 and 4 | Calm, marked beats | 2.4–3.2 | 5.5 | 14 | 11 |
| III | G Lydian: Gmaj7♯11 · A/G · F♯m7 · Em9 | Brushed eighths at −30 dB; the glide whistle carries long descending lines | Floating, flowing | 3.2–4.0 | 5.0 | 15 | 12 |
| IV | The soundtrack's own cycle Bm · F♯m D · F♯m D · G (today's II preset) | Heartbeat, ticks, shaker sixteenths | The song at home, at its own tempo | 4.2–5.0 | 4.5 | 16 | 13 |
| V | E Dorian call and response (today's III preset), turning to Bm7 G A F♯m at the split voids | Half-time backbeat, tresillo rim, marimba calls | Nocturne: the cracks call and Diana answers | 5.0–6.0 | 3.5 | 18 | 14 |
| VI | A Mixolydian: A · G/A · D/A · Em7/A | Driving 3+3+2 shaker; the wind sings rising runs | Storm-bright | 6.0–7.0 | 3.5 | 20 | 15 |
| VII | B Aeolian: Bm · G · A · F♯m | A stone-marimba eighth ostinato stepping down the chord on each tile; full backbeat | Tense; the falling road is the drum | 7.0–8.0 | 3.0 | 22 | 16 |
| VIII | B Aeolian over an F♯ pedal (today's IV preset) | Kick on every beat, eighth-note bass ostinato, sixteenth ticks | Tense but fair; the densest and brightest | 8.2–9.5 | 2.5 | 24 | 17 |

**Brightness.** Each level's spectral centroid on its perfect run is at least the previous level's, and its onset rate at least 10% higher. These are measured from offline renders of the perfect run.

**VIII's door.** The tempo exhales from 128 to 107 into the original recording. With all of the campaign's Great Stars, the Earth chord sounds.

**Making mistakes audible.**
- **Why the old values were inaudible.** Interval mistuning reads as "out of tune" only around 20–30 ¢ (Vos 1982, as summarised in [this review](https://labs.sonicfield.org/library/perception-of-musical-interval-tuning)). Smaller offsets are heard as the beating of Diana's in-tune notes against the flat bed. That is why the critic's 7.9 ¢ and 1.6 ¢ were inaudible.
- **Falls.** Falls keep the tape-stop and use the column above, within the global 25 ¢ cap.
- **Broken constellations.** These also keep the sigh (the last note 50 ¢ down) and the sus4 pad, and the choir is withheld until the next completion or beacon.
- **Late notes.** Late notes (> 70 ms) no longer move H on their own. Instead, three late notes within four bars count as one small error, the same as a broken constellation.
- **Gentle music** still never detunes.

The UI and audio squad fixes the silent transitions: the door bloom under the victory card, the map and the cold level starts.

### 4.4 Visual identity per level

**Rules.**
- Use only the palette tokens. `--earth` blue is for Earth alone.
- Grey (`--hill`, `--mute`) never fills a walkable top: grey still means "breaking now".
- A dotted rim still means optional stone, so no level uses dotted rims as decoration.
- The backdrop body and sky motif stay at or below `--mute` brightness over the playfield, so islands, stars, glyphs and Diana stay the brightest things.
- Motifs never enter the 56 px HUD band.
- Under reduced motion, all motion (wobble, drift, flashes) becomes static or a fade.
- Island marks are drawn in code in the existing line language.

| | Body ahead | Sky motif | Island marks | Particles |
| --- | --- | --- | --- | --- |
| I Home | The bright star, then the asteroid's dust plume beyond the door | The original title ground's hills at the start; the shower's streaks (`cadent1/2`), all heading right | The existing ticks; the home curve at the horizon | Landed stars |
| II Pluto | A dark dwarf disc hatched ink on ink, with its bright heart-shaped plain as the only paper shape | Half the star density: empty and dark | Hairline frost cracks | None: emptiness is the motif |
| III Neptune | A large disc with slow horizontal wave lines and one dark ink oval | Far stars wobble gently (0.3 Hz), as if seen through water | Wave lines on undersides | Slow rising rings (tiny circles) |
| IV Uranus | A pale disc tipped on its side, with vertical ring ellipses | Slow vertical ice streaks falling | Vertical striations on silhouettes | Ice flecks drifting down |
| V Saturn | `saturn.png` (the existing rings), low and wide | Ring-dust bands across the sky | Small ice nubs under the silhouettes | Ring flecks drifting sideways |
| VI Jupiter | A huge banded disc filling a third of the sky, with a hatched storm oval | Band streaks; wind columns drawn as banded vapour | Layered strata on silhouettes | Streaming wind lines |
| VII Mars | A medium disc in dense cross-hatch (the darkest hatch stands for "red"), with dust-storm streaks | The asteroid belt's rocks tumbling in the mid-ground | Dense hatching on undersides | Dust streaks |
| VIII Moon to Earth | The Moon's cratered limb below; Earth's crescent in `--earth`, growing toward the door | The most stars of any level; the Earth glint | Crater rims on tops | — |

### 4.5 The levels

All levels share these rules:
- bars are 1-based;
- beacons sit on half bars;
- every level ends at the original portal on a downbeat;
- each beacon has one **unique** story line (tested across the campaign);
- every level has three Great Stars, each visible from the route and never gating.

The levels also share the §7 constraints. Story lines below are seeds, and the writer keeps them unique.

#### I · Waking — Home — 88 BPM — double jump

| Bars | Step | Content |
| --- | --- | --- |
| 1–2 | Introduce (jump) | The emergence (§6). A tap-height row of three stars and a hang-height row of three. The first ↑ glyph |
| 3–4 | Develop | **To the highest point:** three held jumps up 60–90 px each. The last is too high for a tap, so the held jump is taught before it is ever required, as rising pipe heights do in World 1-1. At the summit, the lookout, the shower begins: streaks start crossing the sky, all heading right |
| 4½ | Beacon *lookout* | "From the highest point, every star was going the same way." |
| 5–6½ | Develop II | **The shower set piece:** 8–12 falling stars land on the beat on the islands ahead. Each lands at least 2.2 s ahead and in view, and catching it plays the next note of *shower-song*. **A low/high split:** a lower floor at most 120 px down (plain running) and an upper tier of three islets taken with held jumps (stars, and **GS1** on the last islet for a perfect hang jump). Both rejoin |
| 6½–7½ | Develop III | Stepping stones (from today's I: tap islets, a wide hold gap). **Lock:** a four-star cluster at double-jump height over the last stone, out of reach |
| 7½ | Beacon *stones* | |
| 8 | **GET** | The first star that lands softly settles on the run line, and the leaf glint appears |
| 8–9½ | Safe first use | A long flat island under the same four-star cluster shape at double height. ↑ ↑ glyph. The ground continues, so a miss costs nothing |
| 10 | Need | The leap (about 380 px, a late double; today's idea, re-solved) |
| 10½–12 | Twist | The climb: the double jump for height (about 177 px). **GS2** sits above it for an early second press. Then the drop |
| 12 | Beacon *climb* | |
| 12½–14½ | Develop | The double staircase (up about 72 px twice). The high crown, and the hang line ending in **GS3**, with a field at most 232 px below |
| 15 | Set piece | **The brightest star:** a paper flash across the sky (120 ms; a 400 ms fade under reduced motion). The asteroid streaks across, the score falls to the sky pad for one beat, a felt boom lands on the downbeat of bar 16, and a dust plume rises far ahead and stays |
| 15½ | Beacon *crash* | "Something enormous had fallen, just ahead." |
| 16–18 | Confident finish | A run of three double-jump cells down toward the crater's rim, with no glyphs. *Home-song* on the last arcs |
| 19 | Coda | The door on the crater rim, on the downbeat of bar 20. Beyond it lies the asteroid (`meteoroCheio.png` scaled up, half buried, its rim glinting) and the dark void beyond (II's lock) |

**Beacons:** 4½, 7½, 12, 15½. The largest gap is 12.3 s.

**Music and songs.** I's constellations must complete with natural holds of 250, 350 and 500 ms (tested). Every required held jump comes after the bar 3–4 climb.

**Reuse.** I reuses today's I ideas, all re-solved at 88: the tap/hold rows, the stepping stones, the leap, the climb, the staircase, the crown and the hang line. Today's empty field coda is cut.

#### II · The Gift — toward Pluto — 94 BPM — cape flight and its bar

| Bars | Step | Content |
| --- | --- | --- |
| 1–2 | **GET** | The crater: the asteroid's eye, the blue in its pupil, the cape. Diana runs out of the crater on a long stable slope while the bar fills over exactly one bar, with one star burst at full |
| 2½–3½ | Safe first use | A short gap over a floor at most 100 px below. *flight-line* stars at flight height, and the ↑ · → glyph. A miss lands on the floor |
| 3½ | Beacon *gift* | "Gather the falling stars, and it will carry you there." |
| 4–6 | Need | The hearth void (today's II, 375 px, with *flight-line*), then the same void again without stars |
| 6½ | Beacon | |
| 7–8½ | **The breath lesson** | After a flight, a short landing and two hop gaps that look flight-sized but are double-jump-sized, while the bar is visibly not full: the double carries her. Then a long stable island where the bar fills, with a visible tick-tick-tick-full and a star burst, right before the next void |
| 8½ | Beacon | |
| 9–12 | Twist | The long void (today's II): jump, flight, *void-song* refills the bar in midair, flight, with nothing to land on. **GS2** sits above it for a double between the flights |
| 12½ | Beacon | |
| 13–18 | Conclude | **Pluto's steps** (new, windless): three flights in four bars across descending voids. The first is charged by a long stone, the second by a constellation after a short rock, and the last lands on Pluto's plain. A stable low safe line lies under the middle (jumps only). **GS1** is on a ledge reached by jump, double, then flight; **GS3** at the top of the last flight's constellation |
| 19–20 | Coda | **Glide lock:** a gently descending star line below the final ledge that a flight cannot follow. The door is on Pluto's heart plain |

**Beacons:** 3½, 6½, 8½, 12½, plus 16½ inside Pluto's steps. The largest gap is 11.5 s.

**Reuse:** the hearth void, the void again and the long void (today's II).

#### III · Still Water — toward Neptune — 100 BPM — glide

| Bars | Step | Content |
| --- | --- | --- |
| 1–2 | Warm-up | A flight over a small void off Pluto's plain |
| 2½ | **GET** | The helper at the cliff's lip. The cape ripples for one bar |
| 3–4 | Safe first use | The cliff drops at most 220 px onto a long low field. Holding D floats her down along a descending star line that only a glide reaches. Without D, she simply lands on the field. "hold →" glyph |
| 4½ | Beacon *float* | |
| 5–7 | Need | A void whose far shore is 120–180 px lower and beyond a flight's reach: jump, flight and keep holding. Releasing early falls short. "↑ · hold →" glyph |
| 7½ | Beacon | |
| 8–11 | Twist | **The cape floats even when it cannot fly:** right after a flight, with the bar empty and no runway, a high ledge's edge needs a pure glide down to a lower shore. **Letting go:** a long glide path passes over three small islets. Diana must release over the second, because from it a jump and a double reach the next shore, while gliding on sinks into a void too wide for a glide. Releasing on the beat lands on the grid. **GS2** is on a tiny high islet for an exact release |
| 11½ | Beacon | |
| 12–17 | Develop | **The water stair:** descending ledges joined by glide-and-release cells on the beat. A midair constellation refill, then flight plus glide over the widest void. **GS3** is on a high line reached by double, flight, then glide |
| 17½ | Beacon | |
| 18–20 | Conclude | Flight → glide → release → jump chained twice, no glyph. **Dive lock:** a glinting lid on the main line that Diana runs across and cannot open. The door is on Neptune's shelf. **GS1** is the longest float, held from the cliff top in bars 3–4 |

**Beacons:** 4½, 7½, 11½, plus 14½ inside the water stair, and 17½. The largest gap is 9.6 s.

**Reuse:** none, so III is all new. The glide is the melody: the glide whistle's altitude-snapped notes carry III's song.

#### IV · The Way Down — toward Uranus — 107 BPM — dive

| Bars | Step | Content |
| --- | --- | --- |
| 1–2 | Warm-up | Flight plus glide |
| 2½ | **GET** | The necklace wakes over a glinting stone |
| 3–4 | Safe first use | A high run over a stable floor 120–180 px below with a star row on the floor. ↓ drops her onto them. Staying high runs on and rejoins. ↓ glyph |
| 4½ | Beacon *down* | |
| 5–7 | Need | Today's currents, first part: a flight ends over a low islet and a dive at 7/16 lands on it on the beat. Without the dive she overshoots into the void |
| 7½ | Beacon | |
| 8–10 | Twist I | **The glint:** a lid holds a run, and a dive breaks it into a star cache (today's `lid-2` with *cache-song*). Optional, with **GS1** in the cache |
| 10½ | Beacon *broken* | |
| 11–14 | Twist II | The broken well (today's III): the forced dive through a long lid over a well deeper than a walk-off survives; out by jump, double and flight |
| 14½ | Beacon | |
| 15–20 | Conclude | **The way down** (new): descending fly-then-dive cells on the beat into Uranus's ring plane. A dive also cancels a glide here (an instant drop onto a near islet). Movement II's well lid is optional, with **GS2** under it. **GS3** comes from flight plus glide, then a precise dive onto a tiny high islet |
| 21 | Coda | The door |

**Beacons:** 4½, 7½, 10½, 14½, plus 18½ inside the way down. The largest gap is 9.0 s.

**Reuse:** currents (part 1, from II), `lid-2` and its cache (II), the broken well (III), Movement II's well lid (III).

#### V · The Breaking Constellation — toward Saturn — 112 BPM — cracked stone

| Bars | Step | Content |
| --- | --- | --- |
| 1–2 | Warm-up | A dive onto a low islet |
| 3–4 | Introduce | `first-crack` over `crack-floor` (today's III): the shelf breaks under her and the floor catches her |
| 4½ | Beacon *breaking* | "Some stars are too tired to hold her. She is light enough." |
| 5–7 | Need | `second-crack`: jump before it breaks |
| 7–10 | Develop | The ridge, with the cracked chain above it (**GS1**) |
| 10½ | Beacon | |
| 11–14 | Twist I | **Cracks and the bar:** the split voids (flight A, a cracked islet that never breathes, *split-song* required, flight B) |
| 14½ | Beacon | |
| 15–18 | Twist II | **Through the stone** (new): a breaking shelf over a lower stable line where the route continues. A dive through the crack lands on the beat, while waiting falls late and off the line. The cracked stair (**GS3**) |
| 19–21 | Conclude | The last crack, then the late double to the crown (today's III), with **GS2** for an early second press |
| 22 | Coda | The door under Saturn's rings |

**Beacons:** 4½, plus 7½ before the ridge, 10½, 14½, and 18½ before the crown. The largest gap is 9.6 s.

**Reuse:** cracks, the ridge and chain, the split voids, the crown and the cracked stair (all today's III, re-baked at 112).

#### VI · Borrowed Wind — toward Jupiter — 118 BPM — solar wind

| Bars | Step | Content |
| --- | --- | --- |
| 1–2 | Warm-up | Cracks |
| 2½–3 | Safe first use | The hearth breeze: a gentle breeze over solid stone, where holding the cape lifts her and nothing is at stake. The helper rides it ahead |
| 3–5 | Need | `first-wind` to `lifted-shore` (today's II): jump into the column and it lifts her across |
| 5½ | Beacon *wind* | |
| 6–9 | Develop | The glide bridge (today's II), **with its far shore moved 150–200 px earlier** to fix the audit's 0.35 s landing-lead WARN |
| 9½ | Beacon | |
| 10–13 | Twist | Today's currents, second part: a column carries her past the island below unless she dives out |
| 13½ | Beacon | |
| 14–23 | Conclude | Today's finale, with the cracked launch now that cracks exist, *finale-song*, *finale-wind* and the low safe line. **GS3** is at the top of the last wind. New cells give 4 bars of wind → dive → wind at 118. **GS1** is in a column reached only with the cape held; **GS2** on a ledge above the glide bridge |
| 24 | Coda | The door under Jupiter's storm |

**Beacons:** 2½ *breeze*, 5½, 9½, 13½, plus 17½ and 21½ inside the finale. The largest gap is 8.1 s.

**Reuse:** the breeze, `first-wind` and `lifted-shore`, the glide bridge, the currents' second part and the finale (all today's II).

#### VII · The Falling Road — toward Mars — 123 BPM — the beat cascade

| Bars | Step | Content |
| --- | --- | --- |
| 1–2 | Warm-up | A wind column |
| 3–5 | Safe first use | A three-tile cascade over a stable floor: a missed bounce lands on the floor |
| 5 | Beacon *road* | |
| 6–9 | Need | The six-tile cascade (today's III) at 123 (0.49 s per tile, real) |
| 9½ | Beacon | |
| 10–14 | Develop | **Cascade and dive** (new): a row where the next tile is lower. A dive keeps the rhythm, while a full arc overshoots it. **GS1** comes off the wave's end |
| 14½ | Beacon | |
| 15–20 | Twist | **The missing tile** (RESEARCH_LEVELS's unbuilt idea): one tile is gone and is crossed by a flight, which a long stable run before the cascade charges. Cracks lie under the landing. **GS2** is above the gap for a double before the flight |
| 20½ | Beacon | |
| 21–24 | Conclude | The last tile bounces into a wind column, then a glide out onto Mars's shore. **Super-jump lock:** a high ledge with a star out of reach. **GS3** is at the column's top |
| 25 | Coda | The door |

**Beacons:** 5, 9½, 14½, plus 17½ inside the missing-tile run, 20½, and 23½ before the door. The largest gap is 9.8 s.

**Reuse:** the six-tile cascade (today's III).

#### VIII · The Far Door — the Moon, then Earth — 128 BPM — super jump, then everything

| Bars | Step | Content |
| --- | --- | --- |
| 1–3 | **GET** and safe first use | Earth's crescent rises, and the helper leaps out of a flight ahead. Then today's IV super-jump school: taught over a floor, with **GS1** for a second super jump |
| 3½ | Beacon *pull* | |
| 4–6 | Need | The storm void (today's IV): the super jump across a void to a shore 233 px up |
| 6½ | Beacon | |
| 7–12 | Develop | New: super jump out of a wind column's top after a flight that ends before it, and super jump off a cascade's last tile |
| 12½ | Beacon | |
| 13–20 | Twist | New: **the gauntlet at 128**. A cracked launch, flight and super jump; two refills in one airtime (a constellation and a 100 px stable rock); land-and-go bounces; a stable low line under each hard stretch. **GS2** is high |
| 20½ | Beacon | |
| 21–27 | Conclude | The rising stair (today's IV: two doubles up 135 px each along *stair-song*), then a super jump to the high finish. **GS3** is above, reached by flight plus super jump |
| 27½ | Beacon | |
| 28–30 | Coda | The far door, Earth, and the original recording |

**Beacons:** 3½, 6½, plus 9½, 12½, plus 16½ inside the gauntlet, 20½, plus 24 on the stair, and 27½. The largest gap is 7.5 s.

**Reuse:** the super-jump school, the storm void and the rising stair (today's IV).

### 4.6 What moves where (each piece used once)

| Today | Goes to |
| --- | --- |
| I: rows, hops, stepping stones, leap, climb, staircase, crown, hang line | I (re-solved at 88). The field coda is cut |
| II: hearth void, void again, long void | II |
| II: currents (part 1), `lid-2` and its star cache | IV |
| II: breeze, `first-wind` and `lifted-shore`, glide bridge, currents (part 2), finale | VI |
| III: cracks and floor, ridge and chain, split voids, last crack and crown, cracked stair | V |
| III: broken well, Movement II's well lid | IV |
| III: six-tile cascade | VII |
| IV: super-jump school, storm void, rising stair | VIII |
| IV: the well and cascade at 128, the voids at 128, the cracked finale (all remixes) | Dropped |

**No remix (tested).** No two levels share three or more consecutive main-route platforms with the same (Δx, Δy, width, type) sequence. A mechanic may return in a later level only in a new combination.

**New geometry** needed is about 115 of the campaign's 181 bars: I 19, II 13, III 20, IV 12, V 4, VI 6, VII 21, VIII 20. The other 66 bars are reused, re-baked sections.

### 4.7 Build order

Each step lands as small green commits, and `main` always holds a complete, playable campaign. The station map lists only the levels that are built.

1. **Model.**
   - Verb gating and GETs, with checkpoint-aware verbs.
   - `capeRule = 'breath'` set per level (`def.capeRule`), so today's levels keep `'landing'` until they are migrated.
   - The C1–C7 and U1–U8 tests (§8).
   - The leaf glint.
   - The HUD bar art (extraction and manifest usage).
2. **Milestone A: I–VI.**
   - Build I (the full rebuild), II and III, then IV, V and VI. V and VI are mostly re-baked sections.
   - The save is migrated: today's unlocked count maps to the same numeral, and the best Great Stars reset because the layouts changed.
   - The super jump is absent until B.
3. **Milestone B: VII and VIII,** then the music and visual ladders measured across all eight, and the campaign's Earth in 24ths.

The squad stops after milestone A for a playtest critic round before B.

## 5. Level I: the spice, exactly

The user said I is too vanilla, and the critic said it is long and sparse. I stays floaty, calm and basics-only (jump, then double jump). These are the changes:

1. **A destination from the first second.** Diana wakes and climbs three held hops to her planet's highest point, as in GDD §5. The level's main route spans at least 250 px between its highest landing (the lookout) and its lowest (the crater rim), against today's mostly level line.
2. **The reveal.** At the lookout, the star shower begins over her, and every streak heads toward the signal.
3. **The shower as play.** Falling stars land on the beat ahead of her, and each catch is the next note of *shower-song*. The world moves even when the player does not press anything, and it never punishes.
4. **A choice without new verbs.** The low/high split in bars 5–6½: walk the floor, or take the upper tier with hang jumps for a Great Star.
5. **Lock, then key.** The same four-star cluster sits out of reach before the GET and within reach right after it.
6. **The GET.** The softly landing star and the leaf glint: the first new power, earned by running through it.
7. **The climax.** The brightest star, then one beat of silence, the boom on the downbeat, and a dust plume that becomes the goal. Then a confident downhill run of double jumps to the crater, and the asteroid behind the door.
8. **Tighter.** 19 bars (51.8 s) instead of 26 (65 s). No stretch longer than 2 bars without an input or a scripted event (tested from the pilot plus the event list). Inputs per bar are 1.1–1.5 instead of 0.88.
9. **Kind teaching.** Held jumps are shown before they are required. Songs complete with natural 250–500 ms holds. The three-fall tip is only a fallback.

## 6. Short specs for the parallel squad (for consistency)

- **Result card.**
  - It shows the level, one story line, stars, Great Star slots, time, falls and the song's notes, with **Continue** (primary, focused) and **Retry**. There is no Title button.
  - Enter or Space continues, and R retries.
  - Esc during the orbit map between levels goes to the title.
  - After VIII, Continue plays the ending (Earth and the recording) and then the title.
- **Pause card.**
  - Continue · Back to last light · Restart level · **Main menu** (last in the list, separated by a hairline, one press, no dialog). Then Sound and Assist….
  - Main menu returns to the title with the current level selected. Banked Great Stars and unlocks are kept, and any unbanked Great Star is dropped.
  - P and Esc resume.
- **Title level select.**
  - **Layout.** Eight **opaque** stations: paper cards filled with `--paper` at 100% and an ink frame, sitting on an ink plate with 8 px of padding. The sky's stars and twinkles are drawn beneath the plate and can never overlap a card. On landscape the cards form two rows of four (or one orbit arc of eight when the width allows); on portrait, a 2 × 4 grid.
  - **Card contents.** Each card shows the numeral, the name, a small "toward …" body line, the verb glyph it taught (once completed), and three Great Star slots.
  - **Locked cards.** The same opaque card in `--hill` with `--dim` text. Locked cards are never transparent.
  - **Interaction.** Targets are at least 44 px, the focus ring is visible, and ←/→ moves focus.
- **Emergence (level I and the first wake only).**
  - On the wake press, the original sprout line grows from the soil and the round head with two leaves rises, squints and opens its eyes (the trailer's ≈91–99 s, compressed). Then the no-cape start clip, and she runs.
  - It runs on simulation time and lasts at most 2.2 s. It ends on a beat, and her first running step is on the next beat. The score's bar 1 starts at the press, under the sky pad and the Signal's first call.
  - Presses during it are ignored, except that a jump in its last 140 ms is buffered. The first required input comes at least one bar after control.
  - II–VIII open with Diana stepping out of the door.
- **Jump and landing sounds.** The target character is breath and cloth, not impact. The musical voice (the glass harmonica) carries the pitch, and the body is a whisper inside the room.
  - **Jump.** A short breath through cloth, 120–200 ms, with an attack of at least 10 ms and energy mostly between 250 Hz and 3 kHz. No click.
  - **Double jump.** Lighter and higher, plus a tiny spark at least 6 dB under it.
  - **Soft landing.** A felt hush, low-passed around 700 Hz, with an attack of at least 8 ms and no transient.
  - **Hard landing.** The same, 2 dB louder and a little lower. No gravel.
  - **Level and room.** All of them are sent to the space reverb at the score's send. Their loudness is at least 8 LU under the score at the same moment, and their spectral centroid is under 1.2 kHz.

## 7. Fairness and feel constraints

**Kept** (MOVEMENT_CRITERIA, MOVEMENT_AUDIT, LEVEL_DESIGN), now applying to all eight levels:
- **Decision lead.** At least 1.5 s real before the latest valid input. The landing must be in view at the committing press. In new content, chained-flight landings are in view at least 1.2 s ahead: put a constellation star over the landing or start the far shore 150–200 px earlier (the audit's own suggestion).
- **Timing.**
  - Required windows are at least 120 ms (VIII's floor).
  - Intended takeoffs and landings are on the grid within ±35 ms real.
  - Coyote is 0.12 s and the buffer 0.14 s, real.
  - Respawn takes at most 1.2 s real.
- **View and telegraphs.**
  - Lookahead is at least 2.5 s in landscape and 2.0 s in portrait (the widths in §4.2).
  - Glyphs are on screen at least 1.5 s before their latest valid input.
  - Crumble shelves and cascade tiles shake for their whole telegraph.
- **Beacons and falls.**
  - Beacons sit on half bars. Each leaves at least max(400 px, 1.5 s × run speed) before the next required input.
  - Drops on intended lines stay under 240 px, and the death line stays 265 px below the anchor.
  - There are no blind landings, and every crack has a catch or a visible next step.
- **Authoring.**
  - Never author against hidden forgiveness (step-up, lip pop, coyote; F3 clearance).
  - At most two plausible verbs per obstacle.

**New:**
- **GETs.** Each is on the run line and unmissable on every route and at every rate. No required input falls within one bar of it. Its first required use comes at least two bars later, after the safe use and after a beacon at most one bar before it, with a glyph.
- **One thing per level.** Each level declares exactly one `introduces` key. The keys are unique across the campaign and come in the order of §4.1, and no verb is used before its GET.
- **The cape bar invariants C1–C7** (§3.5).
- **Ladders.** The difficulty and music ladders (§4.2, §4.3) are monotone.
- **No remixes, unique story lines, one look per level.**
- **Level I.** Songs complete with 250–500 ms holds, and no 2-bar stretch passes without an input or an event.
- **The squad's feel fixes** stay in force:
  - early airborne presses with an air jump in hand are buffered as the ground jump;
  - no visible lip sink (an apex up to about 30 px under a top inside its span either steps up or never draws the toe through it);
  - the wind refund.

## 8. Tests the squad must add

| Area | Tests |
| --- | --- |
| Unlocks | **U1** Every level's starting verbs match §2.1, and each GET fires on main/upper/ability/safe at 30/60/120/240 Hz. **U2** Before its GET, a verb's input has no effect, event or cue (model and browser). **U3** With the GET removed, the route wins up to the first required use and dies exactly there, after its beacon. **U4** A respawn before the GET does not own the verb; after it, it does. **U5** `startLevel(1)` with VIII unlocked has no cape and no double jump before bar 8. **U6** The bar, cape button and dive button are absent until owned (960×640 and 390×844). **U7** The leaf glint is drawn exactly while the double jump is in hand. **U8** The title legend lists only owned verbs |
| Cape bar | C1–C7 (§3.5), including the "no doomed approach" spend sweep |
| Levels | **L1** No remix (≥ 3 consecutive identical platform deltas across levels fails). **L2** Story lines unique across the campaign. **L3** The §4.2 ladder: windows (narrowest and median, monotone, in band), inputs per bar, peak inputs, verb gaps, beacon gaps, late-press rescue. **L4** Each main route is 45–70 s real. **L5** One unique `introduces` per level, in order. **L6** Sloppy-bot ladder (σ 40 ms: 0 deaths; σ 100 ms: within §4.2 and non-decreasing). This is slow, so it goes in `node scripts/movement-audit.mjs` rather than `npm test`, and its results are recorded in MOVEMENT_AUDIT. **L7** Each level has a unique `look`. Browser screenshots of each level's backdrop differ, and no walkable top is filled grey. **L8** I's constellations complete with 250, 350 and 500 ms holds; no 2-bar stretch in I without an input or event |
| Music | **M1** Onsets per second rise at least 10% level over level on offline perfect-run renders, and the centroid never falls. **M2** Bed detune after a fall and after a broken constellation reaches at least the §4.3 values for at least 2 bars. Three late notes in four bars count as one small error, and one late note moves nothing. Gentle music stays at 0 ¢ |
| Kept, per level | Every route wins at 30/60/120/240 Hz with 0 falls. The grid holds within ±35 ms, and glyph windows, telegraphs, lookahead, HUD band, death line, beacon half bars, no blind landings, F3 clearance, the step-up sweep and the rate-identical arcs all pass. The baked path is fresh for all eight levels |

**Root QA** (`common/tests/browser.mjs`) needs one screenshot moment and one main-route win per level, plus the bar's appearance in II.

## 9. Risks and what humans must judge

- **Scope.** About 115 new bars across eight presets and bakes is the largest content round yet. The milestone A stop exists so the user can judge I–VI before VII and VIII are authored.
- **Breath tuning.** If players feel starved in II (2.55 s of breath), the first remedy is more constellations on the route, then +1/4 per loose star. Never shorten breath below one bar: one bar of music per breath is the rule's readability.
- **Small late tempo steps (4–5%).** Density, brightness and windows carry the felt rise there; a human should confirm that each level reads as "a bit faster".
- **The helper and the necklace** are built from existing sprites (the star, the tail star, and a ring pulse drawn in code). The art lead must judge that they read as characters without new character art.
- **88 BPM with a snappier I arc** needs ears and hands. Pilots prove timing, not calm.
- **The GDD's pink exception** (p. 9, the coral tree) is not adopted. Earth's blue stays the only colour, as the user approved.

## Sources

- **Project materials.**
  - The GDD: `Solarum Design Document.pdf` v0.4, §4–8, 11–13.
  - The original code: `refs/solarum/solarum-master.zip` → `Assets/Scripts` (`GameManager`: `starsRequired`, `hasCape`, `NextLevel`; `HUD`: `BarFill`, `Meteor`; `Tutorial`: `maxJumps`; the level-start texts) and `Assets/Sprites/UI`.
  - The trailer in `refs/solarum/`.
  - The playtest critic's runs of 2026-11-10.
- **Teaching through level design.**
  - [World 1-1](https://en.wikipedia.org/wiki/World_1-1) (citing Miyamoto and Tezuka, Eurogamer 2015, and 1UP).
  - [How Miyamoto built World 1-1](https://www.gamedeveloper.com/design/how-miyamoto-built-i-super-mario-bros-i-legendary-world-1-1).
  - [Hayashida's four steps](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design).
  - [Mark Brown on 3D World's four-step design](https://www.nintendolife.com/news/2015/03/video_nintendos_four_step_stage_design_is_why_you_love_super_mario_games_so_much).
  - [Game Maker's Toolkit and Boss Keys](https://en.wikipedia.org/wiki/Game_Maker%27s_Toolkit).
  - [Dan Cook, The Chemistry of Game Design](https://lostgarden.com/2021/03/13/the-chemistry-of-game-design-2/).
- **Mechanic per chapter, abilities as gifts.**
  - [Celeste](https://en.wikipedia.org/wiki/Celeste_(video_game)).
  - [Celeste characters (the Bird teaches the dash)](https://celestegame.fandom.com/wiki/List_of_characters).
  - [GDC 2017: Designing Celeste](https://gdcvault.com/play/1024307/Level-Design-Workshop-Designing-Celeste).
  - [Celeste & Forgiveness](https://maddymakesgames.com/articles/celeste_and_forgiveness/index.html).
  - [Ori skills and ancestral trees](https://kb.speeddemosarchive.com/Ori/Skills_and_Abilities).
  - [Bit.Trip Runner](https://www.giantbomb.com/bittrip-runner/3030-29550/).
- **Perception.**
  - [Drake & Botte 1993, tempo sensitivity](https://link.springer.com/article/10.3758/BF03205262).
  - [Perception of musical interval tuning (Vos 1982 and others)](https://labs.sonicfield.org/library/perception-of-musical-interval-tuning).
- **Earlier briefs this one builds on:** [RESEARCH.md](./RESEARCH.md) (M1 cape meter, Journey and Sky), [RESEARCH_LEVELS.md](./RESEARCH_LEVELS.md) (one ruler, speed tiers, Rayman, Geometry Dash), [RESEARCH_MUSIC.md](./RESEARCH_MUSIC.md).
