/** The green preview and itch iframe display the identical game surface.
 * Solarum is keyboard only: the page has no fullscreen button to click. F
 * toggles fullscreen (itch.io's own fullscreen button belongs to its page). */
document.documentElement.classList.add("game-only");
const embedded =
  window.self !== window.top ||
  new URLSearchParams(location.search).get("embed") === "1";
if (embedded) document.documentElement.classList.add("itch-embed");
const surface = document.querySelector("main");
if (surface) {
  document.addEventListener("keydown", async (e) => {
    // A browser shortcut (Ctrl/Cmd+F is find) is not ours; a held key must not flicker.
    if (e.code !== "KeyF" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await surface.requestFullscreen();
    } catch {
      /* the host page may forbid it (no allowfullscreen): its own button remains */
    }
  });
  document.addEventListener("fullscreenchange", () => {
    window.dispatchEvent(new Event("resize"));
  });
}
