/* spell-checker:ignore HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ */

import {
  TOKENS_SETTINGS_KEY,
  URI_PASTE_ERROR_SETTINGS_KEY,
  URI_PASTE_INPUT_SETTINGS_KEY
} from "../../shared/settingsKeys"
import { handleUriPaste } from "../uriPaste"

const URI =
  "otpauth://totp/GitHub:john?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=GitHub"

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (key: string) => items.get(key),
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key)
  }
}

describe("handleUriPaste", () => {
  it("stores the Token and clears the field and its error", () => {
    const storage = fakeStorage({
      [URI_PASTE_INPUT_SETTINGS_KEY]: "earlier attempt",
      [URI_PASTE_ERROR_SETTINGS_KEY]: "earlier error"
    })

    handleUriPaste(storage, URI)

    expect(JSON.parse(storage.items.get(TOKENS_SETTINGS_KEY) ?? "")).toEqual([
      expect.objectContaining({ label: "john", issuer: "GitHub" })
    ])
    expect(storage.items.has(URI_PASTE_INPUT_SETTINGS_KEY)).toBe(false)
    expect(storage.items.has(URI_PASTE_ERROR_SETTINGS_KEY)).toBe(false)
  })

  /* On hardware the field kept the pasted URI: its value went from "" to ""
   * and the Settings App only resets a field whose value changes. */
  it("changes the field's value before clearing it", () => {
    const storage = fakeStorage()
    const inputValues: (string | undefined)[] = []
    const recording = {
      ...storage,
      setItem: (key: string, value: string) => {
        storage.setItem(key, value)
        if (key === URI_PASTE_INPUT_SETTINGS_KEY) inputValues.push(value)
      },
      removeItem: (key: string) => {
        storage.removeItem(key)
        if (key === URI_PASTE_INPUT_SETTINGS_KEY) inputValues.push(undefined)
      }
    }

    handleUriPaste(recording, URI)

    expect(inputValues).toEqual([URI, undefined])
  })

  it("keeps the text, shows the error and leaves the Tokens alone", () => {
    const storage = fakeStorage({ [TOKENS_SETTINGS_KEY]: "[]" })

    handleUriPaste(storage, "not a URI")

    expect(storage.items.get(URI_PASTE_INPUT_SETTINGS_KEY)).toBe("not a URI")
    expect(storage.items.get(URI_PASTE_ERROR_SETTINGS_KEY)).toContain(
      "Error: Not an otpauth:// URI"
    )
    expect(storage.items.get(TOKENS_SETTINGS_KEY)).toBe("[]")
  })

  it("reports an unexpected failure in the error field", () => {
    const storage = fakeStorage()
    const failing = {
      ...storage,
      getItem: () => {
        throw new Error("storage exploded")
      }
    }

    handleUriPaste(failing, URI)

    expect(storage.items.get(URI_PASTE_ERROR_SETTINGS_KEY)).toContain(
      "storage exploded"
    )
  })
})
