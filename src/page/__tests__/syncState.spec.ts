/* spell-checker:ignore GEZDGNBVGY3TQOJQ */

import { ColorSchemeName } from "../../shared/ColorSchemes"
import type { SyncMessage } from "../../shared/PeerMessage"
import { applySync, INITIAL_SYNC_STATE } from "../syncState"

const TOKEN = {
  label: "john",
  issuer: "GitHub",
  secret: "GEZDGNBVGY3TQOJQ",
  algorithm: "SHA1",
  digits: "6",
  period: "30"
}

const SETTINGS = {
  colorScheme: ColorSchemeName.white,
  shouldUseLargeTokenView: true
}

const NOW_MS = 1_000_000

function sync(phoneEpochSeconds?: number): SyncMessage {
  return {
    type: "SYNC_MESSAGE",
    tokens: [TOKEN],
    settings: SETTINGS,
    ...(phoneEpochSeconds === undefined ? {} : { phoneEpochSeconds })
  }
}

describe("INITIAL_SYNC_STATE", () => {
  it("has no Tokens yet, the default Settings and no drift", () => {
    expect(INITIAL_SYNC_STATE).toEqual({
      tokens: undefined,
      settings: {
        colorScheme: ColorSchemeName.default,
        shouldUseLargeTokenView: false
      },
      driftSeconds: 0,
      showClockSync: false
    })
  })
})

describe("applySync", () => {
  it("takes the Tokens and Settings, and measures drift against the phone", () => {
    expect(applySync(INITIAL_SYNC_STATE, sync(1_002.5), NOW_MS)).toEqual({
      tokens: [TOKEN],
      settings: SETTINGS,
      driftSeconds: 2.5,
      showClockSync: true
    })
  })

  it("assumes no drift when the phone sent no clock", () => {
    const drifted = applySync(INITIAL_SYNC_STATE, sync(1_002.5), NOW_MS)

    expect(applySync(drifted, sync(), NOW_MS)).toMatchObject({
      driftSeconds: 0,
      showClockSync: false
    })
  })

  it("shows the clock-sync message only when drift moved by 0.75 s or more", () => {
    const drifted = applySync(INITIAL_SYNC_STATE, sync(1_002.5), NOW_MS)

    expect(applySync(drifted, sync(1_003.2), NOW_MS).showClockSync).toBe(false)
    expect(applySync(drifted, sync(1_003.25), NOW_MS).showClockSync).toBe(true)
    expect(applySync(drifted, sync(1_001.75), NOW_MS).showClockSync).toBe(true)
  })
})
