/* spell-checker:ignore GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ */

import { ColorSchemeName } from "../../shared/ColorSchemes"
import { rowView } from "../rowView"

/* RFC 6238 appendix B: SHA-1, 8 digits, T = 59 s → 94287082. */
const RFC_TOKEN = {
  label: "john",
  issuer: "GitHub",
  secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
  algorithm: "SHA1",
  digits: "8",
  period: "30"
}

describe("rowView", () => {
  it("shows the Display Name, the formatted Code and the arc frame", () => {
    expect(rowView(RFC_TOKEN, 59_000, 0, ColorSchemeName.default)).toEqual({
      name: "GitHub (john)",
      code: "9428 7082",
      arc: "arc/default/29.png"
    })
  })

  it("drains each Token's arc over its own Period", () => {
    const now = 75_000

    expect(rowView(RFC_TOKEN, now, 0, ColorSchemeName.white)).toMatchObject({
      arc: "arc/white/15.png"
    })
    expect(
      rowView({ ...RFC_TOKEN, period: "60" }, now, 0, ColorSchemeName.white)
    ).toMatchObject({ arc: "arc/white/7.png" })
  })

  it("shifts the arc by the clock drift", () => {
    expect(
      rowView(RFC_TOKEN, 57_500, 2.5, ColorSchemeName.default)
    ).toMatchObject({ arc: "arc/default/0.png" })
  })

  it("shows a text countdown instead of the arc as the fallback", () => {
    expect(
      rowView(RFC_TOKEN, 37_000, 0, ColorSchemeName.default, true)
    ).toEqual({
      name: "GitHub (john)",
      code: expect.any(String),
      countdown: "23s"
    })
  })
})
