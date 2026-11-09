/** The green preview and itch iframe display the identical game surface. */
document.documentElement.classList.add("game-only");
const embedded =
  window.self !== window.top ||
  new URLSearchParams(location.search).get("embed") === "1";
if (embedded) document.documentElement.classList.add("itch-embed");
const surface = document.querySelector("main");
if (surface) {
  const button = document.createElement("button");
  button.className = "itch-fullscreen";
  button.type = "button";
  button.title = "Fullscreen";
  button.setAttribute("aria-label", "Toggle fullscreen");
  // Drawn corner marks: the Solarum font has no fullscreen glyph.
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
  button.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await surface.requestFullscreen();
    } catch {
      button.title = "Use the host page fullscreen button";
    }
  });
  surface.append(button);
  document.addEventListener("fullscreenchange", () => {
    button.setAttribute("aria-pressed", String(!!document.fullscreenElement));
    window.dispatchEvent(new Event("resize"));
  });
}
