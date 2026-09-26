/* spell-checker:ignore IDAT IEND */

import { crc32, inflateSync } from "node:zlib"
import { encodePng, renderArc } from "../arcFrames.mjs"

const COLORS = {
  primary: "#ffd502",
  secondary: "#704d00",
  background: "#000000"
}
const SIZE = 64
const PRIMARY = [0xff, 0xd5, 0x02, 0xff]
const SECONDARY = [0x70, 0x4d, 0x00, 0xff]
const BACKGROUND = [0x00, 0x00, 0x00, 0xff]

/** RGBA of the pixel at (x, y). */
const pixel = (rgba, x, y) => [
  ...rgba.subarray((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 4)
]

/* Points in the middle of the ring's stroke, and the center. */
const TOP_RIGHT_OF_NOON = [34, 3]
const THREE_O_CLOCK = [60, 32]
const SIX_O_CLOCK = [32, 60]
const NINE_O_CLOCK = [3, 32]
const CENTER = [32, 32]

describe("renderArc", () => {
  it("renders size × size RGBA pixels", () => {
    expect(renderArc(SIZE, 1, COLORS)).toHaveLength(SIZE * SIZE * 4)
  })

  it("draws the whole ring in the primary color when the Period is fresh", () => {
    const rgba = renderArc(SIZE, 1, COLORS)

    for (const [x, y] of [
      TOP_RIGHT_OF_NOON,
      THREE_O_CLOCK,
      SIX_O_CLOCK,
      NINE_O_CLOCK
    ]) {
      expect(pixel(rgba, x, y)).toEqual(PRIMARY)
    }
  })

  it("leaves only a sliver after 12 o'clock in the primary color near the end", () => {
    const rgba = renderArc(SIZE, 1 / 30, COLORS)

    expect(pixel(rgba, ...TOP_RIGHT_OF_NOON)).toEqual(PRIMARY)
    for (const [x, y] of [THREE_O_CLOCK, SIX_O_CLOCK, NINE_O_CLOCK]) {
      expect(pixel(rgba, x, y)).toEqual(SECONDARY)
    }
  })

  it("drains clockwise: half left means the right half is primary", () => {
    const rgba = renderArc(SIZE, 1 / 2, COLORS)

    expect(pixel(rgba, ...THREE_O_CLOCK)).toEqual(PRIMARY)
    expect(pixel(rgba, ...NINE_O_CLOCK)).toEqual(SECONDARY)
  })

  it("fills everything else with the opaque background", () => {
    const rgba = renderArc(SIZE, 1, COLORS)

    expect(pixel(rgba, ...CENTER)).toEqual(BACKGROUND)
    expect(pixel(rgba, 0, 0)).toEqual(BACKGROUND)
  })
})

describe("encodePng", () => {
  const WIDTH = 3
  const HEIGHT = 2
  const RGBA = Uint8Array.from({ length: WIDTH * HEIGHT * 4 }, (_, i) => i * 10)

  /** The PNG's chunks as `{ type, data }`, in order. */
  const chunks = png => {
    const found = []
    for (let offset = 8; offset < png.length; ) {
      const length = png.readUInt32BE(offset)
      found.push({
        type: png.toString("latin1", offset + 4, offset + 8),
        data: png.subarray(offset + 8, offset + 8 + length)
      })
      offset += 12 + length
    }
    return found
  }

  it("starts with the PNG signature", () => {
    expect([...encodePng(WIDTH, HEIGHT, RGBA).subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ])
  })

  it("declares an 8-bit RGBA image of the given size in IHDR", () => {
    const [ihdr] = chunks(encodePng(WIDTH, HEIGHT, RGBA))

    expect(ihdr.type).toBe("IHDR")
    expect(ihdr.data.readUInt32BE(0)).toBe(WIDTH)
    expect(ihdr.data.readUInt32BE(4)).toBe(HEIGHT)
    expect([...ihdr.data.subarray(8)]).toEqual([8, 6, 0, 0, 0])
  })

  it("stores the pixels unfiltered, row by row, in IDAT", () => {
    const idat = chunks(encodePng(WIDTH, HEIGHT, RGBA)).find(
      chunk => chunk.type === "IDAT"
    )
    const raw = inflateSync(idat.data)
    const rowLength = 1 + WIDTH * 4

    for (let y = 0; y < HEIGHT; y++) {
      expect(raw[y * rowLength]).toBe(0)
      expect([...raw.subarray(y * rowLength + 1, (y + 1) * rowLength)]).toEqual(
        [...RGBA.subarray(y * WIDTH * 4, (y + 1) * WIDTH * 4)]
      )
    }
  })

  it("checksums every chunk", () => {
    const png = encodePng(WIDTH, HEIGHT, RGBA)

    for (let offset = 8; offset < png.length; ) {
      const length = png.readUInt32BE(offset)
      const typeAndData = png.subarray(offset + 4, offset + 8 + length)
      expect(png.readUInt32BE(offset + 8 + length)).toBe(crc32(typeAndData))
      offset += 12 + length
    }
  })

  it("ends with IEND", () => {
    expect(chunks(encodePng(WIDTH, HEIGHT, RGBA)).at(-1)).toEqual({
      type: "IEND",
      data: Buffer.alloc(0)
    })
  })
})
