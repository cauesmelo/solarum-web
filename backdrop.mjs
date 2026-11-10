/** Per-level looks (RESEARCH_PROGRESSION 4.4): one backdrop body ahead and a
 * subtle sky accent per stop of the journey, drawn in code in the original
 * ink-and-paper line language. A level definition names its look (`look`);
 * without one the sky is exactly revision seven's (faint Saturn rings).
 *
 * Readability rules (each is tested in tests/backdrop.test.mjs):
 * - Only the palette tokens; --earth blue is used by Earth alone.
 * - Bodies sit behind the playfield and stay far below --mute brightness
 *   (paper at most 30% over ink inside a body, strokes at most 30%), so
 *   islands, stars, glyphs and Diana stay the brightest things.
 * - Nothing enters the 56 px HUD band: bodies are placed under it at full
 *   growth, and the accent layer is clipped below it.
 * - Bodies grow by `grow` (at most 25%) from the level's start to its door
 *   and drift by a small parallax; a body never crosses the playfield's
 *   readability because it is an opaque ink disc with faint paper marks.
 * - Under reduced motion every accent is drawn still.
 *
 * Units: logical view px (the view is 675 px tall, `W` wide) and seconds of
 * real time. Painters draw centred on (0, 0) at radius `r`; no DOM: the
 * renderer passes `makeCanvas` for the cached bodies, so this module also
 * loads in node for the tests. */

export const HUD_BAND = 56;
/** The palette (style.css :root); nothing else is drawn here. */
export const TOKENS = Object.freeze({ ink: [12, 12, 15], paper: [251, 251, 234], hill: [206, 206, 193], mute: [174, 174, 163], dim: [119, 119, 113], earth: [111, 168, 220] });
const rgba = (token, a) => `rgba(${TOKENS[token].join(",")},${a})`;

/** at: body centre as fractions of (W, H); radius: fraction of H at the
 * level's start; grow: extra radius at the door; stars/dust: sky density
 * factors; accent: the sky motif; earth: the only colour (moon-earth). */
export const LOOKS = Object.freeze({
  // I Home: the bright star ahead, a denser shower of the original shooting stars.
  home: Object.freeze({ body: "brightStar", at: [0.74, 0.3], radius: 0.034, grow: 0.25, stars: 1, dust: 1, accent: "shower" }),
  // II toward Pluto: a dark hatched dwarf with its pale heart; half the stars.
  pluto: Object.freeze({ body: "pluto", at: [0.77, 0.42], radius: 0.11, grow: 0.14, stars: 0.5, dust: 0.5, accent: null }),
  // III toward Neptune: wave bands and the dark oval; far stars wobble as if seen through water.
  neptune: Object.freeze({ body: "neptune", at: [0.73, 0.5], radius: 0.17, grow: 0.12, stars: 1, dust: 1, accent: "bubbles", wobble: 0.3 }),
  // IV toward Uranus: a pale disc tipped on its side in vertical rings; falling ice streaks.
  uranus: Object.freeze({ body: "uranus", at: [0.76, 0.48], radius: 0.12, grow: 0.12, stars: 1, dust: 1, accent: "ice" }),
  // V toward Saturn: low and wide, its rings drawn wide; the original
  // saturn.png's ring strokes sweep across the low sky as ring dust.
  saturn: Object.freeze({ body: "saturn", at: [0.8, 0.79], radius: 0.12, grow: 0.1, stars: 1, dust: 1, accent: "ringDust" }),
  // VI toward Jupiter: a huge banded disc with a hatched storm oval; long band streaks.
  jupiter: Object.freeze({ body: "jupiter", at: [0.82, 0.64], radius: 0.29, grow: 0.08, stars: 0.8, dust: 1, accent: "bands" }),
  // VII toward Mars: dense cross-hatch (the darkest hatch stands for red), dust streaks; the belt's rocks tumble far behind.
  mars: Object.freeze({ body: "mars", at: [0.75, 0.42], radius: 0.1, grow: 0.15, stars: 1, dust: 1, accent: "rocks" }),
  // VIII the Moon, then Earth: the cratered limb below, the most stars, Earth's crescent growing toward the door.
  "moon-earth": Object.freeze({ body: "moon", at: [0.5, 1.92], radius: 1.16, grow: 0.04, stars: 1.6, dust: 1.3, accent: "earth", earth: Object.freeze({ at: [0.86, 0.19], r0: 9, r1: 34 }) }),
});
export const LOOK_IDS = Object.freeze(Object.keys(LOOKS));

