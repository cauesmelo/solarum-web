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
import { LEVELS, CARD, checkpointIndex, shownPrompts, readSave, writeSave } from "./level.mjs";
import { characterLayers, frameForClip, footFor, clipFor } from "./animation.mjs";
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
import { createAudioEngine, readSoundSetting, writeSoundSetting, readGentleSetting, writeGentleSetting, readVolumes, writeVolumes } from "./audio.mjs";
import { createFrameClock } from "./frame-clock.mjs";
import { emergenceAt, emergenceSeconds, resolveSet } from "./emergence.mjs";
import { owns, spriteSetName, capeMeter, capeTint, doubleInHand } from "./hud.mjs";
import { createBackdrop, lookOf, skyDensity, cadentGap, bodyBox, earthBox, ringsCrop, HUD_BAND } from "./backdrop.mjs";
import { ANCHORS, momentSeconds, riseAt, settleAt, helperApproach, helperAfter, rippleAt, necklaceAt, SIXTEENTH_SIM, MOMENT_KINDS, scriptedMoments, fallAt, flashAt, asteroidAt, plumeAt, farPlace, eyeAt, eyeSeconds, eyeTimes, rideAt, slopeAt } from "./moments.mjs";
import { ISLAND_LOOKS, islandShape, markable, paintMarks, paintParticles } from "./islands.mjs";

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
    // level.mjs readSave: a version-1 save keeps its numeral, not its stars.
    return readSave(JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "null"));
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return { unlocked: 1, great: {}, done: {} };
}
function writeProgress() {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(writeSave(progress)));
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
  turnHintShown = false,
  // The title's wake: Diana emerging from the earth under the sprout
  // (emergence.mjs). null on the plain title and once she runs.
  emergence = null,
  // A QA / next-phase override of the level's sprite set ("cape" | "nocape").
  spriteSetOverride = null,
  // QA previews on builds whose levels do not carry the progression fields
  // yet: a look id for the sky, and a cape charge (0-1) for the breath bar.
  lookOverride = null,
  capePreview = null;
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
  breathShown: undefined,
  breath: null,
  breathFull: null,
  verbs: undefined,
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
  // Music and Sounds (pause card), 0-1 each; 1 is the balanced mix.
  volumes: readVolumes(() => window.localStorage),
  music: new Audio(),
};
// Phones get a shorter space reverb (at most 4 s) to save CPU.
const audio = createAudioEngine({ enabled: sound.on, gentle: sound.gentle, spaceSeconds: coarse ? 4 : 5.5, level: state.level, volumes: sound.volumes });
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
function setVolumes(v) {
  sound.volumes = audio.setVolumes({ ...sound.volumes, ...v });
  writeVolumes(() => window.localStorage, sound.volumes);
  for (const [id, key] of [["vol-music", "music"], ["vol-sounds", "sounds"]]) {
    const input = $(id),
      pct = Math.round(sound.volumes[key] * 100);
    if (Number(input.value) !== pct) input.value = String(pct);
    input.setAttribute("aria-valuetext", `${pct}%`);
  }
  return { ...sound.volumes };
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
  soilFraction = titleSoil();
  $("title-ui").style.setProperty("--title-soil", String(soilFraction));
  layoutStations();
  camera.snap = true;
  if (ready) draw();
}
/** Where the title frames the soil line, as a fraction of the stage height:
 * the same composition for every level (their start heights differ by 220
 * px). Portrait skies hold only the logo and the sprout (the panel is in the
 * deck); short landscape screens lift the soil to leave the panel room. */
function titleSoil() {
  // (Short phones lift it a little so the panel and its levels fit below.)
  if (layout === "portrait") return root.clientHeight < 700 ? 0.72 : 0.8;
  return canvas.clientHeight && canvas.clientHeight < 460 ? 0.5 : 0.6;
}
// (Cached on resize: reading layout sizes every frame forced a reflow.)
let soilFraction = 0.6;
new ResizeObserver(resize).observe(root);

