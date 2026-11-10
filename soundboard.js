/** Dev-only soundboard for audio.mjs and score.mjs (excluded from the itch.io
 * ZIP). Plays every body cue and every score voice through the game's own
 * engine, renders runs and stems of the adaptive score offline from the
 * real model and pilots, and exposes `window.__soundboard` so browser QA can
 * export WAVs and measure them. */
import { CUES, CUE_NAMES, BEDS, VOICES, VOICE_NAMES, createAudioEngine, renderCueOffline, renderRunOffline, MUSIC_LEVEL } from "./audio.mjs";
import { CHORDS, BEAT, chordTones, rootIn, safeAtOrAbove, LAYERS } from "./score.mjs";
import { recordFrames, SLOPPY } from "./tests/music-run.mjs";

const $ = (id) => document.getElementById(id);
const engine = createAudioEngine({ enabled: true, seed: (Date.now() & 0xffff) + 1 });
const music = new Audio("./assets/soundtrack.mp3");
music.loop = true;
music.preload = "none";
engine.attachMusic(music, { level: MUSIC_LEVEL });
const counters = { chain: 0, tile: 0 };
let meter = null;
let playing = [];

const GROUPS = { move: "Body: movement", stone: "Body: stone", stars: "Body: stars", air: "Body: air and cape", story: "Body: story moments", ui: "Interface" };
const log = (text) => ($("log").textContent = text);
function ready() {
  engine.unlock();
  if (!meter) {
    meter = engine.analyser();
    if (meter) requestAnimationFrame(drawMeter);
  }
}
const chord = () => CHORDS[$("chord").value] ?? CHORDS.D;
for (const name of Object.keys(CHORDS)) {
  const o = document.createElement("option");
  o.value = name;
  o.textContent = CHORDS[name].name;
  if (name === "D") o.selected = true;
  $("chord").append(o);
}

/** Play one cue the way the game would (events feed the star melody). */
function fire(name, extra = {}) {
  ready();
  const t = performance.now() / 1000;
  if (name === "star") return engine.event({ name: "star", time: t });
  if (name === "chain-note") {
    const step = extra.step ?? counters.chain++ % 6;
    return engine.event({ name: "chain-note", step, count: 6, chain: "board", time: t });
  }
  if (name === "constellation") return engine.event({ name: "constellation", chain: extra.chain ?? "board", time: t });
  if (name === "tile-drop") return engine.play("tile-drop", { index: extra.index ?? counters.tile++ % 6 });
  if (name === "win") return engine.play("win", { earth: $("earth").checked, complete: true, chord: $("earth").checked ? CHORDS.Earth : CHORDS.Dadd9 });
  if (name === "fall") return engine.event({ name: "death", time: t });
  if (name === "respawn") return engine.event({ name: "respawn", time: t });
  return engine.play(name, { chord: chord(), ...extra });
}
function holdAir(air, seconds) {
  ready();
  engine.setAir(air);
  setTimeout(() => engine.setAir({}), seconds * 1000);
}
function card(parent, title, about, code, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "cue";
  b.innerHTML = "<strong></strong><span></span>" + (code ? "<code></code>" : "");
  b.querySelector("strong").textContent = title;
  b.querySelector("span").textContent = about;
  if (code) b.querySelector("code").textContent = code;
  b.addEventListener("click", async () => {
    b.classList.add("playing");
    try {
      await onClick();
    } finally {
      setTimeout(() => b.classList.remove("playing"), 160);
    }
  });
  parent.append(b);
  return b;
}

/* ---------- score voices over the chosen chord ---------- */
/** A representative note for each voice over chord c (the way the conductor
 * would voice it there). */