/** The look to draw: a QA override, else the level's `look`; null (revision
 * seven's sky) when neither names a known look. */
export function lookOf(def, override = null) {
  const id = override ?? def?.look ?? null;
  return id && LOOKS[id] ? id : null;
}

/** Where the body is: centre and radius in view px. `progress` 0-1 along
 * the level; `drift` is the parallax offset (camera travel since the start). */
export function bodyBox(id, { W, H, progress = 0, driftX = 0, driftY = 0 }) {
  const L = LOOKS[id];
  const grow = 1 + L.grow * Math.max(0, Math.min(1, progress));
  return { x: L.at[0] * W - driftX * 0.0025, y: L.at[1] * H - driftY * 0.03, r: L.radius * H * grow, grow };
}
/** How far above its centre a body draws (rings and halos reach past r). */
export function bodyReach(id, r) {
  return { home: r * 3.2, uranus: r * 1.8, saturn: r * 2.35, jupiter: r * 1.02 }[id] ?? r * 1.04;
}
/** How far above its centre a body draws (its top in the sky). */
export function bodyTop(id, r) {
  return { home: r * 3.2, uranus: r * 1.8, saturn: r * 1.04 }[id] ?? r * 1.04;
}
/** Earth in the last look: a crescent that grows from r0 to r1 toward the door. */
export function earthBox(id, { W, H, progress = 0 }) {
  const e = LOOKS[id]?.earth;
  if (!e) return null;
  const u = Math.max(0, Math.min(1, progress));
  return { x: e.at[0] * W, y: e.at[1] * H + 6 * (1 - u), r: e.r0 + (e.r1 - e.r0) * u * u };
}

/* ---------- painters (cached once per look) ---------- */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
/** A hand-drawn circle: radius wobbling by about 1%. */
function wobblyCircle(g, r, seed, wob = 0.012) {
  g.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2,
      k = 1 + wob * Math.sin(a * 3 + seed) + wob * 0.6 * Math.sin(a * 7 + seed * 2);
    const x = Math.cos(a) * r * k,
      y = Math.sin(a) * r * k;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}
