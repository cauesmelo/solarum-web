/* The automatic end-of-level transition (RESEARCH_TRANSITIONS §2-3): its
 * beat plan, the picture's parameters at any time, the tally and the save
 * (version 3). Pure: game.js draws what frameAt() returns, so the timeline,
 * reduced motion and the tally math are tested in Node.
 *
 * Time t is real seconds since A0, the beat on which the door chord sounds
 * (the model's `win`). b and c are the finished and the next level's beats
 * (60 / (BPM × pace)); phase A is four beats of b, phase B the next level's
 * count-in, four beats of c, and B4 is bar 1 of the next level. Every visual
 * is locked to these beats, never to fixed seconds. */
import { LEVELS, readSave as readSaveV2 } from "./level.mjs";

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const ease = Object.freeze({
  linear: (u) => clamp01(u),
  outCubic: (u) => 1 - (1 - clamp01(u)) ** 3,
  inCubic: (u) => clamp01(u) ** 3,
  inQuad: (u) => clamp01(u) ** 2,
  inOutCubic: (u) => ((u = clamp01(u)), u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  inOutSine: (u) => -(Math.cos(Math.PI * clamp01(u)) - 1) / 2,
  outQuart: (u) => 1 - (1 - clamp01(u)) ** 4,
  smooth: (u) => ((u = clamp01(u)), u * u * (3 - 2 * u)),
});
const span = (t, a, b) => (b > a ? clamp01((t - a) / (b - a)) : t >= b ? 1 : 0);

/** Beats of one transition. `last`: the journey's ending (§2.8) instead of
 * a next level; `credits`: whether its credits still play (first completion). */
export function transitionPlan({ bpmFrom, bpmTo = bpmFrom, pace = 1, last = false, credits = false } = {}) {
  const b = 60 / (bpmFrom * pace),
    c = 60 / (bpmTo * pace),
    A = Array.from({ length: 9 }, (_, k) => k * b),
    B = Array.from({ length: 6 }, (_, k) => 4 * b + k * c);
  if (!last) return { b, c, A, B, last: false, total: B[4], lockout: A[1] };
  // The ending, at the last tempo (a bar is 4b, A0 is bar 0): the final
  // tally on bar 2 (A8) holds through bar 4; first completion only, five
  // credit cards of 1.5 bars each from bar 4; then the title fades in over
  // one bar (about 13 bars with credits, 5 without).
  const bar = 4 * b,
    cards = credits ? CREDITS.length : 0,
    creditsAt = 4 * bar,
    titleAt = credits ? Math.ceil(4 + cards * 1.5) * bar : 4 * bar;
  return { b, c: b, A, B: A.slice(4), last: true, bar, tallyAt: 2 * bar, creditsAt, cards, titleAt, total: titleAt + bar, lockout: A[1] };
}
/** The credit cards (DOM, paper on ink, one at a time). */
export const CREDITS = Object.freeze([
  { logo: true, text: "Solarum" },
  { text: "A Signal in the Dark" },
  { text: "Cauê Melo · Daniel Calônico · Lucas Santos · Rafael Lima" },
  { text: "Soundtrack: Amanda (meromei) · Bruno Mareto (Bu Maré)" },
  { text: "Thank you for playing." },
]);
/** The phase QA reads: door (A0-A2), space (A2-B2), arrive (B2-B4), null
 * after; the ending: door, space, tally (bar 2-4), credits, title. */
export function phaseAt(plan, t) {
  if (t < 0) return null;
  const { A, B } = plan;
  if (plan.last) {
    if (t < A[2]) return "door";
    if (t < plan.tallyAt) return "space";
    if (t < plan.creditsAt) return "tally";
    if (t < plan.titleAt) return "credits";
    return t < plan.total ? "title" : null;
  }
  if (t < A[2]) return "door";
  if (t < B[2]) return "space";
  if (t < B[4]) return "arrive";
  return null;
}

/** Everything the picture needs at time t (§2.3, §3, §2.9). Reduced motion
 * keeps the same beats: only zoom, travel, motes and the count-up go. */
export function frameAt(plan, t, { reduced = false } = {}) {
  const { b, c, A, B } = plan;
  const f = { t, phase: phaseAt(plan, t), reduced };
  // The door's light: a front rising from the threshold over one beat.
  f.light = reduced ? (t >= 0 ? 1 : 0) : ease.outCubic(t / b);
  f.rings = reduced ? [] : [A[0], A[1]].map((at) => (t - at) / (1.2 * b)).filter((u) => u >= 0 && u <= 1).map((u) => ({ r: 24 + 196 * ease.outCubic(u), alpha: 0.55 * (1 - u), width: 2 - u }));
  // Diana becomes light (A1-A2); under reduced motion she stays until the world fades.
  f.diana = reduced ? 1 - span(t, A[2], A[3]) : 1 - span(t, A[1], A[2]);
  // The old world fades A2-A3 (the ending: the same).
  f.world = 1 - span(t, A[2], A[3]);
  // Pull-back about the door: z 1 -> 0.55 over A1-A3 (the ending: 0.35 over A1-A5).
  const deep = plan.last;
  const e = reduced ? 0 : ease.inOutCubic(span(t, A[1], deep ? A[5] : A[3]));
  f.zoom = 1 - (deep ? 0.65 : 0.45) * e;
  f.anchor = e; // the door glides from its screen point toward (0.5 W, 0.58 H)
  f.motes = !reduced && t >= A[1];
  // The sky camera advances an extra 0.6 W from A3 to B2.
  f.skyTravel = reduced || deep ? 0 : 0.6 * ease.inOutSine(span(t, A[3], B[2]));
  f.hudOld = 1 - span(t, 0, 0.5 * b);
  if (deep) return endingFrame(plan, t, f);
  // Bodies: the old one leaves on its arc (A2-B1), the new one arrives (A2.5-B2).
  f.oldBody = { u: reduced ? (t >= A[2] ? 1 : 0) : ease.inOutSine(span(t, A[2], B[1])), alpha: 1 - span(t, B[3], B[4]), shown: t >= 0 };
  if (reduced) f.oldBody.cross = span(t, A[2], A[3]);
  f.newBody = { u: reduced ? 1 : ease.outCubic(span(t, A[2] + b / 2, B[2])), alpha: reduced ? span(t, A[2], A[3]) : t >= A[2] + b / 2 ? 1 : 0 };
  // The dotted orbit line draws itself A2-A3; the leaf marker slides A3-B2.
  f.orbit = { draw: reduced ? (t >= A[2] ? 1 : 0) : span(t, A[2], A[3]), alpha: (reduced ? span(t, A[2], A[3]) : t >= A[2] ? 1 : 0) * (1 - span(t, B[3], B[4])), leaf: reduced ? 1 : ease.inOutSine(span(t, A[3], B[2])) };
  // The tally fades in A2-A2.5 and out B2.5-B3; the journey row counts A3-A4.
  f.tally = span(t, A[2], A[2] + b / 2) * (1 - span(t, B[2] + c / 2, B[3]));
  f.count = reduced ? 1 : span(t, A[3], A[4]);
  f.swapped = t >= B[0];
  // The new world: a push-in 1.12 -> 1 (easeOutQuart over 2c) and a
  // smoothstep fade, B2-B4, framed exactly as the run will be.
  f.newWorld = ease.smooth(span(t, B[2], B[4]));
  f.push = reduced ? 1 : 1.12 - 0.12 * ease.outQuart(span(t, B[2], B[4]));
  f.arrivalLight = t >= B[2] ? 0.85 : 0;
  f.newDiana = span(t, B[3], B[4]);
  f.hudNew = span(t, B[3], B[4]);
  f.controls = t < A[1] || t >= B[3];
  f.card = t >= B[2];
  return f;
}
function endingFrame(plan, t, f) {
  const { A, bar } = plan;
  // The Moon's limb sinks 0.5 H (easeInCubic, A2-A6); Earth turns to face
  // her (A2-A8): it grows to (0.5 W, 0.42 H), r 0.2 H, and the ink disc
  // that makes it a crescent slides off (0.42 r -> 1.6 r).
  f.moonSink = f.reduced ? 1 : ease.inCubic(span(t, A[2], A[6]));
  f.earth = f.reduced ? 1 : ease.inOutCubic(span(t, A[2], A[8]));
  f.earthAlpha = f.reduced ? span(t, A[2], A[3]) : 1;
  f.tally = span(t, plan.tallyAt, plan.tallyAt + plan.b / 2) * (1 - span(t, plan.creditsAt - plan.b, plan.creditsAt));
  f.count = f.reduced ? 1 : span(t, plan.tallyAt, plan.tallyAt + plan.b * 4);
  f.credit = null;
  if (plan.cards && t >= plan.creditsAt && t < plan.creditsAt + plan.cards * 1.5 * bar) {
    const k = Math.floor((t - plan.creditsAt) / (1.5 * bar)),
      u = t - plan.creditsAt - k * 1.5 * bar;
    f.credit = { index: k, alpha: Math.min(span(u, 0, bar / 4), 1 - span(u, 1.25 * bar, 1.5 * bar)) };
  }
  f.title = span(t, plan.titleAt, plan.titleAt + bar);
  f.controls = t < A[1];
  f.swapped = false;
  return f;
}

/** The count-up: from the save's old total to the new one in at most 12
 * integer steps (text is set per step, never per frame). */
export function countUp(from, to, u) {
  if (!(to > from)) return to;
  const steps = Math.min(12, to - from),
    k = Math.floor(clamp01(u) * steps + 1e-9);
  return from + Math.round(((to - from) * k) / steps);
}

/* ---------- the save, version 3 (§2.11) ---------- */
export const SAVE_V3 = 3;
const byKey = (levels, o) => Object.fromEntries(levels.filter((d) => o?.[d.key] != null).map((d) => [d.id, o[d.key]]));
const byId = (levels, o) => Object.fromEntries(levels.filter((d) => o?.[d.id] != null).map((d) => [d.key, o[d.id]]));
const count = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
/** Read any save: v3 as is (unknown fields tolerated), v1/v2 through
 * level.mjs, then migrated to v3 with stars {}, falls 0, credits false (so
 * journey stars start at 0 for levels finished before the update). */
export function readSave(raw, levels = LEVELS) {
  if (raw && typeof raw === "object" && raw.v === SAVE_V3 && Number.isInteger(raw.unlocked)) {
    const numbers = (o) => Object.fromEntries(Object.entries(byKey(levels, o)).map(([k, v]) => [k, count(v)]));
    return {
      unlocked: Math.max(1, Math.min(levels.length, raw.unlocked)),
      great: numbers(raw.great),
      done: Object.fromEntries(Object.entries(byKey(levels, raw.done)).map(([k, v]) => [k, !!v])),
      stars: numbers(raw.stars),
      falls: count(raw.falls),
      credits: !!raw.credits,
      relics: Array.isArray(raw.relics) ? raw.relics.filter((v) => typeof v === "string") : [],
    };
  }
  const v2 = readSaveV2(raw, levels);
  return { ...v2, stars: {}, falls: 0, credits: false, relics: [] };
}
export function writeSave(p, levels = LEVELS) {
  return { v: SAVE_V3, unlocked: p.unlocked, great: byId(levels, p.great), done: byId(levels, p.done), stars: byId(levels, p.stars), falls: count(p.falls), credits: !!p.credits, relics: [...(p.relics ?? [])] };
}
/** The journey: each level's best stars and Great Stars summed, every fall. */
export function journeyOf(p, levels = LEVELS) {
  let stars = 0,
    great = 0;
  for (const d of levels) {
    stars += p.stars?.[d.id] ?? 0;
    great += p.great?.[d.id] ?? 0;
  }
  return { stars, great, greatTotal: 3 * levels.length, falls: count(p.falls) };
}
/** Record a completed run at the door (A0), in place; returns the journey
 * before and after. Falls are already counted at each `death` event. */
export function recordWin(p, { level, stars, great }, levels = LEVELS) {
  const before = journeyOf(p, levels);
  p.stars ??= {};
  p.unlocked = Math.max(p.unlocked, Math.min(levels.length, level + 1));
  p.great[level] = Math.max(p.great[level] ?? 0, great);
  p.done[level] = true;
  p.stars[level] = Math.max(p.stars[level] ?? 0, stars);
  return { before, after: journeyOf(p, levels) };
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/** The tally's rows and its one announcement (§2.4). `run` is this run at
 * the door: stars carried, the level's star total, Great Stars banked and
 * this run's falls. */
export function tallyOf(def, run, journey, next = null) {
  const level = { name: `${def.numeral} · ${def.title}`, stars: run.stars, total: run.total, great: run.great, falls: run.falls };
  const say = `${level.name} complete. ${run.stars} of ${run.total} stars, ${run.great} of 3 Great Fallen Stars, ${plural(run.falls, "fall", "falls")}. Journey: ${journey.stars} stars, ${journey.great} of ${journey.greatTotal} Great Fallen Stars, ${plural(journey.falls, "fall", "falls")}.${next ? ` Next: ${next.numeral} · ${next.title}.` : ""}`;
  return { level, journey, say, falls: plural(run.falls, "fall", "falls"), journeyFalls: plural(journey.falls, "fall", "falls") };
}
/** The ending's line (§2.8): every Great Star of the campaign, or not. */
export const endingLine = (journey) => (journey.great >= journey.greatTotal ? "Earth, whole and blue, remembered every star." : "Earth. Small, blue, and listening. She was home.");
