import { BasePage } from "@zeppos/zml/base-page"
import { align, createWidget, prop, text_style, widget } from "@zos/ui"
import {
  ColorSchemeName,
  ColorSchemes,
  toZeppColor
} from "../shared/ColorSchemes"
import {
  GET_TOKENS_METHOD,
  PEER_MESSAGE_METHOD,
  type PeerMessage
} from "../shared/PeerMessage"
import type { TotpConfig } from "../shared/TotpConfig"
import { tokensFromMessage, tokenView } from "./tokenView"
import * as Styles from "zosLoader:./index.[pf].layout.js"

/**
 * Phase 2 vertical slice: the first synced Token, rendered ticking. The
 * `SCROLL_LIST` of all Tokens is Phase 3.
 *
 * Sync per the ADR-0002 amendment: `onInit` pulls the Token set, `onCall`
 * receives pushes while the page is open. What to show lives in
 * `./tokenView`; this file is widget and ZML wiring only.
 *
 * The ticker starts in `build` and `onResume` and stops in `onPause` and
 * `onDestroy`. `build` as well because the spike counted fewer `onResume`
 * than `onPause` calls, so `onResume` may not fire on first show (§3.1.1).
 */

/** Shorter than ZML's 60 s default, so a Side Service that never answers shows. */
const SYNC_TIMEOUT_MS = 10_000

const scheme = ColorSchemes[ColorSchemeName.default]

let tokens: TotpConfig[] | undefined
let displayNameText: ReturnType<typeof createWidget> | undefined
let codeText: ReturnType<typeof createWidget> | undefined
let countdownText: ReturnType<typeof createWidget> | undefined
let timer: ReturnType<typeof setInterval> | undefined

function refresh() {
  const token = tokens?.[0]
  if (token === undefined) {
    displayNameText?.setProperty(prop.MORE, { text: "" })
    codeText?.setProperty(prop.MORE, { text: "" })
    if (tokens !== undefined) showStatus("no tokens")
    return
  }

  const view = tokenView(token)
  displayNameText?.setProperty(prop.MORE, { text: view.name })
  codeText?.setProperty(prop.MORE, { text: view.code })
  countdownText?.setProperty(prop.MORE, { text: `${view.secondsRemaining}s` })
}

function showStatus(text: string) {
  countdownText?.setProperty(prop.MORE, { text })
}

function receive(message: PeerMessage) {
  const received = tokensFromMessage(message)
  if (received === undefined) return
  tokens = received
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
      const startedAt = Date.now()
      /* zml.d.ts declares `request(data)` alone, but the runtime takes
       * `(data, options)` and forwards `timeout` (dist/zml-page.js). */
      const request = this.request as (
        data: { method: string; params: Record<string, unknown> },
        options: { timeout: number }
      ) => Promise<unknown>
      request
        .call(
          this,
          { method: GET_TOKENS_METHOD, params: {} },
          { timeout: SYNC_TIMEOUT_MS }
        )
        .then(result => {
          console.log(`page synced in ${Date.now() - startedAt} ms`)
          receive(result as PeerMessage)
        })
        .catch((error: unknown) => {
          const elapsed = Date.now() - startedAt
          console.log(
            `page request failed after ${elapsed} ms: ${String(error)}`
          )
          showStatus(`sync failed, ${elapsed} ms`)
        })
    },

    onCall(data: { method: string; params: unknown }) {
      if (data.method === PEER_MESSAGE_METHOD) {
        console.log("page received push")
        receive(data.params as PeerMessage)
      }
    },

    build() {
      createWidget(widget.FILL_RECT, {
        x: 0,
        y: 0,
        w: Styles.SCREEN.width,
        h: Styles.SCREEN.height,
        angle: 0,
        radius: 0,
        color: toZeppColor(scheme.backgroundColor)
      })

      displayNameText = createWidget(widget.TEXT, {
        ...Styles.DISPLAY_NAME_TEXT,
        color: toZeppColor(scheme.secondaryColor),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: ""
      })

      codeText = createWidget(widget.TEXT, {
        ...Styles.CODE_TEXT,
        color: toZeppColor(scheme.primaryColor),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: ""
      })

      countdownText = createWidget(widget.TEXT, {
        ...Styles.COUNTDOWN_TEXT,
        color: toZeppColor(scheme.secondaryColor),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: "waiting for phone"
      })

      refresh()
      startTicking()
    },

    onResume() {
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
