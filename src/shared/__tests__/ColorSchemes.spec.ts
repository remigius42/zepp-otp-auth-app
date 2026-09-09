import { ColorSchemeName, ColorSchemes, toZeppColor } from "../ColorSchemes"

describe("ColorSchemes", () => {
  const schemeNames = Object.values(ColorSchemeName)

  it("offers exactly the three schemes the app ships", () => {
    expect(schemeNames).toEqual(["default", "white", "black"])
  })

  it.each(schemeNames)("defines every color for the %s scheme", name => {
    const scheme = ColorSchemes[name]

    expect(scheme.primaryColor).toMatch(/^#[0-9a-f]{6}$/i)
    expect(scheme.secondaryColor).toMatch(/^#[0-9a-f]{6}$/i)
    expect(scheme.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it.each(schemeNames)(
    "contrasts the primary color against the background for the %s scheme",
    name => {
      const scheme = ColorSchemes[name]

      expect(scheme.primaryColor.toLowerCase()).not.toBe(
        scheme.backgroundColor.toLowerCase()
      )
    }
  )
})

describe("toZeppColor", () => {
  it.each([
    ["#000000", 0x000000],
    ["#ffffff", 0xffffff],
    ["#ffd502", 0xffd502]
  ])("converts %s to the numeric form @zos/ui expects", (hex, expected) => {
    expect(toZeppColor(hex as never)).toBe(expected)
  })
})
