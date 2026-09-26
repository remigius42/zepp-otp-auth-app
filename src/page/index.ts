/* spell-checker:ignore HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ */

import { align, createWidget, prop, text_style, widget } from "@zos/ui"
import {
  ColorSchemeName,
  ColorSchemes,
  toZeppColor
} from "../shared/ColorSchemes"
import { formatTotp, getDisplayName } from "../shared/formatTokens"
import type { TotpConfig } from "../shared/TotpConfig"
import { totp } from "../shared/totp"
import * as Styles from "zosLoader:./index.[pf].layout.js"

/**
 * Spike scaffolding: one hard-coded Token, rendered and ticking.
 *
 * This exists to prove the toolchain end to end — TypeScript compiling to a
 * Zeus-buildable bundle, `crypto-js` surviving the bundler, and the device
 * runtime providing what `totp()` needs. It is replaced wholesale by the real
 * Token list; see docs/ZEPP_OS_PORTING_ANALYSIS.md §10.
 */
const SPIKE_TOKEN: TotpConfig = {
  label: "john.doe@email.com",
  issuer: "binary poetry",
  secret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ",
  algorithm: "SHA1",
  digits: "6",
  period: "30"
}

const scheme = ColorSchemes[ColorSchemeName.default]

let codeText: ReturnType<typeof createWidget> | undefined
let countdownText: ReturnType<typeof createWidget> | undefined
let timer: ReturnType<typeof setInterval> | undefined

function refresh() {
  const period = parseInt(SPIKE_TOKEN.period, 10)
  const secondsRemaining = period - (Math.floor(Date.now() / 1000) % period)

  codeText?.setProperty(prop.MORE, {
    text: formatTotp(totp(SPIKE_TOKEN))
  })
  countdownText?.setProperty(prop.MORE, { text: `${secondsRemaining}s` })
}

Page({
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

    createWidget(widget.TEXT, {
      ...Styles.DISPLAY_NAME_TEXT,
      color: toZeppColor(scheme.secondaryColor),
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: getDisplayName(SPIKE_TOKEN)
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
      text: ""
    })

    refresh()
    /* The tick starts here rather than in an onResume hook: `Page.Option` in
     * @zeppos/device-types 4.0 declares only state/onInit/build/onDestroy,
     * while onResume and onPause appear on SecondaryWidget. Whether pages get
     * them is a spike question; until it is answered, running the timer for the
     * page's whole lifetime is correct if wasteful, whereas relying on a hook
     * that never fires would silently freeze the display. */
    timer = setInterval(refresh, 1000)
  },

  onDestroy() {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }
})
