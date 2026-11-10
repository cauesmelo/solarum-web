# Changelog

Player-facing changes in Solarum. Versions follow `package.json`; the title screen shows the release as `v1.0`.

## [Unreleased]

### Keyboard only

- **Solarum is played with the keyboard only.** The mouse and touch screens do nothing: a click or a tap on the game changes nothing (it only gives the page keyboard focus, so keys work at once after you click into the itch.io frame), and the pointer is hidden over the game. The touch buttons, the on-screen pause, sound and fullscreen buttons and the "tap" wording are gone.
- **Every screen has keys.** On the title: Left / Right choose an open level, Space (or Enter, Up, W) wakes Diana, **C** opens the credits, **M** turns the sound on and off, **F** goes fullscreen. In play: M and F too. In the pause card: Up / Down move a drawn cursor, Enter or Space presses, Esc continues, Left / Right change a volume. In the credits: Esc, C, Backspace or Enter close them. After a level: R plays it again, Esc pauses.
- **A drawn cursor shows where the keys act:** the pause card's buttons, sliders and assist switches, and the credits' Back, wear a second hand-drawn loop. On the title the filled ring with Diana's sprout is the cursor, with a small chevron beside the level name when another open level lies that way.
- **The title now reads "Press space to wake".**

### A drawn interface

- **The marks inside the panels are drawn by the same hand as the panel's wobbly line.** The level rings overshoot their own start, differ in width and are never quite round (locked levels are dashed with irregular dashes); the links between levels are dots or a pen line; each level's sprout, the Earth dot, the wake pill, the buttons, the sliders, the key caps, the arrows and the orbit line in the HUD and the pause card are all drawn, each from its own seed, so no two are alike. They waver with the panel's line on the title and the pause card, and stand still with "Less motion".

## [1.0.0] - 2026-11-10

The first release of the browser version of Solarum, *A Signal in the Dark*: a 2D autorunner in which Diana runs on her own, from the Moon's dust toward a faint signal from Earth. It keeps the original game's hand-drawn art, Diana, her cape, the stars and the far door.

### The game

- **Eight levels, one new idea each, each a little faster:** I Waking (the double jump), II The Gift (the cape and its breath), III Still Water (the glide), IV The Way Down (the dive), V The Breaking Constellation (cracked stone), VI Borrowed Wind (the solar wind), VII The Falling Road (the beat cascade) and VIII The Far Door (the super jump, and Earth's door).
- **Abilities are earned in the world,** not handed over by text: a relic in a beam, one beat of hold and a short banner. The cape arrives in the middle of II, at the asteroid's crater.
- **A spent cape is its own meter.** One flight per breath; a bar of running on stable stone, a refill star or a completed constellation breathes it back.
- **Meteor platforms:** the islands are floating rocks. `?platforms=classic` brings back the original islands.
- **Crisp, fair movement:** variable jump height, coyote time, a landing buffer, ledge forgiveness and a step-up rule. Inputs are applied on the exact tick they happen, so the game plays the same at any frame rate.
- **Three Great Fallen Stars per level,** never required. Collect them all and Earth turns blue at the end.
- **An automatic transition** from each door to the next level, with a tally of stars and falls, and a short credits sequence the first time you finish.

### Sound

- **The path is the score.** Diana's notes follow the level's tune when she runs the intended line, and the world drifts out of tune when she falls.
- **A song for every level,** soft and airy, plus a wind bed; the original soundtrack plays on the title and at the far door.
- **Music and Sounds sliders** in the pause card, and a Gentle music assist that never detunes.

### New in 1.0

- **`v1.0` on the title screen,** and a **Credits** card on the title: the original team, the soundtrack, the Solarum Basic font, and a note that every in-level sound is synthesised in your browser.
- **A quiet console:** a few very high bell overtones asked the browser for frequencies above its limit on levels II, VI, VII and VIII, and Chrome logged a warning each time. They now fold down an octave first; nothing audible changes.
- **Saves:** progress is one versioned save, guarded so a browser that blocks storage (some itch.io embeds, private windows) still plays and keeps your progress for the visit. Older saves carry over; unknown or damaged data is ignored instead of breaking the game.
- **A smaller download:** the itch.io build carries only the game, its art, this changelog and the README.

### Known limits

- Keys can't be remapped. Arrows and WASD both work, and every binding is listed in the README.
- The eight levels were tuned with route pilots and simulated players and have had little human play-testing, so difficulty may still need tuning.
- Solarum is a desktop keyboard game: there is no mouse or touch play (v1.0 shipped touch controls; they were removed afterwards).
