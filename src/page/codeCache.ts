import type { TotpConfig } from "../shared/TotpConfig"
import { currentPeriod, totp } from "../shared/totp"

/**
 * A Code lookup that runs the HMAC once per Token and Period instead of on
 * every tick; the page's 1 Hz tick with 11 Tokens took up to 3 s without it.
 * Keeps the current and the next Period's Code per Token.
 *
 * Fitbit's `TokenPasswordCache` computes the next Code ahead at random, 15 %
 * per tick. That stacked several HMACs into one tick — 1331 ms with 10 Tokens
 * on hardware — so here one Token per tick (per `nowMs` second) computes
 * ahead: the first one lacking its next Code. With fewer Tokens than seconds
 * in a Period, every next Code is ready before the boundary.
 */
export function createCodeCache(compute = totp) {
  const cache = new Map<string, Record<number, string>>()
  let lastAheadSecond: number | undefined

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
    const wasCached = cached[period] !== undefined
    const current = cached[period] ?? compute(token, driftSeconds, false, nowMs)
    const second = Math.floor(nowMs / 1000)
    let next = cached[period + 1]
    /* Not after computing the current Code: a tick stays at one HMAC. */
    if (next === undefined && wasCached && second !== lastAheadSecond) {
      lastAheadSecond = second
      next = compute(token, driftSeconds, true, nowMs)
    }
    cache.set(
      key,
      next === undefined
        ? { [period]: current }
        : { [period]: current, [period + 1]: next }
    )
    return current
  }
}
