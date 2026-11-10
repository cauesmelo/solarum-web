/** The adaptive score (score.mjs) against every level: path clocks, grid
 * alignment, quantiser caps, harmonic safety, dissonance rules, falls, the
 * perfect-run payoff, the scheduler's clock and each level's own preset
 * (RESEARCH_LEVELS 6). Pure: no Web Audio (the engine-level checks live in
 * audio.test.mjs). */
import test from "node:test";
import assert from "node:assert/strict";
import { RULES } from "../model.mjs";
import { LEVELS, LEVEL_ID, levelDef, createLevel } from "../level.mjs";
import { PATHS, HASH } from "../score-path.mjs";
import { record, bake, auditAnchors, sourceHash, ANCHOR_GRID } from "../scripts/bake-score.mjs";
import {
  SIXTEENTH,
  BAR,
  CAPS,
  TOLERANCE,
  SCORES,
  CHORDS,
  DIATONIC,
  MAX_DETUNE,
  LAYERS,
  quantize,
  pathPos,
  pc,
  isSafe,
  createConductor,
  createClockMap,
  createTuning,
} from "../score.mjs";
import { musicRun, CRACKED, beaconX, SLOPPY_RUNS } from "./music-run.mjs";

const IDS = LEVELS.map((d) => d.id);
const chordOf = (n, pos) => SCORES[n].chordAt(pos);
/** Score position of world x on level n (the path counts from waking; L2 wakes on its pickup). */
const posOf = (n, x) => pathPos(PATHS[n], x) + SCORES[n].pickup;

/* ---------- path clocks and the levels on the grid ---------- */
test("each level's path clock is baked from the current levels, model and pilots (a stale table fails)", async () => {
  assert.equal(HASH, await sourceHash(), "run `npm run score:bake` after changing level.mjs, model.mjs or tests/routes.mjs");
  for (const n of IDS) {
    const P = PATHS[n];
    assert.equal(P.bpm, levelDef(n).bpm);
    for (let i = 1; i < P.path.length; i++) {
      assert.ok(P.path[i][0] > P.path[i - 1][0]);
      assert.ok(P.path[i][1] > P.path[i - 1][1], `L${n}: x -> beat is monotonic`);
    }
    // Each level reaches its door on a downbeat, its own bar count in.
    const end = P.end + SCORES[n].pickup;
    assert.ok(Math.abs(end / BAR - Math.round(end / BAR)) * BAR < 0.1, `L${n} ends at sixteenth ${end}`);
    assert.equal(Math.round(end / BAR) + 1, SCORES[n].bars, `L${n} door bar`);
  }
});
test("every main route: each takeoff, landing, star, chain note, beacon and tile drop sits within 35 ms (real) of its grid", () => {
  const kinds = {
    1: ["jump", "double-jump", "land", "star", "chain-note", "constellation", "checkpoint"],
    2: ["jump", "double-jump", "dash", "land", "star", "chain-note", "constellation", "checkpoint"],
    [LEVEL_ID["still-water"]]: ["jump", "double-jump", "dash", "land", "star", "chain-note", "constellation", "checkpoint"],
    [LEVEL_ID["way-down"]]: ["jump", "double-jump", "dash", "land", "star", "chain-note", "constellation", "checkpoint"],
    [LEVEL_ID["borrowed-wind"]]: ["jump", "double-jump", "dash", "land", "star", "chain-note", "constellation", "checkpoint"],
    [LEVEL_ID.breaking]: ["jump", "double-jump", "dash", "land", "star", "chain-note", "constellation", "checkpoint"],
    [LEVEL_ID.door]: ["jump", "dash", "super-jump", "land", "star", "chain-note", "constellation", "checkpoint", "tile-drop"],
  };
  for (const n of IDS) {
    const clock = levelDef(n).clock;
    for (const hz of [60, 120, 240]) {
      // The pilot samples at hz of real time: clock/hz of simulation.
      const rec = record("main", clock / hz, n);
      assert.equal(rec.s.status, "won");
      const audit = auditAnchors(bake(rec).anchors);
      assert.ok(audit.length >= 50, `L${n}: ${audit.length} anchors at ${hz} Hz`);
      const names = new Set(audit.map((a) => a.name));
      for (const k of kinds[n]) assert.ok(names.has(k), `L${n} ${k} anchors exist`);
      const ms = (a) => a.ms / clock; // simulation ms -> real (audio) ms
      const worst = audit.reduce((w, a) => (Math.abs(ms(a)) > Math.abs(ms(w)) ? a : w));
      for (const a of audit) assert.ok(Math.abs(ms(a)) <= 35, `L${n} ${hz} Hz: ${a.name} ${a.id ?? ""} at x ${a.x} is ${ms(a).toFixed(1)} ms off its 1/${16 / a.grid} grid`);
      if (hz === 120) assert.ok(Math.abs(ms(worst)) <= 30, `L${n} 120 Hz worst ${ms(worst).toFixed(1)} ms (${worst.name} ${worst.id ?? ""})`);
    }
  }
});
test("constellations complete on an eighth, beacons sit on half bars, flights move exactly three sixteenths", () => {
  for (const n of IDS) {
    const pick = SCORES[n].pickup;
    for (const a of PATHS[n].anchors.filter((q) => q.name === "constellation")) {
      const k = a.k + pick;
      assert.ok(Math.abs(k / 2 - Math.round(k / 2)) * 2 * SIXTEENTH <= 0.035 * levelDef(n).clock, `L${n} ${a.id} completes off the eighth`);
    }
    for (const cp of levelDef(n).checkpoints) {
      const k = posOf(n, cp.x);
      assert.ok(Math.abs(k / 8 - Math.round(k / 8)) * 8 * SIXTEENTH <= 0.02, `L${n} ${cp.id} at sixteenth ${k.toFixed(2)}`);
    }
  }
  // A full flight adds 0.5 s x 227.1 px/s = 113.55 px = 3 x 37.85 px of run.
  assert.ok(Math.abs(RULES.dashSpeed * RULES.dashDuration - 3 * 270 * SIXTEENTH) < 0.01);
  // The beat cascade's pitch is one wave-beat: 207 px.
  for (const n of [LEVEL_ID.door]) {
    const tiles = createLevel(n).platforms.filter((q) => q.cascade).sort((a, b) => a.x - b.x);
    for (let i = 1; i < tiles.length; i++) assert.ok(Math.abs(tiles[i].x - tiles[i - 1].x - 207) < 1);
  }
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
  for (const n of IDS)
    for (const run of [musicRun({ level: n }), musicRun(SLOPPY_RUNS[n]), musicRun({ level: n, route: "upper" })])
      for (const v of run.player) assert.ok(v.delay <= v.cap + 1e-9, `L${n} ${v.voice} waited ${(v.delay * 1000).toFixed(1)} ms (cap ${v.cap * 1000})`);
});

