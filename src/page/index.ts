import { BasePage } from "@zeppos/zml/base-page"
import { setPageBrightTime } from "@zos/display"
import { getText } from "@zos/i18n"
import { showToast } from "@zos/interaction"
import { replace } from "@zos/router"
import { localStorage } from "@zos/storage"
import {
  align,
  createWidget,
  deleteWidget,
  event,
  prop,
  text_style,
  widget
} from "@zos/ui"
import { ColorSchemes, toZeppColor } from "../shared/ColorSchemes"
import {
  GET_TOKENS_METHOD,
  PEER_MESSAGE_METHOD,
  type PeerMessage
} from "../shared/PeerMessage"
import { parseStats, recordPull } from "../shared/syncStats"
import { changedRows } from "./changedRows"
import { pageStatus, type PullState } from "./pageStatus"
import { ARC_FALLBACK, rowView, type RowView } from "./rowView"
import { applySync, initialSyncState, needsRelaunch } from "./syncState"
import { msUntilNextTick } from "./tick"
import { withTimeout } from "./withTimeout"
import * as Styles from "zosLoader:./index.[pf].layout.js"

/**
 * The Token list: one `SCROLL_LIST` row per synced Token, ticking.
 *
 * Sync per the ADR-0002 amendment: `onInit` pulls the Token set, `onCall`
 * receives pushes while the page is open. A failed pull is retried only by
 * tapping the status — not on `onResume`, which looped (ADR-0003 amendment).
 * What to show lives in `./rowView`, `./changedRows` and `./pageStatus`; this
 * file is widget and ZML wiring only.
 *
 * A Sync that changes the Token count re-supplies the whole list
 * (`UPDATE_DATA`), and one that changes the color scheme or the enlarged view
 * re-launches the page, since row colors and sizes are fixed at creation.
 * Otherwise Syncs and ticks patch only the changed rows (`UPDATE_ITEM`): a
 * whole-list update scrolls back to the top (ADR-0005).
 *
 * The ticker starts in `build` and `onResume` and stops in `onPause` and
 * `onDestroy`. `build` as well because the spike counted fewer `onResume`
 * than `onPause` calls, so `onResume` may not fire on first show (§3.1.1).
 */

/**
 * How long the screen stays on. By default Zepp OS turns the screen off after
 * 10 s and exits a Mini Program 10 s after that, which closed the app before
 * a Code could be typed. Two 30 s Periods; the system resets it when the page
 * is destroyed.
 */
const SCREEN_ON_MS = 60_000

/** Shorter than ZML's 60 s default, so a Side Service that never answers shows. */
const SYNC_TIMEOUT_MS = 10_000

/** `localStorage` key of the Sync Stats — diagnostics only (ADR-0004). */
const SYNC_STATS_STORAGE_KEY = "syncStats"

/** `localStorage` key of the last Sync's color scheme (ADR-0004 amendment). */
const COLOR_SCHEME_STORAGE_KEY = "colorScheme"

/** The row layout's only `type_id`. */
const ROW_TYPE = 1

/**
 * Runtime props the 4.0 typings lack (analysis §3.5.1), and `setProperty`
 * for props other than `MORE`, which the typings admit alone.
 */
const listProp = prop as unknown as { UPDATE_DATA: number; UPDATE_ITEM: number }
type Widget = ReturnType<typeof createWidget>
type UntypedWidget = {
  setProperty(property: number, value: unknown): boolean
  getProperty(property: number): unknown
}
const untyped = (target: Widget) => target as unknown as UntypedWidget

let state = initialSyncState(readStorage(COLOR_SCHEME_STORAGE_KEY))
let pull: PullState = "pending"
/** `this.request` of the page, which `pull` needs outside the lifecycle. */
let request:
  | ((
      data: { method: string; params: Record<string, unknown> },
      options: { timeout: number }
    ) => Promise<unknown>)
  | undefined
let background: Widget | undefined
let statusText: Widget | undefined
let list: Widget | undefined
let rows: RowView[] = []
let timer: ReturnType<typeof setTimeout> | undefined

/** `getItem` as it behaves; the typings claim it returns `void` (§3.8). */
function readStorage(key: string) {
  return localStorage.getItem(key) as unknown as string | undefined
}

function scheme() {
  return ColorSchemes[state.settings.colorScheme]
}

function currentRows() {
  const now = Date.now()
  return (state.tokens ?? []).map(token =>
    rowView(token, now, state.driftSeconds, state.settings.colorScheme)
  )
}

