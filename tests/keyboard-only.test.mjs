/* Solarum is a keyboard game: no mouse, no touch. The key tables are checked
 * as data (keymap.mjs), the pointer sink on a fake window (inert.mjs), and the
 * static contract of the page: nothing on it can be hit, no handler listens to
 * a pointer, no touch control or "tap" wording is left. The behaviour in
 * Chrome (real key events, real clicks and taps that do nothing, focus in the
 * itch iframe) is the root QA's (common/tests/browser.mjs). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as keys from "../keymap.mjs";
import { makeInert, POINTER_EVENTS } from "../inert.mjs";
import { createInk, KINDS } from "../ink-ui.mjs";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");

test("title keys: Space, Enter, Up and W wake; Left and Right choose; C opens the credits; M mutes", () => {
  for (const code of ["Space", "Enter", "ArrowUp", "KeyW"]) assert.equal(keys.titleKey(code), "wake", code);
  assert.equal(keys.titleKey("ArrowLeft"), "level-prev");
  assert.equal(keys.titleKey("ArrowRight"), "level-next");
  assert.equal(keys.titleKey("KeyC"), "credits");
  assert.equal(keys.titleKey("KeyM"), "sound");
  for (const code of ["KeyZ", "KeyF", "ArrowDown", "Escape", "Tab"]) assert.equal(keys.titleKey(code), null, code);
});

test("only open levels can be chosen on the title", () => {
  assert.equal(keys.canChoose(1, 1, 8), true);
  assert.equal(keys.canChoose(2, 1, 8), false, "locked");
  assert.equal(keys.canChoose(0, 6, 8), false, "before the first");
  assert.equal(keys.canChoose(6, 6, 8), true);
  assert.equal(keys.canChoose(7, 6, 8), false);
  assert.equal(keys.canChoose(9, 20, 8), false, "past the last");
  assert.equal(keys.canChoose(2.5, 6, 8), false);
});

test("pause card keys: arrows and Tab move the cursor, Enter and Space press, Esc and P go back, sliders keep their own arrows", () => {
  assert.deepEqual(keys.pauseKey("ArrowDown"), { move: 1 });
  assert.deepEqual(keys.pauseKey("ArrowUp"), { move: -1 });
  assert.deepEqual(keys.pauseKey("ArrowRight"), { move: 1 });
  assert.deepEqual(keys.pauseKey("ArrowLeft"), { move: -1 });
  assert.deepEqual(keys.pauseKey("Tab"), { move: 1 });
  assert.deepEqual(keys.pauseKey("Tab", { shift: true }), { move: -1 });
  assert.deepEqual(keys.pauseKey("Enter"), { press: true });
  assert.deepEqual(keys.pauseKey("Space"), { press: true });
  assert.deepEqual(keys.pauseKey("Escape"), { back: true });
  assert.deepEqual(keys.pauseKey("KeyP"), { back: true });
  // On a volume slider Left and Right change the value (the input's own keys); Up and Down still move.
  assert.deepEqual(keys.pauseKey("ArrowLeft", { slider: true }), { native: true });
  assert.deepEqual(keys.pauseKey("ArrowRight", { slider: true }), { native: true });
  assert.deepEqual(keys.pauseKey("ArrowDown", { slider: true }), { move: 1 });
  assert.equal(keys.pauseKey("Enter", { slider: true }), null, "Enter does nothing on a slider");
  assert.equal(keys.pauseKey("KeyZ"), null);
});

test("the cursor wraps round a menu and survives an empty one", () => {
  assert.equal(keys.menuStep(8, 7, 1), 0);
  assert.equal(keys.menuStep(8, 0, -1), 7);
  assert.equal(keys.menuStep(8, 3, 1), 4);
  assert.equal(keys.menuStep(0, 0, 1), -1);
});

test("the credits close with Esc, C, Backspace, Enter or Space; F and M belong to the page", () => {
  for (const code of ["Escape", "KeyC", "Backspace", "Enter", "Space"]) assert.ok(keys.CREDITS_CLOSE_KEYS.includes(code), code);
  assert.deepEqual([...keys.PAGE_KEYS].sort(), ["KeyF", "KeyM"]);
  assert.ok(Object.isFrozen(keys.WAKE_KEYS) && Object.isFrozen(keys.CREDITS_CLOSE_KEYS));
});

test("inert: every pointer, mouse and touch event is stopped at the window before any handler sees it, counted, and cancelled unless it is the focusing press", () => {
  const listeners = [];
  const win = { addEventListener: (type, fn, opts) => listeners.push({ type, fn, opts }) };
  const after = [];
  const inert = makeInert(win, { afterPointer: () => after.push("refocus"), defer: (fn) => fn() });
  for (const type of POINTER_EVENTS) {
    const l = listeners.find((q) => q.type === type);
    assert.ok(l, `a sink for ${type}`);
    assert.equal(l.opts.capture, true, `${type}: captured first`);
    assert.equal(l.opts.passive, false, `${type}: may cancel`);
  }
  assert.ok(listeners.find((q) => q.type === "wheel"), "the wheel too");
  const send = (type, extra = {}) => {
    const log = [];
    listeners.find((q) => q.type === type).fn({ type, button: 0, cancelable: true, preventDefault: () => log.push("prevented"), stopImmediatePropagation: () => log.push("stopped"), ...extra });
    return log;
  };
  // A click, a double click, the context menu, a drag start and a selection: stopped and cancelled.
  for (const type of ["click", "dblclick", "contextmenu", "dragstart", "selectstart", "auxclick", "pointerup", "mouseup"]) assert.deepEqual(send(type), ["stopped", "prevented"], type);
  // The primary press is the browser's way of focusing the page or the iframe: stopped, never cancelled.
  assert.deepEqual(send("mousedown"), ["stopped"], "mouse button 0 down is left to focus the page");
  assert.deepEqual(send("pointerdown"), ["stopped"]);
  assert.deepEqual(send("touchstart"), ["stopped"], "a touch start is never cancelled (often it cannot be)");
  // A middle or right press is cancelled (autoscroll, menus).
  assert.deepEqual(send("mousedown", { button: 1 }), ["stopped", "prevented"]);
  assert.deepEqual(send("pointerdown", { button: 2 }), ["stopped", "prevented"]);
  // An event that cannot be cancelled is not cancelled (no console warning).
  assert.deepEqual(send("click", { cancelable: false }), ["stopped"]);
  assert.ok(inert.swallowed.click === 2 && inert.swallowed.mousedown === 2);
  assert.equal(inert.total(), 14);
  assert.ok(after.length >= 3, "the game is told when a press is over, to put the key cursor back");
  // Every kind a mouse or a finger can send is covered.
  for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "touchstart", "touchend", "dragstart", "selectstart"]) assert.ok(POINTER_EVENTS.includes(type), type);
});

test("the page: nothing on the surface can be hit and the pointer is hidden", async () => {
  const css = await read("style.css");
  const rule = css.slice(css.indexOf(".solarum,\n.solarum *,"), css.indexOf("}", css.indexOf(".solarum,\n.solarum *,")));
  assert.match(rule, /pointer-events: none !important;/);
  assert.match(rule, /cursor: none !important;/);
  assert.match(css, /html,\nbody \{[^}]*cursor: none;/);
  assert.match(css, /touch-action: none;/);
  assert.match(css, /html,\nbody \{[^}]*touch-action: none;/);
  // No element opts back in, no hover state, no pointer-media query, no pointer cursor.
  assert.doesNotMatch(css, /pointer-events: auto|cursor: pointer|:hover|\(hover: hover\)|pointer: coarse|\.solarum\.touch/);
});

test("the markup has no touch control, no tap wording and no clickable button outside the two cards", async () => {
  const html = await read("index.html");
  for (const gone of ["touch-jump", "touch-cape", "touch-dive", "touch-swipe", "turn-hint", 'id="controls"', "tally-again", 'id="pause"', "itch-fullscreen"]) assert.ok(!html.includes(gone), `${gone} is gone`);
  assert.doesNotMatch(html, /\btap\b|\bTap\b|swipe|click/i, "no pointer wording");
  // The only buttons are the cards' (pause, assist, credits): keys move a drawn cursor over them.
  const outside = html.slice(0, html.indexOf('id="credits-veil"'));
  assert.doesNotMatch(outside, /<button/, "no button on the title, the HUD or the tally");
  // Each card control is a drawn mark with its key hint.
  const card = html.slice(html.indexOf('id="pause-veil"'));
  for (const id of ["resume", "back-to-light", "restart-chapter", "main-menu", "pause-sound", "assist-open", "assist-back"]) assert.match(card, new RegExp(`<button id="${id}"[^>]*data-ink="btn"`), id);
  assert.match(html, /Press space to wake|id="start-label"/);
  assert.match(html, /<kbd class="cap" data-ink="cap">M<\/kbd>/, "the sound key is named");
  assert.match(html, /<kbd class="cap" data-ink="cap">F<\/kbd>/, "the fullscreen key is named");
});

test("game.js listens to the keyboard only: no pointer, mouse, touch or click handler, no coarse-pointer branch", async () => {
  const js = await read("game.js");
  assert.doesNotMatch(js, /addEventListener\("(pointer\w*|mouse\w*|touch\w*|click|dblclick|wheel|contextmenu)"/);
  assert.doesNotMatch(js, /matchMedia\("\(pointer|matchMedia\("\(hover|setPointerCapture|pointerType|\bcoarse\b/);
  assert.doesNotMatch(js, /Tap to wake|or tap|\btap to\b/i);
  assert.match(js, /"Press space to wake"/);
  // Keys never depend on which element has focus: the handlers hang on the window.
  assert.match(js, /window\.addEventListener\("keydown", \(e\) => \{\n  \/\/ The browser's own shortcuts/);
  assert.match(js, /const inert = makeInert\(window, \{ afterPointer: \(\) => restoreKeyFocus\(\) \}\);/);
  // F is the page's (embed.js), M the game's, on every screen.
  assert.match(js, /if \(e\.code === "KeyM"\) \{/);
});

test("embed.js: no fullscreen button to click; F toggles fullscreen, a held key does not flicker, browser shortcuts are left alone", async () => {
  const embed = await read("embed.js");
  assert.doesNotMatch(embed, /createElement\("button"\)|addEventListener\("click"|itch-fullscreen/);
  assert.match(embed, /e\.code !== "KeyF" \|\| e\.repeat \|\| e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey/);
  assert.match(embed, /surface\.requestFullscreen\(\)/);
  const itch = JSON.parse(await read("itch.json"));
  assert.equal(itch.embed.mobileFriendly, false, "a desktop keyboard game");
  assert.equal(itch.embed.fullscreenButton, true, "itch's own fullscreen button stays on the page");
});

test("every drawn host in the markup names a kind the glue knows", async () => {
  const html = await read("index.html");
  const kinds = new Set([...html.matchAll(/data-ink="([a-z-]+)"/g)].map((q) => q[1]));
  const js = await read("game.js");
  for (const q of js.matchAll(/data-ink="([a-z-]+)"/g)) kinds.add(q[1]);
  for (const q of js.matchAll(/dataset\.ink = "([a-z-]+)"/g)) kinds.add(q[1]);
  assert.ok(kinds.size >= 10, `${kinds.size} kinds in use`);
  for (const kind of kinds) assert.ok(KINDS[kind], `a drawing for "${kind}"`);
});

test("ink-ui kinds draw every mark from the host's own state: selected, locked, pressed, off", () => {
  // A minimal host: the kinds only read dataset, classList and attributes.
  const host = (dataset = {}, classes = [], attrs = {}) => ({
    dataset,
    classList: { contains: (c) => classes.includes(c) },
    getAttribute: (k) => attrs[k] ?? null,
  });
  const ctx = { w: 44, h: 44, phase: 0, seed: 11 };
  const open = KINDS.stop(host({}), ctx),
    selected = KINDS.stop(host({ selected: "true" }), ctx),
    locked = KINDS.stop(host({ locked: "true" }), ctx);
  assert.deepEqual(open.map((p) => p.cls), ["ink-paper"]);
  assert.deepEqual(selected.map((p) => p.cls), ["ink-paper", "ink-paper"], "a disc and an outer ring");
  assert.deepEqual(locked.map((p) => p.cls), ["ink-dim"], "dashed, dim");
  assert.notEqual(open[0].d, KINDS.stop(host({}), { ...ctx, seed: 12 })[0].d, "another seed, another ring");
  assert.notEqual(open[0].d, KINDS.stop(host({}), { ...ctx, phase: 1 })[0].d, "the boil moves it");
  // A button always carries its cursor loop (shown only under .is-cursor); primary fills with ink.
  const btn = KINDS.btn(host({}, ["primary"]), { w: 280, h: 48, phase: 0, seed: 3 });
  assert.ok(btn.some((p) => p.cls.includes("ink-focus")));
  assert.equal(btn[0].cls, "ink-ink");
  assert.equal(KINDS.btn(host({}), { w: 280, h: 48, phase: 0, seed: 3 })[0].cls, "ink-paper");
  const on = KINDS.toggle(host({}, [], { "aria-pressed": "true" }), { w: 360, h: 50, phase: 0, seed: 5 }),
    off = KINDS.toggle(host({}, [], { "aria-pressed": "false" }), { w: 360, h: 50, phase: 0, seed: 5 });
  assert.equal(on.length, off.length + 1, "the ink disc behind the star when on");
  assert.equal(KINDS.badge(host({}, ["off"]), { w: 42, h: 42, phase: 0, seed: 1 }).length, 2, "a slash when the sound is off");
  assert.equal(KINDS.badge(host({}), { w: 42, h: 42, phase: 0, seed: 1 }).length, 1);
});

test("createInk without a document is inert, and reduced motion never boils", () => {
  const ink = createInk({ reduced: true, doc: null });
  assert.equal(ink.boil(), 0);
  assert.equal(ink.phase, 0, "the phase stays at 0 under reduced motion");
  assert.equal(ink.count, 0);
  const live = createInk({ reduced: false, doc: null });
  assert.equal(live.boil(), 0, "nothing drawn, nothing to step");
  assert.equal(live.phase, 1, "but the phase advances (it is the clock)");
});

test("every element id game.js reads exists in the markup (a removed control must not leave a null behind)", async () => {
  const js = await read("game.js"),
    html = await read("index.html");
  const ids = new Set([...js.matchAll(/\$\("([a-z][a-z0-9-]*)"\)/g)].map((q) => q[1]));
  ids.delete("ink-noise"); // lives in the SVG defs, still in index.html
  assert.ok(ids.size > 60, `${ids.size} ids read`);
  const missing = [...ids].filter((id) => !html.includes(`id="${id}"`));
  assert.deepEqual(missing, [], "ids game.js reads that index.html does not have");
  assert.ok(html.includes('id="ink-noise"'));
});
