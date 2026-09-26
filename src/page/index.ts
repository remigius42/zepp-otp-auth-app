import { BasePage } from "@zeppos/zml/base-page"
import { setPageBrightTime } from "@zos/display"
import { getText } from "@zos/i18n"
import { localStorage } from "@zos/storage"
import { align, createWidget, event, prop, text_style, widget } from "@zos/ui"
import { ColorSchemes, toZeppColor } from "../shared/ColorSchemes"
import {
  GET_TOKENS_METHOD,
  PEER_MESSAGE_METHOD,
  type PeerMessage
} from "../shared/PeerMessage"
import { parseStats, recordPull } from "../shared/syncStats"
import { pageStatus, type PullState } from "./pageStatus"
import { applySync, INITIAL_SYNC_STATE } from "./syncState"
import { tokenView } from "./tokenView"
import * as Styles from "zosLoader:./index.[pf].layout.js"

/**
 * Phase 2 vertical slice: the first synced Token, rendered ticking. The
 * `SCROLL_LIST` of all Tokens is Phase 3.
 *
 * Sync per the ADR-0002 amendment: `onInit` pulls the Token set, `onCall`
 * receives pushes while the page is open. A failed pull is retried by tapping
 * the status or on `onResume` (ADR-0003 amendment). What to show lives in
 * `./tokenView` and `./pageStatus`; this file is widget and ZML wiring only.
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
let background: ReturnType<typeof createWidget> | undefined
let statusText: ReturnType<typeof createWidget> | undefined
let displayNameText: ReturnType<typeof createWidget> | undefined
let codeText: ReturnType<typeof createWidget> | undefined
let countdownText: ReturnType<typeof createWidget> | undefined
let timer: ReturnType<typeof setInterval> | undefined

function refresh() {
  const status = pageStatus({ pull, tokens: state.tokens })
  const token = state.tokens?.[0]
  if (status.kind !== "tokens" || token === undefined) {
    setText(displayNameText, "")
    setText(codeText, "")
    setText(countdownText, "")
    setText(statusText, "msgid" in status ? getText(status.msgid) : "")
    return
  }

  const now = Date.now()
  const view = tokenView(token, now, state.driftSeconds)
  setText(statusText, "")
  setText(displayNameText, view.name)
  setText(codeText, view.code)
  setText(
    countdownText,
    now < clockSyncMessageUntilMs
      ? getText("Synchronizing clock...")
      : `${view.secondsRemaining}s`
  )
}

/** Colors every widget from the synced color scheme. */
function applyColorScheme() {
  const scheme = ColorSchemes[state.settings.colorScheme]
  const primary = toZeppColor(scheme.primaryColor)
  const secondary = toZeppColor(scheme.secondaryColor)
  background?.setProperty(prop.MORE, {
    color: toZeppColor(scheme.backgroundColor)
  })
  codeText?.setProperty(prop.MORE, { color: primary })
  for (const textWidget of [displayNameText, countdownText, statusText]) {
    textWidget?.setProperty(prop.MORE, { color: secondary })
  }
}

function setText(
  textWidget: ReturnType<typeof createWidget> | undefined,
  text: string
) {
  textWidget?.setProperty(prop.MORE, { text })
}

/** The launch pull, also used to retry; records the outcome in Sync Stats. */
function pullTokens() {
  if (request === undefined) return
  pull = "pending"
  refresh()
  const startedAt = Date.now()
  /* The typings claim `getItem` returns `void` (§3.8). */
  const stats = parseStats(
    localStorage.getItem(SYNC_STATS_STORAGE_KEY) as unknown as
      | string
      | undefined
  )
  const record = (outcome: "synced" | "failed", ms: number) =>
    localStorage.setItem(
      SYNC_STATS_STORAGE_KEY,
      JSON.stringify(recordPull(stats, outcome, ms))
    )
  request(
    { method: GET_TOKENS_METHOD, params: { syncStats: stats } },
    { timeout: SYNC_TIMEOUT_MS }
  )
    .then(result => {
      const elapsed = Date.now() - startedAt
      console.log(`page synced in ${elapsed} ms`)
      record("synced", elapsed)
      pull = "synced"
      receive(result as PeerMessage)
    })
    .catch((error: unknown) => {
      const elapsed = Date.now() - startedAt
      console.log(`page request failed after ${elapsed} ms: ${String(error)}`)
      record("failed", elapsed)
      pull = "failed"
      refresh()
    })
}

function receive(message: PeerMessage) {
  const now = Date.now()
  state = applySync(state, message, now)
  console.log(`sync drift ${state.driftSeconds} s`)
  if (state.showClockSync) clockSyncMessageUntilMs = now + CLOCK_SYNC_MESSAGE_MS
  applyColorScheme()
  refresh()
}

function startTicking() {
  stopTicking()
  timer = setInterval(refresh, 1000)
}

function stopTicking() {
  if (timer !== undefined) {
    clearInterval(timer)
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
        console.log("page received push")
        receive(data.params as PeerMessage)
      }
    },

    build() {
      setPageBrightTime({ brightTime: SCREEN_ON_MS })

      /* Final colors are set by `applyColorScheme` once all widgets exist. */
      background = createWidget(widget.FILL_RECT, {
        x: 0,
        y: 0,
        w: Styles.SCREEN.width,
        h: Styles.SCREEN.height,
        angle: 0,
        radius: 0,
        color: 0
      })

      displayNameText = createWidget(widget.TEXT, {
        ...Styles.DISPLAY_NAME_TEXT,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: ""
      })

      codeText = createWidget(widget.TEXT, {
        ...Styles.CODE_TEXT,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: ""
      })

      countdownText = createWidget(widget.TEXT, {
        ...Styles.COUNTDOWN_TEXT,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: ""
      })

      statusText = createWidget(widget.TEXT, {
        ...Styles.STATUS_TEXT,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP,
        text: ""
      })
      statusText.addEventListener(event.CLICK_UP, () => {
        if (pull === "failed") pullTokens()
      })

      applyColorScheme()
      refresh()
      startTicking()
    },

    onResume() {
      if (pull === "failed" && state.tokens === undefined) pullTokens()
      refresh()
      startTicking()
    },

    onPause() {
      stopTicking()
    },

    onDestroy() {
      stopTicking()
    }
  })
)
