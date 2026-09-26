/* spell-checker:ignore HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ */

import {
  TOKENS_SETTINGS_KEY,
  URI_PASTE_ERROR_SETTINGS_KEY,
  URI_PASTE_INPUT_SETTINGS_KEY
} from "../../shared/settingsKeys"
import { messageForSettingsChange } from "../sync"

const TOKEN = {
  label: "john",
  issuer: "GitHub",
  secret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ",
  algorithm: "SHA1",
  digits: "6",
  period: "30"
}

function storageWith(tokens: unknown) {
  const stored = JSON.stringify(tokens)
  return {
    getItem: (key: string) => (key === TOKENS_SETTINGS_KEY ? stored : undefined)
  }
}

describe("messageForSettingsChange", () => {
  it("pushes the valid Tokens when the Token set changed", () => {
    const storage = storageWith([TOKEN, { ...TOKEN, algorithm: "SHA512" }])

    expect(messageForSettingsChange(TOKENS_SETTINGS_KEY, storage)).toEqual({
      type: "UPDATE_TOKENS_MESSAGE",
      tokens: [TOKEN]
    })
  })

  it.each([URI_PASTE_INPUT_SETTINGS_KEY, URI_PASTE_ERROR_SETTINGS_KEY])(
    "does not push when %s changed",
    key => {
      expect(
        messageForSettingsChange(key, storageWith([TOKEN]))
      ).toBeUndefined()
    }
  )
})
