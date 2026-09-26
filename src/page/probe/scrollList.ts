import { align, createWidget, prop, text_style, widget } from "@zos/ui"
import { px } from "@zos/utils"

/**
 * Phase 1 probe for the pivotal §3.5 question: can one `SCROLL_LIST` row be
 * patched, or must the whole data array be re-supplied?
 *
 * The answer decides the entire device UI. With a per-row patch, the countdown
 * can live inside the list (ADR-0005's pre-rendered arc frames, or a text
 * countdown). With whole-array refresh only, a 1 Hz update fights the user's
 * scrolling and the countdown likely has to leave the list altogether.
 *
 * Three things are under test, and only the first is answerable from a
 * transcript — the other two need eyes on the watch:
 *
 * 1. Does `prop.UPDATE_ITEM` exist at runtime, and does `setProperty` accept
 *    it without throwing? (@zeppos/device-types 4.0 declares neither
 *    `UPDATE_ITEM` nor `UPDATE_DATA`, so the typings cannot answer this.)
 * 2. Does an accepted `UPDATE_ITEM` visibly change *only* the targeted row?
 * 3. Does `UPDATE_DATA` reset scroll position — including while the user is
 *    mid-scroll, which is the 1 Hz countdown scenario?
 *
 * A fourth question rides along: `ScrollListItemConfigOptions` in the 4.0
 * typings declares a `fill_view` child alongside `text_view` and `image_view`.
 * The porting analysis §3.5 says rows admit text and image children only. If
 * `fill_view` renders and its width is data-bound, a native per-row progress
 * bar exists and ADR-0005 needs revisiting.
 */

const ROW_COUNT = 20
const ROW_HEIGHT = px(64)
const SCREEN = px(466)
const LIST_TOP = px(120)

interface RowData extends Record<string, unknown> {
  label: string
  bar: number
}

/** Widgets accept props the 4.0 typings do not declare; probe through this. */
interface UntypedWidget {
  setProperty(propertyType: number, value: unknown): void
}

const propRecord = prop as unknown as Record<string, number | undefined>

/* Binding `bar: 50` produced a navy bar, and 50 is 0x000032 -- so the data
 * value bound by a `fill_view`'s `key` looks like a *color*, not a width.
 * These are unmistakable, so one glance settles it: if rows 0-2 come out amber,
 * red and green, the key is a color and `fill_view` is a per-row swatch of
 * fixed size rather than a progress bar -- which would leave ADR-0005's
 * pre-rendered frames in place. */
const BAR_VALUES = [0xffd502, 0xff0000, 0x00ff00]

function makeRows(tick: number): RowData[] {
  const rows: RowData[] = []
  for (let index = 0; index < ROW_COUNT; index += 1) {
    rows.push({
      label: `row ${String(index)} · tick ${String(tick)}`,
      bar: BAR_VALUES[index % BAR_VALUES.length] as number
    })
  }
  return rows
}

let tick = 0
let rows = makeRows(tick)
let autoTimer: ReturnType<typeof setInterval> | undefined

