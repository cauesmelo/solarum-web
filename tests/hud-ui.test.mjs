/* The renderer's static contract for the progression HUD (game.js,
 * index.html, style.css): the breath bar is absent until a meter reads, the
 * stars move right for it, full shows the meteor, unowned touch verbs hide,
 * a get event plays its moment, and the QA previews exist. The behaviour
 * itself is checked in Chrome (common/tests/browser.mjs, Solarum). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");

test("static contract: the breath bar, verbs, the glint and the QA previews", async () => {
  const html = await read("index.html"),
    css = await read("style.css"),
    js = await read("game.js");
  // The bar is hidden (absent) until game.js reads a meter, and sits before the star count.
  const bar = html.slice(html.indexOf('id="breath"') - 30, html.indexOf('class="star-icon"', html.indexOf('id="breath"')));
  assert.match(bar, /role="meter"[^>]*hidden>/);
  assert.ok(html.indexOf('id="breath"') < html.indexOf('id="stars"'), "the stars shift right to make room");
  for (const part of ["breath-track", "breath-window", "breath-fill", "breath-frame", "breath-notches", "breath-disc"]) assert.ok(html.includes(part), part);
  assert.equal((bar.match(/<i><\/i>/g) || []).length, 3, "three notches");
  assert.match(js, /bar\.hidden = !m;/);
  assert.match(js, /const m = state\.status === "ready" \? null : meterNow\(\)/);
  // Full: the meteor stone and one ring pulse; the touch rim follows the charge.
  assert.match(css, /\.breath\.full \.breath-disc \{\s*background-image: url\("\.\/assets\/meteor\.png"\)/);
  assert.match(css, /conic-gradient\(var\(--paper\) calc\(var\(--charge, 0\) \* 1turn\)/);
  assert.match(css, /\.solarum\[data-verbs\]:not\(\[data-verbs~="cape"\]\) \.cape-btn/);
  // The GET event and the previews.
  // A GET starts its moment on the simulation clock, quietly in a QA step (no particles).
  assert.match(js, /case "get":[\s\S]{0,400}startMoment\(e\.verb, \{ sim: e\.time, loud,/);
  for (const hook of ["setLook:", "previewCape:", "previewGet:", "getHud:"]) assert.ok(js.includes(hook), hook);
  // HUD art is drawn by CSS: warmed, never decoded for the canvas, except
  // the meteor stone, which is also the world's asteroid (I's crash, II's eye).
  assert.match(js, /\.filter\(\(\[name, v\]\) => v\.file\?\.endsWith\("\.png"\) && \(!v\.hud \|\| name === "meteor"\)\)/);
});

test("style.css crops the breath bar's PNGs at their measured bounds (tests/art.test.mjs)", async () => {
  const near = (a, b, eps) => Math.abs(a - b) <= eps;
  // barrinha.png: frame 390 x 94 at (25, 77) of 442 x 250, hole x 54-386 and
  // y 108-141; recheioBarra.png: fill 822 x 102 at (129, 453) of 1080 x 1080.
  // Frame 100 px wide (k = 100 / 390), fill stretched onto the 86 x 9.4 track.
  const css = await read("style.css");
  const k = 100 / 390;
  const block = (sel) => css.slice(css.indexOf(`${sel} {`), css.indexOf("}", css.indexOf(`${sel} {`)));
  const nums = (rule, prop) => [...block(rule).match(new RegExp(`${prop}: ([^;]+);`))[1].matchAll(/-?[\d.]+/g)].map(Number);
  const [fw, fh] = nums(".breath-frame", "background-size"),
    [fx, fy] = nums(".breath-frame", "background-position");
  assert.ok(near(fw, 442 * k, 0.01) && near(fh, 250 * k, 0.01) && near(fx, -25 * k, 0.01) && near(fy, -77 * k, 0.01), "frame crop");
  const [tl, tt, tw, th] = ["left", "top", "width", "height"].map((p) => nums(".breath-track", p)[0]);
  // The track covers the hole (frame drawn at 16, 5) within a pixel.
  assert.ok(tl <= 16 + 29 * k && tl + tw >= 16 + 361 * k && tl >= 16 + 29 * k - 1 && tl + tw <= 16 + 361 * k + 1, "track x");
  assert.ok(tt <= 5 + 31 * k && tt + th >= 5 + 64 * k && tt >= 5 + 31 * k - 1 && tt + th <= 5 + 64 * k + 1, "track y");
  const [bw, bh] = nums(".breath-fill", "background-size"),
    [bx, by] = nums(".breath-fill", "background-position");
  assert.ok(near(bw, (1080 * tw) / 822, 0.01) && near(bh, (1080 * th) / 102, 0.02), "fill size");
  assert.ok(near(bx, (-129 * tw) / 822, 0.01) && near(by, (-453 * th) / 102, 0.02), "fill position");
});

test("looks are drawn only in the run, fading in with the world, and leave the HUD band's sky as it was", async () => {
  const js = await read("game.js");
  assert.match(js, /const lookAlpha = state\.status === "ready" \? 0 : /, "no body or accent on the title");
  assert.match(js, /if \(look && lookAlpha > 0\)/);
  assert.match(js, /\} else if \(!look && images\.saturn\) \{/, "no look: revision seven's faint rings");
  // Star density and Neptune's wobble apply below the band only.
  assert.match(js, /band = sy - reach < HUD_BAND;/);
  assert.match(js, /const wob = !band && density\.wobble/);
});
