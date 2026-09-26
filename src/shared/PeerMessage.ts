import type { AppSettings } from "./AppSettings"
import type { TotpConfig } from "./TotpConfig"

/**
 * One Sync: the whole Token set and the Settings in one message. ZML chunks,
 * orders and length-checks the payload, so Fitbit's start/token/end envelope
 * with its `count` and `index` is gone, and so is its separate settings
 * message (ADR-0002, ADR-0004 amendments).
 */
export interface SyncMessage {
  type: "SYNC_MESSAGE"
  tokens: TotpConfig[]
  settings: AppSettings
  /**
   * The phone's clock when the message was built, present only with Clock
   * Drift Compensation on. Fitbit's `secondsSinceEpochInCompanion`.
   */
  phoneEpochSeconds?: number
}

export type PeerMessage = SyncMessage

/** Device → Side Service request for a Sync; answered with a `SyncMessage`. */
export const GET_TOKENS_METHOD = "GET_TOKENS"

/** Side Service → device push carrying a `PeerMessage`. */
export const PEER_MESSAGE_METHOD = "PEER_MESSAGE"
