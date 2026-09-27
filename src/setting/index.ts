/* spell-checker:ignore MJUXILTMPEXTEWRWMNFEITY */

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
import appJson from "../app.json"
import { parseStats } from "../shared/syncStats"
import { parseTokens } from "../shared/tokens"
import type { TotpConfig } from "../shared/TotpConfig"
import { getDisplayName } from "../shared/formatTokens"
import { gettextWithReplacement } from "../shared/i18nUtils"
import licenses from "./licenses"
import {
  addManualToken,
  changeManualField,
  manualEntryErrorKey,
  manualEntryFields,
  resetManualEntry,
  type ManualEntryField
} from "./manualEntry"
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
 * Settings App, in Fitbit's order: Introduction, Tokens (URI Paste and the
 * Token list), Manual Entry, Settings, licenses. Logic lives in `./uriPaste`,
 * `./tokenList`, `./manualEntry`, `./storeSetting` and `./syncStatsSummary`;
 * this file only renders.
 *
 * `View`, `TextInput`, `Button`, `Section`, `Toggle`, `Select` and `Text` are
 * proven on hardware (S1). `Link` is not, and a throw blanks the whole page
 * with no log (§3.6.1), so it checks for itself and falls back to its URL as
 * text, like `Text` falls back to a disabled `TextInput`.
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
      introductionSection(),
      Section({}, [
        heading(gettext("Tokens")),
        textLine(
          gettext(
            "Tap a Token to give it a name of your own. Empty the name to return to its Issuer and Label."
          )
        ),
        /* Without margins, the field blended into the text around it. */
        View({ style: { margin: "16px 0" } }, [
          TextInput({
            label: gettext("Paste otpauth:// URI"),
            subStyle: VALUE_STYLE,
            value: settingsStorage.getItem(URI_PASTE_INPUT_SETTINGS_KEY) ?? "",
            onChange: (input: string) => {
              handleUriPaste(settingsStorage, input)
            }
          }),
          ...(error ? [errorLine(error)] : [])
        ]),
        ...tokens.map((token, index) =>
          index === pending
            ? deleteConfirmationRow(settingsStorage, token)
            : tokenRow(settingsStorage, token, index)
        )
      ]),
      manualEntrySection(settingsStorage),
      settingsSection(settingsStorage),
      licensesSection()
    ])
  }
})

/** Rename field, then ↑ ↓ ✕ side by side. */
function tokenRow(storage: SettingsStorage, token: TotpConfig, index: number) {
  return View(ROW_STYLE, [
    TextInput({
      label: getDisplayName({ ...token, displayName: undefined }),
      subStyle: VALUE_STYLE,
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

function introductionSection() {
  return Section({}, [
    heading(gettext("Introduction")),
    textLine(gettext("Welcome to the OTP Auth App!")),
    link(
      "https://remigius42.github.io/zepp-otp-auth-app/manual/README",
      gettext("User documentation")
    ),
    link(
      "https://www.buymeacoffee.com/remigius",
      gettext("Please help support this app by donating a coffee")
    )
  ])
}

function manualEntrySection(storage: SettingsStorage) {
  const fields = manualEntryFields(storage)
  const errorFor = (field: ManualEntryField) => {
    const error = storage.getItem(manualEntryErrorKey(field))
    return error ? [errorLine(error)] : []
  }
  const input = (
    field: ManualEntryField,
    label: string,
    placeholder: string
  ) => [
    TextInput({
      label,
      placeholder,
      subStyle: VALUE_STYLE,
      value: fields[field],
      onChange: (value: string) => {
        changeManualField(storage, field, value)
      }
    }),
    ...errorFor(field)
  ]
  /* Two bare `Select`s in a row ran their labels together on hardware; a
   * `View` apiece puts each on a line of its own. */
  const select = (field: ManualEntryField, label: string, values: string[]) => [
    View({}, [
      Select({
        label: withValue(label, fields[field]),
        options: values.map(value => ({ name: value, value })),
        value: fields[field],
        onChange: (value: string) => {
          changeManualField(storage, field, value)
        }
      })
    ]),
    ...errorFor(field)
  ]
  return Section({}, [
    heading(gettext("Add token manually")),
    /* Fitbit's placeholders. */
    ...input("label", gettext("Label"), "SSH login"),
    ...input("issuer", gettext("Issuer"), "ACME co."),
    ...input("secret", gettext("Secret in Base32"), "MJUXILTMPEXTEWRWMNFEITY"),
    ...select("algorithm", gettext("Algorithm"), ["SHA1", "SHA256"]),
    ...select("digits", gettext("Number of digits"), ["6", "8"]),
    ...input("period", gettext("Period in seconds"), "30"),
    View(BUTTONS_STYLE, [
      Button({
        label: gettext("Add token"),
        onClick: () => {
          addManualToken(storage)
        }
      }),
      Button({
        label: gettext("Reset to defaults"),
        onClick: () => {
          resetManualEntry(storage)
        }
      })
    ])
  ])
}

function licensesSection() {
  return Section({}, [
    heading(gettext("License information")),
    textLine(`zepp-otp-auth-app v${appJson.app.version.name}`),
    textLine("Copyright 2026 binary poetry gmbh."),
    textLine(gettext("Licensed under GPL version 3.0 or later.")),
    textLine(gettext("Third-party licenses")),
    ...Object.values(licenses).map(
      ({ name, version, licenses: license, copyright, repository }) =>
        textLine(
          [`${name}@${version}`, license, copyright, repository]
            .filter(Boolean)
            .join(", "),
          SPACED
        )
    )
  ])
}

function settingsSection(storage: SettingsStorage) {
  const settings = settingsFromStorage(storage)
  const schemes = [
    { name: gettext("Amber on black"), value: ColorSchemeName.default },
    { name: gettext("White on black"), value: ColorSchemeName.white },
    { name: gettext("Black on white"), value: ColorSchemeName.black }
  ]
  const current = schemes.find(({ value }) => value === settings.colorScheme)
  return Section({}, [
    heading(gettext("Settings")),
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
      label: withValue(gettext("Color scheme"), current?.name ?? ""),
      options: schemes,
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

/**
 * A `Select` shows the chosen option only after the page's first rebuild —
 * on first view its field is empty — so the label carries it too.
 */
function withValue(label: string, value: string) {
  return value === "" ? label : `${label}: ${value}`
}

/**
 * A `TextInput` shows its value as sub-text under the label; styled as in
 * Zeus's `todo-list` template.
 */
const VALUE_STYLE = { color: "#333", fontSize: "14px" }

function errorLine(message: string) {
  return typeof Text === "function"
    ? Text({ style: { color: "#d00", fontSize: "12px" } }, message)
    : TextInput({ label: message, disabled: true })
}

/* `Text` and `Link` flow inline on hardware, running into each other; a
 * `View` apiece puts each on a line of its own. */

/** `Section`'s `title` renders as plain body text, so headings are our own. */
function heading(title: string) {
  return typeof Text === "function"
    ? View({ style: { marginTop: "24px", marginBottom: "8px" } }, [
        Text({ style: { fontSize: "20px", fontWeight: "bold" } }, title)
      ])
    : textLine(title)
}

/** Space above a line, to set it apart from the one before. */
const SPACED = { style: { marginTop: "12px" } }

function link(url: string, label: string) {
  return typeof Link === "function"
    ? View(SPACED, [Link({ source: url }, label)])
    : textLine(`${label}: ${url}`, SPACED)
}

function textLine(text: string, props = {}) {
  return typeof Text === "function"
    ? View(props, [Text({}, text)])
    : TextInput({ label: text, disabled: true })
}
