/** The DOM side of the hand-drawn UI marks (geometry lives in ink-mark.mjs).
 *
 * A host element opts in with `data-ink="<kind>"`. The glue puts one SVG
 * behind its content (z-index -1 inside the host, which `style.css` makes an
 * isolated stacking context), asks the kind for its paths at the host's
 * measured size, and repaints when the host resizes, when its state changes
 * (`refresh`) and when the boil steps (`boil`). Seeds come from the host
 * (`data-ink` + `data-n` or id), so a mark is the same on every frame and
 * every load: only the boil's phase (0-3) moves, a few tenths of a pixel,
 * and only at the cadence of the panel's `ink-wobble` filter (8 fps, never
 * under reduced motion).
 *
 * A kind returns a list of { d, cls }: `cls` picks the fill colour in
 * style.css (the original monochrome palette and Earth's blue only). The
 * "ink-focus" paths show only on the element holding the keyboard cursor
 * (`.is-cursor`), which is how every screen shows where the keys act: a
 * second, looser loop drawn round the element by the same hand. */
import * as mark from "./ink-mark.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const { hashSeed } = mark;

/** The pen widths, px. The panel's own line is 2 px. */
const W = { ring: 2.4, link: 2.2, loop: 2.5, focus: 2.2 };

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const tagOf = (el) => el.dataset.n ?? el.id ?? el.dataset.assist ?? el.textContent.trim().slice(0, 18);

