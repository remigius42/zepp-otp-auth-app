import { ColorSchemeName } from "../../shared/ColorSchemes"
import { arcFrame, arcFramePath } from "../arc"

describe("arcFrame", () => {
  it("shows a full ring at the start of a Period", () => {
    expect(arcFrame(30, 60_000, 0)).toBe(0)
  })

  it("advances one frame per thirtieth of the Period", () => {
    expect(arcFrame(30, 60_000 + 15_000, 0)).toBe(15)
    expect(arcFrame(60, 120_000 + 30_000, 0)).toBe(15)
  })

  it("shows the last frame just before the Period ends", () => {
    expect(arcFrame(30, 89_999, 0)).toBe(29)
  })

  it("shifts by the clock drift", () => {
    /* The watch is 2.5 s behind: at its 57.5 s it is 60 s, a new Period. */
    expect(arcFrame(30, 57_500, 2.5)).toBe(0)
  })
})

describe("arcFramePath", () => {
  it("names the frame of a color scheme", () => {
    expect(arcFramePath(ColorSchemeName.white, 7)).toBe("arc/white/7.png")
  })
})
