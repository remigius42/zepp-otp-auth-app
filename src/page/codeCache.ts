import type { TotpConfig } from "../shared/TotpConfig"
import { currentPeriod, totp } from "../shared/totp"

/**
 * Chance per tick of computing the next Period's Code ahead. Ported from
 * Fitbit's `TokenPasswordCache`: over a 30 s Period, at least one hit is
 * > 99 % likely, so Tokens that flip together do not all compute in the
 * boundary tick.
 */
const PRECOMPUTE_PROBABILITY = 0.15

/**
 * A Code lookup that runs the HMAC once per Token and Period instead of on
 * every tick; the page's 1 Hz tick with 11 Tokens took up to 3 s without it.
 * Keeps the current and the next Period's Code per Token.
 */
export function createCodeCache(compute = totp, random = Math.random) {
  const cache = new Map<string, Record<number, string>>()

  return function code(
    token: TotpConfig,
    driftSeconds: number,
    nowMs: number
  ): string {
    const key = [
      token.issuer,
      token.label,
      token.secret,
      token.algorithm,
      token.digits,
      token.period
    ].join("\n")
    const period = currentPeriod(Number(token.period), driftSeconds, nowMs)
    const cached = cache.get(key) ?? {}
    const current = cached[period] ?? compute(token, driftSeconds, false, nowMs)
    const next =
      cached[period + 1] ??
      (random() < PRECOMPUTE_PROBABILITY
        ? compute(token, driftSeconds, true, nowMs)
        : undefined)
    cache.set(
      key,
      next === undefined
        ? { [period]: current }
        : { [period]: current, [period + 1]: next }
    )
    return current
  }
}
