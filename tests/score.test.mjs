/** The adaptive score (score.mjs) against the re-timed level: path clock,
 * grid alignment, quantiser caps, harmonic safety, dissonance rules, falls,
 * the perfect-run payoff and the scheduler's clock. Pure: no Web Audio (the
 * engine-level checks live in audio.test.mjs). */
import test from "node:test";
import assert from "node:assert/strict";
import { RULES } from "../model.mjs";
import { CHECKPOINTS, createLevel } from "../level.mjs";
import { PATH } from "../score-path.mjs";
import { record, bake, auditAnchors, sourceHash, ANCHOR_GRID } from "../scripts/bake-score.mjs";
import {
  SIXTEENTH,
  BAR,
  CAPS,
  TOLERANCE,
  PHRASES,
  CHORDS,
  DIATONIC,
  LAYERS,
  quantize,
  chordAt,
  pathPos,
  pc,
  isSafe,
  createConductor,
  createClockMap,
  createTuning,
} from "../score.mjs";
import { musicRun, CRACKED, beaconX } from "./music-run.mjs";

const SLOPPY = { failAt: ["leap", "voids"], removeStars: ["first-song-2"], late: [[4400, 4470, 14], [8600, 8710, 16], [10900, 10980, 12]] };

/* ---------- path clock and the level on the grid ---------- */
test("the path clock is baked from the current level, model and pilot (a stale table fails)", async () => {
  assert.equal(PATH.hash, await sourceHash(), "run `npm run score:bake` after changing level.mjs, model.mjs or tests/routes.mjs");
  assert.equal(PATH.bpm, 107);
  for (let i = 1; i < PATH.path.length; i++) {
    assert.ok(PATH.path[i][0] > PATH.path[i - 1][0]);
    assert.ok(PATH.path[i][1] > PATH.path[i - 1][1], "x -> beat is monotonic");
  }
  // The main route is 35 bars to the door, which it reaches on a downbeat.
  assert.ok(Math.abs(PATH.end - 35 * BAR) < 0.1, `route ends at sixteenth ${PATH.end}`);
});
test("main route: every takeoff, landing, star, chain note, beacon and tile drop sits within 35 ms of its grid", () => {
  for (const hz of [60, 120, 240]) {
    const rec = record("main", 1 / hz);
    assert.equal(rec.s.status, "won");
    const audit = auditAnchors(bake(rec).anchors);
    assert.ok(audit.length >= 150, `${audit.length} anchors at ${hz} Hz`);
    const names = new Set(audit.map((a) => a.name));
    for (const n of ["jump", "double-jump", "dash", "land", "star", "chain-note", "constellation", "checkpoint", "tile-drop"]) assert.ok(names.has(n), `${n} anchors exist`);
    const worst = audit.reduce((w, a) => (Math.abs(a.ms) > Math.abs(w.ms) ? a : w));
    for (const a of audit) assert.ok(Math.abs(a.ms) <= 35, `${hz} Hz: ${a.name} ${a.id ?? ""} at x ${a.x} is ${a.ms.toFixed(1)} ms off its 1/${16 / a.grid} grid`);
    if (hz === 120) assert.ok(Math.abs(worst.ms) <= 20, `120 Hz worst ${worst.ms.toFixed(1)} ms (${worst.name} ${worst.id ?? ""})`);
  }
  // At 30 Hz the pilot only acts every 33 ms; the map is still on the grid
  // to within that sampling.
  const coarse = auditAnchors(bake(record("main", 1 / 30)).anchors);
  for (const a of coarse) assert.ok(Math.abs(a.ms) <= 35 + 1000 / 30 + 1, `30 Hz: ${a.name} ${a.ms.toFixed(1)} ms`);
});
test("constellations complete on an eighth, beacons sit on half bars, flights move exactly three sixteenths", () => {
  for (const a of PATH.anchors.filter((q) => q.name === "constellation")) assert.ok(Math.abs(a.k / 2 - Math.round(a.k / 2)) * 2 * SIXTEENTH <= 0.035, `${a.id} completes off the eighth`);
  for (const cp of CHECKPOINTS) {
    const k = pathPos(PATH, cp.x);
    assert.ok(Math.abs(k / 8 - Math.round(k / 8)) * 8 * SIXTEENTH <= 0.02, `${cp.id} at sixteenth ${k.toFixed(2)}`);
  }
  // A full flight adds 0.5 s x 227.1 px/s = 113.55 px = 3 x 37.85 px of run.
  assert.ok(Math.abs(RULES.dashSpeed * RULES.dashDuration - 3 * 270 * SIXTEENTH) < 0.01);
  // The beat cascade's pitch is one wave-beat: 207 px.
  const tiles = createLevel().platforms.filter((q) => q.cascade).sort((a, b) => a.x - b.x);
  for (let i = 1; i < tiles.length; i++) assert.ok(Math.abs(tiles[i].x - tiles[i - 1].x - 207) < 1);
});

