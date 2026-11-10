/** Solarum is a keyboard game: the mouse and touch screens do nothing.
 *
 * style.css already makes every element `pointer-events: none` and hides the
 * pointer; this is the belt to that braces. Every pointer, mouse and touch
 * event that still reaches the window (a click lands on the page, since
 * nothing in the game takes it) is stopped in the capture phase before any
 * handler can see it, so a stray listener, the host page's script or a
 * synthetic click can never act, and the events that would do something by
 * default (a click, a double click, the context menu, a drag, a selection, a
 * middle or right press) are cancelled.
 *
 * One default is deliberately left alone: the primary press (mouse button 0,
 * pointer down, touch start). That is the browser's own way of giving the page
 * (or the itch.io iframe) keyboard focus, and cancelling it would stop the
 * iframe getting focus at all, so keys would not work after a click on the
 * game. `afterPointer` runs once the press has been handled, so the game can
 * put keyboard focus back on the control its cursor is on (a press on the page
 * blurs it).
 *
 * `swallowed` counts what was stopped, by event type, for the QA hook
 * `__game.getInert()`: it proves a click arrived and did nothing. */
export const POINTER_EVENTS = Object.freeze(["pointerdown", "pointerup", "pointercancel", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "touchstart", "touchend", "touchcancel", "dragstart", "selectstart"]);

export function makeInert(win = window, { afterPointer = null, defer = (fn) => setTimeout(fn, 0) } = {}) {
  const swallowed = Object.fromEntries(POINTER_EVENTS.map((t) => [t, 0]));
  const sink = (e) => {
    swallowed[e.type]++;
    e.stopImmediatePropagation();
    const primaryPress = (e.type === "pointerdown" || e.type === "mousedown") && e.button === 0;
    // (A touch start is often not cancelable at all; a cancel attempt is only a console warning.)
    if (!primaryPress && e.type !== "touchstart" && e.cancelable !== false) e.preventDefault();
    if (afterPointer && ["pointerup", "mouseup", "touchend", "click"].includes(e.type)) defer(afterPointer);
  };
  // passive: false, or touch and wheel listeners cannot cancel their defaults.
  for (const type of POINTER_EVENTS) win.addEventListener(type, sink, { capture: true, passive: false });
  // A wheel or a two-finger scroll must not move or zoom the game either.
  const wheel = (e) => {
    swallowed.wheel = (swallowed.wheel ?? 0) + 1;
    if (e.cancelable !== false) e.preventDefault();
  };
  win.addEventListener("wheel", wheel, { capture: true, passive: false });
  return { swallowed, total: () => Object.values(swallowed).reduce((a, b) => a + b, 0) };
}
