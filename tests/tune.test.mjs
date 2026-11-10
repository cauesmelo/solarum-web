/** The soundtrack inside the levels (tune.mjs, revision eight): a real little
 * song per level, in its key, chords and tempo, giving way to Diana's song. */
import test from "node:test";
import assert from "node:assert/strict";
import { TUNES, tuneFor, parseBar, noteMidi, createTune, leadPlan, dianaNotes, bassNote, fitLead, MELODIC } from "../tune.mjs";
import { SCORES, CHORDS, isSafe, pc, BAR, barOf } from "../score.mjs";
import { LEVELS } from "../level.mjs";

const ticks = (tune, bars) => {
  const out = [];
  for (let k = 0; k < bars * BAR; k++) for (const n of tune.tick(k)) out.push({ ...n, k });
  return out;
};

test("every level has a tune of its own; every bar of every lead lasts exactly one bar", () => {
  for (const d of LEVELS) assert.ok(d.key === "waking" || tuneFor(d.key) !== TUNES.waking, `${d.key} has a tune of its own`);
  for (const key of ["waking", "gift", "still-water", "way-down", "breaking", "borrowed-wind", "falling-road", "door"]) {
    const T = TUNES[key];
    assert.equal(T.lead.length, 4, `${key}: A, B, A', C`);
    for (const bar of T.lead) assert.ok(parseBar(bar).length > 0, `${key}: "${bar}"`);
    assert.ok(T.bass.every(([at, deg, len]) => at >= 0 && at < BAR && ["R", "5", "8"].includes(deg) && len > 0));
    assert.ok(T.harp.at.every((at) => at >= 0 && at < BAR));
  }
  assert.equal(tuneFor("far-door"), TUNES.door, "the progression's eventual key finds its tune");
  assert.equal(noteMidi("C4"), 60);
  assert.equal(noteMidi("F#4"), 66);
  assert.throws(() => parseBar("D5:6 C#5:6"), /lasts 12/);
});

test("IV quotes the soundtrack's motif: D5 . . C#5 . . B4 . | A4 F#5 . . A4 (3 + 3 + 2)", () => {
  const [a, b] = TUNES["way-down"].lead.map(parseBar);
  assert.deepEqual(a.map((n) => [n.at, n.midi]), [[0, 74], [6, 73], [12, 71]]);
  assert.deepEqual(b.map((n) => [n.at, n.midi]), [[0, 69], [2, 78], [8, 69]]);
});

test("every pitch the soundtrack plays is safe over the chord it sounds on, in every level", () => {
  for (const d of LEVELS) {
    const P = SCORES[d.id];
    for (const n of ticks(createTune({ level: d.id }), P.bars + 1)) {
      if (n.midi == null) continue;
      const chord = P.chordAt(n.k);
      // The bass plays the chord's own bass note (a slash chord's pedal) or a chord tone.
      if (n.part === "bass") assert.ok(pc(n.midi) === pc(chord.bass) || chord.tones.includes(pc(n.midi)), `L${d.id} k${n.k} bass ${n.midi} over ${chord.name}`);
      else assert.ok(isSafe(chord, n.midi), `L${d.id} k${n.k} ${n.part} ${n.midi} over ${chord.name}`);
    }
  }
});

