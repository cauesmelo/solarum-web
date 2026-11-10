# Solarum on itch.io

This project exports independently. Run `npm run build:itch` here, then upload `dist/solarum-itch.zip` as an HTML game on its own itch.io page. There is no shared launcher or server runtime in the ZIP.

**Status (2026-11-10): v1.0 release candidate. Nothing is uploaded and `v1.0.0` is not tagged.** The owner approves the page and the draft before either happens. Everything under "Draft page copy" is a draft for the owner to edit.

## The export

- **Entry:** root `index.html`. Every path is relative; `.mjs` runtime modules become `.js`. All art, the soundtrack recording (title and the far door only), the font, scripts and the renderer's code are local: no CDN, account, API key, backend, Node process or cross-origin isolation.
- **Contents:** the game, its art and audio, and **player documents only**: `README.md`, `CHANGELOG.md` and any licence file. The design briefs, research, audits, `ITCH_IO.md`, the dev-only soundboard, the archived original WAVs (`assets/sfx/`), the unreferenced `assets/jump-landing.png`, tests and scripts stay out (`package-itch.mjs`, tested in `tests/release.test.mjs`). The current export is 59 files, 10.55 MiB; `dist/itch/` holds the unpacked site and `dist/build-report.json` the hashes and sizes.
- **Embed (`itch.json`):** 960×640 viewport (the game's own surface), click to play, fullscreen button on, **mobile friendly off** (desktop keyboard game), landscape. Embedded mode is detected automatically; `index.html?embed=1` shows it directly. Test the uploaded draft before publishing.
- **Keyboard only (owner, 2026-11-10: "I want interaction with the keyboard only").** There is no mouse or touch input at all: every element is `pointer-events: none`, the pointer is hidden, and a script (`inert.mjs`) cancels any pointer, mouse or touch event that reaches the page. A click in the itch.io frame still gives it keyboard focus (the browser does that itself), so keys work after one click on the game, and keep working after a pause, a restart or a level change. The game has no fullscreen button of its own: **F** toggles fullscreen inside the frame, and itch.io's own fullscreen button belongs to its page (in fullscreen the browser keeps Esc, so use **P** to pause there).
- **Mobile friendly is off (owner, 2026-11-10: phones are out of scope; never requested).** The touch controls that existed in the release candidate were deleted in the keyboard-only change. For the record (historical, no longer true of the build), touch play was proven in emulated phones (Chrome, 844×390 landscape and 390×844 portrait): a tap wakes Diana, every control is on screen, reachable at its centre and at least 44 px, level I is won with a finger through the jump zone (taps of 55 ms and held jumps), the transition runs into II, the cape is earned and flown with the cape button, and pause, resume, Main menu and Credits work by tap (root QA, "touch play end to end"). **No physical phone has been used**, and nobody has judged the thumb ergonomics. If a real phone disagrees, set `mobileFriendly` to `false` in `itch.json` (the gate only needs a boolean).
- **Audio:** sound is on by default and starts with the first key press in the frame (a click only focuses the frame and starts nothing; the title song starts on the first key that is not the wake). The wake key is a gesture inside the iframe, which satisfies autoplay (itch's click-to-play click lands on the parent page). M toggles the sound. Pausing, blurring or hiding the tab suspends all audio and resumes in place. Music and Sounds sliders are in the pause card.
- **Saves:** one versioned save (`solarum.levels`, version 3) plus three small settings (`solarum.sound`, `solarum.music`, `solarum.volume`), all behind guarded storage. The game boots and plays with storage blocked (the release gate probes this) and keeps progress for the visit. A version-1 or version-2 save migrates; unknown or damaged data is ignored. itch serves games from a shared CDN origin, so every key is prefixed `solarum.`.
- **Rebuild after edits:** the ZIP does not update by itself.

Official upload reference: https://itch.io/docs/creators/html5. Release plan and the shared gate: `../common/docs/V1_RELEASE_PLAN.md`, `cd ../common && npm run release:gate`.

## Draft page copy (for the owner)

*Everything in this section is a draft.*

- **Title:** Solarum
- **Tagline (short description):** A hand-drawn runner through the stars. Diana follows a faint signal home to Earth, and the cleaner you run, the more the music sings.
- **Description:**

  > Diana runs on her own; you choose when she leaps.
  >
  > Follow a faint signal across eight small worlds, from the Moon's dust toward Earth. Each level brings one new idea and a little more speed: the double jump, the cape, the glide, the dive, cracked stone, the solar wind, a falling road and, at the far door, the super jump. Abilities are earned in the world, not explained in text.
  >
  > The music is the map. Run the intended line and Diana's own notes sing in harmony with the level's song; stumble and the world drifts out of tune until you find the line again (there is a Gentle music option that never detunes). Three Great Fallen Stars wait in every level and none is ever required.
  >
  > Original hand-drawn black-and-white art and soundtrack by the Solarum team, rebuilt for the browser. Sound on, please.
- **Controls:** (also in the README)
  - **Space, ↑ or W:** jump (tap for a hop, hold for height; again in the air for the double jump).
  - **D or →:** cape (once per breath; hold to glide).
  - **S or ↓:** dive, and break cracked stone.
  - **Jump during a cape flight:** super jump (level VIII).
  - **P or Esc:** pause (Music and Sounds sliders, assists). **R:** back to the last light. **Shift+R:** restart the level.
  - **Title:** Left / Right choose a level, Space or Enter wakes, **C** credits. **M:** sound. **F:** fullscreen. In the pause card, Up / Down move and Enter or Space press; Left / Right change a volume.
  - **Keyboard only:** no mouse and no touch input (say so on the page, and do not tick "Mobile friendly").
- **Genre:** Platformer
- **Tags (10):** runner, 2d, hand-drawn, atmospheric, space, black-and-white, relaxing, singleplayer, short, music
- **Kind of project:** HTML. **Release status:** Released (after the owner's yes). **Pricing:** no payments (donations optional, owner's call). **Visibility:** Restricted first, then Public.
- **AI disclosure (owner decision):** the plan recommends answering yes and ticking **Code** and **Text & Dialog**; **not** Graphics (every picture is the original hand-drawn art, plus shapes drawn in code in that style). The in-level audio is synthesised by code; the title and door recording is the original human-made soundtrack.
- **Credits to confirm (owner):** the names, nicknames and roles come from the original GDD (Cauê Melo, Daniel Calônico "raenkumi", Lucas Santos "LSdS", Rafael Lima "Kimoh"; soundtrack by Amanda "meromei" and Bruno Mareto "Bu Maré", whom the GDD thanks "for granting the music used in the soundtrack"). The GDD names the font "Solarum Basic" (the shipped file's internal name is "Solarum Regular", made with Calligraphr in 2021). Please confirm the spelling and that the soundtrack's authors agree to public web distribution. No licence file exists yet: ownership stays with the original project, so the owner chooses one.

## Cover and screenshot candidates (real captures)

All from the real build through Chrome (SwiftShader), in `../common/artifacts/solarum-v1-page/`:

- **Cover** (315:250): `cover-1260x1000.png` (master) and `cover-630x500.png` (upload): the logo over the title ground and the sprout, cropped from the real 960×640 title at 2x with the title panel and corner buttons hidden, so the only text is the game's own logo.
- **Screenshots** (960×640, cropped from the root QA's captures of the actual ZIP): `01-title-960x640.png` (the title), `02-ii-the-gift-960x640.png` (II, the asteroid's eye at the crater: the cape is earned), `03-iv-the-way-down-960x640.png` (IV, the dive), `04-vii-the-falling-road-960x640.png` (VII, a cape flight over the falling road), `05-viii-the-far-door-960x640.png` (VIII, the super jump's relic), `06-credits-960x640.png` (the Credits card). Pick three to five; the owner chooses.

Upload sizes: cover 630×500 (315:250), a 1260×1000 master is kept; 3–5 screenshots. No text beyond the game's own title on the cover.

## Before going public (owner checklist)

1. Read the draft copy above and approve or edit it; decide the AI disclosure, price and the licence.
2. Upload `dist/solarum-itch.zip` as a **Restricted** draft with the embed settings above; wait for itch to process it.
3. In the real iframe: click once (nothing should happen except the frame taking focus), press a key (audio starts and keys do not scroll the page), F for fullscreen, pause on blur, reload (progress kept), and play I and VIII to the door.
4. Then tag `v1.0.0` in this repository and publish. The tag is not set yet.
