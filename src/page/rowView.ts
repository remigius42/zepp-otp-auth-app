import type { ColorSchemeName } from "../shared/ColorSchemes"
import type { TotpConfig } from "../shared/TotpConfig"
import { arcFrame, arcFramePath } from "./arc"
import { tokenView } from "./tokenView"

/**
 * ADR-0005's fallback: a text countdown such as `23s` in the arc's place. Set
 * if the arc frames fail on hardware — janky at 1 Hz, not rendering, or a tick
 * over 250 ms with 12 Tokens.
 */
export const ARC_FALLBACK = false

export type RowView =
  | { name: string; code: string; arc: string }
  | { name: string; code: string; countdown: string }

/**
 * One row of the watch's Token list at the watch's time `nowMs`, corrected by
 * the clock drift; the keys match the `SCROLL_LIST` row's data keys.
 */
export function rowView(
  token: TotpConfig,
  nowMs: number,
  driftSeconds: number,
  scheme: ColorSchemeName,
  arcFallback = ARC_FALLBACK
): RowView {
  const { name, code, secondsRemaining } = tokenView(token, nowMs, driftSeconds)
  return arcFallback
    ? { name, code, countdown: `${secondsRemaining}s` }
    : {
        name,
        code,
        arc: arcFramePath(
          scheme,
          arcFrame(Number(token.period), nowMs, driftSeconds)
        )
      }
}
