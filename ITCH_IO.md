# Solarum itch.io build

This project exports independently. Run `npm run build:itch` here, then upload `dist/solarum-itch.zip` as an HTML Game on its own itch.io page. There is no shared launcher or server runtime in the ZIP.

The entry is root `index.html`. All art, audio (the soundtrack for the title and the far door; every effect and the in-level adaptive score are synthesised in `audio.js` and `score.js`, with the baked path clock in `score-path.js`), the font, scripts and renderer dependencies are local. It holds all four levels (progress is kept with guarded localStorage writes; without storage every session opens on level I). The current export has 43 files, 9.26 MiB; `assets/jump-landing.png` (an unreferenced duplicate), the archived original WAVs in `assets/sfx/`, the dev-only soundboard, tests and scripts are deliberately left out. The exporter normalizes runtime module extensions to `.js`, preserves asset bytes, and writes the unpacked site to `dist/itch/` plus a hash/size report to `dist/build-report.json`.

Standalone index.html is a plain green page with only the actual game centered. The same game fills its iframe, with its HUD and controls inside the game surface; no surrounding website or shared launcher is included. Narrow or portrait frames letterbox the sky (never below 720 logical px wide, 2.05 s of lookahead; 775 and 840 px in the faster levels III and IV, which also keep a 970 / 1050 px minimum in landscape so the 960×640 embed letterboxes thinly there) and put the touch controls in a deck underneath.

Use Click to Play, an initial 960×640 embed and fullscreen support. Embedded mode is detected automatically; `index.html?embed=1` lets you inspect it directly. Test the uploaded draft preview before publishing. Do not enable Mobile Friendly solely on the basis of desktop touch emulation.

The runtime has no CDN, account, API key, backend, Node process or cross-origin isolation requirement. Sound is on by default and starts with the wake gesture (click, tap or key), which satisfies browser autoplay rules; the on/off and Gentle music choices are stored with guarded localStorage writes and play continues (with sound on) if storage is blocked. Pausing suspends all audio, the score included, and resumes it in place.

The package excludes local development servers, tests, Node dependencies and build tools. Keep those development files outside the upload. Rebuild the ZIP after edits; editing source does not update a previously generated/uploaded archive.

The full workspace contains detailed deployment rationale in `../common/docs/ITCH_IO.md`, validation evidence in `../common/docs/VALIDATION.md`, and shared continuity in `../common/SHARED_MEMORY.md`. These documents are optional when copying this project elsewhere. Official upload reference: https://itch.io/docs/creators/html5