/* ---------- harmony ---------- */
const AUTHORED = new Set(["pad", "choir", "signal"]); // the composer's voicings
test("every free note is from the current chord's safe set; G# rings only for Great Stars", () => {
  let checked = 0;
  for (const lv of IDS)
    for (const run of [musicRun({ level: lv }), musicRun({ level: lv, route: "upper" }), musicRun({ level: lv, route: "ability" }), musicRun({ level: lv, route: "safe" }), musicRun(SLOPPY_RUNS[lv])]) {
      for (const n of run.notes) {
        const chord = chordOf(lv, n.pos),
          midis = n.midis ?? (n.midi != null ? [n.midi] : []);
        for (const m of midis) {
          checked++;
          if (pc(m) === 8) {
            assert.equal(n.voice, "dust", `L${lv} G# outside the Earth colour: ${n.voice}`);
            assert.notEqual(chord.root, 7, "never G# over G (a minor ninth on the root)");
            continue;
          }
          // The F major chord's A# (L4's dominant) lives only in its pad.
          if (n.voice === "pad" && chord.name === "F#" && pc(m) === 10) continue;
          if (n.voice === "bass") assert.equal(pc(m), pc(chord.bass), "the bass plays the chord's bass (the root, or L4's F# pedal)");
          else if (AUTHORED.has(n.voice)) {
            assert.ok(DIATONIC.includes(pc(m)), `L${lv} ${n.voice} ${m} outside D major`);
            assert.notEqual((pc(m) - chord.root + 12) % 12, 1, `L${lv} ${n.voice} ${m}: a minor second over the root`);
          } else if (n.voice === "bloom" && m < 60) assert.equal(pc(m), chord.root, "a bloom's low note is the root");
          else assert.ok(isSafe(chord, m), `L${lv} ${n.voice} ${m} (${n.event}) is not safe over ${chord.name} at sixteenth ${n.pos}`);
        }
      }
    }
  assert.ok(checked > 6000, `${checked} pitches checked`);
});
test("authored constellation notes fit the chord where each main route takes each star", () => {
  let count = 0;
  for (const n of IDS) {
    const P = SCORES[n];
    for (const a of PATHS[n].anchors.filter((q) => q.name === "chain-note")) {
      count++;
      const [chain, step] = [a.id.replace(/-\d+$/, ""), Number(a.id.split("-").at(-1))];
      const m = P.phrases[chain][step],
        chord = P.chordAt(Math.round(a.k) + P.pickup);
      assert.ok(isSafe(chord, m), `L${n} ${a.id}: ${m} over ${chord.name}`);
    }
    for (const [id, notes] of Object.entries(P.phrases)) assert.equal(notes.length, createLevel(n).chains.find((c) => c.id === id).count, `L${n} ${id}`);
    assert.equal(Object.keys(P.phrases).length, createLevel(n).chains.length, `L${n}: every constellation has its phrase`);
  }
  assert.ok(count >= 40, `${count} chain notes`);
});

