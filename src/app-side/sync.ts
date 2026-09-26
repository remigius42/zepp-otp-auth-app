import type { UpdateTokensMessage } from "../shared/PeerMessage"
import { TOKENS_SETTINGS_KEY } from "../shared/settingsKeys"
import { tokensForSync } from "../shared/tokens"

type TokenStorage = { getItem(key: string): string | undefined }

/** The Sync payload: every valid stored Token. */
export function tokensMessage(storage: TokenStorage): UpdateTokensMessage {
  return {
    type: "UPDATE_TOKENS_MESSAGE",
    tokens: tokensForSync(storage.getItem(TOKENS_SETTINGS_KEY))
  }
}

/**
 * What to push when a settings key changes, if anything. Every settings write
 * wakes the Side Service (§3.6.1), including the URI Paste field's own keys.
 */
export function messageForSettingsChange(
  key: string,
  storage: TokenStorage
): UpdateTokensMessage | undefined {
  return key === TOKENS_SETTINGS_KEY ? tokensMessage(storage) : undefined
}
