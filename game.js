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
  refillLit,
  relicY as modelRelicY,
  RULES,
} from "./model.mjs";
import { LEVELS, CARD, checkpointIndex } from "./level.mjs";
import { transitionPlan, frameAt, countUp, readSave, writeSave, recordWin, journeyOf, tallyOf, endingLine, CREDITS } from "./transition.mjs";
import { signsAt, refWidthOf, layoutScale, dianaBox, rectsTouch } from "./signage.mjs";
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
import { createBackdrop, lookOf, skyDensity, cadentGap, bodyBox, bodyTop, earthBox, ringsCrop, HUD_BAND, LOOKS } from "./backdrop.mjs";
import { ANCHORS, momentSeconds, riseAt, settleAt, helperApproach, helperAfter, rippleAt, necklaceAt, SIXTEENTH_SIM, MOMENT_KINDS, scriptedMoments, fallAt, flashAt, asteroidAt, plumeAt, farPlace, eyeAt, eyeSeconds, eyeTimes, rideAt, slopeAt } from "./moments.mjs";
import { ISLAND_LOOKS, islandShape, markable, paintMarks, paintParticles } from "./islands.mjs";
import { platformStyleFrom, isPlatformStyle, createRockCache, rockShape, traceRock, paintRock, paintDrift } from "./platform-style.mjs";

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
    // transition.mjs readSave: version 3 (best stars, lifetime falls,
    // credits seen); a version-2 save migrates without loss, a version-1
    // save keeps its numeral, not its stars.
    return readSave(JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "null"));
  } catch {
    /* storage blocked or corrupt: start fresh (session-only totals) */
  }
  return readSave(null);
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
  audio.setPaused(state.status === "paused" || !!trans?.paused);
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
  // Glyph discs keep about 20 css px of radius on small skies (a layout
  // constant: it changes on resize only, never per frame).
  signLayout = layoutScale(fit.cssHeight / H);
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
  if (state.status === "ready" || trans?.last) return;
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
    let sx = (d.x * W * 1.4 - skyX() * 0.015) % (W * 1.4);
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
        sy = ((s.y + oy - 30) % 520) + 30 - skyY() * 0.05,
        // The tallest frame of its twinkle group (long sparkles reach far
        // above their centre), plus the wobble: does it touch the band?
        reach = Math.max(...[0, 1, 2, 3].map((k) => frameRect("background", s.group + k)?.h ?? 0)) * s.size * 0.8 + 3,
        band = sy - reach < HUD_BAND;
      if (!band && pass === 0 && density.stars < 1 && i % Math.round(1 / density.stars) !== 0) continue;
      if (band && pass === 1) continue;
      let sx = ((s.x + ox) * (W + 200) - skyX() * s.depth) % (W + 200);
      if (sx < 0) sx += W + 200;
      const f = s.group + (reduced ? 2 : Math.floor(clock * 3 + s.phase) % 4);
      const wob = !band && density.wobble && !reduced ? Math.sin(Math.PI * 2 * density.wobble * clock + s.phase * 1.7) * 2.2 : 0;
      sprite("background", f, sx - 100, sy + wob, s.size * 1.6, 0.8);
    }
  // The level's body ahead and its sky accent (backdrop.mjs), behind the
  // world. Like the world, they are not drawn on the title (nothing may sit
  // near its options) and fade in with the run.
  const lookAlpha = state.status === "ready" ? 0 : Math.min(1, Math.max(clock - wakeAt, state.time / (state.clock ?? 1)) / 0.8);
  // The transition draws both bodies on their arcs, the orbit line and the
  // ending's Earth itself (§3.4-3.5).
  if (trans?.f) drawTransitionSky(trans.f);
  else if (look && lookAlpha > 0) {
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
  // The scripted far sky: the brightest star's flash, the asteroid, the plume
  // (it fades with the finished level's world).
  if (!trans) drawScriptedFar();
  else if (!trans.swapped && trans.f.world > 0.01) {
    ctx.save();
    ctx.globalAlpha = trans.f.world;
    drawScriptedFar();
    ctx.restore();
  }
  // Original shooting-star clips (cadent1/2), never under reduced motion;
  // home's sky (level I) is a shower: they come about twice as often.
  if (!reduced && state.status !== "ready") {
    // (No new shooting star starts during a transition; a running one finishes.)
    if (!cadent && clock > nextCadent && !trans) {
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
  if (platformStyle === "meteor") return meteorPath(q, x, jitter);
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
/* Platform style (platform-style.mjs, an experiment): "meteor" draws each
 * island as a floating rock on the same top, "classic" as above. Drawing
 * only, so ?platforms=classic or __game.setPlatformStyle("classic") reverts
 * it at once; DEFAULT_PLATFORM_STYLE flips the default. */
let platformStyle = platformStyleFrom(location.search);
const rocks = createRockCache();
const rockOf = (q) => rocks.get(q, { levelKey: state.def.key, look: islandLook, world: state });
function meteorPath(q, x, jitter) {
  const rock = rockOf(q);
  traceRock(ctx, rock, x - q.x, jitter);
  return rockShape(rock, x - q.x, jitter);
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
  if (platformStyle === "meteor") paintRock(ctx, shape.rock, { dx: jitter * 0.6, dy: Math.abs(jitter) * 0.5 });
  else {
    ctx.strokeStyle = MUTE;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x + 22, q.y + 10);
    ctx.quadraticCurveTo(x + w * 0.34, q.y + 15, x + w * 0.78, q.y + 9);
    ctx.stroke();
  }
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
  // Rocks carry their craters instead of the classic ticks.
  if (platformStyle === "meteor") return;
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
  if (platformStyle === "meteor") drawRockDrift();
  if (!islandLook || !ISLAND_LOOKS[islandLook]?.particles) return;
  ctx.save();
  clipBelowBand();
  for (const q of state.platforms) {
    if (q.collapsed || !markable(q) || q.x > camera.x + W + 160 || q.x + q.width < camera.x - 160) continue;
    const thick = q.route === "high" && q.y < 600 ? 30 : 64;
    particlesDrawn += paintParticles(ctx, islandLook, platformStyle === "meteor" ? rockShape(rockOf(q)) : islandShape(q, q.x, q.width, thick), { t: clock, reduced });
  }
  ctx.restore();
}
/** Meteor style: each rock's pebbles and turning chunk (and Saturn's far
 * ring half), behind every island and under the HUD band. */
function drawRockDrift() {
  ctx.save();
  clipBelowBand();
  for (const q of state.platforms)
    if (!q.collapsed && q.x < camera.x + W + 160 && q.x + q.width > camera.x - 160) paintDrift(ctx, rockOf(q), { t: clock, reduced });
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
/** After a transition the level begins with the original portal standing
 * behind Diana (§2.7): centred 60 px behind the start, lit from B2 and
 * ebbing over the run's first beat, then scenery that scrolls away. A level
 * started from the title wakes from the earth instead (no door behind a girl
 * rising from the soil). Restart level, startLevel and the title clear it. */
function drawEntryDoor() {
  if (!arrival || !images.portal) return;
  const x = WORLD().startX - 60,
    y = WORLD().startY;
  if (x < camera.x - 160 || x > camera.x + W + 200) return;
  const placement = portalPlacement(x, y, manifest.portal.visibleBounds);
  const b = placement.source;
  ctx.drawImage(images.portal, b.x, b.y, b.w, b.h, placement.x, placement.y, placement.width, placement.height);
  const lit = trans ? trans.f?.arrivalLight ?? 0 : arrival.at == null ? 0 : 0.85 * Math.max(0, 1 - (clock - arrival.at) / arrival.beat);
  if (lit > 0.001) {
    ctx.save();
    ctx.globalAlpha *= lit / 0.85;
    drawDoorLight(doorOpening(x, y), 1, "paper");
    ctx.restore();
  }
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
/* World signs (signage.mjs; RESEARCH_TRANSITIONS §1). Each row is a still
 * sign of the world: its discs sit at the level data's x/y (parallax 1),
 * drawn behind the islands, and its only change over time is its opacity in
 * the camera's signage window. Nothing here reads Diana, a prompt's done /
 * after, the status or the falls (owner: "background elements, purely
 * informational"; tests/signage.test.mjs T1). */
let signLayout = 1, // the layout constant (signage.mjs layoutScale), set on resize only
  signsDrawn = []; // the rows drawn in the last frame (QA, Diana's keyline)
function drawSigns() {
  signsDrawn = [];
  for (const row of signsAt(state.prompts, camera.x, W, refWidthOf(state.def), signLayout, coarse)) {
    if (row.alpha <= 0) continue;
    signsDrawn.push(row);
    for (const t of row.thens) diamond(t.x, t.y, 3, PAPER, row.alpha);
    for (const d of row.discs) glyph(d.x, d.y, d.kind, row.alpha, row.scale);
  }
}
/* Diana in front of a sign (§1.4): her cream silhouette would merge with a
 * paper disc, so on frames where her drawn box meets a visible row she gets a
 * 2 px ink keyline, clipped to the intersecting discs' outer circles (r + 4).
 * Outside discs nothing changes. The frame is tinted to ink once per frame on
 * a small offscreen canvas (source-in) and stamped in 8 directions. */
const keyCanvas = makeCanvas(480, 400),
  keyCtx = keyCanvas.getContext("2d");
function keylineDiscs(x, feet) {
  const box = dianaBox(x, feet),
    out = [];
  for (const row of signsDrawn) {
    if (!rectsTouch(row.rect, box, 8)) continue;
    for (const d of row.discs) out.push({ x: d.x, y: d.y, r: 19 * row.scale + 4 });
  }
  return out;
}
function drawKeyline(name, age, x, feet, discs, alpha = 1) {
  keyCtx.setTransform(2, 0, 0, 2, 0, 0);
  keyCtx.globalCompositeOperation = "source-over";
  keyCtx.clearRect(0, 0, 240, 200);
  drawDianaLayers(keyCtx, name, age, 120, 170);
  keyCtx.globalCompositeOperation = "source-in";
  keyCtx.fillStyle = INK;
  keyCtx.fillRect(0, 0, 240, 200);
  keyCtx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  for (const d of discs) {
    ctx.moveTo(d.x + d.r, d.y);
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
  }
  ctx.clip();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.drawImage(keyCanvas, 0, 0, 480, 400, x - 120 + Math.cos(a) * 2, feet - 170 + Math.sin(a) * 2, 240, 200);
  }
  ctx.restore();
  keylineFrames++;
}
let keylineFrames = 0;
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
  // Inside a sign's disc she gets the 2 px ink keyline (§1.4).
  const feet = p.y + footFor(manifest, anim.name, anim.age),
    keys = keylineDiscs(p.x, feet);
  if (keys.length) drawKeyline(anim.name, anim.age, p.x, feet, keys);
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
    if (g.verb === "glide" && !g.relic) {
      const a = helperApproach(g.verb, d, clock);
      // A scripted helper moment aimed at this GET (III's helper-drift)
      // decides when the helper appears: it fades in from that moment.
      const cue = S.list.find((m) => m.kind === "helper" && m.target === g.id);
      const gate = cue ? Math.max(0, Math.min(1, sinceSim(cue.at) / 0.4)) : 1;
      if (cue && gate > 0) shownScripted.add(cue.id);
      if (a) drawHelper(g.x + a.x, y + a.y, a.alpha * gate, g.verb === "super" && d < 160 ? -1.2 : Math.atan2(0.2, -0.35));
    }
    // (The other relics, I's leaf relic among them, are drawn by drawRelics.)
  }
  // QA previews fire once Diana runs through them.
  for (const g of previewGets)
    if (p.x >= g.x) {
      startMoment(g.verb, { get: g });
      if (g.relic) relicPickup(g.verb, { x: g.x, y: relicY(g) });
    }
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
  if (alive) {
    drawRelicHolds(p);
    drawRefillFx(p);
  }
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

/* ---------- relics, refill stars and the unlock banner (RESEARCH_REFILLS) ----------
 * Every ability now comes from a relic on the run line, seen 2.5 s ahead
 * in a soft beam of light; taking it bursts it, holds it over Diana for one
 * beat with a ring burst (animation only: the simulation and the score never
 * stop), and a short banner names the ability and its control. Refill stars
 * are small copies of the relic that gave their verb: the cape star is the
 * asteroid stone, the leaf star rests between Diana's two leaves. All of it
 * is drawn from existing sprites and the palette tokens, and read
 * defensively: main's model has `def.gets` and the `get` event; the eight-
 * level model adds `relics`/`refills` (or `refillStars`) and the `relic` and
 * `refill-star` events. QA previews draw the art without either. */
const RELIC_ART = Object.freeze({
  double: { name: "Double jump", key: ["up", "W"], line: "again in the air", touch: "tap again in the air", say: "Double jump. Press up again in the air." },
  cape: { name: "Cape flight", key: ["right", "D"], line: "in the air", touch: "the cape button, in the air", say: "Cape flight. Press right in the air." },
  glide: { name: "Float", key: ["hold-right", "D"], line: "hold", touch: "hold the cape button", say: "Float. Hold right." },
  dive: { name: "Dive", key: ["down", "S"], line: "", touch: "the dive button", say: "Dive. Press down." },
  super: { name: "Super jump", key: ["up", "W"], line: "during a flight", touch: "tap during a flight", say: "Super jump. Press up during a flight." },
});
let previewRefills = [];
const relicHolds = []; // { verb, at (clock), beat, from: {x, y} }: the one-beat hold over Diana
const refillFx = []; // { kind, at, x, y }: a leaf star flying to her head, a cape star's ring
const refillWake = new Map(), // id -> clock when it lit (the 0.25 s wake ring)
  refillState = new Map(); // id -> lit last frame (a star seen lit at first does not pulse)
/** The relics still ahead: the state's list, else the level's GETs, plus QA previews. */
function relicsAhead() {
  const taken = state.gotten ?? [];
  const list = Array.isArray(state.relics) ? state.relics.filter((r) => !r.taken) : (state.def.gets ?? []).filter((g) => !taken.includes(g.id));
  return [...list, ...previewGets.filter((g) => g.relic)];
}
// (The model's own placement: its y, or 40 px over the run line's stone.)
const relicY = (g) => (g.preview ? g.y : modelRelicY(state.def, g));
/** The refill stars in this world: { id, kind, x, y, lit, taken }. */
function refillsOf() {
  const s = state;
  let list = [];
  if (Array.isArray(s.refills)) list = s.refills;
  else if (Array.isArray(s.refillStars)) list = s.refillStars.map((q) => ({ ...q, lit: refillLitHere(q) }));
  return [...list, ...previewRefills];
}
/** The lit rule (RESEARCH_REFILLS 1.1) is the model's own (refillLit): a
 * cape star is lit while the cape is owned and the bar is not full, a leaf
 * star while the double is owned, Diana airborne with no air jump left. */
function refillLitHere(q) {
  if (q.preview) return q.lit;
  return refillLit(state, q);
}
/** The soft paper beam (40 px at 25%) from the relic to the view's top, and
 * three tiny stars circling it once per bar. Static under reduced motion. */
function drawBeam(x, y, alpha = 1) {
  const top = camera.y + HUD_BAND,
    g = ctx.createLinearGradient(0, top, 0, y);
  g.addColorStop(0, "rgba(251,251,234,0)");
  g.addColorStop(0.35, `rgba(251,251,234,${0.25 * alpha})`);
  g.addColorStop(1, `rgba(251,251,234,${0.25 * alpha})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(x - 20, top, 40, Math.max(0, y - top));
  const bar = barSeconds();
  for (let k = 0; k < 3; k++) {
    const a = (reduced ? 0 : (clock / bar) * Math.PI * 2) + (k * Math.PI * 2) / 3;
    sprite("star", 2, x + Math.cos(a) * 30, y + Math.sin(a) * 12, 0.08, 0.9 * alpha);
  }
  ctx.restore();
}
/** One relic's art at (x, y): the verb's own object (RESEARCH_REFILLS 2.1). */
function drawRelicArt(verb, x, y, alpha = 1, k = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (verb === "double") {
    // The leaf relic: a resting star (0.36) cradled by Diana's two leaves,
    // 60 px tall (sprout frame 0's leaves are 143 of its 200 px).
    sprite("sprout", 0, x, y + 10 * k, (60 / 143) * k);
    sprite("star", 2, x, y - 8 * k + (reduced ? 0 : Math.sin(clock * 2.2) * 2), 0.36 * k);
  } else if (verb === "cape") {
    // The gift: the asteroid stone at 64 px with the cape fluttering over it.
    if (images.meteor) {
      const s = (64 * k) / images.meteor.width;
      ctx.drawImage(images.meteor, x - (images.meteor.width * s) / 2, y - (images.meteor.height * s) / 2, images.meteor.width * s, images.meteor.height * s);
    }
    // (dash.png's cape sits in the right of its 500 px frame, 134 px off centre.)
    sprite("dash", reduced ? 0 : Math.floor(clock * 6) % 2, x - 134 * 0.3 * k, y + 2 * k, 0.3 * k);
  } else if (verb === "glide") {
    // The helper, perched and circling in place.
    const a = reduced ? 0 : clock * 2.4;
    drawHelper(x + Math.cos(a) * 8 * k, y + Math.sin(a) * 4 * k, 1, a + Math.PI / 2);
  } else if (verb === "dive") {
    // The necklace: a paper ring with a small star inside, on a V of thread.
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 16 * k, y - 22 * k);
    ctx.lineTo(x, y - 9 * k);
    ctx.lineTo(x + 16 * k, y - 22 * k);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 9 * k, 0, Math.PI * 2);
    ctx.stroke();
    sprite("star", 2, x, y, 0.1 * k);
  } else if (verb === "super") {
    // The rising star: the only upward tail in the game.
    streak(x, y + 4 * k, -Math.PI / 2, 0.16 * k, 0.8);
    sprite("star", 2, x, y, 0.36 * k, 1, reduced ? 0 : Math.sin(clock * 1.5) * 0.15);
  }
  ctx.restore();
}
/** Before the pickup: each relic in its beam, ahead on the run line. */
function drawRelics() {
  const landing = scriptedOf().targets;
  for (const g of relicsAhead()) {
    if (g.x < camera.x - 80 || g.x > camera.x + W * 1.6) continue;
    // (I's leaf relic is the first star that falls softly: it shows once landed.)
    if (landing.get(g.id) != null && state.time < landing.get(g.id)) continue;
    const y = relicY(g);
    drawBeam(g.x, y);
    // III's helper keeps its own approach (it drifts down the slope of air
    // and waits at the lip); every other relic waits on the run line.
    if (g.verb !== "glide" || g.relic) drawRelicArt(g.verb, g.x, y);
  }
}
/** The pickup: the star burst, the beam collapsing into Diana (150 ms), a
 * ring burst and the relic held over her head for one beat. */
function relicPickup(verb, at = { x: state.player.x, y: state.player.y - 40 }, { loud = true } = {}) {
  relicHolds.splice(0, relicHolds.length, { verb, at: clock, beat: beatSeconds(), from: { ...at } });
  if (loud) {
    fx.push({ kind: "burst", x: at.x, y: at.y, vx: 0, vy: 0, life: 1, span: 0.45, scale: 0.36 });
    showBanner(verb);
  }
}
function drawRelicHolds(p) {
  for (let i = relicHolds.length - 1; i >= 0; i--) {
    const h = relicHolds[i],
      t = clock - h.at,
      total = h.beat + 0.25;
    if (t > total || t < 0) {
      relicHolds.splice(i, 1);
      continue;
    }
    const head = { x: p.x, y: p.y - 112 };
    // The beam collapses into her within 150 ms.
    const c = Math.min(1, t / 0.15);
    if (c < 1 && !reduced) {
      ctx.save();
      ctx.fillStyle = `rgba(251,251,234,${0.25 * (1 - c)})`;
      ctx.fillRect(h.from.x - 20 * (1 - c), camera.y + HUD_BAND, 40 * (1 - c), Math.max(0, p.y - camera.y - HUD_BAND));
      ctx.restore();
    }
    // Two paper rings out of the relic (the beacon's ring language).
    if (!reduced)
      for (const [delay, max] of [[0, 120], [0.12, 80]]) {
        const u = (t - delay) / 0.6;
        if (u < 0 || u > 1) continue;
        ctx.save();
        ctx.strokeStyle = PAPER;
        ctx.globalAlpha = 0.6 * (1 - u);
        ctx.lineWidth = 2 - u;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 18 + (max - 18) * (1 - (1 - u) ** 3), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    const rise = reduced ? 1 : Math.min(1, t / 0.15),
      x = h.from.x + (head.x - h.from.x) * rise,
      y = h.from.y + (head.y - h.from.y) * rise,
      fade = t > h.beat ? 1 - (t - h.beat) / 0.25 : 1;
    drawRelicArt(h.verb, x, y, Math.max(0, fade), 1 + 0.25 * (reduced ? 1 : Math.min(1, t / 0.15)));
  }
}
/** The cape star (the asteroid stone, a tenth of a turn per bar) and the
 * leaf star (between two leaves): lit at full, dormant at 40% without glow;
 * the instant one lights, one paper ring pulses (0.25 s). */
function drawRefills() {
  const bar = barSeconds();
  for (const q of refillsOf()) {
    if (q.taken || q.x < camera.x - 60 || q.x > camera.x + W + 60) continue;
    const lit = !!q.lit,
      was = refillState.get(q.id);
    refillState.set(q.id, lit);
    if (lit && was === false) refillWake.set(q.id, clock);
    const a = lit ? 1 : 0.4,
      bob = reduced ? 0 : Math.sin(clock * 2 + q.x) * 3;
    ctx.save();
    ctx.globalAlpha = a;
    if (q.kind === "cape") {
      if (lit) {
        const g = ctx.createRadialGradient(q.x, q.y + bob, 4, q.x, q.y + bob, 30);
        g.addColorStop(0, "rgba(251,251,234,0.22)");
        g.addColorStop(1, "rgba(251,251,234,0)");
        ctx.fillStyle = g;
        ctx.fillRect(q.x - 30, q.y + bob - 30, 60, 60);
      }
      if (images.meteor) {
        const s = 34 / images.meteor.width,
          turn = reduced ? 0 : ((clock / bar) * Math.PI * 2) / 10;
        ctx.save();
        ctx.translate(q.x, q.y + bob);
        ctx.rotate(turn);
        ctx.drawImage(images.meteor, -17, -17, images.meteor.width * s, images.meteor.height * s);
        ctx.restore();
      }
      sprite("star", 2, q.x, q.y + bob, 0.12);
    } else {
      if (lit) {
        const g = ctx.createRadialGradient(q.x, q.y + bob, 4, q.x, q.y + bob, 28);
        g.addColorStop(0, "rgba(251,251,234,0.2)");
        g.addColorStop(1, "rgba(251,251,234,0)");
        ctx.fillStyle = g;
        ctx.fillRect(q.x - 28, q.y + bob - 28, 56, 56);
      }
      // (34 px of leaves: sprout frame 0's leaves are 143 of its 200 px.)
      sprite("sprout", 0, q.x, q.y + bob + 6, 34 / 143);
      sprite("star", 2, q.x, q.y + bob - 4, 0.14);
    }
    ctx.restore();
    const w = refillWake.get(q.id);
    if (lit && w != null && clock - w < 0.25 && !reduced) {
      const u = (clock - w) / 0.25;
      ctx.save();
      ctx.strokeStyle = PAPER;
      ctx.globalAlpha = 0.7 * (1 - u);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(q.x, q.y + bob, 16 + 22 * u, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  // Previews fire once Diana runs through them (renderer only).
  const p = state.player;
  for (const q of previewRefills) if (!q.taken && p.x >= q.x - 44) ((q.taken = true), q.lit && refillPickup({ kind: q.kind, x: q.x, y: q.y }));
}
/** A refill star taken: the cape star becomes the stone with its ring; the
 * leaf star lifts off its leaves and flies to her head in 120 ms, where it
 * becomes the glint, and the leaves fade over 0.3 s. */
function refillPickup(e) {
  refillFx.push({ kind: e.kind, at: clock, x: e.x, y: e.y });
  if (e.kind === "cape") pulseClass($("breath"), "pulse", 800);
}
function drawRefillFx(p) {
  for (let i = refillFx.length - 1; i >= 0; i--) {
    const r = refillFx[i],
      t = clock - r.at;
    if (t > 0.45) {
      refillFx.splice(i, 1);
      continue;
    }
    if (r.kind === "leaf") {
      if (t < 0.3) sprite("sprout", 0, r.x, r.y + 6, 34 / 143, 1 - t / 0.3);
      const u = Math.min(1, t / 0.12),
        hx = p.x + ANCHORS.glint.dx,
        hy = p.y + ANCHORS.glint.dy;
      if (u < 1) sprite("star", 2, r.x + (hx - r.x) * u, r.y - 4 + (hy - r.y + 4) * u, 0.14 + (0.085 - 0.14) * u);
      else if (t < 0.2) fx.push({ kind: "burst", x: hx, y: hy, vx: 0, vy: 0, life: 1, span: 0.25, scale: 0.12 });
    } else {
      const u = t / 0.45;
      ctx.save();
      ctx.strokeStyle = PAPER;
      ctx.globalAlpha = 0.6 * (1 - u);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 18 + 40 * u, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (t < 0.25) sprite("star", 4 + Math.min(3, Math.floor((t / 0.25) * 4)), r.x, r.y, 0.24);
    }
  }
}
/* The banner (RESEARCH_REFILLS 2.1): an ink plate at the top centre, under
 * the HUD band, at most 64 px tall: the ability's name (28 px) and its
 * control drawn with the signs' own discs (18 px). 0.15 s in, 2 s, 0.3 s
 * out (2.45 s real), non-blocking; the first time a save takes the relic,
 * else its name only for 1.2 s. A beacon's story line waits until it is gone. */
const BANNER = Object.freeze({ fadeIn: 0.15, hold: 2, fadeOut: 0.3, replay: 1.2 });
let banner = null; // { verb, at, seconds, full }
function discSvg(kind) {
  const dir = kind.replace("hold-", ""),
    rot = { up: 0, right: 90, down: 180, left: -90 }[dir] ?? 0,
    hold = kind.startsWith("hold-") ? '<g class="hold"><circle cx="-6" cy="25" r="1.8"/><circle cx="0" cy="25" r="1.8"/><circle cx="6" cy="25" r="1.8"/></g>' : "";
  return `<svg class="disc" viewBox="-14 -14 28 ${hold ? 42 : 28}" aria-hidden="true"><circle r="11"/><path transform="rotate(${rot})" d="M0 6 L0 -5 M-4.6 -1 L0 -6 L4.6 -1"/>${hold}</svg>`;
}
function showBanner(verb) {
  const art = RELIC_ART[verb];
  if (!art) return;
  const full = !(progress.relics ?? []).includes(verb);
  if (full) {
    progress.relics = [...(progress.relics ?? []), verb];
    writeProgress();
  }
  const touch = coarse || root.classList.contains("touch");
  $("banner-name").textContent = art.name;
  const control = $("banner-control");
  control.hidden = !full;
  control.innerHTML = touch ? "" : `${discSvg(art.key[0])}<span class="or">${art.key[1]}</span>`;
  control.append(document.createTextNode(touch ? art.touch : art.line ? ` ${art.line}` : ""));
  banner = { verb, at: clock, full, seconds: full ? BANNER.fadeIn + BANNER.hold + BANNER.fadeOut : BANNER.replay };
  $("banner").hidden = false;
  announce(full ? art.say : `${art.name}.`);
}
function syncBanner() {
  const el = $("banner");
  if (!banner) return;
  const t = clock - banner.at;
  if (t >= banner.seconds || t < 0) {
    banner = null;
    el.hidden = true;
    el.style.opacity = "0";
    if (ui.storyWaiting) (showStory(ui.storyWaiting), (ui.storyWaiting = null));
    return;
  }
  const out = banner.full ? BANNER.fadeOut : 0.25;
  const a = reduced ? 1 : Math.min(1, t / BANNER.fadeIn, (banner.seconds - t) / out);
  el.style.opacity = a.toFixed(3);
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
  return { x: p.px + (p.x - p.px) * a, y: p.py + (p.y - p.py) * a + stepEase.offset };
}
/* A step-up or lip catch lifts the collider up to 30 px in one tick (half
 * her height): drawn as is, she pops. The drawn feet ease up over 70 ms
 * instead (easeOutQuad) while the collider stays exact: render only, like
 * the feet-anchored drawing, and gone before the next input can matter. */
const STEP_EASE = 0.07;
const stepEase = { dy: 0, at: -9, offset: 0, lastY: null, lastX: null };
function stepEaseFrame() {
  const p = state.player;
  const t = clock - stepEase.at;
  stepEase.offset = 0;
  if (state.status !== "running" || reduced) {
    stepEase.lastY = null;
    return;
  }
  const y = p.y,
    rise = stepEase.lastY == null ? 0 : stepEase.lastY - y;
  // Grounded now, 4-34 px higher than last frame and not a teleport.
  if (p.grounded && rise > 4 && rise <= 34 && Math.abs(p.x - stepEase.lastX) < 60) {
    stepEase.dy = rise + (t < STEP_EASE ? stepEase.dy * (1 - t / STEP_EASE) ** 2 : 0);
    stepEase.at = clock;
  }
  const u = (clock - stepEase.at) / STEP_EASE;
  if (u < 1) stepEase.offset = stepEase.dy * (1 - u) ** 2;
  stepEase.lastY = y;
  stepEase.lastX = p.x;
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
  let worldAlpha = state.status === "ready" ? 0 : Math.min(1, sinceWake / 0.5);
  // The transition's camera (§3.3): a pull-back about the door, then the
  // next level's push-in about Diana. The view rectangle in world px is
  // handed to every culling test by standing in for camera and W.
  const f = trans?.f ?? null;
  let zoom = 1,
    vx = camera.x - sx,
    vy = camera.y - sy,
    dianaAlpha = 1;
  if (f) {
    const v = transitionView(f);
    worldAlpha *= v.alpha;
    zoom = v.zoom;
    vx = v.x;
    vy = v.y;
    dianaAlpha = v.diana;
  }
  const kept = { x: camera.x, y: camera.y, W };
  camera.x = vx;
  camera.y = vy;
  W /= zoom;
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-vx, -vy);
  if (worldAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = worldAlpha;
    drawUpdrafts();
    // The look's ambient particles and II's asteroid sit behind the islands
    // (the crater floor half buries the stone); the scripted back layer
    // (falling stars, locks, glints) behind stars, glyphs and Diana.
    islandLook = currentLook();
    drawIslandParticles();
    drawAsteroids();
    // Signs are information about the playfield: everything playable is in
    // front of them, and a wind column stays under them (§1.3).
    drawSigns();
    for (const q of state.platforms) drawPlatform(q);
    drawBeacons();
    drawPortal();
    drawScriptedBack();
    drawConstellations();
    drawStars();
    drawRefills();
    drawRelics();
    // The finished level's door blooms (§3.2), Earth's blue at the last one.
    if (f && !trans.swapped) {
      drawDoorLight(trans.opening, f.light, trans.door.earth ? "earth" : "paper");
      drawRings(trans.opening, f.rings);
    }
    ctx.restore();
  }
  if (!f || (worldAlpha > 0.01 && dianaAlpha > 0.01)) {
    ctx.save();
    ctx.globalAlpha = dianaAlpha;
    drawPlayer();
    ctx.restore();
    drawMoments();
    drawFx(dt, (q) => q.kind !== "crumb");
  }
  if (f && !trans.swapped) drawMotes(f, trans.opening);
  ctx.restore();
  camera.x = kept.x;
  camera.y = kept.y;
  W = kept.W;
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
  root.dataset.state = trans ? "transition" : state.status === "ready" ? "title" : state.status;
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
  // (simNow: an arriving level's card starts two beats before its bar 1.)
  const age = (q) => (q && live ? simNow() - q.at : -1);
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
  syncBanner();
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
        {
          const g = (state.def.gets ?? []).find((q) => q.id === e.id) ?? null;
          startMoment(e.verb, { sim: e.time, loud, get: g });
          // The relic bursts and is held over her for a beat; the banner names it.
          relicPickup(e.verb, g ? { x: g.x, y: relicY(g) } : undefined, { loud });
        }
        ui.verbs = undefined;
        break;
      case "refill-star":
        if (loud) refillPickup(e);
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
          // A beacon's story line waits while an unlock banner is up.
          if (banner) ui.storyWaiting = mark.story;
          else showStory(mark.story);
          announce("A light to return to.");
        }
        break;
      }
      case "movement":
        if (loud) showMovement(e.id);
        break;
      case "death":
        held.glide = false;
        // Every fall of the save, written at once: restarts and Main menu
        // never lose one (a star-net catch is a fall; Back to last light is not).
        progress.falls = (progress.falls ?? 0) + 1;
        writeProgress();
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
        beginTransition();
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
  // Mid-transition the beat freezes with the clock (§2.5).
  if (trans) return pauseTransition();
  if (state.status !== "running") return;
  togglePause(state);
  held.glide = false;
  syncAudio(); // freeze music, tails and the wind bed right now, not next frame
  showPauseCard();
}
function showPauseCard() {
  // In a transition: Continue resumes it, "Play I · Waking again" is the
  // Restart level button relabelled, and there is no last light to return to.
  const finished = trans ? LEVELS[trans.from - 1] : null;
  $("back-to-light").hidden = !!finished;
  $("restart-chapter").textContent = finished ? `Play ${finished.numeral} · ${finished.title} again` : "Restart level";
  $("pause-main").hidden = false;
  $("pause-assist").hidden = true;
  $("pause-veil").hidden = false;
  syncOrbit(pauseOrbit, trans && !trans.swapped ? 1 : progressOf(state.player.x));
  syncJourney();
  $("pause-title").textContent = "Paused";
  $("resume").focus({ preventScroll: true });
  sync();
}
function closePause() {
  if (trans?.paused) {
    trans.paused = false;
    syncAudio();
    $("pause-veil").hidden = true;
    canvas.focus({ preventScroll: true });
    sync();
    return;
  }
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
}
function backToLight() {
  if (!ready || state.status === "ready") return;
  retry(state);
  afterReset();
  audio.play("respawn");
}
function restartChapter() {
  if (!ready) return;
  if (trans) return replayFinished();
  arrival = null;
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
  previewRefills = [];
  relicHolds.length = 0;
  refillFx.length = 0;
  refillState.clear();
  refillWake.clear();
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
  finishTransition();
  arrival = null;
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
/** The title's orbit line: one numbered stop per level, built from LEVELS so
 * that 8-10 levels fit as well as four. Open stops select; locked ones stay
 * focusable so their name can be previewed. The selected (or previewed)
 * level's name and Great Star slots are shown once, below the line. */
const LEAVES = '<svg class="leaves" viewBox="-11 -14 22 14" aria-hidden="true"><path d="M0 0 C-7 -2 -9 -9 -6 -13 C-1 -11 1 -5 0 0Z"/><path d="M0 0 C5 -1 9 -6 9 -11 C4 -11 0 -6 0 0Z"/></svg>';
let preview = null; // a level hovered or focused on the title
/** The title's legend lists only the verbs owned at the selected level's
 * start (RESEARCH_PROGRESSION U8): a first launch shows "↑ jump" alone. */
function syncLegend() {
  const d = LEVELS[state.level - 1],
    has = (v) => !d?.verbs || !!d.verbs[v];
  const touch = coarse || root.classList.contains("touch");
  const thumb = ["cape", "dive"].filter(has);
  $("title-keys").textContent = touch
    ? `tap left to jump${thumb.length ? ` · right thumb: ${thumb.join(", ")}` : ""}`
    : ["↑ jump", has("cape") && "→ cape", has("dive") && "↓ dive"].filter(Boolean).join(" · ");
}
function syncLevelMap() {
  syncLegend();
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
  finishTransition();
  arrival = null;
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

/* ---------- the automatic end-of-level transition (RESEARCH_TRANSITIONS §2) ----------
 * The door flows into the next level on the music's own pulse: four beats
 * of the finished level (the door blooms, Diana becomes light, the camera
 * eases back into space, the planets travel, the tally shows), then the
 * next level's four-beat count-in (its world fades in, its title card, the
 * arrival door) and bar 1, where Diana steps out running. transition.mjs
 * holds the beats and every parameter of the picture; this file draws them.
 * No card, no choice: R plays the level again, Esc/P pauses (freezing the
 * beat), any other press after a one-beat lockout skips to the arrival.
 * The result is saved at the door (A0). */
let trans = null,
  // The lit door behind Diana after a transition ({ at: B4 clock, beat });
  // cleared by Restart level, startLevel and the title.
  arrival = null,
  // The sky camera's offset from the world camera: re-based at the swap so
  // the starfield never jumps (it is procedural and wraps).
  skyOffset = { x: 0, y: 0 },
  lastTransition = null; // the last finished transition's frame-time stats (QA)
const downKeys = new Set(), // keys down now (e.code)
  staleKeys = new Set(), // down at the run's start or used to skip: swallowed until released
  pointersDown = new Set(),
  stalePointers = new Set();
const skyX = () => camera.x + skyOffset.x + (trans?.f?.skyTravel ?? 0) * W;
const skyY = () => camera.y + skyOffset.y;
/** Simulation seconds on the run's clock: negative before bar 1 of an
 * arriving level (so its title card can start at B2), else state.time. */
function simNow() {
  if (!trans?.swapped) return state.time;
  return (clock - runAt()) * simScale();
}
const runAt = () => (trans.skipAt != null ? trans.skipAt + trans.dissolve : trans.at + trans.plan.B[4]);
function beginTransition({ preview = false } = {}) {
  if (trans || !ready) return;
  const def = state.def,
    n = state.level,
    last = n >= LEVELS.length,
    next = last ? null : LEVELS[n];
  // The result is saved now (§2.11): a skip, R, Main menu or a closed tab
  // mid-transition all keep it. Falls were already counted at each death.
  const run = { stars: state.stars, total: state.pickups.filter((q) => !q.great).length, great: state.greatBanked.length, falls: state.deaths };
  // (A QA preview records on a copy: it never touches the save.)
  const book = preview ? structuredClone(progress) : progress;
  const { before, after } = recordWin(book, { level: n, stars: run.stars, great: run.great });
  if (!preview) {
    writeProgress();
    syncLevelMap();
  }
  const plan = transitionPlan({ bpmFrom: def.bpm, bpmTo: next?.bpm ?? def.bpm, pace, last, credits: last && !book.credits });
  const look = currentLook(),
    view = backdropView();
  trans = {
    plan,
    at: clock,
    from: n,
    to: next?.id ?? null,
    last,
    run,
    before,
    after,
    tally: tallyOf(def, run, after, next),
    look,
    endBox: look ? bodyBox(look, view) : null,
    lookView: view,
    nextLook: next ? lookOf(next) : null,
    // D: the door's world point; its screen point at A0 is where the pull-back starts.
    door: { x: WORLD().finishX, y: WORLD().finishY - 60, sx: WORLD().finishX - camera.x, sy: WORLD().finishY - 60 - camera.y, earth: !!WORLD().earth || last },
    opening: doorOpening(WORLD().finishX, WORLD().finishY),
    swapped: false,
    paused: false,
    skipAt: null,
    dissolve: reduced ? 0 : 0.3,
    said: false,
    counted: { stars: -1, great: -1 },
    frames: [],
    lastFrame: null,
    f: null,
    countIn: null,
    preview,
    hold: null, // QA: a beat time the picture is frozen at
  };
  trans.f = frameAt(plan, 0, { reduced });
  clearWords();
  held.glide = false;
  if (!last) trans.countIn = scheduleCountIn(next, plan);
  fillTally();
  warmNextBody();
  sync();
}
/** The next level's four-beat count-in, B0-B3, under the held closing
 * chord (it plays under reduced motion too: that setting is about motion).
 * audio.countIn schedules on the AudioContext clock, which a pause
 * suspends with the transition's own clock. */
function scheduleCountIn(next, plan) {
  const beats = [0, 1, 2, 3].map((k) => trans.at + plan.B[k]);
  let handle = null;
  try {
    handle = audio.countIn({ bpm: next.bpm * pace, delay: plan.B[0] });
  } catch {
    /* sound off or blocked: the picture keeps the beat */
  }
  return { handle, beats, scheduled: typeof handle === "number" ? handle : handle?.beats ?? 0, cancelled: 0 };
}
/** Beats of the count-in not yet sounded are cancelled (skip, R, menu): the
 * engine's score reset fades every pending music voice in 15 ms. */
function cancelCountIn(t) {
  const c = t?.countIn;
  if (!c || c.done) return;
  c.done = true;
  c.cancelled = c.beats.filter((b) => b > clock + 0.005).length;
  if (typeof c.handle?.cancel === "function") c.handle.cancel();
}
function warmNextBody() {
  const id = trans?.nextLook;
  if (!id) return;
  backdrop ??= createBackdrop({ makeCanvas, images, sprite: spriteOn, reduced });
  trans.warmMs = backdrop.warm(id, H);
}
/** Build the next look's cached body while the level is ending (progress ≥
 * 0.85), in idle time, so no transition frame paints it from scratch. */
let warmed = null;
function warmAhead() {
  if (state.status !== "running" || trans || state.level >= LEVELS.length) return;
  const id = lookOf(LEVELS[state.level]);
  if (!id || warmed === `${state.level}:${id}` || progressOf(state.player.x) < 0.85) return;
  warmed = `${state.level}:${id}`;
  const build = () => {
    backdrop ??= createBackdrop({ makeCanvas, images, sprite: spriteOn, reduced });
    warmedMs = backdrop.warm(id, H);
  };
  if (window.requestIdleCallback) requestIdleCallback(build, { timeout: 500 });
  else setTimeout(build, 0);
}
let warmedMs = null;
/** The world's view during the transition: its alpha, zoom and top-left. */
function transitionView(f) {
  if (!trans.swapped) {
    const D = trans.door,
      Sx = D.sx + (0.5 * W - D.sx) * f.anchor,
      Sy = D.sy + (0.58 * H - D.sy) * f.anchor;
    return { alpha: f.world, zoom: f.zoom, x: D.x - Sx / f.zoom, y: D.y - Sy / f.zoom, diana: f.diana };
  }
  // The push-in is about Diana's screen point; at B4 it is the run's identity.
  const p = viewPos(),
    Px = p.x - camera.x,
    Py = p.y - 50 - camera.y;
  return { alpha: f.newWorld, zoom: f.push, x: camera.x + Px - Px / f.push, y: camera.y + Py - Py / f.push, diana: f.newDiana };
}
/** The frame's step: the beat plan, the swap at A4 = B0, the run at B4. */
function stepTransition(real) {
  if (!trans || trans.paused) return;
  if (trans.hold != null) trans.at = clock - trans.hold;
  const t = clock - trans.at;
  if (trans.lastFrame != null && real > 0 && trans.hold == null) trans.frames.push(real * 1000);
  trans.lastFrame = clock;
  let f;
  if (trans.skipAt != null) {
    const u = trans.dissolve > 0 ? (clock - trans.skipAt) / trans.dissolve : 1;
    if (u >= 1) return arrive(true);
    f = skipFrame(u);
  } else f = frameAt(trans.plan, t, { reduced });
  trans.f = f;
  if (trans.last) {
    if (f.phase === "credits" && !progress.credits && !trans.preview) {
      progress.credits = true;
      writeProgress();
    }
    if (t >= trans.plan.titleAt) return endJourney(trans.plan.bar);
  } else {
    if (!trans.swapped && f.swapped) swapLevel();
    if (t >= trans.plan.B[4]) return arrive(false);
  }
  syncTransitionDom(f);
}
/** After a skip: a 0.3 s cross-dissolve into the arrival (a cut under
 * reduced motion), no zoom, Diana already in the door's light. */
function skipFrame(u) {
  const a = reduced ? 1 : Math.max(0, Math.min(1, u));
  return { t: clock - trans.at, phase: "arrive", skip: true, reduced, light: 0, rings: [], diana: 0, world: 0, zoom: 1, anchor: 0, motes: false, skyTravel: trans.f?.skyTravel ?? 0, hudOld: 0, oldBody: { u: 1, alpha: 0 }, newBody: { u: 1, alpha: 1 }, orbit: { draw: 1, alpha: 0, leaf: 1 }, tally: 0, count: 1, swapped: true, newWorld: a, push: 1, arrivalLight: 0.85, newDiana: 1, hudNew: a, controls: true, card: true };
}
function requestSkip() {
  if (!trans || trans.paused) return;
  const t = clock - trans.at;
  // The one-beat lockout catches the reflex press of a player still jumping at the door.
  if (t < trans.plan.lockout || trans.skipAt != null) return;
  if (trans.last) return endJourney(0.6);
  if (!trans.swapped) swapLevel();
  trans.skipAt = clock;
  cancelCountIn(trans);
  // Pending count-in beats go in 15 ms; the held chord keeps its 1.4 s handover.
  audio.hush(0.015, { hold: 1.4 });
  // The title card starts with the press, as usual.
  showMovement(state.def.movements[0].id, simNow());
  trans.f = skipFrame(0);
  syncTransitionDom(trans.f);
}
/** A4 = B0: the next level loads unseen, already at its run framing. Its
 * simulation is started but held (and its events, the wake among them,
 * wait) until bar 1. */
function swapLevel() {
  trans.swapped = true;
  const sx = camera.x + skyOffset.x,
    sy = camera.y + skyOffset.y;
  const assist = { ...state.assist };
  Object.assign(state, createGame(state.seed, { level: trans.to, ...assist }));
  audio.setLevel(state.level);
  hudOrbit = buildOrbit($("orbit"), 264, 44, false);
  pauseOrbit = buildOrbit($("pause-orbit"), 360, 80, true);
  root.dataset.level = String(state.level);
  syncLevelMap();
  start(state);
  clearMoments();
  fx.length = 0;
  resetShelfWatch();
  clearWords();
  emergence = null;
  wokeFromEarth = false;
  // A wake long ago: no sprout pop, no title-ground fade, no wake pan.
  wakeAt = clock - 1;
  ui.great = "";
  ui.orbitDirty = true;
  resize();
  camera.snap = true;
  updateCamera(0);
  skyOffset = { x: sx - camera.x, y: sy - camera.y };
  arrival = { at: null, beat: 60 / (state.def.bpm * pace) };
  // The title card from B2, two beats before the run (§2.7).
  showMovement(state.def.movements[0].id, -(trans.plan.B[4] - trans.plan.B[2]) * simScale());
}
/** B4 (or a skip's run start): bar 1. Diana steps out running. */
function arrive(skipped) {
  const t = trans;
  finishTransition(t);
  // The next score's bar 1 with the held chord's 1.4 s handover (as the
  // old map did), then the held wake event starts the song now.
  audio.scoreReset({ hold: 1.4 });
  audio.hush(skipped ? 0.015 : 0.12, { hold: 1.4 });
  audio.clearMoments();
  if (arrival) arrival.at = clock;
  // Keys and pointers down now are stale until released (no input lost or doubled).
  for (const k of downKeys) staleKeys.add(k);
  for (const id of pointersDown) stalePointers.add(id);
  held.glide = false;
  processEvents();
  canvas.focus({ preventScroll: true });
  sync();
}
/** End the transition's bookkeeping (arrival, skip, R, menu, QA). */
function finishTransition(t = trans) {
  if (!t) return;
  // Fold the sky's extra travel into its offset so nothing jumps.
  skyOffset.x += (t.f?.skyTravel ?? 0) * W;
  cancelCountIn(t);
  lastTransition = { from: t.from, to: t.to, skipped: t.skipAt != null, frames: t.frames.length ? frameStats(t.frames) : null, warmMs: t.warmMs ?? warmedMs, countIn: t.countIn ? { scheduled: t.countIn.scheduled, cancelled: t.countIn.cancelled } : null, ended: clock - t.at };
  trans = null;
  hideTally();
  delete root.dataset.controls;
  root.style.removeProperty("--level-hud");
}
function frameStats(list) {
  const s = [...list].sort((a, b) => a - b),
    q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { count: s.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s.at(-1).toFixed(2) };
}
/** R (or the pause card's "Play … again"): the finished level again. */
function replayFinished() {
  if (!trans) return;
  const n = trans.from,
    swapped = trans.swapped;
  $("pause-veil").hidden = true;
  finishTransition();
  if (swapped) startLevel(n);
  else restartChapter();
}
/** The journey's end (§2.8): the title, selecting the last level. */
function endJourney(fade = 0.6) {
  const seconds = Math.max(0.3, fade);
  finishTransition();
  root.style.setProperty("--title-fade", `${seconds.toFixed(2)}s`);
  root.classList.add("from-ending");
  clearTimeout(endFadeTimer);
  endFadeTimer = setTimeout(() => root.classList.remove("from-ending"), seconds * 1000 + 100);
  toTitle();
}
let endFadeTimer = 0;
function pauseTransition() {
  if (!trans || trans.paused) return;
  trans.paused = true;
  held.glide = false;
  syncAudio();
  showPauseCard();
}

/* The tally (§2.4): DOM, because the canvas has no text. Non-blocking: no
 * buttons, no focus, pointer-events none, opacity and transform only, its
 * text set at most 12 times (the count-up), announced once at A2. */
function fillTally() {
  const t = trans,
    L = t.tally.level;
  $("tally-name").textContent = L.name;
  $("tally-stars").textContent = String(L.stars);
  $("tally-total").textContent = `/ ${L.total}`;
  $("tally-falls").textContent = t.tally.falls;
  const slots = $("tally-great").querySelectorAll(".slot");
  slots.forEach((s, i) => s.classList.toggle("filled", i < L.great));
  $("tally-great").setAttribute("aria-label", `${L.great} of 3`);
  // The journey row starts at the save's old totals (it counts up A3-A4).
  const j = reduced ? t.after : t.before;
  $("tally-journey-stars").textContent = String(j.stars);
  $("tally-journey-great").textContent = String(j.great);
  $("tally-journey-total").textContent = `/ ${t.after.greatTotal}`;
  $("tally-journey-falls").textContent = t.tally.journeyFalls;
  t.counted = { stars: j.stars, great: j.great };
  $("tally-line").hidden = !t.last;
  $("tally-line").textContent = t.last ? endingLine(t.after) : "";
  $("tally-say").textContent = "";
  $("tally").classList.toggle("ending", t.last);
  $("tally").style.opacity = "0";
  $("tally").hidden = false;
  $("tally-hint").hidden = false;
  $("tally-hint").style.opacity = "0";
  // The hint and the ↺ button sit under the panel (one layout read per transition).
  root.style.setProperty("--tally-h", `${$("tally").offsetHeight}px`);
}
function hideTally() {
  for (const id of ["tally", "tally-hint", "tally-again", "credits"]) {
    $(id).hidden = true;
    $(id).style.opacity = "0";
  }
}
function syncTransitionDom(f) {
  const t = trans;
  const a = Math.max(0, Math.min(1, f.tally));
  $("tally").style.opacity = a.toFixed(3);
  $("tally").style.transform = reduced || a >= 1 ? "" : `translate(-50%, ${((1 - a) * 6).toFixed(1)}px)`;
  $("tally-hint").style.opacity = a.toFixed(3);
  const again = $("tally-again");
  again.hidden = a <= 0.01;
  again.style.opacity = a.toFixed(3);
  if (a > 0 && !t.said) {
    t.said = true;
    $("tally-say").textContent = t.tally.say;
  }
  // The journey's stars and Great Stars count up from the old totals.
  const stars = countUp(t.before.stars, t.after.stars, f.count),
    great = countUp(t.before.great, t.after.great, f.count);
  if (stars !== t.counted.stars) $("tally-journey-stars").textContent = String((t.counted.stars = stars));
  if (great !== t.counted.great) {
    if (great > t.counted.great && t.counted.great >= 0) pulseClass($("tally-journey-slot"), "pulse", 500);
    $("tally-journey-great").textContent = String((t.counted.great = great));
  }
  root.style.setProperty("--level-hud", (f.swapped ? f.hudNew : f.hudOld).toFixed(3));
  if (f.controls) delete root.dataset.controls;
  else root.dataset.controls = "off";
  // The ending's credits: one card at a time.
  const c = $("credits");
  if (f.credit) {
    const card = CREDITS[f.credit.index];
    if (c.dataset.index !== String(f.credit.index)) {
      c.dataset.index = String(f.credit.index);
      $("credits-logo").hidden = !card.logo;
      $("credits-text").hidden = !!card.logo;
      $("credits-text").textContent = card.logo ? "" : card.text;
      announce(card.text);
    }
    c.hidden = false;
    c.style.opacity = f.credit.alpha.toFixed(3);
  } else if (!c.hidden) {
    c.hidden = true;
    delete c.dataset.index;
  }
}
/** The Journey line of the pause card (§2.4): always one key away. */
function syncJourney() {
  const j = journeyOf(progress);
  $("pause-journey-stars").textContent = String(j.stars);
  $("pause-journey-great").textContent = `${j.great}/${j.greatTotal}`;
  $("pause-journey-falls").textContent = j.falls === 1 ? "1 fall" : `${j.falls} falls`;
  $("pause-journey").setAttribute("aria-label", `Journey: ${j.stars} stars, ${j.great} of ${j.greatTotal} Great Fallen Stars, ${j.falls === 1 ? "1 fall" : `${j.falls} falls`}`);
}

/* ---------- the transition's picture (§3) ---------- */
const LEAF_PATHS = typeof Path2D === "function" ? ["M0 0 C-7 -2 -9 -9 -6 -13 C-1 -11 1 -5 0 0Z", "M0 0 C5 -1 9 -6 9 -11 C4 -11 0 -6 0 0Z"].map((d) => new Path2D(d)) : [];
const quad = (a, c, b, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;
/** Where the finished level's body travels: from its level-end box on an
 * arc to (0.17 W, 0.36 H) at 0.4 of its radius, its top kept under the HUD band. */
function oldBodyBox(f) {
  const s = trans.endBox,
    e = { x: 0.17 * W, y: 0.36 * H, r: s.r * 0.4 };
  let cy = Math.min(s.y, e.y) - 0.12 * H;
  // Lower the control point until the body's top stays ≥ HUD band + 8.
  for (let k = 0; k < 20; k++) {
    let ok = true;
    for (let u = 0; u <= 1; u += 0.05) {
      const y = quad(s.y, cy, e.y, u),
        r = s.r + (e.r - s.r) * u;
      if (y - bodyTop(trans.look, r) < HUD_BAND + 8) ok = false;
    }
    if (ok) break;
    cy += 10;
  }
  const u = f.oldBody.u;
  return { x: quad(s.x, (s.x + e.x) / 2, e.x, u), y: quad(s.y, cy, e.y, u), r: s.r + (e.r - s.r) * u, end: e };
}
function nextStartBox(id) {
  return trans?.swapped ? bodyBox(id, backdropView()) : bodyBox(id, { W, H, progress: 0, driftX: 0, driftY: 0 });
}
/** The next body arrives on its arc from (1.15 W, its start y) at half its
 * radius and ends exactly at its level-start box (nothing jumps at bar 1). */
function newBodyBox(f, id) {
  // After the swap the target is the box play draws on its first frame
  // (its parallax drift at the run framing included), so bar 1 never jumps.
  const e = nextStartBox(id),
    u = f.newBody.u;
  if (LOOKS[id]?.body === "moon") return { x: e.x, y: e.y + 0.5 * H * (1 - u), r: e.r };
  const s = { x: 1.15 * W, y: e.y, r: e.r * 0.5 },
    cy = (s.y + e.y) / 2 - 0.06 * H;
  return { x: quad(s.x, (s.x + e.x) / 2, e.x, u), y: quad(s.y, cy, e.y, u), r: s.r + (e.r - s.r) * u, end: e };
}
function drawTransitionSky(f) {
  backdrop ??= createBackdrop({ makeCanvas, images, sprite: spriteOn, reduced });
  const view = { ...backdropView(), clock };
  if (trans.last) return drawEnding(f, view);
  const oldId = trans.look,
    newId = trans.nextLook;
  let oldEnd = null,
    newEnd = null;
  if (oldId && f.oldBody.alpha > 0.01) {
    const box = oldBodyBox(f);
    oldEnd = box.end;
    ctx.save();
    ctx.globalAlpha = f.oldBody.alpha;
    if (f.reduced && f.oldBody.cross != null && f.oldBody.cross < 1) {
      // Reduced motion: no travel; the level-end body cross-fades to its end box.
      ctx.globalAlpha = f.oldBody.alpha * (1 - f.oldBody.cross);
      backdrop.drawBody(ctx, oldId, { ...trans.lookView, clock, box: trans.endBox });
      ctx.globalAlpha = f.oldBody.alpha * f.oldBody.cross;
    }
    backdrop.drawBody(ctx, oldId, { ...trans.lookView, clock, box: f.reduced && !f.oldBody.cross ? trans.endBox : { x: box.x, y: box.y, r: box.r } });
    ctx.restore();
    // Its accent fades with the old world.
    if (f.world > 0.01) {
      ctx.save();
      ctx.globalAlpha = f.world;
      backdrop.drawAccent(ctx, oldId, trans.lookView);
      ctx.restore();
    }
  }
  if (newId && f.newBody.alpha > 0.01) {
    const box = newBodyBox(f, newId);
    newEnd = box.end;
    ctx.save();
    ctx.globalAlpha = f.newBody.alpha;
    backdrop.drawBody(ctx, newId, { ...view, box: { x: box.x, y: box.y, r: box.r } });
    if (f.newWorld > 0.01) {
      ctx.globalAlpha = f.newWorld;
      backdrop.drawAccent(ctx, newId, { ...view, progress: 0 });
    }
    ctx.restore();
  }
  drawOrbitLine(f, oldEnd ?? { x: 0.17 * W, y: 0.36 * H }, newEnd ?? { x: 0.78 * W, y: 0.42 * H });
}
/** The title's orbit line brought into the sky (§3.5): dotted, drawn on
 * A2-A3, a stop at each end, Diana's two-leaf marker sliding A3-B2. */
function drawOrbitLine(f, a, b) {
  if (f.orbit.alpha <= 0.01) return;
  const cx = (a.x + b.x) / 2,
    cy = (a.y + b.y) / 2 - 0.15 * H,
    at = (u) => ({ x: quad(a.x, cx, b.x, u), y: quad(a.y, cy, b.y, u) });
  ctx.save();
  ctx.globalAlpha = f.orbit.alpha;
  ctx.strokeStyle = "rgba(251,251,234,0.3)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 7]);
  ctx.beginPath();
  const n = Math.round(32 * f.orbit.draw);
  for (let i = 0; i <= n; i++) {
    const p = at(i / 32);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [p, done] of [[a, true], [b, false]]) {
    ctx.fillStyle = INK;
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (done) sprite("star", 2, p.x + 6, p.y - 6, 0.07);
  }
  const m = at(f.orbit.leaf);
  ctx.translate(m.x, m.y - 2);
  ctx.scale(1.6, 1.6);
  ctx.fillStyle = PAPER;
  for (const path of LEAF_PATHS) ctx.fill(path);
  ctx.restore();
}
/** The ending (§2.8): the Moon sinks, Earth turns to face her, whole and blue. */
function drawEnding(f, view) {
  const id = trans.look;
  if (id && LOOKS[id]?.body === "moon") {
    const b = bodyBox(id, trans.lookView);
    backdrop.drawBody(ctx, id, { ...trans.lookView, box: { x: b.x, y: b.y + 0.5 * H * f.moonSink, r: b.r } });
  } else if (id) backdrop.drawBody(ctx, id, { ...trans.lookView, box: trans.endBox });
  const e0 = earthBox("moon-earth", { W, H, progress: 1 }),
    u = f.earth,
    x = e0.x + (0.5 * W - e0.x) * u,
    y = e0.y + (0.42 * H - e0.y) * u,
    r = e0.r + (0.2 * H - e0.r) * u,
    // (Past 1.6 r the 0.94 r ink disc still bit the limb: it slides to 2.05 r, clear.)
    off = 0.42 + (2.05 - 0.42) * u;
  ctx.save();
  ctx.globalAlpha = f.earthAlpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(111,168,220,0.95)";
  ctx.fill();
  // The ink disc that made it a crescent slides off: Earth turns full.
  ctx.clip();
  ctx.beginPath();
  ctx.arc(x - r * off, y - r * 0.12, r * 0.94, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.restore();
}
/** The door's opening on portal.png (250 × 397): a rect from (0.12, 0.30)
 * to (0.83, 1.0) and a half-ellipse cap up to the crown at 0.17, mapped
 * through visibleBounds as portalPlacement does. */
function doorOpening(x, groundY) {
  const b = manifest.portal.visibleBounds,
    pl = portalPlacement(x, groundY, b),
    k = pl.width / b.w,
    px = (fx) => pl.x + (fx * manifest.portal.width - b.x) * k,
    py = (fy) => pl.y + (fy * manifest.portal.height - b.y) * k;
  const left = px(0.12),
    right = px(0.83),
    top = py(0.3),
    crown = py(0.17),
    base = Math.min(pl.baseY, py(1));
  const path = new Path2D();
  path.moveTo(left, base);
  path.lineTo(left, top);
  path.ellipse((left + right) / 2, top, (right - left) / 2, top - crown, 0, Math.PI, 0);
  path.lineTo(right, base);
  path.closePath();
  return { path, left, right, top, crown, base, cx: (left + right) / 2, cy: (crown + base) / 2, w: right - left };
}
/** The door blooms (§3.2): a front of light rising from the threshold to
 * the crown over one beat, a soft glow and two ring pulses; Earth's blue at
 * the journey's last door. Drawn in the world, under the zoom. */
function drawDoorLight(o, level, colour) {
  if (level <= 0.001 || !manifest?.portal) return;
  const rgb = colour === "earth" ? "111,168,220" : "251,251,234",
    a = colour === "earth" ? 0.9 : 0.85;
  ctx.save();
  const glow = ctx.createRadialGradient(o.cx, o.cy, 2, o.cx, o.cy, 1.4 * o.w);
  glow.addColorStop(0, `rgba(${rgb},${0.12 * Math.min(1, level)})`);
  glow.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(o.cx - 1.4 * o.w, o.cy - 1.4 * o.w, 2.8 * o.w, 2.8 * o.w);
  const front = o.base - (o.base - o.crown) * Math.min(1, level),
    g = ctx.createLinearGradient(0, o.base, 0, o.crown);
  const stop = Math.max(0.001, Math.min(0.999, (o.base - front) / (o.base - o.crown)));
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(stop, `rgba(${rgb},${a})`);
  g.addColorStop(Math.min(1, stop + 0.04), `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fill(o.path);
  ctx.restore();
}
function drawRings(o, rings) {
  ctx.save();
  ctx.strokeStyle = PAPER;
  for (const ring of rings) {
    ctx.globalAlpha = ring.alpha;
    ctx.lineWidth = ring.width;
    ctx.beginPath();
    ctx.arc(o.cx, o.cy, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
/** Motes (§3.6): 12 star-sheet sprites and 3 tail-star streaks rising from
 * the opening's lower third, from A1; seeded by the level id so frames are
 * deterministic. They keep rising after Diana is gone (follow-through). */
function drawMotes(f, o) {
  if (!f.motes) return;
  const b = trans.plan.b,
    t = f.t - trans.plan.A[1],
    seed = trans.from * 101;
  for (let i = 0; i < 12; i++) {
    const age = t - (i * b) / 12,
      life = 1.5 * b;
    if (age < 0 || age > life) continue;
    const u = age / life,
      x0 = o.left + hash(seed + i) * o.w,
      y0 = o.base - hash(seed + i + 40) * (o.base - o.crown) * 0.33,
      vy = 90 + hash(seed + i + 80) * 60,
      x = x0 + Math.sin(age * Math.PI * 2 * 1.2 + i) * 6,
      y = y0 - vy * age;
    sprite("star", Math.floor(hash(seed + i + 120) * 3), x, y, 0.06 + hash(seed + i + 160) * 0.06, 1 - u * u);
  }
  for (let i = 0; i < 3; i++) {
    const age = t - (i * b) / 3;
    if (age < 0 || age > b) continue;
    const u = age / b,
      heading = ((-80 + (hash(seed + i + 200) - 0.5) * 20) * Math.PI) / 180,
      len = 40 + hash(seed + i + 240) * 30,
      x = o.left + hash(seed + i + 280) * o.w,
      y = o.base - 20 - 140 * age;
    streak(x, y, heading, len / 555, 1 - u);
  }
}

/* ---------- input ---------- */
const GAME_KEYS = ["Space", "ArrowUp", "ArrowRight", "ArrowDown", "KeyW", "KeyD", "KeyS"];
// Which keys and pointers are down (stale-press bookkeeping, §2.5).
window.addEventListener("keydown", (e) => downKeys.add(e.code), true);
window.addEventListener("keyup", (e) => downKeys.delete(e.code), true);
window.addEventListener("pointerdown", (e) => pointersDown.add(e.pointerId), true);
for (const type of ["pointerup", "pointercancel"]) window.addEventListener(type, (e) => pointersDown.delete(e.pointerId), true);
const MODIFIERS = ["Tab", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight", "CapsLock"];
/** Keys during the transition: R plays the finished level again, Esc/P
 * pauses, any other fresh press skips after the one-beat lockout. The
 * press is consumed: it never reaches jump, cape or dive, nor the jump
 * buffer, and its release is swallowed. */
function transitionKey(e) {
  if (MODIFIERS.includes(e.code)) return;
  e.preventDefault();
  if (e.repeat) return; // a key held through the door never skips
  if (e.code === "KeyR") return replayFinished();
  if (["KeyP", "Escape"].includes(e.code)) return pauseTransition();
  staleKeys.add(e.code);
  requestSkip();
}
// A click or tap on the stage skips too, except the HUD's own buttons; it
// never reaches the jump zone or the canvas (captured here, first).
root.addEventListener(
  "pointerdown",
  (e) => {
    if (!trans || trans.paused) return;
    if (e.target instanceof Element && e.target.closest("#pause, .itch-fullscreen, #sound, #tally-again, #pause-veil")) return;
    e.preventDefault();
    e.stopPropagation();
    stalePointers.add(e.pointerId);
    requestSkip();
  },
  true,
);
window.addEventListener("keydown", (e) => {
  const onButton = e.target instanceof HTMLElement && e.target.matches("button");
  if (state.status === "paused" || trans?.paused) {
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
  if (trans) return transitionKey(e);
  // Keys still down from before the run began are stale until released.
  if (staleKeys.has(e.code)) return e.preventDefault();
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
  const menu = "#tally-again, #sound, #pause, .itch-fullscreen";
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
  // A stale key's release is swallowed: it never releases a fresh jump.
  if (staleKeys.delete(e.code)) return;
  if (trans) return;
  if (GAME_KEYS.includes(e.code)) atInput(e);
  if (["KeyD", "ArrowRight"].includes(e.code)) held.glide = false;
  if (["Space", "ArrowUp", "KeyW"].includes(e.code)) releaseJump(state);
});
// Keys let go while the window is away never send keyup: release the jump
// and the cape here (A3: no jump stays "held" behind the pause card).
window.addEventListener("blur", () => {
  held.glide = false;
  if (state.status === "running" || trans) openPause();
  releaseJump(state);
  downKeys.clear();
  staleKeys.clear();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (state.status === "running" || trans)) openPause();
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
    // The tap that skipped a transition (or was down at its end) never
    // reaches the jump zone: its release is swallowed.
    if (stalePointers.delete(e.pointerId) || trans) return;
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
    if (state.status === "ready" && !coarse) syncLegend();
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
canvas.addEventListener("pointerup", (e) => {
  if (stalePointers.delete(e.pointerId) || trans) return;
  atInput(e);
  releaseJump(state);
});
$("start").addEventListener("click", pressWake);
$("pause").addEventListener("click", openPause);
$("resume").addEventListener("click", closePause);
$("back-to-light").addEventListener("click", backToLight);
$("restart-chapter").addEventListener("click", restartChapter);
$("tally-again").addEventListener("click", () => trans && replayFinished());
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
    if (!$("pause-veil").hidden || state.status === "ready")
      $("ink-noise")?.setAttribute("seed", String((seed = (seed % 4) + 1)));
  }, 125);
}

/** Simulate up to `now` (an animation-frame or input-event timestamp). An
 * input handler calls it with the event's own timeStamp before applying the
 * press, so the press lands on the tick it was made in (frame-clock.mjs). */
const frameClock = createFrameClock({ maxStep: 0.1 });
function advanceTo(now) {
  const real = frameClock.advance(now);
  clock += state.status === "paused" || trans?.paused ? 0 : real;
  // The level's clock (BPM / 107) and Gentle pace scale time only, so
  // every arc and gap stays identical (RESEARCH_LEVELS 3). An arriving
  // level is held at bar 1 until the transition ends.
  if (ready && real > 0 && !trans?.swapped) update(state, real * simScale(), held);
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
    // (An arriving level's events, its wake among them, wait for bar 1.)
    if (!trans?.swapped) processEvents();
    scriptedCues();
    stepTransition(real);
    warmAhead();
    stepEaseFrame();
    syncAudio();
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
  // The platform style (platform-style.mjs): "meteor" or "classic". Drawing
  // only, so it switches at once and back losslessly; returns the style.
  setPlatformStyle: (style) => (isPlatformStyle(style) && (platformStyle = style), ready && draw(), platformStyle),
  getPlatformStyle: () => platformStyle,
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
  // Relics without the eight-level model: previewRelic("double") places the
  // verb's relic `lead` px ahead (its beam and art); it bursts, holds over
  // Diana and shows the banner as she runs through it. previewRefill("cape" |
  // "leaf", { lit }) places a refill star at her chest height.
  previewRelic: (verb, { lead = 640 } = {}) => {
    const x = state.player.x + lead;
    previewGets.push({ id: `relic-${verb}`, verb, x, y: runLineAt(x) - 40, preview: true, relic: true });
    return { verb, x, beam: true };
  },
  previewRefill: (kind = "cape", { lit = true, lead = 420, dy = -36 } = {}) => {
    const x = state.player.x + lead,
      q = { id: `refill-${kind}-${previewRefills.length}`, kind, x, y: state.player.y + dy, lit, taken: false, preview: true };
    previewRefills.push(q);
    return { ...q };
  },
  showBanner: (verb) => (showBanner(verb), banner && { ...banner }),
  getRelics: () => {
    const b = $("banner").getBoundingClientRect();
    return {
      ahead: relicsAhead().map((g) => ({ id: g.id, verb: g.verb, x: g.x, y: relicY(g) })),
      holds: relicHolds.map((h) => ({ verb: h.verb, age: clock - h.at, beat: h.beat })),
      refills: refillsOf().map((q) => ({ id: q.id, kind: q.kind, x: q.x, y: q.y, lit: !!q.lit, taken: !!q.taken, alpha: q.lit ? 1 : 0.4 })),
      banner: banner ? { verb: banner.verb, full: banner.full, age: clock - banner.at, seconds: banner.seconds, opacity: Number($("banner").style.opacity), name: $("banner-name").textContent, control: $("banner-control").hidden ? "" : $("banner-control").textContent, rect: { x: b.x, y: b.y, w: b.width, h: b.height } } : null,
      seen: [...(progress.relics ?? [])],
    };
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
  // The transition (§2): { phase: door | space | arrive | null (the
  // ending: door, space, tally, credits, title), t, beat, plan, zoom,
  // world, tally, countIn, frames { count, median, p95, max } }; with no
  // transition running, the last one's frame stats as `last`.
  getTransition: () => {
    if (!trans) return { phase: null, last: lastTransition, warmMs: warmedMs };
    const f = trans.f ?? {},
      t = clock - trans.at,
      beats = trans.last ? trans.plan.A : [...trans.plan.A.slice(0, 4), ...trans.plan.B];
    return {
      phase: f.phase ?? null,
      t,
      beat: beats.filter((b) => b <= t + 1e-6).length - 1,
      plan: { b: trans.plan.b, c: trans.plan.c, A: trans.plan.A, B: trans.plan.B, total: trans.plan.total, lockout: trans.plan.lockout, titleAt: trans.plan.titleAt ?? null, credits: trans.plan.cards ?? 0 },
      from: trans.from,
      to: trans.to,
      last: trans.last,
      swapped: trans.swapped,
      paused: trans.paused,
      skipped: trans.skipAt != null,
      zoom: trans.swapped ? f.push : f.zoom,
      world: trans.swapped ? f.newWorld : f.world,
      motes: !!f.motes,
      bodies: { old: trans.look && trans.endBox && f.oldBody ? oldBodyBox(f) : null, next: trans.nextLook && f.newBody ? newBodyBox(f, trans.nextLook) : null, nextStart: trans.nextLook ? nextStartBox(trans.nextLook) : null },
      tally: { opacity: Number($("tally").style.opacity), level: trans.tally.level, journey: trans.after, before: trans.before, text: $("tally").innerText, say: $("tally-say").textContent },
      countIn: trans.countIn ? { scheduled: trans.countIn.scheduled, cancelled: trans.countIn.cancelled, beats: trans.countIn.beats.map((b) => +(b - trans.at).toFixed(3)) } : null,
      frames: trans.frames.length ? frameStats(trans.frames) : null,
      warmMs: trans.warmMs ?? warmedMs,
    };
  },
  // A transition frozen at one beat, for evidence (it never touches the
  // save): previewTransition(n, { beat: "A3" | seconds }); hold(null) lets it run.
  previewTransition: (n, { beat = "A3" } = {}) => {
    startLevel(n);
    clearTimeout(wakingTimer); // (no title UI fading behind the evidence)
    root.classList.remove("waking");
    state.player.x = WORLD().finishX;
    state.player.y = WORLD().finishY;
    state.player.grounded = true;
    state.status = "won";
    wakeAt = clock - 60; // as at the end of a real run (no title ground)
    camera.snap = true;
    updateCamera(0);
    beginTransition({ preview: true });
    const p = trans.plan,
      named = /^([AB])(\d+(?:\.\d+)?)$/.exec(String(beat));
    const at = named ? (named[1] === "A" ? Number(named[2]) * p.b : p.B[0] + Number(named[2]) * p.c) : Number(beat);
    trans.hold = at;
    trans.at = clock - at;
    stepTransition(0);
    sync();
    draw();
    return window.__game.getTransition();
  },
  holdTransition: (at = null) => {
    if (!trans) return false;
    trans.hold = at;
    if (at != null) trans.at = clock - at;
    return true;
  },
  // The stored save as written (version 3), or null when storage is blocked.
  getSave: () => {
    try {
      return JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "null");
    } catch {
      return null;
    }
  },
  getProgress: () => ({ ...writeSave(progress), journey: journeyOf(progress) }),
  // The signs drawn in the last frame, in world px (T1b): { id, x, y,
  // alpha, scale, discs }; keylines counts frames that drew Diana's keyline.
  getSigns: () => signsDrawn.map((r) => ({ id: r.id, x: r.x, y: r.y, alpha: r.alpha, scale: r.scale, discs: r.discs.map((d) => ({ x: d.x, y: d.y })) })),
  keylines: () => keylineFrames,
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
    syncLegend();
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
