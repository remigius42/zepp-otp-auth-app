/* spell-checker:ignore HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ */

import { ColorSchemeName } from "../../shared/ColorSchemes"
import {
  COLOR_SCHEME_SETTINGS_KEY,
  COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY,
  TOKENS_SETTINGS_KEY,
  URI_PASTE_ERROR_SETTINGS_KEY,
  URI_PASTE_INPUT_SETTINGS_KEY
} from "../../shared/settingsKeys"
import { messageForSettingsChange, syncMessage } from "../sync"

const TOKEN = {
  label: "john",
  issuer: "GitHub",
  secret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ",
  algorithm: "SHA1",
  digits: "6",
  period: "30"
}

const NOW_MS = 1_700_000_000_500

function storageWith(tokens: unknown, items: Record<string, string> = {}) {
  const stored: Record<string, string> = {
    ...items,
    [TOKENS_SETTINGS_KEY]: JSON.stringify(tokens)
  }
  return { getItem: (key: string) => stored[key] }
}

describe("syncMessage", () => {
  it("carries the valid Tokens, the Settings and the phone's clock", () => {
    const storage = storageWith([TOKEN, { ...TOKEN, algorithm: "SHA512" }], {
      [COLOR_SCHEME_SETTINGS_KEY]: JSON.stringify(ColorSchemeName.white)
    })

    expect(syncMessage(storage, NOW_MS)).toEqual({
      type: "SYNC_MESSAGE",
      tokens: [TOKEN],
      settings: {
        colorScheme: ColorSchemeName.white,
        shouldUseLargeTokenView: false
      },
      phoneEpochSeconds: 1_700_000_000.5
    })
  })

  it("leaves out the phone's clock when Clock Drift Compensation is off", () => {
    const storage = storageWith([TOKEN], {
      [COMPENSATE_CLOCK_DRIFT_SETTINGS_KEY]: "false"
    })

    expect(syncMessage(storage, NOW_MS)).not.toHaveProperty("phoneEpochSeconds")
  })
})

describe("messageForSettingsChange", () => {
  it("pushes a Sync when the Token set changed", () => {
    const storage = storageWith([TOKEN])

    expect(
      messageForSettingsChange(TOKENS_SETTINGS_KEY, storage, NOW_MS)
    ).toEqual(syncMessage(storage, NOW_MS))
  })

  it.each([URI_PASTE_INPUT_SETTINGS_KEY, URI_PASTE_ERROR_SETTINGS_KEY])(
    "does not push when %s changed",
    key => {
      expect(
        messageForSettingsChange(key, storageWith([TOKEN]), NOW_MS)
      ).toBeUndefined()
    }
  )
})
