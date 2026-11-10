import {
  createGame,
  start,
  restart,
  retry,
  update,
  jump,
  releaseJump,
  dash,
  dive,
  togglePause,
  snapshot,
  setAssist,
  capeReady,
  RULES,
} from "./model.mjs";
import { LEVELS, CARD, checkpointIndex, shownPrompts } from "./level.mjs";
import { characterLayers, frameForClip, footFor } from "./animation.mjs";
import {
  VIEW,
  outlineY,
  portalPlacement,
  viewGeometry,
  fitStage,
  cameraTargetY,
  clampCameraY,
  stepCamera,
} from "./geometry.mjs";
import { createAudioEngine, readSoundSetting, writeSoundSetting, readGentleSetting, writeGentleSetting } from "./audio.mjs";
import { createFrameClock } from "./frame-clock.mjs";

/* Renderer, input and UI. All gameplay rules live in model.mjs / level.mjs;
 * this file only draws the simulation, forwards input and plays sound. */
const $ = (id) => document.getElementById(id);
const root = $("solarum"),
  canvas = $("game"),
  ctx = canvas.getContext("2d");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;
const INK = "#0c0c0f",
  PAPER = "#fbfbea",
  HILL = "#cecec1",
  MUTE = "#aeaea3",
  DIM = "#777771",
  EARTH = "#6fa8dc";
/* Levels (RESEARCH_LEVELS): the state carries its level definition. Progress
 * (which levels are open, the best Great Stars of each) is kept in guarded
 * storage; without storage every session starts with level I open. */
const PROGRESS_KEY = "solarum.levels";
function readProgress() {
  try {
    const v = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "null");
    if (v && Number.isInteger(v.unlocked)) return { unlocked: Math.max(1, Math.min(LEVELS.length, v.unlocked)), great: v.great ?? {}, done: v.done ?? {} };
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return { unlocked: 1, great: {}, done: {} };
}
function writeProgress() {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* storage blocked: progress lasts for this session */
  }
}
const progress = readProgress();
const state = createGame(2021, { level: 1 });
const WORLD = () => state.def.level;
const images = {};
let manifest = null,
  ready = false,
  W = 1012,
  H = VIEW.height,
  pixelScale = 1,
  layout = "landscape",
  clock = 0,
  lastSerial = 0,
  wakeAt = -99,
  wonAt = -99,
  pace = 1, // Gentle pace multiplies every level's own clock (0.8)
  shake = 0,
  turnHintShown = false;
const held = { glide: false };
const camera = { x: 0, y: 0, snap: true };
const fx = []; // short-lived particles in world space
const ui = {
  // {text|id, at}: `at` is simulation time (state.time), never wall-clock.
  card: null,
  story: null,
  tip: null,
  orbitBrightUntil: 0,
  beaconLitAt: {},
  victoryShown: false,
  stars: -1,
  great: "",
  cape: null,
  progress: -1,
};

/* ---------- sound: cues, the adaptive score (audio.mjs, score.mjs) and the
 * soundtrack, which plays on the title and returns at the far door ----------
 * Sound defaults to ON unless the player turned it off (guarded storage). The
 * AudioContext is only created inside a gesture (the wake press / tap, or the
 * sound toggle); pausing the game freezes all audio in place. */
const sound = {
  on: readSoundSetting(() => window.localStorage),
  gentle: readGentleSetting(() => window.localStorage),
  music: new Audio(),
};
// Phones get a shorter space reverb (at most 4 s) to save CPU.
const audio = createAudioEngine({ enabled: sound.on, gentle: sound.gentle, spaceSeconds: coarse ? 4 : 5.5, level: state.level });
/** Simulation seconds per real second: the level's clock (BPM / 107) times
 * Gentle pace, so the arcs stay identical and only time is scaled. */
const simScale = () => pace * (state.clock ?? 1);
sound.music.preload = "none";
sound.music.loop = true;
audio.attachMusic(sound.music); // level: MUSIC_LEVEL, matched to the score
function unlockAudio() {
  audio.unlock(); // guarded: a missing device never blocks play
}
function setSound(on) {
  sound.on = on;
  writeSoundSetting(() => window.localStorage, on);
  for (const id of ["sound", "pause-sound"]) {
    $(id).setAttribute("aria-pressed", String(on));
    $(id).classList.toggle("off", !on);
  }
  $("pause-sound").textContent = on ? "♫ Sound on" : "♫ Sound off";
  $("sound").setAttribute("aria-label", on ? "Sound on" : "Sound off");
  audio.setEnabled(on);
  if (on && state.status !== "ready") {
    unlockAudio();
    audio.play("ui-select");
  }
}
/* Cracked shelves have no shake / fall events (the simulation only needs
 * their timestamps), so the renderer watches their state to voice them. */
const shelfWatch = new Map(); // platform id -> { triggered, collapsed, voice }
function watchShelves(loud) {
  for (const q of state.platforms) {
    if (q.type !== "crumble") continue;
    let w = shelfWatch.get(q.id);
    if (!w) shelfWatch.set(q.id, (w = { triggered: q.triggeredAt != null, collapsed: q.collapsed, voice: null }));
    const triggered = q.triggeredAt != null;
    if (triggered && !w.triggered && !q.collapsed && loud) w.voice = audio.play("crumble-shake", { duration: q.crumbleAfter ?? 0.65 });
    if (q.collapsed && !w.collapsed) {
      w.voice?.stop(0.04);
      w.voice = null;
      // A dive smash voices itself; only a shelf that gave way on its own crunches.
      if (loud && q.smashedAt == null) audio.play("crumble-fall");
    }
    w.triggered = triggered;
    w.collapsed = q.collapsed;
  }
}
function resetShelfWatch() {
  for (const w of shelfWatch.values()) w.voice?.stop(0.04);
  shelfWatch.clear();
  watchShelves(false);
}
function syncAudio() {
  // Every pause path (button, P/Esc, blur, hidden tab, assist panel) sets
  // status 'paused'; the engine suspends the context and the music with it.
  audio.setPaused(state.status === "paused");
  const p = state.player,
    live = state.status === "running";
  audio.setAir({ wind: live && p.inWind, glide: live && p.gliding && !p.inWind });
  // The score follows the simulation clock (never the other way round).
  audio.scoreFrame({ simTime: state.time, x: p.x, y: p.y, status: state.status, timeScale: simScale(), inWind: p.inWind, gliding: p.gliding, fallsHere: state.fallsHere });
}
function setGentleMusic(on) {
  sound.gentle = !!on;
  writeGentleSetting(() => window.localStorage, sound.gentle);
  audio.setGentle(sound.gentle);
  $("gentle-music")?.setAttribute("aria-pressed", String(sound.gentle));
}

/* ---------- layout: landscape fills, portrait letterboxes above a deck ---------- */
function resize() {
  const box = root.getBoundingClientRect();
  if (!box.width || !box.height) return;
  // Faster levels keep 2.5 s of lookahead with a wider minimum view.
  const fit = fitStage(box.width, box.height, 60, state.def.view);
  layout = fit.layout;
  root.dataset.layout = layout;
  root.style.setProperty("--stage-top", `${fit.top}px`);
  root.style.setProperty("--stage-h", `${fit.cssHeight}px`);
  W = fit.logicalWidth;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(fit.cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(fit.cssHeight * dpr));
  pixelScale = canvas.height / H;
  if (layout === "portrait" && !turnHintShown && ready) {
    turnHintShown = true;
    $("turn-hint").hidden = false;
    setTimeout(() => ($("turn-hint").hidden = true), 4000);
  }
  camera.snap = true;
  if (ready) draw();
}
new ResizeObserver(resize).observe(root);

/* ---------- drawing helpers ---------- */
function frameRect(sheet, index) {
  const data = manifest[sheet];
  return data?.frames[Math.max(0, Math.floor(index)) % data.frames.length];
}
function sprite(sheet, index, x, y, scale, alpha = 1, rotation = 0) {
  const img = images[sheet],
    f = frameRect(sheet, index);
  if (!img || !f) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  ctx.drawImage(img, f.x, f.y, f.w, f.h, (-f.w * scale) / 2, (-f.h * scale) / 2, f.w * scale, f.h * scale);
  ctx.restore();
}
/** RESEARCH_LEVELS F1: airborne frames leave empty space under the toe, so
 * drawn bottom-anchored they float 15-36 px above the collider's feet and
 * promise height the physics never gives. manifest.json bakes each such
 * frame's measured lift as `foot` (scripts/measure-feet.mjs) and Diana's
 * frames are drawn that much lower (animation.mjs footFor), in full on the
 * frame the pose changes, so what you see is what collides at any refresh
 * rate (MOVEMENT_AUDIT C1). Ground clips keep their stride bob; PNGs, pivots
 * and timing are unchanged. */
function drawDianaLayers(c, name, age, x, feet) {
  for (const layer of characterLayers(manifest, name, age)) {
    const f = manifest[layer.sheet].frames[layer.frame],
      img = images[layer.sheet],
      scale = 0.42;
    if (!img) continue;
    // Unity pivots are measured from the bottom; logical origin is 100 source
    // pixels above the collider feet, matching the original Player prefab.
    c.drawImage(img, f.x, f.y, f.w, f.h, x - f.w * f.pivotX * scale, feet - 42 - f.h * (1 - f.pivotY) * scale, f.w * scale, f.h * scale);
  }
}
const off = document.createElement("canvas"),
  offCtx = off.getContext("2d");
off.width = 480;
off.height = 400;
/** M1: the cape is the meter. A spent cape is tinted --dim at 60% with an
 * offscreen source-atop pass. Body and cape share one sheet in most original
 * clips, so the tint is a gradient across the trailing (left) half where the
 * cape is drawn, fading out before Diana's face and chest. */
