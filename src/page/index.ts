import { BasePage } from "@zeppos/zml/base-page"
import { setPageBrightTime } from "@zos/display"
import { getText } from "@zos/i18n"
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
import { appendDiag, parseDiag } from "../shared/diagTrail"
import { parseStats, recordPull } from "../shared/syncStats"
import { changedRows } from "./changedRows"
import { pageStatus, type PullState } from "./pageStatus"
import { ARC_FALLBACK, rowView, type RowView } from "./rowView"
import { applySync, INITIAL_SYNC_STATE } from "./syncState"
import { msUntilNextTick } from "./tick"
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
 * re-creates it, since row colors and sizes are fixed at creation. Otherwise
 * Syncs and ticks patch only the changed rows (`UPDATE_ITEM`): a whole-list
 * update scrolls back to the top (ADR-0005).
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

/** Fitbit showed "Synchronizing clock..." this long after a correction. */
const CLOCK_SYNC_MESSAGE_MS = 3500

/** `localStorage` key of the Sync Stats — diagnostics only (ADR-0004). */
const SYNC_STATS_STORAGE_KEY = "syncStats"

/** `localStorage` key of the diagnostic trail (`shared/diagTrail`). */
const DIAG_STORAGE_KEY = "diag"

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

let state = INITIAL_SYNC_STATE
let pull: PullState = "pending"
/** `this.request` of the page, which `pull` needs outside the lifecycle. */
let request:
  | ((
      data: { method: string; params: Record<string, unknown> },
      options: { timeout: number }
    ) => Promise<unknown>)
  | undefined
let clockSyncMessageUntilMs = 0
let background: Widget | undefined
let statusText: Widget | undefined
let clockSyncText: Widget | undefined
let list: Widget | undefined
/** Scheme and row size the list was created with; a change re-creates it. */
let listLook: string | undefined
let rows: RowView[] = []
let timer: ReturnType<typeof setTimeout> | undefined
let lastStatusKind: string | undefined
let maxTickMs = 0
/** The `UPDATE_ITEM` share of the slowest tick, apart from computing rows. */
let maxUpdateMs = 0

/** `getItem` as it behaves; the typings claim it returns `void` (§3.8). */
function readStorage(key: string) {
  return localStorage.getItem(key) as unknown as string | undefined
}

/** Appends to the diagnostic trail, which reaches the bridge log. */
function diag(entry: string) {
  localStorage.setItem(
    DIAG_STORAGE_KEY,
    JSON.stringify(
      appendDiag(parseDiag(readStorage(DIAG_STORAGE_KEY)), entry, Date.now())
    )
  )
}

/** Runs `fn`, recording any throw in the trail instead of losing it. */
function guarded(name: string, fn: () => void) {
  try {
    fn()
  } catch (error) {
    diag(`${name} threw ${String(error)}`)
  }
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
  if (status.kind !== lastStatusKind) {
    lastStatusKind = status.kind
    /* S1 set the status and nothing showed; the read-back tells why. */
    const shown =
      status.kind === "tokens"
        ? `${rows.length} rows`
        : JSON.stringify(untyped(statusText as Widget).getProperty(prop.TEXT))
    diag(`status ${status.kind}: ${shown}`)
  }
}

function showList() {
  const look = `${state.settings.colorScheme} ${state.settings.shouldUseLargeTokenView}`
  const previous = rows
  rows = currentRows()
  if (list !== undefined && look === listLook) {
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
  listLook = look
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
  listLook = undefined
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
 * `prop.MORE` on a wrapping `TEXT` and nothing showed. Re-created when the
 * color scheme changes.
 */
function createStatusText() {
  if (statusText !== undefined) deleteWidget(statusText)
  lastStatusKind = undefined
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
    diag(`tap while ${pull}`)
    if (pull === "failed") guarded("pull", pullTokens)
  })
}

/** Colors the widgets that take a color after creation. */
function applyColorScheme() {
  const colors = scheme()
  background?.setProperty(prop.MORE, {
    color: toZeppColor(colors.backgroundColor)
  })
  clockSyncText?.setProperty(prop.MORE, {
    color: toZeppColor(colors.secondaryColor)
  })
}