/* ---------- drawing helpers ---------- */
function frameRect(sheet, index) {
  const data = manifest[sheet];
  return data?.frames[Math.max(0, Math.floor(index)) % data.frames.length];
}
function sprite(sheet, index, x, y, scale, alpha = 1, rotation = 0) {
  spriteOn(ctx, sheet, index, x, y, scale, alpha, rotation);
}
/** One manifest frame centred at (x, y) on any 2D context. */
function spriteOn(c, sheet, index, x, y, scale, alpha = 1, rotation = 0) {
  const img = images[sheet],
    f = frameRect(sheet, index);
  if (!img || !f) return;
  c.save();
  c.globalAlpha *= alpha;
  c.translate(x, y);
  if (rotation) c.rotate(rotation);
  c.drawImage(img, f.x, f.y, f.w, f.h, (-f.w * scale) / 2, (-f.h * scale) / 2, f.w * scale, f.h * scale);
  c.restore();
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
/** M1: the cape is the meter. A spent cape is tinted --dim with an
 * offscreen source-atop pass; `tint` is the share of --dim (0-0.6: four
 * steps with the breath bar, hud.mjs capeTint). Body and cape share one
 * sheet in most original clips, so the tint is a gradient across the
 * trailing (left) half where the cape is drawn, fading out before Diana's
 * face and chest. */
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
  g.addColorStop(0, `rgba(119,119,113,${tint})`);
  g.addColorStop(0.62, `rgba(119,119,113,${tint})`);
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
const makeCanvas = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
const ringsOnly = (img) => ringsCrop(img, makeCanvas); // the planet body starts at 56.5%
/** Why she runs: a tiny Earth glint far ahead with the signal pulsing out of
 * it. It sits in the sky beyond the course and grows a little with progress. */
function drawSignal() {
  if (state.status === "ready") return;
  const progress = progressOf(state.player.x),
    t = reduced ? 0.4 : (clock % 2.4) / 2.4;
  // The last look draws Earth itself (a growing crescent); the signal pulses from it.
  const earth = earthBox(currentLook(), { W, H, progress });
  const x = earth ? earth.x : W * 0.86,
    y = earth ? earth.y : 128 - progress * 10,
    r = earth ? earth.r : 2.4 + progress * 2.6;
  ctx.save();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = (1 - t) * 0.5;
  ctx.beginPath();
  ctx.arc(x, y, r + 4 + t * 26, 0, Math.PI * 2);
  ctx.stroke();
  if (earth) return ctx.restore();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = EARTH;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---------- world ---------- */
/** The level's look (backdrop.mjs): a QA override, else `def.look`; null is
 * revision seven's sky. */
const currentLook = () => lookOf(state.def, lookOverride);
let backdrop = null;
/** What the backdrop needs this frame: the view, the level's progress and
 * the camera's travel since the start (for a small parallax). */
function backdropView() {
  return {
    W,
    H,
    clock,
    progress: state.status === "ready" ? 0 : progressOf(state.player.x),
    driftX: camera.x - (WORLD().startX - W / 2),
    driftY: camera.y - (WORLD().startY - 0.6 * H),
    ...brightStarFate(),
  };
}
/** I's brightest star brightens toward its flash and is gone once it has
 * fallen (it is the asteroid); without a flash moment it follows progress. */
function brightStarFate() {
  const flash = state.status === "ready" ? null : scriptedOf().list.find((m) => m.kind === "flash");
  if (!flash) return { brightness: state.status === "ready" ? 0 : progressOf(state.player.x), fallen: false };
  return { brightness: Math.max(0, Math.min(1, state.time / flash.at)), fallen: sinceSim(flash.at) >= 0.1 };
}
function drawSky() {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const look = currentLook(),
    density = skyDensity(look);
  // A look's accents never enter the HUD band: the band's dust and stars
  // stay exactly as revision seven drew them.
  for (const [i, d] of dust.entries()) {
    // Pluto's emptiness keeps half the dust; the Moon's sky has more.
    if (density.dust < 1 && d.y > HUD_BAND + 4 && i % Math.round(1 / density.dust) !== 0) continue;
    let sx = (d.x * W * 1.4 - camera.x * 0.015) % (W * 1.4);
    if (sx < 0) sx += W * 1.4;
    ctx.fillStyle = `rgba(251,251,234,${d.a})`;
    ctx.beginPath();
    ctx.arc(sx, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
    const ey = ((d.y + 170) % 580) + 20;
    if (density.dust > 1 && i < dust.length * (density.dust - 1) && ey > HUD_BAND + 4) {
      ctx.beginPath();
      ctx.arc((sx + W * 0.37) % (W * 1.4), ey, d.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Original twinkling background stars (bg-stars sheet, 4-frame groups).
  // A look scales their number (Pluto 0.5, the Moon 1.6: a second, offset
  // pass) and Neptune's far stars wobble at 0.3 Hz, as if seen through water.
  const passes = density.stars > 1 ? 2 : 1;
  for (let pass = 0; pass < passes; pass++)
    for (const [i, s] of sky.entries()) {
      if (pass === 1 && i >= sky.length * (density.stars - 1)) break;
      const ox = pass ? 0.43 : 0,
        oy = pass ? 233 : 0,
        sy = ((s.y + oy - 30) % 520) + 30 - camera.y * 0.05,
        // The tallest frame of its twinkle group (long sparkles reach far
        // above their centre), plus the wobble: does it touch the band?
        reach = Math.max(...[0, 1, 2, 3].map((k) => frameRect("background", s.group + k)?.h ?? 0)) * s.size * 0.8 + 3,
        band = sy - reach < HUD_BAND;
      if (!band && pass === 0 && density.stars < 1 && i % Math.round(1 / density.stars) !== 0) continue;
      if (band && pass === 1) continue;
      let sx = ((s.x + ox) * (W + 200) - camera.x * s.depth) % (W + 200);
      if (sx < 0) sx += W + 200;
      const f = s.group + (reduced ? 2 : Math.floor(clock * 3 + s.phase) % 4);
      const wob = !band && density.wobble && !reduced ? Math.sin(Math.PI * 2 * density.wobble * clock + s.phase * 1.7) * 2.2 : 0;
      sprite("background", f, sx - 100, sy + wob, s.size * 1.6, 0.8);
    }
  // The level's body ahead and its sky accent (backdrop.mjs), behind the
  // world. Like the world, they are not drawn on the title (nothing may sit
  // near its options) and fade in with the run.
  const lookAlpha = state.status === "ready" ? 0 : Math.min(1, Math.max(clock - wakeAt, state.time / (state.clock ?? 1)) / 0.8);
  if (look && lookAlpha > 0) {
    backdrop ??= createBackdrop({ makeCanvas, images, sprite: spriteOn, reduced });
    const view = backdropView();
    ctx.save();
    ctx.globalAlpha = lookAlpha;
    backdrop.drawBody(ctx, look, view);
    backdrop.drawAccent(ctx, look, view);
    ctx.restore();
  } else if (!look && images.saturn) {
    // Only the ring strokes of the original Saturn art, faded at both ends:
    // the planet's hard limb read as a rendering artifact at the screen edge.
    saturnRings ??= ringsOnly(images.saturn);
    const scale = (H / images.saturn.height) * 1.05;
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.drawImage(saturnRings, W * 0.08 - ((camera.x * 0.003) % 30), (H - saturnRings.height * scale) / 2, saturnRings.width * scale, saturnRings.height * scale);
    ctx.restore();
  }
  // The scripted far sky: the brightest star's flash, the asteroid, the plume.
  drawScriptedFar();
  // Original shooting-star clips (cadent1/2), never under reduced motion;
  // home's sky (level I) is a shower: they come about twice as often.
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
        nextCadent = clock + cadentGap(look, hash(clock));
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
  // The shape is islands.mjs islandShape: the marks and particles share it.
  const shape = islandShape(q, x, w, thick, jitter),
    { y, inset } = shape;
  ctx.beginPath();
  ctx.moveTo(x, y + 2);
  for (let k = 0; k <= w; k += 20) ctx.lineTo(x + Math.min(k, w), outlineY(q, Math.min(k, w)) + jitter);
  ctx.lineTo(x + w, y + 3);
  ctx.quadraticCurveTo(x + w - inset * 0.4, y + 9, x + w - inset, y + 12);
  // The underside: one cubic, or two lobes on long islands (> 520 px).
  for (const [, c1, c2, end] of shape.curves) ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1]);
  ctx.quadraticCurveTo(x + inset * 0.4, y + 9, x, y + 3);
  ctx.closePath();
  return shape;
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
  const shape = islandPath(q, x + jitter * 0.6, w, thick, Math.abs(jitter) * 0.5);
  ctx.fillStyle = PAPER;
  ctx.fill();
  if (islandLook && markable(q)) drawIslandMarks(shape);
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
/* ---------- island marks and particles (islands.mjs, RESEARCH_PROGRESSION 4.4) ----------
 * The level's look gives its stable islands a subtle mark (frost, waves,
 * striations, ice nubs, strata, hatching, craters) under the walkable top,
 * and a few ambient particles under their undersides, drawn behind every
 * island. Both are clipped below the HUD band. */
let islandLook = null,
  particlesDrawn = 0;
/** The world-space rectangle under the HUD band, as a clip. */
function clipBelowBand() {
  ctx.beginPath();
  ctx.rect(camera.x - 400, camera.y + HUD_BAND, W + 800, H * 2);
  ctx.clip();
}
function drawIslandMarks(shape) {
  ctx.save();
  clipBelowBand();
  // The current path is the island's own silhouette: clip the marks to it.
  islandPath(shape.q, shape.x, shape.w, shape.thick, shape.jitter);
  ctx.clip();
  paintMarks(ctx, islandLook, shape, { t: clock, reduced });
  ctx.restore();
  ctx.save();
  clipBelowBand();
  paintMarks(ctx, islandLook, shape, { t: clock, reduced, part: "under" });
  ctx.restore();
}
function drawIslandParticles() {
  particlesDrawn = 0;
  if (!islandLook || !ISLAND_LOOKS[islandLook]?.particles) return;
  ctx.save();
  clipBelowBand();
  for (const q of state.platforms) {
    if (q.collapsed || !markable(q) || q.x > camera.x + W + 160 || q.x + q.width < camera.x - 160) continue;
    const thick = q.route === "high" && q.y < 600 ? 30 : 64;
    particlesDrawn += paintParticles(ctx, islandLook, islandShape(q, q.x, q.width, thick), { t: clock, reduced });
  }
  ctx.restore();
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
    if (fallPending(star.id)) continue; // still falling (a scripted fall lands it)
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
    // Never over Diana: on small (portrait) skies the discs grow up to 1.8x
    // and a row of three could cover her head (playtest critic, IV). When the
    // row would touch her (head 90 px above the feet, +-26 px), it rises
    // until it clears her by 8 px. Drawing only: the glyph's timing window
    // is unchanged.
    const r = 19 * scale + 4,
      v = viewPos();
    let gy = q.y + bob;
    const left = gx - r,
      right = gx + (discs - 1) * spacing + r,
      bottom = gy + r + (items.some((g) => g.startsWith("hold-")) ? 14 : 0);
    if (right > v.x - 26 && left < v.x + 26 && bottom > v.y - 90 && gy - r < v.y) gy -= bottom - (v.y - 90) + 8;
    for (const g of items) {
      if (g === "then") {
        diamond(gx - spacing / 2, gy, 3, PAPER, alpha);
        continue;
      }
      glyph(gx, gy, g, alpha, scale);
      gx += spacing;
    }
  }
}
function drawFx(dt, only = null) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const q = fx[i];
    if (only && !only(q)) continue; // each particle advances in the pass that draws it
    q.life -= dt / q.span;
    if (q.floor != null && q.vy > 0 && q.y > q.floor) q.life = 0;
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
    } else if (q.kind === "crumb") {
      // A soil crumb: a small paper chip with an ink edge (the title ground).
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate((1 - q.life) * q.spin);
      ctx.globalAlpha = Math.min(1, q.life * 2);
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-q.size, -q.size * 0.6);
      ctx.lineTo(q.size, -q.size);
      ctx.lineTo(q.size * 0.8, q.size * 0.7);
      ctx.lineTo(-q.size * 0.7, q.size);
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
/** The breath bar's reading (hud.mjs), or QA's preview charge. */
function meterNow() {
  if (capePreview != null) return { charge: capePreview, full: capePreview >= 1 };
  return capeMeter(state);
}
/** The model's animation state drawn with the current sprite set: the
 * no-cape override clips while the cape is not hers (animation.mjs). */
function setAnim(anim, set) {
  return { name: clipFor(manifest, anim.name, set), age: anim.age };
}
function drawPlayer() {
  const p = { ...state.player, ...viewPos() };
  const set = dianaSet();
  // The cape as the meter: four steps with the breath bar, 60% when spent
  // without one (hud.mjs capeTint), nothing while she flies or has no cape.
  tint += (capeTint(state, set.name, meterNow()) - tint) * 0.25;
  if (state.status === "ready") {
    if (emergence) return drawEmergence(p);
    // Title: Diana is still the two leaves in the soil (the original sprout).
    const f = frameForClip(manifest, "sprout", clock);
    sprite(f.sheet, f.frame, p.x, p.y - 30, 0.42);
    return;
  }
  if (state.status === "dead") return drawShards();
  const sinceWake = clock - wakeAt;
  if (sinceWake < 0.16 && !wokeFromEarth) {
    // A wake without the emergence (QA, Restart): the leaves pop at once.
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
  const anim = setAnim(state.animation, set.name);
  const dash = clipFor(manifest, "dash", set.name);
  if (state.dashRemaining > 0 && !reduced)
    for (let i = 3; i >= 1; i--) drawDiana(dash, anim.age, p.x - i * 22, p.y + footFor(manifest, dash, anim.age), 0.07 + (3 - i) * 0.03);
  const settle = momentFor("cape");
  if (settle && set.name === "cape") {
    // II's GET: the cape settles on her. The caped clip fades in over the
    // no-cape one (same pose, pivot and body lines), so her body stays
    // opaque and only the cape appears.
    // (II's asteroid eye holds the cape back for a beat, then the light brings it.)
    const t = momentAge(settle),
      u = settle.eye ? eyeAt(t, beatSeconds()).cape : settleAt(t).cape,
      bare = setAnim(state.animation, "nocape");
    drawDiana(bare.name, bare.age, p.x, p.y + footFor(manifest, bare.name, bare.age));
    drawDiana(anim.name, anim.age, p.x, p.y + footFor(manifest, anim.name, anim.age), u, tint);
  } else drawDiana(anim.name, anim.age, p.x, p.y + footFor(manifest, anim.name, anim.age), 1, tint);
  drawLeafGlint(p);
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
/* ---------- the leaf glint: the double jump in hand ----------
 * RESEARCH_PROGRESSION 2.1 and MOVEMENT_AUDIT E2: one small original star
 * just above Diana's leaves while the double jump is hers and unspent in
 * this airtime (hud.mjs doubleInHand). Its height lags her body by 60 ms (a
 * history of where she was drawn, in real time), bursts into the star sheet's burst
 * frames when she spends it and pops back on landing. */
const glint = { shown: false, since: -9, trail: [], x: 0, y: 0 };
const GLINT_LAG = 0.06;
function laggedFeet(t) {
  const tr = glint.trail;
  let i = tr.length - 1;
  while (i > 0 && tr[i - 1].t > t) i--;
  const b = tr[i],
    a = tr[i - 1];
  if (!a || b.t <= t) return b;
  const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}
function drawLeafGlint(p) {
  const tr = glint.trail,
    last = tr.at(-1);
  // A teleport (respawn, Back to last light) starts the history afresh.
  if (last && (Math.abs(last.x - p.x) > 120 || Math.abs(last.y - p.y) > 120)) tr.length = 0;
  tr.push({ t: clock, x: p.x, y: p.y });
  while (tr.length > 2 && tr[1].t < clock - 0.25) tr.shift();
  // While the GET's star rises into place, the rising star is the glint.
  const inHand = doubleInHand(state) && !momentFor("double");
  if (inHand && !glint.shown) glint.since = clock;
  glint.shown = inHand;
  if (!inHand) return;
  // Only the height lags: she runs at a constant speed, so a lag in x would
  // just park the star 16-19 px behind her head instead of over it. Rising,
  // it rides her head (a 60 ms lag of a 635 px/s jump would sink it 38 px
  // into her leaves); falling and landing, it trails above and settles.
  const at = laggedFeet(clock - GLINT_LAG),
    pop = reduced ? 1 : Math.min(1, (clock - glint.since) / 0.12);
  glint.x = p.x + ANCHORS.glint.dx;
  glint.y = Math.min(at.y, p.y) + ANCHORS.glint.dy;
  const frame = reduced ? 2 : 2 + (Math.floor(clock * 4) % 2);
  sprite("star", frame, glint.x, glint.y, 0.085 * (0.6 + 0.4 * pop), 0.95 * pop);
}

/* ---------- the GET moments (RESEARCH_PROGRESSION 2.1, moments.mjs) ----------
 * A `get` event (the eight-level model) or QA's previewGet starts one. They
 * are drawn over the simulation and never change it. Each is timed on the
 * simulation clock, like the scripted moments below: a pause holds it,
 * Gentle pace slows it with the world, a respawn that rewinds past it ends
 * it, and a synchronous QA run that passes a GET still shows it. */
const moments = [];
// Real seconds per bar and beat at the level's tempo (and Gentle pace).
const barSeconds = () => 240 / ((state.def.bpm ?? 107) * pace);
const beatSeconds = () => barSeconds() / 4;
/** Real seconds since simulation time `sim` (negative before it). */
const sinceSim = (sim) => (state.time - sim) / ((state.clock ?? 1) * pace);
const momentAge = (m) => sinceSim(m.sim);
function momentLive(m) {
  const t = momentAge(m);
  return t > -0.05 && t < m.seconds;
}
function momentFor(verb) {
  return moments.find((m) => m.verb === verb && momentLive(m)) ?? null;
}
/** `get` is the GET (a level's or a QA preview) when known: II's cape
 * moment needs its asteroid. `loud` false (a quiet QA step) skips the
 * particles and the button pulses. */
function startMoment(verb, { sim = state.time, loud = true, get = null } = {}) {
  for (let i = moments.length - 1; i >= 0; i--) if (moments[i].verb === verb) moments.splice(i, 1);
  const bar = barSeconds(),
    stone = get ? capeStone(get) : null,
    m = { verb, sim, bar, seconds: momentSeconds(verb, bar) };
  // II: the cape is the asteroid's gift (GDD). With its stone in view the
  // moment is the eye: it opens, a beat, a light leaves it and the cape
  // settles as it arrives, all within 1.5 s (moments.mjs eyeAt).
  if (stone) Object.assign(m, { eye: stone, seconds: eyeSeconds(beatSeconds()) });
  moments.push(m);
  if (!loud) return m;
  const p = state.player;
  if (verb === "cape" && !m.eye) capeBurst();
  if (verb === "dive") {
    // The necklace shows what it woke for: light glints out of the next
    // lid ahead (the stone she can now open), if one is in view.
    const lid = state.platforms.find((q) => q.type === "lid" && !q.collapsed && q.x + q.width > p.x && q.x < p.x + W);
    if (lid) fx.push({ kind: "burst", x: lid.x + lid.width / 2, y: lid.y + 6, vx: 0, vy: 0, life: 1, span: 0.9, scale: 0.34 });
  }
  // The touch button of the new verb fades in with one pulse.
  const button = { cape: "touch-cape", dive: "touch-dive" }[verb];
  if (button) pulseClass($(button), "arrive", 900);
  if (verb === "cape") pulseClass($("breath"), "arrive", 900);
  return m;
}
/** The gift settles: a burst at the cape's tip, sparks along her back. */
function capeBurst() {
  if (reduced) return;
  const p = state.player;
  fx.push({ kind: "follow-burst", dx: -34, dy: -48, life: 1, span: 0.45, vx: 0, vy: 0, scale: 0.3 });
  puff("spark", p.x - 22, p.y - 52, 7, 40);
}
/** Restart a one-shot CSS animation class (and drop it afterwards). */
function pulseClass(node, cls, ms) {
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
  clearTimeout(node[`_${cls}`]);
  node[`_${cls}`] = setTimeout(() => node.classList.remove(cls), ms);
}
/** The helper: the original star with a tail-star streak and a breathing
 * halo. `angle` is its direction of travel (the streak trails behind it). */
function drawHelper(x, y, alpha, angle) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (images.tailStar) {
    // tail-star.png's head is at (520, 200) of 555 x 251 and it travels at
    // about 0.37 rad (down-right): turn it onto the helper's own heading.
    const k = 0.15;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle - 0.37);
    ctx.globalAlpha *= 0.55;
    ctx.drawImage(images.tailStar, -520 * k, -200 * k, 555 * k, 251 * k);
    ctx.restore();
  }
  const pulse = reduced ? 0.5 : (Math.sin(clock * 5) + 1) / 2;
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha *= 0.35 + pulse * 0.25;
  ctx.beginPath();
  ctx.arc(x, y, 9 + pulse * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  sprite("star", 2, x, y, 0.13, alpha, reduced ? 0 : Math.sin(clock * 1.7) * 0.3);
}
/** A tail-star streak with its head at (x, y), travelling along `heading`. */
function streak(x, y, heading, k, alpha) {
  if (!images.tailStar || alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading - 0.37);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(images.tailStar, -520 * k, -200 * k, 555 * k, 251 * k);
  ctx.restore();
}
/** GETs still ahead: the level's (`def.gets`, not yet taken) and QA's
 * previews (renderer-only, fired here when Diana reaches them). */
let previewGets = [];
function pendingGets() {
  const taken = state.gotten ?? [];
  return [...(state.def.gets ?? []).filter((g) => !taken.includes(g.id)), ...previewGets];
}
/** The run line under a GET: the stone top at its x closest to Diana. */
function runLineAt(x) {
  let best = null;
  for (const q of state.platforms)
    if (!q.collapsed && x >= q.x && x <= q.x + q.width && (best == null || Math.abs(q.y - state.player.y) < Math.abs(best - state.player.y))) best = q.y;
  return best ?? state.player.y;
}
function drawMoments() {
  if (state.status === "ready") return;
  const p = { ...state.player, ...viewPos() },
    alive = state.status !== "dead",
    S = scriptedOf();
  // Before each GET: what Diana runs toward.
  for (const g of pendingGets()) {
    const d = g.x - p.x;
    if (d > W * 1.6 || d < -40) continue;
    const y = runLineAt(g.x);
    if (g.verb === "glide" || g.verb === "super") {
      const a = helperApproach(g.verb, d, clock);
      // A scripted helper moment aimed at this GET (III's helper-drift)
      // decides when the helper appears: it fades in from that moment.
      const cue = S.list.find((m) => m.kind === "helper" && m.target === g.id);
      const gate = cue ? Math.max(0, Math.min(1, sinceSim(cue.at) / 0.4)) : 1;
      if (cue && gate > 0) shownScripted.add(cue.id);
      if (a) drawHelper(g.x + a.x, y + a.y, a.alpha * gate, g.verb === "super" && d < 160 ? -1.2 : Math.atan2(0.2, -0.35));
    } else if (g.verb === "double") {
      // The first star that landed softly rests on the run line, circling
      // (from its scripted fall's landing, when one is aimed at the GET).
      const landed = S.targets.get(g.id);
      if (landed != null && state.time < landed) continue;
      const a = reduced ? 0 : clock * 2.2;
      sprite("star", 2, g.x + Math.cos(a) * 6, y - 16 + Math.sin(a) * 3, 0.16, 0.95);
    }
  }
  // QA previews fire once Diana runs through them.
  for (const g of previewGets) if (p.x >= g.x) startMoment(g.verb, { get: g });
  previewGets = previewGets.filter((g) => p.x < g.x);
  for (let i = moments.length - 1; i >= 0; i--) {
    const m = moments[i],
      t = momentAge(m);
    if (t >= m.seconds || t < -0.05) {
      moments.splice(i, 1);
      continue;
    }
    if (!alive) continue;
    if (m.verb === "double") {
      const r = riseAt(t);
      sprite("star", 2, p.x + r.dx, p.y + r.dy, r.scale, r.alpha);
    } else if (m.verb === "glide" || m.verb === "super") drawHelperAfter(m, t, p);
    else if (m.verb === "dive") drawNecklace(p, t, m.bar);
    else if (m.verb === "cape" && m.eye) drawEyeLight(m, t, p);
  }
  drawScriptedFront(p, alive);
}
/** III after the GET: the helper loops round Diana, then (with a helper
 * decor at the GET) drifts down its slope of air ahead of her; without one
 * it flies off ahead and up. Her cape ripples on each beat of the bar. */
function drawHelperAfter(m, t, p) {
  const slope = m.verb === "glide" ? (state.def.decor ?? []).find((d) => d.kind === "helper" && d.to && Math.abs(d.x - p.x) < 900) : null;
  if (slope) {
    const s = slopeAt(t, m.bar);
    if (s.loop) {
      m.from = { x: p.x + s.dx, y: p.y + s.dy };
      drawHelper(m.from.x, m.from.y, s.alpha, s.trail);
    } else {
      // From where the loop left it to just past the slope's foot, 46 px
      // above the float line (its stars stay clear).
      const a = m.from ?? { x: slope.x, y: slope.y - 30 },
        b = { x: slope.to[0] + 120, y: slope.to[1] - 46 };
      drawHelper(a.x + (b.x - a.x) * s.u, a.y + (b.y - a.y) * s.u, s.alpha, Math.atan2(b.y - a.y, b.x - a.x));
    }
  } else {
    const h = helperAfter(t, m.bar);
    drawHelper(p.x + h.dx, p.y + h.dy, h.alpha, h.trail);
  }
  if (m.verb === "glide") drawRipple(p, rippleAt(t, m.bar));
}
/** IV's GET: the necklace wakes (a glint at her chest, three rings). */
function drawNecklace(p, t, bar) {
  const n = necklaceAt(t, bar),
    cx = p.x + ANCHORS.chest.dx,
    cy = p.y + ANCHORS.chest.dy;
  ctx.save();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2;
  for (const ring of reduced ? n.rings.slice(0, 1) : n.rings) {
    ctx.globalAlpha = ring.alpha * n.fade;
    ctx.beginPath();
    ctx.arc(cx, cy, reduced ? 18 : ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  sprite("star", 2, cx, cy, 0.07 + 0.03 * n.glint, n.fade);
}
/** III's GET: the cape ripples on each beat of one bar (three short ink-on-
 * paper strokes of light along its trailing edge). */
function drawRipple(p, amount) {
  if (amount <= 0.01 || reduced) return;
  const x = p.x + ANCHORS.cape.dx,
    y = p.y + ANCHORS.cape.dy;
  ctx.save();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.85 * amount;
  for (let k = 0; k < 3; k++) {
    const yy = y + k * 9,
      w = 14 + k * 4;
    ctx.beginPath();
    ctx.moveTo(x - w, yy);
    ctx.quadraticCurveTo(x - w / 2, yy - 5 * amount, x, yy);
    ctx.quadraticCurveTo(x + w / 3, yy + 3 * amount, x + w / 2, yy);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- II's asteroid eye (RESEARCH_PROGRESSION 2.1, GDD) ----------
 * The cape is the asteroid's gift. The stone (the original meteoroCheio,
 * the full meteor of the HUD) lies half buried in the crater beside every
 * cape GET, 440 px past it so the eye is in view as she reaches the GET and
 * still well ahead of her when the light leaves it. It is drawn behind the
 * islands at 60% over an opaque ink disc: under --mute brightness, so Diana
 * stays the brightest thing in front of it. */
const STONE_R = 95;
function capeStone(g) {
  if (g?.verb !== "cape") return null;
  const d = (state.def.decor ?? []).find((q) => q.kind === "asteroid" && q.x >= g.x - 100 && q.x <= g.x + 900);
  return d ? { x: d.x, y: d.y, r: d.r ?? STONE_R } : { x: g.x + 440, y: runLineAt(g.x), r: STONE_R };
}
/** Its centre, a little under the run line (more than half shows), and its eye. */
const stoneCentre = (s) => ({ x: s.x, y: s.y + 0.15 * s.r });
const eyeOf = (s) => ({ x: s.x - 0.3 * s.r, y: s.y + 0.15 * s.r - 0.4 * s.r, w: 0.44 * s.r });
function stones() {
  const out = [];
  const add = (s, moment) => s && !out.some((o) => Math.abs(o.x - s.x) < 1) && out.push({ ...s, moment });
  for (const m of moments) if (m.eye && momentLive(m)) add(m.eye, m);
  for (const g of [...(state.def.gets ?? []), ...previewGets]) add(capeStone(g), null);
  for (const d of state.def.decor ?? []) if (d.kind === "asteroid") add({ x: d.x, y: d.y, r: d.r ?? STONE_R }, null);
  return out;
}
/** A half-buried asteroid: ink disc, the meteor art at `alpha`, clipped at
 * the ground line `cut` (world or screen y, whatever the caller draws in). */
function drawStone(cx, cy, r, alpha, cut) {
  if (!images.meteor) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - r - 4, cy - r - 4, 2 * r + 8, cut - (cy - r - 4));
  ctx.clip();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.98, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.rotate(-0.35);
  // meteoroCheio.png: a 1080 px disc (radius about 525 px) with two cracks.
  const k = r / 525;
  ctx.drawImage(images.meteor, -540 * k, -540 * k, 1080 * k, 1080 * k);
  ctx.restore();
}
function drawAsteroids() {
  for (const s of stones()) {
    if (s.x + s.r < camera.x - 40 || s.x - s.r > camera.x + W + 40) continue;
    const c = stoneCentre(s);
    drawStone(c.x, c.y, s.r, 0.6, s.y + 14);
    const m = s.moment;
    drawEye(eyeOf(s), m ? eyeAt(momentAge(m), beatSeconds()) : { open: 0, earth: 0 });
  }
}
/** The asteroid's eye: a closed lash line, or an almond of paper with an
 * ink iris and, in its pupil, a small blue world (Earth: the only colour).
 * Under reduced motion it fades open instead of parting. */
function drawEye(e, st) {
  const open = st.open;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineCap = "round";
  ctx.lineWidth = 2;
  const half = e.w / 2,
    h = reduced ? (open > 0.01 ? e.w * 0.24 : 0) : e.w * 0.24 * open;
  if (h < 1) {
    // Closed: one drooping lash line.
    ctx.beginPath();
    ctx.moveTo(e.x - half, e.y);
    ctx.quadraticCurveTo(e.x, e.y + 5, e.x + half, e.y);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (reduced) ctx.globalAlpha *= open;
  ctx.beginPath();
  ctx.moveTo(e.x - half, e.y);
  ctx.quadraticCurveTo(e.x, e.y - h * 1.15, e.x + half, e.y);
  ctx.quadraticCurveTo(e.x, e.y + h * 0.95, e.x - half, e.y);
  ctx.closePath();
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const ir = Math.min(e.w * 0.17, h * 0.9 + 2);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(e.x - 2, e.y - h * 0.05, ir, 0, Math.PI * 2);
  ctx.fill();
  if (st.earth > 0.01) {
    ctx.globalAlpha *= st.earth;
    ctx.fillStyle = EARTH;
    ctx.beginPath();
    ctx.arc(e.x - 2, e.y - h * 0.05, ir * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(e.x - 2 - ir * 0.2, e.y - h * 0.05 - ir * 0.22, ir * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.stroke();
  ctx.restore();
}
/** The light leaving the pupil for Diana's back; the cape's burst when it arrives. */
function drawEyeLight(m, t, p) {
  const st = eyeAt(t, beatSeconds());
  if (st.light != null && !reduced) {
    const e = eyeOf(m.eye),
      tx = p.x + ANCHORS.cape.dx,
      ty = p.y + ANCHORS.cape.dy,
      u = st.light * st.light * (3 - 2 * st.light),
      x = e.x + (tx - e.x) * u,
      y = e.y + (ty - e.y) * u - Math.sin(Math.PI * u) * 30;
    streak(x, y, Math.atan2(ty - e.y, tx - e.x), 0.08, 0.6);
    sprite("star", 2, x, y, 0.09, 1);
  }
  if (t >= eyeTimes(beatSeconds()).cape && !m.burst) {
    m.burst = true;
    capeBurst();
  }
}

/* ---------- scripted world moments and decor (moments.mjs MOMENT_KINDS,
 * DECOR_KINDS; level.mjs def.moments / def.decor) ----------
 * Read generically from the level's data and sampled from the simulation
 * clock, so a stage that authors these kinds needs no renderer work. Three
 * layers: the far sky (the flash, the asteroid's streak, the plume) behind
 * the islands; the world's back (falling stars, locks, glints) behind
 * stars, glyphs and Diana; and the front (the helper, the necklace, the
 * ripple). Each layer is clipped below the HUD band. */
let scripted = { def: null };
function scriptedOf() {
  if (scripted.def === state.def) return scripted;
  const list = scriptedMoments(state.def),
    // Pickup or GET id -> the time its star lands (hidden until then).
    targets = new Map(list.filter((m) => m.kind === "fall" && m.target).map((m) => [m.target, m.at]));
  scripted = { def: state.def, list, targets, decor: state.def.decor ?? [] };
  return scripted;
}
const shownScripted = new Set(); // moment and decor ids drawn in the last frame (QA)
const starBob = (q) => (reduced ? 0 : Math.sin(clock * 2 + q.x) * 3.5);
/** A star still waiting for its scripted fall is not drawn yet. */
function fallPending(id) {
  const at = scriptedOf().targets.get(id);
  return at != null && state.time < at - 1e-9;
}
/** Where a fall lands: its pickup (with the bob it will have), or a GET's
 * resting star on the run line (a soft fall). null: nothing to land on. */
function fallTarget(m) {
  const q = state.pickups.find((s) => s.id === m.target);
  if (q) return q.collected ? null : { x: q.x, y: q.y + starBob(q), soft: false, scale: q.chain ? 0.24 : 0.21 };
  const g = (state.def.gets ?? []).find((s) => s.id === m.target);
  return g ? { x: g.x, y: runLineAt(g.x) - 16, soft: true, scale: 0.16 } : null;
}
function drawScriptedBack() {
  if (state.status === "ready") return;
  const S = scriptedOf(),
    left = camera.x - 200,
    right = camera.x + W + 200;
  ctx.save();
  clipBelowBand();
  for (const m of S.list) {
    const t = sinceSim(m.at);
    if (m.kind === "fall") {
      const g = fallTarget(m),
        f = g && fallAt(t, { soft: g.soft });
      if (!f || g.x < left - 500 || g.x > right + 500) continue;
      shownScripted.add(m.id);
      if (f.phase === "fall") {
        if (reduced) {
          // Reduced motion: no streak, the star fades in where it lands.
          sprite("star", 2, g.x, g.y, g.scale, Math.max(0, Math.min(1, (t + 0.25) / 0.25)));
          continue;
        }
        streak(g.x + f.dx, g.y + f.dy, f.heading, 0.13, 0.6 * f.alpha);
        sprite("star", 2, g.x + f.dx, g.y + f.dy, g.scale, f.alpha);
      } else {
        ctx.save();
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 1.4;
        ctx.globalAlpha *= f.ringAlpha;
        ctx.beginPath();
        ctx.arc(g.x, g.y, reduced ? 16 : f.ring, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        if (!reduced) sprite("star", f.burst, g.x, g.y, g.scale * 1.1, 0.8);
      }
    } else if (!MOMENT_KINDS[m.kind] && t >= 0 && t < 0.4) {
      // An unknown kind (a builder's new idea before its art): a small
      // burst at its target, or ahead of Diana.
      const q = state.pickups.find((s) => s.id === m.target) ?? (state.def.gets ?? []).find((s) => s.id === m.target);
      const x = q?.x ?? state.player.x + 220,
        y = q?.y ?? state.player.y - 60;
      shownScripted.add(m.id);
      sprite("star", 4 + Math.min(3, Math.floor(t * 10)), x, y, 0.3, 0.8);
    }
  }
  for (const d of S.decor) {
    if (d.kind === "cluster") {
      const xs = d.stars.map(([x]) => x);
      if (Math.max(...xs) < left || Math.min(...xs) > right) continue;
      shownScripted.add(d.id);
      drawCluster(d.stars);
    } else if (d.kind === "glint") {
      if (d.x < left || d.x > right) continue;
      // Until the stone under it breaks.
      const under = state.platforms.find((q) => d.x >= q.x && d.x <= q.x + q.width && Math.abs(q.y - d.y) < 30);
      if (under?.collapsed) continue;
      shownScripted.add(d.id);
      drawGlint(d.x, d.y - 4);
    }
  }
  ctx.restore();
}
/** A lock: stars that are drawn and never collected, joined by the unlinked
 * constellation hairline (a shape she will reach with a verb to come). */
function drawCluster(stars) {
  ctx.save();
  ctx.strokeStyle = MUTE;
  ctx.globalAlpha *= 0.4;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([2, 7]);
  ctx.beginPath();
  stars.forEach(([x, y], i) => (i ? ctx.quadraticCurveTo((stars[i - 1][0] + x) / 2, (stars[i - 1][1] + y) / 2 - 6, x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
  for (const [x, y] of stars) {
    const frame = reduced ? 2 : 2 + (Math.floor(clock * 4 + x) % 2),
      bob = reduced ? 0 : Math.sin(clock * 1.4 + x) * 2.5;
    sprite("star", frame, x, y + bob, 0.19, 0.85);
  }
}
/** A glinting stone: four short rays and a star, twinkling slowly. */
function drawGlint(x, y) {
  const tw = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 3.1);
  ctx.save();
  ctx.strokeStyle = PAPER;
  ctx.lineCap = "round";
  ctx.lineWidth = 1.4;
  ctx.globalAlpha *= 0.5 + 0.4 * tw;
  const r = 7 + 5 * tw;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.restore();
  sprite("star", 2, x, y, 0.08 + 0.03 * tw, 0.95);
}
/** The front layer: helpers riding wind ahead of her, and the necklace and
 * ripple when no GET moment already draws them. */
function drawScriptedFront(p, alive) {
  if (!alive) return;
  const S = scriptedOf();
  ctx.save();
  clipBelowBand();
  for (const m of S.list) {
    const t = sinceSim(m.at);
    if (m.kind === "helper") {
      // A GET target is handled by its approach (drawMoments).
      if ((state.def.gets ?? []).some((g) => g.id === m.target)) continue;
      const column = state.updrafts.find((u) => u.id === m.target);
      if (column) {
        const r = rideAt(t, (column.bottom - column.top) * 0.85);
        if (!r) continue;
        shownScripted.add(m.id);
        drawHelper(column.x + column.width / 2 + r.dx, column.bottom - 10 + r.dy, r.alpha, r.angle);
      } else if (t >= 0 && t < barSeconds()) {
        // No target: it runs just ahead of her for a bar.
        const h = helperAfter(Math.min(t + 0.5, barSeconds() * 0.99), barSeconds());
        shownScripted.add(m.id);
        drawHelper(p.x + h.dx, p.y + h.dy, h.alpha, h.trail);
      }
    } else if ((m.kind === "necklace" || m.kind === "ripple") && t >= 0 && t < barSeconds()) {
      // Drawn by the GET's own moment when the two coincide (IV, III).
      shownScripted.add(m.id);
      if (m.kind === "necklace" && !momentFor("dive")) drawNecklace(p, t, barSeconds());
      if (m.kind === "ripple" && !momentFor("glide")) drawRipple(p, rippleAt(t, barSeconds()));
    }
  }
  ctx.restore();
}
/** The far sky (drawn in view px, behind the islands): the brightest star's
 * flash, the asteroid streaking to its crash, and each plume after it. */
function drawScriptedFar() {
  if (state.status === "ready") return;
  const S = scriptedOf();
  if (!S.list.some((m) => m.kind === "flash" || m.kind === "crash") && !S.decor.some((d) => d.kind === "plume")) return;
  const p = viewPos(),
    near = Math.max(0.1, Math.min(0.6, (p.x - camera.x) / W));
  // A plume is placed by its distance ahead of Diana (moments.mjs farPlace).
  const plumes = S.decor
    .filter((d) => d.kind === "plume")
    .map((d) => {
      const f = farPlace(d.x - p.x, W, near),
        // A plume beyond the door stays beyond it on screen too.
        door = d.x > WORLD().finishX ? WORLD().finishX - camera.x + 150 * f.scale : -Infinity;
      return { d, x: Math.max(f.x, door), y: d.y - camera.y + 6, scale: f.scale, far: d.x - p.x, at: (d.from ?? 0) * SIXTEENTH_SIM };
    });
  const plumeFor = (crash) => plumes.find((q) => q.d.from === crash.k) ?? plumes[0] ?? { x: W * 0.8, y: H * 0.7, scale: 0.6, at: crash.at };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HUD_BAND, W, H - HUD_BAND);
  ctx.clip();
  for (const m of S.list) {
    const t = sinceSim(m.at);
    if (m.kind === "flash") {
      const a = flashAt(t, reduced);
      if (a > 0) {
        // Paper over the sky, fading in under the HUD band (no hard edge).
        shownScripted.add(m.id);
        const g = ctx.createLinearGradient(0, HUD_BAND, 0, HUD_BAND + 110);
        g.addColorStop(0, "rgba(251,251,234,0)");
        g.addColorStop(1, `rgba(251,251,234,${a})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, HUD_BAND, W, H - HUD_BAND);
      }
      // The bright star flares for half a second (home's body).
      if (t >= 0 && t < 0.6 && currentLook() === "home") {
        const b = bodyBox("home", backdropView());
        sprite("star", 2, b.x, b.y, (b.r * 2.6) / 200 * (reduced ? 1.4 : 1.4 + 1.6 * (1 - t / 0.6)), 1 - t / 0.6);
      }
      // Then the asteroid streaks across, heading right, to the next crash.
      const crash = S.list.find((c) => c.kind === "crash" && c.at > m.at);
      if (!crash) continue;
      const span = (crash.at - m.at) / ((state.clock ?? 1) * pace),
        s = asteroidAt(t, span);
      if (!s || reduced) continue;
      shownScripted.add(m.id);
      // The brightest star itself falls (home's body): it leaves its place
      // slowly, swings out to the right and dives onto the plume's base on
      // the crash. Without that body it crosses high from the upper left.
      const end = plumeFor(crash),
        home = currentLook() === "home" ? bodyBox("home", backdropView()) : null,
        S0 = home ? { x: home.x, y: home.y } : { x: W * 0.04, y: HUD_BAND + 46 },
        C = home ? { x: Math.max(S0.x, end.x) + W * 0.16, y: S0.y + H * 0.02 } : { x: end.x - W * 0.05, y: HUD_BAND + 30 },
        e = s.e,
        at = (u) => ({ x: (1 - u) ** 2 * S0.x + 2 * (1 - u) * u * C.x + u * u * end.x, y: (1 - u) ** 2 * S0.y + 2 * (1 - u) * u * C.y + u * u * end.y }),
        here = at(e),
        ahead = at(Math.min(1, e + 0.01));
      streak(here.x, here.y, Math.atan2(ahead.y - here.y, ahead.x - here.x), 0.34, 0.7 * s.alpha);
      drawStone(here.x, here.y, 9, s.alpha, here.y + 20);
    }
  }
  for (const m of S.list) if (m.kind === "crash" && sinceSim(m.at) >= 0 && sinceSim(m.at) < 1.6) shownScripted.add(m.id);
  for (const q of plumes) {
    const t = sinceSim(q.at),
      pl = plumeAt(t, reduced);
    if (!pl) continue;
    shownScripted.add(q.d.id);
    drawPlume(q, pl);
  }
  ctx.restore();
}
/** The dust plume (paper billows at most 0.3 alpha: under --mute): a
 * column of overlapping billows leaning with the signal's way, spreading
 * into a cap, fading into the dark at its foot. Within about 2200 px the
 * asteroid shows half buried at its base, its rim glinting: the goal
 * beyond the door (brief 4.5 I, coda). */
function drawPlume(q, pl) {
  const s = q.scale,
    height = 300 * s * pl.rise;
  ctx.save();
  if (pl.impact > 0) {
    // The boom: a flash on the horizon.
    const glow = ctx.createRadialGradient(q.x, q.y, 2, q.x, q.y, 140 * s);
    glow.addColorStop(0, `rgba(251,251,234,${0.55 * pl.impact})`);
    glow.addColorStop(1, "rgba(251,251,234,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(q.x - 140 * s, q.y - 140 * s, 280 * s, 280 * s);
  }
  ctx.lineWidth = 1;
  const n = 18;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1),
      cap = f > 0.72,
      jit = hash(i * 7.7 + 3),
      side = cap ? (i % 2 ? 1 : -1) * (0.4 + (f - 0.72) * 3.6) : (jit - 0.5) * 0.7,
      r = (18 + f * 24 + (cap ? 8 : 0)) * (0.8 + 0.4 * jit) * s * (0.55 + 0.45 * pl.rise),
      x = q.x + side * 30 * s + Math.sin(i * 2.3 + pl.billow * 0.3) * 5 * s + f * 30 * s,
      y = q.y - height * Math.min(1, f * 1.05) - (cap ? jit * 10 * s : 0),
      foot = Math.min(1, f * 4 + 0.1);
    // Soft fills that overlap into one column; only a faint rim on the
    // upper billows, so it reads as dust and not as bubbles.
    ctx.fillStyle = `rgba(251,251,234,${(0.045 + 0.04 * f) * foot})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (f > 0.45) {
      ctx.strokeStyle = `rgba(251,251,234,${0.05 + 0.1 * f})`;
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
  }
  ctx.restore();
  const show = Math.max(0, Math.min(1, (2200 - q.far) / 500));
  if (show <= 0) return;
  ctx.save();
  ctx.globalAlpha *= show;
  drawStone(q.x + 6 * s, q.y + 10 * s, 60 * s, 0.6, q.y + 2);
  const tw = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 2.6);
  sprite("star", 2, q.x - 30 * s, q.y - 38 * s, 0.07 + 0.04 * tw, 0.6 + 0.4 * tw);
  ctx.restore();
}
/** Real-time side effects of the scripted moments (frame() only, never in
 * a QA step): the score ducks for the beat before a crash (one beat of
 * silence, brief §5), and the boom shakes the view a little. */
let scriptedPrev = 0;
function scriptedCues() {
  const now = state.time,
    prev = scriptedPrev;
  scriptedPrev = now;
  if (now <= prev || state.status !== "running") return;
  for (const m of scriptedOf().list) {
    if (m.kind !== "crash") continue;
    const hush = m.at - 4 * SIXTEENTH_SIM;
    if (prev < hush && now >= hush) audio.duck(30, 0.05, Math.max(0.05, beatSeconds() - 0.09), 0.04);
    if (prev < m.at && now >= m.at && !reduced) shake = Math.max(shake, 4);
  }
}

/* ---------- the wake: Diana emerges from the earth ---------- */
let wokeFromEarth = false;
/** The sprite set Diana is drawn with (hud.mjs spriteSetName: the no-cape
 * clips while the state's verbs lack the cape, or a level's `sprites`),
 * resolved against the manifest (emergence.mjs). */
function dianaSet() {
  return resolveSet(manifest, spriteSetName(state, spriteSetOverride));
}
/** Drawn in the world layer before the title ground, which then hides
 * everything under the soil along its own contour. */
function drawEmergence(p) {
  const e = emergenceAt(clock - emergence.at, { reduced });
  if (e.sprout.alpha > 0.01) {
    const f = frameForClip(manifest, "sprout", (clock - emergence.at) * e.sprout.rate + emergence.phase0);
    sprite(f.sheet, f.frame, p.x, p.y - 30 - e.sprout.lift, e.sprout.scale, e.sprout.alpha, e.sprout.shake);
  }
  if (e.phase !== "twitch") drawDiana(emergence.set.body, clock - emergence.at, p.x, p.y + e.depth);
  if (e.phase !== emergence.phase) {
    // Soil bits thrown up as the head breaks through and as she pops out.
    emergence.phase = e.phase;
    if (!reduced)
      for (let i = 0; i < e.crumbs; i++)
        fx.push({
          kind: "crumb",
          x: p.x + (Math.random() - 0.5) * (e.phase === "pop" ? 46 : 26),
          y: p.y - 2,
          vx: (Math.random() - 0.5) * (e.phase === "pop" ? 170 : 70),
          vy: -(e.phase === "pop" ? 170 : 90) - Math.random() * 80,
          g: 900,
          spin: (Math.random() - 0.5) * 10,
          size: 2 + Math.random() * 2.5,
          floor: p.y + 3, // falls back onto the soil and is gone
          life: 1,
          span: 0.55 + Math.random() * 0.2,
        });
  }
}
/** Over the title ground: the soil parts around her (two short ink strokes
 * that open while she rises and close once she is out). */
function drawSoilMarks() {
  if (!emergence || state.status !== "ready") return;
  const e = emergenceAt(clock - emergence.at, { reduced });
  const open = e.phase === "twitch" ? 0.25 : e.phase === "rise" || e.phase === "look" ? 1 : e.phase === "pop" ? 0.6 : 0;
  if (open <= 0) return;
  const p = state.player,
    x = p.x - camera.x,
    y = p.y - camera.y;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * (10 + 6 * open), y + 1);
    ctx.quadraticCurveTo(x + side * (20 + 8 * open), y - 4 * open, x + side * (30 + 8 * open), y + 1.5);
    ctx.stroke();
  }
  ctx.restore();
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
    targetY = state.status === "ready" ? WORLD().startY - soilFraction * H : cameraTargetY(state.anchorY, state.fallTime);
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
  shownScripted.clear();
  drawSky();
  drawSignal();
  let sx = 0,
    sy = 0;
  if (shake > 0 && !reduced) {
    sx = (Math.random() - 0.5) * shake * 2;
    sy = (Math.random() - 0.5) * shake * 2;
  }
  shake = Math.max(0, shake - dt * 12);
  // Wall time since waking, or simulation time when QA steps ahead of it.
  const sinceWake = Math.max(clock - wakeAt, state.time / (state.clock ?? 1));
  // The title shows only the sky, the soil and the sprout: the level's
  // stars, glyphs, beacons and islands appear as the title ground fades, so
  // nothing in the world can sit over the title's options.
  const worldAlpha = state.status === "ready" ? 0 : Math.min(1, sinceWake / 0.5);
  ctx.save();
  ctx.translate(-camera.x + sx, -camera.y + sy);
  if (worldAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = worldAlpha;
    drawUpdrafts();
    // The look's ambient particles and II's asteroid sit behind the islands
    // (the crater floor half buries the stone); the scripted back layer
    // (falling stars, locks, glints) behind stars, glyphs and Diana.
    islandLook = currentLook();
    drawIslandParticles();
    drawAsteroids();
    for (const q of state.platforms) drawPlatform(q);
    drawBeacons();
    drawPortal();
    drawScriptedBack();
    drawConstellations();
    drawStars();
    drawPrompts();
    ctx.restore();
  }
  drawPlayer();
  drawMoments();
  drawFx(dt, (q) => q.kind !== "crumb");
  ctx.restore();
  if (state.status === "ready") titleGround(1);
  else if (sinceWake < 0.7) titleGround(1 - sinceWake / 0.6);
  drawSoilMarks();
  // Soil crumbs fly over the ground they came from.
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawFx(dt, (q) => q.kind === "crumb");
  ctx.restore();
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
  syncBreath();
  // Owned verbs (eight-level model): the touch cape and dive are absent
  // until theirs; without the field every control shows, as before.
  const verbs = state.verbs ? Object.keys(state.verbs).filter((k) => state.verbs[k]).join(" ") : null;
  if (verbs !== ui.verbs) {
    ui.verbs = verbs;
    if (verbs == null) delete root.dataset.verbs;
    else root.dataset.verbs = verbs;
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
/** The breath bar (RESEARCH_PROGRESSION 3.3): the original disc, frame and
 * fill, top-left, only once the cape is hers. The fill is the continuous
 * charge; three ink notches mark the quarters; full turns the disc into the
 * asteroid stone with one ring pulse. The touch cape's rim follows it. */
function syncBreath() {
  const m = state.status === "ready" ? null : meterNow(),
    bar = $("breath"),
    cape = $("touch-cape");
  if (!!m !== ui.breathShown) {
    ui.breathShown = !!m;
    bar.hidden = !m;
    // Absent, not empty: the star count and slots move back left.
    if (m) root.dataset.breath = "";
    else delete root.dataset.breath;
    ui.breath = ui.breathFull = null;
  }
  if (!m) return;
  const charge = Math.round(m.charge * 1000) / 1000;
  if (charge !== ui.breath) {
    ui.breath = charge;
    bar.style.setProperty("--charge", String(charge));
    cape.style.setProperty("--charge", String(charge));
    bar.setAttribute("aria-valuenow", String(Math.floor(charge * 4 + 1e-9) * 25));
  }
  if (m.full !== ui.breathFull) {
    const was = ui.breathFull;
    ui.breathFull = m.full;
    bar.classList.toggle("full", m.full);
    cape.classList.toggle("full", m.full);
    if (m.full && was === false) {
      pulseClass(bar, "pulse", 800);
      pulseClass(cape, "lit", 700);
    }
  }
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
  // Continue is always the way on: the next level, or after the last level
  // back to the title (the user disliked a separate Title button here).
  $("continue").dataset.to = last ? "title" : "next";
  $("continue").setAttribute("aria-label", last ? "Continue to the title" : `Continue to ${LEVELS[n].numeral} · ${LEVELS[n].title}`);
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
  $("continue").focus({ preventScroll: true });
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
          // The leaf glint is spent: it bursts where it was drawn.
          if (glint.shown) fx.push({ kind: "burst", x: glint.x, y: glint.y, vx: 0, vy: 0, life: 1, span: 0.32, scale: 0.13 });
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
      case "wind-refund":
        if (loud) {
          fx.push({ kind: "follow-burst", dx: -34, dy: -48, life: 1, span: 0.4, vx: 0, vy: 0, scale: 0.24 });
        }
        break;
      case "get":
        // A new verb (the eight-level model): its wordless moment, timed on
        // the simulation clock from the event (a quiet QA step still shows it).
        startMoment(e.verb, { sim: e.time, loud, get: (state.def.gets ?? []).find((g) => g.id === e.id) ?? null });
        ui.verbs = undefined;
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
/** Wake at once: the run (and the score's bar 1) begins now. The end of the
 * emergence, a second press during it, QA's start() and Continue call this. */
let wakingTimer = 0;
function wake() {
  if (!ready || state.status !== "ready") return;
  unlockAudio();
  wokeFromEarth = !!emergence;
  emergence = null;
  // The score starts with the wake event (bar 1, the sky on Bm); a title
  // song that is playing fades out under it.
  start(state);
  wakeAt = clock;
  root.classList.add("waking");
  clearTimeout(wakingTimer);
  wakingTimer = setTimeout(() => root.classList.remove("waking"), 700);
  showMovement(state.def.movements[0].id, state.time + (state.def.cardDelay ?? CARD.wakeDelay));
  canvas.focus({ preventScroll: true });
  processEvents();
  sync();
}
/** The player's wake on the title (key, tap, the wake button): Diana first
 * emerges from the earth under the sprout (about 1.2 s, 0.36 s with reduced
 * motion), then the run starts with the original start clip. A second
 * press skips straight to the run. The title UI fades at the press; the
 * camera move and the title ground's fade begin with the run, as before. */
function pressWake() {
  if (!ready || state.status !== "ready") return;
  if (emergence) return wake();
  unlockAudio(); // inside the gesture
  emergence = { at: clock, phase: "", phase0: clock, set: dianaSet() };
  root.classList.add("waking");
  clearTimeout(wakingTimer);
  audio.fadeOutMusic(0.9);
  audio.play("emerge");
  announce("Diana wakes.");
  canvas.focus({ preventScroll: true });
}
function doJump() {
  if (state.status === "ready") return pressWake();
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
function clearMoments() {
  moments.length = 0;
  previewGets = [];
  glint.trail.length = 0;
  scriptedPrev = state.time;
}
function afterReset() {
  hideCards();
  clearWords();
  clearMoments();
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
function startLevel(n, { wake: wakeNow = true, force = true, fromMap = false } = {}) {
  if (!ready) return null;
  const level = Math.max(1, Math.min(LEVELS.length, Math.round(n) || 1));
  if (!force && level > progress.unlocked) return null;
  map?.cancel();
  hideCards();
  clearWords();
  // From the map the last level's held chord fades over 1.4 s, under the
  // new sky's swell, so the next level never starts cold.
  const hold = fromMap ? 1.4 : 0.12;
  audio.scoreReset({ hold });
  audio.hush(0.12, { hold });
  audio.clearMoments();
  audio.fadeOutMusic(0.6);
  loadLevel(level);
  clearMoments();
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
    // Names for the stop just finished and the next one only, so eight or
    // ten stations never collide; the rest keep their numerals.
    if (lv.id === next || lv.id === next - 1) el("text", { x, y: y + 60, "text-anchor": "middle", class: "name" }, svg).textContent = lv.title;
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
  // A one-bar count-in of the next level's pulse, landing its downbeat on
  // the moment the level begins (the line grows for one bar, then 0.35 s).
  if (!reduced) audio.countIn({ bpm: LEVELS[next - 1].bpm * pace, delay: 0.35 });
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
    startLevel(next, { fromMap: true });
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
/** The title's orbit line: one numbered stop per level, built from LEVELS so
 * that 8-10 levels fit as well as four. Open stops select; locked ones stay
 * focusable so their name can be previewed. The selected (or previewed)
 * level's name and Great Star slots are shown once, below the line. */
const LEAVES = '<svg class="leaves" viewBox="-11 -14 22 14" aria-hidden="true"><path d="M0 0 C-7 -2 -9 -9 -6 -13 C-1 -11 1 -5 0 0Z"/><path d="M0 0 C5 -1 9 -6 9 -11 C4 -11 0 -6 0 0Z"/></svg>';
let preview = null; // a level hovered or focused on the title
function syncLevelMap() {
  const list = $("stations");
  if (!list) return;
  for (const li of list.querySelectorAll("li[data-level]")) {
    const n = Number(li.dataset.level),
      b = li.querySelector(".stop"),
      open = n <= progress.unlocked;
    b.setAttribute("aria-disabled", String(!open));
    b.setAttribute("aria-pressed", String(n === state.level));
    b.classList.toggle("done", !!progress.done[n]);
    // The orbit is solid from one finished level to the next.
    li.classList.toggle("travelled", n > 1 && !!progress.done[n - 1]);
    const got = progress.great[n] ?? 0;
    b.setAttribute("aria-label", `${LEVELS[n - 1].numeral}. ${LEVELS[n - 1].title}${open ? `, ${got} of 3 Great Fallen Stars` : ", locked"}`);
  }
  showStationInfo(preview ?? state.level);
}
function showStationInfo(n) {
  const info = $("station-info"),
    d = LEVELS[n - 1];
  if (!info || !d) return;
  const open = n <= progress.unlocked,
    got = progress.great[n] ?? 0;
  info.classList.toggle("locked", !open);
  info.innerHTML = `<span class="numeral"></span><span class="name"></span>${
    open ? `<span class="great-slots" role="img" aria-label="${got} of 3 Great Fallen Stars">${[0, 1, 2].map((i) => `<i class="slot${i < got ? " filled" : ""}"></i>`).join("")}</span>` : `<span class="lock">opens after ${LEVELS[n - 2]?.numeral ?? ""}</span>`
  }`;
  info.querySelector(".numeral").textContent = d.numeral;
  info.querySelector(".name").textContent = d.title;
}
/** Lay the stops out in as few rows as the panel allows (one row for up to
 * ten at 960 px; two balanced rows on a phone in portrait). */
function layoutStations() {
  const list = $("stations");
  if (!list) return;
  const items = [...list.children],
    n = items.length,
    panel = $("title-panel"),
    compact = layout === "landscape" && canvas.clientHeight > 0 && canvas.clientHeight < 460,
    link = parseFloat(getComputedStyle(list).getPropertyValue("--link")) || 14,
    row = (cols) => cols * 44 + (cols - 1) * (link + 4), // stops and the dotted links between
    earth = 34, // Earth's link and dot after the last stop
    pad = layout === "portrait" ? 2 * 10 : 2 * 22,
    full = Math.max(160, panel.parentElement.clientWidth - 24 - pad - 4);
  panel.classList.remove("wide-line");
  const beside = full - $("start").offsetWidth - 16;
  // Short landscape: the line sits beside the wake button while it fits in
  // one row there, otherwise it takes the whole first row of the panel.
  const wide = compact && row(n) + earth > beside;
  panel.classList.toggle("wide-line", wide);
  const room = compact && !wide ? beside : full;
  let cols = n;
  while (cols > 1 && row(cols) + earth > room) cols--;
  cols = Math.ceil(n / Math.ceil(n / cols)); // balance the rows
  list.style.width = `${row(cols) + earth}px`;
  list.dataset.cols = String(cols);
  items.forEach((li, i) => li.classList.toggle("row-start", i % cols === 0));
}
function buildLevelMap() {
  const list = $("stations");
  if (!list) return;
  list.innerHTML = "";
  for (const d of LEVELS) {
    const li = document.createElement("li");
    li.dataset.level = String(d.id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "stop";
    b.innerHTML = `${LEAVES}<span class="numeral"></span>`;
    b.querySelector(".numeral").textContent = d.numeral;
    b.addEventListener("click", () => {
      if (state.status !== "ready" || emergence || d.id > progress.unlocked) return;
      audio.play("ui-select");
      loadLevel(d.id);
      sync();
      draw();
      $("start").focus({ preventScroll: true });
    });
    const peek = () => ((preview = d.id), showStationInfo(d.id));
    const unpeek = () => ((preview = null), showStationInfo(state.level));
    b.addEventListener("pointerenter", peek);
    b.addEventListener("pointerleave", unpeek);
    b.addEventListener("focus", peek);
    b.addEventListener("blur", unpeek);
    li.append(b);
    if (d === LEVELS.at(-1)) {
      // Earth closes the orbit (the only colour, as everywhere).
      const earth = document.createElement("span");
      earth.className = "earth-end";
      earth.setAttribute("aria-hidden", "true");
      earth.innerHTML = "<i></i>";
      li.append(earth);
    }
    list.append(li);
  }
  layoutStations();
  syncLevelMap();
}
/** Great Stars banked across the campaign (best per level, this run's level live). */
function paintedStars() {
  let n = 0;
  for (const d of LEVELS) n += d.id === state.level ? Math.max(progress.great[d.id] ?? 0, state.greatBanked.length) : progress.great[d.id] ?? 0;
  return n;
}
function toTitle() {
  map?.cancel();
  emergence = null;
  wokeFromEarth = false;
  clearTimeout(wakingTimer);
  root.classList.remove("waking");
  const assist = { ...state.assist };
  Object.assign(state, createGame(state.seed, { level: state.level, ...assist }));
  syncLevelMap();
  hideCards();
  clearWords();
  clearMoments();
  lastSerial = state.eventSerial;
  fx.length = 0;
  camera.snap = true;
  ui.great = "";
  ui.orbitDirty = true;
  audio.scoreReset();
  audio.hush(0.2);
  audio.clearMoments();
  // From the pause card the engine is still suspended: un-pause it first (the
  // status is 'ready' now), so the title song below can fade in.
  resetShelfWatch();
  syncAudio();
  // The title song: keep it if the door already started it, else begin it.
  if (!audio.stats().soundtrackPlaying) audio.playMusic({ fromStart: true, fadeIn: 1.2 });
  sync();
  $("start").focus({ preventScroll: true });
}

/* ---------- input ---------- */
const GAME_KEYS = ["Space", "ArrowUp", "ArrowRight", "ArrowDown", "KeyW", "KeyD", "KeyS"];
window.addEventListener("keydown", (e) => {
  const onButton = e.target instanceof HTMLElement && e.target.matches("button");
  if (state.status === "paused") {
    const onSlider = e.target instanceof HTMLInputElement && e.target.type === "range";
    if (e.code === "Tab") {
      // Keep keyboard focus inside the pause card (aria-modal).
      const buttons = [...$("pause-card").querySelectorAll("button, input")].filter((b) => b.offsetParent);
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
    // On a volume slider ←/→ move the slider (natively); ↑/↓ still move focus.
    if (onSlider && ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.code)) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
      const buttons = [...$("pause-card").querySelectorAll("button, input")].filter((b) => b.offsetParent);
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
  if (state.status === "ready" && ["Space", "Enter", "ArrowUp", "KeyW"].includes(e.code)) return pressWake();
  if (state.status === "won") {
    if (e.code === "KeyR") restartChapter();
    return;
  }
  // On the title, ←/→ choose among the open levels of the orbit map.
  if (state.status === "ready" && emergence) return; // she is waking: only a press skips
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
  const wakes = e.type === "keydown" ? ["Space", "Enter", "ArrowUp", "KeyW"].includes(e.code) : !!e.target?.closest?.("#start, #game, .controls");
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
  const menu = "#again, #continue, #sound, #pause, .itch-fullscreen";
  document.addEventListener("pointerover", (e) => {
    const b = canHover && e.target instanceof Element ? e.target.closest(menu) : null;
    if (b && !b.contains(e.relatedTarget)) audio.play("ui-hover");
  });
  document.addEventListener("focusin", (e) => {
    if (e.target instanceof Element && e.target.matches(menu) && e.target.matches(":focus-visible")) audio.play("ui-hover");
  });
  document.addEventListener("click", (e) => {
    const b = e.target instanceof Element ? e.target.closest("#main-menu, .itch-fullscreen") : null;
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
// A device that reports a fine pointer but also has a touchscreen (a
// convertible laptop) gets the touch controls from its first real touch.
window.addEventListener(
  "pointerdown",
  (e) => {
    if (e.pointerType !== "touch" || root.classList.contains("touch")) return;
    root.classList.add("touch");
    if (state.status === "ready" && !coarse) $("title-keys").textContent = "tap left to jump · right thumb: cape, dive";
  },
  true,
);
bindTouch("touch-jump", doJump, () => releaseJump(state));
bindTouch("touch-cape", doCape, () => (held.glide = false));
bindTouch("touch-dive", doDive);
{
  // Swiping down on the right half also dives.
  const zone = $("touch-swipe");
  let startY = null;
  zone.addEventListener("pointerdown", (e) => {
    startY = e.clientY;
    if (state.status === "ready") pressWake();
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
$("start").addEventListener("click", pressWake);
$("pause").addEventListener("click", openPause);
$("resume").addEventListener("click", closePause);
$("back-to-light").addEventListener("click", backToLight);
$("restart-chapter").addEventListener("click", restartChapter);
$("again").addEventListener("click", restartChapter);
$("continue").addEventListener("click", () => (state.level >= LEVELS.length ? toTitle() : showMap(state.level + 1)));
$("map-veil").addEventListener("pointerdown", () => map?.finish());
// Pause → Main menu: the level's score stops, the title song returns and the
// saved progress (open levels, best Great Stars) is kept.
$("main-menu").addEventListener("click", toTitle);
$("reload").addEventListener("click", () => location.reload());
$("sound").addEventListener("click", () => setSound(!sound.on));
$("pause-sound").addEventListener("click", () => setSound(!sound.on));
function showAssist(open) {
  $("pause-main").hidden = open;
  $("pause-assist").hidden = !open;
  (open ? $("pause-assist").querySelector(".toggle") : $("assist-open")).focus({ preventScroll: true });
}
$("assist-open").addEventListener("click", () => showAssist(true));
for (const [id, key] of [["vol-music", "music"], ["vol-sounds", "sounds"]])
  $(id).addEventListener("input", (e) => setVolumes({ [key]: Number(e.target.value) / 100 }));
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
    if (emergence && clock - emergence.at >= emergenceSeconds(reduced)) wake();
    processEvents();
    scriptedCues();
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
  start: wake, // immediate (pilots); a real press plays the emergence first
  // The title's wake as a player sees it: { emerging, phase, t, total, set,
  // fallback, soil }. setSpriteSet("nocape" | "cape" | null) overrides the
  // level's sprite set (the no-cape sheets fall back to the cape set until
  // they are extracted).
  pressWake,
  getTitle: () => {
    const e = emergence ? emergenceAt(clock - emergence.at, { reduced }) : null;
    const set = emergence?.set ?? (manifest ? dianaSet() : null);
    return { emerging: !!emergence, phase: e?.phase ?? null, t: e?.t ?? null, total: emergenceSeconds(reduced), set: set?.name ?? null, fallback: !!set?.fallback, body: set?.body ?? null, soil: soilFraction, stops: $("stations")?.querySelectorAll(".stop").length ?? 0 };
  },
  // (Since the no-cape sheets are extracted, "nocape" draws them in play too.)
  setSpriteSet: (name) => ((spriteSetOverride = name || null), dianaSet()),
  // Per-level looks (backdrop.mjs): setLook("neptune") previews a look on a
  // level that names none; setLook(null) returns to the level's own (or to
  // revision seven's sky when it has none).
  setLook: (id) => ((lookOverride = id || null), currentLook()),
  // The breath bar on a model without `capeCharge`: previewCape(0.6) shows
  // that charge (bar, touch rim and the cape's tint); previewCape(null) ends it.
  previewCape: (charge) => {
    capePreview = charge == null ? null : Math.max(0, Math.min(1, Number(charge)));
    sync();
    if (ready) draw();
    return window.__game.getHud().breath;
  },
  // A GET moment without the eight-level model: now, at Diana, or with
  // { approach: true } placed `lead` px ahead so its helper / landed star
  // is drawn first and the moment fires as she runs through it.
  previewGet: (verb, { approach = false, lead = 520 } = {}) => {
    if (approach) previewGets.push({ id: `preview-${verb}`, verb, x: state.player.x + lead, preview: true });
    else startMoment(verb);
    return { verb, bar: barSeconds(), seconds: momentSeconds(verb, barSeconds()), pending: previewGets.length };
  },
  // A look's own layer (body and accent) alone, on a transparent canvas the
  // size of the view at this moment: the alpha it puts in the 56 px HUD
  // band (must be 0) and inside its body's visible part (must not be).
  lookLayer: (id) => {
    const look = lookOf(null, id);
    if (!look || !manifest) return null;
    backdrop ??= createBackdrop({ makeCanvas, images, sprite: spriteOn, reduced });
    const w = Math.ceil(W),
      c = makeCanvas(w, H),
      g = c.getContext("2d", { willReadFrequently: true }),
      view = backdropView();
    backdrop.drawBody(g, look, view);
    backdrop.drawAccent(g, look, view);
    const alpha = (x, y, bw, bh) => {
      const x0 = Math.max(0, Math.floor(x)),
        y0 = Math.max(0, Math.floor(y)),
        x1 = Math.min(w, Math.ceil(x + bw)),
        y1 = Math.min(H, Math.ceil(y + bh));
      if (x1 <= x0 || y1 <= y0) return 0;
      const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      let a = 0;
      for (let i = 3; i < d.length; i += 4) a += d[i];
      return a;
    };
    const b = bodyBox(look, view),
      top = Math.max(HUD_BAND, b.y - b.r);
    return { look, band: alpha(0, 0, w, HUD_BAND), body: alpha(b.x - b.r * 0.7, top, b.r * 1.4, Math.min(H, b.y + b.r) - top), view: { W: w, H, progress: view.progress } };
  },
  // What the HUD and Diana show: { breath: { shown, charge, full, disc,
  // window, fill }, glint, set, fallback, look, moments, verbs }.
  getHud: () => {
    const bar = $("breath"),
      track = bar.querySelector(".breath-track").getBoundingClientRect(),
      fill = $("breath-window").getBoundingClientRect(),
      set = manifest ? dianaSet() : null;
    return {
      breath: { shown: !bar.hidden, charge: ui.breath, full: bar.classList.contains("full"), disc: getComputedStyle($("breath-disc")).backgroundImage.includes("meteor") ? "meteor" : "disc", window: track.width, fill: fill.width },
      rim: { charge: Number(getComputedStyle($("touch-cape")).getPropertyValue("--charge")) || 0, full: $("touch-cape").classList.contains("full") },
      tint: Math.round(tint * 1000) / 1000,
      clock, // the renderer's real-time clock (frozen while paused)
      glint: { shown: glint.shown, inHand: doubleInHand(state), x: glint.x, y: glint.y },
      set: set?.name ?? null,
      fallback: !!set?.fallback,
      clip: manifest ? clipFor(manifest, state.animation.name, set?.name) : null,
      look: currentLook(),
      body: currentLook() ? bodyBox(currentLook(), backdropView()) : null,
      moments: moments.filter(momentLive).map((m) => m.verb),
      // The scripted moments and decor drawn in the last frame (ids), II's
      // eye, and the look's island marks and particles.
      scripted: [...shownScripted],
      eye: (() => {
        const m = moments.find((q) => q.eye && momentLive(q));
        return m ? eyeAt(momentAge(m), beatSeconds()) : null;
      })(),
      stones: stones().length,
      marks: ISLAND_LOOKS[currentLook()]?.marks ?? null,
      // I's brightest star has fallen (it is the asteroid): home's body is gone.
      fallen: currentLook() === "home" && brightStarFate().fallen,
      particles: particlesDrawn,
      pending: pendingGets().map((g) => g.verb),
      verbs: root.dataset.verbs ?? null,
      owns: { double: owns(state, "double"), cape: owns(state, "cape"), dive: owns(state, "dive") },
    };
  },
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
  // Each also lists its key, look, GETs, scripted moments (`at` in
  // simulation seconds from the wake) and decor, so root QA follows the
  // campaign as stages are built.
  levels: () =>
    LEVELS.map((d) => ({
      id: d.id,
      key: d.key,
      title: d.title,
      bpm: d.bpm,
      clock: d.clock,
      look: d.look ?? null,
      interim: !!d.interim,
      verbs: { ...d.verbs },
      gets: (d.gets ?? []).map(({ id, verb, x }) => ({ id, verb, x })),
      moments: scriptedMoments(d).map(({ id, kind, k, at, target }) => ({ id, kind, k, at, target: target ?? null })),
      decor: (d.decor ?? []).map(({ id, kind }) => ({ id, kind })),
      unlocked: d.id <= progress.unlocked,
      great: progress.great[d.id] ?? 0,
    })),
  // Frame cost of the renderer alone: draw() n times now (ms per frame).
  drawTime: (n = 60) => {
    const times = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      draw();
      times.push(performance.now() - t0);
    }
    times.sort((x, y) => x - y);
    return { mean: times.reduce((a, b) => a + b, 0) / n, p95: times[Math.floor(n * 0.95)], max: times.at(-1) };
  },
  // Harmony feedback: { gentle: true } removes every dissonance (no detune,
  // a fade instead of the tape-stop). Persisted like the sound setting.
  setMusic: ({ gentle } = {}) => (gentle != null && setGentleMusic(gentle), { gentle: sound.gentle }),
  // Music / Sounds volumes (0-1, saved): setVolumes({ music: 0.5 }).
  setVolumes: (v = {}) => setVolumes(v),
  getState: () => snapshot(state),
  // { on, unlocked, decoded, state, paused, suspended, musicPlaying, voices,
  //   nodes, played, dropped, cues, score: { running, bar, chord, H,
  //   detuneCents, gentle, song, ... }, ... } (see audio.mjs stats()).
  getAudio: () => ({ ...audio.stats(), on: sound.on, volumes: audio.volumes() }),
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
    // The HUD's own art (the breath bar) is drawn by style.css: only warmed
    // here, so the bar never appears before its images.
    for (const v of Object.values(manifest)) if (v?.hud && v.file) new Image().src = v.file;
    await Promise.all(
      Object.entries(manifest)
        // The meteor stone is also the world's asteroid (I's crash, II's eye).
        .filter(([name, v]) => v.file?.endsWith(".png") && (!v.hud || name === "meteor"))
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
    setVolumes(sound.volumes);
    // The title song: where the browser allows it (itch's click-to-play
    // iframe does) it starts now, on the plain element (no AudioContext
    // before a gesture); otherwise the first gesture that does not wake starts it.
    if (sound.on) audio.playMusic({ fromStart: true });
    resize();
    sync();
    draw();
    // Warm the sound up while the title rests: a suspended context and the
    // whole graph, one step per task. The wake press then only resumes it
    // (creating a context there stalled the first frames by 80-350 ms).
    if (sound.on) setTimeout(() => audio.prepare(), 400);
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
