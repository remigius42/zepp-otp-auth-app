/* spell-checker:ignore IDAT IEND rrggbb */

// Pure rasterizer and PNG encoder for the Token list's arc frames
// (docs/adr/0005-progress-arc-as-prerendered-image-frames.md).
// Dependency-free: zpm converts asset PNGs to TGA during `zeus build`.

import { crc32, deflateSync } from "node:zlib"

/** Samples per pixel side; 4 × 4 per pixel smooths the ring's edges. */
const SUPERSAMPLING = 4

/** Ring stroke as a fraction of the frame size. */
const STROKE_FRACTION = 0.1

/** `#rrggbb` → `[r, g, b]`. */
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))

/**
 * One arc frame as RGBA: a ring in the secondary color, the remaining part of
 * the Period in the primary color over it, clockwise from 12 o'clock, on an
 * opaque background.
 *
 * @param {number} size - width and height in pixels
 * @param {number} remainingFraction - 1 is a full ring, 0 an empty one
 * @param {{ primary: string, secondary: string, background: string }} colors
 * @returns {Uint8Array}
 */
export function renderArc(size, remainingFraction, colors) {
  const palette = {
    primary: rgb(colors.primary),
    secondary: rgb(colors.secondary),
    background: rgb(colors.background)
  }
  const center = size / 2
  const outerRadius = center - 1
  const innerRadius = outerRadius - size * STROKE_FRACTION

  /** Which color the point (x, y) has. */
  const colorAt = (x, y) => {
    const dx = x - center
    const dy = y - center
    const distance = Math.hypot(dx, dy)
    if (distance < innerRadius || distance > outerRadius) {
      return palette.background
    }
    /* Clockwise from 12 o'clock, in turns: 0 at noon, 0.25 at 3 o'clock. */
    const turns = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1
    return turns < remainingFraction ? palette.primary : palette.secondary
  }

  const rgba = new Uint8Array(size * size * 4)
  const samples = SUPERSAMPLING * SUPERSAMPLING
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0]
      for (let sy = 0; sy < SUPERSAMPLING; sy++) {
        for (let sx = 0; sx < SUPERSAMPLING; sx++) {
          const color = colorAt(
            x + (sx + 0.5) / SUPERSAMPLING,
            y + (sy + 0.5) / SUPERSAMPLING
          )
          for (let c = 0; c < 3; c++) sum[c] += color[c]
        }
      }
      const offset = (y * size + x) * 4
      for (let c = 0; c < 3; c++)
        rgba[offset + c] = Math.round(sum[c] / samples)
      rgba[offset + 3] = 0xff
    }
  }
  return rgba
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
])

/** A PNG chunk: length, type, data, CRC over type and data. */
function chunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, "latin1"), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

/**
 * An 8-bit RGBA PNG, every row unfiltered.
 *
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba - `width × height × 4` bytes, row by row
 * @returns {Buffer}
 */
export function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  /* Bit depth 8, color type 6 (RGBA), default compression, filter, no interlace. */
  header.set([8, 6, 0, 0, 0], 8)

  const rowLength = width * 4
  const raw = Buffer.alloc(height * (1 + rowLength))
  for (let y = 0; y < height; y++) {
    /* The leading 0 of each row is filter type None. */
    raw.set(
      rgba.subarray(y * rowLength, (y + 1) * rowLength),
      y * (1 + rowLength) + 1
    )
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ])
}
