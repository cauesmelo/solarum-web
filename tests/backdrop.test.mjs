/* Per-level looks (backdrop.mjs, RESEARCH_PROGRESSION 4.4): one body and
 * one sky accent per stop, only the palette tokens, Earth's blue alone,
 * nothing in the HUD band, subtle growth, still under reduced motion, and
 * revision seven's sky when a level names no look. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LOOKS, LOOK_IDS, HUD_BAND, TOKENS, lookOf, bodyBox, bodyTop, earthBox, skyDensity, cadentGap, createBackdrop } from "../backdrop.mjs";
import { LEVELS } from "../level.mjs";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");

test("one look per stop of the journey; a level without one keeps revision seven's sky", () => {
  assert.deepEqual(LOOK_IDS, ["home", "pluto", "neptune", "uranus", "saturn", "jupiter", "mars", "moon-earth"]);
  assert.equal(lookOf(undefined), null);
  assert.equal(lookOf({}), null);
  assert.equal(lookOf({ look: "pluto" }), "pluto");
  assert.equal(lookOf({ look: "vulcan" }), null, "an unknown id is today's sky, never an error");
  assert.equal(lookOf({ look: "pluto" }, "mars"), "mars", "QA override");
  // Today's levels name no look: the sky is unchanged (density 1, no wobble, the old shooting-star gap).
  for (const d of LEVELS) assert.equal(lookOf(d), d.look ?? null);
  assert.deepEqual(skyDensity(null), { stars: 1, dust: 1, wobble: 0 });
  assert.equal(cadentGap(null, 0), 4);
  assert.equal(cadentGap(null, 1), 10);
  // The accents differ: no two looks share a body, and each changes the sky somehow.
  const bodies = LOOK_IDS.map((id) => LOOKS[id].body);
  assert.equal(new Set(bodies).size, bodies.length);
  for (const id of LOOK_IDS) {
    const d = skyDensity(id);
    assert.ok(LOOKS[id].accent || d.stars !== 1 || d.dust !== 1, `${id} has a sky accent`);
  }
  assert.equal(skyDensity("pluto").stars, 0.5, "Pluto: half the stars");
  assert.ok(skyDensity("moon-earth").stars > 1.5, "the Moon: the most stars");
  assert.equal(skyDensity("neptune").wobble, 0.3, "Neptune: far stars wobble at 0.3 Hz");
  assert.ok(cadentGap("home", 1) < cadentGap(null, 0), "home: a shower of shooting stars");
});

test("bodies stay out of the HUD band at every width, progress and parallax, and grow subtly", () => {
  for (const id of LOOK_IDS) {
    const L = LOOKS[id];
    assert.ok(L.grow > 0 && L.grow <= 0.25, `${id} grows ${L.grow}`);
    for (const W of [720, 880, 1012, 1280])
      for (const progress of [0, 0.5, 1])
        for (const driftY of [-600, 0, 600])
          for (const driftX of [0, 20000]) {
            const b = bodyBox(id, { W, H: 675, progress, driftX, driftY });
            assert.ok(b.y - bodyTop(id, b.r) >= HUD_BAND + 4, `${id} at W ${W}, progress ${progress}, drift ${driftY}: top ${(b.y - bodyTop(id, b.r)).toFixed(1)}`);
            // Ahead of Diana (she runs at about a quarter of the view) and on
            // screen; the Moon is below her instead (its Earth is ahead).
            if (id !== "moon-earth") assert.ok(b.x > W * 0.45 && b.x - b.r < W, `${id} is ahead and visible`);
            else assert.ok(b.y - b.r > 675 * 0.6, "the Moon's limb is low");
          }
    const a = bodyBox(id, { W: 1012, H: 675, progress: 0 }),
      b = bodyBox(id, { W: 1012, H: 675, progress: 1 });
    assert.ok(Math.abs(b.r / a.r - (1 + L.grow)) < 1e-9 || a.r === 0, `${id} grows toward the door`);
  }
  // Earth (the last look only) grows from a glint to a crescent, under the HUD band.
  for (const id of LOOK_IDS) assert.equal(!!earthBox(id, { W: 1012, H: 675 }), id === "moon-earth", id);
  const e0 = earthBox("moon-earth", { W: 1012, H: 675, progress: 0 }),
    e1 = earthBox("moon-earth", { W: 1012, H: 675, progress: 1 });
  assert.ok(e1.r > e0.r * 3 && e1.y - e1.r >= HUD_BAND + 4 && e0.y - e0.r >= HUD_BAND + 4);
});

test("only the palette tokens; Earth's blue is drawn once, by Earth; paper stays faint", async () => {
  const src = await read("backdrop.mjs");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.deepEqual(Object.keys(TOKENS), ["ink", "paper", "hill", "mute", "dim", "earth"]);
  // No colour literal besides the token table and the alpha-only fade masks.
  const hex = code.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
  assert.deepEqual(hex, []);
  for (const m of code.matchAll(/rgba\((\d+),(\d+),(\d+),/g)) assert.deepEqual([m[1], m[2], m[3]], ["0", "0", "0"], "only the crop's alpha mask");
  const uses = [...code.matchAll(/rgba\("(\w+)", ([\d.]+)\)/g)].map((m) => [m[1], Number(m[2])]);
  assert.ok(uses.length >= 25);
  for (const [token] of uses) assert.ok(token in TOKENS, token);
  assert.equal(uses.filter(([t]) => t === "earth").length, 1, "one blue: Earth");
  // Bodies stay far below --mute over the playfield: paper at most 30%,
  // including the alphas passed to the outline, hatch and ring helpers.
  const passed = [
    ...[...code.matchAll(/outline\(g, r, \d+, ([\d.]+)/g)].map((m) => Number(m[1])),
    ...[...code.matchAll(/hatch\(g, [^,]+, [^,]+, [^,]+, ([\d.]+)\)/g)].map((m) => Number(m[1])),
    ...[...code.matchAll(/ring\(k, [^,]+, [^,]+, ([\d.]+)\)/g)].map((m) => Number(m[1])),
  ];
  assert.ok(passed.length >= 12, `${passed.length} helper alphas`);
  for (const a of [...uses.filter(([t]) => t === "paper").map(([, a]) => a), ...passed]) assert.ok(a <= 0.3, `paper at ${a}`);
});

/** A recording 2D context: every call and property write, for comparing frames. */
function recorder() {
  const log = [];
  const ctx = new Proxy(
    {},
    {
      get(t, k) {
        if (k === "log") return log;
        if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop: () => {} });
        return (...args) => log.push([k, ...args.map((a) => (typeof a === "number" ? Math.round(a * 1000) / 1000 : typeof a === "object" ? "obj" : a))]);
      },
      set(t, k, v) {
        log.push(["=" + String(k), v]);
        return true;
      },
    },
  );
  return ctx;
}
const fakeCanvas = (w, h) => ({ width: w, height: h, getContext: () => recorder() });

