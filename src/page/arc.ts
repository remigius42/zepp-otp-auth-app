import type { ColorSchemeName } from "../shared/ColorSchemes"

/** Pre-rendered arc frames per color scheme (ADR-0005). */
export const ARC_FRAME_COUNT = 60

/**
 * The arc frame for a Token at the watch's time `nowMs`, corrected by the
 * clock drift: `floor(elapsedFraction × 60)`, so 0 is a full ring. A fraction
 * rather than a second count, so one set of frames covers any Period.
 */
export function arcFrame(
  periodSeconds: number,
  nowMs: number,
  driftSeconds: number
) {
  const elapsedSeconds = (nowMs / 1000 + driftSeconds) % periodSeconds
  return Math.min(
    ARC_FRAME_COUNT - 1,
    Math.floor((elapsedSeconds / periodSeconds) * ARC_FRAME_COUNT)
  )
}

/** The frame's image path, relative to the watch app's assets. */
export function arcFramePath(scheme: ColorSchemeName, index: number) {
  return `arc/${scheme}/${index}.png`
}