/* ---------- quantiser ---------- */
test("the quantiser never waits past its cap, and an on-grid action plays at once", () => {
  for (const timeScale of [1, 0.8])
    for (const [grid, cap] of [[1, CAPS.landing], [1, CAPS.input], [1, CAPS.pickup], [2, CAPS.bloom], [4, CAPS.great], [8, CAPS.bloom]])
      for (let f = 0; f < grid; f += 0.005) {
        const pos = 300 + f,
          q = quantize(pos, { grid, cap, timeScale });
        assert.ok(q.delay <= cap + 1e-9, `grid ${grid} cap ${cap}: waited ${q.delay}`);
        assert.ok(q.delay >= 0 && q.pos >= pos - 1e-9, "never earlier than the action");
        if (Math.abs(q.offset) <= TOLERANCE) assert.ok(q.kind === "on" && q.delay <= TOLERANCE + 1e-9);
        if (q.kind === "snap") assert.ok(Math.abs(q.pos / grid - Math.round(q.pos / grid)) < 1e-9, "a snapped note lands on its grid");
      }
  // In real runs every voice respects its cap.
  for (const run of [musicRun(), musicRun(SLOPPY), musicRun({ route: "upper" })])
    for (const n of run.player) assert.ok(n.delay <= n.cap + 1e-9, `${n.voice} waited ${(n.delay * 1000).toFixed(1)} ms (cap ${n.cap * 1000})`);
});

/* ---------- harmony ---------- */
const AUTHORED = new Set(["pad", "choir", "signal"]); // the composer's voicings
test("every free note is from the current chord's safe set; G# rings only for Great Stars", () => {
  let checked = 0;
  for (const run of [musicRun(), musicRun({ route: "upper" }), musicRun({ route: "ability" }), musicRun({ route: "safe" }), musicRun(SLOPPY)]) {
    for (const n of run.notes) {
      const chord = chordAt(n.pos),
        midis = n.midis ?? (n.midi != null ? [n.midi] : []);
      for (const m of midis) {
        checked++;
        if (pc(m) === 8) {
          assert.equal(n.voice, "dust", `G# outside the Earth colour: ${n.voice}`);
          assert.notEqual(chord.root, 7, "never G# over G (a minor ninth on the root)");
          continue;
        }
        if (n.voice === "bass") assert.equal(pc(m), chord.root, "the bass plays the root");
        else if (AUTHORED.has(n.voice)) {
          assert.ok(DIATONIC.includes(pc(m)), `${n.voice} ${m} outside D major`);
          assert.notEqual((pc(m) - chord.root + 12) % 12, 1, `${n.voice} ${m}: a minor second over the root`);
        } else if (n.voice === "bloom" && m < 60) assert.equal(pc(m), chord.root, "a bloom's low note is the root");
        else assert.ok(isSafe(chord, m), `${n.voice} ${m} (${n.event}) is not safe over ${chord.name} at sixteenth ${n.pos}`);
      }
    }
  }
  assert.ok(checked > 3000, `${checked} pitches checked`);
});
test("authored constellation notes fit the chord where the main route takes each star", () => {
  const chainNotes = PATH.anchors.filter((a) => a.name === "chain-note");
  assert.ok(chainNotes.length >= 20);
  for (const a of chainNotes) {
    const [chain, step] = [a.id.replace(/-\d+$/, ""), Number(a.id.split("-").at(-1))];
    const m = PHRASES[chain][step],
      chord = chordAt(Math.round(a.k));
    assert.ok(isSafe(chord, m), `${a.id}: ${m} over ${chord.name}`);
  }
  for (const [id, notes] of Object.entries(PHRASES)) assert.equal(notes.length, createLevel().chains.find((c) => c.id === id).count, id);
});