Page({
  build() {
    createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: SCREEN,
      h: SCREEN,
      angle: 0,
      radius: 0,
      color: 0x000000
    })

    const status = createWidget(widget.TEXT, {
      x: px(16),
      y: px(8),
      w: SCREEN - px(32),
      h: px(48),
      color: 0xffd502,
      text_size: px(18),
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: `UPDATE_ITEM: ${
        propRecord.UPDATE_ITEM === undefined ? "absent" : "present"
      } · UPDATE_DATA: ${
        propRecord.UPDATE_DATA === undefined ? "absent" : "present"
      }`
    })

    const say = (message: string) => {
      console.log(message)
      status.setProperty(prop.MORE, { text: message })
    }

    console.log(
      `prop.UPDATE_ITEM = ${String(propRecord.UPDATE_ITEM)}, prop.UPDATE_DATA = ${String(propRecord.UPDATE_DATA)}`
    )

    /* Cast, because probing undeclared surface is the point: the 4.0 typings'
     * `ScrollListFillViewOptions` has no `color`, so a colored `fill_view` is
     * unrepresentable in them even if the runtime accepts it. */
    const createUntypedWidget = createWidget as unknown as (
      widgetType: unknown,
      options: Record<string, unknown>
    ) => UntypedWidget

    const list = createUntypedWidget(widget.SCROLL_LIST, {
      x: 0,
      y: LIST_TOP,
      h: SCREEN - LIST_TOP,
      w: SCREEN,
      item_space: px(4),
      item_config: [
        {
          type_id: 1,
          item_height: ROW_HEIGHT,
          item_bg_color: 0x222222,
          item_bg_radius: px(8),
          text_view: [
            {
              x: px(60),
              y: 0,
              w: px(380),
              h: ROW_HEIGHT,
              key: "label",
              color: 0xffffff,
              text_size: px(20)
            }
          ],
          text_view_count: 1,
          /* Probing whether this child type renders at all; see the note above. */
          fill_view: [
            {
              x: px(12),
              y: px(24),
              w: px(40),
              h: px(16),
              key: "bar",
              color: 0xffd502,
              radius: px(4)
            }
          ],
          fill_view_count: 1
        }
      ],
      item_config_count: 1,
      data_array: rows,
      data_count: rows.length,
      data_type_config: [{ start: 0, end: ROW_COUNT - 1, type_id: 1 }],
      data_type_config_count: 1
    })

    const button = (x: number, w: number, text: string, onClick: () => void) =>
      createWidget(widget.BUTTON, {
        x,
        y: px(60),
        w,
        h: px(50),
        text,
        text_size: px(16),
        normal_color: 0x333333,
        press_color: 0x555555,
        radius: px(25),
        click_func: onClick
      })

    button(px(14), px(140), "UPDATE_ITEM", () => {
      tick += 1
      const updateItem = propRecord.UPDATE_ITEM
      if (updateItem === undefined) {
        say("UPDATE_ITEM absent from prop")
        return
      }
      const patched: RowData = {
        label: `row 0 · PATCHED ${String(tick)}`,
        bar: BAR_VALUES[tick % BAR_VALUES.length] as number
      }
      try {
        list.setProperty(updateItem, { index: 0, item_data: patched })
        say(
          `UPDATE_ITEM accepted (tick ${String(tick)}); does row 0 alone change?`
        )
      } catch (error) {
        say(`UPDATE_ITEM threw: ${String(error)}`)
      }
    })

    button(px(166), px(140), "UPDATE_DATA", () => {
      tick += 1
      const updateData = propRecord.UPDATE_DATA
      if (updateData === undefined) {
        say("UPDATE_DATA absent from prop")
        return
      }
      rows = makeRows(tick)
      try {
        list.setProperty(updateData, {
          data_array: rows,
          data_count: rows.length,
          data_type_config: [{ start: 0, end: ROW_COUNT - 1, type_id: 1 }],
          data_type_config_count: 1,
          on_page: false
        })
        say(
          `UPDATE_DATA accepted (tick ${String(tick)}); did scroll position hold?`
        )
      } catch (error) {
        say(`UPDATE_DATA threw: ${String(error)}`)
      }
    })

    /* The scenario that actually matters: a 1 Hz whole-array refresh while the
     * user is scrolling. Scroll during this and watch what the list does. */
    button(px(318), px(134), "1 Hz auto", () => {
      const updateData = propRecord.UPDATE_DATA
      if (updateData === undefined) {
        say("UPDATE_DATA absent from prop")
        return
      }
      if (autoTimer !== undefined) {
        clearInterval(autoTimer)
        autoTimer = undefined
        say("1 Hz refresh stopped")
        return
      }
      say("1 Hz refresh running — scroll now")
      autoTimer = setInterval(() => {
        tick += 1
        rows = makeRows(tick)
        try {
          list.setProperty(updateData, {
            data_array: rows,
            data_count: rows.length,
            data_type_config: [{ start: 0, end: ROW_COUNT - 1, type_id: 1 }],
            data_type_config_count: 1,
            on_page: false
          })
        } catch (error) {
          console.log(`1 Hz UPDATE_DATA threw: ${String(error)}`)
          if (autoTimer !== undefined) {
            clearInterval(autoTimer)
            autoTimer = undefined
          }
        }
      }, 1000)
    })
  },

  onDestroy() {
    if (autoTimer !== undefined) {
      clearInterval(autoTimer)
      autoTimer = undefined
    }
  }
})
