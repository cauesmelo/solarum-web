/** What the HUD and Diana show about the verbs she owns (RESEARCH_PROGRESSION
 * 2.3, 3.3). Pure readers of the model state, no DOM or canvas.
 *
 * The progression fields (`verbs`, `capeCharge`) arrive with the eight-level
 * model; before then they are absent, and every reader falls back to the
 * revision-seven behaviour: Diana wears the cape, the double jump is owned,
 * there is no breath bar and the spent cape is tinted at 60%. */
import { capeReady } from "./model.mjs";

const clamp01 = (u) => Math.max(0, Math.min(1, u));

/** Whether a verb is owned right now. With no `verbs` field, a level's
 * `def.verbs` decides (the double jump defaults to owned, as in the model's
 * ownedVerbs); with neither, everything is owned. */
export function owns(s, verb) {
  if (s.verbs) return !!s.verbs[verb];
  const v = s.def?.verbs?.[verb];
  return v ?? true;
}

/** The sprite set Diana is drawn with: a QA override, else the no-cape set
 * whenever the state lists its verbs and the cape is not among them, else the
 * level's own `sprites` (revision seven), else the cape. */
export function spriteSetName(s, override = null) {
  if (override) return override;
  if (s.verbs) return s.verbs.cape ? "cape" : "nocape";
  return s.def?.sprites ?? "cape";
}

/** The breath bar: null when it must be absent (the cape is not owned, or
 * the state has no `capeCharge` field), else { charge 0-1, full }. The
 * charge follows the model's snapshot rule: endless cape is always full, the
 * breath rule shows its continuous charge, other rules are full or empty. */
export function capeMeter(s) {
  if (s.verbs && !s.verbs.cape) return null;
  if (typeof s.capeCharge !== "number" || !Number.isFinite(s.capeCharge)) return null;
  if (s.assist?.endlessCape) return { charge: 1, full: true };
  // Under breath the bar is the rule itself (full at 1); other rules are
  // full or empty, as the model's capeReady says.
  if (s.capeRule === "breath") {
    const charge = clamp01(s.capeCharge);
    return { charge, full: charge >= 1 - 1e-9 };
  }
  const full = capeReady(s);
  return { charge: full ? 1 : 0, full };
}

/** The four steps of the cape tint (RESEARCH_PROGRESSION 3.3): the share of
 * --dim laid over the cape, 60% at an empty bar, then 45, 30 and 15% at each
 * quarter, clear when full. Quarter steps are display only: the charge stays
 * continuous. */
export const TINT_STEPS = Object.freeze([0.6, 0.45, 0.3, 0.15]);
export function tintForCharge(charge) {
  if (charge >= 1 - 1e-9) return 0;
  return TINT_STEPS[Math.max(0, Math.min(3, Math.floor(clamp01(charge) * 4 + 1e-9)))];
}

/** The tint Diana's cape wants this frame: none while she flies (the cape
 * is out), none without a cape; with a breath bar its step, else today's
 * 60% when spent. */
export function capeTint(s, set = spriteSetName(s), meter = capeMeter(s)) {
  if (set === "nocape") return 0;
  if (s.dashRemaining > 0.08) return 0;
  if (meter) return tintForCharge(meter.charge);
  return capeReady(s) ? 0 : 0.6;
}

/** The leaf glint (RESEARCH_PROGRESSION 2.1, MOVEMENT_AUDIT E2): the double
 * jump is in hand while it is owned and not yet spent in this airtime. The
 * model counts jumps per airtime in `player.jumps` (0 on the ground, 1 after
 * the first jump or a coyote walk-off, 2 once the double or a super jump is
 * spent), and any landing resets it. */
export function doubleInHand(s) {
  if (s.status !== "running") return false;
  if (!owns(s, "double")) return false;
  return (s.player?.jumps ?? 0) < 2;
}

/** The one hint kept in play (owner, 2026-11-10: "Need a hand? Assists are in
 * the pause menu." came back after every respawn in the video, once she had
 * five falls at a beacon, and sat over the next attempt each time). It is
 * offered ONCE per level and session, on the first automatic respawn after
 * ASSIST_TIP_FALLS falls in a row at one beacon (`fallsHere` resets at the next
 * beacon), never after the player's own Back to last light, and never when an
 * assist is already on: a struggling player is told where help is, not
 * nagged. `shown` is the set of level ids already told. */
export const ASSIST_TIP_FALLS = 5;
export function assistTipDue({ fallsHere, level, shown, assistOn = false, source = "beacon" }) {
  return source !== "retry" && !assistOn && fallsHere >= ASSIST_TIP_FALLS && !shown?.has(level);
}
