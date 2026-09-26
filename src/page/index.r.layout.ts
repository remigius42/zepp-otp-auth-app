import { px } from "@zos/utils"

/** Amazfit Active 2 (round), 466 x 466. */
export const SCREEN = {
  width: px(466),
  height: px(466)
}

/**
 * The Token list, inset on every side: the spike showed a row child at
 * `x: px(12)` clipped by the round screen's corner (ADR-0005). The band above
 * holds the clock-sync message.
 */
export const LIST = {
  x: px(56),
  y: px(56),
  w: px(354),
  h: px(354),
  item_space: px(8)
}

/** Arc frames are rendered at 64 px (`bin/generate-arc-frames.mjs`). */
const ARC_SIZE = px(64)

/** Right of the arc, to the list's right edge. */
const TEXT_X = ARC_SIZE + px(12)
const TEXT_W = px(354) - TEXT_X

/** One Token row: arc left, Display Name above, Code below. */
export const ROW = {
  height: px(96),
  arc: { x: 0, y: px(16), w: ARC_SIZE, h: ARC_SIZE },
  name: { x: TEXT_X, y: px(4), w: TEXT_W, h: px(36), text_size: px(26) },
  code: { x: TEXT_X, y: px(40), w: TEXT_W, h: px(52), text_size: px(44) }
}

/** The enlarged Token view (`shouldUseLargeTokenView`). */
export const LARGE_ROW = {
  height: px(140),
  arc: { x: 0, y: px(38), w: ARC_SIZE, h: ARC_SIZE },
  name: { x: TEXT_X, y: px(6), w: TEXT_W, h: px(44), text_size: px(32) },
  code: { x: TEXT_X, y: px(52), w: TEXT_W, h: px(80), text_size: px(52) }
}

/** ADR-0005's fallback countdown, in the arc's place. */
export const COUNTDOWN_TEXT_SIZE = px(26)

/** "Synchronizing clock...", in the band above the list. */
export const CLOCK_SYNC_TEXT = {
  x: px(83),
  y: px(8),
  w: px(300),
  h: px(44),
  text_size: px(24)
}

/** Waiting, failure and no-tokens messages; wraps, so it spans the middle. */
export const STATUS_TEXT = {
  x: px(48),
  y: px(133),
  w: px(370),
  h: px(200),
  text_size: px(32)
}
