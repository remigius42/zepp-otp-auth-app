import {
  PENDING_DELETE_INDEX_SETTINGS_KEY,
  TOKENS_SETTINGS_KEY
} from "../shared/settingsKeys"
import type { TotpConfig } from "../shared/TotpConfig"
import {
  deleteToken,
  moveToken,
  parseTokens,
  renameToken
} from "../shared/tokens"
import type { SettingsStorage } from "../shared/SettingsStorage"

/**
 * The Settings App's Token list: rename, reorder and a confirmed delete. Each
 * change writes `tokens` once, so it becomes one push Sync. Any change other
 * than asking to delete abandons a pending delete.
 */

export function handleRename(
  storage: SettingsStorage,
  index: number,
  name: string
) {
  storeTokens(
    storage,
    renameToken(storage.getItem(TOKENS_SETTINGS_KEY), index, name)
  )
}

export function handleMove(
  storage: SettingsStorage,
  index: number,
  delta: number
) {
  storeTokens(
    storage,
    moveToken(storage.getItem(TOKENS_SETTINGS_KEY), index, delta)
  )
}

/** ✕ pressed: the row asks for confirmation instead of deleting. */
export function requestDelete(storage: SettingsStorage, index: number) {
  storage.setItem(PENDING_DELETE_INDEX_SETTINGS_KEY, String(index))
}

export function confirmDelete(storage: SettingsStorage) {
  const index = pendingDeleteIndex(storage)
  if (index === undefined) {
    cancelDelete(storage)
    return
  }
  storeTokens(storage, deleteToken(storage.getItem(TOKENS_SETTINGS_KEY), index))
}

export function cancelDelete(storage: SettingsStorage) {
  storage.removeItem(PENDING_DELETE_INDEX_SETTINGS_KEY)
}

/** The Token awaiting confirmation, unless there is none or it is stale. */
export function pendingDeleteIndex(
  storage: Pick<SettingsStorage, "getItem">
): number | undefined {
  /* A removed key reads back as `null` on hardware, and `Number(null)` is 0. */
  const stored = storage.getItem(PENDING_DELETE_INDEX_SETTINGS_KEY)
  const index = Number(stored)
  const count = parseTokens(storage.getItem(TOKENS_SETTINGS_KEY)).length
  return typeof stored === "string" &&
    stored !== "" &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < count
    ? index
    : undefined
}

function storeTokens(storage: SettingsStorage, tokens: TotpConfig[]) {
  storage.setItem(TOKENS_SETTINGS_KEY, JSON.stringify(tokens))
  cancelDelete(storage)
}