/** Opaque ink base: stars behind a body are hidden, as behind a real one. */
function base(g, r, seed) {
  wobblyCircle(g, r, seed);
  g.fillStyle = rgba("ink", 1);
  g.fill();
}
function hatch(g, r, spacing, angle, alpha, width = 1) {
  g.save();
  g.rotate(angle);
  g.strokeStyle = rgba("paper", alpha);
  g.lineWidth = width;
  for (let y = -r; y <= r; y += spacing) {
    const half = Math.sqrt(Math.max(0, r * r - y * y));
    g.beginPath();
    g.moveTo(-half, y + (hash(y) - 0.5) * 0.8);
    g.lineTo(half, y + (hash(y + 9) - 0.5) * 0.8);
    g.stroke();
  }
  g.restore();
}
function outline(g, r, seed, alpha, width = 1.6) {
  wobblyCircle(g, r, seed);
  g.strokeStyle = rgba("paper", alpha);
  g.lineWidth = width;
  g.stroke();
}
const PAINT = {
  pluto(g, r) {
    base(g, r, 2);
    g.save();
    wobblyCircle(g, r, 2);
    g.clip();
    g.fillStyle = rgba("paper", 0.035);
    g.fillRect(-r, -r, 2 * r, 2 * r);
    // Ink on ink: one diagonal hatch, barely lighter than the sky.
    hatch(g, r, 4.5, -0.7, 0.07);
    // The heart-shaped plain: the only paper shape on Pluto.
    g.translate(r * 0.18, r * 0.22);
    g.rotate(-0.25);
    const s = r * 0.36;
    g.beginPath();
    g.moveTo(0, s * 0.9);
    g.bezierCurveTo(-s * 1.25, s * 0.15, -s * 0.85, -s * 0.85, 0, -s * 0.3);
    g.bezierCurveTo(s * 0.85, -s * 0.85, s * 1.25, s * 0.15, 0, s * 0.9);
    g.fillStyle = rgba("paper", 0.22);
    g.fill();
    g.restore();
    outline(g, r, 2, 0.2);
  },
  neptune(g, r) {
    base(g, r, 5);
    g.save();
    wobblyCircle(g, r, 5);
    g.clip();
    g.fillStyle = rgba("paper", 0.05);
    g.fillRect(-r, -r, 2 * r, 2 * r);
    // The dark oval: ink with a faint paper rim.
    g.beginPath();
    g.ellipse(-r * 0.3, -r * 0.18, r * 0.2, r * 0.1, -0.12, 0, Math.PI * 2);
    g.fillStyle = rgba("ink", 0.95);
    g.fill();
    g.strokeStyle = rgba("paper", 0.22);
    g.lineWidth = 1.2;
    g.stroke();
    g.restore();
    outline(g, r, 5, 0.22);
  },
  uranus(g, r) {
    // Back halves of the rings first, then the pale disc, then the front halves.
    const rings = [1.45, 1.62, 1.75];
    const ring = (k, from, to, a) => {
      g.beginPath();
      g.ellipse(0, 0, r * k * 0.24, r * k, 0.1, from, to);
      g.strokeStyle = rgba("paper", a);
      g.lineWidth = 1.2;
      g.stroke();
    };
    for (const k of rings) ring(k, Math.PI * 0.5, Math.PI * 1.5, 0.12);
    base(g, r, 8);
    g.save();
    wobblyCircle(g, r, 8);
    g.clip();
    g.fillStyle = rgba("paper", 0.1);
    g.fillRect(-r, -r, 2 * r, 2 * r);
    // Tipped on its side: the faint banding runs top to bottom.
    g.strokeStyle = rgba("paper", 0.08);
    g.lineWidth = 1;
    for (let x = -r * 0.8; x <= r * 0.8; x += r * 0.2) {
      g.beginPath();
      g.moveTo(x, -r);
      g.quadraticCurveTo(x + r * 0.05, 0, x, r);
      g.stroke();
    }
    g.restore();
    outline(g, r, 8, 0.24);
    for (const k of rings) ring(k, -Math.PI * 0.5, Math.PI * 0.5, 0.2);
  },
  saturn(g, r) {
    // Rings wide and tilted a little; back halves first, then the planet,
    // then the front halves over it.
    const rings = [1.7, 1.95, 2.25];
    const ring = (k, from, to, a) => {
      g.beginPath();
      g.ellipse(0, 0, r * k, r * k * 0.2, -0.1, from, to);
      g.strokeStyle = rgba("paper", a);
      g.lineWidth = 1.3;
      g.stroke();
    };
    for (const k of rings) ring(k, Math.PI, Math.PI * 2, 0.13);
    base(g, r, 20);
    g.save();
    wobblyCircle(g, r, 20);
    g.clip();
    g.fillStyle = rgba("paper", 0.06);
    g.fillRect(-r, -r, 2 * r, 2 * r);
    g.strokeStyle = rgba("paper", 0.09);
    g.lineWidth = 1.2;
    for (let i = 1; i < 6; i++) {
      const y = -r + (2 * r * i) / 6;
      g.beginPath();
      g.moveTo(-r, y);
      g.quadraticCurveTo(0, y + r * 0.08, r, y - r * 0.05);
      g.stroke();
    }
    g.restore();
    outline(g, r, 20, 0.22);
    for (const k of rings) ring(k, 0, Math.PI, 0.22);
  },
  jupiter(g, r) {
    base(g, r, 11);
    g.save();
    wobblyCircle(g, r, 11);
    g.clip();
    // Bands with wavy, hand-drawn edges; alternate tints.
    const bands = 11;
    for (let i = 0; i < bands; i++) {
      const y0 = -r + (2 * r * i) / bands,
        y1 = y0 + (2 * r) / bands;
      g.beginPath();
      g.moveTo(-r, y0);
      for (let x = -r; x <= r; x += 8) g.lineTo(x, y0 + Math.sin(x * 0.045 + i * 1.7) * 2.2);
      g.lineTo(r, y1);
      for (let x = r; x >= -r; x -= 8) g.lineTo(x, y1 + Math.sin(x * 0.045 + (i + 1) * 1.7) * 2.2);
      g.closePath();
      g.fillStyle = rgba("paper", i % 2 ? 0.1 : 0.04);
      g.fill();
    }
    // The storm oval, hatched.
    g.save();
    g.translate(-r * 0.32, r * 0.34);
    g.beginPath();
    g.ellipse(0, 0, r * 0.24, r * 0.12, -0.05, 0, Math.PI * 2);
    g.fillStyle = rgba("ink", 0.9);
    g.fill();
    g.clip();
    hatch(g, r * 0.3, 3, 0.6, 0.2);
    g.restore();
    g.beginPath();
    g.ellipse(-r * 0.32, r * 0.34, r * 0.24, r * 0.12, -0.05, 0, Math.PI * 2);
    g.strokeStyle = rgba("paper", 0.28);
    g.lineWidth = 1.4;
    g.stroke();
    g.restore();
    outline(g, r, 11, 0.2, 2);
  },
  mars(g, r) {
    base(g, r, 14);
    g.save();
    wobblyCircle(g, r, 14);
    g.clip();
    // Dense cross-hatch: the darkest hatch of the journey stands for red.
    hatch(g, r, 3.2, 0.75, 0.13);
    hatch(g, r, 3.2, -0.75, 0.13);
    // A polar cap, a few craters, dust-storm streaks.
    g.beginPath();
    g.ellipse(0, -r * 0.88, r * 0.38, r * 0.16, 0, 0, Math.PI * 2);
    g.fillStyle = rgba("ink", 1);
    g.fill();
    g.fillStyle = rgba("paper", 0.22);
    g.fill();
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc((hash(i + 1) - 0.5) * r * 1.2, (hash(i + 7) - 0.3) * r * 1.0, r * (0.06 + hash(i + 3) * 0.07), 0, Math.PI * 2);
      g.fillStyle = rgba("ink", 0.85);
      g.fill();
      g.strokeStyle = rgba("paper", 0.2);
      g.lineWidth = 1;
      g.stroke();
    }
    g.strokeStyle = rgba("paper", 0.16);
    g.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(-r, r * (0.1 + i * 0.2));
      g.bezierCurveTo(-r * 0.3, r * (0.0 + i * 0.2), r * 0.2, r * (0.3 + i * 0.18), r, r * (0.15 + i * 0.22));
      g.stroke();
    }
    g.restore();
    outline(g, r, 14, 0.22);
  },
  moon(g, r) {
    base(g, r, 17);
    g.save();
    wobblyCircle(g, r, 17, 0.004);
    g.clip();
    g.fillStyle = rgba("paper", 0.05);
    g.fillRect(-r, -r, 2 * r, 2 * r);
    // Crater rims along the visible limb (the top of the disc).
    for (let i = 0; i < 18; i++) {
      const a = -Math.PI / 2 + (hash(i + 21) - 0.5) * 1.3,
        d = r * (0.8 + hash(i + 41) * 0.17),
        cr = r * (0.012 + hash(i + 61) * 0.03);
      g.beginPath();
      g.ellipse(Math.cos(a) * d, Math.sin(a) * d, cr, cr * 0.45, a + Math.PI / 2, 0, Math.PI * 2);
      g.fillStyle = rgba("ink", 0.9);
      g.fill();
      g.strokeStyle = rgba("paper", 0.2);
      g.lineWidth = 1.2;
      g.stroke();
    }
    g.restore();
    outline(g, r, 17, 0.24, 2);
  },
};

