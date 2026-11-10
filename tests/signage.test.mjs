/* Glyph signs as still background signage (RESEARCH_TRANSITIONS §1, tests
 * T1-T4). The sign module never takes the player; these tests check that the
 * signature holds (T1), that every row is placed clear of Diana while she
 * reads it, of the stone and stars she needs and of the HUD band (T2), that
 * it is in view in time (T3, G1) and that only one row shows at once (T4). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createGame, start, update, jump, releaseJump, dash, dive, snapshot, retry } from "../model.mjs";
import { LEVELS, CARD, createLevel } from "../level.mjs";
import { signsAt, signRow, signWindow, signAlpha, dianaBox, rectsTouch, refWidthOf, portraitWidthOf, layoutScale } from "../signage.mjs";
import { viewGeometry, cameraTargetY, stepCamera, clampCameraY, VIEW } from "../geometry.mjs";
import { islandShape, undersidePoints } from "../islands.mjs";
import { playRoute } from "./routes.mjs";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const ROUTES = ["main", "upper", "ability", "safe"];
/** Diana's feet on every 120 Hz tick of a route, with the camera inputs. */
function trace(level, route) {
  const s = start(createGame(2021, { level }));
  const out = [];
  const api = {
    getState: () => snapshot(s),
    step: (dt, c) => {
      update(s, dt, c);
      out.push({ x: s.player.x, y: s.player.y, anchorY: s.anchorY, fallTime: s.fallTime, clock: s.clock ?? 1 });
      return snapshot(s);
    },
    jump: () => jump(s),
    releaseJump: () => releaseJump(s),
    dash: () => dash(s),
    dive: () => dive(s),
    tap: () => (jump(s), releaseJump(s)),
  };
  playRoute(api, { route, dt: 1 / 120 });
  return out;
}
const traces = new Map();
const tracesOf = (d) => {
  if (!traces.has(d.id)) traces.set(d.id, Object.fromEntries(ROUTES.filter((r) => d.routes[r]).map((r) => [r, trace(d.id, r)])));
  return traces.get(d.id);
};

test("T1: sign positions and opacity never depend on the player (Node sweep and static source check)", async () => {
  for (const d of LEVELS) {
    const W = refWidthOf(d);
    // Six player states: fresh, mid-route airborne, every prompt done, five
    // falls, dead / respawning, and after a retry.
    const states = [];
    const s0 = start(createGame(2021, { level: d.id }));
    states.push(structuredClone(s0.prompts));
    const s1 = start(createGame(2021, { level: d.id }));
    for (let i = 0; i < 600; i++) update(s1, 1 / 120, {});
    jump(s1);
    update(s1, 0.1, {});
    states.push(s1.prompts);
    const s2 = start(createGame(2021, { level: d.id }));
    for (const q of s2.prompts) q.done = true;
    states.push(s2.prompts);
    const s3 = start(createGame(2021, { level: d.id }));
    s3.deaths = 5;
    s3.player.y = 2000;
    update(s3, 1 / 120, {});
    states.push(s3.prompts);
    for (let i = 0; i < 40; i++) update(s3, 1 / 60, {});
    states.push(s3.prompts);
    retry(s3);
    states.push(s3.prompts);
    for (let cx = d.level.startX - W; cx <= d.level.finishX; cx += 5) {
      const base = signsAt(states[0], cx, W, W, 1, false);
      for (const ps of states.slice(1)) {
        const other = signsAt(ps, cx, W, W, 1, false);
        for (let i = 0; i < base.length; i++) assert.equal(other[i].alpha, base[i].alpha, `${d.numeral} ${base[i].id} at camera ${cx}`);
      }
      for (const [i, row] of base.entries()) {
        const q = d.prompts[i];
        assert.equal(row.x, q.x);
        assert.equal(row.y, q.y);
        assert.ok(row.discs.every((g) => g.y === q.y), `${q.id}: discs on the anchor's line`);
      }
    }
  }
  const js = await read("game.js");
  const body = js.slice(js.indexOf("function drawSigns() {"), js.indexOf("\n}\n", js.indexOf("function drawSigns() {")));
  for (const banned of ["state.player", "viewPos", "shownPrompts", ".done", ".after", "Math.sin(clock", "deaths", "status"]) assert.ok(!body.includes(banned), `drawSigns uses ${banned}`);
  assert.ok(!/gy -= bottom/.test(js), "the lift is gone");
  assert.ok(!/drawPrompts/.test(js), "the old player-relative glyph drawing is gone");
  const mod = await read("signage.mjs");
  assert.ok(!/\bplayer\b|state\.|\.done|\.after|status|deaths/.test(mod.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), "signage.mjs never reads the player");
});