function drawDiana(name, age, x, feet, alpha = 1, tint = 0) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (tint <= 0.01) {
    drawDianaLayers(ctx, name, age, x, feet);
    ctx.restore();
    return;
  }
  const S = 2;
  offCtx.setTransform(S, 0, 0, S, 0, 0);
  offCtx.globalCompositeOperation = "source-over";
  offCtx.clearRect(0, 0, 240, 200);
  drawDianaLayers(offCtx, name, age, 120, 170);
  offCtx.globalCompositeOperation = "source-atop";
  const g = offCtx.createLinearGradient(120 - 44, 0, 120 + 10, 0);
  g.addColorStop(0, `rgba(119,119,113,${0.6 * tint})`);
  g.addColorStop(0.62, `rgba(119,119,113,${0.6 * tint})`);
  g.addColorStop(1, "rgba(119,119,113,0)");
  offCtx.fillStyle = g;
  offCtx.fillRect(0, 0, 240, 200);
  offCtx.globalCompositeOperation = "source-over";
  ctx.drawImage(off, 0, 0, 240 * S, 200 * S, x - 120, feet - 170, 240, 200);
  ctx.restore();
}
function diamond(x, y, r, color = PAPER, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r);
  ctx.fill();
  ctx.restore();
}
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
const sky = Array.from({ length: 46 }, (_, i) => ({
  x: hash(i),
  y: 30 + hash(i + 99) * 520,
  group: [0, 4, 8, 12, 16, 20, 24][i % 7],
  size: 0.05 + hash(i + 7) ** 3 * 0.1,
  depth: 0.02 + hash(i + 3) * 0.05,
  phase: hash(i + 13) * 4,
}));
const dust = Array.from({ length: 90 }, (_, i) => ({
  x: hash(i + 500),
  y: 20 + hash(i + 600) * 560,
  r: 0.6 + hash(i + 700) * 1.1,
  a: 0.15 + hash(i + 800) * 0.45,
}));
let cadent = null,
  nextCadent = 3,
  saturnRings = null;
function ringsOnly(img) {
  const c = document.createElement("canvas"),
    limb = Math.round(img.width * 0.565); // the planet body starts here
  c.width = limb;
  c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0, limb, img.height, 0, 0, limb, img.height);
  g.globalCompositeOperation = "destination-in";
  const fade = g.createLinearGradient(0, 0, limb, 0);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.25, "rgba(0,0,0,1)");
  fade.addColorStop(0.7, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = fade;
  g.fillRect(0, 0, limb, img.height);
  return c;
}
/** Why she runs: a tiny Earth glint far ahead with the signal pulsing out of
 * it. It sits in the sky beyond the course and grows a little with progress. */
