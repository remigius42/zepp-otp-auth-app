/**
 * How long after a second boundary the tick fires, so that timer jitter never
 * lands it just before the boundary, still showing the old second.
 */
export const TICK_MARGIN_MS = 20

/**
 * The delay until the next tick: just after the next drift-shifted second
 * boundary, so a Code flips when its Period ends rather than up to a second
 * later. The page re-arms a `setTimeout` with it on every tick.
 */
export function msUntilNextTick(nowMs: number, driftSeconds: number) {
  const shiftedMs = nowMs + driftSeconds * 1000
  const intoSecondMs = ((shiftedMs % 1000) + 1000) % 1000
  return 1000 - intoSecondMs + TICK_MARGIN_MS
}