function sampleNote(name, c) {
  const r = rootIn(c, 62),
    fifth = safeAtOrAbove(c, r + 7),
    tones = chordTones(c, 74, 90);
  switch (name) {
    case "pad":
      return { midis: c.pad, dur: 4 * BEAT };
    case "choir":
      return { midis: chordTones(c, 55, 69).slice(-3), dur: 4 * BEAT };
    case "signal":
      return { midi: tones[0], dur: 1.2, pan: 0.6 };
    case "harmonica":
      return { midi: r, glideTo: fifth, glide: 0.38, dur: 0.6, pan: -0.25 };
    case "vowel":
      return { midi: fifth, dur: 0.7, pan: -0.25 };
    case "glass":
    case "kalimba":
    case "celesta":
      return { midi: tones[1] ?? tones[0] };
    case "bloom":
      return { midis: [rootIn(c, 50), ...chordTones(c, r, r + 14)], strum: 0.03, dur: 3 };
    case "chime":
      return { midis: [safeAtOrAbove(c, 81), safeAtOrAbove(c, 86)], strum: 0.14 };
    case "bass":
      return { midi: c.bass };
    case "marimba":
      return { midi: safeAtOrAbove(c, 69) };
    case "shards":
      return { midis: chordTones(c, 86, 98).concat(chordTones(c, 74, 85)).slice(0, 6), strum: 0.07 };
    case "dust":
      return { midis: c.root === 7 ? tones.slice(0, 4) : [...tones.slice(0, 3), 80], strum: 0.07, dur: 2.5 };
    default:
      return {};
  }
}
for (const name of VOICE_NAMES) {
  const v = VOICES[name];
  card($("voices"), v.label, v.about, `${name} · ${v.group}`, () => {
    ready();
    engine.voice(name, sampleNote(name, chord()));
    log(`${v.label} over ${chord().name}`);
  });
}

/* ---------- runs and stems, rendered offline from the real model ---------- */
const frameCache = new Map();
function frames(kind) {
  if (!frameCache.has(kind)) {
    const opts = { main: { route: "main" }, upper: { route: "upper" }, sloppy: { route: "main", ...SLOPPY } }[kind === "gentle" ? "sloppy" : kind];
    frameCache.set(kind, recordFrames(opts));
  }
  return frameCache.get(kind).frames;
}
async function renderRun({ kind = "main", from = 0, seconds = 20, only = null, cues = true, safety = true } = {}) {
  return renderRunOffline({ frames: frames(kind), from, seconds, only, cues, safety, gentle: kind === "gentle", seed: 3 });
}
async function playBuffer(buffer) {
  ready();
  const ctx = engine.context;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  playing.push(src);
  src.onended = () => (playing = playing.filter((s) => s !== src));
}
const RUNS = [
  ["Perfect run, bars 1-12", "The main route, every star on its beat: waking, the hops (the motif's head), the leap, the climb, Movement II begins", { kind: "main", from: 0, seconds: 27 }],
  ["Sloppy run, bars 1-12", "Same stretch with a broken constellation, late hops and a fall at the leap: the world drifts out of tune, then heals", { kind: "sloppy", from: 0, seconds: 30 }],
  ["Gentle music, sloppy run", "The same mistakes with Gentle music: rests and a fade, never a detune", { kind: "gentle", from: 0, seconds: 30 }],
  ["Fall and tape-stop", "The leap without a second jump: tape-stop, the last notes backwards, the respawn, the score back on the beacon's bar", { kind: "sloppy", from: 9, seconds: 9 }],
  ["Perfect run, Movement III", "Flights hold their vowels, the required constellation, the solar wind's rising runs (bars 25-31)", { kind: "main", from: 54, seconds: 16 }],
  ["Perfect door", "The finale, the Signal's whole theme and the completed song resolving at the door", { kind: "main", from: 70, seconds: 13 }],
  ["Mastery door, Earth is blue", "Three Great Stars: the Earth chord, the chapter's only sustained G#", { kind: "upper", from: 70, seconds: 13 }],
  ["Score only, bars 1-12", "The perfect run without any body sound: the music the player drew", { kind: "main", from: 0, seconds: 27, cues: false }],
];
for (const [title, about, opts] of RUNS)
  card($("runs"), title, about, null, async () => {
    log(`Rendering ${title}...`);
    const t0 = performance.now();
    const { buffer } = await renderRun(opts);
    log(`${title} (${opts.seconds} s, rendered in ${((performance.now() - t0) / 1000).toFixed(1)} s)`);
    await playBuffer(buffer);
  });