/* ---------- mistakes ---------- */
test("dissonance follows only visible errors, stays within 20 cents and heals; Gentle never detunes", () => {
  const clean = musicRun();
  assert.ok(clean.mixes.every((m) => m.totalCents === 0 && m.H === 1), "a clean main run is perfectly in tune");
  const sloppy = musicRun(SLOPPY);
  const errorTimes = sloppy.events.filter((e) => e.name === "chain-fade" || e.name === "death").map((e) => e.time);
  const firstDetune = sloppy.mixes.find((m) => m.totalCents > 0);
  assert.ok(firstDetune, "a sloppy run is heard");
  // Errors are also off-beat score notes; the first detune comes after the
  // first error of any kind, never before.
  const firstError = sloppy.tuning.find((q) => q.H < 1);
  assert.ok(firstError && firstDetune.time >= firstError.time - 1e-9);
  assert.ok(errorTimes.length >= 3, `${errorTimes.length} visible errors`);
  for (const m of sloppy.mixes) assert.ok(m.totalCents <= 20 + 1e-9 && m.padCents >= 0 && m.wowCents >= 0, `${m.totalCents} cents`);
  assert.ok(Math.max(...sloppy.mixes.map((m) => m.totalCents)) > 5, "mistakes are audible");
  assert.equal(sloppy.mixes.at(-1).totalCents, 0, "clean play retunes the world by the door");
  // Below H 0.7 the choir rests; it returns as H heals.
  assert.ok(sloppy.mixes.some((m) => !m.choir) && sloppy.mixes.at(-1).choir);
  const gentle = musicRun({ ...SLOPPY, gentle: true });
  assert.ok(gentle.mixes.every((m) => m.totalCents === 0 && m.H === 1), "Gentle music never detunes");
  assert.ok(gentle.fx.some((f) => f.kind === "fade") && !gentle.fx.some((f) => f.kind === "tape-stop"), "a Gentle fall fades instead");
  assert.ok(gentle.player.every((n) => !n.blur), "and never blurs a note");
  // Kindness: three falls at one beacon soften the penalty, five forgive it.
  const t = createTuning();
  assert.equal(t.apply("respawn", { fallsHere: 1 }) <= 0 && t.H, 0.6);
  t.apply("restart");
  t.apply("respawn", { fallsHere: 3 });
  assert.equal(t.H, 0.8);
  t.apply("respawn", { fallsHere: 5 });
  assert.equal(t.H, 1);
});
test("a fall tape-stops the score, plays its last notes backwards and restarts on the beacon's bar when control returns", () => {
  const run = musicRun({ failAt: ["leap"] });
  assert.equal(run.s.status, "won");
  const stop = run.fx.find((f) => f.kind === "tape-stop");
  assert.ok(stop, "the fall tape-stops");
  assert.equal(stop.seconds, 0.45);
  assert.ok(stop.rewind.length >= 1 && stop.rewind.length <= 8, `${stop.rewind.length} rewind notes`);
  const restart = run.fx.find((f) => f.kind === "restart");
  const beacon = pathPos(PATH, beaconX("leap"));
  assert.equal(restart.pos, Math.round(beacon));
  assert.equal(restart.pos % 8, 0, "a half bar: the re-entry is on a strong beat");
  assert.equal(restart.event, "control", "it happens when control returns, not while Diana is still falling apart");
  // The restart is the frame control came back: within one 120 Hz step of it.
  const back = run.events.find((e) => e.name === "respawn");
  assert.ok(back && Math.abs(restart.time - back.time) < 0.01, "same simulation moment as the respawn (sim time is frozen while she reforms)");
  // The rewind replays the notes that were just heard, an octave up.
  const before = run.player.filter((n) => n.t <= stop.time + 1e-9).flatMap((n) => n.midis ?? [n.midi]);
  for (const r of stop.rewind) assert.ok(before.includes(r.midi - 12), `rewind ${r.midi}`);
  // Back to last light rewinds without the tape-stop or a penalty.
  const c = createConductor({ path: PATH, cracked: CRACKED });
  c.event({ name: "wake", time: 0 });
  const out = c.event({ name: "respawn", source: "retry", time: 9, x: beaconX("leap") });
  assert.deepEqual(out.fx.map((f) => f.kind), ["restart"]);
  assert.equal(c.tuning.H, 1);
});

/* ---------- the payoff ---------- */
test("a perfect run completes the whole song; a sloppy one does not", () => {
  const perfect = musicRun();
  assert.equal(perfect.s.status, "won");
  const song = perfect.c.song();
  assert.equal(song.notes, song.total, `${song.notes}/${song.total} intended notes on time`);
  assert.ok(song.total >= 60);
  assert.equal(song.constellations, 5);
  assert.equal(song.complete, true);
  const layers = perfect.c.state(perfect.s.time).layers;
  for (const l of ["sky", "signal", "pulse", "steps", "stars", "choir", "strings"]) assert.ok(layers.includes(l), `${l} played`);
  assert.ok(perfect.player.every((n) => n.kind === "on"), "every note of the perfect run is on its beat");
  assert.equal(perfect.c.state(perfect.s.time).rephases, 0, "the main route never needs a re-phase");
  const door = perfect.fx.find((f) => f.kind === "door");
  assert.equal(door.complete, true);
  assert.equal(door.earth, false);
  // The last two bars play the Signal's whole theme (head and answer).
  const coda = perfect.notes.filter((n) => n.voice === "signal" && n.pos >= 33 * BAR);
  assert.ok(coda.length >= 6, `${coda.length} coda notes`);
  const sloppy = musicRun(SLOPPY);
  assert.equal(sloppy.s.status, "won");
  assert.equal(sloppy.c.song().complete, false);
  assert.equal(sloppy.fx.find((f) => f.kind === "door").complete, false);
  // The mastery line brings three Great Stars: the door opens on the Earth chord.
  const upper = musicRun({ route: "upper" });
  const earthDoor = upper.fx.find((f) => f.kind === "door");
  assert.equal(earthDoor.earth, true);
  assert.equal(earthDoor.chord.name, CHORDS.Earth.name);
  assert.ok(upper.notes.some((n) => n.voice === "dust" && (n.midis ?? [n.midi]).some((m) => pc(m) === 8)), "G# rings for the Great Stars");
});

