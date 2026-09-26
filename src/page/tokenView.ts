import type { PeerMessage } from "../shared/PeerMessage"
import { formatTotp, getDisplayName } from "../shared/formatTokens"
import type { TotpConfig } from "../shared/TotpConfig"
import { totp } from "../shared/totp"

/** What one Token row shows right now. */
export function tokenView(token: TotpConfig) {
  const period = Number(token.period)
  return {
    name: getDisplayName(token),
    code: formatTotp(totp(token)),
    secondsRemaining: period - (Math.floor(Date.now() / 1000) % period)
  }
}

/** The Token set carried by a Sync message, if it is one. */
export function tokensFromMessage(message: PeerMessage) {
  return message.type === "SYNC_MESSAGE" ? message.tokens : undefined
}
