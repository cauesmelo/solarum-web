/** Revision nine (the owner: the jump and the landings still sounded hard,
 * the SFX were a little loud against the music, and could the game borrow
 * some of Bard's mystical, cosmic essence): soft airy bodies with nothing
 * under 350 Hz, Diana's notes as chimes and a bowl, celestial sparkles that
 * follow the chord, and the SFX trims. */
import test from "node:test";
import assert from "node:assert/strict";
import { CUES, VOICES, BODY_REV8, VOICES_REV8, MIX, MIX_REV8, MIX_REV7, mulberry32, midiHz, cuesForEvent, createAudioEngine } from "../audio.mjs";
import { CHORDS, isSafe } from "../score.mjs";
import { MockContext } from "./webaudio-mock.mjs";

const BODIES = ["jump", "double-jump", "land-soft", "land-hard", "lip-catch"];
const lowest = (L) => {
  const f = L.filter.freq,
    lo = Array.isArray(f) ? Math.min(...f.map((p) => p[1])) : f;
  // A band-pass passes about an octave around its centre at Q 0.7-0.9.
  if (L.filter.type === "bandpass") return Math.max(L.highpass ?? 0, lo / 2);
  if (L.filter.type === "lowpass") return L.highpass ?? 0;
  return Math.max(L.highpass ?? 0, lo);
};

test("the movement bodies are air: no brown-noise weight, nothing under 350 Hz, every swell at least 25 ms", () => {
  for (const name of BODIES)
    for (let seed = 1; seed <= 4; seed++)
      for (const L of CUES[name].build(mulberry32(seed), {}).layers) {
        assert.equal(L.kind, "noise", name);
        assert.notEqual(L.color, "brown", `${name}: no brown noise (it read as a thud)`);
        assert.ok(lowest(L) >= 325, `${name}: passes down to ${lowest(L).toFixed(0)} Hz`);
        assert.ok(L.env[1][0] >= 0.025, `${name}: a ${L.env[1][0] * 1000} ms swell`);
      }
  // The A/B keeps revision eight's, which had the low weight.
  assert.ok(BODY_REV8["land-soft"].build(mulberry32(1), {}).layers.some((L) => L.color === "brown"));
  assert.ok(BODY_REV8.jump.build(mulberry32(1), {}).layers.some((L) => L.color === "brown"));
});

test("Diana's landing note is a bowl two octaves up, with no click; her jumps open on a glass chime", () => {
  const steps = VOICES.bass.build(mulberry32(1), { midi: 38 });
  for (const L of steps.layers) {
    assert.notEqual(L.kind, "noise", "no mallet click");
    assert.ok(L.hz >= midiHz(61), `the bowl sits at ${L.hz.toFixed(0)} Hz (the felt bass was 73-123 Hz)`);
    assert.ok(L.env[1][0] >= 0.004, "a soft touch");
  }
  const old = VOICES_REV8.bass.build(mulberry32(1), { midi: 38 });
  assert.ok(old.layers.some((L) => L.kind === "noise" && L.env[1][0] <= 0.002), "revision eight's felt bass had a 1 ms click");
  const jump = VOICES.harmonica.build(mulberry32(1), { midi: 62, glideTo: 69, glide: 0.38, dur: 0.6 });
  const bells = jump.layers.filter((L) => L.kind === "fm");
  assert.ok(bells.length >= 2, "a bell on the root and one where the glide arrives");
  assert.ok(bells.every((L) => L.env[1][0] >= 0.005), "every bell touches in over 5 ms or more");
  assert.ok(bells.some((L) => Math.abs(L.hz - midiHz(69)) / midiHz(69) < 0.01 && L.at > 0.2), "the fifth chimes as the glide arrives");
});

test("the celestial sparkles follow the chord: refill stars chirp, constellations and relics ring wind chimes", () => {
  for (const name of ["Bm", "G", "A", "F#m7", "Em/F#"]) {
    const c = CHORDS[name];
    for (const cue of ["refill-star", "constellation", "relic"]) {
      const spec = CUES[cue].build(mulberry32(3), { chord: c, verb: "glide" });
      const pitched = spec.layers.filter((L) => L.kind === "fm" || (L.kind === "tone" && L.tonal));
      assert.ok(pitched.length >= 3, `${cue}: chimes`);
      for (const L of pitched) {
        assert.ok(isSafe(c, L.midi), `${cue} over ${name}: ${L.midi}`);
        if (L.midiEnd != null) assert.ok(isSafe(c, L.midiEnd), `${cue}: the chirp lands on a safe tone`);
      }
      assert.equal(CUES[cue].duck, cue === "constellation" ? CUES.constellation.duck : undefined);
    }
  }
  assert.deepEqual(cuesForEvent({ name: "refill-star", kind: "leaf" }), [{ cue: "refill-star", params: { kind: "leaf" } }]);
});

test("the SFX trims: bodies 4 dB down, Diana's notes at their bus level (softer timbres), and the rev8 / rev7 A/Bs keep the old levels", () => {
  assert.equal(MIX.sfx, -4);
  assert.equal(MIX.player, 0);
  assert.equal(MIX.palette, "bard");
  for (const m of [MIX_REV8, MIX_REV7]) assert.ok(m.sfx === 0 && m.player === 0 && m.palette === "rev8");
  // Through the engine: the Sounds setting now scales the bodies' reverb
  // sends too (a gain in front of the room's input; at Sounds 0 their tails
  // used to remain).
  const made = [];
  class AC extends MockContext {
    createGain() {
      const g = super.createGain();
      made.push(g);
      return g;
    }
  }
  const e = createAudioEngine({ AudioContext: AC, seed: 1, pauseFade: 0 });
  e.unlock();
  const room = made.find((g) => g.outputs.some((n) => n.kind === "convolver")); // the room's input
  const door = made.find((g) => g !== room && g.outputs.includes(room));
  assert.ok(room && door, "a send door in front of the room");
  e.setVolumes({ sounds: 0 });
  assert.ok(door.gain.events.some((ev) => ev.kind === "lin" && ev.v === 0), "Sounds 0 closes the bodies' sends");
});
