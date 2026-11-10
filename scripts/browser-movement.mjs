/** Movement audit in a real browser (MOVEMENT_AUDIT.md, "Browser"): Chrome
 * through Playwright, real key events, the real assets and renderer.
 *   node serve.mjs --port 4403 &   then   node scripts/browser-movement.mjs
 * Playwright is not a dependency of this demo; pass its folder in
 * PLAYWRIGHT_FROM (default: the workspace's common/ folder).
 * Checks:
 *   C1  every Diana body frame the renderer draws (a drawImage hook) puts its
 *       lowest opaque pixel on the collider's feet (±2 px; the stride's
 *       float up to 7.5), over runs with real jumps, flights and dives
 *   A1  a keydown changes the state before the next frame is drawn
 *   A2  a key pressed during an 80 ms main-thread hitch is applied at its own
 *       timestamp (within one 1/120 s tick), not at the frame boundary
 *   A3  a release behind the pause card, or on window blur, cuts the jump
 *   QA  every level's main route wins with no fall, and the screenshot
 *       moments (I 12.41, II 25.93, III 31.85, IV 50.6 s) are alive
 * Exit code 1 on any failure. */
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const from = process.env.PLAYWRIGHT_FROM ?? new URL("../../common/", import.meta.url).pathname;
const { chromium } = createRequire(from + "package.json")("@playwright/test");
const url = process.env.URL ?? "http://127.0.0.1:4403/";
const routes = await import("../tests/routes.mjs");
const results = [];
const check = (name, ok, detail) => (results.push({ name, ok, detail }), console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
// Record every Diana body draw on the game canvas (frame, destination, the
// interpolated feet the renderer used) before the game loads.
await page.addInitScript(() => {
  const BODY = /\/(run|idle|air|bodyDash|drop|jumpLanding|softLanding|startStop)\.png$/;
  window.__draws = [];
  const original = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
    const g = window.__game;
    if (g?.model && a.length === 8 && img?.src && BODY.test(img.src) && this.canvas.id === "game" && this.globalAlpha > 0.5 && window.__draws.length < 20000) {
      const s = g.model,
        p = s.player,
        al = s.status === "running" ? s.alpha ?? 1 : 1;
      const far = p.px == null || Math.abs(p.x - p.px) > 60 || Math.abs(p.y - p.py) > 60;
      window.__draws.push({ src: img.src.split("/").pop(), sx: a[0], sy: a[1], sw: a[2], sh: a[3], dy: a[5], dh: a[7], feet: far ? p.y : p.py + (p.y - p.py) * al, anim: s.animation.name, status: s.status });
    }
    return original.call(this, img, ...a);
  };
});
await page.goto(url);
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 30000 });

// Lowest opaque row of every source rect, measured from the loaded images.
const lowest = async () =>
  page.evaluate(async (list) => {
    const out = {};
    const c = document.createElement("canvas"),
      x = c.getContext("2d", { willReadFrequently: true });
    for (const d of list) {
      const key = `${d.src}:${d.sx}:${d.sy}`;
      if (key in out) continue;
      const img = [...document.images].find((i) => i.src.endsWith(d.src)) ?? Object.assign(new Image(), { src: `assets/${d.src}` });
      await img.decode();
      const sx = Math.round(d.sx),
        sy = Math.max(0, Math.round(d.sy)),
        sw = Math.round(d.sw),
        sh = Math.round(d.sh);
      c.width = sw;
      c.height = sh;
      x.clearRect(0, 0, sw, sh);
      x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const px = x.getImageData(0, 0, sw, sh).data;
      let row = -1;
      for (let y = sh - 1; y >= 0 && row < 0; y--) for (let i = 0; i < sw; i++) if (px[(y * sw + i) * 4 + 3] > 64) ((row = y), (i = sw));
      out[key] = row;
    }
    return out;
  }, await page.evaluate(() => window.__draws));

const key = (code, ms = 40) => page.keyboard.down(code).then(() => page.waitForTimeout(ms)).then(() => page.keyboard.up(code));
const waitSim = (s) => page.waitForFunction((t) => window.__game.model.time >= t || window.__game.model.status !== "running", s, { timeout: 30000 });

