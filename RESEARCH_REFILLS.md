# Solarum: refill stars and relics

This is an addendum to [RESEARCH_PROGRESSION.md](./RESEARCH_PROGRESSION.md), prepared 2026-11-10 by the lead game and level designer for the Solarum squads. It **decides** how the owner's latest play feedback is built into the eight-level campaign, of which I–VI are built and VII–VIII are under way. Nothing here is implemented yet. Where it changes RESEARCH_PROGRESSION, it says so, and the rest of that brief stays in force:
- the breath bar (§3);
- one new thing per level (§4);
- the ladders (§4.2–4.3);
- the fairness rules (§7).

[LEVEL_DESIGN.md](./LEVEL_DESIGN.md) is the source for the built sections cited below by sixteenth k.

## 0. The feedback, and what we do with it

The owner (translated):
1. Flying with the cape while the stars you catch charge it again is the part they love. They want much more of it in the maps.
2. They want a star that recharges the double jump too.
3. The double-jump and cape unlocks are too nebulous: players don't understand how they got them. Each unlock should be a **special item picked up on the map**. The game then shows that the ability is unlocked and teaches it as it already does.

The owner treats these ideas as weighty, not absolute. Our judgement:
- **(1) Right, and cheap.** The breath bar already does it. We give it a clear single-pickup form, the **cape star**, and build "sky roads" around it.
- **(2) Right, if it has a different job from (1).** **Cape stars carry Diana across; leaf stars carry her up.** The cape is level flight and the double jump is height, so the two pickups never compete for the same gap. That rule is what keeps two refill types readable.
- **(3) Right.** Today's GETs are wordless moments, and II's even happens under its own title card. Every ability now comes from a **relic** with a beam of light, followed by a short banner naming the ability and its control. The glide, the dive and the super jump follow the same pattern. The world's mechanics (cracks, wind, cascade) do not, so a banner always means "you can do something new".

The owner's other two changes stay as the UX designer specifies them in `RESEARCH_TRANSITIONS.md` (not yet written as of this addendum): the glyph discs become static background signage that never reacts to Diana, and levels end with a smooth automatic transition that shows falls and stars. Two details here depend on that:
- the banner's control icons use the same disc art as the signage;
- refill stars are tools, not collectibles, so they never count in the star total that the transition shows.

## 1. Refill stars

### 1.1 Rules

| | Cape star | Leaf star |
| --- | --- | --- |
| Job | Across: one more flight | Up: one more air jump |
| Effect when lit | The bar becomes full at once (`capeCharge = 1`, event `refill { source: 'cape-star' }`). The disc turns into the asteroid stone with its ring pulse | One air jump back (`player.jumps = 1`, event `leaf`). The leaf glint returns to Diana's head |
| **Lit** when | The cape is owned and the bar is not full | The double jump is owned, Diana is airborne and has no air jump left (after a double jump or a super jump) |
| **Dormant** when | The bar is full | The double jump is in hand, or Diana is on the ground |
| Dormant behaviour | Drawn at 40% alpha with no glow. Touching it does nothing and **does not consume it**. It lights the instant the bar is spent (one paper ring pulse, 0.25 s), so a flight shows the next star "waking" ahead | The same; it wakes the instant the double is spent |
| Contact buffer | A D press up to **0.14 s real** before touching a lit cape star fires the flight on the contact tick. If D was pressed earlier and is held (a glide), touching the star only fills the bar, and the next press flies | A jump pressed up to **0.14 s real** before touching a lit leaf star, with no air jump in hand, fires the double on the contact tick |
| Pickup box | ±44 × ±50 px around Diana's body centre (`y − 36`), against ±34 × ±43 for a loose star. The drawn bob is at most 3 px, and the box never moves | Same |
| Counts as a star | No: not in the star count, `starsTotal`, constellations or the end-of-level transition | No |
| Respawn | No timed respawn: Diana never comes back to one. Everything after the last beacon is restored on a fall or Back to last light, as other pickups are | Same |
| Owned verbs | Placed only where the cape is owned. In Endless cape it stays dormant | Placed only where the double jump is owned (never in I before its relic) |
| Score | One quantised voice on the grid (1/16, 70 ms cap): the existing A6 `refill` glint | One quantised voice: a glass tick on the ninth, the double jump's own interval |

