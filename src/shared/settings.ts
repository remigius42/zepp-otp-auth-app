import type { AppSettings } from "./AppSettings"
import { ColorSchemeName } from "./ColorSchemes"
import {
  COLOR_SCHEME_SETTINGS_KEY,
  COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY,
  LARGE_TOKEN_VIEW_SETTINGS_KEY
} from "./settingsKeys"

/** The Settings as the phone holds them; the drift toggle never reaches the watch. */
export interface PhoneSettings extends AppSettings {
  compensateClockDrift: boolean
}

type SettingsStorage = { getItem(key: string): string | undefined }

/** The stored Settings, with defaults for anything absent or malformed. */
export function settingsFromStorage(storage: SettingsStorage): PhoneSettings {
  const colorScheme = parse(storage.getItem(COLOR_SCHEME_SETTINGS_KEY))
  return {
    colorScheme: Object.values(ColorSchemeName).includes(
      colorScheme as ColorSchemeName
    )
      ? (colorScheme as ColorSchemeName)
      : ColorSchemeName.default,
    shouldUseLargeTokenView:
      parse(storage.getItem(LARGE_TOKEN_VIEW_SETTINGS_KEY)) === true,
    compensateClockDrift:
      parse(storage.getItem(COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY)) !== false
  }
}

function parse(stored: string | undefined): unknown {
  if (stored === undefined) return undefined
  try {
    return JSON.parse(stored)
  } catch {
    return undefined
  }
}
