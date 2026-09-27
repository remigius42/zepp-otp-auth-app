import { BasePage } from "@zeppos/zml/base-page"
import { setPageBrightTime } from "@zos/display"
import { getText } from "@zos/i18n"
import { showToast } from "@zos/interaction"
import { back, replace } from "@zos/router"
import { localStorage } from "@zos/storage"
import { align, createWidget, prop, text_style, widget } from "@zos/ui"
import { ColorSchemes, toZeppColor } from "../shared/ColorSchemes"
import { PEER_MESSAGE_METHOD, type PeerMessage } from "../shared/PeerMessage"
import type { TotpConfig } from "../shared/TotpConfig"
import { rowView, type RowView } from "./rowView"
import { session } from "./session"
import {
  applySync,
  asSyncMessage,
  COLOR_SCHEME_STORAGE_KEY,
  type SyncState
} from "./syncState"
import { msUntilNextTick } from "./tick"
import { afterSync, rowFromParams } from "./tokenPage"
import * as Styles from "zosLoader:./token.[pf].layout.js"

/**
 * One Token full-screen: its arc, Display Name and a large Code, ticking like
 * the list. Opened by tapping its row; the system back gesture returns.
 *
 * The router carries only the row index; the Token comes from the session
 * (`./session`), in memory only (ADR-0004). While open, this page takes the
 * pushes — see `onCall` in `./index` — and writes each Sync to the session,
 * so the list shows it on return. What to do after a Sync is `./tokenPage`'s.
 *
 * The ticker starts and stops as in `./index`.
 */

/**
 * Longer than the list's 60 s: a Token opened alone is one being typed, and
 * 60 s felt short on hardware. Three 30 s Periods; the system resets it when
 * the page is destroyed.
 */
const SCREEN_ON_MS = 90_000

type Widget = ReturnType<typeof createWidget>
type UntypedWidget = { setProperty(property: number, value: unknown): boolean }
const untyped = (target: Widget) => target as unknown as UntypedWidget

let state: SyncState | undefined
let row = 0
let token: TotpConfig | undefined
let arc: Widget | undefined
let name: Widget | undefined
let code: Widget | undefined
let shown: RowView | undefined
let timer: ReturnType<typeof setTimeout> | undefined

function currentView(synced: SyncState, shownToken: TotpConfig) {
  return rowView(
    shownToken,
    Date.now(),
    synced.driftSeconds,
    synced.settings.colorScheme
  )
}

function createWidgets(synced: SyncState, view: RowView) {
  const colors = ColorSchemes[synced.settings.colorScheme]
  const primary = toZeppColor(colors.primaryColor)
  createWidget(widget.FILL_RECT, {
    x: 0,
    y: 0,
    w: Styles.SCREEN.width,
    h: Styles.SCREEN.height,
    angle: 0,
    radius: 0,
    color: toZeppColor(colors.backgroundColor)
  })
  const text = (box: typeof Styles.NAME, value: string, color: number) =>
    createWidget(widget.TEXT, {
      ...box,
      color,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: value
    })
  arc =
    "arc" in view
      ? createWidget(widget.IMG, { ...Styles.ARC, src: view.arc })
      : text(
          { ...Styles.ARC, text_size: Styles.COUNTDOWN_TEXT_SIZE },
          view.countdown,
          toZeppColor(colors.secondaryColor)
        )
  /* Primary, not secondary, as on the list: the darkened colors were too dim. */
  name = text(Styles.NAME, view.name, primary)
  code = text(Styles.CODE, view.code, primary)
  shown = view
}

/** Sets what changed since the last tick or Sync. */
function render() {
  if (state === undefined || token === undefined || shown === undefined) return
  const view = currentView(state, token)
  const set = (target: Widget | undefined, property: number, value: string) => {
    if (target !== undefined) untyped(target).setProperty(property, value)
  }
  if (view.name !== shown.name) set(name, prop.TEXT, view.name)
  if (view.code !== shown.code) set(code, prop.TEXT, view.code)
  if ("arc" in view) {
    if (!("arc" in shown) || view.arc !== shown.arc) {
      set(arc, prop.SRC, view.arc)
    }
  } else if (!("countdown" in shown) || view.countdown !== shown.countdown) {
    set(arc, prop.TEXT, view.countdown)
  }
  shown = view
}

function receive(message: PeerMessage) {
  if (state === undefined || token === undefined) return
  const previous = state
  state = applySync(previous, message, Date.now())
  session().sync = state
  if (state.showClockSync) {
    showToast({ content: getText("Synchronizing clock...") })
  }
  if (state.settings.colorScheme !== previous.settings.colorScheme) {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, state.settings.colorScheme)
  }
  const next = afterSync(
    token,
    state.tokens ?? [],
    previous.settings,
    state.settings
  )
  if (next.kind === "back") {
    back()
    return
  }
  row = next.row
  token = state.tokens?.[row]
  if (next.kind === "relaunch") {
    replace({ url: "page/token", params: String(row) })
    return
  }
  render()
}

function startTicking() {
  stopTicking()
  const arm = () => {
    timer = setTimeout(
      () => {
        render()
        arm()
      },
      msUntilNextTick(Date.now(), state?.driftSeconds ?? 0)
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
    onInit(params?: string) {
      session().tokenOpen = true
      state = session().sync
      const opened = rowFromParams(params)
      row = opened ?? 0
      token = opened === undefined ? undefined : state?.tokens?.[opened]
    },

    onCall(data: { method: string; params: unknown }) {
      if (data.method !== PEER_MESSAGE_METHOD) return
      /* A malformed push is dropped; the state before it stays. */
      const message = asSyncMessage(data.params)
      if (message !== undefined) receive(message)
    },

    build() {
      /* Gone between the tap and here, e.g. deleted by a push. */
      if (state === undefined || token === undefined) {
        back()
        return
      }
      setPageBrightTime({ brightTime: SCREEN_ON_MS })
      createWidgets(state, currentView(state, token))
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
      session().tokenOpen = false
      /* The page may be re-launched in this same module (`receive`). */
      arc = undefined
      name = undefined
      code = undefined
      shown = undefined
    }
  })
)