/** One tick: patch the rows whose Code or arc moved on. */
function tick() {
  const startedAt = Date.now()
  if (list !== undefined) {
    const next = currentRows()
    const updatesStartedAt = Date.now()
    patchRows(list, rows, next)
    rows = next
    maxUpdateMs = Math.max(maxUpdateMs, Date.now() - updatesStartedAt)
  }
  untyped(clockSyncText as Widget).setProperty(
    prop.TEXT,
    startedAt < clockSyncMessageUntilMs ? getText("Synchronizing clock...") : ""
  )
  maxTickMs = Math.max(maxTickMs, Date.now() - startedAt)
}

/** The launch pull, also used to retry; records the outcome in Sync Stats. */
function pullTokens() {
  if (request === undefined) return
  pull = "pending"
  render()
  const startedAt = Date.now()
  diag("pull")
  const stats = parseStats(readStorage(SYNC_STATS_STORAGE_KEY))
  const record = (outcome: "synced" | "failed", ms: number) =>
    localStorage.setItem(
      SYNC_STATS_STORAGE_KEY,
      JSON.stringify(recordPull(stats, outcome, ms))
    )
  request(
    {
      method: GET_TOKENS_METHOD,
      params: {
        syncStats: stats,
        diag: parseDiag(readStorage(DIAG_STORAGE_KEY))
      }
    },
    { timeout: SYNC_TIMEOUT_MS }
  )
    .then(result => {
      const elapsed = Date.now() - startedAt
      record("synced", elapsed)
      /* The trail went out with this pull; start the next one afresh. */
      localStorage.setItem(DIAG_STORAGE_KEY, "[]")
      diag(`synced in ${elapsed} ms`)
      pull = "synced"
      guarded("receive", () => receive(result as PeerMessage))
    })
    .catch((error: unknown) => {
      const elapsed = Date.now() - startedAt
      record("failed", elapsed)
      diag(
        `failed after ${elapsed} ms: ${JSON.stringify(error)} ${String(error)}`
      )
      pull = "failed"
      guarded("render", render)
    })
}

function receive(message: PeerMessage) {
  const now = Date.now()
  const previousScheme = state.settings.colorScheme
  state = applySync(state, message, now)
  diag(`drift ${state.driftSeconds} s`)
  if (state.showClockSync) clockSyncMessageUntilMs = now + CLOCK_SYNC_MESSAGE_MS
  /* Before `build` there are no widgets yet; `build` creates them colored. */
  if (statusText === undefined) return
  if (state.settings.colorScheme !== previousScheme) {
    applyColorScheme()
    createStatusText()
  }
  render()
}

function startTicking() {
  stopTicking()
  const arm = () => {
    timer = setTimeout(
      () => {
        guarded("tick", tick)
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
  if (maxTickMs > 0) {
    diag(`slowest tick ${maxTickMs} ms, slowest updates ${maxUpdateMs} ms`)
  }
  maxTickMs = 0
  maxUpdateMs = 0
}

Page(
  BasePage({
    onInit() {
      /* zml.d.ts declares `request(data)` alone, but the runtime takes
       * `(data, options)` and forwards `timeout` (dist/zml-page.js). */
      const pageRequest = this.request as NonNullable<typeof request>
      request = (data, options) => pageRequest.call(this, data, options)
      diag("init")
      guarded("pull", pullTokens)
    },

    onCall(data: { method: string; params: unknown }) {
      if (data.method === PEER_MESSAGE_METHOD) {
        diag("push")
        guarded("receive", () => receive(data.params as PeerMessage))
      }
    },

    build() {
      diag("build")
      guarded("build", () => {
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

        clockSyncText = createWidget(widget.TEXT, {
          ...Styles.CLOCK_SYNC_TEXT,
          align_h: align.CENTER_H,
          align_v: align.CENTER_V,
          text_style: text_style.NONE,
          text: ""
        })

        applyColorScheme()
        createStatusText()
        render()
        startTicking()
      })
    },

    onResume() {
      diag("resume")
      guarded("resume", startTicking)
    },

    onPause() {
      diag("pause")
      stopTicking()
    },

    onDestroy() {
      diag("destroy")
      stopTicking()
    }
  })
)
