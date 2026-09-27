/* spell-checker:ignore GEZDGNBVGY3TQOJQ */

import { ColorSchemeName } from "../../shared/ColorSchemes"
import type { SyncMessage } from "../../shared/PeerMessage"
import {
  applySync,
  asSyncMessage,
  initialSyncState,
  needsRelaunch
} from "../syncState"

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

const INITIAL_SYNC_STATE = initialSyncState(undefined)

describe("initialSyncState", () => {
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

  /* "Waiting for your phone..." was amber before every first Sync, whatever
   * the scheme, and then flipped. */
  it("starts in the color scheme the watch remembers", () => {
    expect(initialSyncState(ColorSchemeName.black).settings.colorScheme).toBe(
      ColorSchemeName.black
    )
  })

  it.each([null, "", "purple"])(
    "falls back to the default scheme for %j",
    stored => {
      expect(initialSyncState(stored as string).settings.colorScheme).toBe(
        ColorSchemeName.default
      )
    }
  )
})

describe("asSyncMessage", () => {
  it("accepts a Sync as the Side Service sends it", () => {
    expect(asSyncMessage(sync(1_002.5))).toEqual(sync(1_002.5))
    expect(asSyncMessage(sync())).toEqual(sync())
  })

  it("keeps a Token's optional Issuer and Display Name", () => {
    const named = { ...TOKEN, displayName: "Work" }

    expect(asSyncMessage({ ...sync(), tokens: [named] })?.tokens).toEqual([
      named
    ])
  })

  /* The phone validates before it sends; the watch only keeps a malformed
   * message from crashing the page. */
  it.each([
    ["nothing", undefined],
    ["a string", "SYNC_MESSAGE"],
    ["another type", { ...sync(), type: "UPDATE_TOKENS" }],
    ["no Tokens", { ...sync(), tokens: undefined }],
    [
      "a Token without a Secret",
      { ...sync(), tokens: [{ ...TOKEN, secret: 1 }] }
    ],
    [
      "a Token with a non-string Issuer",
      { ...sync(), tokens: [{ ...TOKEN, issuer: 1 }] }
    ],
    ["no Settings", { ...sync(), settings: undefined }],
    [
      "an unknown color scheme",
      { ...sync(), settings: { ...SETTINGS, colorScheme: "purple" } }
    ],
    [
      "a non-boolean enlarged view",
      { ...sync(), settings: { ...SETTINGS, shouldUseLargeTokenView: "yes" } }
    ],
    ["a non-numeric phone clock", { ...sync(), phoneEpochSeconds: "now" }]
  ])("rejects %s", (_name, value) => {
    expect(asSyncMessage(value)).toBeUndefined()
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

describe("needsRelaunch", () => {
  const AMBER = {
    colorScheme: ColorSchemeName.default,
    shouldUseLargeTokenView: false
  }

  it("relaunches on a color scheme change, since the status is colored at creation", () => {
    expect(
      needsRelaunch(
        AMBER,
        { ...AMBER, colorScheme: ColorSchemeName.white },
        false
      )
    ).toBe(true)
  })

  it("relaunches on a row-size change once the list exists", () => {
    expect(
      needsRelaunch(AMBER, { ...AMBER, shouldUseLargeTokenView: true }, true)
    ).toBe(true)
  })

  /* The enlarged view is not stored, so a re-launched page starts without it
   * and saw a change again on its first Sync: "Waiting…" in a loop. */
  it("creates the list in the new size instead when there is none yet", () => {
    expect(
      needsRelaunch(AMBER, { ...AMBER, shouldUseLargeTokenView: true }, false)
    ).toBe(false)
  })

  it("stays when nothing that fixes the layout changed", () => {
    expect(needsRelaunch(AMBER, { ...AMBER }, true)).toBe(false)
  })
})