function drawSignal() {
  if (state.status === "ready") return;
  const progress = progressOf(state.player.x),
    x = W * 0.86,
    y = 128 - progress * 10,
    r = 2.4 + progress * 2.6,
    t = reduced ? 0.4 : (clock % 2.4) / 2.4;
  ctx.save();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = (1 - t) * 0.5;
  ctx.beginPath();
  ctx.arc(x, y, r + 4 + t * 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = EARTH;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---------- world ---------- */
function drawSky() {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  for (const d of dust) {
    let sx = (d.x * W * 1.4 - camera.x * 0.015) % (W * 1.4);
    if (sx < 0) sx += W * 1.4;
    ctx.fillStyle = `rgba(251,251,234,${d.a})`;
    ctx.beginPath();
    ctx.arc(sx, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Original twinkling background stars (bg-stars sheet, 4-frame groups).
  for (const s of sky) {
    let sx = (s.x * (W + 200) - camera.x * s.depth) % (W + 200);
    if (sx < 0) sx += W + 200;
    const f = s.group + (reduced ? 2 : Math.floor(clock * 3 + s.phase) % 4);
    sprite("background", f, sx - 100, s.y - camera.y * 0.05, s.size * 1.6, 0.8);
  }
  if (images.saturn) {
    // Only the ring strokes of the original Saturn art, faded at both ends:
    // the planet's hard limb read as a rendering artifact at the screen edge.
    saturnRings ??= ringsOnly(images.saturn);
    const scale = (H / images.saturn.height) * 1.05;
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.drawImage(saturnRings, W * 0.08 - ((camera.x * 0.003) % 30), (H - saturnRings.height * scale) / 2, saturnRings.width * scale, saturnRings.height * scale);
    ctx.restore();
  }
  // Original shooting-star clips (cadent1/2), never under reduced motion.
  if (!reduced && state.status !== "ready") {
    if (!cadent && clock > nextCadent) {
      const big = hash(clock) > 0.5;
      cadent = {
        clip: big ? "cadent1" : "cadent2",
        x: W * (0.35 + hash(clock + 1) * 0.6),
        y: 40 + hash(clock + 2) * 140,
        at: clock,
      };
    }
    if (cadent) {
      const clip = manifest.animations[cadent.clip],
        age = clock - cadent.at;
      if (age > clip.duration) {
        cadent = null;
        nextCadent = clock + 4 + hash(clock) * 6;
      } else {
        const f = frameForClip(manifest, cadent.clip, age);
        sprite(f.sheet, f.frame, cadent.x, cadent.y, 0.5, 0.75);
      }
    }
  }
}
/** Hand-drawn island silhouettes. Each platform gets its own depth, keel
 * position and lobes from a stable hash, so neighbouring hops never look
 * stamped. The sides taper inward right under the walkable top: the drawn
 * lip never reaches past the collider, so a near miss cannot look like
 * Diana sinking into stone. */
function islandPath(q, x, w, thick, jitter = 0) {
  const y = q.y + jitter,
    h = hash(q.phase * 3.7 + 1),
    h2 = hash(q.phase * 5.3 + 2),
    depth = thick * (0.72 + h * 0.6),
    keel = 0.3 + h2 * 0.4,
    inset = Math.min(10, w * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y + 2);
  for (let k = 0; k <= w; k += 20) ctx.lineTo(x + Math.min(k, w), outlineY(q, Math.min(k, w)) + jitter);
  ctx.lineTo(x + w, y + 3);
  ctx.quadraticCurveTo(x + w - inset * 0.4, y + 9, x + w - inset, y + 12);
  if (w > 520) {
    // Long islands: two lobes instead of one giant wedge.
    const mid = x + w * (0.45 + h * 0.1);
    ctx.bezierCurveTo(x + w * 0.9, y + depth * 0.9, mid + w * 0.12, y + depth * 0.95, mid, y + depth * 0.62);
    ctx.bezierCurveTo(mid - w * 0.1, y + depth * 1.05, x + w * 0.12, y + depth * 0.9, x + inset, y + 12);
  } else {
    ctx.bezierCurveTo(
      x + w * (keel + 0.45), y + depth + 12,
      x + w * (keel - 0.25), y + depth + 8,
      x + inset, y + 12,
    );
  }
  ctx.quadraticCurveTo(x + inset * 0.4, y + 9, x, y + 3);
  ctx.closePath();
}
function crackLines(q, x, w, y, lid) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = "round";
  const step = lid ? 46 : 58;
  for (let k = 26; k < w - 14; k += step) {
    const s = hash(q.phase * 31 + k);
    ctx.beginPath();
    ctx.moveTo(x + k, y + 1);
    ctx.lineTo(x + k - 6 + s * 4, y + 9);
    ctx.lineTo(x + k + 5, y + 17);
    ctx.lineTo(x + k - 2, y + 27);
    if (lid) ctx.lineTo(x + k + 8, y + 36);
    ctx.stroke();
  }
}
function drawPlatform(q) {
  const left = camera.x - 120,
    right = camera.x + W + 120;
  if (q.x > right || q.x + q.width < left) return;
  const x = q.x,
    w = q.width,
    cracked = !!q.type;
  const thick = q.route === "high" && q.y < 600 ? 30 : q.type === "lid" ? 44 : 64;
  if (q.collapsed) {
    const at = q.smashedAt ?? q.collapsedAt ?? state.time,
      age = state.time - at;
    if (age < 1.3) {
      // Falling chips: paper with ink edges, so the break reads in one glance.
      for (let k = 0; k < 7; k++) {
        const s = hash(q.phase * 7 + k),
          fall = age * age * 520 + age * 60 * s;
        ctx.save();
        ctx.translate(x + (k + 0.5) * (w / 7), q.y + 10 + fall);
        ctx.rotate(age * (s - 0.5) * 6);
        ctx.globalAlpha = Math.max(0, 1 - age / 1.3);
        ctx.fillStyle = PAPER;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-w / 18, -6);
        ctx.lineTo(w / 16, -4);
        ctx.lineTo(w / 22, 8);
        ctx.lineTo(-w / 20, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    return;
  }
  // Fragile surfaces always shake before they fall (telegraph, no text).
  let warn = 0;
  if (q.type === "crumble" && q.triggeredAt !== null)
    warn = Math.min(1, (state.time - q.triggeredAt) / q.crumbleAfter);
  if (q.collapseAt != null) {
    const lead = q.collapseAt - state.time;
    if (lead < RULES.cascadeShake) warn = 1 - lead / RULES.cascadeShake;
  }
  const jitter = warn > 0 && !reduced ? Math.sin(clock * 70 + q.phase) * 1.6 * warn : 0;
  islandPath(q, x + jitter * 0.6, w, thick, Math.abs(jitter) * 0.5);
  ctx.fillStyle = PAPER;
  ctx.fill();
  if (warn > 0) {
    // Grey means one thing only: this stone is breaking right now.
    ctx.fillStyle = `rgba(119,119,113,${0.4 * warn})`;
    ctx.fill();
  }
  ctx.strokeStyle = MUTE;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x + 22, q.y + 10);
  ctx.quadraticCurveTo(x + w * 0.34, q.y + 15, x + w * 0.78, q.y + 9);
  ctx.stroke();
  if (q.type === "crumble" || q.type === "cascade") crackLines(q, x + jitter, w, q.y, false);
  else if (q.type === "lid") drawLid(q, x, w);
  else if (q.route === "high") {
    // Optional stable stone: a dotted rim and a small star tick, never grey.
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.setLineDash([1, 7]);
    ctx.beginPath();
    ctx.moveTo(x + 22, q.y + 6);
    ctx.lineTo(x + w - 14, q.y + 6);
    ctx.stroke();
    ctx.restore();
    diamond(x + 12, q.y + 8, 4.5, INK, 0.85);
  }
  ctx.fillStyle = INK;
  for (let k = 46; k < w - 30; k += 86) {
    ctx.beginPath();
    ctx.moveTo(x + k, q.y + thick * 0.45);
    ctx.lineTo(x + k + 11, q.y + thick * 0.48);
    ctx.lineTo(x + k + 4, q.y + thick * 0.5);
    ctx.fill();
  }
}
/** A cracked lid has its own look: one star-shaped break radiating from its
 * centre with starlight glinting out of it (the well below is alive), not
 * the zigzag edge cracks of a crumbling shelf. */
function drawLid(q, x, w) {
  const cx = x + w / 2,
    cy = q.y + 12;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = "round";
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (0.08 + (k / 6) * 0.84),
      len = w * (0.22 + hash(q.phase + k) * 0.18);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * len * 0.5 + 4, cy + Math.sin(a) * 9 - 8);
    ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * 16 - 10);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(cx, cy - 2, 9, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  const twinkle = reduced ? 0.7 : 0.5 + 0.5 * Math.sin(clock * 3);
  diamond(cx, cy - 2, 3 + twinkle * 3, PAPER, 0.95);
  if (!reduced)
    for (let k = 0; k < 4; k++) {
      const t = (clock * 0.9 + k * 0.37) % 1.6;
      if (t > 0.6) continue;
      const a = Math.PI * (0.15 + k * 0.23),
        r = w * 0.18;
      diamond(cx + Math.cos(a) * r, cy + Math.sin(a) * 10 - 8, 1.5 + 4 * Math.sin((t / 0.6) * Math.PI), PAPER, 0.9);
    }
  ctx.restore();
}
function drawUpdrafts() {
  for (const u of state.updrafts) {
    if (u.x > camera.x + W + 60 || u.x + u.width < camera.x - 60) continue;
    const top = u.top - 40,
      bottom = Math.min(u.bottom, camera.y + H + 40),
      inside = state.player.inWind && state.player.x >= u.x && state.player.x <= u.x + u.width;
    ctx.save();
    // Whole column on screen: soft edge lines from top to the bottom of view.
    ctx.strokeStyle = `rgba(206,206,193,${inside ? 0.5 : 0.26})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 9]);
    for (const ex of [u.x, u.x + u.width]) {
      ctx.beginPath();
      ctx.moveTo(ex, top);
      ctx.lineTo(ex, bottom);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, "rgba(251,251,234,0)");
    grad.addColorStop(0.5, `rgba(251,251,234,${inside ? 0.07 : 0.035})`);
    grad.addColorStop(1, "rgba(251,251,234,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(u.x, top, u.width, bottom - top);
    // Rising tail-star streaks (original tail-star art, turned upward).
    const img = images.tailStar;
    if (img) {
      const span = bottom - top + 120;
      for (let k = 0; k < 6; k++) {
        const speed = 240,
          t = reduced ? k / 6 : ((clock * speed) / span + k / 6) % 1,
          sy = bottom + 60 - t * span,
          sx = u.x + 18 + ((k * 53) % Math.max(20, u.width - 36));
        ctx.save();
        ctx.globalAlpha = (inside ? 0.7 : 0.42) * Math.sin(t * Math.PI);
        ctx.translate(sx, sy);
        ctx.rotate(-Math.PI / 2 - 0.38);
        ctx.drawImage(img, -70, -16, 140, 63);
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
function drawBeacons() {
  for (const mark of state.def.checkpoints) {
    if (mark.x < camera.x - 80 || mark.x > camera.x + W + 80) continue;
    const lit = state.checkpointsReached.includes(mark.id),
      x = mark.x + 18,
      y = mark.y;
    ctx.save();
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    // An ink cairn: three stacked stones, a hollow star waiting on top.
    for (const [dy, rx, ry] of [
      [-9, 17, 9],
      [-24, 13, 7.5],
      [-36, 9, 6],
    ]) {
      ctx.beginPath();
      ctx.ellipse(x + dy * 0.05, y + dy, rx, ry, -0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const litAt = ui.beaconLitAt[mark.id];
    if (lit && litAt != null) {
      const age = state.time - litAt;
      if (age >= 0 && age < 0.5) {
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 1 - age / 0.5;
        ctx.beginPath();
        ctx.arc(x, y - 60, 20 + (age / 0.5) * 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    if (lit && !reduced) {
      const glow = ctx.createRadialGradient(x, y - 60, 1, x, y - 60, 30);
      glow.addColorStop(0, "rgba(251,251,234,.22)");
      glow.addColorStop(0.45, "rgba(251,251,234,.07)");
      glow.addColorStop(1, "rgba(251,251,234,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 30, y - 90, 60, 60);
    }
    sprite("star", lit ? 2 : 0, x, y - 60, 0.2, 1, Math.sin(clock + mark.x) * (reduced ? 0 : 0.06));
    ctx.restore();
  }
}
function chainStars(id) {
  return state.pickups.filter((q) => q.chain === id).sort((a, b) => a.index - b.index);
}
function drawConstellations() {
  for (const c of state.chains) {
    const stars = chainStars(c.id);
    if (!stars.length || stars[0].x > camera.x + W + 80 || stars.at(-1).x < camera.x - 80) continue;
    let alpha = 1;
    if (c.broken) {
      alpha = Math.max(0, 1 - (state.time - c.brokenAt) / 0.6);
      if (alpha <= 0) continue;
    }
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 1; i < stars.length; i++) {
      const a = stars[i - 1],
        b = stars[i],
        linked = c.links.includes(a.id) && c.links.includes(b.id);
      ctx.globalAlpha = alpha * (linked ? 1 : 0.4);
      ctx.strokeStyle = linked ? PAPER : MUTE;
      ctx.lineWidth = linked ? 1.8 : 1.2;
      ctx.setLineDash(linked ? [] : [2, 7]);
      // A slight hand wobble: a quadratic bend instead of a ruler line.
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2 - 6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
    }
    if (c.complete && c.completedAt != null) {
      // Completion: the inked segments brighten briefly, still hairline.
      const age = state.time - c.completedAt;
      if (age < 0.8) {
        ctx.setLineDash([]);
        ctx.globalAlpha = 1 - age / 0.8;
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 3;
        for (let i = 1; i < stars.length; i++) {
          const a = stars[i - 1],
            b = stars[i];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 6, b.x, b.y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}
function drawStars() {
  for (const star of state.pickups) {
    if (star.x < camera.x - 60 || star.x > camera.x + W + 60) continue;
    if (star.great) {
      drawGreatStar(star);
      continue;
    }
    const age = star.collectedAt == null ? 1 : state.time - star.collectedAt;
    if (star.collected && age >= 0.4) continue;
    const bob = reduced ? 0 : Math.sin(clock * 2 + star.x) * 3.5;
    // World stars are always the filled frames (2/3 twinkle); the hollow
    // frame is reserved for an empty Great Star slot in the HUD.
    const frame = star.collected ? Math.min(7, 4 + Math.floor(age * 10)) : 2 + (Math.floor(clock * 4 + star.x) % 2);
    sprite("star", reduced && !star.collected ? 2 : frame, star.x, star.y + bob, star.chain ? 0.24 : 0.21);
  }
}
function drawGreatStar(star) {
  const pending = state.greatPending.includes(star.id);
  if (star.collected && !pending) {
    const age = state.time - (star.collectedAt ?? -9);
    if (age < 0.5) sprite("star", 4 + Math.floor(age * 8), star.x, star.y, 0.5);
    return;
  }
  if (pending) return; // drawn orbiting Diana until it is banked
  const bob = reduced ? 0 : Math.sin(clock * 1.3 + star.x) * 5,
    y = star.y + bob;
  ctx.save();
  // A fallen star: its own tail, a breathing halo and a slow tilt.
  if (images.tailStar) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.translate(star.x - 46, y - 22);
    ctx.rotate(0.38);
    ctx.drawImage(images.tailStar, -95, -22, 120, 54);
    ctx.restore();
  }
  const pulse = reduced ? 0.5 : (Math.sin(clock * 2.2) + 1) / 2;
  ctx.strokeStyle = PAPER;
  ctx.globalAlpha = 0.25 + pulse * 0.3;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(star.x, y, 30 + pulse * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  sprite("star", 2, star.x, y, 0.42, 1, reduced ? 0 : Math.sin(clock * 0.8) * 0.12);
  ctx.restore();
}
/** L2-L4 open with Diana stepping out of the door she entered last level. */
function drawEntryDoor() {
  if (state.level <= 1 || !images.portal) return;
  const x = WORLD().startX - 90,
    y = WORLD().startY;
  if (x < camera.x - 160 || x > camera.x + W + 200) return;
  const placement = portalPlacement(x, y, manifest.portal.visibleBounds);
  const b = placement.source;
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.drawImage(images.portal, b.x, b.y, b.w, b.h, placement.x, placement.y, placement.width, placement.height);
  ctx.restore();
}
function drawPortal() {
  drawEntryDoor();
  const x = WORLD().finishX;
  if (!images.portal || x < camera.x - 160 || x > camera.x + W + 200) return;
  const placement = portalPlacement(x, WORLD().finishY, manifest.portal.visibleBounds);
  // Earth: each Great Star of the campaign paints a twelfth of it into the
  // arch; it is seen whole only at the last level's door (RESEARCH_LEVELS 4).
  const earthDoor = !!WORLD().earth;
  const painted = Math.min(12, paintedStars() + (earthDoor ? 12 : 0));
  const memory = state.greatBanked.length === 3 || painted > 0;
  const won = state.status === "won";
  ctx.save();
  if (memory || won) {
    const glow = ctx.createRadialGradient(x, WORLD().finishY - 95, 8, x, WORLD().finishY - 95, 120);
    glow.addColorStop(0, memory ? "rgba(111,168,220,.28)" : "rgba(251,251,234,.18)");
    glow.addColorStop(1, "rgba(12,12,15,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 130, WORLD().finishY - 230, 260, 240);
  }
  if (memory) {
    // The colour memory: Earth inside the arch, painted up from below by the
    // Great Stars banked so far.
    const cy = WORLD().finishY - 92;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, cy, 32, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = EARTH;
    ctx.fillRect(x - 33, cy + 33 - (66 * painted) / 12, 66, (66 * painted) / 12);
    ctx.restore();
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, cy, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(251,251,234,.85)";
    ctx.beginPath();
    ctx.ellipse(x - 11, WORLD().finishY - 104, 9, 5, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Draw the original visible art, not its transparent padding, and bury its
  // opaque base three pixels into a level stone foundation.
  const b = placement.source;
  ctx.drawImage(images.portal, b.x, b.y, b.w, b.h, placement.x, placement.y, placement.width, placement.height);
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x - 63, WORLD().finishY - 1, 126, 9);
  ctx.fill();
  ctx.stroke();
  if (won && earthDoor) {
    // The first colour seen whole: a small blue Earth rises out of the door.
    const age = Math.min(1, (clock - wonAt) / 1.2),
      ey = WORLD().finishY - 150 - age * 40;
    ctx.globalAlpha = age;
    ctx.fillStyle = EARTH;
    ctx.strokeStyle = PAPER;
    ctx.beginPath();
    ctx.arc(x, ey, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
/* World-space glyph prompts: an ink-ringed paper disc with a drawn arrow,
 * shown from 2.2 s before the latest valid input until the action is done. */
function arrow(x, y, dir, size) {
  const r = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[dir] ?? 0);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(0, r * 0.55);
  ctx.lineTo(0, -r * 0.5);
  ctx.moveTo(-r * 0.42, -r * 0.1);
  ctx.lineTo(0, -r * 0.55);
  ctx.lineTo(r * 0.42, -r * 0.1);
  ctx.stroke();
  ctx.restore();
}
function glyph(x, y, kind, alpha, scale) {
  const r = 19 * scale;
  const dir = kind.replace("hold-", "");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  if (coarse && dir === "up") ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.55);
  else ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r + 4, 0, Math.PI * 2);
  ctx.globalAlpha = alpha * 0.4;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  arrow(x, y, dir, r * 0.95);
  if (kind.startsWith("hold-")) {
    // "Hold": three dots under the disc, like a held breath.
    for (let i = -1; i <= 1; i++) diamond(x + i * 9, y + r + 10, 2.6, PAPER);
  }
  ctx.restore();
}
function drawPrompts() {
  const p = state.player;
  for (const q of shownPrompts(state.prompts, p.x)) {
    if (q.x < camera.x - 60 || q.x > camera.x + W + 60) continue;
    const lead = (q.inputX - p.x) / WORLD().speed;
    const alpha = Math.max(0, Math.min(1, (2.6 - lead) / 0.4)) * (q.optional ? 0.75 : 1);
    if (alpha <= 0) continue;
    // Glyphs keep at least ~20 css px of radius on small (portrait) skies.
    const cssScale = canvas.clientHeight / H || 1,
      scale = (q.optional ? 0.82 : 1) * Math.min(1.8, Math.max(1, 0.9 / cssScale));
    const items = q.glyph,
      spacing = 48 * scale,
      discs = items.filter((g) => g !== "then").length;
    let gx = q.x - ((discs - 1) * spacing) / 2;
    const bob = reduced ? 0 : Math.sin(clock * 3) * 2;
    for (const g of items) {
      if (g === "then") {
        diamond(gx - spacing / 2, q.y + bob, 3, PAPER, alpha);
        continue;
      }
      glyph(gx, q.y + bob, g, alpha, scale);
      gx += spacing;
    }
  }
}
function drawFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const q = fx[i];
    q.life -= dt / q.span;
    if (q.life <= 0) {
      fx.splice(i, 1);
      continue;
    }
    q.vy += (q.g ?? 0) * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (q.kind === "spark") diamond(q.x, q.y, 1 + q.life * 4, PAPER, q.life);
    else if (q.kind === "dust") {
      ctx.fillStyle = `rgba(251,251,234,${q.life * 0.5})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 2 + (1 - q.life) * 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (q.kind === "chip") {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate((1 - q.life) * q.spin);
      ctx.globalAlpha = q.life;
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(5, -5);
      ctx.lineTo(7, 4);
      ctx.lineTo(-4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (q.kind === "burst") {
      sprite("star", 4 + Math.min(3, Math.floor((1 - q.life) * 4)), q.x, q.y, q.scale ?? 0.22);
    } else if (q.kind === "follow-burst") {
      const p = state.player;
      sprite("star", 4 + Math.min(3, Math.floor((1 - q.life) * 4)), p.x + q.dx, p.y + q.dy, q.scale ?? 0.2);
    }
  }
}
function puff(kind, x, y, n, spread = 40, opts = {}) {
  for (let i = 0; i < n; i++)
    fx.push({
      kind,
      x: x + (Math.random() - 0.5) * spread * 0.5,
      y,
      vx: (Math.random() - 0.5) * spread * 2,
      vy: -20 - Math.random() * 60,
      life: 1,
      span: 0.5,
      ...opts,
    });
}

/* ---------- Diana, death and respawn ---------- */
let tint = 0;
function drawPlayer() {
  const p = { ...state.player, ...viewPos() };
  const spent = !capeReady(state) && state.dashRemaining <= 0.08;
  tint += ((spent ? 1 : 0) - tint) * 0.25;
  if (state.status === "ready") {
    // Title: Diana is still the two leaves in the soil (the original sprout).
    const f = frameForClip(manifest, "sprout", clock);
    sprite(f.sheet, f.frame, p.x, p.y - 30, 0.42);
    return;
  }
  if (state.status === "dead") return drawShards();
  const sinceWake = clock - wakeAt;
  if (sinceWake < 0.16) {
    // Wake: the leaves wiggle and Diana pops up out of them.
    const f = frameForClip(manifest, "sprout", clock);
    sprite(f.sheet, f.frame, p.x, p.y - 30 + sinceWake * 60, 0.42, 1 - sinceWake / 0.16);
  }
  if (state.status === "respawning") {
    const t = state.respawn ? state.respawn.t - RULES.respawnShatter - RULES.respawnIris : 1;
    if (t < 0.14) {
      const f = frameForClip(manifest, "sprout", clock * 3);
      sprite(f.sheet, f.frame, p.x, p.y - 30, 0.42);
      return;
    }
  }
  const anim = state.animation;
  if (state.dashRemaining > 0 && !reduced)
    for (let i = 3; i >= 1; i--) drawDiana("dash", anim.age, p.x - i * 22, p.y + footFor(manifest, "dash", anim.age), 0.07 + (3 - i) * 0.03);
  drawDiana(anim.name, anim.age, p.x, p.y + footFor(manifest, anim.name, anim.age), 1, tint);
  // A Great Star taken but not yet banked circles Diana until she lands.
  for (const [i, id] of state.greatPending.entries()) {
    const a = clock * 4 + i * 2;
    sprite("star", 2, p.x + Math.cos(a) * 34, p.y - 44 + Math.sin(a) * 16, 0.2);
  }
}
function drawShards() {
  const r = state.respawn;
  if (!r) return;
  const t = Math.min(1, r.t / RULES.respawnShatter);
  const ease = t * t * (3 - 2 * t);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2,
      spread = Math.sin(t * Math.PI) * 46,
      sx = r.fromX + (r.toX + 18 - r.fromX) * ease + Math.cos(a) * spread,
      sy = r.fromY - 30 + (r.toY - 60 - (r.fromY - 30)) * ease + Math.sin(a) * spread * 0.7 - Math.sin(t * Math.PI) * 60;
    sprite("star", 2, sx, sy, 0.13, 1 - t * 0.3, a + t * 4);
  }
}
function drawIris() {
  const r = state.respawn;
  if (!r || reduced) {
    if (r && reduced && state.status === "dead" && r.t > RULES.respawnShatter) {
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, W, H);
    }
    return;
  }
  const close = RULES.respawnShatter,
    cut = close + RULES.respawnIris,
    open = cut + RULES.respawnPop;
  let radius = null;
  if (state.status === "dead" && r.t > close) radius = (1 - (r.t - close) / RULES.respawnIris) * W;
  else if (state.status === "respawning") radius = Math.min(1, (r.t - cut) / (open - cut) / 0.6) * W;
  if (radius == null) return;
  const cx = r.toX + 18 - camera.x,
    cy = r.toY - 40 - camera.y;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(cx, cy, Math.max(0, radius), 0, Math.PI * 2, true);
  ctx.fill("evenodd");
  ctx.restore();
}

/* ---------- title layers ---------- */
let tintedGround = null;
function titleGround(alpha) {
  const img = images.titleground;
  if (!img || alpha <= 0) return;
  if (!tintedGround) {
    // Back hills: the original ground silhouette tinted --hill, as in fulltitle.
    tintedGround = document.createElement("canvas");
    tintedGround.width = img.width;
    tintedGround.height = img.height;
    const c = tintedGround.getContext("2d");
    c.drawImage(img, 0, 0);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = HILL;
    c.fillRect(0, 0, img.width, img.height);
  }
  const s = W / img.width,
    groundScreen = WORLD().startY - camera.y,
    top = groundScreen - 175 * s; // flat top of the art sits at 175/313
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(tintedGround, -W * 0.08, top - 34 * s, W * 1.16, img.height * s * 1.1);
  ctx.drawImage(img, 0, top, W, img.height * s);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, top + img.height * s - 2, W, H);
  ctx.restore();
}

/* ---------- frame ---------- */
/** Diana between the last two simulation ticks (RESEARCH_LEVELS F4: the
 * simulation steps in fixed 1/120 s ticks, the screen interpolates). A jump
 * of more than 60 px is a teleport (respawn, retry): drawn as is. */
function viewPos() {
  const p = state.player,
    a = state.status === "running" ? state.alpha ?? 1 : 1;
  if (p.px == null || Math.abs(p.x - p.px) > 60 || Math.abs(p.y - p.py) > 60) return { x: p.x, y: p.y };
  return { x: p.px + (p.x - p.px) * a, y: p.py + (p.y - p.py) * a };
}
function updateCamera(dt) {
  const p = viewPos(),
    view = viewGeometry(W);
  let screenX = view.playerScreenX;
  const sinceWake = clock - wakeAt;
  if (state.status === "ready") screenX = W / 2;
  else if (sinceWake < 0.9) {
    const t = Math.max(0, sinceWake / 0.9),
      e = t * t * (3 - 2 * t);
    screenX = W / 2 + (view.playerScreenX - W / 2) * e;
  }
  let targetX = p.x - screenX,
    targetY = state.status === "ready" ? 0 : cameraTargetY(state.anchorY, state.fallTime);
  if (state.status === "dead" && state.respawn) {
    // Rewind: the view rides the star shards back to the last light.
    const r = state.respawn,
      t = Math.min(1, r.t / RULES.respawnShatter),
      e = reduced ? (t >= 1 ? 1 : 0) : t * t * (3 - 2 * t);
    const fromX = camera.deathX ?? camera.x,
      fromY = camera.deathY ?? camera.y;
    camera.deathX = fromX;
    camera.deathY = fromY;
    camera.x = fromX + (r.toX - view.playerScreenX - fromX) * e;
    camera.y = fromY + (cameraTargetY(r.toY) - fromY) * e;
    return;
  }
  camera.deathX = camera.deathY = undefined;
  if (camera.snap || state.status === "ready" || sinceWake < 0.9) {
    camera.x = targetX;
    if (camera.snap || state.status === "ready") camera.y = targetY;
    else camera.y = stepCamera(camera.y, targetY, dt);
    camera.snap = false;
  } else {
    camera.x = targetX;
    camera.y = stepCamera(camera.y, targetY, dt);
  }
  if (state.status !== "ready") camera.y = clampCameraY(camera.y, p.y);
}
let lastDraw = 0;
function draw() {
  if (!ready) return;
  const dt = Math.min(0.05, Math.max(0, clock - lastDraw));
  lastDraw = clock;
  ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  drawSky();
  drawSignal();
  let sx = 0,
    sy = 0;
  if (shake > 0 && !reduced) {
    sx = (Math.random() - 0.5) * shake * 2;
    sy = (Math.random() - 0.5) * shake * 2;
  }
  shake = Math.max(0, shake - dt * 12);
  ctx.save();
  ctx.translate(-camera.x + sx, -camera.y + sy);
  drawUpdrafts();
  for (const q of state.platforms) drawPlatform(q);
  drawBeacons();
  drawPortal();
  drawConstellations();
  drawStars();
  drawPrompts();
  drawPlayer();
  drawFx(dt);
  ctx.restore();
  // Wall time since waking, or simulation time when QA steps ahead of it.
  const sinceWake = Math.max(clock - wakeAt, state.time / (state.clock ?? 1));
  if (state.status === "ready") titleGround(1);
  else if (sinceWake < 0.7) titleGround(1 - sinceWake / 0.6);
  drawIris();
}

/* ---------- HUD and cards ---------- */
const SVG = "http://www.w3.org/2000/svg";
function bezier(t, w, h) {
  const p0 = [10, h - 8],
    p1 = [w / 2, -h * 0.25],
    p2 = [w - 10, h - 8],
    u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}
function el(name, attrs, parent) {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}
const progressOf = (x) => Math.max(0, Math.min(1, (x - WORLD().startX) / (WORLD().finishX - WORLD().startX)));
function buildOrbit(svg, w, h, big) {
  svg.innerHTML = "";
  const [x0, y0] = bezier(0, w, h),
    [x2, y2] = bezier(1, w, h),
    d = `M${x0} ${y0} Q${w / 2} ${-h * 0.25} ${x2} ${y2}`;
  el("path", { d, class: "arc" }, svg);
  const travelled = el("path", { d, class: "travelled" }, svg);
  el("circle", { cx: x0, cy: y0, r: big ? 5 : 4, class: "home" }, svg);
  const ticks = state.def.checkpoints.map((c) => {
    const [x, y] = bezier(progressOf(c.x), w, h);
    return el("circle", { cx: x, cy: y, r: big ? 4.5 : 3.5, class: "tick", "data-id": c.id }, svg);
  });
  const earth = el("circle", { cx: x2, cy: y2, r: big ? 8 : 6.5, class: "earth-dot" }, svg);
  const leaf = el("g", { class: "leaf-marker" }, svg);
  // Two leaves: Diana's own sprout, the same mark as the title.
  el("path", { d: "M0 0 C-7 -2 -9 -9 -6 -13 C-1 -11 1 -5 0 0Z", class: "leaf" }, leaf);
  el("path", { d: "M0 0 C5 -1 9 -6 9 -11 C4 -11 0 -6 0 0Z", class: "leaf" }, leaf);
  if (big) {
    const [x, y] = bezier(0.08, w, h);
    el("text", { x, y: y - 12, "text-anchor": "middle", class: "label" }, svg).textContent = state.def.numeral;
  }
  return { travelled, ticks, earth, leaf, w, h, length: null };
}
let hudOrbit, pauseOrbit;
function syncOrbit(o, progress) {
  o.length ??= o.travelled.getTotalLength?.() || 300;
  o.travelled.style.strokeDasharray = `${o.length * progress} ${o.length}`;
  const [x, y] = bezier(progress, o.w, o.h);
  o.leaf.setAttribute("transform", `translate(${x.toFixed(1)} ${(y - 1).toFixed(1)})`);
  for (const t of o.ticks) t.classList.toggle("lit", state.checkpointsReached.includes(t.dataset.id));
  o.earth.classList.toggle("memory", state.greatBanked.length === 3);
}
function setSlots(container) {
  const slots = container.querySelectorAll(".slot");
  const banked = state.greatBanked.length,
    pending = state.greatPending.length;
  slots.forEach((s, i) => {
    s.classList.toggle("filled", i < banked);
    s.classList.toggle("pending", i >= banked && i < banked + pending);
  });
}
function sync() {
  root.dataset.state = state.status === "ready" ? "title" : state.status;
  if (state.stars !== ui.stars) {
    ui.stars = state.stars;
    $("stars").textContent = String(state.stars);
  }
  const great = `${state.greatBanked.length}/${state.greatPending.length}`;
  if (great !== ui.great) {
    ui.great = great;
    setSlots($("great-slots"));
    $("great-slots").setAttribute("aria-label", `Great Fallen Stars: ${state.greatBanked.length} of 3`);
  }
  const progress = progressOf(state.player.x);
  if (Math.abs(progress - ui.progress) > 0.0005 || ui.orbitDirty) {
    ui.progress = progress;
    ui.orbitDirty = false;
    syncOrbit(hudOrbit, progress);
  }
  $("orbit").classList.toggle("bright", clock < ui.orbitBrightUntil);
  const ready = capeReady(state);
  if (ready !== ui.cape) {
    ui.cape = ready;
    $("touch-cape").classList.toggle("spent", !ready);
  }
  const live = state.status !== "ready";
  const age = (q) => (q && live ? state.time - q.at : -1);
  // Card: 300 ms in, 1600 ms hold, 500 ms out, measured on the simulation clock.
  const a = age(ui.card),
    total = CARD.fadeIn + CARD.hold + CARD.fadeOut;
  let opacity = 0;
  if (a >= 0 && a <= total)
    opacity = reduced
      ? 1
      : Math.min(1, a / CARD.fadeIn, (total - a) / CARD.fadeOut);
  if (a > total) ui.card = null;
  const card = $("movement-card");
  card.style.opacity = opacity.toFixed(3);
  card.style.transform = reduced ? "" : `translateY(${((1 - Math.min(1, a / CARD.fadeIn)) * 8).toFixed(1)}px)`;
  const s = age(ui.story),
    t = age(ui.tip);
  $("story").classList.toggle("show", s >= 0 && s < CARD.storySeconds);
  $("tip").classList.toggle("show", t >= 0 && t < CARD.tipSeconds);
}
function showStory(text) {
  $("story").textContent = text;
  ui.story = { at: state.time };
}
function showTip(text) {
  $("tip").textContent = text;
  ui.tip = { at: state.time };
}
function showMovement(id, at = state.time) {
  const m = state.def.movements.find((q) => q.id === id);
  if (!m || !m.numeral) return;
  $("movement-numeral").textContent = m.numeral;
  $("movement-name").textContent = m.name;
  ui.card = { id, at };
  announce(`${m.numeral}. ${m.name}.`);
}
/** A respawn or reset rewinds simulation time; drop words tied to the old timeline. */
function clearWords() {
  ui.card = ui.story = ui.tip = null;
  ui.beaconLitAt = {};
}
function announce(text) {
  $("announcement").textContent = text;
}
function formatTime(t) {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function showVictory() {
  ui.victoryShown = true;
  // Progress: the next level opens; the best Great Stars of this one stay.
  const n = state.level,
    last = n >= LEVELS.length;
  progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, n + 1));
  progress.great[n] = Math.max(progress.great[n] ?? 0, state.greatBanked.length);
  progress.done[n] = true;
  writeProgress();
  syncLevelMap();
  $("victory-title").textContent = `${state.def.numeral} · ${state.def.title}`;
  $("continue").hidden = last;
  const song = audio.stats().score?.song;
  $("result-song").textContent = song && song.total ? `${song.notes} / ${song.total}` : "—";
  const total = state.pickups.filter((q) => !q.great).length;
  $("result-stars").textContent = `${state.stars} / ${total}`;
  // Real seconds at the level's tempo (the simulation runs BPM / 107 faster).
  $("result-time").textContent = formatTime(state.time / (state.clock ?? 1));
  $("result-falls").textContent = String(state.deaths);
  setSlots($("result-great"));
  $("result-great-count").textContent = `${state.greatBanked.length} / 3`;
  const lines = {
    1: "She was awake now, and the signal was close.",
    2: "The wind had carried her this far.",
    3: "The broken stars still sang, if she was quick.",
    4: paintedStars() >= 12 ? "Earth, whole and blue, remembered every star." : "Earth. Small, blue, and listening. She was home.",
  };
  $("victory-line").lastChild.textContent = lines[n] ?? "The signal is stronger now.";
  $("victory-card").hidden = false;
  (last ? $("again") : $("continue")).focus({ preventScroll: true });
  announce(`${state.def.title} complete. ${state.stars} of ${total} stars, ${state.greatBanked.length} of 3 Great Fallen Stars, ${state.deaths} falls.`);
}

/* ---------- simulation events → feedback ---------- */
function processEvents(quiet = false) {
  for (const e of state.events) {
    if (e.serial <= lastSerial) continue;
    lastSerial = e.serial;
    const loud = !quiet;
    // Every event is voiced by audio.mjs (cuesForEvent and the score); a quiet
    // QA step still tells the score, so it keeps its place in the song. The
    // switch below is visual feedback only.
    audio.event(e, { render: loud, timeScale: simScale() });
    switch (e.name) {
      case "jump":
        if (loud) {
          puff("dust", e.x, e.y, 4, 30, { vy: -10, span: 0.35 });
        }
        break;
      case "double-jump":
        if (loud) {
          puff("spark", e.x - 6, e.y - 8, 5, 34);
        }
        break;
      case "super-jump":
        if (loud) {
          puff("spark", e.x, e.y - 10, 10, 60);
        }
        break;
      case "smash":
        if (loud && !reduced) {
          for (let i = 0; i < 8; i++)
            fx.push({
              kind: "chip",
              x: e.x + (Math.random() - 0.5) * 50,
              y: e.py + 6,
              vx: (Math.random() - 0.5) * 260,
              vy: -80 - Math.random() * 160,
              g: 1100,
              spin: (Math.random() - 0.5) * 12,
              life: 1,
              span: 0.8,
            });
          shake = 3;
        }
        break;
      case "land":
        if (loud && e.hard) puff("dust", e.x, e.y, 6, 50, { vy: -14, span: 0.45 });
        break;
      case "star":
        if (loud) {
          puff("spark", e.x, e.y - 36, 5, 40);
        }
        break;
      case "chain-note":
        if (loud) {
          puff("spark", e.x, e.y - 36, 6, 44);
        }
        break;
      case "constellation":
        if (loud) {
          for (const q of chainStars(e.chain))
            fx.push({ kind: "burst", x: q.x, y: q.y, vx: 0, vy: 0, life: 1, span: 0.45, scale: 0.26 });
          announce("Constellation complete. The cape breathes again.");
        }
        break;
      case "refill":
        if (loud) {
          fx.push({ kind: "follow-burst", dx: -34, dy: -48, life: 1, span: 0.4, vx: 0, vy: 0, scale: 0.24 });
        }
        break;
      case "great-star":
        if (loud) {
          puff("spark", e.x, e.y - 40, 14, 80);
        }
        break;
      case "great-banked":
        ui.great = "";
        if (loud) {
          fx.push({ kind: "follow-burst", dx: 0, dy: -50, life: 1, span: 0.5, vx: 0, vy: 0, scale: 0.4 });
          announce(`Great Fallen Star kept. ${e.count} of 3.`);
        }
        break;
      case "checkpoint": {
        const mark = state.def.checkpoints[e.index];
        ui.orbitBrightUntil = clock + 1.5;
        ui.orbitDirty = true;
        if (loud) {
          ui.beaconLitAt[e.id] = state.time; // simulation time, like the words
          showStory(mark.story);
          announce("A light to return to.");
        }
        break;
      }
      case "movement":
        if (loud) showMovement(e.id);
        break;
      case "death":
        held.glide = false;
        break;
      case "respawn":
        camera.snap = true;
        clearWords();
        if (loud && state.fallsHere >= 5) showTip("Need a hand? Assists are in the pause menu.");
        else if (loud && state.fallsHere >= 3) {
          const cp = state.checkpoint ? state.def.checkpoints[checkpointIndex(state.checkpoint.id, state.def)] : null;
          showTip(cp ? cp.tip : state.def.startTip);
        }
        break;
      case "win":
        wonAt = clock;
        break;
    }
  }
  watchShelves(!quiet);
}

/* ---------- actions ---------- */
function wake() {
  if (!ready || state.status !== "ready") return;
  unlockAudio();
  // The score starts with the wake event (bar 1, the sky on Bm); a title
  // song that is playing fades out under it.
  start(state);
  wakeAt = clock;
  root.classList.add("waking");
  setTimeout(() => root.classList.remove("waking"), 700);
  showMovement(state.def.movements[0].id, state.time + (state.def.cardDelay ?? CARD.wakeDelay));
  canvas.focus({ preventScroll: true });
  processEvents();
  sync();
}
function doJump() {
  if (state.status === "ready") return wake();
  if (state.status === "paused" || state.status === "won") return;
  jump(state);
  processEvents();
}
function doCape() {
  if (state.status !== "running") return;
  dash(state);
  held.glide = true;
  processEvents();
}
function doDive() {
  if (state.status !== "running") return;
  dive(state);
  processEvents();
}
function openPause() {
  if (state.status !== "running") return;
  togglePause(state);
  held.glide = false;
  syncAudio(); // freeze music, tails and the wind bed right now, not next frame
  $("pause-main").hidden = false;
  $("pause-assist").hidden = true;
  $("pause-veil").hidden = false;
  syncOrbit(pauseOrbit, progressOf(state.player.x));
  $("pause-title").textContent = "Paused";
  $("resume").focus({ preventScroll: true });
  sync();
}
function closePause() {
  const wasPaused = state.status === "paused";
  if (wasPaused) togglePause(state);
  syncAudio();
  if (wasPaused) audio.play("ui-resume");
  $("pause-veil").hidden = true;
  canvas.focus({ preventScroll: true });
  sync();
}
function pause() {
  if (state.status === "paused") closePause();
  else openPause();
}
function hideCards() {
  $("pause-veil").hidden = true;
  $("victory-card").hidden = true;
  ui.victoryShown = false;
}
function backToLight() {
  if (!ready || state.status === "ready") return;
  retry(state);
  afterReset();
  audio.play("respawn");
}
function restartChapter() {
  if (!ready) return;
  // A fresh song: bar 1, in tune. The door's soundtrack gives way.
  audio.scoreReset();
  audio.fadeOutMusic(1);
  restart(state);
  wakeAt = clock - 1;
  afterReset();
  audio.play("ui-select");
  showMovement(state.def.movements[0].id, state.time + (state.def.cardDelay ?? CARD.wakeDelay));
}
function afterReset() {
  hideCards();
  clearWords();
  held.glide = false;
  fx.length = 0;
  // Silence the last run first (a restart never carries the last fall's
  // tail), then let the score hear the reset's own events (a restart's wake,
  // a retry's respawn): they restart the song on bar 1 or the beacon's bar,
  // and the new sky must not be hushed with the old one.
  audio.hush(0.12);
  audio.clearMoments();
  for (const e of state.events) if (e.serial > lastSerial) audio.event(e, { cues: false, timeScale: simScale() });
  lastSerial = state.eventSerial;
  syncAudio();
  resetShelfWatch();
  ui.great = "";
  ui.orbitDirty = true;
  camera.snap = true;
  canvas.focus({ preventScroll: true });
  sync();
  draw();
}
/** Load level n at its title (ready) state: world, orbit, view and score. */
function loadLevel(n) {
  const assist = { ...state.assist };
  Object.assign(state, createGame(state.seed, { level: n, ...assist }));
  audio.setLevel(state.level);
  hudOrbit = buildOrbit($("orbit"), 264, 44, false);
  pauseOrbit = buildOrbit($("pause-orbit"), 360, 80, true);
  root.dataset.level = String(state.level);
  syncLevelMap();
  resize();
}
/** QA and Continue: open level n (when it is unlocked, or always for QA
 * with { force: true }) and, by default, wake it at once. */
function startLevel(n, { wake: wakeNow = true, force = true } = {}) {
  if (!ready) return null;
  const level = Math.max(1, Math.min(LEVELS.length, Math.round(n) || 1));
  if (!force && level > progress.unlocked) return null;
  map?.cancel();
  hideCards();
  clearWords();
  audio.scoreReset();
  audio.hush(0.12);
  audio.clearMoments();
  audio.fadeOutMusic(0.6);
  loadLevel(level);
  lastSerial = state.eventSerial;
  fx.length = 0;
  camera.snap = true;
  ui.great = "";
  ui.orbitDirty = true;
  resetShelfWatch();
  if (wakeNow) wake();
  else {
    syncAudio();
    sync();
    draw();
  }
  return snapshot(state);
}
/** Between levels (RESEARCH_LEVELS 4): the orbit line grows from the
 * station just finished to the next over one bar of the next tempo
 * (0.3 s with reduced motion); any key or tap skips it. Then that level
 * begins with its title card. */
let map = null;
function showMap(next) {
  if (!ready || next > LEVELS.length) return;
  // (The win stays shown as seen, so the frame loop does not bring the card back.)
  $("victory-card").hidden = true;
  const svg = $("map-svg");
  svg.innerHTML = "";
  const w = 720,
    h = 240,
    at = (i) => bezier(0.06 + (0.88 * i) / (LEVELS.length - 1), w, h);
  const [x0, y0] = bezier(0, w, h),
    [x2, y2] = bezier(1, w, h);
  const d = `M${x0} ${y0} Q${w / 2} ${-h * 0.25} ${x2} ${y2}`;
  el("path", { d, class: "arc" }, svg);
  const travelled = el("path", { d, class: "travelled" }, svg);
  const length = travelled.getTotalLength?.() || 800;
  LEVELS.forEach((lv, i) => {
    const [x, y] = at(i);
    el("circle", { cx: x, cy: y, r: lv.id === next ? 11 : 8, class: `station${lv.id === next ? " next" : ""}` }, svg);
    el("text", { x, y: y + 40, "text-anchor": "middle", class: "label" }, svg).textContent = lv.numeral;
    el("text", { x, y: y + 60, "text-anchor": "middle", class: "name" }, svg).textContent = lv.title;
  });
  el("circle", { cx: x2, cy: y2, r: 9, class: "earth-dot" }, svg);
  const leaf = el("g", {}, svg);
  el("path", { d: "M0 0 C-7 -2 -9 -9 -6 -13 C-1 -11 1 -5 0 0Z", class: "leaf" }, leaf);
  el("path", { d: "M0 0 C5 -1 9 -6 9 -11 C4 -11 0 -6 0 0Z", class: "leaf" }, leaf);
  const t0 = 0.06 + (0.88 * (next - 2)) / (LEVELS.length - 1),
    t1 = 0.06 + (0.88 * (next - 1)) / (LEVELS.length - 1);
  const seconds = reduced ? 0.3 : (4 * 60) / LEVELS[next - 1].bpm;
  const begin = performance.now();
  $("map-veil").hidden = false;
  audio.play("ui-select");
  announce(`${LEVELS[next - 1].numeral}. ${LEVELS[next - 1].title}.`);
  let done = false;
  const draw = (u) => {
    const t = t0 + (t1 - t0) * u;
    travelled.style.strokeDasharray = `${(length * t).toFixed(1)} ${length}`;
    const [x, y] = bezier(t, w, h);
    leaf.setAttribute("transform", `translate(${x.toFixed(1)} ${(y - 4).toFixed(1)}) scale(1.6)`);
  };
  const finish = () => {
    if (done) return;
    done = true;
    map = null;
    $("map-veil").hidden = true;
    startLevel(next);
  };
  const step = (now) => {
    if (done) return;
    const u = Math.min(1, (now - begin) / 1000 / seconds);
    draw(u);
    if (u >= 1) setTimeout(finish, reduced ? 0 : 350);
    else requestAnimationFrame(step);
  };
  draw(0);
  requestAnimationFrame(step);
  // cancel: another level was opened directly (QA startLevel) meanwhile.
  map = { finish, next, cancel: () => ((done = true), (map = null), ($("map-veil").hidden = true)) };
}
/** The title's orbit map: four stations, open ones selectable. */
function syncLevelMap() {
  const map = $("level-map");
  if (!map) return;
  for (const b of map.querySelectorAll(".station")) {
    const n = Number(b.dataset.level),
      open = n <= progress.unlocked;
    b.disabled = !open;
    b.setAttribute("aria-pressed", String(n === state.level));
    b.classList.toggle("done", !!progress.done[n]);
    const got = progress.great[n] ?? 0;
    b.querySelectorAll(".slot").forEach((sl, i) => sl.classList.toggle("filled", i < got));
    b.setAttribute("aria-label", `${LEVELS[n - 1].numeral}. ${LEVELS[n - 1].title}${open ? `, ${got} of 3 Great Fallen Stars` : ", locked"}`);
  }
}
function buildLevelMap() {
  const map = $("level-map");
  if (!map) return;
  map.innerHTML = "";
  for (const d of LEVELS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "station";
    b.dataset.level = String(d.id);
    b.innerHTML = `<span class="numeral">${d.numeral}</span><span class="name">${d.title}</span><span class="great-slots"><i class="slot"></i><i class="slot"></i><i class="slot"></i></span>`;
    b.addEventListener("click", () => {
      if (state.status !== "ready" || d.id > progress.unlocked) return;
      audio.play("ui-select");
      loadLevel(d.id);
      sync();
      draw();
      $("start").focus({ preventScroll: true });
    });
    map.append(b);
  }
  syncLevelMap();
}
/** Great Stars banked across the campaign (best per level, this run's level live). */
function paintedStars() {
  let n = 0;
  for (const d of LEVELS) n += d.id === state.level ? Math.max(progress.great[d.id] ?? 0, state.greatBanked.length) : progress.great[d.id] ?? 0;
  return n;
}
function toTitle() {
  const assist = { ...state.assist };
  Object.assign(state, createGame(state.seed, { level: state.level, ...assist }));
  syncLevelMap();
  hideCards();
  clearWords();
  lastSerial = state.eventSerial;
  fx.length = 0;
  camera.snap = true;
  ui.great = "";
  ui.orbitDirty = true;
  audio.scoreReset();
  audio.hush(0.2);
  audio.clearMoments();
  // The title song: keep it if the door already started it, else begin it.
  if (!audio.stats().soundtrackPlaying) audio.playMusic({ fromStart: true, fadeIn: 1.2 });
  resetShelfWatch();
  syncAudio();
  sync();
  $("start").focus({ preventScroll: true });
}

/* ---------- input ---------- */
const GAME_KEYS = ["Space", "ArrowUp", "ArrowRight", "ArrowDown", "KeyW", "KeyD", "KeyS"];
window.addEventListener("keydown", (e) => {
  const onButton = e.target instanceof HTMLElement && e.target.matches("button");
  if (state.status === "paused") {
    if (e.code === "Tab") {
      // Keep keyboard focus inside the pause card (aria-modal).
      const buttons = [...$("pause-card").querySelectorAll("button")].filter((b) => b.offsetParent);
      const i = buttons.indexOf(document.activeElement),
        d = e.shiftKey ? -1 : 1;
      e.preventDefault();
      buttons[(i + d + buttons.length) % buttons.length]?.focus();
      return;
    }
    if (["KeyP", "Escape"].includes(e.code)) {
      e.preventDefault();
      if (!$("pause-assist").hidden) showAssist(false);
      else closePause();
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
      const buttons = [...$("pause-card").querySelectorAll("button")].filter((b) => b.offsetParent);
      const i = buttons.indexOf(document.activeElement);
      const d = ["ArrowUp", "ArrowLeft"].includes(e.code) ? -1 : 1;
      buttons[(i + d + buttons.length) % buttons.length]?.focus();
    }
    return;
  }
  if (map) {
    // Any key skips the map between levels.
    e.preventDefault();
    return map.finish();
  }
  if (onButton && ["Space", "Enter"].includes(e.code)) return; // native activation
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (state.status === "ready" && ["Space", "Enter", "ArrowUp", "KeyW"].includes(e.code)) return wake();
  if (state.status === "won") {
    if (e.code === "KeyR") restartChapter();
    return;
  }
  // On the title, ←/→ choose among the open levels of the orbit map.
  if (state.status === "ready" && ["ArrowLeft", "ArrowRight"].includes(e.code) && ready) {
    const n = state.level + (e.code === "ArrowRight" ? 1 : -1);
    if (n >= 1 && n <= progress.unlocked) {
      loadLevel(n);
      audio.play("ui-select");
      sync();
      draw();
    }
    return;
  }
  if (GAME_KEYS.includes(e.code)) atInput(e);
  if (["Space", "ArrowUp", "KeyW"].includes(e.code)) doJump();
  if (["KeyD", "ArrowRight"].includes(e.code)) doCape();
  if (["KeyS", "ArrowDown"].includes(e.code)) doDive();
  if (["KeyP", "Escape"].includes(e.code)) pause();
  if (e.code === "KeyR") e.shiftKey ? restartChapter() : backToLight();
});
// The title song after a blocked autoplay: the first gesture that is not the
// wake itself (the sound or fullscreen button, Tab, a click beside the logo)
// starts it; the wake fades it out under the sky anyway.
function titleSong(e) {
  if (state.status !== "ready" || !sound.on || audio.stats().soundtrackPlaying) return;
  const wakes = e.type === "keydown" ? ["Space", "Enter", "ArrowUp", "KeyW"].includes(e.code) : !!e.target?.closest?.("#start");
  if (!wakes) audio.playMusic({ fromStart: true, fadeIn: 0.8 });
}
window.addEventListener("pointerdown", titleSong, true);
window.addEventListener("keydown", titleSong, true);
// The browser can suspend audio on its own (device change, iOS interruption);
// any gesture outside a pause brings it back.
window.addEventListener("pointerdown", () => audio.nudge(), true);
window.addEventListener("keydown", () => audio.nudge(), true);
{
  // Soft paper ticks on menu buttons (never the touch controls: those are
  // gameplay and already voiced). The pause card stays silent: the engine
  // refuses new sounds while paused, so its buttons need no exception.
  const canHover = matchMedia("(hover: hover)").matches;
  const menu = "#again, #to-title, #sound, #pause, .itch-fullscreen";
  document.addEventListener("pointerover", (e) => {
    const b = canHover && e.target instanceof Element ? e.target.closest(menu) : null;
    if (b && !b.contains(e.relatedTarget)) audio.play("ui-hover");
  });
  document.addEventListener("focusin", (e) => {
    if (e.target instanceof Element && e.target.matches(menu) && e.target.matches(":focus-visible")) audio.play("ui-hover");
  });
  document.addEventListener("click", (e) => {
    const b = e.target instanceof Element ? e.target.closest("#to-title, .itch-fullscreen") : null;
    if (b) audio.play("ui-select");
  });
}
window.addEventListener("keyup", (e) => {
  if (GAME_KEYS.includes(e.code)) atInput(e);
  if (["KeyD", "ArrowRight"].includes(e.code)) held.glide = false;
  if (["Space", "ArrowUp", "KeyW"].includes(e.code)) releaseJump(state);
});
// Keys let go while the window is away never send keyup: release the jump
// and the cape here (A3: no jump stays "held" behind the pause card).
window.addEventListener("blur", () => {
  held.glide = false;
  if (state.status === "running") openPause();
  releaseJump(state);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.status === "running") openPause();
  if (document.hidden) ((held.glide = false), releaseJump(state));
});
function bindTouch(id, down, up) {
  const b = $(id);
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try {
      b.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events may not own a pointer */
    }
    b.classList.add("pressed");
    atInput(e);
    down();
  });
  const end = (e) => {
    b.classList.remove("pressed");
    atInput(e);
    up?.();
  };
  b.addEventListener("pointerup", end);
  b.addEventListener("pointercancel", end);
  b.addEventListener("lostpointercapture", end);
  // Keyboard / assistive activation emits a click without pointer detail.
  b.addEventListener("click", (e) => {
    if (e.detail === 0) {
      down();
      up?.();
    }
  });
}
bindTouch("touch-jump", doJump, () => releaseJump(state));
bindTouch("touch-cape", doCape, () => (held.glide = false));
bindTouch("touch-dive", doDive);
{
  // Swiping down on the right half also dives.
  const zone = $("touch-swipe");
  let startY = null;
  zone.addEventListener("pointerdown", (e) => {
    startY = e.clientY;
    if (state.status === "ready") wake();
  });
  zone.addEventListener("pointermove", (e) => {
    if (startY != null && e.clientY - startY > 36) {
      startY = null;
      doDive();
    }
  });
  zone.addEventListener("pointerup", () => (startY = null));
  zone.addEventListener("pointercancel", () => (startY = null));
}
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (e.pointerType === "mouse") atInput(e);
  if (e.pointerType === "mouse" || state.status === "ready") doJump();
});
canvas.addEventListener("pointerup", (e) => (atInput(e), releaseJump(state)));
$("start").addEventListener("click", wake);
$("pause").addEventListener("click", openPause);
$("resume").addEventListener("click", closePause);
$("back-to-light").addEventListener("click", backToLight);
$("restart-chapter").addEventListener("click", restartChapter);
$("again").addEventListener("click", restartChapter);
$("continue").addEventListener("click", () => showMap(state.level + 1));
$("map-veil").addEventListener("pointerdown", () => map?.finish());
$("to-title").addEventListener("click", toTitle);
$("reload").addEventListener("click", () => location.reload());
$("sound").addEventListener("click", () => setSound(!sound.on));
$("pause-sound").addEventListener("click", () => setSound(!sound.on));
function showAssist(open) {
  $("pause-main").hidden = open;
  $("pause-assist").hidden = !open;
  (open ? $("pause-assist").querySelector(".toggle") : $("assist-open")).focus({ preventScroll: true });
}
$("assist-open").addEventListener("click", () => showAssist(true));
$("assist-back").addEventListener("click", () => showAssist(false));
for (const b of document.querySelectorAll("[data-assist]")) {
  b.addEventListener("click", () => {
    const name = b.dataset.assist,
      on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on));
    if (name === "gentle") pace = on ? 0.8 : 1;
    else if (name === "gentleMusic") setGentleMusic(on);
    else setAssist(state, name, on);
  });
}
// Ink line boil: re-seed the wobble filter at 8 fps (never under reduced motion).
if (!reduced) {
  let seed = 3;
  setInterval(() => {
    if (!$("pause-veil").hidden || !$("victory-card").hidden || state.status === "ready")
      $("ink-noise")?.setAttribute("seed", String((seed = (seed % 4) + 1)));
  }, 125);
}

