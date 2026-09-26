/* spell-checker:ignore GEZDGNBVGY TQOJQGEZDGNBVGY TQOJQ */

import { push } from "@zos/router"
import { localStorage } from "@zos/storage"
import * as zosTimer from "@zos/timer"
import { prop } from "@zos/ui"
import type { TotpConfig } from "../../shared/TotpConfig"
import { totp } from "../../shared/totp"
import {
  createProbeScreen,
  FAIL,
  OK,
  PENDING,
  reportCheck
} from "./probeScreen"

/**
 * Phase 1 runtime probe — everything in TODO.md's spike list that can be
 * answered by code rather than by looking at pixels.
 *
 * Each check is written so its answer is unambiguous from the transcript alone:
 * no "looks right", only a value that is either the expected one or not. The
 * screen is a convenience; `console.log` output from `npm run dev` is the
 * record. See docs/spike-probes.md for what to do with the answers.
 */

const LIFECYCLE_KEY = "probe.lifecycle"

/** RFC 6238 appendix B: `12345678901234567890`, T = 59 s, SHA1, 8 digits. */
const RFC6238_TOKEN: TotpConfig = {
  label: "rfc6238",
  secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
  algorithm: "SHA1",
  digits: "8",
  period: "30"
}
const RFC6238_COUNTER = 1
const RFC6238_EXPECTED = "94287082"

type LifecycleCounts = Record<string, number>

/**
 * `@zos/storage`'s typings declare `getItem` as returning `void`; it returns the
 * stored value. Narrow it here rather than lying about the module.
 */
function readLifecycleCounts(): LifecycleCounts {
  const raw = (
    localStorage.getItem as unknown as (
      key: string,
      defaultValue: string
    ) => string
  )(LIFECYCLE_KEY, "{}")
  try {
    return JSON.parse(raw) as LifecycleCounts
  } catch {
    return {}
  }
}

