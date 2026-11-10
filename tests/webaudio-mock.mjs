/** A strict Web Audio stand-in for the mix and soundtrack tests (revision
 * eight; tests/audio.test.mjs keeps its own copy). It throws where the real
 * API throws (non-finite values, negative times, exponential ramps to zero)
 * and records every source's start time and kind, so a test can read when
 * each note was scheduled to sound. */
function finite(...xs) {
  for (const x of xs) if (!Number.isFinite(x)) throw new TypeError(`non-finite ${x}`);
}
export class Param {
  constructor(v = 0) {
    this._v = v;
    this.events = [];
  }
  get value() {
    return this._v;
  }
  set value(v) {
    finite(v);
    this._v = v;
  }
  #at(kind, v, t, extra) {
    finite(v, t);
    if (t < 0) throw new RangeError("negative time");
    this.events.push({ kind, v, t, ...extra });
    return this;
  }
  setValueAtTime(v, t) {
    this._v = v;
    return this.#at("set", v, t);
  }
  linearRampToValueAtTime(v, t) {
    return this.#at("lin", v, t);
  }
  exponentialRampToValueAtTime(v, t) {
    if (v === 0) throw new RangeError("exponential ramp to 0");
    return this.#at("exp", v, t);
  }
  setTargetAtTime(v, t, tc) {
    finite(tc);
    return this.#at("target", v, t, { tc });
  }
  cancelScheduledValues(t) {
    finite(t);
    return this;
  }
}
export class MockNode {
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
    if (this.started !== undefined) throw new Error("started twice");
    this.started = t;
    this.ctx.starts.push(this);
  }
  stop(t = 0) {
    finite(t);
    if (this.started === undefined) throw new Error("stop before start");
    this.stopped = t;
  }
}
export class MockContext {
  constructor() {
    this.sampleRate = 48000;
    this.currentTime = 0;
    this.state = "running";
    this.created = 0;
    this.starts = [];
    this.clock = null;
    this.destination = new MockNode(this, "destination");
  }
  make(kind, Base, props) {
    this.created++;
    return Object.assign(new Base(this, kind), props);
  }
  createGain() {
    return this.make("gain", MockNode, { gain: new Param(1) });
  }
  createOscillator() {
    return this.make("osc", MockSource, { type: "sine", frequency: new Param(440), detune: new Param(0) });
  }
  createBufferSource() {
    return this.make("buffer", MockSource, { buffer: null, loop: false, playbackRate: new Param(1), detune: new Param(0) });
  }
  createBiquadFilter() {
    return this.make("biquad", MockNode, { type: "lowpass", frequency: new Param(350), Q: new Param(1), gain: new Param(0), detune: new Param(0) });
  }
  createDynamicsCompressor() {
    const p = () => new Param(0);
    return this.make("comp", MockNode, { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p() });
  }
  createWaveShaper() {
    return this.make("shaper", MockNode, { curve: null, oversample: "none" });
  }
  createConvolver() {
    return this.make("convolver", MockNode, { buffer: null, normalize: true });
  }
  createStereoPanner() {
    return this.make("panner", MockNode, { pan: new Param(0) });
  }
  createAnalyser() {
    return this.make("analyser", MockNode, { fftSize: 2048 });
  }
  createDelay(max = 1) {
    finite(max);
    return this.make("delay", MockNode, { delayTime: new Param(0), maxDelayTime: max });
  }
  createConstantSource() {
    return this.make("constant", MockSource, { offset: new Param(1) });
  }
  createMediaElementSource(el) {
    return this.make("media", MockNode, { mediaElement: el });
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
