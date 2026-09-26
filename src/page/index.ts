import { BasePage } from "@zeppos/zml/base-page"
import { align, createWidget, prop, text_style, widget } from "@zos/ui"
import {
  ColorSchemeName,
  ColorSchemes,
  toZeppColor
} from "../shared/ColorSchemes"
import { formatTotp, getDisplayName } from "../shared/formatTokens"
import { GET_TOKENS_METHOD } from "../shared/PeerMessage"
import type { TotpConfig } from "../shared/TotpConfig"
import { totp } from "../shared/totp"
import * as Styles from "zosLoader:./index.[pf].layout.js"

/**
 * Spike scaffolding, now fed by Sync: one Token, requested from the Side
 * Service on launch and rendered ticking.
 *
 * The pull on `onInit` is the ADR-0002 amendment's launch trigger. It is also
 * the open question it rests on — whether a device `request` wakes a Side
 * Service that is not running — so the outcome and round-trip time are shown
 * on screen rather than only logged. Replaced by the real Token list in
 * Phase 2; see docs/ZEPP_OS_PORTING_ANALYSIS.md §10.
 *
 * The timer runs for the page's whole lifetime. `onResume`/`onPause` do fire
 * (§3.1.1), so that is wasteful rather than necessary; it changes with the
 * Token list in Phase 2.
 */

/** Shorter than ZML's 60 s default, so a Side Service that never answers shows. */
const SYNC_TIMEOUT_MS = 10_000

const scheme = ColorSchemes[ColorSchemeName.default]

let token: TotpConfig | undefined
let displayNameText: ReturnType<typeof createWidget> | undefined
let codeText: ReturnType<typeof createWidget> | undefined
let countdownText: ReturnType<typeof createWidget> | undefined
let timer: ReturnType<typeof setInterval> | undefined

function refresh() {
  if (token === undefined) return
  const period = parseInt(token.period, 10)
  const secondsRemaining = period - (Math.floor(Date.now() / 1000) % period)

  codeText?.setProperty(prop.MORE, { text: formatTotp(totp(token)) })
  countdownText?.setProperty(prop.MORE, { text: `${secondsRemaining}s` })
}

function showStatus(text: string) {
  countdownText?.setProperty(prop.MORE, { text })
}

Page(
  BasePage({
    onInit() {
      const startedAt = Date.now()
      console.log("page onInit, requesting tokens")
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
          const elapsed = Date.now() - startedAt
          const tokens = result as TotpConfig[]
          console.log(`page got ${tokens.length} token(s) in ${elapsed} ms`)
          token = tokens[0]
          if (token === undefined) {
            showStatus(`no tokens, ${elapsed} ms`)
            return
          }
          displayNameText?.setProperty(prop.MORE, {
            text: getDisplayName(token)
          })
          refresh()
        })
        .catch((error: unknown) => {
          const elapsed = Date.now() - startedAt
          console.log(
            `page request failed after ${elapsed} ms: ${String(error)}`
          )
          showStatus(`sync failed, ${elapsed} ms`)
        })
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
      timer = setInterval(refresh, 1000)
    },

    onDestroy() {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    }
  })
)
