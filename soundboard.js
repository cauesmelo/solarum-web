/** Dev-only soundboard for audio.mjs and score.mjs (excluded from the itch.io
 * ZIP). Plays every body cue and every score voice through the game's own
 * engine, renders runs and stems of the adaptive score offline from the
 * real model and pilots, and exposes `window.__soundboard` so browser QA can
 * export WAVs and measure them. */
import { CUES, CUE_NAMES, BEDS, VOICES, VOICE_NAMES, BODY_BEFORE, createAudioEngine, renderCueOffline, renderRunOffline, MUSIC_LEVEL } from "./audio.mjs";
import { CHORDS, BEAT, chordTones, rootIn, safeAtOrAbove, LAYERS } from "./score.mjs";
import { recordFrames, SLOPPY_RUNS } from "./tests/music-run.mjs";
import { LEVELS } from "./level.mjs";
import { SCORES } from "./score.mjs";

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
// Runs, stems and A/B play the level picked here (RESEARCH_LEVELS 6: each
// level has its own groove, harmony, space and falls).
let runLevel = 2;
const levelSelect = $("level");
for (const d of LEVELS) {
  const o = document.createElement("option");
  o.value = String(d.id);
  o.textContent = `${d.numeral} · ${d.title} (${d.bpm} BPM, ${SCORES[d.id].groove})`;
  levelSelect.append(o);
}
levelSelect.value = String(runLevel);
levelSelect.addEventListener("change", () => (runLevel = Number(levelSelect.value)));
const frameCache = new Map();
function frames(kind, level = runLevel) {
  const key = `${level}:${kind}`;
  if (!frameCache.has(key)) {
    const opts = { main: { route: "main" }, upper: { route: "upper" }, sloppy: { route: "main", ...SLOPPY_RUNS[level] } }[kind === "gentle" ? "sloppy" : kind];
    frameCache.set(key, recordFrames({ ...opts, level }));
  }
  return frameCache.get(key).frames;
}
async function renderRun({ kind = "main", from = 0, seconds = 20, only = null, cues = true, safety = true, level = runLevel, mix = null } = {}) {
  const f = frames(kind, level);
  if (from === "fall") from = Math.max(0, (f.find((q) => q.status === "dead")?.wall ?? 3) - 3);
  else if (from < 0) from = Math.max(0, f.at(-1).wall + from);
  return renderRunOffline({ frames: f, from, seconds, only, cues, safety, gentle: kind === "gentle", seed: 3, level, mix });
}
/** ITU-R BS.1770-4 integrated loudness (K-weighting at 48 kHz, 400 ms blocks,
 * absolute and relative gates) and true sample peak of a rendered buffer. */
