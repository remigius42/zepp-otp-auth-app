import { ColorSchemeName } from "../../shared/ColorSchemes"
import { settingsFromStorage } from "../../shared/settings"
import {
  COLOR_SCHEME_SETTINGS_KEY,
  COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY,
  LARGE_TOKEN_VIEW_SETTINGS_KEY
} from "../../shared/settingsKeys"
import { storeSetting } from "../storeSetting"

function fakeStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key),
    setItem: (key: string, value: string) => void items.set(key, value)
  }
}

describe("storeSetting", () => {
  it("stores Settings so that the Side Service reads them back", () => {
    const storage = fakeStorage()

    storeSetting(storage, COLOR_SCHEME_SETTINGS_KEY, ColorSchemeName.black)
    storeSetting(storage, LARGE_TOKEN_VIEW_SETTINGS_KEY, true)
    storeSetting(storage, COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY, false)

    expect(settingsFromStorage(storage)).toEqual({
      colorScheme: ColorSchemeName.black,
      shouldUseLargeTokenView: true,
      compensateClockDrift: false
    })
  })
})