/** Kind name -> (el, { w, h, phase, seed }) => [{ d, cls }]. */
export const KINDS = {
  // A level on the orbit line: an open ring, the selected level's filled disc
  // inside a second ring (the old box-shadow pair), or a dashed ring when locked.
  stop(el, { w, h, phase, seed }) {
    const cx = w / 2,
      cy = h / 2,
      r = Math.min(w, h) / 2 - 2.2;
    if (el.dataset.locked === "true") return [{ d: mark.dashedRing({ seed, cx, cy, r, width: W.ring - 0.2, phase }).d, cls: "ink-dim" }];
    if (el.dataset.selected === "true")
      return [
        { d: mark.blob({ seed, cx, cy, r: r - 0.6, phase }).d, cls: "ink-paper" },
        { d: mark.ring({ seed: hashSeed(seed, "outer"), cx, cy, r: r + 4.4, width: W.ring - 0.3, phase }).d, cls: "ink-paper" },
      ];
    return [{ d: mark.ring({ seed, cx, cy, r, width: W.ring, phase }).d, cls: "ink-paper" }];
  },
  // The orbit between two levels: dotted ahead of the journey, a drawn line behind it.
  link(el, { w, h, phase, seed }) {
    const y = h / 2;
    if (el.dataset.kind === "solid") return [{ d: mark.line({ seed, x0: 0, x1: w, y0: y, width: W.link, amp: 0.6, phase }).d, cls: "ink-hill" }];
    return [{ d: mark.dots({ seed, x0: 0.8, x1: w - 0.8, y0: y, r: 1.35, spacing: 4.2, phase }).d, cls: "ink-dim" }];
  },
  // Earth, the end of the orbit: a blue disc ringed in paper, both a little off round.
  earth(el, { w, h, phase, seed }) {
    return [
      { d: mark.blob({ seed, cx: w / 2, cy: h / 2, r: w / 2 - 3.6, phase }).d, cls: "ink-earth" },
      { d: mark.ring({ seed: hashSeed(seed, "rim"), cx: w / 2, cy: h / 2, r: w / 2 - 1.6, width: 1.7, phase }).d, cls: "ink-paper" },
    ];
  },
  // The wake pill: a paper plate, a ring a few px outside it, and a second,
  // fainter ring that breathes (the old box-shadow pulse), all by hand.
  pill(el, { w, h, phase, seed }) {
    return [
      { d: mark.plate({ seed, w, h, radius: h / 2, phase }).d, cls: "ink-paper" },
      { d: mark.loop({ seed: hashSeed(seed, "ring"), w: w + 9, h: h + 9, radius: h / 2 + 4.5, width: 2.2, phase }).d, cls: "ink-paper", at: [-4.5, -4.5] },
      { d: mark.loop({ seed: hashSeed(seed, "breath"), w: w + 19, h: h + 19, radius: h / 2 + 9.5, width: 1.8, phase }).d, cls: "ink-paper ink-breath", at: [-9.5, -9.5] },
    ];
  },
  // A paper-card button: an outline (a filled plate when it is the primary
  // action) and, under the keyboard cursor, a looser loop round it.
  btn(el, { w, h, phase, seed }) {
    const primary = el.classList.contains("primary"),
      radius = Math.min(17, h / 2);
    return [
      { d: mark.plate({ seed, w, h, radius, phase }).d, cls: primary ? "ink-ink" : "ink-paper" },
      { d: mark.loop({ seed: hashSeed(seed, "edge"), w, h, radius, width: W.loop, phase }).d, cls: "ink-ink" },
      { d: mark.loop({ seed: hashSeed(seed, "focus"), w: w + 14, h: h + 14, radius: radius + 7, width: W.focus, phase, overlap: 0.11 }).d, cls: "ink-ink ink-focus", at: [-7, -7] },
    ];
  },
  // An assist toggle: a frame, an ink disc behind its star when on, a cursor loop.
  toggle(el, { w, h, phase, seed }) {
    const on = el.getAttribute("aria-pressed") === "true";
    const out = [
      { d: mark.loop({ seed, w, h, radius: 15, width: 2.2, phase }).d, cls: "ink-ink" },
      { d: mark.loop({ seed: hashSeed(seed, "focus"), w: w + 14, h: h + 14, radius: 22, width: W.focus, phase, overlap: 0.11 }).d, cls: "ink-ink ink-focus", at: [-7, -7] },
    ];
    if (on) out.push({ d: mark.blob({ seed: hashSeed(seed, "on"), cx: 25, cy: h / 2, r: 11.5, phase }).d, cls: "ink-ink ink-under" });
    return out;
  },
  // A volume slider's track and thumb. The native range input beside it
  // (visually hidden) is the value and takes the arrow keys; this only draws it.
  track(el, { w, h, phase, seed }) {
    const input = document.getElementById(el.dataset.for),
      R = 12,
      lo = num(input?.min, 0),
      hi = num(input?.max, 100),
      f = hi > lo ? (num(input?.value, hi) - lo) / (hi - lo) : 1,
      x = R + f * (w - 2 * R),
      y = h / 2;
    return [
      { d: mark.line({ seed, x0: 1, x1: w - 1, y0: y, width: 3.1, amp: 0.8, phase }).d, cls: "ink-ink" },
      { d: mark.blob({ seed: hashSeed(seed, "thumb"), cx: x, cy: y, r: R - 1, phase }).d, cls: "ink-paper-card" },
      { d: mark.ring({ seed: hashSeed(seed, "thumb"), cx: x, cy: y, r: R - 1.2, width: 2.4, phase }).d, cls: "ink-ink" },
    ];
  },
  // The row a slider sits in: only its cursor loop.
  row(el, { w, h, phase, seed }) {
    return [{ d: mark.loop({ seed, w: w + 12, h: h + 4, radius: 20, width: W.focus, phase, overlap: 0.11 }).d, cls: "ink-ink ink-focus", at: [-6, -2] }];
  },
  // A key cap round a key's name, in the host's own colour.
  cap(el, { w, h, phase, seed }) {
    return [{ d: mark.loop({ seed, w, h, radius: Math.min(6, h / 2), width: 1.5, phase }).d, cls: "ink-cur" }];
  },
  // A hand-drawn underline under a word.
  underline(el, { w, h, phase, seed }) {
    return [{ d: mark.line({ seed, x0: 0, x1: w, y0: h - 3, width: 1.7, amp: 0.5, phase }).d, cls: "ink-cur" }];
  },
  // An arrow key, drawn: up, down, left or right.
  arrow(el, { w, h, phase, seed }) {
    return [{ d: mark.arrow({ seed, dir: el.dataset.dir, size: Math.min(w, h) - 2, cx: w / 2, cy: h / 2, width: 1.7, phase }).d, cls: "ink-cur" }];
  },
  // The side marks of the level name: there is another level to the left or right.
  chevron(el, { w, h, phase, seed }) {
    return [{ d: mark.chevron({ seed, dir: el.dataset.dir, size: Math.min(w, h) - 4, cx: w / 2, cy: h / 2, width: 2, phase }).d, cls: "ink-hill" }];
  },
  // The sound badge's ring (and its slash when the sound is off).
  badge(el, { w, h, phase, seed }) {
    const out = [{ d: mark.ring({ seed, cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2 - 2.4, width: W.ring, phase }).d, cls: "ink-ink" }];
    if (el.classList.contains("off")) out.push({ d: mark.line({ seed: hashSeed(seed, "slash"), x0: w * 0.24, y0: h * 0.76, x1: w * 0.76, y1: h * 0.24, width: 2.6, amp: 0.4, phase }).d, cls: "ink-ink" });
    return out;
  },
  // The four corners of the fullscreen hint.
  corners(el, { w, h, phase, seed }) {
    const m = 3,
      a = 7,
      corner = (i, pts) => ({ d: mark.stroke({ seed: hashSeed(seed, i), points: pts, width: 2.4, amp: 0.2, phase, taper: false }).d, cls: "ink-ink" });
    return [
      corner(0, [[m, m + a], [m, m], [m + a, m]]),
      corner(1, [[w - m - a, m], [w - m, m], [w - m, m + a]]),
      corner(2, [[w - m, h - m - a], [w - m, h - m], [w - m - a, h - m]]),
      corner(3, [[m + a, h - m], [m, h - m], [m, h - m - a]]),
    ];
  },
  // A notch on the breath bar: a short upright pen stroke.
  notch(el, { w, h, phase, seed }) {
    return [{ d: mark.line({ seed, x0: w / 2, y0: 0, x1: w / 2, y1: h, width: 2.1, amp: 0.35, phase }).d, cls: "ink-ink" }];
  },
};

