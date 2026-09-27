import {
  MANUAL_ENTRY_SETTINGS_KEYS,
  TOKENS_SETTINGS_KEY
} from "../shared/settingsKeys"
import { addTokenManually, type TokenFields } from "../shared/tokens"
import type { SettingsStorage } from "../shared/SettingsStorage"

export type ManualEntryField = keyof typeof MANUAL_ENTRY_SETTINGS_KEYS

const FIELDS = Object.keys(MANUAL_ENTRY_SETTINGS_KEYS) as ManualEntryField[]

/** What an untouched field holds: Fitbit's and most issuers' defaults. */
const DEFAULTS: TokenFields = {
  label: "",
  issuer: "",
  secret: "",
  algorithm: "SHA1",
  digits: "6",
  period: "30"
}

export const manualEntryErrorKey = (field: ManualEntryField) =>
  `${MANUAL_ENTRY_SETTINGS_KEYS[field]}Error`

/** The fields as typed so far, defaults where untouched. */
export function manualEntryFields(
  storage: Pick<SettingsStorage, "getItem">
): TokenFields {
  const fields = { ...DEFAULTS }
  for (const field of FIELDS) {
    fields[field] =
      storage.getItem(MANUAL_ENTRY_SETTINGS_KEYS[field]) ?? DEFAULTS[field]
  }
  return fields
}

/** A field changed; nothing is validated until Add. */
export function changeManualField(
  storage: SettingsStorage,
  field: ManualEntryField,
  value: string
) {
  storage.setItem(MANUAL_ENTRY_SETTINGS_KEYS[field], value)
}

/**
 * Add pressed. On success the Token is stored and every field empties, so
 * the Secret leaves the screen; otherwise each error goes under its field.
 */
export function addManualToken(storage: SettingsStorage) {
  const result = addTokenManually(
    storage.getItem(TOKENS_SETTINGS_KEY),
    manualEntryFields(storage)
  )
  if ("tokens" in result) {
    storage.setItem(TOKENS_SETTINGS_KEY, JSON.stringify(result.tokens))
    resetManualEntry(storage)
    return
  }
  for (const field of FIELDS) {
    const error = result.errors.get(field)
    if (error === undefined) storage.removeItem(manualEntryErrorKey(field))
    else storage.setItem(manualEntryErrorKey(field), error)
  }
}

/** "Reset to defaults": clears every field and error. */
export function resetManualEntry(storage: SettingsStorage) {
  for (const field of FIELDS) {
    storage.removeItem(MANUAL_ENTRY_SETTINGS_KEYS[field])
    storage.removeItem(manualEntryErrorKey(field))
  }
}