/** Shows the status or the list, whichever `pageStatus` calls for. */
function render() {
  /* The launch pull starts in `onInit`, before `build` creates the widgets;
   * `build` renders then. Throwing here once kept the pull from being sent. */
  if (statusText === undefined) return
  const status = pageStatus({ pull, tokens: state.tokens })
  if (status.kind === "tokens") {
    untyped(statusText as Widget).setProperty(prop.VISIBLE, false)
    showList()
  } else {
    removeList()
    const text = getText(status.msgid)
    untyped(statusText as Widget).setProperty(prop.TEXT, text)
    untyped(statusText as Widget).setProperty(prop.VISIBLE, true)
  }
}

function showList() {
  const previous = rows
  rows = currentRows()
  if (list !== undefined) {
    /* A rename or reorder keeps the row count; patching keeps the scroll
     * position, which `UPDATE_DATA` resets to the top. */
    if (rows.length === previous.length) patchRows(list, previous, rows)
    else untyped(list).setProperty(listProp.UPDATE_DATA, listData(rows))
    return
  }
  removeList()
  list = createWidget(widget.SCROLL_LIST, {
    ...Styles.LIST,
    item_config: [rowConfig()],
    item_config_count: 1,
    ...listData(rows)
  })
}

/** `UPDATE_ITEM` for the rows that differ; the rest stay untouched. */
function patchRows(target: Widget, previous: RowView[], next: RowView[]) {
  for (const index of changedRows(previous, next)) {
    untyped(target).setProperty(listProp.UPDATE_ITEM, {
      index,
      item_data: next[index]
    })
  }
}

function removeList() {
  if (list !== undefined) deleteWidget(list)
  list = undefined
}

function listData(data: RowView[]) {
  return {
    data_array: data,
    data_count: data.length,
    data_type_config: [{ start: 0, end: data.length - 1, type_id: ROW_TYPE }],
    data_type_config_count: 1
  }
}

/** The row layout in the current colors and size. */
function rowConfig() {
  const colors = scheme()
  const row = state.settings.shouldUseLargeTokenView
    ? Styles.LARGE_ROW
    : Styles.ROW
  const text = (
    key: string,
    box: typeof row.name,
    color: number,
    alignH = align.LEFT
  ) => ({
    ...box,
    key,
    color,
    align_h: alignH,
    align_v: align.CENTER_V,
    text_style: text_style.NONE
  })
  const secondary = toZeppColor(colors.secondaryColor)
  const texts = [
    /* Primary, not secondary: the darkened colors were too dim to read. */
    text("name", row.name, toZeppColor(colors.primaryColor)),
    text("code", row.code, toZeppColor(colors.primaryColor))
  ]
  const images = []
  if (ARC_FALLBACK) {
    texts.push(
      text(
        "countdown",
        { ...row.arc, text_size: Styles.COUNTDOWN_TEXT_SIZE },
        secondary,
        align.CENTER_H
      )
    )
  } else {
    images.push({ ...row.arc, key: "arc" })
  }
  return {
    type_id: ROW_TYPE,
    item_height: row.height,
    item_bg_color: toZeppColor(colors.backgroundColor),
    item_bg_radius: 0,
    text_view: texts,
    text_view_count: texts.length,
    image_view: images,
    image_view_count: images.length
  }
}

/**
 * The status message, colored at creation: S1 set text and color through
 * `prop.MORE` on a wrapping `TEXT` and nothing showed.
 */
function createStatusText() {
  statusText = createWidget(widget.TEXT, {
    ...Styles.STATUS_TEXT,
    /* Primary, not secondary: the darkened amber was too dim to read. */
    color: toZeppColor(scheme().primaryColor),
    align_h: align.CENTER_H,
    align_v: align.CENTER_V,
    text_style: text_style.WRAP,
    text: ""
  })
  statusText.addEventListener(event.CLICK_UP, () => {
    if (pull !== "failed") return
    reconnect()
    pullTokens()
  })
}

/** Colors the widgets that take a color after creation. */
function applyColorScheme() {
  const colors = scheme()
  background?.setProperty(prop.MORE, {
    color: toZeppColor(colors.backgroundColor)
  })
}

