import type { SyncMessage } from "../shared/PeerMessage"
import { settingsFromStorage } from "../shared/settings"
import {
  COLOR_SCHEME_SETTINGS_KEY,
  COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY,
  LARGE_TOKEN_VIEW_SETTINGS_KEY,
  TOKENS_SETTINGS_KEY
} from "../shared/settingsKeys"
import type { SettingsStorage } from "../shared/SettingsStorage"
import { asSyncStats } from "../shared/syncStats"
import { tokensForSync } from "../shared/tokens"

/**
 * The Sync payload: every valid stored Token, the Settings and — with Clock
 * Drift Compensation on — the phone's clock, stamped now rather than when the
 * watch asked, so the Side Service's launch time does not count as drift
 * (ADR-0002 amendment).
 */
export function syncMessage(
  storage: Pick<SettingsStorage, "getItem">,
  nowMs: number
): SyncMessage {
  const { compensateClockDrift, ...settings } = settingsFromStorage(storage)
  return {
    type: "SYNC_MESSAGE",
    tokens: tokensForSync(storage.getItem(TOKENS_SETTINGS_KEY)),
    settings,
    ...(compensateClockDrift ? { phoneEpochSeconds: nowMs / 1000 } : {})
  }
}

/** The keys whose change the watch must see; everything else is phone-only. */
const SYNCED_KEYS = [
  TOKENS_SETTINGS_KEY,
  COLOR_SCHEME_SETTINGS_KEY,
  LARGE_TOKEN_VIEW_SETTINGS_KEY,
  COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY
]

/**
 * What to push when a settings key changes, if anything. Every settings write
 * wakes the Side Service (§3.6.1), including transient UI keys such as the URI
 * Paste field's.
 */
export function messageForSettingsChange(
  key: string,
  storage: Pick<SettingsStorage, "getItem">,
  nowMs: number
): SyncMessage | undefined {
  return SYNCED_KEYS.includes(key) ? syncMessage(storage, nowMs) : undefined
}

/**
 * The value for the Sync Stats settings key, from the params of the watch's
 * launch pull, or `undefined` if they carry none. Storing it wakes the Side
 * Service again but pushes nothing — the key is not synced.
 */
export function syncStatsToStore(params: unknown): string | undefined {
  const syncStats = asSyncStats(
    (params as { syncStats?: unknown } | undefined)?.syncStats
  )
  return syncStats === undefined ? undefined : JSON.stringify(syncStats)
}