/** The renderer's backdrop. `images` holds the decoded manifest sheets (the
 * original saturn.png and star sheet); `sprite(ctx, sheet, frame, x, y,
 * scale, alpha)` draws one manifest frame on a context (game.js). */
export function createBackdrop({ makeCanvas, images, sprite, reduced = false }) {
  const cache = new Map();
  function cached(id, r) {
    const key = `${id}:${Math.round(r)}`;
    if (cache.has(key)) return cache.get(key);
    const reach = Math.ceil(Math.max(r, bodyReach(id, r)) + 8),
      S = 2,
      c = makeCanvas(reach * 2 * S, reach * 2 * S),
      g = c.getContext("2d");
    g.setTransform(S, 0, 0, S, reach * S, reach * S);
    PAINT[LOOKS[id].body]?.(g, r);
    const entry = { canvas: c, reach };
    // Two looks at most: a level shows one, the transition between levels
    // two (RESEARCH_TRANSITIONS 3.4); the older entry goes.
    while (cache.size >= 2) cache.delete(cache.keys().next().value);
    cache.set(key, entry);
    return entry;
  }
  /** Build a look's cached body ahead of time (before the door), so no
   * transition frame paints a body from scratch. Returns the build ms. */
  function warm(id, H) {
    const L = LOOKS[id];
    if (!L || L.body === "brightStar" || L.body === "moon") return 0;
    const t0 = globalThis.performance?.now?.() ?? 0;
    cached(id, L.radius * H * (1 + L.grow));
    return (globalThis.performance?.now?.() ?? 0) - t0;
  }

  /** The body ahead, behind the sky's accents and the world. */
  function drawBody(ctx, id, view) {
    const L = LOOKS[id];
    // `view.box` places the body elsewhere (the transition's arcs).
    const { x, y, r } = view.box ?? bodyBox(id, view);
    if (L.body === "brightStar") return drawBrightStar(ctx, x, y, r, view);
    if (L.body === "moon") {
      // The Moon is too large to cache (only its limb shows): drawn live.
      ctx.save();
      ctx.translate(x, y);
      PAINT.moon(ctx, r);
      ctx.restore();
      return;
    }
    // Cached at full growth and drawn scaled down: crisp at the door.
    const full = L.radius * view.H * (1 + L.grow);
    const { canvas, reach } = cached(id, full);
    const k = r / full;
    ctx.drawImage(canvas, x - reach * k, y - reach * k, reach * 2 * k, reach * 2 * k);
    if (id === "neptune") neptuneWaves(ctx, x, y, r, view.clock);
  }
  // III: slow horizontal wave lines across Neptune (still under reduced motion).
  function neptuneWaves(ctx, x, y, r, clock) {
    const t = reduced ? 0 : clock * 0.25;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.985, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = rgba("paper", 0.13);
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 7; i++) {
      const yy = y - r * 0.75 + (i * r * 1.5) / 6;
      ctx.beginPath();
      for (let xx = x - r; xx <= x + r; xx += 6) {
        const wy = yy + Math.sin((xx - x) * 0.035 + t + i * 0.9) * 3;
        xx === x - r ? ctx.moveTo(xx, wy) : ctx.lineTo(xx, wy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // I: the brightest star (GDD §5), the one that falls as the asteroid: a
  // soft glow of stacked faint discs (fills, never stroked rings), a few
  // short tapering flare rays of unequal length at uneven angles (no lines
  // across it), and the original star sprite as its core. The owner read
  // the old rings and full crosshair lines as a target. It brightens as the
  // level runs toward the crash (`view.brightness`, 0-1) and is gone once
  // it has fallen (`view.fallen`). Nothing like the Earth glint's ring.
  const FLARES = [
    [-0.42, 2.3],
    [0.95, 1.35],
    [2.05, 1.8],
    [3.55, 1.1],
    [4.6, 1.55],
  ];
  function drawBrightStar(ctx, x, y, r, view) {
    if (view.fallen) return;
    const b = Math.max(0, Math.min(1, view.brightness ?? 0.4)),
      pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(view.clock * 1.6);
    ctx.save();
    // The glow: one soft radial falloff (no edge to read as a ring).
    const R = r * 3.4 * (1 + 0.3 * b) + pulse * 2,
      glow = ctx.createRadialGradient(x, y, 0, x, y, R);
    glow.addColorStop(0, rgba("paper", 0.12 + 0.12 * b));
    glow.addColorStop(0.3, rgba("paper", 0.05 + 0.04 * b));
    glow.addColorStop(1, rgba("paper", 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
    // The flares: thin wedges from the core, fading to their tips.
    ctx.globalAlpha = 1;
    for (const [a, len] of FLARES) {
      const L = r * len * (0.85 + 0.45 * b) * (0.94 + 0.06 * pulse),
        tx = x + Math.cos(a) * L,
        ty = y + Math.sin(a) * L,
        half = r * 0.2,
        nx = -Math.sin(a) * half,
        ny = Math.cos(a) * half;
      const g = ctx.createLinearGradient(x, y, tx, ty);
      g.addColorStop(0, rgba("paper", 0.3));
      g.addColorStop(1, rgba("paper", 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + nx, y + ny);
      ctx.lineTo(tx, ty);
      ctx.lineTo(x - nx, y - ny);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    sprite(ctx, "star", 2, x, y, (r * 2.2) / 200, 0.55 + 0.35 * b);
  }
  let rings = null;

  /** The sky accent, over the body and under the world; clipped below the
   * HUD band. Particles are a pure function of time (no state to reset). */
  function drawAccent(ctx, id, view) {
    const L = LOOKS[id],
      { W, H, clock } = view,
      t = reduced ? 0 : clock;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HUD_BAND, W, H - HUD_BAND);
    ctx.clip();
    if (L.accent === "bubbles") {
      // III: tiny rings rising slowly, as if through water.
      ctx.strokeStyle = rgba("paper", 0.16);
      ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const span = H - HUD_BAND,
          yy = H - ((hash(i + 5) * span + t * (10 + hash(i) * 8)) % span),
          xx = ((hash(i + 15) * W * 1.2 - view.driftX * 0.01) % (W * 1.2) + W * 1.2) % (W * 1.2) - W * 0.1;
        ctx.beginPath();
        ctx.arc(xx + Math.sin(t * 0.8 + i) * 4, yy, 1.6 + hash(i + 25) * 2.4, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (L.accent === "ice") {
      // IV: slow vertical ice streaks falling.
      ctx.strokeStyle = rgba("paper", 0.1);
      ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const len = 14 + hash(i + 3) * 22,
          span = H - HUD_BAND + len,
          yy = HUD_BAND + ((hash(i + 8) * span + t * (14 + hash(i) * 12)) % span) - len,
          xx = ((hash(i + 13) * W * 1.1 - view.driftX * 0.02) % (W * 1.1) + W * 1.1) % (W * 1.1);
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx, yy + len);
        ctx.stroke();
      }
    } else if (L.accent === "ringDust") {
      // V: the original saturn.png's ring strokes (its rings-only crop, as
      // revision seven's sky uses them) sweep low across the sky toward the
      // planet, a little brighter than there; flecks drift sideways.
      if (images.saturn) {
        rings ??= ringsCrop(images.saturn, makeCanvas);
        const w = W * 0.92,
          h = (w * rings.height) / rings.width;
        ctx.save();
        ctx.globalAlpha = 0.09;
        ctx.drawImage(rings, W * 0.0 - view.driftX * 0.002, H * 0.66 - h * 0.47 - view.driftY * 0.03, w, h);
        ctx.restore();
      }
      ctx.fillStyle = rgba("paper", 0.18);
      for (let i = 0; i < 12; i++) {
        const xx = W - (((hash(i + 2) * W * 1.2 + t * (6 + hash(i) * 6)) % (W * 1.2)) - W * 0.1),
          yy = H * (0.2 + hash(i + 31) * 0.5);
        ctx.fillRect(xx, yy, 2, 1.2);
      }
    } else if (L.accent === "bands") {
      // VI: long faint band streaks drifting with the sky.
      ctx.strokeStyle = rgba("paper", 0.05);
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const yy = H * (0.16 + i * 0.075),
          x0 = ((hash(i + 4) * W * 1.5 - t * 3 - view.driftX * 0.004) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.5;
        ctx.beginPath();
        ctx.moveTo(x0, yy);
        ctx.bezierCurveTo(x0 + W * 0.2, yy - 3, x0 + W * 0.4, yy + 3, x0 + W * (0.5 + hash(i) * 0.3), yy);
        ctx.stroke();
      }
    } else if (L.accent === "rocks") {
      // VII: the asteroid belt's rocks tumbling far behind (ink, faint paper rim).
      for (let i = 0; i < 9; i++) {
        const span = W * 1.3,
          xx = ((hash(i + 3) * span - view.driftX * 0.03 - t * (4 + hash(i) * 4)) % span + span) % span - W * 0.15,
          yy = H * (0.16 + hash(i + 17) * 0.16),
          s = 3 + hash(i + 9) * 5;
        ctx.save();
        ctx.translate(xx, yy);
        ctx.rotate(t * (0.3 + hash(i + 1) * 0.5) * (i % 2 ? 1 : -1) + i);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2,
            rr = s * (0.7 + hash(i * 7 + k) * 0.5);
          k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fillStyle = rgba("ink", 1);
        ctx.fill();
        ctx.strokeStyle = rgba("paper", 0.28);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    } else if (L.accent === "earth") {
      // VIII: Earth's crescent, blue, growing toward the door (the only colour).
      const e = earthBox(id, view);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fillStyle = rgba("earth", 0.95);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e.x - e.r * 0.42, e.y - e.r * 0.12, e.r * 0.94, 0, Math.PI * 2);
      ctx.fillStyle = rgba("ink", 1);
      ctx.fill();
    }
    ctx.restore();
  }

  return { drawBody, drawAccent, warm, cacheSize: () => cache.size, cached: () => [...cache.keys()] };
}

/** Only the ring strokes of the original saturn.png (its left 56.5%, where
 * the planet's limb begins), faded at both ends: the hard limb read as a
 * rendering artifact at the screen edge. Shared with revision seven's sky. */
export function ringsCrop(img, makeCanvas) {
  const limb = Math.round(img.width * 0.565),
    c = makeCanvas(limb, img.height),
    g = c.getContext("2d");
  g.drawImage(img, 0, 0, limb, img.height, 0, 0, limb, img.height);
  g.globalCompositeOperation = "destination-in";
  const fade = g.createLinearGradient(0, 0, limb, 0);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.25, "rgba(0,0,0,1)");
  fade.addColorStop(0.7, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = fade;
  g.fillRect(0, 0, limb, img.height);
  return c;
}
/** Sky stars and dust drawn for a look: a factor of today's (1 = unchanged). */
export function skyDensity(id) {
  const L = id ? LOOKS[id] : null;
  return { stars: L?.stars ?? 1, dust: L?.dust ?? 1, wobble: L?.wobble ?? 0 };
}
/** I: a denser shower of the original shooting stars (seconds between them). */
export function cadentGap(id, u) {
  return id && LOOKS[id]?.accent === "shower" ? 1.4 + u * 2.4 : 4 + u * 6;
}
