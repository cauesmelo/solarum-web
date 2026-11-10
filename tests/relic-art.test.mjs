/* Relics, refill stars and the unlock banner as the renderer draws them
 * (RESEARCH_REFILLS 1.2, 2.1, the rendering half of C14). The model side
 * (lit/dormant, buffers, restore) is tested where the model lives; here the
 * contract is static, because game.js runs only in a browser (the root QA
 * previews each kind on the packaged ZIP). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const js = await read("game.js"),
  css = await read("style.css"),
  html = await read("index.html");
const body = (name) => js.slice(js.indexOf(`function ${name}(`), js.indexOf("\n}\n", js.indexOf(`function ${name}(`)));

test("every verb's relic has its own art, a beam and the banner's name and control", () => {
  const art = js.slice(js.indexOf("const RELIC_ART = Object.freeze({"), js.indexOf("});", js.indexOf("const RELIC_ART")));
  const want = { double: ["Double jump", "again in the air"], cape: ["Cape flight", "in the air"], glide: ["Float", "hold"], dive: ["Dive", ""], super: ["Super jump", "during a flight"] };
  for (const [verb, [name, line]] of Object.entries(want)) {
    assert.match(art, new RegExp(`${verb}: \\{ name: "${name}", key: \\[[^\\]]+\\], line: "${line}"`), verb);
    assert.match(art, new RegExp(`${verb}: \\{[^\\n]*touch: "[^"]+", say: "[^"]+"`), `${verb}: a touch line and an announcement`);
  }
  // One object per verb, from existing sprites only.
  const draw = body("drawRelicArt");
  for (const [verb, uses] of [["double", /sprite\("sprout"[\s\S]*sprite\("star"/], ["cape", /images\.meteor[\s\S]*sprite\("dash"/], ["glide", /drawHelper\(/], ["dive", /ctx\.arc\(x, y, 9 \* k[\s\S]*sprite\("star", 2, x, y, 0\.1 \* k\)/], ["super", /streak\(x, y \+ 4 \* k, -Math\.PI \/ 2/]])
    assert.match(draw.slice(draw.indexOf(`verb === "${verb}"`)), uses, verb);
  // The beam: 40 px at 25% alpha to the top of the view, three stars circling once per bar.
  const beam = body("drawBeam");
  assert.match(beam, /ctx\.fillRect\(x - 20, top, 40,/);
  assert.match(beam, /0\.25 \* alpha/);
  assert.match(beam, /for \(let k = 0; k < 3; k\+\+\)[\s\S]*clock \/ bar\) \* Math\.PI \* 2/);
  // The pickup holds the relic over Diana for one beat (animation only).
  assert.match(body("relicPickup"), /beat: beatSeconds\(\)/);
  assert.ok(!/update\(|togglePause|state\.status =/.test(body("relicPickup") + body("drawRelicHolds")), "the pickup never stops the simulation");
});

test("refill stars: the cape star on the asteroid stone, the leaf star between two leaves; lit 100%, dormant 40%", () => {
  const draw = body("drawRefills");
  assert.match(draw, /const a = lit \? 1 : 0\.4/);
  assert.match(draw, /q\.kind === "cape"[\s\S]*images\.meteor[\s\S]*34 \/ images\.meteor\.width[\s\S]*sprite\("star", 2, q\.x, q\.y \+ bob, 0\.12\)/);
  assert.match(draw, /sprite\("sprout", 0, q\.x, q\.y \+ bob \+ 6, 34 \/ 200\);\n      sprite\("star", 2, q\.x, q\.y \+ bob - 4, 0\.14\);/);
  // A dormant star has no glow; it pulses one ring (0.25 s) the instant it lights.
  assert.match(draw, /if \(lit\) \{\n        const g = ctx\.createRadialGradient/);
  assert.match(draw, /if \(lit && was === false\) refillWake\.set\(q\.id, clock\);/);
  // The leaf star flies to her head in 120 ms and becomes the glint; the leaves fade over 0.3 s.
  const fly = body("drawRefillFx");
  assert.match(fly, /if \(t < 0\.3\) sprite\("sprout"/);
  assert.match(fly, /Math\.min\(1, t \/ 0\.12\)/);
  assert.match(fly, /ANCHORS\.glint/);
  // The renderer reads the model's lists defensively and never counts them as stars.
  assert.match(body("refillsOf"), /Array\.isArray\(s\.refills\)[\s\S]*Array\.isArray\(s\.refillStars\)/);
  assert.match(js, /case "refill-star":\n        if \(loud\) refillPickup\(e\);/);
});

test("the banner: an ink plate under the HUD band, at most 64 px tall, 2.45 s the first time, 1.2 s on replays, non-blocking", () => {
  assert.match(js, /const BANNER = Object\.freeze\(\{ fadeIn: 0\.15, hold: 2, fadeOut: 0\.3, replay: 1\.2 \}\);/);
  const rule = css.slice(css.indexOf("\n.banner {"), css.indexOf("}", css.indexOf("\n.banner {")));
  assert.match(rule, /top: calc\(var\(--stage-top\) \+ var\(--hud-h\) \+ 8px\)/);
  assert.match(rule, /max-height: 64px/);
  assert.match(rule, /pointer-events: none/);
  assert.match(rule, /background: var\(--ink\)/);
  assert.match(css, /\.banner-name \{\n  font-size: 28px;/);
  assert.match(css, /\.banner-control \{[\s\S]*?font-size: 18px;/);
  assert.match(html, /id="banner" aria-hidden="true" hidden/);
  const show = body("showBanner");
  assert.match(show, /const full = !\(progress\.relics \?\? \[\]\)\.includes\(verb\);/, "full the first time a save takes the relic");
  assert.match(show, /announce\(full \? art\.say/);
  assert.match(show, /touch \? art\.touch/, "a touch variant");
  // A beacon's story line waits until it is gone.
  assert.match(js, /if \(banner\) ui\.storyWaiting = mark\.story;/);
});
