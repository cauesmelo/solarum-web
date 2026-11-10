/** What the measured mix (tests/mix-measured.json) depends on: the mix rules,
 * the sky, the soundtrack's voices and its composer. scripts/mix-check.mjs
 * stamps the measurement with it; tests/mix.test.mjs fails when it no longer
 * matches (re-run the measurement). Event maps, cues and level data stay out,
 * so other squads' edits never stale it. */
import { createHash } from "node:crypto";
import { MIX, MIX_REV7, VOICES, TUNE_VOICES } from "../audio.mjs";
import { TUNES, createTune, leadPlan } from "../tune.mjs";

export function mixSignature() {
  const src = [VOICES.pad.build, ...Object.values(TUNE_VOICES).map((v) => v.build), createTune, leadPlan].map(String).join("\n");
  return createHash("sha256").update(JSON.stringify({ MIX, MIX_REV7, TUNES }) + src).digest("hex").slice(0, 16);
}