/** The camera as play steps it (game.js updateCamera without the wake pan). */
function cameraYs(t) {
  let y = null;
  return t.map((p) => {
    const target = cameraTargetY(p.anchorY, p.fallTime);
    y = y == null ? target : stepCamera(y, target, 1 / 120 / p.clock);
    y = clampCameraY(y, p.y);
    // Also hold the settled target (a camera that has caught up).
    return Math.max(y, clampCameraY(target, p.y));
  });
}
test("T2: every sign is clear of Diana while she reads it, of stone, stars and the HUD band (P1-P3)", () => {
  for (const d of LEVELS) {
    const T = tracesOf(d),
      world = createLevel(d),
      refW = refWidthOf(d),
      portW = portraitWidthOf(d);
    for (const q of d.prompts) {
      for (const s of [1, 1.8]) {
        const row = signRow(q, s),
          R = row.rect;
        // P1: 8 px clear of her drawn box on every route for x < from.
        for (const [route, t] of Object.entries(T))
          for (const p of t) if (p.x < q.from) assert.ok(!rectsTouch(R, dianaBox(p.x, p.y), 8), `${d.numeral} ${q.id} (×${s}) touches Diana on ${route} at x ${p.x.toFixed(0)}`);
        // P2: off the top band and body of every island, off every pickup circle.
        for (const p of world.platforms) {
          if (R.right < p.x || R.left > p.x + p.width) continue;
          const thick = p.route === "high" && p.y < 600 ? 30 : p.type === "lid" ? 44 : 64;
          const under = undersidePoints(islandShape(p, p.x, p.width, thick)).filter((u) => u.x >= R.left - 20 && u.x <= R.right + 20);
          const bottom = Math.max(p.y + 24, ...under.map((u) => u.y));
          assert.ok(!(R.bottom > p.y - 8 && R.top < bottom), `${d.numeral} ${q.id} (×${s}) over ${p.id}`);
        }
        for (const st of world.pickups) {
          const cx = Math.max(R.left, Math.min(st.x, R.right)),
            cy = Math.max(R.top, Math.min(st.y, R.bottom));
          assert.ok(Math.hypot(cx - st.x, cy - st.y) >= (st.chain ? 40 : 34), `${d.numeral} ${q.id} (×${s}) over ${st.id}`);
        }
      }
      // P3: under the HUD band at the real camera, landscape (×1) and portrait (×1.8).
      for (const [W, s] of [[refW, 1], [portW, 1.8]]) {
        const row = signRow(q, s);
        for (const [route, t] of Object.entries(T)) {
          const ys = cameraYs(t);
          t.forEach((p, i) => {
            if (p.x >= q.from) return;
            const a = signAlpha(row, signWindow(p.x - viewGeometry(W).playerScreenX, W, refW));
            if (a > 0) assert.ok(row.rect.top - ys[i] >= VIEW.topBand + 8, `${d.numeral} ${q.id} in the HUD band on ${route} (W ${W})`);
          });
        }
      }
    }
  }
});

test("T3: every sign is at full opacity 1.5 s (real) before its latest input (G1); the title card never covers a required input, after a wake or a transition", () => {
  for (const d of LEVELS) {
    const refW = refWidthOf(d);
    for (const q of d.prompts)
      for (const [W, s] of [[refW, 1], [portraitWidthOf(d), 1.8]]) {
        const row = signRow(q, s);
        // The camera's player column when Diana is 1.5 s before the input.
        const P = q.inputX - 1.5 * d.clock * d.level.speed,
          win = signWindow(P - VIEW.playerFraction * W, W, refW);
        assert.ok(row.rect.right <= win.right - 64 + 1e-6, `${d.numeral} ${q.id} (W ${W}): ${((row.rect.right - (win.right - 64)) / d.level.speed).toFixed(2)} s late`);
      }
    // The card: 0.3 s in, 1.6 s hold, 0.5 s out, in simulation seconds. After
    // a wake it starts cardDelay after bar 1; after a transition it starts at
    // B2, two beats of the level's tempo before the run (§2.7).
    const span = (CARD.fadeIn + CARD.hold + CARD.fadeOut) * d.level.speed,
      beat = 60 / d.bpm;
    for (const from of [d.level.startX + (d.cardDelay ?? CARD.wakeDelay) * d.level.speed, d.level.startX - 2 * beat * d.clock * d.level.speed]) {
      assert.ok(!d.prompts.some((q) => !q.optional && q.inputX >= from && q.inputX <= from + span), `${d.numeral}: a required glyph under the card`);
      const first = tracesOf(d).main;
      assert.ok(first.length > 0);
    }
  }
  // The layout constant: 1 on a large sky, at most 1.8 on a phone.
  assert.equal(layoutScale(1), 1);
  assert.equal(layoutScale(0.3), 1.8);
});

test("T4: at most one sign has any opacity at once (G2), at the reference width, the portrait minimum and 21:9", () => {
  for (const d of LEVELS) {
    const refW = refWidthOf(d);
    for (const [W, s] of [[refW, 1], [portraitWidthOf(d), 1.8], [2100 * (VIEW.height / 900), 1]]) {
      let most = 0;
      for (let cx = d.level.startX - W; cx <= d.level.finishX; cx += 5) {
        const shown = signsAt(d.prompts, cx, W, refW, s).filter((r) => r.alpha > 0);
        most = Math.max(most, shown.length);
        assert.ok(shown.length <= 1, `${d.numeral} W ${Math.round(W)} camera ${cx}: ${shown.map((r) => r.id)}`);
      }
      assert.equal(most, 1, `${d.numeral}: its signs do show`);
    }
  }
});
