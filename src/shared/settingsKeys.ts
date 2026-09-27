/** Settings-storage keys shared by the Settings App and the Side Service. */

/** The enrolled Token set, as a JSON array of `TotpConfig`. */
export const TOKENS_SETTINGS_KEY = "tokens"

/** The URI Paste field's text, kept only while it shows an error. */
export const URI_PASTE_INPUT_SETTINGS_KEY = "uriPasteInput"

/** The URI Paste field's error message, absent when there is none. */
export const URI_PASTE_ERROR_SETTINGS_KEY = "uriPasteError"

/** The color scheme, as a JSON-encoded `ColorSchemeName`. */
export const COLOR_SCHEME_SETTINGS_KEY = "colorScheme"

/** Whether the watch shows the enlarged Token view, as JSON `true`/`false`. */
export const LARGE_TOKEN_VIEW_SETTINGS_KEY = "shouldUseLargeTokenView"

/** Whether Syncs carry the phone's clock, as JSON `true`/`false`. */
export const COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY = "compensateClockDrift"

/** The watch's Sync Stats as last reported with a launch pull, JSON-encoded. */
export const SYNC_STATS_SETTINGS_KEY = "syncStats"

/** The index of the Token awaiting delete confirmation, absent when none. */
export const PENDING_DELETE_INDEX_SETTINGS_KEY = "pendingDeleteIndex"

/**
 * The Manual Entry fields' text, per field; each field's error message is
 * kept under the same key plus `Error`. All absent once a Token is added.
 */
export const MANUAL_ENTRY_SETTINGS_KEYS = {
  label: "manualLabel",
  issuer: "manualIssuer",
  secret: "manualSecret",
  algorithm: "manualAlgorithm",
  digits: "manualDigits",
  period: "manualPeriod"
} as const
