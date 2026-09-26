import { align, createWidget, prop, text_style, widget } from "@zos/ui"
import { px } from "@zos/utils"

/**
 * Minimal line-per-result renderer for the Phase 1 spike probes.
 *
 * Deliberately not built on `SCROLL_LIST`: one of the things being probed is
 * whether `SCROLL_LIST` can be updated per row, so the harness that reports the
 * answer must not depend on it. Plain `TEXT` widgets stacked down the page,
 * relying on the page's own vertical scroll, have no such coupling.
 *
 * Layout constants live here rather than in a `*.layout.js` module because the
 * probes are diagnostic scaffolding that is deleted at the end of Phase 1; see
 * docs/spike-probes.md.
 */

/** Result colors, chosen for legibility on black rather than for the schemes. */
export const OK = 0x00c853
export const FAIL = 0xff5252
export const PENDING = 0x808080
export const INFO = 0xffd502

const SCREEN = px(466)
const MARGIN = px(24)
const LINE_HEIGHT = px(30)
const LINE_TEXT_SIZE = px(20)
const TITLE_HEIGHT = px(44)
const TITLE_TEXT_SIZE = px(26)

/** A single result line, updatable after an asynchronous check settles. */
export interface ProbeLine {
  set(text: string, color?: number): void
}

export interface ProbeScreen {
  addLine(text: string, color?: number): ProbeLine
  addButton(text: string, onClick: () => void): void
}

/**
 * Create a probe screen with a title, and return a handle for appending lines.
 *
 * Every line is also written to `console.log`, so a `zeus dev` session yields a
 * transcript that can be pasted straight into the write-up. That transcript,
 * not the screen, is the record.
 */
export function createProbeScreen(title: string): ProbeScreen {
  console.log(`=== ${title} ===`)

  createWidget(widget.FILL_RECT, {
    x: 0,
    y: 0,
    w: SCREEN,
    h: SCREEN,
    angle: 0,
    radius: 0,
    color: 0x000000
  })

  createWidget(widget.TEXT, {
    x: MARGIN,
    y: px(16),
    w: SCREEN - 2 * MARGIN,
    h: TITLE_HEIGHT,
    color: INFO,
    text_size: TITLE_TEXT_SIZE,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V,
    text_style: text_style.NONE,
    text: title
  })

  let nextY = px(16) + TITLE_HEIGHT

  return {
    addLine(text, color = INFO) {
      console.log(text)

      const line = createWidget(widget.TEXT, {
        x: MARGIN,
        y: nextY,
        w: SCREEN - 2 * MARGIN,
        h: LINE_HEIGHT,
        color,
        text_size: LINE_TEXT_SIZE,
        align_h: align.LEFT,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text
      })
      nextY += LINE_HEIGHT

      return {
        set(updated, updatedColor) {
          console.log(updated)
          line.setProperty(prop.MORE, {
            text: updated,
            ...(updatedColor === undefined ? {} : { color: updatedColor })
          })
        }
      }
    },

    addButton(text, onClick) {
      createWidget(widget.BUTTON, {
        x: MARGIN,
        y: nextY + px(8),
        w: SCREEN - 2 * MARGIN,
        h: px(56),
        text,
        text_size: LINE_TEXT_SIZE,
        normal_color: 0x333333,
        press_color: 0x555555,
        radius: px(28),
        click_func: onClick
      })
      nextY += px(72)
    }
  }
}

/** Render a check result as a single `✓`/`✗` line. */
export function reportCheck(
  screen: ProbeScreen,
  name: string,
  run: () => string
): ProbeLine {
  try {
    const detail = run()
    return screen.addLine(`✓ ${name}: ${detail}`, OK)
  } catch (error) {
    return screen.addLine(`✗ ${name}: ${String(error)}`, FAIL)
  }
}
