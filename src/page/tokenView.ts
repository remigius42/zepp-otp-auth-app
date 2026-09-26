import { formatTotp, getDisplayName } from "../shared/formatTokens"
import type { TotpConfig } from "../shared/TotpConfig"
import { totp } from "../shared/totp"

/**
 * What one Token row shows at the watch's time `nowMs`, corrected by the clock
 * drift measured at the last Sync.
 */
export function tokenView(
  token: TotpConfig,
  nowMs: number,
  driftSeconds: number
) {
  const period = Number(token.period)
  const seconds = nowMs / 1000 + driftSeconds
  return {
    name: getDisplayName(token),
    code: formatTotp(totp(token, driftSeconds, false, nowMs)),
    secondsRemaining: period - (Math.floor(seconds) % period)
  }
}