/* ---- C1 with real keys: L1 (jumps, doubles, taps) and L2 (cape, dive) ---- */
await page.evaluate(() => window.__game.startLevel(1));
await page.waitForTimeout(400);
for (const ms of [40, 300, 80, 500, 30]) {
  await key("Space", ms);
  await page.waitForTimeout(220);
  await key("Space", 60);
  await page.waitForTimeout(700);
}
await page.evaluate(() => (window.__game.startLevel(2), window.__game.setAssist("endlessCape", true)));
await page.waitForTimeout(300);
for (let i = 0; i < 5; i++) {
  await key("Space", 200);
  await page.waitForTimeout(80);
  await key("KeyD", 120);
  await page.waitForTimeout(150);
  await key(i % 2 ? "KeyS" : "Space", 60);
  await page.waitForTimeout(700);
}
await page.evaluate(() => window.__game.setAssist("endlessCape", false));
{
  const draws = await page.evaluate(() => window.__draws.filter((d) => d.status === "running" || d.status === "respawning"));
  const rows = await lowest();
  const STRIDE = new Set(["run.png:4", "run.png:9", "softLanding.png:4", "softLanding.png:9", "jumpLanding.png:13", "jumpLanding.png:18", "startStop.png:3"]);
  const manifest = JSON.parse(await readFile(new URL("../assets/manifest.json", import.meta.url)));
  const frameIndex = (d) => {
    const sheet = Object.values(manifest).find((v) => v?.file?.endsWith("/" + d.src));
    return sheet.frames.findIndex((f) => Math.abs(f.x - d.sx) < 0.01 && Math.abs(f.y - d.sy) < 0.01);
  };
  let worst = 0,
    bad = [];
  const anims = new Set();
  for (const d of draws) {
    const row = rows[`${d.src}:${d.sx}:${d.sy}`];
    const toe = d.dy + ((row + 1) * d.dh) / d.sh;
    const off = d.feet - toe; // > 0: drawn above the feet
    const stride = STRIDE.has(`${d.src}:${frameIndex(d)}`);
    anims.add(d.anim);
    if (!stride) worst = Math.max(worst, Math.abs(off));
    if (stride ? off > 7.5 || off < -2 : Math.abs(off) > 2) bad.push(`${d.anim} ${d.src}[${frameIndex(d)}] ${off.toFixed(1)}`);
  }
  check("C1 drawn toe on the feet", draws.length > 300 && !bad.length && ["jump", "air", "dash", "dive", "run"].every((a) => anims.has(a)), `${draws.length} body draws over clips ${[...anims].join(",")}; worst off-stride ${worst.toFixed(2)} px; ${bad.length} outside (${bad.slice(0, 4).join("; ")})`);
}

