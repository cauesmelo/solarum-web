/** Read-only RGBA8 / Adam7 PNG inspector for the unchanged original art
 * (portal bounds, and each animation frame's lowest drawn pixel). */
import { inflateSync } from "node:zlib";
export function visibleBounds(buffer) {
  const { width, height, pixels } = decodePNG(buffer);
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (
        pixels[i + 3] > 64 &&
        Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 170
      ) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
/** The lowest opaque row (alpha > 64) inside a frame rect, or -1. */
export function lowestOpaqueRow({ width, pixels }, f) {
  for (let y = f.y + f.h - 1; y >= f.y; y--)
    for (let x = f.x; x < f.x + f.w; x++) if (pixels[(y * width + x) * 4 + 3] > 64) return y - f.y;
  return -1;
}
export function decodePNG(buffer) {
  const width = buffer.readUInt32BE(16),
    height = buffer.readUInt32BE(20);
  if (buffer[24] !== 8 || buffer[25] !== 6)
    throw new Error("Inspector expects RGBA8 PNG");
  const chunks = [];
  for (let offset = 8; offset < buffer.length; ) {
    const size = buffer.readUInt32BE(offset),
      type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT")
      chunks.push(buffer.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)),
    pixels = Buffer.alloc(width * height * 4);
  const paeth = (a, b, c) => {
    const p = a + b - c,
      pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  let rawAt = 0;
  const passes =
    buffer[28] === 1
      ? [
          [0, 0, 8, 8],
          [4, 0, 8, 8],
          [0, 4, 4, 8],
          [2, 0, 4, 4],
          [0, 2, 2, 4],
          [1, 0, 2, 2],
          [0, 1, 1, 2],
        ]
      : [[0, 0, 1, 1]];
  for (const [x0, y0, dx, dy] of passes) {
    const pw = Math.max(0, Math.ceil((width - x0) / dx)),
      ph = Math.max(0, Math.ceil((height - y0) / dy)),
      stride = pw * 4;
    if (!pw || !ph) continue;
    const rows = Buffer.alloc(stride * ph);
    for (let y = 0; y < ph; y++) {
      const filter = raw[rawAt++];
      for (let x = 0; x < stride; x++) {
        const left = x >= 4 ? rows[y * stride + x - 4] : 0,
          up = y ? rows[(y - 1) * stride + x] : 0,
          upperLeft = y && x >= 4 ? rows[(y - 1) * stride + x - 4] : 0;
        const prediction = [
          0,
          left,
          up,
          Math.floor((left + up) / 2),
          paeth(left, up, upperLeft),
        ][filter];
        if (prediction === undefined) throw new Error("Unknown PNG row filter");
        rows[y * stride + x] = (raw[rawAt++] + prediction) & 255;
      }
      for (let x = 0; x < pw; x++)
        for (let c = 0; c < 4; c++)
          pixels[((y0 + y * dy) * width + x0 + x * dx) * 4 + c] =
            rows[y * stride + x * 4 + c];
    }
  }
  return { width, height, pixels };
}