const STEMS = [
  ["sky", "Sky pad: the bed, never lost; only H detunes it", { kind: "main", from: 0, seconds: 20 }],
  ["signal", "The Signal: the motif's head every cycle, far right and nearer with progress", { kind: "main", from: 0, seconds: 20 }],
  ["pulse", "Heartbeat on 1 and 3, the shaker in II, the cascade's marimba", { kind: "main", from: 38, seconds: 12 }],
  ["steps", "Steps: every stable landing plays the root", { kind: "main", from: 0, seconds: 20 }],
  ["stars", "Stars: loose stars climb the chord, constellations play their phrases and bloom", { kind: "main", from: 3, seconds: 18 }],
  ["choir", "Choir: four bars after each completed constellation", { kind: "main", from: 6, seconds: 14 }],
  ["strings", "Strings: jumps, doubles, dives, cape vowels and the wind's runs", { kind: "main", from: 54, seconds: 14 }],
  ["glass", "Glass: the celesta arpeggio the lid smash earns (mastery line, II)", { kind: "upper", from: 38, seconds: 12 }],
  ["earth", "Earth: star dust and G# after a Great Star (mastery line)", { kind: "upper", from: 12, seconds: 10 }],
];
for (const [layer, about, opts] of STEMS)
  card($("stems"), layer[0].toUpperCase() + layer.slice(1), about, `layer ${layer}: ${LAYERS[layer].voices.join(", ")}`, async () => {
    log(`Rendering the ${layer} stem...`);
    const { buffer } = await renderRun({ ...opts, only: [layer], cues: false });
    log(`${layer} stem`);
    await playBuffer(buffer);
  });

/* ---------- body cue buttons ---------- */
const groups = $("groups");
for (const [group, title] of Object.entries(GROUPS)) {
  const names = [...CUE_NAMES.filter((n) => CUES[n].group === group), ...Object.keys(BEDS).filter((n) => BEDS[n].group === group)];
  if (!names.length) continue;
  const h = document.createElement("h2");
  h.textContent = title;
  const grid = document.createElement("div");
  grid.className = "grid";
  for (const name of names) {
    const def = CUES[name] ?? BEDS[name];
    card(grid, def.label, def.about, name, () => {
      if (BEDS[name]) holdAir(BEDS[name].air, BEDS[name].seconds);
      else fire(name);
      log(`${def.label} (${name})`);
    }).dataset.cue = name;
  }
  groups.append(h, grid);
}

/* ---------- sequences: body cues at game timings (270 px/s, 107 BPM) ---------- */
const SEQUENCES = {
  "Run, jump and fly": [
    [0, () => fire("jump")],
    [0.32, () => fire("double-jump")],
    [0.7, () => fire("cape")],
    [1.4, () => fire("land-soft")],
    [1.75, () => fire("jump")],
    [2.4, () => fire("land-soft")],
    [2.6, () => fire("refill")],
    [3.0, () => fire("jump")],
    [3.25, () => fire("cape")],
    [3.5, () => fire("super-jump")],
    [4.6, () => fire("land-hard")],
  ],
  "Crumbling shelf": [
    [0, () => fire("land-soft")],
    [0.01, () => fire("crumble-shake", { duration: 0.65 })],
    [0.5, () => fire("jump")],
    [0.66, () => fire("crumble-fall")],
  ],
  "Dive smash": [
    [0, () => fire("jump")],
    [0.45, () => fire("dive")],
    [0.62, () => fire("smash")],
    [0.95, () => fire("land-hard")],
  ],
  "Beat cascade (bodies)": [[0, () => fire("cascade")], ...[0, 1, 2, 3, 4, 5].map((index) => [0.6 + index * BEAT, () => fire("tile-drop", { index })])],
  "Solar wind": [
    [0, () => fire("cape")],
    [0.35, () => fire("wind-catch")],
    [0.36, () => holdAir({ wind: true }, 2.4)],
    [2.9, () => holdAir({ glide: true }, 1.3)],
    [4.3, () => fire("land-soft")],
  ],
  "Movement title": [[0, () => fire("movement")]],
  "The far door (body)": [[0, () => fire("win")]],
  "Pause freezes everything": [
    [0, () => fire("beacon")],
    [0.7, () => setPaused(true)],
    [2.2, () => setPaused(false)],
  ],
};
for (const [name, steps] of Object.entries(SEQUENCES)) {
  const span = Math.max(...steps.map((s) => s[0]));
  card($("sequences"), name, steps.length === 1 ? "one cue" : `${steps.length} cues over ${span.toFixed(1)} s`, null, () => {
    ready();
    log(name);
    for (const [at, run] of steps) setTimeout(run, at * 1000);
  });
}

