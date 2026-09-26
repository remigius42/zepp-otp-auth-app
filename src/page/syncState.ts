import type { AppSettings } from "../shared/AppSettings"
import { ColorSchemeName } from "../shared/ColorSchemes"
import type { SyncMessage } from "../shared/PeerMessage"
import type { TotpConfig } from "../shared/TotpConfig"

/** What the watch knows from the latest Sync; held in memory only (ADR-0004). */
export interface SyncState {
  /** `undefined` until the first Sync arrives. */
  tokens: TotpConfig[] | undefined
  settings: AppSettings
  /** Phone clock minus watch clock, added to the watch's time for Codes. */
  driftSeconds: number
  /** Whether this Sync corrected the clock enough to tell the user. */
  showClockSync: boolean
}

/** Fitbit's threshold for announcing a clock correction. */
const CLOCK_SYNC_THRESHOLD_SECONDS = 0.75

export const INITIAL_SYNC_STATE: SyncState = {
  tokens: undefined,
  settings: {
    colorScheme: ColorSchemeName.default,
    shouldUseLargeTokenView: false
  },
  driftSeconds: 0,
  showClockSync: false
}

/** The state after receiving `message` at the watch's time `nowMs`. */
export function applySync(
  state: SyncState,
  message: SyncMessage,
  nowMs: number
): SyncState {
  const hasPhoneClock = message.phoneEpochSeconds !== undefined
  const driftSeconds = hasPhoneClock
    ? (message.phoneEpochSeconds as number) - nowMs / 1000
    : 0
  return {
    tokens: message.tokens,
    settings: message.settings,
    driftSeconds,
    showClockSync:
      hasPhoneClock &&
      Math.abs(driftSeconds - state.driftSeconds) >=
        CLOCK_SYNC_THRESHOLD_SECONDS
  }
}