/** Simulate up to `now` (an animation-frame or input-event timestamp). An
 * input handler calls it with the event's own timeStamp before applying the
 * press, so the press lands on the tick it was made in (frame-clock.mjs). */
const frameClock = createFrameClock({ maxStep: 0.1 });
function advanceTo(now) {
  const real = frameClock.advance(now);
  clock += state.status === "paused" ? 0 : real;
  // The level's clock (BPM / 107) and Gentle pace scale time only, so
  // every arc and gap stays identical (RESEARCH_LEVELS 3).
  if (ready && real > 0) update(state, real * simScale(), held);
  return real;
}
/** Before an input acts: catch the simulation up to the event's time (the
 * camera eases over that time on the next frame). */
let caughtUp = 0;
function atInput(e) {
  if (ready && state.status === "running" && e?.timeStamp) caughtUp += advanceTo(e.timeStamp);
}
function frame(now) {
  const real = advanceTo(now) + caughtUp;
  caughtUp = 0;
  if (ready) {
    processEvents();
    syncAudio();
    if (state.status === "won" && !ui.victoryShown && clock - wonAt > 1.5) showVictory();
    updateCamera(real);
    sync();
    draw();
  }
  requestAnimationFrame(frame);
}

/* ---------- browser QA adapter ---------- */
// step() uses exactly the same simulation as RAF. `model` is exposed for
// isolated collision fixtures only; normal play never needs it.
window.__game = {
  ready: false,
  model: state,
  start: wake,
  restart: restartChapter,
  retry: backToLight,
  toTitle,
  jump: () => jump(state),
  releaseJump: () => releaseJump(state),
  // A tap: pressed and released in the same tick (the pilots' shortest hop).
  tap: () => (jump(state), releaseJump(state)),
  dash: () => dash(state),
  dive: () => dive(state),
  pause,
  setAssist: (name, on) =>
    name === "gentle" ? ((pace = on ? 0.8 : 1), true) : name === "gentleMusic" ? (setGentleMusic(on), true) : setAssist(state, name, on),
  // Levels: startLevel(n) opens level n (1-4) and wakes it; levels() lists
  // them with their tempo and whether they are open in this browser.
  startLevel: (n, options) => startLevel(n, options),
  // The animated map between levels, as Continue plays it (skippable).
  showMap: (n) => (showMap(n), !!map),
  levels: () => LEVELS.map((d) => ({ id: d.id, title: d.title, bpm: d.bpm, clock: d.clock, verbs: { ...d.verbs }, unlocked: d.id <= progress.unlocked, great: progress.great[d.id] ?? 0 })),
  // Harmony feedback: { gentle: true } removes every dissonance (no detune,
  // a fade instead of the tape-stop). Persisted like the sound setting.
  setMusic: ({ gentle } = {}) => (gentle != null && setGentleMusic(gentle), { gentle: sound.gentle }),
  getState: () => snapshot(state),
  // { on, unlocked, decoded, state, paused, suspended, musicPlaying, voices,
  //   nodes, played, dropped, cues, score: { running, bar, chord, H,
  //   detuneCents, gentle, song, ... }, ... } (see audio.mjs stats()).
  getAudio: () => ({ ...audio.stats(), on: sound.on }),
  getRenderGeometry: () => {
    const view = viewGeometry(W);
    return {
      portal: manifest && portalPlacement(WORLD().finishX, WORLD().finishY, manifest.portal.visibleBounds),
      visibleWorldWidth: W,
      lookahead: view.lookahead,
      lookaheadSeconds: view.lookaheadSeconds,
      cameraX: camera.x,
      cameraY: camera.y,
      layout,
    };
  },
  step: (seconds, controls = {}, options = {}) => {
    update(state, seconds, controls);
    const render = options.render !== false;
    processEvents(!render);
    if (render) {
      camera.snap = true;
      updateCamera(0);
      sync();
      draw();
    }
    return snapshot(state);
  },
};

