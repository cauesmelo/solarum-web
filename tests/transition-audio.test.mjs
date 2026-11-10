/** The transition's audio (RESEARCH_TRANSITIONS 4): the count-in is a handle
 * whose cancel() silences the beats not yet sounded, the closing chord's
 * held pad enters on beat A2, and the last level's recording begins two
 * bars after the door. */
import test from "node:test";
import assert from "node:assert/strict";
import { createAudioEngine } from "../audio.mjs";
import { BEAT, BAR, SIXTEENTH } from "../score.mjs";
import { LEVELS } from "../level.mjs";
import { MockContext } from "./webaudio-mock.mjs";

function rig(options = {}) {
  let ctx = null,
    now = 0;
  class AC extends MockContext {
    constructor() {
      super();
      ctx = this;
    }
  }
  const notes = [];
  const engine = createAudioEngine({ AudioContext: AC, seed: 3, pauseFade: 0, clock: () => now, trace: (n) => notes.push(n), ...options });
  engine.unlock();
  return { engine, ctx: () => ctx, notes, set: (t) => (now = t) };
}

test("the count-in is a handle: four beats at the next tempo, and cancel() fades only the beats not yet sounded", () => {
  const r = rig();
  const h = r.engine.countIn({ bpm: 120, delay: 0.5 });
  assert.equal(h.beats, 4);
  assert.equal(h.times.length, 4);
  for (let k = 1; k < 4; k++) assert.ok(Math.abs(h.times[k] - h.times[k - 1] - 0.5) < 1e-9, "one beat at 120 BPM apart");
  // A skip just after the first beat sounded (between B0 and B1).
  r.set(h.times[0] + 0.1);
  const sourcesBefore = r.ctx().starts.length;
  assert.equal(h.cancel(), 3, "three beats had not sounded");
  assert.equal(h.cancelled, 3);
  assert.equal(h.cancel(), 0, "a second cancel does nothing");
  assert.equal(r.ctx().starts.length, sourcesBefore, "cancelling builds nothing");
  // Every cancelled beat's sources stop before they would have started.
  const later = r.ctx().starts.filter((s) => s.started > h.times[0] + 0.1 + 0.002);
  assert.ok(later.length > 0);
  for (const s of later) assert.ok(s.stopped <= s.started, `a pending beat is stopped at ${s.stopped.toFixed(3)} (it would start at ${s.started.toFixed(3)})`);
  // Sound off or no context: an empty handle, still cancellable.
  const off = createAudioEngine({ enabled: false });
  const none = off.countIn({ bpm: 100 });
  assert.equal(none.beats, 0);
  assert.equal(none.cancel(), 0);
});

/** Play level n's door (the win event) through the engine on its own clock. */
function door(level, { music } = {}) {
  const r = rig({ level });
  const d = LEVELS.find((q) => q.id === level);
  const scale = d.bpm / 107; // the transport's time scale at normal pace
  if (music) r.engine.attachMusic(music);
  r.engine.event({ name: "wake", time: 0 }, { timeScale: scale });
  r.engine.scoreFrame({ simTime: 0.01, status: "running", timeScale: scale });
  r.set(10);
  r.engine.scoreFrame({ simTime: 10 * scale, status: "running", timeScale: scale });
  r.engine.event({ name: "win", time: 10 * scale, earth: false }, { timeScale: scale });
  return { ...r, scale, d };
}

test("the closing chord's held pad enters on beat A2: two beats after the door at the finished level's tempo", () => {
  for (const level of [1, 2, 6]) {
    const r = door(level);
    const a2 = 10 + (2 * BEAT) / r.scale;
    assert.ok(Math.abs(r.engine.stats().score.rest.next - a2) < 0.006, `L${level}: the pad is due at ${a2.toFixed(3)} s (stats round to 10 ms)`);
    // Nothing of the rest pad before A2; one voicing on the first frame at or after it.
    r.set(a2 - 0.02);
    r.engine.scoreFrame({ simTime: (a2 - 0.02) * r.scale, status: "won", timeScale: r.scale });
    assert.equal(r.notes.filter((n) => n.voice === "pad" && n.pos == null).length, 0, "not before A2");
    r.set(a2 + 0.005);
    r.engine.scoreFrame({ simTime: (a2 + 0.005) * r.scale, status: "won", timeScale: r.scale });
    assert.equal(r.notes.filter((n) => n.voice === "pad" && n.pos == null).length, 1, "on A2");
    assert.ok((2 * 60) / r.d.bpm < 1.4, "A2 falls 0.94-1.36 s after the door, before the old fixed 2 s");
  }
});

test("the last level's door starts the recording two bars after the door, on a downbeat", () => {
  const last = LEVELS.find((d) => d.level?.earth) ?? LEVELS.at(-1);
  const timers = [];
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => (timers.push(ms), real(() => {}, 0));
  try {
    const music = { paused: true, volume: 1, currentTime: 0, play() { this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } };
    const r = door(last.id, { music });
    const want = ((2 * BAR * SIXTEENTH) / r.scale) * 1000;
    assert.ok(timers.some((ms) => Math.abs(ms - want) < 1), `the recording waits ${(want / 1000).toFixed(3)} s (timers: ${timers.map((t) => t.toFixed?.(1)).join(", ")})`);
    assert.equal(r.engine.stats().score.rest, null, "no held pad under the recording");
  } finally {
    globalThis.setTimeout = real;
  }
});
