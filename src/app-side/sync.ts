import type { SyncMessage } from "../shared/PeerMessage"
import { settingsFromStorage } from "../shared/settings"
import { TOKENS_SETTINGS_KEY } from "../shared/settingsKeys"
import { tokensForSync } from "../shared/tokens"

type SettingsStorage = { getItem(key: string): string | undefined }

/**
 * The Sync payload: every valid stored Token, the Settings and — with Clock
 * Drift Compensation on — the phone's clock, stamped now rather than when the
 * watch asked, so the Side Service's launch time does not count as drift
 * (ADR-0002 amendment).
 */
export function syncMessage(
  storage: SettingsStorage,
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

/**
 * What to push when a settings key changes, if anything. Every settings write
 * wakes the Side Service (§3.6.1), including the URI Paste field's own keys.
 */
export function messageForSettingsChange(
  key: string,
  storage: SettingsStorage,
  nowMs: number
): SyncMessage | undefined {
  return key === TOKENS_SETTINGS_KEY ? syncMessage(storage, nowMs) : undefined
}
