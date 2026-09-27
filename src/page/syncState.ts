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

/** `localStorage` key of the last Sync's color scheme (ADR-0004 amendment). */
export const COLOR_SCHEME_STORAGE_KEY = "colorScheme"

/** Fitbit's threshold for announcing a clock correction. */
const CLOCK_SYNC_THRESHOLD_SECONDS = 0.75

/**
 * The state before the first Sync. The color scheme is the one the watch
 * remembers from the last Sync, so the waiting message does not flip color;
 * anything else stays in memory only (ADR-0004).
 */
export function initialSyncState(storedScheme: string | undefined): SyncState {
  return {
    tokens: undefined,
    settings: {
      colorScheme: Object.values(ColorSchemeName).includes(
        storedScheme as ColorSchemeName
      )
        ? (storedScheme as ColorSchemeName)
        : ColorSchemeName.default,
      shouldUseLargeTokenView: false
    },
    driftSeconds: 0,
    showClockSync: false
  }
}

/**
 * `value` if it has the shape of a `SyncMessage`, else `undefined`. The Side
 * Service validates every Token before it sends (`tokensForSync`); this
 * checks the shape only, so a malformed message is ignored rather than
 * crashing the page. The phone checks the Sync Stats the same way.
 */
export function asSyncMessage(value: unknown): SyncMessage | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const { type, tokens, settings, phoneEpochSeconds } = value as Record<
    string,
    unknown
  >
  if (type !== "SYNC_MESSAGE") return undefined
  if (!Array.isArray(tokens) || !tokens.every(isTotpConfig)) return undefined
  if (!isAppSettings(settings)) return undefined
  if (
    phoneEpochSeconds !== undefined &&
    typeof phoneEpochSeconds !== "number"
  ) {
    return undefined
  }
  return {
    type,
    tokens,
    settings,
    ...(phoneEpochSeconds === undefined ? {} : { phoneEpochSeconds })
  }
}

function isTotpConfig(value: unknown): value is TotpConfig {
  if (typeof value !== "object" || value === null) return false
  const token = value as Record<string, unknown>
  return (
    ["label", "secret", "algorithm", "digits", "period"].every(
      key => typeof token[key] === "string"
    ) &&
    ["issuer", "displayName"].every(
      key => token[key] === undefined || typeof token[key] === "string"
    )
  )
}

function isAppSettings(value: unknown): value is AppSettings {
  if (typeof value !== "object" || value === null) return false
  const { colorScheme, shouldUseLargeTokenView } = value as Record<
    string,
    unknown
  >
  return (
    Object.values(ColorSchemeName).includes(colorScheme as ColorSchemeName) &&
    typeof shouldUseLargeTokenView === "boolean"
  )
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

/**
 * Whether a Sync from `previous` to `next` Settings must re-launch the page,
 * since colors and row sizes are fixed at widget creation. A color change
 * always does: the status text is colored too. A size change only once the
 * list exists — otherwise the list is created in the new size anyway. The
 * enlarged view is not stored, so a re-launched page starts without it, and
 * relaunching on that first Sync looped.
 */
export function needsRelaunch(
  previous: AppSettings,
  next: AppSettings,
  hasList: boolean
): boolean {
  return (
    next.colorScheme !== previous.colorScheme ||
    (hasList &&
      next.shouldUseLargeTokenView !== previous.shouldUseLargeTokenView)
  )
}