**Why "lit and dormant".** Celeste's crystals give the dash back at once, regardless of how many dashes were left ([guide](https://www.ludo.guide/guide/celeste/items-equipment/dash-crystals)). In a runner that passes each pickup once, consuming a star the player did not need would quietly take it away. Leaving it dormant keeps it for a mistimed flight a moment later. The lit or dormant state also teaches the rule with no text: a star is lit exactly when it can help.

**Unchanged.**
- **Breath.** 4 beats of running on stable stone fill the bar.
- **Loose stars.** +1/8 each.
- **Constellations.** Full on completion. They stay the musical refill and the way a star line becomes a route.
- **Great Stars, beacons and respawn.** Full.

One builder rule changes: today running stars sit only where the bar is already full (LEVEL_DESIGN, II). From now on, loose stars may sit where the bar is filling, so their 1/8 ticks are visible and expressive. They may never be what a required flight depends on (RESEARCH_PROGRESSION C4).

**Data.** `def.refills: [{ id, kind: 'cape' | 'leaf', x, y, required? }]`, kept separate from `stars`. `getState().refills` lists them with `lit` and `taken`. The `refills` counter stays for the existing sources.

### 1.2 Look, built from existing sprites

The design rule: **every refill star is a small copy of the relic that gave its verb**, so the link needs no words (§2.1).

