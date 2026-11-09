import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CUES,
  CUE_NAMES,
  EVENT_NAMES,
  KEY,
  cuesForEvent,
  createAudioEngine,
  readSoundSetting,
  writeSoundSetting,
  inKey,
  penta,
  starMidi,
  nextStarStep,
  STAR_RESET,
  midiHz,
  mulberry32,
  karplusStrong,
  crackleSamples,
  noiseSamples,
  reverbImpulse,
  safetyCurve,
  layerEnd,
  envEnd,
} from "../audio.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");

/* ---------- a strict Web Audio stand-in ----------
 * It throws where the real API throws (non-finite values, negative times,
 * exponential ramps to zero), so a recipe that would fail in a browser fails
 * here too. Nodes are counted per context. */
function finite(...xs) {
  for (const x of xs) if (!Number.isFinite(x)) throw new TypeError(`non-finite ${x}`);
}
class Param {
  constructor(v = 0) {
    this._v = v;
    this.calls = 0;
  }
  get value() {
    return this._v;
  }
  set value(v) {
    finite(v);
    this._v = v;
  }
  #time(t) {
    finite(t);
    if (t < 0) throw new RangeError("negative time");
    this.calls++;
  }
  setValueAtTime(v, t) {
    finite(v);
    this.#time(t);
    this._v = v;
    return this;
  }
  linearRampToValueAtTime(v, t) {
    finite(v);
    this.#time(t);
    return this;
  }
  exponentialRampToValueAtTime(v, t) {
    finite(v);
    if (v === 0) throw new RangeError("exponential ramp to 0");
    this.#time(t);
    return this;
  }
  setTargetAtTime(v, t, tc) {
    finite(v, tc);
    this.#time(t);
    return this;
  }
  cancelScheduledValues(t) {
    this.#time(t);
    return this;
  }
}
class MockNode {
  constructor(ctx, kind) {
    this.ctx = ctx;
    this.kind = kind;
    this.outputs = [];
  }
  connect(target) {
    if (!target) throw new TypeError("connect to nothing");
    this.outputs.push(target);
    return target;
  }
  disconnect() {
    this.outputs = [];
  }
}
class MockSource extends MockNode {
  start(t = 0, offset = 0) {
    finite(t, offset);
    if (this.started) throw new Error("started twice");
    this.started = t;
  }
  stop(t = 0) {
    finite(t);
    if (this.started === undefined) throw new Error("stop before start");
    this.stopped = t;
  }
}
class MockContext {
  constructor() {
    this.sampleRate = 48000;
    this.currentTime = 0;
    this.state = "running";
    this.created = 0;
    this.destination = new MockNode(this, "destination");
  }
  #make(kind, Base, props) {
    this.created++;
    return Object.assign(new Base(this, kind), props);
  }
  createGain() {
    return this.#make("gain", MockNode, { gain: new Param(1) });
  }
  createOscillator() {
    return this.#make("osc", MockSource, { type: "sine", frequency: new Param(440), detune: new Param(0) });
  }
  createBufferSource() {
    return this.#make("buffer", MockSource, { buffer: null, loop: false, playbackRate: new Param(1) });
  }
  createBiquadFilter() {
    return this.#make("biquad", MockNode, { type: "lowpass", frequency: new Param(350), Q: new Param(1), gain: new Param(0) });
  }
  createDynamicsCompressor() {
    const p = () => new Param(0);
    return this.#make("comp", MockNode, { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p() });
  }
  createWaveShaper() {
    return this.#make("shaper", MockNode, { curve: null, oversample: "none" });
  }
  createConvolver() {
    return this.#make("convolver", MockNode, { buffer: null, normalize: true });
  }
  createStereoPanner() {
    return this.#make("panner", MockNode, { pan: new Param(0) });
  }
  createAnalyser() {
    return this.#make("analyser", MockNode, { fftSize: 2048 });
  }
  createMediaElementSource(el) {
    return this.#make("media", MockNode, { mediaElement: el });
  }
  createBuffer(channels, length, sampleRate) {
    finite(channels, length, sampleRate);
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, getChannelData: (i) => data[i] };
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
}
const mockMusic = () => ({
  paused: true,
  volume: 1,
  play() {
    this.paused = false;
    return Promise.resolve();
  },
  pause() {
    this.paused = true;
  },
});
function rig(options = {}) {
  let made = 0,
    last = null;
  class AC extends MockContext {
    constructor() {
      super();
      made++;
      last = this;
    }
  }
  const engine = createAudioEngine({ AudioContext: AC, seed: 3, ...options });
  return { engine, ctx: () => last, made: () => made };
}
// Representative payloads, as model.mjs emits them.
const SAMPLES = {
  "tile-drop": { platform: "tile-3" },
  land: { platform: "p1", hard: false },
  "chain-note": { chain: "c1", step: 2, count: 5 },
  constellation: { chain: "c1" },
  refill: { source: "ground" },
  checkpoint: { id: "leap", index: 0 },
  movement: { id: "II" },
  death: { fallsHere: 1 },
  respawn: { source: "beacon" },
  win: { earth: true },
};
const event = (name, time = 1) => ({ name, time, x: 0, y: 0, serial: 1, ...SAMPLES[name] });
const PARAM_VARIANTS = [{}, { step: 0 }, { step: 7 }, { step: 23 }, { index: 0 }, { index: 5 }, { count: 4 }, { count: 6 }, { earth: true }, { duration: 0.2 }, { duration: 1.5 }];
function* everySpec() {
  for (const seed of [1, 2, 99]) {
    const rng = mulberry32(seed);
    for (const name of CUE_NAMES) for (const params of PARAM_VARIANTS) yield [name, params, CUES[name].build(rng, params)];
  }
}