/**
 * Re-opens ZML's Bluetooth connection. When Bluetooth returns, the Zepp app
 * closes the Side Service, and from then on nothing the page sent reached the
 * phone: every retry timed out until the app was re-opened. The transport is
 * the app-wide one `BaseApp` creates, so only it is re-created — the
 * `messaging` wrapper's own `disConnect` also drops the response listener.
 * Not public ZML API (0.0.43, `dist/zml-app.js`).
 */
function reconnect() {
  const { transport } = (
    getApp() as unknown as {
      _options: {
        globalData: {
          messaging: { transport: { disConnect(): void; connect(): void } }
        }
      }
    }
  )._options.globalData.messaging
  transport.disConnect()
  transport.connect()
}

/** One tick: patch the rows whose Code or arc moved on. */
function tick() {
  if (list !== undefined) {
    const next = currentRows()
    patchRows(list, rows, next)
    rows = next
  }
}

/** The launch pull, also used to retry; records the outcome in Sync Stats. */
function pullTokens() {
  if (request === undefined) return
  pull = "pending"
  render()
  const startedAt = Date.now()
  const stats = parseStats(readStorage(SYNC_STATS_STORAGE_KEY))
  const record = (outcome: "synced" | "failed", ms: number) =>
    localStorage.setItem(
      SYNC_STATS_STORAGE_KEY,
      JSON.stringify(recordPull(stats, outcome, ms))
    )
  const send = request
  /* ZML's handshake can throw synchronously — `ble.send` failing just after
   * Bluetooth returns — which left the pull pending for good: "waiting"
   * forever, and taps retry only a failed pull. Inside `then`, the throw
   * becomes a failed pull like any other. ZML's timeout did not fire for a
   * pull sent right after Bluetooth returned, hence our own. */
  withTimeout(
    Promise.resolve().then(() =>
      send(
        {
          method: GET_TOKENS_METHOD,
          params: { syncStats: stats }
        },
        { timeout: SYNC_TIMEOUT_MS }
      )
    ),
    SYNC_TIMEOUT_MS
  )
    .then(result => {
      const elapsed = Date.now() - startedAt
      record("synced", elapsed)
      pull = "synced"
      receive(result as PeerMessage)
    })
    .catch(() => {
      const elapsed = Date.now() - startedAt
      record("failed", elapsed)
      pull = "failed"
      render()
    })
}

function receive(message: PeerMessage) {
  const now = Date.now()
  const previous = state.settings
  state = applySync(state, message, now)
  /* A toast rather than our own text: the round screen is too narrow near
   * the top, and the message was cut off there. */
  if (state.showClockSync) {
    showToast({ content: getText("Synchronizing clock...") })
  }
  if (state.settings.colorScheme !== previous.colorScheme) {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, state.settings.colorScheme)
  }
  /* Before `build` there are no widgets yet; `build` creates them colored. */
  if (statusText === undefined) return
  /* Re-created in place, the list took the new arcs but kept its old text
   * colors; a freshly opened page colors correctly, so re-launch it. It pulls
   * the new Settings itself. */
  if (needsRelaunch(previous, state.settings, list !== undefined)) {
    replace({ url: "page/index" })
    return
  }
  render()
}

function startTicking() {
  stopTicking()
  const arm = () => {
    timer = setTimeout(
      () => {
        tick()
        arm()
      },
      msUntilNextTick(Date.now(), state.driftSeconds)
    )
  }
  arm()
}

function stopTicking() {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
}

Page(
  BasePage({
    onInit() {
      /* zml.d.ts declares `request(data)` alone, but the runtime takes
       * `(data, options)` and forwards `timeout` (dist/zml-page.js). */
      const pageRequest = this.request as NonNullable<typeof request>
      request = (data, options) => pageRequest.call(this, data, options)
      pullTokens()
    },

    onCall(data: { method: string; params: unknown }) {
      if (data.method === PEER_MESSAGE_METHOD) {
        receive(data.params as PeerMessage)
      }
    },

    build() {
      setPageBrightTime({ brightTime: SCREEN_ON_MS })

      background = createWidget(widget.FILL_RECT, {
        x: 0,
        y: 0,
        w: Styles.SCREEN.width,
        h: Styles.SCREEN.height,
        angle: 0,
        radius: 0,
        color: 0
      })

      applyColorScheme()
      createStatusText()
      render()
      startTicking()
    },

    onResume() {
      startTicking()
    },

    onPause() {
      stopTicking()
    },

    onDestroy() {
      stopTicking()
      /* The page may be re-launched in this same module (`receive`). */
      background = undefined
      statusText = undefined
      list = undefined
      rows = []
    }
  })
)
