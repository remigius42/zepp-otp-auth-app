import { ColorSchemeName } from "../ColorSchemes"
import { settingsFromStorage } from "../settings"
import {
  COLOR_SCHEME_SETTINGS_KEY,
  COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY,
  LARGE_TOKEN_VIEW_SETTINGS_KEY
} from "../settingsKeys"

function storageWith(items: Record<string, string>) {
  return { getItem: (key: string) => items[key] }
}

describe("settingsFromStorage", () => {
  it("falls back to the defaults when nothing is stored", () => {
    expect(settingsFromStorage(storageWith({}))).toEqual({
      colorScheme: ColorSchemeName.default,
      shouldUseLargeTokenView: false,
      compensateClockDrift: true
    })
  })

  it("reads the stored Settings", () => {
    const storage = storageWith({
      [COLOR_SCHEME_SETTINGS_KEY]: JSON.stringify(ColorSchemeName.white),
      [LARGE_TOKEN_VIEW_SETTINGS_KEY]: "true",
      [COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY]: "false"
    })

    expect(settingsFromStorage(storage)).toEqual({
      colorScheme: ColorSchemeName.white,
      shouldUseLargeTokenView: true,
      compensateClockDrift: false
    })
  })

  it.each(["not json", '"purple"', "42", '"true"'])(
    "falls back to the defaults for the stored value %s",
    value => {
      const storage = storageWith({
        [COLOR_SCHEME_SETTINGS_KEY]: value,
        [LARGE_TOKEN_VIEW_SETTINGS_KEY]: value,
        [COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY]: value
      })

      expect(settingsFromStorage(storage)).toEqual({
        colorScheme: ColorSchemeName.default,
        shouldUseLargeTokenView: false,
        compensateClockDrift: true
      })
    }
  )
})