/* ---------- the scheduler's clock ---------- */
test("over a whole run the scheduler holds the grid within 2 ms under frame jitter, recovers from a hitch and never schedules in the past", () => {
  // The engine's loop with a fake clock: frames of 8-50 ms (seeded), one
  // 200 ms hitch; the simulation advances min(frame, 50 ms) like game.js;
  // the audio clock advances in 128-sample render quanta.
  const c = createConductor({ path: PATH, cracked: CRACKED });
  const clock = createClockMap();
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let wall = 0,
    sim = 0;
  c.event({ name: "wake", time: 0 });
  clock.anchor(0, 0);
  const at = new Map(); // tick position -> audio time
  let past = 0,
    maxDrift = 0,
    hitchAt = null;
  const quantum = 128 / 48000;
  for (let i = 0; sim < 70; i++) {
    let dt = 0.008 + rnd() * 0.042;
    if (i === 900) (dt = 0.2), (hitchAt = wall + dt);
    wall += dt;
    sim += Math.min(dt, 0.05);
    const audioNow = Math.floor(wall / quantum) * quantum;
    clock.follow(sim, audioNow, dt);
    if (hitchAt == null || wall > hitchAt + 1) maxDrift = Math.max(maxDrift, Math.abs(clock.stats().drift));
    for (const n of c.ticks(c.transport.pos(sim), c.transport.pos(clock.toSim(audioNow + 0.12)))) {
      const want = clock.toAudio(n.t);
      if (want < audioNow - 1e-9) past++;
      if (!at.has(n.pos)) at.set(n.pos, Math.max(audioNow + 0.006, want));
    }
  }
  const ks = [...at.keys()].sort((a, b) => a - b);
  let worst = 0,
    recovered = null;
  for (let i = 1; i < ks.length; i++) {
    if (ks[i] !== ks[i - 1] + 1) continue;
    const gap = at.get(ks[i]) - at.get(ks[i - 1]);
    const err = Math.abs(gap - SIXTEENTH);
    const nearHitch = Math.abs(at.get(ks[i]) - hitchAt) < 0.4;
    if (!nearHitch) worst = Math.max(worst, err);
    if (at.get(ks[i]) > hitchAt + 0.4 && recovered == null && err < 0.002) recovered = at.get(ks[i]) - hitchAt;
  }
  // Movement I has no voice on every sixteenth; II and III do (the shaker).
  assert.ok(ks.length > 300, `${ks.length} sixteenths carried notes`);
  assert.ok(worst < 0.002, `grid error ${(worst * 1000).toFixed(2)} ms`);
  assert.ok(recovered != null && recovered < 16 * SIXTEENTH, `recovered ${recovered?.toFixed(3)} s after the hitch`);
  assert.ok(maxDrift < 0.05, `drift ${(maxDrift * 1000).toFixed(1)} ms`);
  assert.ok(past <= 2, `${past} ticks were due in the past when first seen`);
  assert.equal(clock.stats().jumps, 1, "only the hitch re-anchored the clock");
});
test("the conductor is deterministic and its bed respects the layer plan", () => {
  const a = musicRun(),
    b = musicRun();
  assert.deepEqual(a.notes.map((n) => [n.voice, n.pos, n.midi ?? n.midis?.join()]), b.notes.map((n) => [n.voice, n.pos, n.midi ?? n.midis?.join()]));
  const at = (voice, bars) => a.notes.filter((n) => n.voice === voice && bars.includes(Math.floor(n.pos / BAR) + 1));
  assert.equal(at("pulse", [1, 2]).length, 0, "the pulse enters on bar 3");
  assert.ok(at("pulse", [3, 4]).length >= 4);
  assert.equal(at("pulse", [23, 24]).length, 0, "and rests on the hearth");
  assert.equal(at("shaker", [5]).length, 0, "the shaker belongs to II and III");
  assert.ok(at("shaker", [12]).length >= 16);
  assert.ok(at("pad", [1]).length >= 1, "the sky enters at the wake");
  for (const n of a.notes) assert.ok(LAYERS[n.layer], n.layer);
  assert.ok(a.notes.filter((n) => n.layer === "choir").length > 0, "constellations bring in the choir");
});
