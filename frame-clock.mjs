/** The browser's frame clock (MOVEMENT_AUDIT A2): it turns animation-frame
 * and input-event timestamps (ms on the performance.now() timebase) into the
 * real seconds to simulate. game.js advances the simulation to an input
 * event's own timestamp before applying it, so a press lands on the 1/120 s
 * tick its time falls in whatever the frame rate. (Applied at the last frame
 * boundary instead, a 30 Hz frame moved a takeoff up to 9 px and a 100 ms
 * hitch up to 27 px, and two presses in one frame fired on the same tick.)
 * A gap longer than `maxStep` (a long stall; a hidden tab pauses the game
 * anyway) is clamped, so the world slows down rather than jumping ahead.
 * Pure: no DOM, testable in Node. */
export function createFrameClock({ maxStep = 0.1 } = {}) {
  let last = null;
  return {
    /** Real seconds since the last timestamp, or 0 for the first one and for
     * one that is not newer (an event stamped before the frame already
     * simulated is applied at once, at most a frame late). */
    advance(now) {
      if (!Number.isFinite(now)) return 0;
      if (last === null || now <= last) {
        if (last === null) last = now;
        return 0;
      }
      const real = Math.min((now - last) / 1000, maxStep);
      last = now;
      return real;
    },
    get last() {
      return last;
    },
  };
}
