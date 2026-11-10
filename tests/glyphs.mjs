/** Follow a world glyph the way a player reads it, starting at the first
 * moment it can be followed (x >= prompt.from), then hand control back to a
 * route pilot. Used by the "following each glyph succeeds" test.
 *   ↑        jump when grounded
 *   ↑ ↑      jump, then jump again near the top (vy >= -40)
 *   ↑ · →    jump, then open the cape near the top
 *   → · ↑    open the cape when airborne, jump 0.1 s later (super jump)
 *   hold →   press and hold the cape until the prompt's window ends
 *   ↑ · hold →  jump, then press the cape near the top (as ↑ · →) and hold
 *              it until the window ends
 *   ↓        dive
 *   tap ↑    jump and release at once
 * Options: { at: 'from' | 'inputX', start: x, tap: true } (tap releases a
 * jump at once; `start` probes an arbitrary first input x).
 */
import { createRouteMemory, chooseAction } from "./routes.mjs";
export function followGlyph(api, prompt, { route = "main", at = "from", start: forced, tap = false, dt = 1 / 120, until = 600 } = {}) {
  const start = forced ?? (at === "inputX" ? prompt.inputX : prompt.from);
  // The route pilot hands over at the glyph's own window (or earlier when
  // probing an earlier start), so it never takes the jump the glyph covers.
  const handover = Math.min(start, prompt.from) - 1;
  // "tap-up" is a jump released at once (L1's stepping stones).
  const g = prompt.glyph.filter((k) => k !== "then");
  const m = createRouteMemory(route);
  let s = api.getState(),
    phase = "approach",
    step = 0,
    since = 0,
    glide = false;
  const act = (name) => {
    api[name]();
    if (name === "jump" && tap) api.releaseJump();
  };
  for (let i = 0; i < 120 / dt && s.status === "running"; i++) {
    const p = s.player;
    if (phase === "approach" && p.x >= handover) phase = "wait";
    if (phase === "wait" && p.x >= start - 1) phase = "glyph";
    if (phase === "approach") {
      const a = chooseAction(s, m);
      if (a) api[a]();
      glide = m.glide;
    } else if (phase === "glyph") {
      const k = g[step],
        prev = g[step - 1];
      since += dt;
      let done = false;
      if (k === "tap-up") {
        if (p.grounded || s.coyote > 0) (api.jump(), api.releaseJump(), (done = true));
      } else if (k === "up") {
        if (step === 0) {
          if (p.grounded || s.coyote > 0) (act("jump"), (done = true));
        } else if (prev === "right") {
          if (since >= 0.1) (act("jump"), (done = true));
        } else if (p.vy >= -40) (act("jump"), (done = true));
      } else if (k === "right") {
        if (step === 0 ? !p.grounded : p.vy >= -40) (act("dash"), (done = true));
      } else if (k === "hold-right") {
        // After ↑ the cape is pressed near the top, as ↑ · → teaches.
        if (!glide && !p.grounded && (prev !== "up" || p.vy >= -40)) {
          api.dash(); // pressing → is the same key that dashes elsewhere
          glide = true;
        }
        if (p.x > prompt.to) ((glide = false), (done = true));
      } else if (k === "down") {
        if (api.dive()) done = true;
      }
      if (done) {
        step++;
        since = 0;
        if (step >= g.length) {
          phase = "after";
          m.i = -1;
        }
      }
    } else {
      if (p.x > prompt.to) {
        const a = chooseAction(s, m);
        if (a) api[a]();
        glide = m.glide;
      }
      if (p.x > prompt.to + until) break;
    }
    s = api.step(dt, { glide }, { render: false });
  }
  return { status: s.status, x: s.player.x, phase };
}