function loudness(buffer) {
  const sr = buffer.sampleRate;
  const stages = [
    [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
    [1, -2, 1, -1.99004745483398, 0.99007225036621],
  ];
  let peak = 0;
  const weighted = Array.from({ length: buffer.numberOfChannels }, (_, c) => {
    let x = buffer.getChannelData(c);
    for (const v of x) peak = Math.max(peak, Math.abs(v));
    for (const [b0, b1, b2, a1, a2] of stages) {
      const y = new Float32Array(x.length);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < x.length; i++) {
        const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        (x2 = x1), (x1 = x[i]), (y2 = y1), (y1 = v), (y[i] = v);
      }
      x = y;
    }
    return x;
  });
  const block = Math.round(0.4 * sr),
    hop = Math.round(0.1 * sr),
    z = [];
  for (let s = 0; s + block <= weighted[0].length; s += hop) {
    let sum = 0;
    for (const c of weighted) {
      let m = 0;
      for (let i = s; i < s + block; i++) m += c[i] * c[i];
      sum += m / block;
    }
    z.push(sum);
  }
  const L = (p) => -0.691 + 10 * Math.log10(p);
  const abs = z.filter((p) => L(p) > -70);
  const rel = abs.length ? L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10 : 0;
  const gated = abs.filter((p) => L(p) > rel);
  return { lufs: gated.length ? L(gated.reduce((a, b) => a + b, 0) / gated.length) : -Infinity, peak };
}
function showLoudness(title, buffer) {
  const { lufs, peak } = loudness(buffer);
  $("loudness").textContent = `${title}: ${lufs.toFixed(1)} LUFS, peak ${peak.toFixed(3)} (${(20 * Math.log10(peak)).toFixed(1)} dBFS)`;
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
// Excerpts in wall seconds since waking; a negative `from` counts back from
// the door, "fall" starts 3 s before the sloppy run's fall.
const RUNS = [
  ["Perfect run, first 27 s", "The main route, every star on its beat: the level's opening, its motif and first challenge", { kind: "main", from: 0, seconds: 27 }],
  ["Sloppy run, first 30 s", "Same stretch with a broken constellation, late jumps and a fall: the world drifts out of tune, then heals", { kind: "sloppy", from: 0, seconds: 30 }],
  ["Gentle music, sloppy run", "The same mistakes with Gentle music: rests and a fade, never a detune", { kind: "gentle", from: 0, seconds: 30 }],
  ["Fall and tape-stop", "The blocked challenge: tape-stop (L1 short, then backwards; L4's groove rests), the respawn, the score back on the beacon's bar", { kind: "sloppy", from: "fall", seconds: 9 }],
  ["Perfect door", "The level's close: the Signal's theme and the completed song resolving at the door (L4: the recording)", { kind: "main", from: -13, seconds: 13 }],
  ["Mastery door, Earth is blue", "Three Great Stars: the Earth chord, the only sustained G#", { kind: "upper", from: -13, seconds: 13 }],
  ["Score only, first 27 s", "The perfect run without any body sound: the music the player drew", { kind: "main", from: 0, seconds: 27, cues: false }],
];
// Each level's groove in context: two bars of its bed from bar 3, no body sounds.
for (const d of LEVELS) {
  const bar = (4 * 60) / d.bpm;
  RUNS.push([`Groove ${d.numeral}: ${d.title}`, `${SCORES[d.id].groove}: ${d.bpm} BPM, ${SCORES[d.id].space.seconds} s space, detune cap ${SCORES[d.id].maxFlat} cents`, { kind: "main", from: 2 * bar, seconds: 3 * bar, level: d.id, only: ["sky", "signal", "pulse"], cues: false }]);
}
for (const [title, about, opts] of RUNS)
  card($("runs"), title, about, null, async () => {
    log(`Rendering ${title}...`);
    const t0 = performance.now();
    const { buffer } = await renderRun(opts);
    log(`${title} (${opts.seconds} s, rendered in ${((performance.now() - t0) / 1000).toFixed(1)} s)`);
    showLoudness(title, buffer);
    await playBuffer(buffer);
  });
const STEMS = [
  ["sky", "Sky pad: the bed, never lost; only H detunes it", { kind: "main", from: 0, seconds: 20 }],
  ["signal", "The Signal: the motif's head every cycle, far right and nearer with progress", { kind: "main", from: 0, seconds: 20 }],
  ["pulse", "The level's groove: none in L1, heartbeat and shaker in L2, backbeat and tresillo in L3, four on the floor in L4", { kind: "main", from: 6, seconds: 12 }],
  ["steps", "Steps: every stable landing plays the root", { kind: "main", from: 0, seconds: 20 }],
  ["stars", "Stars: loose stars climb the chord, constellations play their phrases and bloom", { kind: "main", from: 3, seconds: 18 }],
  ["choir", "Choir: four bars after each completed constellation", { kind: "main", from: 6, seconds: 14 }],
  ["strings", "Strings: jumps, doubles, dives, cape vowels and the wind's runs", { kind: "main", from: 4, seconds: 14 }],
  ["glass", "Glass: the celesta arpeggio a lid smash earns (interim IV)", { kind: "main", from: 12, seconds: 12, level: 4 }],
  ["earth", "Earth: star dust and G# after a Great Star (mastery line)", { kind: "upper", from: 12, seconds: 10 }],
];
for (const [layer, about, opts] of STEMS)
  card($("stems"), layer[0].toUpperCase() + layer.slice(1), about, `layer ${layer}: ${LAYERS[layer].voices.join(", ")}`, async () => {
    log(`Rendering the ${layer} stem...`);
    const { buffer } = await renderRun({ ...opts, only: [layer], cues: false });
    log(`${layer} stem`);
    showLoudness(`${layer} stem`, buffer);
    await playBuffer(buffer);
  });

/* ---------- A/B: perfect and sloppy, sample-locked, switch while playing ---------- */
let ab = null,
  abLabels = ["A (perfect)", "B (sloppy)"];
async function startAB(button, renders, labels) {
  ready();
  if (ab) {
    for (const s of ab.sources) s.stop();
    const was = ab.button;
    ab = null;
    for (const id of ["ab", "ab-mix"]) $(id).setAttribute("aria-pressed", "false");
    $("ab-switch").disabled = true;
    if (was === button) return;
  }
  abLabels = labels;
  log(`Rendering ${labels.join(" and ")}...`);
  const [a, b] = await Promise.all(renders());
  const ctx = engine.context,
    at = ctx.currentTime + 0.1;
  const gains = [1, 0].map((v) => {
    const g = ctx.createGain();
    g.gain.value = v;
    g.connect(ctx.destination);
    return g;
  });
  const sources = [a.buffer, b.buffer].map((buf, i) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gains[i]);
    src.start(at);
    return src;
  });
  ab = { sources, gains, side: 0, button };
  sources[0].onended = () => ab && ab.sources[0] === sources[0] && $(button).click();
  $(button).setAttribute("aria-pressed", "true");
  $("ab-switch").disabled = false;
  $("ab-switch").textContent = `Now: ${labels[0]}`;
  const la = loudness(a.buffer),
    lb = loudness(b.buffer);
  $("loudness").textContent = `${labels[0]} ${la.lufs.toFixed(1)} LUFS · ${labels[1]} ${lb.lufs.toFixed(1)} LUFS`;
  log("A/B playing: switch at any time");
}
$("ab").addEventListener("click", () => startAB("ab", () => [renderRun({ kind: "main", from: 0, seconds: 27 }), renderRun({ kind: "sloppy", from: 0, seconds: 27 })], ["A (perfect)", "B (sloppy)"]));
// Revision seven (user: the background was "too full, too present, too
// loud"): the same perfect run through the revision-six mix and the new one.
$("ab-mix").addEventListener("click", () => startAB("ab-mix", () => [renderRun({ kind: "main", from: 0, seconds: 27, mix: "before" }), renderRun({ kind: "main", from: 0, seconds: 27 })], ["A (mix before)", "B (mix after)"]));
$("ab-switch").addEventListener("click", () => {
  if (!ab) return;
  ab.side = 1 - ab.side;
  const now = engine.context.currentTime;
  ab.gains.forEach((g, i) => {
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(i === ab.side ? 1 : 0, now + 0.03);
  });
  $("ab-switch").textContent = `Now: ${abLabels[ab.side]}`;
});

