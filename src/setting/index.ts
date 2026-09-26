import { gettext } from "i18n"
import {
  TOKENS_SETTINGS_KEY,
  URI_PASTE_ERROR_SETTINGS_KEY,
  URI_PASTE_INPUT_SETTINGS_KEY
} from "../shared/settingsKeys"
import { tokensForSync } from "../shared/tokens"
import { getDisplayName } from "../shared/formatTokens"
import { handleUriPaste } from "./uriPaste"

/**
 * Settings App — Phase 2 vertical slice: URI Paste plus a read-only Token
 * list. Logic lives in `./uriPaste`; this file only renders.
 *
 * Built from `View`, `TextInput` and `Button`, the components the shipped
 * `todo-list` template proves render. `Text` is unverified on hardware and a
 * throw blanks the whole page with no log (§3.6.1), so the error line checks
 * for it and falls back to a disabled `TextInput`.
 *
 * `build()` must never write to settings storage: the write re-runs `build()`.
 * Writes happen in `onChange` only.
 */
AppSettingsPage({
  build({ settingsStorage }) {
    const tokens = tokensForSync(settingsStorage.getItem(TOKENS_SETTINGS_KEY))
    const error = settingsStorage.getItem(URI_PASTE_ERROR_SETTINGS_KEY)

    return View({ style: { padding: "12px 20px" } }, [
      TextInput({
        label: gettext("Paste otpauth:// URI"),
        value: settingsStorage.getItem(URI_PASTE_INPUT_SETTINGS_KEY) ?? "",
        onChange: (input: string) => {
          handleUriPaste(settingsStorage, input)
        }
      }),
      ...(error ? [errorLine(error)] : []),
      ...tokens.map(token =>
        TextInput({ label: getDisplayName(token, true), disabled: true })
      )
    ])
  }
})

function errorLine(message: string) {
  return typeof Text === "function"
    ? Text({ style: { color: "#d00", fontSize: "12px" } }, message)
    : TextInput({ label: message, disabled: true })
}