| Pickup | Drawn as | Distinct from |
| --- | --- | --- |
| Loose star | `star` frame 2/3 at 0.21, bobbing (as now) | — |
| Constellation star | `star` at 0.24, inked lines on completion (as now) | — |
| Great Fallen Star | `star` at 0.42 with a tail-star streak and a 30–36 px breathing halo (as now) | Biggest, has a tail and a halo |
| **Cape star** | `meteor.png` (the asteroid stone, as on the full HUD disc) at 34 px, with `star` frame 2 at 0.12 in front of it. No tail, no ring. Turns slowly, a tenth of a turn per bar | The only pickup on a disc, and the same image as the full bar's disc |
| **Leaf star** | One frame of `sprout.png` (Diana's two leaves) at 34 px tall, cradling `star` frame 2 at 0.14. On contact the star lifts off the leaves and flies to her head in 120 ms, where it becomes the glint, and the leaves fade over 0.3 s | The only pickup with leaves, and the same star as the glint |
| Helper | Tiny star, tail and ring, always moving (as now) | — |

**Screen limits.** At most two refill stars are on screen at once in I–IV and three in V–VIII. All of these use only palette tokens and get a static frame under reduced motion.

## 2. Relics: how a verb is gained

### 2.1 One pattern for every ability

**Sources for the pattern.**
- **Mario.** The power-up is an object that comes into the player's path: the Super Mushroom moves at walking speed and turns at walls ([Super Mario Wiki](https://www.mariowiki.com/Super_Mushroom)).
- **Metroid and Hollow Knight.** The ability is a physical item with a name. Hollow Knight's cloak "Allows the wearer to dash forwards" ([wiki](https://hollowknight.wiki.fextralife.com/Mothwing+Cloak)). Metroid's major items get a fanfare and a message box ([Metroid wiki](https://metroid.fandom.com/wiki/Item_Acquisition_Fanfare)).
- **Ori.** Each Ancestral Tree's skill is followed at once by a stretch that practises it ([SDA](https://kb.speeddemosarchive.com/Ori/Skills_and_Abilities); [Sunken Glades](https://gamerwalkthroughs.com/ori-and-the-blind-forest/sunken-glades/)).
- **Celeste.** The dash crystal arrives in the first chapter's second room, right after the dash ([Celeste wiki: Crossing](https://celestegame.fandom.com/wiki/Crossing)).

| Verb (level) | Relic, on the run line at chest height | On pickup | Banner (name / control) |
| --- | --- | --- | --- |
| Double jump (I) | **The leaf relic**: the first softly landing star, now `star` at 0.36 cradled by `sprout.png`'s two leaves at 60 px | The star flies to her head as the leaf glint | **Double jump** / ↑ again in the air |
| Cape flight (II) | **The gift**: `meteor.png` at 64 px with the cape layer (`dash.png`, two frames fluttering) laid over it | The cape flies onto her (the existing cape-settle moment). The bar appears **full** | **Cape flight** / → in the air |
| Float (III) | **The helper**, perched and circling in place (its existing drawing) | It loops round her, and her cape ripples | **Float** / hold → |
| Dive (IV) | **The necklace**: a paper ring (2 px) with `star` at 0.10 inside it, hanging from a V-shaped thread, lying on the glinting stone | The pendant settles on her chest, and the next lid in view glints (the existing necklace moment) | **Dive** / ↓ |
| Super jump (VIII) | **The rising star**: `star` at 0.36 with the tail-star streak beneath it, the only upward tail in the game | It streaks up past her | **Super jump** / ↑ during a flight |

**Every relic has the same frame.**
- A soft paper beam, 40 px wide at 25% alpha, from the relic to the top of the view (static under reduced motion).
- Three tiny `star` frames (0.08) circling it once per bar.
- It enters the lookahead at least 2.5 s before Diana reaches it.
- It is collected when Diana's x crosses its x, the existing `gets` rule, so it is unmissable on every route. If she passes above or below it, it flies to her.

**The pickup itself.**
- It bursts into the star burst frames 4–7.
- The beam collapses into Diana within 150 ms.
- The visible change on Diana and the HUD (the glint, the cape, the bar, a touch button) happens on the same tick.
- On the next strong beat, the Signal plays the motif's head (D5 C♯5 B4 A4), 3 dB under a constellation bloom. That keeps the background music restrained.

**No freeze and no slow motion.** The simulation and the score keep their speed. This was a deliberate choice:
- Diana cannot stop.
- The path is the score: a freeze would break the bar line, or need a fermata system the engine does not have.
- The owner asked for crisp movement and smooth, non-blocking transitions.
- Metroid's 6–7 s item fanfare is a known pacing cost. Fans remove it ([forum](https://forum.metroidconstruction.com/index.php/topic,3027.msg35848.html); [Metroid wiki](https://metroid.fandom.com/wiki/Item_Acquisition_Fanfare)).

Clarity comes instead from five things: the relic seen in advance, the change on Diana, the banner, the music and the practice stretch that follows.

**The banner.**
- **Placement.** An ink plate at the top centre of the view, under the HUD band, at most 64 px tall. The name is 28 px in the Solarum font, and the control line is 18 px, drawn with the signage's own discs (keyboard: also W / D / S; touch: "tap again", "the cape button", "hold the cape button", "the dive button", "tap during a flight").
- **Timing.** It fades in over 0.15 s, holds for 2.0 s and fades out over 0.3 s (2.45 s real).
- **What it never does.** It never covers Diana, the next 2.5 s of the route or the HUD. A beacon's story line waits until it is gone.
- **Repeats.** It shows in full the first time a save picks up that relic. On replays it shows the name only, for 1.2 s.
- **Accessibility.** An `aria-live` announcement repeats it ("Double jump. Press up again in the air.").

**The teaching that follows** is unchanged (RESEARCH_PROGRESSION 2.2): no required input within one bar of the relic, the safe first use within two bars, then the need, the twist and the finish. The safe first use now falls while the banner is still up (in II, just as it fades), so its control line is on screen the first time the player can try it.

**Environment mechanics have no relic and no banner**, for the same reason Mario never names a hazard. The world teaches them.

### 2.2 Changes to the built GETs

- **I.** The resting star at k 120 becomes the leaf relic (the landing moment at 104 stays), and the banner plays at 120. Nothing else moves.
- **II.**
  - The GET moves from k 4, under the title card, to **k 24**, on the hop out of the crater. The relic hangs on that hop's arc.
  - The bar appears **full** instead of breathing in. This replaces RESEARCH_PROGRESSION C3's "starts at 0 in II".
  - The safe first flight at 40/43 comes as the banner "→ in the air" fades.
  - The bar's first breath is now seen on the gift stone after that flight, and the breath lesson at bars 8–9 is unchanged.
- **III.** The helper drifts down the slope of air (36) and then **waits** in its beam at the lip (44). The banner plays at 44.
- **IV.** The necklace lies on the glinting stone at 44, and the banner plays at 44.
- **VIII.** The rising star appears after the title card (k ≥ 24), followed by the existing super-jump school.

## 3. Placements per level

**Terms.**
- **Meeting:** optional, over ground that catches a miss.
- **Need:** required. A beacon comes at most 2½ bars before it, so a miss replays in about 6 s. (A verb's own first required use keeps RESEARCH_PROGRESSION's one bar.) The first need of each kind gets one static sign.
- **Sky road:** an optional line where Diana stays airborne for at least the given number of bars, chaining flights and jumps through refill stars along a constellation. The main route is never more than 240 px below it, it rejoins on stable stone, and it ends at a Great Star or a star arc. A miss drops her onto the main route; it is never a fall.

| | Required refills (at most) | Optional refills | Sky road (airborne) |
| --- | --- | --- | --- |
| I | 0 | 2 leaf | — |
| II | 1 leaf | 1 cape (meeting) + 2 cape (road) | ≥ 2 bars, GS3 |
| III | 0 | 2 cape (road) + 1 leaf | ≥ 2½ bars |
| IV | 0 | 1 cape (dive for the star) + 1 leaf | ≥ 2½ bars |
| V | 1 cape | 2 cape (road) | ≥ 3 bars |
| VI | 1 cape | 1 cape + 1 leaf (road) | ≥ 3 bars |
| VII | 2 (1 cape, 1 leaf) | 2 cape (road) | ≥ 3½ bars |
| VIII | 3 (2 cape, 1 leaf) | 1 leaf | ≥ 4 bars, part of the main route over a safe line |

### I · Waking (built)
- **Leaf relic at k 120** (§2.2).
- **The last leap (meeting, optional).** On the conclusion's third double (276/279, onto the crater rim), a lit leaf star sits at the double's apex. A third press about 4/16 later lifts her into a short star arc over the crater, and the 1291 px rim catches her either way. It is the level's last flourish, with nothing at stake.
- **GS3 needs the leaf star.** Today GS3 is reached from the high crown with a hang to hang-1. GS3 rises about 70 px, so the line becomes: from hang-1, jump, double, the leaf star, double. The field under it catches a miss, as now.
- **No required refill.** I stays calm and basic, and the leaf star's first need comes in II.

### II · The Gift (built)
- **The gift at k 24, with a full bar** (§2.2).
- **Cape star meeting.** On the gift stone (2088–2917, y 231), after the safe first flight lands on 49 with an empty bar, a lit cape star sits at the top of one held hop (about k 52). Touching it fills the bar, and the disc becomes the asteroid stone. The *gift* beacon at 56 would fill it anyway, so nothing depends on it.
- **Leaf need (the breath lesson, bars 8–9).**
  - The second of the two double-jump gaps (124/128) widens by about 150 px.
  - While the bar shows only a quarter, the line is: jump 124, double 128, a lit leaf star at the double's apex (about 131), double again (about 132), onto breath-1.
  - The lesson becomes "while the cape breathes, the leaves carry you". The long stone still fills the bar tick by tick.
  - The *void* beacon (88) is 2¼ bars before it, which is within §3's rule. The *long* beacon at 152 is unchanged. This needs a re-solve and a re-bake.
- **Pluto's sky road (optional, with GS3).** Above Pluto's steps (196–246), from the void shore: jump 196, cape 199, then a cape star at the flight's end (about 203), cape, a cape star, cape, along a new *sky-song*, onto the heart plain. GS3 moves from over the last step to the road's end. The three steps below it (each at most 240 px down) catch any miss, and the main route's steps and their required *steps-song* are unchanged.

### III · Still Water (built)
- **The helper waits in its beam at 44** (§2.2).
- **The glide relay (optional sky road)**, over the water stair (204–243).
  - From the stair's first flight (207), keep holding instead of letting go at 218.
  - A lit cape star (the bar is empty after the flight) sits at about 214. A press flies again, keep holding, then a second cape star, a flight, and hold.
  - This lands on a new high ledge over stair-3 with a star arc and walks off onto stair-3 (520).
  - The stair catches every miss. "Float, refill, fly" is the glide level's own form of the owner's favourite loop.
- **Leaf star (optional).** At the top of the second rise (about 322), a lit leaf star gives a third jump into a star arc over Neptune's shelf.
- **No required refill.** III's need and twist belong to the glide.

### IV · The Way Down (built)
- **The necklace on the glinting stone at 44** (§2.2).
- **Dive for the star (optional sky road).**
  - In the way down (228–265), a lit cape star hangs low over ring-2, below the flight line, where only a dive out of the flight passes.
  - The line: dive out of the flight, touch the star, fly again along a low arc, hold, then dive onto ring-3.
  - It is IV's signature combination: the dive as a way to *reach* a refill.
- **Leaf star (optional).** In the broken well's exit (jump 185, double 188, flight 191), a lit leaf star at the double's apex gives a second double up to a star arc on the well's high rim, rejoining at the well shore.
- **No required refill.**

### V · The Breaking Constellation (built)

Cracks never breathe, so here a star is the only charge on broken stone.
- **Cape need: the crumbling run.**
  - At the start of the conclusion's run down (317–357, cracks c1–c4), the *crown* beacon (288) has filled the bar. Nothing after it breathes: the last crack is cracked and the crown is 140 px.
  - The line becomes: from the crown, jump at 317 and cape, spending that charge, over c1. A lit cape star sits at the flight's end (about 323, 2.2 bars after the beacon). Cape again across c2 and c3 onto c4, then up onto the ring plain.
  - The first half of the crumbling run is crossed in the air, and the cracks below each keep their catch rule.
  - This is a re-solve and a re-bake. If a window falls below the ladder's 220 ms floor, the star moves rather than the window narrowing.
- **Sky road (optional).** Over the split voids (180–201), a higher line of two cape stars across both voids without touching the cracked islet, along its own song. It rejoins on the far shore, and the required *split-song* below is unchanged.

### VI · Borrowed Wind (built)

The wind gives no breath and blocks flights, so a star in a column charges the fly-out.
- **Cape need: the last wind** (300–356). The *last* beacon (288) leaves the bar full, so the first column spends it:
  - Out of column F's top, Diana flies instead of diving (306), spending the bar, onto the islet. Its 120 px of stone breathe only about a fifth of a bar, so the next star is lit.
  - In column G, a lit cape star sits near its top, about 1.4 bars after the beacon.
  - She rides G, flies out of its top onto a higher shore, and the crack run follows 30–60 px higher.
- **The storm sky road (optional).** From the top of the storm wind (206–215, where GS3 is), a flight onto a cape star, flight, a leaf star, double, onto a star arc that rejoins the storm shore. GS3 stays where it is.

### VII · The Falling Road (the builder's worktree)

Cascade tiles never breathe.
- **Cape need.** In `gap-road`, a lit cape star sits over the tile before the first missing tile (over d0). Bounce on d0, jump, touch the star, fly across the missing tile onto d2. The run before the cascade spends the bar (a required flight) so that the star is lit. Without the star, the flight is not available.
- **Leaf need.** Over the second missing tile: bounce, double, a lit leaf star at the apex, double onto d4 (up, not across: the leaf's job).
- **Sky road (optional, ≥ 3½ bars).** Above `last-road` (e0–e3), two cape stars chain three flights along a song toward the super-jump lock ledge. The road ends just short of the ledge, which only VIII's super jump reaches: a tease, not a trap. It drops back onto the road's last tiles.

### VIII · The Far Door (to build)
- **The rising star** after the title card, then the existing super-jump school (§2.2).
- **The star road (required, in the gauntlet, bars 13–20, over a stable low line).**
  - The line: jump, cape, a cape star, a super jump, a leaf star at the super jump's apex, a double, a cape star, cape, landing on the gauntlet's far shore. It runs along a constellation that is the level's climax phrase.
  - It is the campaign's one long required airborne chain (≥ 4 bars). The low line under it needs only jumps and is never more than 240 px below.
  - A beacon is at most one bar before it, and each of its refill stars is lit on every valid route (C8).
- **The rising stair (optional).** A lit leaf star between the stair's two doubles gives a third jump to the stair's top star.

**Ladder effect.** The extra doubles and flights raise inputs per bar in II, V, VI and VIII. They must stay inside RESEARCH_PROGRESSION §4.2's bands and remain monotone; re-measure with `scripts/level-report.mjs`.

## 4. Fairness

Stars never gate the door. **Required refill stars are a deliberate exception**, of the same kind as the required constellations that already charge flights (II's *void-song*, V's *split-song*). They are made fair by these invariants, numbered after RESEARCH_PROGRESSION's C1–C7:

| # | Invariant |
| --- | --- |
| C8 | **Lit and reached.** On the main route, and under every press shifted across its window (`timingWindow()`, so the latest valid route is included), at 30/60/120/240 Hz, every required refill star is touched, and is lit when touched |
| C9 | **No doomed chain.** C2's spend sweep is extended. The main route runs with an extra optional flight *or* an extra double injected at every airtime moment where it is possible. Every run that survives reaches each required flight with a full bar or a lit cape star on its line, and each required double with a jump in hand or a lit leaf star on its line |
| C10 | **The door needs no optional star.** With every loose star and every non-required refill star removed, every level's main route still wins. Required refills are flagged `required: true`, each is covered by C8, and their count per level stays within §3's table |
| C11 | **Dormant means untouched.** Touching a refill whose resource is full changes nothing and leaves it in place. A later touch in the same airtime, when lit, works |
| C12 | **Contact buffers.** A D press 0–0.14 s real before a lit cape star, or a jump press before a lit leaf star (with no jump in hand), acts on the contact tick, bit-identically at 30–240 Hz and under 0–100 ms hitches. A press made 0.15 s or more before contact does what it would have done without the star |
| C13 | **Relics are unmissable.** Every relic fires on every route at every rate, and its verb is owned from that tick. No required input falls within one bar after it, and the safe first use comes within two bars and is optional |
| C14 | **The banner never covers.** Its rectangle never intersects Diana, the HUD band, or the main route's platforms and refill stars in the next 2.5 s. It lasts 2.45 s real (1.2 s on replays) and is announced through `aria-live` |
| C15 | **Restore on respawn.** Refill stars after the beacon are restored on a fall and on Back to last light, and none returns on a timer |
| C16 | **Each verb's refill only.** Leaf stars appear only where the double jump is owned, and cape stars only where the cape is owned. A cape star never changes `jumps`, and a leaf star never changes `capeCharge` |

**Feel rules kept.**
- Required refill stars sit on the intended arc. Their box (±44 × ±50) is generous, but they are never placed against hidden forgiveness (F3).
- They are in view at least 1.5 s before the press that commits to them.
- After a required refill, the next required press keeps at least the level's narrowest window.

## 5. Tests to add

- **Model.**
  - C11, C12, C15 and C16 as unit tests: the lit and dormant switch at the exact tick the resource is spent or restored, the contact buffer edges (0.14 s versus 0.15 s), restore on respawn, and each verb's refill only.
  - A cape star after a super jump gives a new flight and with it a new super jump. Endless cape keeps cape stars dormant.
- **Routes.**
  - C8 and C10 per level.
  - C9's extended spend sweep.
  - Every sky road gets its own pilot (in `upper`, or a new `sky` route). Each wins at 30/60/120/240 Hz. Every miss of each road's refill stars lands on the main route, and none dies.
  - The removal tests for the required refills (II's leaf, V's cape, VI's cape, VII's two, VIII's three): removing the star fails exactly at its gap, after its beacon.
- **Relics.**
  - C13 on every route.
  - II's GET at k ≥ 24 (outside the title card) and a full bar at pickup.
  - The relic is in view at least 2.5 s ahead at the narrowest portrait width.
- **Renderer and browser.**
  - C14 at 960×640 and 390×844.
  - One screenshot of each pickup kind, checking that each is drawn with its own sprite set and that no two share the same (sprite, scale band, ring, disc, leaves) combination.
  - Lit and dormant alpha (100% / 40%) follow `getState().refills`.
  - The leaf star's flight to the head ends with the glint shown.
  - The banner's first-time and replay texts follow the save.
- **Score.**
  - The refill voices are in the chord's safe set, on the grid within the quantiser's cap, and add no bed onsets (restrained music).
  - Every changed level's path is re-baked, and every main-route anchor stays within ±35 ms.
- **Ladders.** RESEARCH_PROGRESSION L3, L6 and M1 are re-measured on II, V, VI, VII and VIII after the changes.

## 6. Risks

- **Too many stars.** There are now five pickup kinds. Mitigations:
  - the job rule (cape stars across, leaf stars up);
  - the lit and dormant state;
  - the screen limits;
  - one unique silhouette each.

  If playtesters still confuse them, cut the optional leaf stars in III and IV before touching the rules.
- **Infinite again.** Refill stars are authored, counted and never on a timer, and breath is unchanged. A sky road gives stars and a Great Star, not a shortcut: the autorunner's time is fixed by distance.
- **Words in a wordless game.** The banner is the only new text. It is short, shown in full once per save, set in the game's own font on an ink plate, and never over play.
- **Rework of built levels.**
  - The relic changes are renderer work plus II's GET move.
  - The optional lines change only the upper routes and the tests.
  - The required changes (II's breath lesson, V's run down, VI's last wind) need a re-solve and a re-bake each. Do them one level at a time, each as a green commit.
- **No freeze.** If the owner still finds an unlock unclear after the banner, the next step is a longer banner hold (up to 3 s) or a second safe use, never a freeze.
- **The necklace.** The pendant is drawn in code (a ring and a star). The art lead should confirm it reads as a necklace and not as a Great Star's halo.

## Sources

- **Refill pickups.** Celeste's dash crystals: [Celeste wiki: Crossing](https://celestegame.fandom.com/wiki/Crossing) (introduced in Forsaken City's second subchapter, right after the dash) and [dash crystals guide](https://www.ludo.guide/guide/celeste/items-equipment/dash-crystals). Celeste's chapter-per-mechanic structure: [Wikipedia](https://en.wikipedia.org/wiki/Celeste_(video_game)).
- **Item-get moments.**
  - [Item Acquisition Fanfare (Metroid wiki)](https://metroid.fandom.com/wiki/Item_Acquisition_Fanfare).
  - [Super Metroid message-box timing (Metroid Construction forum)](https://forum.metroidconstruction.com/index.php/topic,3027.msg35848.html).
  - [Mothwing Cloak (Hollow Knight wiki)](https://hollowknight.wiki.fextralife.com/Mothwing+Cloak).
  - [Super Mushroom (Super Mario Wiki)](https://www.mariowiki.com/Super_Mushroom).
  - [Ori skills](https://kb.speeddemosarchive.com/Ori/Skills_and_Abilities) and [Sunken Glades walkthrough](https://gamerwalkthroughs.com/ori-and-the-blind-forest/sunken-glades/).
- **Teaching.** [World 1-1](https://en.wikipedia.org/wiki/World_1-1), [Hayashida's four steps](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design), [Dan Cook's skill atoms](https://lostgarden.com/2021/03/13/the-chemistry-of-game-design-2/).
- **Project.** [RESEARCH_PROGRESSION.md](./RESEARCH_PROGRESSION.md) (breath, GET pattern, ladders, C1–C7), [LEVEL_DESIGN.md](./LEVEL_DESIGN.md) (the built I–VI by sixteenth), the owner's play feedback of 2026-11-10.