/* ---------- loading ---------- */
async function load() {
  try {
    manifest = await fetch("./assets/manifest.json").then((r) => {
      if (!r.ok) throw new Error(`manifest ${r.status}`);
      return r.json();
    });
    await Promise.all(
      Object.entries(manifest)
        .filter(([, v]) => v.file?.endsWith(".png"))
        .map(async ([name, data]) => {
          const img = new Image();
          img.src = data.file;
          await img.decode();
          images[name] = img;
        }),
    );
    try {
      await document.fonts.load("24px Solarum");
    } catch {
      /* the fallback face still renders every label */
    }
    // Effects are synthesised (audio.mjs); the original WAVs in manifest.sfx
    // are archive-only. Only the soundtrack streams, after the wake gesture.
    sound.music.src = manifest.music.file;
    // Buffer it now: the door must not wait for a download.
    sound.music.preload = "auto";
    hudOrbit = buildOrbit($("orbit"), 264, 44, false);
    pauseOrbit = buildOrbit($("pause-orbit"), 360, 80, true);
    buildLevelMap();
    // The title opens on the furthest open level.
    if (progress.unlocked > 1) loadLevel(progress.unlocked);
    ready = true;
    window.__game.ready = true;
    $("start").disabled = false;
    $("start-label").textContent = coarse ? "Tap to wake" : "Press space or tap to wake";
    if (coarse) $("title-keys").textContent = "tap left to jump · right thumb: cape, dive";
    setSound(sound.on);
    setGentleMusic(sound.gentle);
    // The title song: where the browser allows it (itch's click-to-play
    // iframe does) it starts now, on the plain element (no AudioContext
    // before a gesture); otherwise the first gesture that does not wake starts it.
    if (sound.on) audio.playMusic({ fromStart: true });
    resize();
    sync();
    draw();
  } catch (error) {
    $("start").hidden = true;
    $("title-keys").hidden = true;
    $("load-error").hidden = false;
    console.error("Solarum asset load failed", error);
  }
}
resize();
load();
requestAnimationFrame(frame);