/* ---------- tuning value H: the bed against Diana's in-tune voice ---------- */
function setTuning() {
  ready();
  const m = engine.auditionTuning(Number($("tuning").value));
  $("tuning-out").textContent = `${m.H.toFixed(2)} · ${m.flatCents.toFixed(1)} ¢ flat, ${m.totalCents.toFixed(1)} ¢ max`;
}
$("tuning").addEventListener("input", setTuning);
$("hear-h").addEventListener("click", () => {
  setTuning();
  // A bed chord (follows H) under a player note on its root (always in tune).
  const c = chord();
  engine.voice("pad", sampleNote("pad", c));
  setTimeout(() => engine.voice("harmonica", { midi: rootIn(c, 74), dur: 2.2 }), 900);
  setTimeout(() => engine.voice("glass", { midi: chordTones(c, 74, 90)[1] }), 2000);
  log(`Bed at H ${Number($("tuning").value).toFixed(2)} over ${c.name}, with Diana's in-tune notes on top`);
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

/* ---------- A/B: the movement bodies before and after revision seven ----------
 * The user found the jump and landing sounds "too hard, clashing with the
 * atmosphere". Each pair plays the old recipe (BODY_BEFORE) and the soft one
 * through the same chain, with the same seed; the sequence plays a jump, a
 * double, a ledge catch and landings at game timings, over the score's
 * harmonica and felt bass when "with Diana's notes" is ticked. */
const beforeEngine = createAudioEngine({ enabled: true, seed: 7, cues: BODY_BEFORE });
const afterEngine = createAudioEngine({ enabled: true, seed: 7 });
const abVoices = () => $("ab-voices")?.checked;
function abPlay(which, name) {
  const e = which === "before" ? beforeEngine : afterEngine;
  e.unlock();
  ready();
  e.play(name, { chord: chord() });
  if (abVoices()) {
    const c = chord(),
      r = rootIn(c, 62);
    if (name === "jump") e.voice("harmonica", { midi: r, glideTo: safeAtOrAbove(c, r + 7), glide: 0.38, dur: 0.6, pan: -0.25 });
    if (name === "double-jump") e.voice("harmonica", { midi: safeAtOrAbove(c, r + 7), glideTo: safeAtOrAbove(c, r + 14), glide: 0.3, dur: 0.5, pan: -0.25 });
    if (name.startsWith("land")) e.voice("bass", { midi: c.bass });
  }
}
const AB_SEQ = [[0, "jump"], [0.34, "double-jump"], [0.95, "land-soft"], [1.3, "jump"], [1.78, "lip-catch"], [1.8, "land-soft"], [2.3, "jump"], [2.7, "dive"], [3.05, "land-hard"], [3.6, "super-jump"], [4.5, "land-soft"]];
for (const name of Object.keys(BODY_BEFORE)) {
  const row = document.createElement("div");
  row.className = "ab-row";
  const label = document.createElement("strong");
  label.textContent = CUES[name].label;
  row.append(label);
  for (const which of ["before", "after"]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ink";
    b.dataset.ab = `${which}:${name}`;
    b.textContent = which === "before" ? "Before" : "After";
    b.addEventListener("click", () => (abPlay(which, name), log(`${CUES[name].label}: ${which} (${which === "before" ? "revision six" : "revision seven"})`)));
    row.append(b);
  }
  $("body-ab")?.append(row);
}
for (const which of ["before", "after"]) {
  card($("body-ab-seq"), `Run of moves: ${which}`, which === "before" ? "Revision six bodies: felt thumps, ticks and pats" : "Revision seven bodies: breath, cloth and settling air", null, () => {
    for (const [at, name] of AB_SEQ) setTimeout(() => abPlay(which, name), at * 1000);
    log(`Run of moves, ${which}`);
  });
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
  async render(name, { params = {}, safety = true, seed = 1, before = false } = {}) {
    const { buffer, stats } = await renderCueOffline(name, { params, safety, seed, cues: before ? BODY_BEFORE : null });
    return { ...pack(buffer), nodes: stats.nodes };
  },
  bodyBefore: Object.keys(BODY_BEFORE),
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
  tuning: (H) => engine.auditionTuning(H),
  loudness: async (opts) => loudness((await renderRun(opts)).buffer),
  // opts.mix: "before" renders through the revision-six mix (A/B, README).
  stats: () => engine.stats(),
};