/* ---------- settings ---------- */
test("sound defaults to on: empty storage, missing storage and throwing storage all read as on", () => {
  assert.equal(readSoundSetting({ getItem: () => null }), true, "empty storage");
  assert.equal(readSoundSetting(undefined), true, "no storage");
  assert.equal(readSoundSetting(() => undefined), true, "getter returns nothing");
  assert.equal(
    readSoundSetting(() => {
      throw new DOMException("blocked", "SecurityError"); // sandboxed iframe
    }),
    true,
    "storage access throws",
  );
  assert.equal(
    readSoundSetting({
      getItem() {
        throw new Error("quota / privacy mode");
      },
    }),
    true,
    "getItem throws",
  );
  assert.equal(readSoundSetting({ getItem: () => "on" }), true);
  assert.equal(readSoundSetting({ getItem: () => "off" }), false, "only an explicit off turns it off");
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(writeSoundSetting(storage, false), true);
  assert.equal(readSoundSetting(storage), false);
  writeSoundSetting(storage, true);
  assert.equal(readSoundSetting(storage), true);
  assert.equal(
    writeSoundSetting({
      setItem() {
        throw new Error("blocked");
      },
    }, false),
    false,
    "a blocked write is swallowed",
  );
});
test("the game reads the default through the guarded setting and starts audio only on a gesture", async () => {
  const js = await read("game.js");
  assert.match(js, /on: readSoundSetting\(\(\) => window\.localStorage\)/);
  assert.match(js, /createAudioEngine\(\{ enabled: sound\.on \}\)/);
  assert.doesNotMatch(js, /new \(window\.AudioContext/, "only audio.mjs creates the context");
  // unlock() runs from wake() and the sound toggle, never at load.
  const load = js.slice(js.indexOf("async function load()"));
  assert.doesNotMatch(load.slice(0, load.indexOf("resize();\nload();")), /unlockAudio\(\)|audio\.unlock\(\)/);
  assert.match(js.slice(js.indexOf("function wake()"), js.indexOf("function doJump()")), /unlockAudio\(\);/);
});

/* ---------- coverage ---------- */
test("every event name model.mjs emits maps to at least one cue", async () => {
  const model = await read("model.mjs");
  const emitted = new Set();
  for (const m of model.matchAll(/\bevent\(s,\s*([^,)]+)/g)) for (const q of m[1].matchAll(/"([a-z-]+)"/g)) emitted.add(q[1]);
  assert.ok(emitted.size >= 20, `found ${emitted.size} events`);
  assert.deepEqual([...emitted].sort(), [...EVENT_NAMES].sort(), "EVENT_NAMES matches the simulation");
  for (const name of emitted) {
    const cues = cuesForEvent(event(name));
    assert.ok(cues.length >= 1, name);
    for (const c of cues) assert.ok(CUES[c.cue], `${name} -> ${c.cue}`);
  }
  // Land splits by impact; refills from a beacon or a constellation are
  // voiced inside those cues instead of stacking a second sound.
  assert.equal(cuesForEvent({ name: "land", hard: true })[0].cue, "land-hard");
  assert.equal(cuesForEvent({ name: "land", hard: false })[0].cue, "land-soft");
  assert.equal(cuesForEvent({ name: "refill", source: "net" })[0].cue, "refill");
  assert.deepEqual(cuesForEvent({ name: "refill", source: "beacon" }), []);
  assert.deepEqual(cuesForEvent({ name: "refill", source: "constellation" }), []);
  assert.equal(cuesForEvent({ name: "tile-drop", platform: "tile-4" })[0].params.index, 4);
  const js = await read("game.js");
  assert.match(js, /if \(loud\) audio\.event\(e\);/, "processEvents voices every event");
  assert.doesNotMatch(js, /\bsfx\(/, "no pitch-shifted WAV calls remain");
  // Presentation-only cues the renderer triggers directly.
  for (const cue of ["crumble-shake", "crumble-fall", "ui-hover", "ui-select", "ui-resume"]) assert.match(js, new RegExp(`audio\\.play\\("${cue}"`), cue);
});

/* ---------- recipes ---------- */
test("every recipe produces finite, bounded parameters and well-formed envelopes", () => {
  let checked = 0;
  for (const [name, params, spec] of everySpec()) {
    const where = `${name} ${JSON.stringify(params)}`;
    assert.ok(spec.gain > 0 && spec.gain <= 1, `${where} gain`);
    assert.ok(spec.send >= 0 && spec.send <= 0.6, `${where} send`);
    assert.ok(Number.isFinite(spec.dur) && spec.dur > 0 && spec.dur <= 6, `${where} dur ${spec.dur}`);
    if (CUES[name].short) assert.ok(spec.dur < 0.6, `${where} is a short cue but lasts ${spec.dur.toFixed(3)} s`);
    assert.ok(spec.dur <= CUES[name].maxTail, `${where} longer than its bound`);
    for (const L of spec.layers) {
      assert.ok(L.gain > 0 && L.gain <= 0.6, `${where} layer gain ${L.gain}`);
      assert.ok(L.at >= 0 && Number.isFinite(layerEnd(L)), `${where} timing`);
      for (const pts of [L.env, L.freq, L.index, Array.isArray(L.filter?.freq) ? L.filter.freq : null].filter(Boolean)) {
        assert.equal(pts[0][0], 0, `${where} automation starts at 0`);
        for (let i = 0; i < pts.length; i++) {
          assert.ok(Number.isFinite(pts[i][0]) && Number.isFinite(pts[i][1]), `${where} point`);
          if (i) assert.ok(pts[i][0] >= pts[i - 1][0], `${where} time order`);
        }
      }
      if (L.env) for (const [, v] of L.env) assert.ok(v >= 0 && v <= 1, `${where} env value ${v}`);
      const hz = [...(L.freq ?? []).map((p) => p[1]), L.hz, L.kind === "fm" ? L.hz * L.ratio : null].filter((v) => v != null);
      for (const f of hz) assert.ok(f >= 20 && f <= 16000, `${where} frequency ${f}`);
      const filterHz = Array.isArray(L.filter?.freq) ? L.filter.freq.map((p) => p[1]) : L.filter ? [L.filter.freq] : [];
      for (const f of filterHz) assert.ok(f >= 40 && f <= 16000 && L.filter.q > 0, `${where} filter`);
      if (L.kind === "crackle") assert.ok(L.dur > 0 && L.from > 0 && L.to > 0 && L.grain > 0);
      if (L.kind === "pluck") assert.ok(L.t60 > 0.1 && L.t60 < 3 && L.bright >= 0 && L.bright <= 1);
      checked++;
    }
  }
  assert.ok(checked > 1000, `${checked} layers`);
  // The same recipes through a strict API stand-in: nothing throws and each
  // cue really schedules something.
  const { engine, ctx } = rig();
  engine.unlock();
  for (const name of CUE_NAMES) {
    ctx().currentTime += 1;
    assert.ok(engine.play(name, { step: 3, index: 2, count: 5, earth: true, duration: 0.65 }), name);
  }
  assert.deepEqual(Object.keys(engine.stats().played).sort(), [...CUE_NAMES].sort());
});
test("every pitched note sits in D major; melodies stay pentatonic; plucks are tuned", () => {
  assert.equal(KEY.name, "D major");
  for (const [name, , spec] of everySpec()) {
    for (const L of spec.layers.filter((l) => l.tonal)) {
      assert.ok(inKey(L.midi), `${name}: midi ${L.midi} is outside D major`);
      if (L.midiEnd != null) assert.ok(inKey(L.midiEnd), `${name}: glide target ${L.midiEnd}`);
      // Single notes wander at most 3 cents; pad pairs detune up to 8 for chorus.
      assert.ok(Math.abs(L.cents) <= 8, `${name}: ${L.cents} cents`);
    }
  }
  const pentatonicClasses = new Set(KEY.pentatonic.map((d) => (KEY.tonic + d) % 12));
  for (let step = 0; step < 30; step++) {
    assert.ok(pentatonicClasses.has(starMidi(step) % 12), `star step ${step}`);
    assert.ok(starMidi(step) >= 74 && starMidi(step) <= 90, "D5 to F#6, never shrill");
  }
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((s) => penta(s)), [74, 76, 78, 81, 83, 86]); // D5 E5 F#5 A5 B5 D6
  // Successive stars climb; a pause or a rewind (respawn) restarts the run.
  let m = null;
  const steps = [0, 0.3, 0.6, 0.9, 0.9 + STAR_RESET + 0.01, 2.6, 1.0].map((time) => (m = nextStarStep(m, time)).step);
  assert.deepEqual(steps, [0, 1, 2, 3, 0, 1, 0]);
  // Karplus-Strong pitch by autocorrelation: within 4 cents for D4..D6.
  for (const midi of [62, 69, 74, 78, 81, 86]) {
    const hz = midiHz(midi),
      x = karplusStrong(48000, hz, { t60: 0.9 });
    const from = 2400,
      n = 4096;
    const ac = (lag) => {
      let s = 0;
      for (let i = from; i < from + n; i++) s += x[i] * x[i + lag];
      return s;
    };
    const guess = Math.round(48000 / hz);
    let best = guess;
    for (let lag = guess - 3; lag <= guess + 3; lag++) if (ac(lag) > ac(best)) best = lag;
    const [a, b, c] = [ac(best - 1), ac(best), ac(best + 1)];
    const period = best + (0.5 * (a - c)) / (a - 2 * b + c);
    const cents = 1200 * Math.log2(48000 / period / hz);
    assert.ok(Math.abs(cents) < 4, `pluck midi ${midi}: ${cents.toFixed(2)} cents`);
    assert.ok(x.every(Number.isFinite) && Math.max(...x.map(Math.abs)) <= 1.0001);
  }
});
test("generated buffers are finite and bounded; the reverb decays; the safety curve never clips", () => {
  const rng = mulberry32(4);
  for (const color of ["white", "pink", "brown"]) {
    const x = noiseSamples(8000, 1, color, rng);
    assert.ok(x.every((v) => Number.isFinite(v) && Math.abs(v) <= 1.0001), color);
  }
  const c = crackleSamples(48000, 0.65, rng, { from: 18, to: 120, rise: [0.25, 1] });
  assert.ok(c.every((v) => Number.isFinite(v) && Math.abs(v) <= 1));
  const rms = (a, b) => Math.sqrt(c.slice(a, b).reduce((s, v) => s + v * v, 0) / (b - a));
  assert.ok(rms(c.length * 0.75, c.length) > rms(0, c.length * 0.25), "a shaking shelf's crackle builds");
  const [L, R] = reverbImpulse(24000, 2.4, mulberry32(2));
  for (const ch of [L, R]) {
    assert.ok(ch.every(Number.isFinite));
    const energy = ch.reduce((s, v) => s + v * v, 0);
    assert.ok(Math.abs(energy - 1) < 1e-3, "energy-normalised");
    const head = ch.slice(0, ch.length / 10).reduce((s, v) => s + v * v, 0),
      tail = ch.slice((ch.length * 9) / 10).reduce((s, v) => s + v * v, 0);
    assert.ok(tail < head * 1e-4, "the tail has decayed by more than 40 dB");
  }
  assert.notDeepEqual(L.slice(1000, 1010), R.slice(1000, 1010), "stereo impulse is decorrelated");
  const curve = safetyCurve();
  assert.ok(curve.every((v) => Math.abs(v) <= 0.89 + 1e-6));
  for (let i = 1; i < curve.length; i++) assert.ok(curve[i] >= curve[i - 1], "monotonic");
  const mid = (curve.length - 1) / 2;
  assert.ok(Math.abs(curve[Math.round(mid + 0.5 * mid)] - 0.5) < 1e-3, "transparent at 0.5");
});

/* ---------- engine behaviour ---------- */
test("the voice and rate limiters cap rapid star pickups", () => {
  const { engine, ctx } = rig();
  engine.unlock();
  let concurrent = 0;
  // 40 pickups 10 ms apart: most fall inside the 45 ms rate gate.
  for (let i = 0; i < 40; i++) {
    ctx().currentTime += 0.01;
    engine.event(event("star", i * 0.01));
    concurrent = Math.max(concurrent, engine.stats().voices);
  }
  let s = engine.stats();
  assert.ok(concurrent <= CUES.star.limit, `${concurrent} star voices`);
  assert.ok(s.dropped >= 25, `${s.dropped} dropped`);
  assert.ok(s.played.star <= 10);
  // 40 pickups 60 ms apart all sound, but never more than four at once.
  const r = rig();
  r.engine.unlock();
  concurrent = 0;
  for (let i = 0; i < 40; i++) {
    r.ctx().currentTime += 0.06;
    r.engine.event(event("star", i * 0.06));
    concurrent = Math.max(concurrent, r.engine.stats().voices);
  }
  s = r.engine.stats();
  assert.equal(s.played.star, 40);
  assert.ok(concurrent <= CUES.star.limit, `${concurrent} star voices`);
  // Everything at once: the global cap holds.
  const g = rig();
  g.engine.unlock();
  for (let k = 0; k < 4; k++)
    for (const name of CUE_NAMES) {
      g.ctx().currentTime += 0.2;
      g.engine.play(name);
    }
  assert.ok(g.engine.stats().peakVoices <= 20, `${g.engine.stats().peakVoices} voices`);
  // Finished voices are released (their nodes disconnected and forgotten).
  g.ctx().currentTime += 30;
  assert.equal(g.engine.stats().voices, 0);
});
test("sound off creates no context and no nodes; switching off later stops creating nodes", () => {
  const off = rig({ enabled: false });
  off.engine.attachMusic(mockMusic());
  assert.equal(off.engine.unlock(), false);
  for (const name of EVENT_NAMES) off.engine.event(event(name));
  for (const name of CUE_NAMES) assert.equal(off.engine.play(name), null);
  off.engine.setAir({ wind: true });
  off.engine.playMusic();
  assert.equal(off.made(), 0, "no AudioContext");
  assert.equal(off.engine.stats().nodes, 0);
  assert.equal(off.engine.stats().musicPlaying, false);

  const on = rig();
  const music = mockMusic();
  on.engine.attachMusic(music);
  on.engine.unlock();
  on.engine.playMusic();
  on.engine.play("beacon");
  on.engine.setAir({ wind: true });
  on.engine.setEnabled(false);
  assert.equal(music.paused, true);
  assert.equal(on.engine.stats().air, null, "the wind bed is torn down");
  const before = on.ctx().created;
  for (const name of EVENT_NAMES) on.engine.event(event(name));
  for (const name of CUE_NAMES) on.engine.play(name);
  on.engine.setAir({ wind: true, glide: true });
  assert.equal(on.ctx().created, before, "no nodes while off");
});
test("pausing suspends the context and the music; nothing starts or piles up until resume", () => {
  const { engine, ctx } = rig();
  const music = mockMusic();
  engine.attachMusic(music);
  engine.unlock();
  engine.playMusic({ fadeIn: 1 });
  const bloom = engine.play("beacon");
  engine.setAir({ wind: true });
  let s = engine.stats();
  assert.equal(s.state, "running");
  assert.equal(s.musicPlaying, true);
  assert.equal(s.musicRouted, true);
  engine.setPaused(true);
  s = engine.stats();
  assert.equal(s.paused, true);
  assert.equal(s.suspended, true);
  assert.equal(ctx().state, "suspended");
  assert.equal(s.musicPlaying, false);
  const nodes = ctx().created;
  assert.equal(engine.play("star"), null);
  assert.deepEqual(engine.event(event("jump")), []);
  engine.setAir({ wind: false });
  assert.equal(engine.stats().air.wind, true, "the wind bed is frozen in place, not faded or restarted");
  engine.duck(6);
  // Toggling sound while paused (the pause card) must not wake the mix.
  engine.setEnabled(false);
  engine.setEnabled(true);
  assert.equal(ctx().state, "suspended");
  assert.equal(music.paused, true);
  assert.equal(ctx().created, nodes, "nothing new while paused");
  engine.setPaused(false);
  s = engine.stats();
  assert.equal(s.state, "running");
  assert.equal(s.suspended, false);
  assert.equal(s.musicPlaying, true);
  assert.equal(s.played.beacon, 1, "no queued sounds replay on resume");
  assert.equal(s.played.star, undefined);
  assert.ok(bloom.end > ctx().currentTime, "the bloom's tail continues where it froze");
  assert.ok(engine.play("star"), "plays again after resume");
  // A context first created during a pause stays frozen until Continue.
  const late = rig();
  late.engine.setPaused(true);
  late.engine.unlock();
  assert.equal(late.ctx().state, "suspended");
  assert.equal(late.engine.play("jump"), null);
});
test("music ducks under key moments and darkens during a fall", () => {
  const { engine, ctx } = rig();
  engine.attachMusic(mockMusic());
  engine.unlock();
  for (const cue of ["constellation", "great-star", "beacon", "win", "movement", "fall"]) assert.ok(CUES[cue].duck?.[0] > 0, cue);
  for (const cue of ["star", "jump", "land-soft", "chain-note"]) assert.equal(CUES[cue].duck, undefined, `${cue} must not pump the music`);
  engine.event(event("death"));
  assert.equal(engine.stats().musicDark, true);
  ctx().currentTime += 1;
  engine.event(event("respawn"));
  assert.equal(engine.stats().musicDark, false);
});
test("a missing AudioContext is silence, never an error", () => {
  const engine = createAudioEngine({ AudioContext: null });
  const saved = globalThis.AudioContext;
  delete globalThis.AudioContext;
  try {
    assert.equal(engine.unlock(), false);
    assert.equal(engine.play("star"), null);
    assert.deepEqual(engine.event(event("win")), []);
    engine.setAir({ wind: true });
    engine.setPaused(true);
    engine.setPaused(false);
    assert.equal(engine.stats().unlocked, false);
  } finally {
    if (saved) globalThis.AudioContext = saved;
  }
  class Broken {
    constructor() {
      throw new Error("no device");
    }
  }
  const broken = createAudioEngine({ AudioContext: Broken });
  assert.equal(broken.unlock(), false);
  assert.equal(broken.play("jump"), null);
});

/* ---------- packaging ---------- */
test("the itch ZIP ships audio.js but not the soundboard, WAV renders or the archived WAVs", async () => {
  execFileSync(process.execPath, ["package-itch.mjs"], { cwd: root });
  const report = JSON.parse(await readFile(new URL("../dist/build-report.json", import.meta.url), "utf8"));
  const names = report.entries.map((e) => e.name);
  assert.ok(names.includes("audio.js"));
  assert.ok(names.includes("assets/soundtrack.mp3"));
  for (const n of names) {
    assert.doesNotMatch(n, /soundboard/, n);
    assert.doesNotMatch(n, /\.wav$/i, n);
  }
  const game = await readFile(new URL("../dist/itch/game.js", import.meta.url), "utf8");
  assert.match(game, /from "\.\/audio\.js"/);
});
