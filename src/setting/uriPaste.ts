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
 * How long the pasted URI stays in the field before it clears. Long enough
 * for the Settings App to render it: a field resets only when its value
 * changes, and a change undone within the same handler never rendered.
 */
const CLEAR_DELAY_MS = 300

/**
 * Runs `clear` after {@link CLEAR_DELAY_MS}. The Settings App's runtime is
 * undocumented; without timers, clear at once as before rather than throw
 * after the Token was stored.
 */
function clearLater(clear: () => void) {
  if (typeof setTimeout === "function") setTimeout(clear, CLEAR_DELAY_MS)
  else clear()
}

/**
 * URI Paste submitted. The field empties either way, so the pasted text —
 * which holds the Secret — stays in neither the screen nor settings storage.
 * On success the Token is stored; otherwise only the error line remains and
 * the user pastes again.
 */
export function handleUriPaste(
  storage: SettingsStorage,
  input: string,
  schedule = clearLater
) {
  try {
    storeResult(storage, input, schedule)
  } catch (error) {
    /* The Settings App cannot console.log on hardware, but settings writes
     * reach the bridge log (§3.6.1), so any surprise names its own cause. */
    storage.setItem(URI_PASTE_ERROR_SETTINGS_KEY, String(error))
  }
}

function storeResult(
  storage: SettingsStorage,
  input: string,
  schedule: (clear: () => void) => void
) {
  const result = addTokenFromUri(storage.getItem(TOKENS_SETTINGS_KEY), input)
  if ("tokens" in result) {
    storage.setItem(TOKENS_SETTINGS_KEY, JSON.stringify(result.tokens))
    storage.removeItem(URI_PASTE_ERROR_SETTINGS_KEY)
  } else {
    storage.setItem(URI_PASTE_ERROR_SETTINGS_KEY, result.error)
  }
  /* The field resets only when its value changes; it was "" before the
   * paste, so it passes through the URI on its way back to "". */
  storage.setItem(URI_PASTE_INPUT_SETTINGS_KEY, input)
  schedule(() => {
    storage.removeItem(URI_PASTE_INPUT_SETTINGS_KEY)
  })
}
