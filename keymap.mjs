/** Every key the game answers, per screen, as data (the keyboard is the only
 * input: Solarum has no mouse or touch). game.js asks these tables what a key
 * means and does the action; the tests pin the tables, and the on-screen key
 * hints are written from the same names.
 *
 *   title    Space / Enter / Up / W wake · Left / Right choose an open level
 *            · C credits · M sound · F fullscreen
 *   credits  Esc / C / Backspace / Enter / Space close
 *   play     Space / Up / W jump · Right / D cape (hold: float) · Down / S dive
 *            · Esc / P pause · R back to the last light · Shift+R restart
 *            · M sound · F fullscreen
 *   pause    Up / Down (or Left / Right off a slider, or Tab) move the cursor · Enter /
 *            Space press · Esc / P continue (or back from Assist) · Left /
 *            Right on a slider change it by one step
 *   tally    R again · Esc / P pause · any other key skips · M, F still work
 *   error    R / Enter / Space try again */
export const WAKE_KEYS = Object.freeze(["Space", "Enter", "ArrowUp", "KeyW"]);
export const PRESS_KEYS = Object.freeze(["Enter", "Space"]);
export const BACK_KEYS = Object.freeze(["Escape", "KeyP"]);
export const CREDITS_CLOSE_KEYS = Object.freeze(["Escape", "KeyC", "Backspace", "Enter", "Space"]);
/** Keys that are not "a press" for skipping the tally or waking: they act on
 * the page, not the game (fullscreen is embed.js's, sound is game.js's). */
export const PAGE_KEYS = Object.freeze(["KeyF", "KeyM"]);

/** A key on the title (no card open): what it does. */
export function titleKey(code) {
  if (WAKE_KEYS.includes(code)) return "wake";
  if (code === "ArrowLeft") return "level-prev";
  if (code === "ArrowRight") return "level-next";
  if (code === "KeyC") return "credits";
  if (code === "KeyM") return "sound";
  return null;
}
/** A key on the pause card: { move: ±1 } | { press } | { back } | { native }
 * (the slider's own Left / Right) | null. `slider` is true when the cursor is
 * on a volume slider. */
export function pauseKey(code, { slider = false, shift = false } = {}) {
  if (BACK_KEYS.includes(code)) return { back: true };
  if (code === "Tab") return { move: shift ? -1 : 1 };
  if (slider && ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(code)) return { native: true };
  if (code === "ArrowUp" || code === "ArrowLeft") return { move: -1 };
  if (code === "ArrowDown" || code === "ArrowRight") return { move: 1 };
  if (!slider && PRESS_KEYS.includes(code)) return { press: true };
  return null;
}
/** The cursor's next index in a menu of `count` items, wrapping. */
export function menuStep(count, index, delta) {
  return count > 0 ? (((index + delta) % count) + count) % count : -1;
}
/** Whether a level may be chosen on the title: open (unlocked) and in range. */
export function canChoose(level, unlocked, count) {
  return Number.isInteger(level) && level >= 1 && level <= Math.min(unlocked, count);
}