/* ---------- mistakes ---------- */
test("dissonance follows only visible errors, is clearly heard (the bed goes flat), heals one bar at a time; Gentle never detunes", () => {
  for (const n of IDS) {
    const cap = SCORES[n].maxFlat;
    const clean = musicRun({ level: n });
    assert.ok(clean.mixes.every((m) => m.totalCents === 0 && m.H === 1), `L${n}: a clean main run is perfectly in tune`);
    const sloppy = musicRun(SLOPPY_RUNS[n]);
    assert.equal(sloppy.s.status, "won");
    const firstDetune = sloppy.mixes.find((m) => m.totalCents > 0);
    assert.ok(firstDetune, `L${n}: a sloppy run is heard`);
    // Errors are also off-beat score notes; the first detune comes after the
    // first error of any kind, never before.
    const firstError = sloppy.tuning.find((q) => q.H < 1);
    assert.ok(firstError && firstDetune.time >= firstError.time - 1e-9);
    for (const m of sloppy.mixes) assert.ok(m.totalCents <= MAX_DETUNE + 1e-9 && m.flatCents <= cap + 1e-9 && m.padCents >= 0 && m.wowCents >= 0, `L${n} ${m.totalCents} cents`);
    // Audible: right after a fall the whole bed sits at the level's full
    // flat cap (10 cents in L1's calm, 15 in L2, 20 from L3) against
    // Diana's in-tune voice.
    // (In step order: simulation time rewinds to the beacon at a respawn.)
    const fell = sloppy.mixes.findIndex((m) => m.status === "dead");
    const afterFall = sloppy.mixes.slice(fell).filter((m, i) => m.status === "running" && i < 600 && m.H < 1);
    assert.ok(afterFall.length && Math.max(...afterFall.map((m) => m.flatCents)) >= Math.min(cap, 15) - 1e-9, `L${n}: the bed is clearly flat after a fall`);
    // Healing is gentle: never more than +0.1 at a time, and a fall is heard
    // for several bars of clean play.
    for (let i = 1; i < sloppy.tuning.length; i++) {
      const d = sloppy.tuning[i].H - sloppy.tuning[i - 1].H;
      assert.ok(d <= 0.1 + 1e-9, `L${n} H rose ${d.toFixed(2)} at once (${sloppy.tuning[i].after})`);
    }
    const outOfTune = sloppy.mixes.filter((m) => m.totalCents > 0).length / 120 / levelDef(n).clock;
    // A fall is heard for at least three bars of clean play at any tempo.
    assert.ok(outOfTune > (3 * 4 * 60) / levelDef(n).bpm, `L${n} ${outOfTune.toFixed(1)} s out of tune over the sloppy run`);
    assert.equal(sloppy.mixes.at(-1).totalCents, 0, `L${n}: clean play retunes the world by the door`);
    const gentle = musicRun({ ...SLOPPY_RUNS[n], gentle: true });
    assert.ok(gentle.mixes.every((m) => m.totalCents === 0 && m.H === 1), "Gentle music never detunes");
    assert.ok(gentle.fx.some((f) => f.kind === "fade") && !gentle.fx.some((f) => f.kind === "tape-stop"), "a Gentle fall fades instead");
    assert.ok(gentle.player.every((v) => !v.blur), "and never blurs a note");
  }
  // Below H 0.7 the choir rests; it returns as H heals.
  const sloppy = musicRun(SLOPPY_RUNS[LEVEL_ID["borrowed-wind"]]);
  assert.ok(sloppy.mixes.some((m) => !m.choir) && sloppy.mixes.at(-1).choir);
  // Kindness: three falls at one beacon soften the penalty, five forgive it.
  const t = createTuning();
  assert.equal(t.apply("respawn", { fallsHere: 1 }) <= 0 && t.H, 0.6);
  t.apply("restart");
  t.apply("respawn", { fallsHere: 3 });
  assert.equal(t.H, 0.8);
  t.apply("respawn", { fallsHere: 5 });
  assert.equal(t.H, 1);
});
test("a fall tape-stops the score (L1 short, no rewind; then backwards), L4 rests its groove, and the score restarts on the beacon's bar when control returns", () => {
  for (const n of IDS) {
    const P = SCORES[n];
    const run = musicRun({ level: n, failAt: SLOPPY_RUNS[n].failAt });
    assert.equal(run.s.status, "won");
    const stop = run.fx.find((f) => f.kind === "tape-stop");
    assert.ok(stop, `L${n}: the fall tape-stops`);
    assert.equal(stop.seconds, P.tapeStop);
    if (P.rewind) assert.ok(stop.rewind.length >= 1 && stop.rewind.length <= 8, `L${n} ${stop.rewind.length} rewind notes`);
    else assert.equal(stop.rewind.length, 0, "L1's stop has no rewind");
    const restart = run.fx.find((f) => f.kind === "restart");
    const beacon = posOf(n, beaconX(SLOPPY_RUNS[n].failAt[0], n));
    assert.equal(restart.pos, Math.round(beacon));
    assert.equal(restart.pos % 8, 0, `L${n}: a half bar, the re-entry is on a strong beat`);
    assert.equal(restart.event, "control", "it happens when control returns, not while Diana is still falling apart");
    const back = run.events.find((e) => e.name === "respawn");
    assert.ok(back && Math.abs(restart.time - back.time) < 0.01, "same simulation moment as the respawn");
    // The rewind replays the notes that were just heard, an octave up.
    const before = run.player.filter((v) => v.t <= stop.time + 1e-9).flatMap((v) => v.midis ?? [v.midi]);
    for (const r of stop.rewind) assert.ok(before.includes(r.midi - 12), `rewind ${r.midi}`);
    if (P.dropOnFall) {
      // L4: no kick or ostinato between the respawn and the next constellation or beacon.
      const after = run.events.filter((e) => (e.name === "constellation" || e.name === "checkpoint") && e.seq > back.seq)[0];
      const until = after ? after.seq : Infinity;
      const groove = run.notes.filter((v) => v.event === "tick" && (v.voice === "pulse" || v.voice === "marimba") && v.seq > back.seq && v.seq < until);
      assert.equal(groove.length, 0, `L4 groove during the rest: ${groove.length}`);
    }
  }
  // Back to last light rewinds without the tape-stop or a penalty.
  const c = createConductor({ level: LEVEL_ID["borrowed-wind"], path: PATHS[LEVEL_ID["borrowed-wind"]], cracked: CRACKED });
  c.event({ name: "wake", time: 0 });
  assert.equal(c.transport.pos(0), SCORES[LEVEL_ID["borrowed-wind"]].pickup, "VI wakes on its first bar");
  const out = c.event({ name: "respawn", source: "retry", time: 9, x: beaconX("bridge", LEVEL_ID["borrowed-wind"]) });
  assert.deepEqual(out.fx.map((f) => f.kind), ["restart"]);
  assert.equal(c.tuning.H, 1);
  assert.equal(c.transport.pos(9), Math.round(posOf(LEVEL_ID["borrowed-wind"], beaconX("bridge", LEVEL_ID["borrowed-wind"]))), "on the beacon's bar");
  // Restart level: a fresh, stopped, in-tune song that the next wake starts on its first bar.
  c.event({ name: "chain-fade", time: 10 });
  assert.ok(c.tuning.H < 1);
  c.reset();
  assert.equal(c.transport.running, false);
  assert.equal(c.tuning.H, 1);
  c.event({ name: "wake", time: 0 });
  assert.equal(c.transport.pos(0), SCORES[LEVEL_ID["borrowed-wind"]].pickup);
});

