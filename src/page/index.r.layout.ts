import { px } from "@zos/utils"

/** Amazfit Active 2 (round), 466 x 466. */
export const SCREEN = {
  width: px(466),
  height: px(466)
}

export const DISPLAY_NAME_TEXT = {
  x: px(0),
  y: px(150),
  w: px(466),
  h: px(60),
  text_size: px(32)
}

export const CODE_TEXT = {
  x: px(0),
  y: px(210),
  w: px(466),
  h: px(90),
  text_size: px(72)
}

export const COUNTDOWN_TEXT = {
  x: px(0),
  y: px(310),
  w: px(466),
  h: px(50),
  text_size: px(28)
}

/** Waiting, failure and no-tokens messages; wraps, so it spans the middle. */
export const STATUS_TEXT = {
  x: px(48),
  y: px(133),
  w: px(370),
  h: px(200),
  text_size: px(32)
}