/* ---- A1: a keydown acts before the next frame ---- */
await page.evaluate(() => window.__game.startLevel(2));
await page.waitForFunction(() => window.__game.model.player.grounded && window.__game.model.time > 0.5);
await page.evaluate(() => {
  window.__a1 = { frames: 0, at: null, vyAtNextFrame: null };
  window.addEventListener("keydown", (e) => e.code === "Space" && (window.__a1.at = window.__a1.frames), { once: true });
  const tick = () => {
    if (window.__a1.at !== null && window.__a1.vyAtNextFrame === null) window.__a1.vyAtNextFrame = window.__game.model.player.vy;
    window.__a1.frames++;
    if (window.__a1.frames < 600) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await key("Space", 50);
await page.waitForTimeout(100);
{
  const a1 = await page.evaluate(() => window.__a1);
  check("A1 keydown -> state before the next frame", a1.vyAtNextFrame < 0, `vy ${a1.vyAtNextFrame?.toFixed(0)} px/s on the first frame after the press`);
}

/* ---- A2: a press during an 80 ms hitch lands on its own timestamp ---- */
{
  const offsets = [];
  for (let trial = 0; trial < 4; trial++) {
    await page.evaluate(() => window.__game.startLevel(2));
    await page.waitForFunction(() => window.__game.model.player.grounded && window.__game.model.time > 0.4);
    await page.evaluate(() => {
      const g = window.__game,
        s = g.model;
      window.__a2 = { frames: [], press: null };
      const tick = (now) => {
        window.__a2.frames.push({ now, time: s.time, acc: s.acc ?? 0 });
        if (window.__a2.frames.length === 3) {
          const until = performance.now() + 80; // the hitch
          while (performance.now() < until);
        }
        if (window.__a2.frames.length < 40) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      window.addEventListener(
        "keydown",
        (e) => {
          const jumpEvent = s.events.filter((q) => q.name === "jump").at(-1);
          window.__a2.press = { ts: e.timeStamp, jumpTime: jumpEvent?.time, frames: window.__a2.frames.length };
        },
        { once: true },
      );
    });
    // Wait for the hitch frame to start, then press 35 ms into it.
    await page.waitForFunction(() => window.__a2.frames.length >= 2);
    await page.waitForTimeout(35 + trial * 8);
    await key("Space", 40);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ ...window.__a2, clock: window.__game.model.clock }));
    if (!r.press?.jumpTime) continue;
    const prev = [...r.frames].reverse().find((f) => f.now <= r.press.ts);
    // Simulation time the press's own timestamp corresponds to.
    const want = prev.time + prev.acc + ((r.press.ts - prev.now) / 1000) * r.clock;
    offsets.push({ errMs: ((r.press.jumpTime - want) / r.clock) * 1000, sinceFrameMs: r.press.ts - prev.now });
  }
  const ok = offsets.length >= 3 && offsets.every((o) => o.errMs <= 0.5 && o.errMs >= -(1000 / 120) / 1.0 - 0.5);
  check("A2 press during a hitch keeps its timestamp", ok, offsets.map((o) => `${o.sinceFrameMs.toFixed(0)} ms after the last frame -> applied ${o.errMs.toFixed(1)} ms from its own time`).join("; "));
}

/* ---- A3: releases behind the pause card and on blur ---- */
{
  await page.evaluate(() => window.__game.startLevel(2));
  await page.waitForFunction(() => window.__game.model.player.grounded && window.__game.model.time > 0.4);
  await page.keyboard.down("Space");
  await page.waitForTimeout(30);
  await page.keyboard.press("KeyP");
  await page.keyboard.up("Space");
  const paused = await page.evaluate(() => ({ status: window.__game.model.status, held: window.__game.model.jumpHeld, vy: window.__game.model.player.vy, cap: window.__game.model.physics.tapCap }));
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__game.model.player.grounded, null, { timeout: 5000 });
  await page.keyboard.down("Space");
  await page.waitForTimeout(30);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const blurred = await page.evaluate(() => ({ status: window.__game.model.status, held: window.__game.model.jumpHeld, vy: window.__game.model.player.vy }));
  await page.keyboard.up("Space");
  check("A3 release while paused / on blur", paused.status === "paused" && !paused.held && paused.vy >= -paused.cap && blurred.status === "paused" && !blurred.held, `paused: held ${paused.held}, vy ${paused.vy.toFixed(0)}; blur: ${blurred.status}, held ${blurred.held}`);
  await page.keyboard.press("KeyP");
}

/* ---- QA: routes and screenshot moments through the root-QA API ---- */
await page.evaluate(`window.__routes = { createRouteMemory: ${routes.createRouteMemory}, chooseAction: ${routes.chooseAction} }; ${routes.playRoute}; window.__play = playRoute;`);
for (const [n, moment] of [[1, 12.41], [2, 25.93], [3, 31.85], [4, 50.6]]) {
  const r = await page.evaluate(
    ([n, moment]) => {
      const createRouteMemory = window.__routes.createRouteMemory,
        chooseAction = window.__routes.chooseAction;
      window.createRouteMemory = createRouteMemory;
      window.chooseAction = chooseAction;
      const g = window.__game;
      const full = window.__play(g, { level: n, route: "main", maxSeconds: 120 });
      const shot = window.__play(g, { level: n, route: "main", maxSeconds: moment });
      return { status: full.status, deaths: full.state.deaths, time: full.time, shot: shot.status, shotDeaths: shot.state.deaths, shotTime: shot.time };
    },
    [n, moment],
  );
  check(`QA L${n} main route + moment ${moment}`, r.status === "won" && r.deaths === 0 && r.shot === "running" && r.shotDeaths === 0, `won in ${r.time.toFixed(2)} s sim, ${r.deaths} falls; at ${r.shotTime.toFixed(2)} s: ${r.shot}, ${r.shotDeaths} falls`);
}
check("no page or console errors", errors.length === 0, errors.slice(0, 3).join(" | ") || "none");
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} browser checks passed`);
process.exit(failed.length ? 1 : 0);