/* ---------- the payoff ---------- */
test("a perfect run completes each level's song; a sloppy one does not; three Great Stars open the door on Earth's chord", () => {
  const layers = {
    1: ["sky", "signal", "steps", "stars", "choir", "strings"],
    2: ["sky", "signal", "pulse", "steps", "stars", "choir", "strings"],
    [LEVEL_ID["still-water"]]: ["sky", "signal", "pulse", "steps", "stars", "choir", "strings"],
    [LEVEL_ID["way-down"]]: ["sky", "signal", "pulse", "steps", "stars", "choir", "strings"],
    [LEVEL_ID["borrowed-wind"]]: ["sky", "signal", "pulse", "steps", "stars", "choir", "strings"],
    [LEVEL_ID.breaking]: ["sky", "signal", "pulse", "steps", "stars", "choir", "strings"],
    [LEVEL_ID.door]: ["sky", "signal", "pulse", "steps", "stars", "choir", "strings"],
  };
  for (const n of IDS) {
    const perfect = musicRun({ level: n });
    assert.equal(perfect.s.status, "won");
    const song = perfect.c.song();
    assert.equal(song.notes, song.total, `L${n}: ${song.notes}/${song.total} intended notes on time`);
    assert.ok(song.total >= 12, `L${n} ${song.total} intended notes`);
    assert.equal(song.constellations, song.totalConstellations);
    assert.equal(song.complete, true);
    const heard = perfect.c.state(perfect.s.time).layers;
    for (const l of layers[n]) assert.ok(heard.includes(l), `L${n}: ${l} played`);
    if (n === 1) assert.ok(!heard.includes("pulse"), "L1 has no drums");
    // On the grid: on time, or (the smash's shards) snapped onto their eighth.
    assert.ok(perfect.player.every((v) => v.kind === "on" || (v.kind === "snap" && (v.voice === "shards" || v.event === "dive"))), `L${n}: ${perfect.player.filter((v) => v.kind !== "on").map((v) => v.voice)}`);
    assert.equal(perfect.c.state(perfect.s.time).rephases, 0, `L${n}: the main route never needs a re-phase`);
    const door = perfect.fx.find((f) => f.kind === "door");
    assert.equal(door.complete, true);
    assert.equal(door.earth, false);
    // The last bars play the Signal's whole theme (head and answer).
    const coda = perfect.notes.filter((v) => v.voice === "signal" && v.pos >= (SCORES[n].closeFrom - 1) * BAR);
    assert.ok(coda.length >= 6, `L${n}: ${coda.length} coda notes`);
    const sloppy = musicRun(SLOPPY_RUNS[n]);
    assert.equal(sloppy.s.status, "won");
    assert.equal(sloppy.c.song().complete, false);
    assert.equal(sloppy.fx.find((f) => f.kind === "door").complete, false);
    const upper = musicRun({ level: n, route: "upper" });
    const earthDoor = upper.fx.find((f) => f.kind === "door");
    assert.equal(earthDoor.earth, true, `L${n}`);
    assert.equal(earthDoor.chord.name, CHORDS.Earth.name);
    assert.ok(upper.notes.some((v) => v.voice === "dust" && (v.midis ?? [v.midi]).some((m) => pc(m) === 8)), "G# rings for the Great Stars");
  }
});

