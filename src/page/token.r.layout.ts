import { px } from "@zos/utils"

/** Amazfit Active 2 (round), 466 x 466. */
export const SCREEN = {
  width: px(466),
  height: px(466)
}

/**
 * The arc at the size its frames are rendered (`bin/generate-arc-frames.mjs`):
 * a larger one would need a second set of frames per scheme (ADR-0005).
 */
export const ARC = { x: px(201), y: px(116), w: px(64), h: px(64) }

/** ADR-0005's fallback countdown, in the arc's place. */
export const COUNTDOWN_TEXT_SIZE = px(26)

/**
 * Display Name and Code, stacked below the arc around the middle, where the
 * round screen is widest; every box corner stays 16 px inside the edge.
 */
export const NAME = {
  x: px(43),
  y: px(192),
  w: px(380),
  h: px(48),
  text_size: px(36)
}

/** Large enough to read at a glance; an 8-digit Code must still fit. */
export const CODE = {
  x: px(43),
  y: px(248),
  w: px(380),
  h: px(88),
  text_size: px(72)
}