function recordLifecycle(hook: string) {
  const counts = readLifecycleCounts()
  counts[hook] = (counts[hook] ?? 0) + 1
  localStorage.setItem(LIFECYCLE_KEY, JSON.stringify(counts))
  console.log(`lifecycle: ${hook} (#${String(counts[hook])})`)
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label} was ${String(actual)}, expected ${String(expected)}`
    )
  }
}

/**
 * Steer `totp()` onto a fixed counter by abusing its clock-drift parameter, so
 * a published test vector can be checked on-device without controlling the
 * clock: `floor((now / 1000 + drift) / period)` collapses to the target
 * counter plus a sub-second fraction.
 */
function totpAtCounter(config: TotpConfig, counter: number) {
  const period = Number(config.period)
  const drift = counter * period - Math.floor(Date.now() / 1000)
  return totp(config, drift)
}

const pageOptions: Page.Option & Record<string, unknown> = {
  onInit() {
    recordLifecycle("onInit")
  },

  build() {
    const previous = readLifecycleCounts()
    recordLifecycle("build")

    const screen = createProbeScreen("Runtime probe")

    /* --- Language level (analysis §3.1) ----------------------------------- */

    reportCheck(screen, "Promise exists", () => {
      assertEqual(typeof Promise, "function", "typeof Promise")
      return "function"
    })

    reportCheck(screen, "Map works", () => {
      const map = new Map<string, number>([["a", 1]])
      map.set("b", 2)
      map.delete("a")
      assertEqual(map.size, 1, "size")
      assertEqual(map.get("b"), 2, "get")
      assertEqual(Array.from(map.keys()).join(), "b", "keys()")
      return "set/get/delete/size/iteration"
    })

    reportCheck(screen, "Set works", () => {
      const set = new Set([1, 2, 2])
      assertEqual(set.size, 2, "size")
      return "size 2 from [1,2,2]"
    })

    reportCheck(screen, "globalThis", () => {
      assertEqual(typeof globalThis, "object", "typeof globalThis")
      return "object"
    })

    /* The one dynamic-code construct Zepp OS documents as permitted, and the
     * one bundled npm libraries reach for. If it is gone, crypto-js's global
     * detection is what breaks. */
    reportCheck(screen, "new Function('return this')", () => {
      const globalObject = new Function("return this")() as unknown
      assertEqual(globalObject === globalThis, true, "identity with globalThis")
      return "returns globalThis"
    })

    /* --- Crypto (analysis §3.1, the whole reason the port is viable) ------- */

    reportCheck(screen, "crypto-js HMAC-SHA1", () => {
      const actual = totpAtCounter(RFC6238_TOKEN, RFC6238_COUNTER)
      assertEqual(actual, RFC6238_EXPECTED, "RFC 6238 vector")
      return `${RFC6238_EXPECTED} ✓`
    })

    /* --- Timers (analysis §3.1) ------------------------------------------- */

    const timerExports = Object.keys(zosTimer as unknown as object).join(", ")
    screen.addLine(`@zos/timer exports: ${timerExports}`)

    const globalTimeoutLine = screen.addLine(
      "… global setTimeout: waiting 500 ms",
      PENDING
    )
    const globalTimeoutStart = Date.now()
    setTimeout(() => {
      globalTimeoutLine.set(
        `✓ global setTimeout: fired after ${String(Date.now() - globalTimeoutStart)} ms`,
        OK
      )
    }, 500)

    const zosTimeout = (zosTimer as unknown as Record<string, unknown>)
      .setTimeout
    if (typeof zosTimeout === "function") {
      const zosTimeoutLine = screen.addLine(
        "… @zos/timer setTimeout: waiting 500 ms",
        PENDING
      )
      const zosTimeoutStart = Date.now()
      ;(zosTimeout as (cb: () => void, ms: number) => unknown)(() => {
        zosTimeoutLine.set(
          `✓ @zos/timer setTimeout: fired after ${String(Date.now() - zosTimeoutStart)} ms`,
          OK
        )
      }, 500)
    } else {
      screen.addLine("✗ @zos/timer setTimeout: not exported", FAIL)
    }

    const promiseLine = screen.addLine("… Promise resolves", PENDING)
    Promise.resolve("resolved").then(
      value => {
        promiseLine.set(`✓ Promise resolves: ${value}`, OK)
      },
      () => {
        promiseLine.set("✗ Promise resolves: rejected", FAIL)
      }
    )

    /* --- Persistence (analysis §3.4) -------------------------------------- */

    reportCheck(screen, "localStorage round-trip", () => {
      localStorage.setItem("probe.roundTrip", "value")
      const readBack = (
        localStorage.getItem as unknown as (key: string) => unknown
      )("probe.roundTrip")
      assertEqual(readBack, "value", "read back")
      localStorage.removeItem("probe.roundTrip")
      return "set/get/remove"
    })

    /* --- SCROLL_LIST update mechanism (analysis §3.5) --------------------- */

    /* The pivotal spike question, and answerable without rendering anything:
     * `prop` is an enum the runtime hands over, so if UPDATE_ITEM is absent
     * from it, per-row patching does not exist on this device. */
    const propKeys = Object.keys(prop)
    const hasUpdateItem = propKeys.includes("UPDATE_ITEM")
    const hasUpdateData = propKeys.includes("UPDATE_DATA")
    screen.addLine(
      `${hasUpdateItem ? "✓" : "✗"} prop.UPDATE_ITEM`,
      hasUpdateItem ? OK : FAIL
    )
    screen.addLine(
      `${hasUpdateData ? "✓" : "✗"} prop.UPDATE_DATA`,
      hasUpdateData ? OK : FAIL
    )
    console.log(`prop keys: ${propKeys.join(", ")}`)

    /* --- Page lifecycle (TODO.md: does Page get onResume/onPause?) -------- */

    screen.addLine("Lifecycle counts, previous run:")
    for (const hook of [
      "onInit",
      "build",
      "onResume",
      "onPause",
      "onDestroy"
    ]) {
      const count = previous[hook] ?? 0
      screen.addLine(`  ${hook}: ${String(count)}`, count > 0 ? OK : PENDING)
    }
    screen.addLine("Leave and return, then reopen this page.")

    screen.addButton("SCROLL_LIST probe →", () => {
      push({ url: "page/probe/scrollList" })
    })

    screen.addButton("Reset lifecycle counts", () => {
      localStorage.removeItem(LIFECYCLE_KEY)
      console.log("lifecycle counts reset")
    })
  },

  /* Declared even though `Page.Option` in @zeppos/device-types 4.0 does not
   * list them — whether they fire at runtime is exactly the open question. */
  onResume() {
    recordLifecycle("onResume")
  },

  onPause() {
    recordLifecycle("onPause")
  },

  onDestroy() {
    recordLifecycle("onDestroy")
  }
}

Page(pageOptions)
