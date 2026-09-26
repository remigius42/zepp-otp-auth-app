import { AppSettings } from "./AppSettings"
import type { TotpConfig } from "./TotpConfig"

/**
 * The whole Token set in one message. ZML chunks, orders and length-checks
 * the payload, so Fitbit's start/token/end envelope with its `count` and
 * `index` is gone (ADR-0002).
 */
export interface UpdateTokensMessage {
  type: "UPDATE_TOKENS_MESSAGE"
  tokens: TotpConfig[]
}

export interface UpdateSettingsMessage {
  type: "UPDATE_SETTINGS_MESSAGE"
  updatedSettings: Partial<AppSettings>
}

export type PeerMessage = UpdateTokensMessage | UpdateSettingsMessage

/** Device → Side Service request for a Sync; answered with an `UpdateTokensMessage`. */
export const GET_TOKENS_METHOD = "GET_TOKENS"

/** Side Service → device push carrying a `PeerMessage`. */
export const PEER_MESSAGE_METHOD = "PEER_MESSAGE"
