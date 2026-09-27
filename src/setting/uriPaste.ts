import { addTokenFromUri } from "../shared/tokens"
import {
  TOKENS_SETTINGS_KEY,
  URI_PASTE_ERROR_SETTINGS_KEY,
  URI_PASTE_INPUT_SETTINGS_KEY
} from "../shared/settingsKeys"

export type SettingsStorage = Pick<
  SettingsProps["settingsStorage"],
  "getItem" | "setItem" | "removeItem"
>

/**
 * URI Paste submitted. On success the Token is stored and the field empties,
 * so the Secret does not stay on screen.
 */
export function handleUriPaste(storage: SettingsStorage, input: string) {
  try {
    storeResult(storage, input)
  } catch (error) {
    /* The Settings App cannot console.log on hardware, but settings writes
     * reach the bridge log (§3.6.1), so any surprise names its own cause. */
    storage.setItem(URI_PASTE_INPUT_SETTINGS_KEY, input)
    storage.setItem(URI_PASTE_ERROR_SETTINGS_KEY, String(error))
  }
}

function storeResult(storage: SettingsStorage, input: string) {
  const result = addTokenFromUri(storage.getItem(TOKENS_SETTINGS_KEY), input)
  if ("tokens" in result) {
    storage.setItem(TOKENS_SETTINGS_KEY, JSON.stringify(result.tokens))
    /* The field resets only when its value changes; it was "" before the
     * paste, so it passes through the URI on its way back to "". */
    storage.setItem(URI_PASTE_INPUT_SETTINGS_KEY, input)
    storage.removeItem(URI_PASTE_INPUT_SETTINGS_KEY)
    storage.removeItem(URI_PASTE_ERROR_SETTINGS_KEY)
  } else {
    storage.setItem(URI_PASTE_INPUT_SETTINGS_KEY, input)
    storage.setItem(URI_PASTE_ERROR_SETTINGS_KEY, result.error)
  }
}