test("each look draws; under reduced motion every accent is still; Earth's crescent only in the last", () => {
  for (const reduced of [false, true]) {
    const sprites = [];
    const b = createBackdrop({ makeCanvas: fakeCanvas, images: { saturn: { width: 1920, height: 1080 } }, sprite: (ctx, ...a) => sprites.push(a), reduced });
    for (const id of LOOK_IDS) {
      const frame = (clock) => {
        const ctx = recorder();
        const view = { W: 1012, H: 675, clock, progress: 0.4, driftX: 3000, driftY: 0 };
        b.drawBody(ctx, id, view);
        b.drawAccent(ctx, id, view);
        return JSON.stringify(ctx.log);
      };
      const a = frame(1),
        c = frame(7.3);
      assert.ok(a.length > 20, `${id} draws`);
      // The accent layer is clipped below the HUD band.
      assert.ok(a.includes(`["rect",0,${HUD_BAND},1012,${675 - HUD_BAND}]`), `${id} clips the HUD band`);
      if (reduced) assert.equal(a, c, `${id} is still under reduced motion`);
      else if (["home", "neptune", "uranus", "saturn", "jupiter", "mars"].includes(id)) assert.notEqual(a, c, `${id} moves`);
      assert.equal(a.includes('"rgba(111,168,220,'), id === "moon-earth", `${id}: Earth's blue`);
    }
    // One cached body at a time (a level never shows two).
    // Two looks at most: the level's, and the next one during a transition.
    assert.ok(b.cacheSize() <= 2);
    assert.ok(sprites.length >= 2, "home's bright star is the original star sprite");
  }
});

test("the world is always drawn over the backdrop and under the HUD, the iris last (the Earth's crescent never covers a platform)", async () => {
  // The owner's video showed VIII's fixed Earth crescent where a thin platform
  // passes: in the real renderer the platform is in front (paper over blue,
  // checked pixel by pixel in common/artifacts/revision-5/solarum-video/), but
  // the order is the contract, so it is pinned here: sky -> body -> accent are
  // all inside drawSky(), which draw() calls before a single platform; the
  // beacons, stars and Diana follow; the iris is the last canvas layer. The
  // DOM HUD is a separate layer over the canvas (style.css).
  const src = await read("game.js");
  const draw = src.slice(src.indexOf("function draw() {"), src.indexOf("/* ---------- HUD and cards ---------- */"));
  const order = ["drawSky();", "drawUpdrafts();", "drawSigns();", "for (const q of state.platforms) drawPlatform(q);", "drawBeacons();", "drawConstellations();", "drawStars();", "drawPlayer();", "drawIris();"].map((k) => [k, draw.indexOf(k)]);
  for (const [k, at] of order) assert.ok(at > 0, `draw() calls ${k}`);
  for (let i = 1; i < order.length; i++) assert.ok(order[i][1] > order[i - 1][1], `${order[i][0]} comes after ${order[i - 1][0]}`);
  const sky = src.slice(src.indexOf("function drawSky() {"), src.indexOf("function drawSky() {") + 6000);
  assert.ok(sky.indexOf("backdrop.drawBody(ctx, look, view)") > 0 && sky.indexOf("backdrop.drawAccent(ctx, look, view)") > sky.indexOf("backdrop.drawBody(ctx, look, view)"), "the body and its accent are painted in drawSky");
  assert.ok(!/drawBody|drawAccent/.test(draw.replace(/drawSky\(\);/, "")), "draw() paints no backdrop body after the sky");
  // The renderer keeps no copy of the respawn's timings: they are the model's level physics.
  assert.ok(!/RULES\.respawn/.test(src), "game.js reads respawn timings from physics, not RULES");
  const css = await read("style.css");
  assert.ok(/#hud|\.hud/.test(css), "the HUD is DOM over the canvas");
});