export function createInk({ reduced = false, doc = typeof document === "undefined" ? null : document } = {}) {
  const marks = new Map(); // host element -> mark record
  let phase = 0;
  const resizer = typeof ResizeObserver === "function" ? new ResizeObserver((entries) => entries.forEach((e) => measure(marks.get(e.target)))) : null;

  function measure(m) {
    if (!m) return;
    const w = m.el.offsetWidth,
      h = m.el.offsetHeight;
    if (w !== m.w || h !== m.h) {
      m.w = w;
      m.h = h;
      paint(m);
    }
  }
  function paint(m) {
    if (!m.w || !m.h) return; // display: none (a closed card): paint when it opens and the observer fires
    const paths = KINDS[m.kind](m.el, { w: m.w, h: m.h, phase, seed: m.seed });
    while (m.g.childNodes.length > paths.length) m.g.lastChild.remove();
    paths.forEach((p, i) => {
      let node = m.g.childNodes[i];
      if (!node) m.g.append((node = doc.createElementNS(SVG_NS, "path")));
      if (node.getAttribute("d") !== p.d) node.setAttribute("d", p.d);
      if (node.getAttribute("class") !== p.cls) node.setAttribute("class", p.cls);
      const at = p.at ? `translate(${p.at[0]} ${p.at[1]})` : "";
      if ((node.getAttribute("transform") ?? "") !== at) at ? node.setAttribute("transform", at) : node.removeAttribute("transform");
    });
  }
  /** Forget hosts that have left the page (the legend and the level name are
   * rebuilt): their SVG goes with them, but the records would not. */
  function prune() {
    for (const [el] of marks)
      if (!el.isConnected) {
        resizer?.unobserve(el);
        marks.delete(el);
      }
  }
  function attach(el) {
    const kind = el.dataset.ink;
    if (!doc || !KINDS[kind] || marks.has(el)) return null;
    const svg = doc.createElementNS(SVG_NS, "svg"),
      g = doc.createElementNS(SVG_NS, "g");
    svg.setAttribute("class", "ink");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.append(g);
    el.prepend(svg);
    const m = { el, kind, g, w: 0, h: 0, seed: hashSeed(kind, tagOf(el)) };
    marks.set(el, m);
    resizer?.observe(el);
    measure(m);
    return m;
  }
  return {
    attach,
    /** Attach every `[data-ink]` host at or under `root`. */
    scan(root = doc) {
      prune();
      for (const el of root.querySelectorAll("[data-ink]")) attach(el);
    },
    /** Repaint one host (its state changed: selected, locked, pressed, value). */
    refresh(el) {
      const m = marks.get(el);
      if (m) (measure(m), paint(m));
    },
    /** The boil: step every drawn mark (or those under `scope`) to the next of
     * four variants. Never under reduced motion, like the filter's seed. */
    boil(scope = null) {
      if (reduced) return 0;
      prune();
      phase = (phase + 1) % 4;
      let n = 0;
      for (const m of marks.values())
        if ((!scope || scope.contains(m.el)) && m.w) {
          paint(m);
          n++;
        }
      return n;
    },
    get phase() {
      return phase;
    },
    get count() {
      return marks.size;
    },
    /** The record of a host (QA and tests). */
    info: (el) => {
      const m = marks.get(el);
      return m && { kind: m.kind, seed: m.seed, w: m.w, h: m.h, paths: [...m.g.childNodes].map((p) => ({ d: p.getAttribute("d"), cls: p.getAttribute("class") })) };
    },
  };
}

/* ---------- the keyboard cursor ---------- */
let cursor = null;
/** The element that wears the cursor loop for a focused control: its row for
 * a slider, itself otherwise. */
const hostOf = (el) => el?.closest?.(".volume, .ink-btn, .toggle") ?? el;
/** Show the cursor loop on `el` (and take it off the last holder). */
export function setCursor(el) {
  const host = hostOf(el);
  if (host === cursor) return host;
  cursor?.classList.remove("is-cursor");
  cursor = host?.querySelector?.(":scope > .ink") ? host : null;
  cursor?.classList.add("is-cursor");
  return cursor;
}
export function clearCursor() {
  cursor?.classList.remove("is-cursor");
  cursor = null;
}