/* ---------- mix controls ---------- */
let musicOn = false;
$("music").addEventListener("click", () => {
  ready();
  musicOn = !musicOn;
  if (musicOn) engine.playMusic({ fadeIn: 0.8 });
  else engine.stopMusic();
  $("music").setAttribute("aria-pressed", String(musicOn));
  $("music").textContent = musicOn ? "♫ Soundtrack on" : "♫ Soundtrack off";
});
function setPaused(p) {
  engine.setPaused(p);
  $("pause").setAttribute("aria-pressed", String(p));
  $("pause").textContent = p ? "Resume audio" : "Pause audio";
}
$("pause").addEventListener("click", () => {
  ready();
  setPaused(!engine.stats().paused);
});
$("stop").addEventListener("click", () => {
  for (const s of playing) {
    try {
      s.stop();
    } catch {
      /* ended */
    }
  }
  playing = [];
  engine.hush(0.05);
  log("Stopped");
});
const scratch = new Float32Array(2048);
let hold = 0;
function drawMeter() {
  meter.getFloatTimeDomainData(scratch);
  let peak = 0;
  for (const v of scratch) peak = Math.max(peak, Math.abs(v));
  hold = Math.max(peak, hold * 0.95);
  const db = 20 * Math.log10(hold || 1e-9);
  $("meter-bar").style.width = `${Math.max(0, Math.min(100, ((db + 48) / 48) * 100))}%`;
  $("meter-text").textContent = `${db < -90 ? "-inf" : db.toFixed(1)} dBFS`;
  requestAnimationFrame(drawMeter);
}

/* ---------- QA hooks (offline rendering) ---------- */
const toBase64 = (f32) => {
  const bytes = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const pack = (buffer) => ({
  sampleRate: buffer.sampleRate,
  length: buffer.length,
  channels: Array.from({ length: buffer.numberOfChannels }, (_, i) => toBase64(buffer.getChannelData(i))),
});
let track = null;
async function soundtrack(sampleRate) {
  if (!track) {
    const bytes = await (await fetch("./assets/soundtrack.mp3")).arrayBuffer();
    track = await new OfflineAudioContext(2, 1, sampleRate).decodeAudioData(bytes);
  }
  return track;
}
window.__soundboard = {
  cues: [...CUE_NAMES],
  voices: [...VOICE_NAMES],
  beds: Object.keys(BEDS),
  layers: Object.keys(LAYERS),
  meta: Object.fromEntries([...CUE_NAMES.map((n) => [n, { maxTail: CUES[n].maxTail, short: !!CUES[n].short, group: CUES[n].group }]), ...Object.keys(BEDS).map((n) => [n, { maxTail: BEDS[n].seconds + 2.6, short: false, group: "air" }])]),
  async render(name, { params = {}, safety = true, seed = 1 } = {}) {
    const { buffer, stats } = await renderCueOffline(name, { params, safety, seed });
    return { ...pack(buffer), nodes: stats.nodes };
  },
  /** A run of the adaptive score: kind main | sloppy | gentle | upper, the
   * excerpt [from, from + seconds) in wall seconds since waking; `only`
   * renders some layers (a stem); `cues: false` drops the body sounds. */
  async renderRun(opts = {}) {
    const { buffer, stats } = await renderRun(opts);
    return { ...pack(buffer), score: stats.score, nodes: stats.nodes };
  },
  /** Soundtrack (from `offset` s) through the engine's music path, with an
   * optional cue 0.5 s in: measures masking, ducking and summed peaks.
   * `music: false` renders the identical cue alone, for subtraction. */
  async renderWithMusic(name, { offset = 40, seconds = 6, params = {}, music = true } = {}) {
    const sr = 48000,
      t = await soundtrack(sr);
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
    const e = createAudioEngine({ context: ctx, seed: 1 });
    e.unlock();
    const src = ctx.createBufferSource();
    src.buffer = t;
    src.connect(e.musicInput());
    if (music) src.start(0, offset);
    if (name) e.play(name, { ...params, delay: 0.5 });
    return pack(await ctx.startRendering());
  },
  play: fire,
  voice: (name, chordName = "D") => engine.voice(name, sampleNote(name, CHORDS[chordName])),
  stats: () => engine.stats(),
};