/* ---------- the scheduler's clock ---------- */
test("over a whole run the scheduler holds the grid within 2 ms under frame jitter, recovers from a hitch and never schedules in the past", () => {
  // The engine's loop with a fake clock: frames of 8-50 ms (seeded), one
  // 200 ms hitch; the simulation advances min(frame, 50 ms) like game.js;
  // the audio clock advances in 128-sample render quanta.
  // VI held in its wind (118 BPM, clock 1.103): the strings run up the chord
  // on every sixteenth, so the scheduler is never idle.
  const c = createConductor({ level: LEVEL_ID["borrowed-wind"], path: PATHS[LEVEL_ID["borrowed-wind"]], cracked: CRACKED });
  const clock = createClockMap();
  const scale = levelDef(LEVEL_ID["borrowed-wind"]).clock;
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let wall = 0,
    sim = 0;
  c.event({ name: "wake", time: 0 });
  clock.anchor(0, 0, scale);
  const at = new Map(); // tick position -> audio time
  let past = 0,
    maxDrift = 0,
    hitchAt = null;
  const quantum = 128 / 48000;
  for (let i = 0; sim < 50; i++) {
    let dt = 0.008 + rnd() * 0.042;
    if (i === 700) (dt = 0.2), (hitchAt = wall + dt);
    wall += dt;
    sim += Math.min(dt, 0.05) * scale;
    const audioNow = Math.floor(wall / quantum) * quantum;
    clock.follow(sim, audioNow, dt, scale);
    c.frame({ t: sim, x: 0, status: "running", timeScale: scale, inWind: true });
    if (hitchAt == null || wall > hitchAt + 1) maxDrift = Math.max(maxDrift, Math.abs(clock.stats().drift));
    for (const n of c.ticks(c.transport.pos(sim), c.transport.pos(clock.toSim(audioNow + 0.12, scale)))) {
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
    const err = Math.abs(gap - SIXTEENTH / scale);
    const nearHitch = Math.abs(at.get(ks[i]) - hitchAt) < 0.4;
    if (!nearHitch) worst = Math.max(worst, err);
    if (at.get(ks[i]) > hitchAt + 0.4 && recovered == null && err < 0.002) recovered = at.get(ks[i]) - hitchAt;
  }
  // Across the hitch the grid keeps its phase: ticks move by whole
  // sixteenths, plus only the small residual being slewed.
  for (let i = 1; i < ks.length; i++) {
    const a = at.get(ks[i - 1]),
      b = at.get(ks[i]);
    if (Math.abs(b - hitchAt) > 0.4) continue;
    const r = ((b - a) / (SIXTEENTH / scale)) % 1;
    assert.ok(Math.min(r, 1 - r) * (SIXTEENTH / scale) < 0.015, `tick ${ks[i]} lands ${(Math.min(r, 1 - r) * (SIXTEENTH / scale) * 1000).toFixed(1)} ms off the old grid`);
  }
  assert.ok(ks.length > 200, `${ks.length} sixteenths carried notes`);
  assert.ok(worst < 0.002, `grid error ${(worst * 1000).toFixed(2)} ms`);
  assert.ok(recovered != null && recovered < (16 * SIXTEENTH) / scale, `recovered ${recovered?.toFixed(3)} s after the hitch`);
  assert.ok(maxDrift < 0.05, `drift ${(maxDrift * 1000).toFixed(1)} ms`);
  assert.ok(past <= 2, `${past} ticks were due in the past when first seen`);
  assert.equal(clock.stats().jumps, 1, "only the hitch re-anchored the clock");
});
test("the conductor is deterministic and each level's bed respects its layer plan", () => {
  for (const n of IDS) {
    const a = musicRun({ level: n }),
      b = musicRun({ level: n });
    assert.deepEqual(a.notes.map((v) => [v.voice, v.pos, v.midi ?? v.midis?.join()]), b.notes.map((v) => [v.voice, v.pos, v.midi ?? v.midis?.join()]));
    const at = (voice, bars) => a.notes.filter((v) => v.voice === voice && v.event === "tick" && bars.includes(Math.floor(v.pos / BAR) + 1));
    assert.equal(at("pulse", [1, 2]).length, 0, `L${n}: the groove enters on bar 3`);
    assert.ok(at("pad", [1, 2]).length >= 1, "the sky enters at the wake");
    // The sky never thins out: a pad starts in every bar (a held chord is
    // re-voiced at each bar line).
    for (let bar = 1; bar < SCORES[n].bars; bar++) assert.ok(at("pad", [bar]).length >= 1, `L${n} bar ${bar} has a sky pad`);
    for (const v of a.notes) assert.ok(LAYERS[v.layer], v.layer);
    assert.ok(a.notes.filter((v) => v.layer === "choir").length > 0, "constellations bring in the choir");
  }
  const bar = (run, voice, b) => run.notes.filter((v) => v.voice === voice && v.event === "tick" && Math.floor(v.pos / BAR) + 1 === b).length;
  // (l2-l4: the interim levels, revision five's II-IV.)
  const [l1, gift, still, way, brk, wind, l4] = [1, 2, LEVEL_ID["still-water"], LEVEL_ID["way-down"], LEVEL_ID.breaking, LEVEL_ID["borrowed-wind"], LEVEL_ID.door].map((n) => musicRun({ level: n }));
  // VI: the clave only over the first wind and the finale; it rests in the
  // breeze, the storm and the last wind; no shaker (restraint).
  assert.equal(bar(wind, "pulse", 4) + bar(wind, "marimba", 4), 0, "VI rests in the breeze");
  assert.equal(bar(wind, "marimba", 7), 3);
  assert.equal(bar(wind, "marimba", 12), 0, "VI rests in the storm");
  assert.equal(bar(wind, "marimba", 16), 3, "the finale");
  assert.equal(bar(wind, "marimba", 20), 0, "VI rests in the last wind");
  assert.equal(wind.notes.filter((v) => v.voice === "shaker").length, 0);
  // V: the clave (the half-time beat once a bar, the tresillo's marimba)
  // only where the cracks run land and go; it rests on the first crack,
  // over the split voids and through the stone; no shaker (restraint).
  assert.equal(bar(brk, "pulse", 5), 1);
  assert.equal(bar(brk, "marimba", 5), 3);
  assert.equal(bar(brk, "pulse", 3) + bar(brk, "marimba", 3), 0, "V rests on the first crack");
  assert.equal(bar(brk, "marimba", 13), 0, "V rests over the split voids");
  assert.equal(bar(brk, "marimba", 17), 0, "V rests through the stone");
  assert.equal(bar(brk, "marimba", 21), 3, "the run down from the crown");
  assert.equal(brk.notes.filter((v) => v.voice === "shaker").length, 0);
  // IV: the heartbeat rests while the necklace wakes and in the broken well,
  // keeps its downbeat over the cut and beats 1 and 3 in the rings; no
  // ticks, no shaker, no marimba.
  assert.equal(bar(way, "pulse", 3), 0, "IV rests while the necklace wakes");
  assert.equal(bar(way, "pulse", 6), 1);
  assert.equal(bar(way, "pulse", 12), 0, "IV rests in the broken well");
  assert.equal(bar(way, "pulse", 16), 2);
  assert.equal(way.notes.filter((v) => v.voice === "shaker" || v.voice === "marimba").length, 0);
  // III: one soft brush on beat 4 (the shaker voice), from bar 5; nothing
  // on the downbeats, no heartbeat, no marimba.
  assert.equal(bar(still, "shaker", 3), 0, "III rests while the helper comes");
  assert.equal(bar(still, "shaker", 6), 1);
  assert.equal(still.notes.filter((v) => v.voice === "pulse" || v.voice === "marimba").length, 0);
  // II: the heartbeat alone (1 and 3), resting while the gift arrives and
  // over the long void; no shaker, no marimba (restraint).
  assert.equal(bar(gift, "pulse", 3), 0, "II rests while the gift arrives");
  assert.equal(bar(gift, "pulse", 5), 2);
  assert.equal(bar(gift, "pulse", 11), 0, "II rests over the long void");
  assert.equal(gift.notes.filter((v) => v.voice === "shaker" || v.voice === "marimba").length, 0);
  // L1: no drums at all. The interim Far Door: four on the floor.
  assert.equal(l1.notes.filter((v) => v.voice === "pulse" || v.voice === "shaker").length, 0);
  assert.equal(bar(l4, "pulse", 5), 4);
  assert.equal(bar(l4, "marimba", 5), 8);
  // Each level its own space (RESEARCH_LEVELS 6): 5.5 s, 5.5, 3.5, 2.5.
  const order = [1, 2, LEVEL_ID["still-water"], LEVEL_ID["way-down"], LEVEL_ID.breaking, LEVEL_ID["borrowed-wind"], LEVEL_ID.door];
  assert.deepEqual(order.map((n) => SCORES[n].space.seconds), [5.5, 5.5, 5, 4.5, 3.5, 3.5, 2.5]);
  assert.deepEqual(order.map((n) => SCORES[n].maxFlat), [12, 14, 15, 16, 18, 20, 20]);
});