test("call and response: the lead never sounds within a sixteenth of Diana's baked melody, nor on the Signal's bars, nor from the closing theme on", () => {
  for (const d of LEVELS) {
    const P = SCORES[d.id];
    const { melodic } = dianaNotes(d.id);
    const lead = ticks(createTune({ level: d.id }), P.bars).filter((n) => n.part === "lead");
    assert.ok(lead.length >= 8, `L${d.id}: the tune is heard (${lead.length} lead notes)`);
    for (const n of lead) {
      const bar = barOf(n.k);
      if (bar >= P.closeFrom) continue; // (the coda's one settling note is checked below)
      for (const dk of [-1, 0, 1]) assert.ok(!melodic.has(n.k + dk), `L${d.id} k${n.k}: Diana sings at ${n.k + dk}`);
      assert.ok(!P.signalBars.includes(bar), `L${d.id} bar ${bar} is the Signal's`);
      // a half bar where she plays two or more notes is hers
      const h0 = (bar - 1) * BAR + (n.k % BAR < 8 ? 0 : 8);
      let count = 0;
      for (let k = h0; k < h0 + 8; k++) count += melodic.get(k) ?? 0;
      assert.ok(count <= 1, `L${d.id} k${n.k}: her half bar has ${count} notes`);
    }
    const late = lead.filter((n) => barOf(n.k) >= P.closeFrom && SCORES[d.id].sections.find((q) => q.id === "coda")?.from !== barOf(n.k));
    assert.deepEqual(late, [], `L${d.id}: the closing theme is the Signal's`);
  }
});

test("the lead's phrases come in order through the gaps: the hook before its answer", () => {
  for (const d of LEVELS) {
    const T = tuneFor(d.key),
      plan = leadPlan(d.id, T);
    const bars = T.lead.map(parseBar);
    let i = 0;
    for (const [, notes] of [...plan.entries()].sort((a, b) => a[0] - b[0])) {
      const phrase = bars[i % bars.length];
      for (const n of notes) assert.ok(phrase.some((q) => q.at === n.at && q.midi === n.midi), `L${d.id}: phrase ${i % 4} in order`);
      i++;
    }
    assert.ok(i >= 4, `L${d.id}: the whole lead (A B A' C) is heard at least once (${i} bars)`);
  }
});

test("the kit rests where the preset's groove rests, and I has no drums at all", () => {
  for (const d of LEVELS) {
    const P = SCORES[d.id];
    for (const n of ticks(createTune({ level: d.id }), P.bars).filter((q) => q.part === "kit")) {
      const sec = P.sections.find((q) => barOf(n.k) >= q.from && barOf(n.k) <= q.to);
      assert.notEqual(sec?.pulse, false, `L${d.id} bar ${barOf(n.k)} (${sec?.id}) rests`);
      assert.ok(barOf(n.k) >= 3);
    }
  }
  assert.equal(ticks(createTune({ level: 1 }), SCORES[1].bars).filter((n) => n.part === "kit").length, 0);
});

test("every note sits on a whole sixteenth of the level's grid; a fall's first bar back has no lead", () => {
  const t = createTune({ level: 2 });
  for (let k = 0; k < 20 * BAR; k++) for (const n of t.tick(k)) assert.ok(Number.isInteger(n.pos) && n.pos === k);
  const plan = [...leadPlan(2).keys()];
  const bar = plan[2];
  t.restart((bar - 1) * BAR + 3); // control returns inside that bar
  for (let k = (bar - 1) * BAR; k < bar * BAR; k++) assert.equal(t.tick(k).filter((n) => n.part === "lead").length, 0);
  t.reset();
  assert.ok(Array.from({ length: BAR }, (_, i) => t.tick((bar - 1) * BAR + i)).flat().some((n) => n.part === "lead"));
});

test("the bass and lead helpers: slash chords keep their pedal, the lead stays in its register", () => {
  assert.equal(bassNote(CHORDS["G/F#"], "R"), 42);
  assert.equal(bassNote(CHORDS.D, "8"), 50);
  assert.ok(CHORDS.Bm.tones.includes(pc(bassNote(CHORDS.Bm, "5"))));
  for (const m of [50, 60, 74, 90]) {
    const f = fitLead(CHORDS.G, m, 62, 79);
    assert.ok(f >= 62 - 1 && f <= 79 + 1 && isSafe(CHORDS.G, f), `${m} -> ${f}`);
  }
  assert.deepEqual(MELODIC, ["star", "chain-note", "constellation", "checkpoint"]);
});
