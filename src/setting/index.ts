import { gettext } from "i18n"
import { ColorSchemeName } from "../shared/ColorSchemes"
import { settingsFromStorage } from "../shared/settings"
import {
  COLOR_SCHEME_SETTINGS_KEY,
  COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY,
  LARGE_TOKEN_VIEW_SETTINGS_KEY,
  SYNC_STATS_SETTINGS_KEY,
  TOKENS_SETTINGS_KEY,
  URI_PASTE_ERROR_SETTINGS_KEY,
  URI_PASTE_INPUT_SETTINGS_KEY
} from "../shared/settingsKeys"
import { parseStats } from "../shared/syncStats"
import { parseTokens } from "../shared/tokens"
import type { TotpConfig } from "../shared/TotpConfig"
import { getDisplayName } from "../shared/formatTokens"
import { gettextWithReplacement } from "../shared/i18nUtils"
import { storeSetting } from "./storeSetting"
import { summarizeStats } from "./syncStatsSummary"
import {
  cancelDelete,
  confirmDelete,
  handleMove,
  handleRename,
  pendingDeleteIndex,
  requestDelete
} from "./tokenList"
import { handleUriPaste, type SettingsStorage } from "./uriPaste"

/**
 * Settings App: URI Paste, the Token list and the Settings. Logic lives in
 * `./uriPaste`, `./tokenList`, `./storeSetting` and `./syncStatsSummary`; this
 * file only renders.
 *
 * `View`, `TextInput` and `Button` are proven by the shipped `todo-list`
 * template. `Section`, `Toggle` and `Select` are unverified on hardware and a
 * throw blanks the whole page with no log (§3.6.1); if the Phase 3 S1 check
 * shows that, each has a predetermined fallback in TODO.md. `Text` checks for
 * itself and falls back to a disabled `TextInput`.
 *
 * `build()` must never write to settings storage: the write re-runs `build()`.
 * Writes happen in `onChange` only.
 */
AppSettingsPage({
  build({ settingsStorage }) {
    /* All stored Tokens, not only the valid ones, so that row indices are the
     * ones the `./tokenList` handlers act on. */
    const tokens = parseTokens(settingsStorage.getItem(TOKENS_SETTINGS_KEY))
    const pending = pendingDeleteIndex(settingsStorage)
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
      ...tokens.map((token, index) =>
        index === pending
          ? deleteConfirmationRow(settingsStorage, token)
          : tokenRow(settingsStorage, token, index)
      ),
      settingsSection(settingsStorage)
    ])
  }
})

/** Rename field, then ↑ ↓ ✕ side by side. */
function tokenRow(storage: SettingsStorage, token: TotpConfig, index: number) {
  return View(ROW_STYLE, [
    TextInput({
      label: getDisplayName({ ...token, displayName: undefined }),
      value: getDisplayName(token),
      onChange: (name: string) => {
        handleRename(storage, index, name)
      }
    }),
    View(BUTTONS_STYLE, [
      Button({
        label: "↑",
        onClick: () => {
          handleMove(storage, index, -1)
        }
      }),
      Button({
        label: "↓",
        onClick: () => {
          handleMove(storage, index, 1)
        }
      }),
      Button({
        label: "✕",
        onClick: () => {
          requestDelete(storage, index)
        }
      })
    ])
  ])
}

function deleteConfirmationRow(storage: SettingsStorage, token: TotpConfig) {
  return View(ROW_STYLE, [
    textLine(
      gettextWithReplacement("Delete @name?", "@name", getDisplayName(token))
    ),
    View(BUTTONS_STYLE, [
      Button({
        label: gettext("Delete"),
        style: { background: "#D85E33", color: "white" },
        onClick: () => {
          confirmDelete(storage)
        }
      }),
      Button({
        label: gettext("Cancel"),
        onClick: () => {
          cancelDelete(storage)
        }
      })
    ])
  ])
}

const ROW_STYLE = {
  style: {
    borderBottom: "1px solid #eaeaea",
    padding: "6px 0",
    marginBottom: "6px"
  }
}

const BUTTONS_STYLE = {
  style: { display: "flex", flexDirection: "row", gap: "8px" }
}

function settingsSection(storage: SettingsStorage) {
  const settings = settingsFromStorage(storage)
  return Section({ title: gettext("Settings") }, [
    Toggle({
      label: gettext("Enlarge token information"),
      value: settings.shouldUseLargeTokenView,
      onChange: (value: boolean) => {
        storeSetting(storage, LARGE_TOKEN_VIEW_SETTINGS_KEY, value)
      }
    }),
    Toggle({
      label: gettext("Compensate clock drift"),
      value: settings.compensateClockDrift,
      onChange: (value: boolean) => {
        storeSetting(storage, COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY, value)
      }
    }),
    Select({
      label: gettext("Color scheme"),
      options: [
        { name: gettext("Amber on black"), value: ColorSchemeName.default },
        { name: gettext("White on black"), value: ColorSchemeName.white },
        { name: gettext("Black on white"), value: ColorSchemeName.black }
      ],
      value: settings.colorScheme,
      onChange: (value: ColorSchemeName) => {
        storeSetting(storage, COLOR_SCHEME_SETTINGS_KEY, value)
      }
    }),
    /* A bare `Text` flowed inline after the `Select` on hardware; its own
     * `View` puts it on a line of its own. */
    View({ style: { marginTop: "12px" } }, [
      textLine(
        summarizeStats(parseStats(storage.getItem(SYNC_STATS_SETTINGS_KEY)))
      )
    ])
  ])
}

function errorLine(message: string) {
  return typeof Text === "function"
    ? Text({ style: { color: "#d00", fontSize: "12px" } }, message)
    : TextInput({ label: message, disabled: true })
}

function textLine(text: string) {
  return typeof Text === "function"
    ? Text({}, text)
    : TextInput({ label: text, disabled: true })
}
