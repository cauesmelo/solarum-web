import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EMERGE_BEATS, START_CLIP_SECONDS, BURIED, SPRITE_SETS, emergenceAt, emergenceSeconds, resolveSet } from "../emergence.mjs";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const manifest = JSON.parse(await read("assets/manifest.json"));

/* ---------- the wake: Diana emerges from the earth (emergence.mjs) ---------- */
test("the emergence follows the trailer's beats and hands over to the start clip within 1.6 s", () => {
  const total = emergenceSeconds(false);
  assert.ok(total + START_CLIP_SECONDS <= 1.6, `press to running ${total + START_CLIP_SECONDS} s`);
  const phases = [];
  let lastDepth = Infinity,
    rose = false;
  for (let t = 0; t <= total + 0.05; t += 1 / 120) {
    const e = emergenceAt(t);
    if (phases.at(-1) !== e.phase) phases.push(e.phase);
    assert.ok(Number.isFinite(e.depth) && e.depth <= BURIED && e.depth >= -16, `depth ${e.depth} at ${t}`);
    if (e.phase === "rise") {
      assert.ok(e.depth <= lastDepth + 1e-9, "the rise never sinks");
      rose = true;
    }
    lastDepth = e.depth;
    assert.equal(e.done, t >= total);
  }
  assert.ok(rose);
  assert.deepEqual(phases, ["twitch", "rise", "look", "pop", "done"]);
  // Fully under the soil while the leaves twitch, head out for the look,
  // standing on the soil at the end.
  assert.equal(emergenceAt(0.1).depth, BURIED);
  assert.ok(emergenceAt(EMERGE_BEATS.full.twitch + EMERGE_BEATS.full.rise + 0.1).depth > 30);
  assert.equal(emergenceAt(total).depth, 0);
  // The title leaves are gone before the look (her own leaves take over).
  assert.equal(emergenceAt(EMERGE_BEATS.full.twitch + EMERGE_BEATS.full.rise).sprout.alpha, 0);
});
test("reduced motion: a short rise without shiver, hop or crumbs", () => {
  const total = emergenceSeconds(true);
  assert.ok(total < emergenceSeconds(false) / 2, `${total} s`);
  for (let t = 0; t <= total; t += 1 / 120) {
    const e = emergenceAt(t, { reduced: true });
    assert.equal(e.sprout.shake, 0);
    assert.equal(e.crumbs, 0);
    assert.ok(e.depth >= 0, "no hop above the soil");
  }
});
test("the sprite set is a parameter; the no-cape set falls back to the cape clips until it is extracted", () => {
  const cape = resolveSet(manifest, "cape");
  assert.equal(cape.fallback, false);
  for (const role of ["body", "start", "run"]) assert.ok(manifest.animations[cape[role]], `cape ${role}`);
  // Today the manifest has no no-cape sheets: the emergence still draws real clips.
  const now = resolveSet(manifest, "nocape");
  assert.equal(now.name, "cape");
  assert.equal(now.fallback, true);
  // Once extracted under the names the set expects, it is used as is.
  const withNoCape = { ...manifest, animations: { ...manifest.animations } };
  for (const clip of Object.values(SPRITE_SETS.nocape)) withNoCape.animations[clip] = manifest.animations.idle;
  const later = resolveSet(withNoCape, "nocape");
  assert.equal(later.name, "nocape");
  assert.equal(later.fallback, false);
  assert.equal(later.body, "nocapeIdle");
});

/* ---------- title, pause and victory UI (static contract) ---------- */
test("victory card: Continue and Retry only (no Title button); Continue leads on after the last level", async () => {
  const html = await read("index.html"),
    js = await read("game.js");
  const card = html.slice(html.indexOf('id="victory-card"'), html.indexOf("</div>\n      </div>", html.indexOf('id="victory-card"')) + 30);
  assert.match(card, /id="continue"/);
  assert.match(card, /id="again"/);
  assert.ok(!/to-title|>Title</.test(html), "no Title button anywhere");
  assert.match(js, /\$\("continue"\)\.addEventListener\("click", \(\) => \(state\.level >= LEVELS\.length \? toTitle\(\) : showMap\(state\.level \+ 1\)\)\)/);
  assert.match(js, /\$\("continue"\)\.focus\(/, "Continue is the default focus");
});
test("pause card offers Main menu, which returns to the title through toTitle()", async () => {
  const html = await read("index.html"),
    js = await read("game.js");
  const pause = html.slice(html.indexOf('id="pause-main"'), html.indexOf('id="pause-assist"'));
  for (const id of ["resume", "back-to-light", "restart-chapter", "main-menu"]) assert.match(pause, new RegExp(`id="${id}"`));
  assert.match(pause, />Main menu</);
  assert.match(js, /\$\("main-menu"\)\.addEventListener\("click", toTitle\)/);
  // toTitle un-pauses the engine before it starts the title song.
  const body = js.slice(js.indexOf("function toTitle()"), js.indexOf("/* ---------- input ---------- */"));
  assert.ok(body.indexOf("syncAudio();") < body.indexOf("audio.playMusic("), "resume, then the title song");
});
test("title: the level select is built from LEVELS, opaque, and the world is hidden behind it", async () => {
  const css = await read("style.css"),
    js = await read("game.js"),
    html = await read("index.html");
  assert.match(html, /id="stations"/);
  assert.ok(!/class="station"/.test(html), "no hard-coded stations");
  assert.match(js, /for \(const d of LEVELS\) \{\n    const li = document\.createElement\("li"\)/);
  const panel = css.slice(css.indexOf(".title-panel {"), css.indexOf("}", css.indexOf(".title-panel {")));
  assert.match(panel, /background: var\(--ink\);/, "the panel is solid ink");
  const stop = css.slice(css.indexOf("\n.stop {"), css.indexOf("}", css.indexOf("\n.stop {")));
  assert.match(stop, /background: var\(--ink\);/, "stops are solid");
  assert.ok(!/rgba\(12, 12, 15, 0\.55\)/.test(css), "the see-through station fill is gone");
  // Locked stops stay legible: a dashed ring and the --mute numeral, no fade.
  const locked = css.slice(css.indexOf('.stop[aria-disabled="true"] {'), css.indexOf("}", css.indexOf('.stop[aria-disabled="true"] {')));
  assert.match(locked, /color: var\(--mute\)/);
  assert.ok(!/opacity/.test(locked));
  // The world layer (stars, glyphs, beacons) is not drawn on the title.
  assert.match(js, /const worldAlpha = state\.status === "ready" \? 0 :/);
  // The shooting stars never run on the title either.
  assert.match(js, /if \(!reduced && state\.status !== "ready"\) \{\n    if \(!cadent/);
});
