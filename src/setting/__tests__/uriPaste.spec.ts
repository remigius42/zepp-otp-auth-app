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

    handleUriPaste(storage, URI, clear => clear())

    expect(JSON.parse(storage.items.get(TOKENS_SETTINGS_KEY) ?? "")).toEqual([
      expect.objectContaining({ label: "john", issuer: "GitHub" })
    ])
    expect(storage.items.has(URI_PASTE_INPUT_SETTINGS_KEY)).toBe(false)
    expect(storage.items.has(URI_PASTE_ERROR_SETTINGS_KEY)).toBe(false)
  })

  /* On hardware the field kept the pasted URI: its value went from "" to ""
   * and the Settings App only resets a field whose value changes. Changing it
   * to the URI and back in one handler did not help either — only the final
   * "" rendered — so it clears after the URI has rendered. */
  it("shows the URI, then clears it once that has rendered", () => {
    const storage = fakeStorage()
    const later: (() => void)[] = []

    handleUriPaste(storage, URI, clear => later.push(clear))

    expect(storage.items.get(URI_PASTE_INPUT_SETTINGS_KEY)).toBe(URI)
    later.forEach(clear => clear())
    expect(storage.items.has(URI_PASTE_INPUT_SETTINGS_KEY)).toBe(false)
  })

  it("clears the field 300 ms after the add by default", () => {
    vi.useFakeTimers()
    try {
      const storage = fakeStorage()

      handleUriPaste(storage, URI)

      vi.advanceTimersByTime(299)
      expect(storage.items.get(URI_PASTE_INPUT_SETTINGS_KEY)).toBe(URI)
      vi.advanceTimersByTime(1)
      expect(storage.items.has(URI_PASTE_INPUT_SETTINGS_KEY)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  /* The rejected text may hold a Secret all the same, e.g. a URI with a
   * typo, so it leaves settings storage like an accepted one. */
  it("shows the error, clears the text once rendered and leaves the Tokens alone", () => {
    const storage = fakeStorage({ [TOKENS_SETTINGS_KEY]: "[]" })
    const later: (() => void)[] = []

    handleUriPaste(storage, "not a URI", clear => later.push(clear))

    expect(storage.items.get(URI_PASTE_INPUT_SETTINGS_KEY)).toBe("not a URI")
    expect(storage.items.get(URI_PASTE_ERROR_SETTINGS_KEY)).toContain(
      "Error: Not an otpauth:// URI"
    )
    later.forEach(clear => clear())
    expect(storage.items.has(URI_PASTE_INPUT_SETTINGS_KEY)).toBe(false)
    expect(storage.items.get(TOKENS_SETTINGS_KEY)).toBe("[]")
  })

  it("never quotes the rejected text in the error", () => {
    const storage = fakeStorage()

    handleUriPaste(
      storage,
      "otpauth//totp/x?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ"
    )

    expect(storage.items.get(URI_PASTE_ERROR_SETTINGS_KEY)).not.toContain(
      "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ"
    )
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
    expect(storage.items.has(URI_PASTE_INPUT_SETTINGS_KEY)).toBe(false)
  })
})
