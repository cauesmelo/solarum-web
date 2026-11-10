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
  pitchClass,
} from "../audio.mjs";
import { createGame, start as startGame, update, jump, releaseJump, dash, dive } from "../model.mjs";
import { createRouteMemory, chooseAction } from "./routes.mjs";

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
  setValueCurveAtTime(values, t, duration) {
    for (const v of values) finite(v);
    finite(duration);
    if (!(duration > 0)) throw new RangeError("curve duration");
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
    // A source started before "now" would be truncated in a browser.
    if (t > 0 && t < this.ctx.now() - 1e-9) this.ctx.past.push({ kind: this.kind, t, now: this.ctx.now() });
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
    this.past = [];
    this.clock = null; // a fake engine clock, when the test drives one
    this.destination = new MockNode(this, "destination");
  }
  now() {
    return this.clock ? this.clock() : this.currentTime;
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
  createDelay(max = 1) {
    finite(max);
    return this.#make("delay", MockNode, { delayTime: new Param(0), maxDelayTime: max });
  }
  createConstantSource() {
    return this.#make("constant", MockSource, { offset: new Param(1) });
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
  // pauseFade 0: the strict mock has no timers, so pausing suspends at once
  // (the fade itself is tested separately).
  const engine = createAudioEngine({ AudioContext: AC, seed: 3, pauseFade: 0, ...options });
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
  assert.match(js, /createAudioEngine\(\{ enabled: sound\.on, gentle: sound\.gentle/);
  assert.match(js, /gentle: readGentleSetting\(\(\) => window\.localStorage\)/, "Gentle music is read through guarded storage too");
  assert.doesNotMatch(js, /new \(window\.AudioContext/, "only audio.mjs creates the context");
  // unlock() (resume, route the soundtrack) runs from the wake press and the
  // sound toggle, never at load; load may only warm up a suspended graph.
  const load = js.slice(js.indexOf("async function load()"));
  assert.doesNotMatch(load.slice(0, load.indexOf("resize();\nload();")), /unlockAudio\(\)|audio\.unlock\(\)/);
  assert.match(js.slice(js.indexOf("function wake()"), js.indexOf("function doJump()")), /unlockAudio\(\);/);
  assert.match(js.slice(js.indexOf("function pressWake()"), js.indexOf("function doJump()")), /unlockAudio\(\); \/\/ inside the gesture/);
  assert.match(load, /if \(sound\.on\) setTimeout\(\(\) => audio\.prepare\(\), 400\);/);
});
test("prepare() warms a suspended context and the whole graph step by step; unlock() then only resumes", async () => {
  const steps = [];
  const r = rig();
  const done = r.engine.prepare({ step: (fn) => steps.push(fn) });
  while (steps.length) steps.shift()();
  assert.equal(await done, true);
  assert.equal(r.made(), 1);
  const ctx = r.ctx();
  ctx.state = "suspended"; // as a browser leaves a context made without a gesture
  const nodes = r.engine.stats().nodes;
  assert.ok(nodes > 40, `${nodes} nodes prepared`);
  assert.deepEqual(r.engine.stats().decoded.filter((n) => ["impulse", "space", "white", "pink", "brown"].includes(n)).sort(), ["brown", "impulse", "pink", "space", "white"]);
  assert.equal(r.engine.unlock(), true);
  assert.equal(r.made(), 1, "unlock reuses the warm context");
  assert.equal(r.engine.stats().nodes, nodes + 0, "and builds nothing new");
  // Identical buffers either way (one seeded rng, same order).
  const cold = rig();
  cold.engine.unlock();
  assert.equal(cold.engine.stats().nodes, nodes);
  // Sound off: no warm-up at all.
  const off = rig({ enabled: false });
  assert.equal(await off.engine.prepare({ step: (fn) => fn() }), false);
  assert.equal(off.made(), 0);
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
  assert.match(js, /audio\.event\(e, \{ render: loud, timeScale: simScale\(\) \}\);/, "processEvents voices every event (and quiet steps still tell the score)");
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
  for (const [name, params, spec] of everySpec()) {
    for (const L of spec.layers.filter((l) => l.tonal)) {
      // G# is the musical blue: only the door's Earth chord may sound it.
      if (name === "win" && params.earth && pitchClass(L.midi) === 8) continue;
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

/* ---------- the adaptive score through the engine ---------- */
/** Play a route through the real engine at 60 frames per second on a fake
 * audio clock, the way game.js drives it (events, then one scoreFrame). */
// L3 by default: every layer of the bed (backbeat, tresillo marimba, the
// smash's celesta) at 118 BPM, so the audio clock runs at 1/clock of the
// simulation's, as in the game.
function scoreRun({ route = "main", gentle = false, pauseAt = null, enabled = true, level = 3 } = {}) {
  let now = 0;
  const r = rig({ gentle, enabled, level, clock: () => now });
  const music = mockMusic();
  r.engine.attachMusic(music);
  const s = createGame(2021, { level });
  let seen = s.eventSerial;
  const flush = () => {
    for (const e of s.events) if (e.serial > seen) (seen = e.serial), r.engine.event(e, { timeScale: s.clock });
  };
  r.engine.unlock();
  if (r.ctx()) r.ctx().clock = () => now;
  startGame(s);
  flush();
  const m = createRouteMemory(route);
  const clock = s.clock;
  const dt = clock / 60; // simulation seconds per 60 Hz frame
  const pauses = [];
  for (let i = 0; i < 100 / dt && s.status !== "won"; i++) {
    if (pauseAt != null && s.time >= pauseAt && !pauses.length) {
      // Pause: the context suspends; the game keeps calling scoreFrame with a
      // frozen simulation while (in this fake) wall time moves on.
      r.engine.setPaused(true);
      const before = { nodes: r.engine.stats().nodes, scheduled: r.engine.stats().score.scheduled, pos: r.engine.conductor.transport.pos(s.time) };
      for (let k = 0; k < 60; k++) {
        r.engine.scoreFrame({ simTime: s.time, x: s.player.x, y: s.player.y, status: "paused", timeScale: clock });
        r.engine.event({ name: "star", time: s.time, id: "x" });
      }
      const after = { nodes: r.engine.stats().nodes, scheduled: r.engine.stats().score.scheduled, pos: r.engine.conductor.transport.pos(s.time) };
      pauses.push({ before, after, audio: r.engine.stats() });
      r.engine.setPaused(false);
    }
    const a = chooseAction(s, m);
    if (a) ({ jump, releaseJump, dash, dive, tap: (g) => (jump(g), releaseJump(g)) })[a](s), flush();
    update(s, dt, { glide: m.glide });
    now += 1 / 60;
    if (r.ctx()) r.ctx().currentTime = now;
    flush();
    r.engine.scoreFrame({ simTime: s.time, x: s.player.x, y: s.player.y, status: s.status, timeScale: clock, inWind: s.player.inWind, gliding: s.player.gliding, fallsHere: s.fallsHere });
  }
  return { ...r, s, pauses, stats: r.engine.stats() };
}
test("the score plays a whole run on the audio clock: never in the past, caps and voice budget hold, the song completes", () => {
  const run = scoreRun();
  assert.equal(run.s.status, "won");
  const sc = run.stats.score;
  assert.ok(sc.scheduled > 500, `${sc.scheduled} score notes scheduled`);
  assert.ok(sc.peakVoices <= 28, `${sc.peakVoices} score voices at once`);
  assert.ok(run.stats.peakVoices <= 20);
  assert.ok(sc.maxQuantizeMs <= 140, `${sc.maxQuantizeMs} ms`);
  assert.deepEqual(run.ctx().past, [], "no source starts before the audio clock");
  assert.equal(sc.song.complete, true);
  assert.equal(sc.H, 1);
  assert.equal(sc.detuneCents, 0);
  assert.equal(sc.tapeStops, 0);
  for (const voice of ["pad", "signal", "pulse", "bass", "glass", "kalimba", "choir", "harmonica", "vowel", "chime", "marimba"]) assert.ok(sc.played[voice] > 0, `${voice} played`);
  assert.ok(run.stats.decoded.includes("space"), "the space reverb was generated");
  // The door: the soundtrack is due two bars later (a timer in the browser).
  assert.equal(sc.door.complete, true);
});
test("pausing freezes the score: no scheduling, no nodes, the transport holds, and it continues in place", () => {
  const run = scoreRun({ pauseAt: 20 });
  assert.equal(run.pauses.length, 1);
  const [p] = run.pauses;
  assert.equal(p.after.nodes, p.before.nodes, "nothing new while paused");
  assert.equal(p.after.scheduled, p.before.scheduled);
  assert.equal(p.after.pos, p.before.pos, "the transport is frozen with the simulation");
  assert.equal(p.audio.paused, true);
  assert.equal(p.audio.musicPlaying, false, "neither the soundtrack nor the score plays while paused");
  assert.equal(run.s.status, "won");
  assert.equal(run.stats.score.song.complete, true, "the song survives a pause intact");
});
test("with sound off the score keeps its place without any context or node; Gentle music never moves the detune bus", () => {
  const off = scoreRun({ enabled: false });
  assert.equal(off.made(), 0, "no AudioContext");
  assert.equal(off.stats.nodes, 0);
  assert.equal(off.stats.score.song.complete, true, "the conductor still followed the run");
  const gentle = scoreRun({ gentle: true });
  assert.equal(gentle.stats.score.gentle, true);
  assert.equal(gentle.stats.score.detuneCents, 0);
  assert.equal(gentle.stats.score.H, 1);
});

test("pausing fades out over 15 ms before suspending and fades back in after resuming (no click)", async () => {
  const { engine, ctx } = rig({ pauseFade: 0.015 });
  const music = mockMusic();
  engine.attachMusic(music);
  engine.unlock();
  engine.playMusic();
  engine.setPaused(true);
  assert.equal(engine.play("star"), null, "nothing new starts once paused");
  assert.equal(ctx().state, "running", "still fading");
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(ctx().state, "suspended");
  assert.equal(music.paused, true);
  engine.setPaused(false);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(ctx().state, "running");
  // Resuming quickly cancels a pending suspend.
  engine.setPaused(true);
  engine.setPaused(false);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(ctx().state, "running");
});

/* ---------- revision seven: soft movement bodies ---------- */
test("movement bodies are breath, cloth and air: no thump, grain or tick, every attack at least 12 ms", async () => {
  const { BODY_BEFORE } = await import("../audio.mjs");
  const soft = ["jump", "double-jump", "land-soft", "land-hard", "lip-catch", "super-jump", "dive", "emerge"];
  const attack = (L) => (L.env ? L.env[1][0] : Infinity);
  for (const name of soft)
    for (let seed = 1; seed <= 5; seed++) {
      const spec = CUES[name].build(mulberry32(seed), {});
      for (const L of spec.layers) {
        assert.equal(L.kind, "noise", `${name}: only filtered noise (no sine thump, no crackle grains)`);
        assert.notEqual(L.color, "white", `${name}: no white noise`);
        assert.ok(attack(L) >= 0.012, `${name}: attack ${attack(L)} s`);
        const f = L.filter.freq,
          top = Array.isArray(f) ? Math.max(...f.map((p) => p[1])) : f;
        assert.ok(top <= 5000, `${name}: filter at ${top} Hz`);
      }
    }
  // The A/B keeps the old recipes, which did have the hard parts.
  const old = (name) => BODY_BEFORE[name].build(mulberry32(1), {}).layers;
  assert.ok(old("jump").some((L) => L.kind === "tone" && !L.tonal), "the old jump had a thump");
  assert.ok(old("land-soft").some((L) => attack(L) < 0.005), "the old landing had a 2 ms attack");
  assert.ok(old("super-jump").some((L) => L.kind === "crackle"), "the old super jump had a crackle trail");
  assert.deepEqual(Object.keys(BODY_BEFORE).sort(), ["dive", "double-jump", "jump", "land-hard", "land-soft", "lip-catch", "super-jump"]);
});
test("an engine can play an overriding cue book (the soundboard's before / after), the game never does", async () => {
  const { BODY_BEFORE } = await import("../audio.mjs");
  const js = await read("game.js");
  assert.ok(!/BODY_BEFORE|cues:/.test(js.slice(js.indexOf("createAudioEngine("), js.indexOf("createAudioEngine(") + 200)), "the game uses CUES");
  const board = await read("soundboard.js");
  assert.match(board, /createAudioEngine\(\{ enabled: true, seed: 7, cues: BODY_BEFORE \}\)/);
  assert.ok(BODY_BEFORE.jump.build && CUES.jump.build !== BODY_BEFORE.jump.build);
});

/* ---------- revision seven: the bed sits behind Diana; Music / Sounds ---------- */
test("mix rules are global: the bed bus sits under Diana's notes, darker, thinner and further away", async () => {
  const { MIX, MIX_BEFORE, MUSIC_LEVEL } = await import("../audio.mjs");
  assert.ok(MIX.bed <= -6 && MIX.bed >= -10, `bed ${MIX.bed} dB`);
  assert.ok(MIX.bed + MIX.bedWet < 0 && MIX.bedWet > 0, "the bed is wetter (further away) but still lower");
  assert.ok(MIX.bedLowpass <= 8000 && MIX.bedDip.gain < 0 && MIX.bedDip.freq >= 1000 && MIX.bedDip.freq <= 4000);
  assert.ok(MIX.bedVoices > 0 && MIX.bedVoices < 28);
  assert.ok(MUSIC_LEVEL < MIX_BEFORE.music, "the title / door soundtrack is lower too");
  // No level preset can override them: score.mjs never mentions the mix.
  const score = await read("score.mjs");
  assert.ok(!/\bMIX\b|bedVoices|bedLowpass/.test(score));
});
test("a whole run through the engine never holds more bed voices than MIX.bedVoices", async () => {
  const { MIX } = await import("../audio.mjs");
  const run = scoreRun();
  assert.equal(run.s.status, "won");
  assert.ok(run.stats.score.peakBed > 0 && run.stats.score.peakBed <= MIX.bedVoices, `${run.stats.score.peakBed} bed voices at once`);
});
test("Music and Sounds volumes: guarded storage, defaults 1, clamped", async () => {
  const { readVolumes, writeVolumes, VOLUME_KEY } = await import("../audio.mjs");
  assert.deepEqual(readVolumes(null), { music: 1, sounds: 1 });
  assert.deepEqual(readVolumes(() => { throw new Error("blocked"); }), { music: 1, sounds: 1 });
  const store = new Map();
  const s = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(writeVolumes(s, { music: 0.4, sounds: 0.9 }), true);
  assert.deepEqual(readVolumes(s), { music: 0.4, sounds: 0.9 });
  store.set(VOLUME_KEY, JSON.stringify({ music: 7, sounds: "x" }));
  assert.deepEqual(readVolumes(s), { music: 1, sounds: 1 });
  assert.equal(writeVolumes(() => { throw new Error("blocked"); }, { music: 1, sounds: 1 }), false);
  const html = await read("index.html"),
    js = await read("game.js");
  const pause = html.slice(html.indexOf('id="pause-main"'), html.indexOf('id="pause-assist"'));
  assert.match(pause, /id="vol-music" type="range"/);
  assert.match(pause, /id="vol-sounds" type="range"/);
  assert.match(js, /volumes: readVolumes\(\(\) => window\.localStorage\)/);
});

/* ---------- revision seven: transitions are never silent ---------- */
test("the map's count-in schedules one bar of felt beats; a door without the recording holds its chord until a reset", () => {
  const r = rig();
  r.engine.unlock();
  assert.equal(r.engine.countIn({ bpm: 118, delay: 0.35 }), 4);
  const run = scoreRun();
  assert.equal(run.s.status, "won");
  // Level III's door (no recording): the closing chord is held after it.
  assert.ok(run.stats.score.rest, "the rest pad is armed after the door");
  run.engine.hush(0.1);
  assert.equal(run.engine.stats().score.rest, null, "a reset ends it");
});
test("browser layer: glyph rows clear Diana, touch controls appear on the first real touch", async () => {
  const js = await read("game.js"),
    css = await read("style.css");
  assert.match(js, /if \(right > v\.x - 26 && left < v\.x \+ 26 && bottom > v\.y - 90 && gy - r < v\.y\) gy -= bottom - \(v\.y - 90\) \+ 8;/);
  assert.match(js, /e\.pointerType !== "touch" \|\| root\.classList\.contains\("touch"\)/);
  assert.match(css, /\.solarum\.touch \.controls \{\n  display: block;/);
  assert.match(js, /if \(!reduced\) audio\.countIn\(\{ bpm: LEVELS\[next - 1\]\.bpm \* pace, delay: 0\.35 \}\);/);
});
