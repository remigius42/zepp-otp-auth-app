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
import { appendDiag, parseDiag } from "../shared/diagTrail"
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
 * receives pushes while the page is open. A failed pull is retried only by
 * tapping the status — not on `onResume`, which looped (ADR-0003 amendment). What to show lives in
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

/** `localStorage` key of the diagnostic trail (`shared/diagTrail`). */
const DIAG_STORAGE_KEY = "diag"

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
let lastStatusKind: string | undefined

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

function refresh() {
  const status = pageStatus({ pull, tokens: state.tokens })
  if (status.kind !== lastStatusKind) {
    lastStatusKind = status.kind
    diag(`status ${status.kind}`)
  }
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
      guarded("refresh", refresh)
    })
}

function receive(message: PeerMessage) {
  const now = Date.now()
  state = applySync(state, message, now)
  diag(`drift ${state.driftSeconds} s`)
  if (state.showClockSync) clockSyncMessageUntilMs = now + CLOCK_SYNC_MESSAGE_MS
  applyColorScheme()
  refresh()
}

function startTicking() {
  stopTicking()
  timer = setInterval(() => guarded("tick", refresh), 1000)
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
          diag(`tap while ${pull}`)
          if (pull === "failed") guarded("pull", pullTokens)
        })

        applyColorScheme()
        refresh()
        startTicking()
      })
    },

    onResume() {
      diag("resume")
      guarded("resume", () => {
        refresh()
        startTicking()
      })
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
