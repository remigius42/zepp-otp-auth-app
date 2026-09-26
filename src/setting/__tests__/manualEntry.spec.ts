/* spell-checker:ignore JBSWY3DPEHPK3PXP */

import { TOKENS_SETTINGS_KEY } from "../../shared/settingsKeys"
import {
  addManualToken,
  changeManualField,
  manualEntryFields,
  resetManualEntry
} from "../manualEntry"

/** Settings storage that counts the writes to each key. */
function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  const writes = new Map<string, number>()
  return {
    items,
    writes,
    getItem: (key: string) => items.get(key),
    setItem: (key: string, value: string) => {
      writes.set(key, (writes.get(key) ?? 0) + 1)
      items.set(key, value)
    },
    removeItem: (key: string) => void items.delete(key)
  }
}

/** Every key the Manual Entry section owns. */
const manualKeys = (storage: ReturnType<typeof fakeStorage>) =>
  [...storage.items.keys()].filter(key => key.startsWith("manual"))

function filledIn() {
  const storage = fakeStorage()
  changeManualField(storage, "label", "alice")
  changeManualField(storage, "issuer", "ACME")
  changeManualField(storage, "secret", "JBSWY3DPEHPK3PXP")
  changeManualField(storage, "algorithm", "SHA256")
  changeManualField(storage, "digits", "8")
  changeManualField(storage, "period", "60")
  return storage
}

describe("Manual Entry handlers", () => {
  it("keeps each field as it is typed", () => {
    const storage = filledIn()

    expect(storage.items.get("manualLabel")).toBe("alice")
    expect(storage.items.get("manualPeriod")).toBe("60")
    expect(storage.writes.has(TOKENS_SETTINGS_KEY)).toBe(false)
  })

  it("defaults to SHA-1, 6 digits and 30 s", () => {
    expect(manualEntryFields(fakeStorage())).toEqual({
      label: "",
      issuer: "",
      secret: "",
      algorithm: "SHA1",
      digits: "6",
      period: "30"
    })
  })

  it("adds the Token with one write and clears every field", () => {
    const storage = filledIn()
    storage.items.set("manualSecretError", "earlier error")

    addManualToken(storage)

    expect(JSON.parse(storage.items.get(TOKENS_SETTINGS_KEY) ?? "")).toEqual([
      {
        label: "alice",
        issuer: "ACME",
        secret: "JBSWY3DPEHPK3PXP",
        algorithm: "SHA256",
        digits: "8",
        period: "60"
      }
    ])
    expect(storage.writes.get(TOKENS_SETTINGS_KEY)).toBe(1)
    expect(manualKeys(storage)).toEqual([])
  })

  it("puts each error under its field and keeps the input", () => {
    const storage = fakeStorage()
    changeManualField(storage, "period", "0")
    storage.items.set("manualDigitsError", "earlier error")

    addManualToken(storage)

    expect(storage.items.get("manualLabelError")).toContain("Label")
    expect(storage.items.get("manualSecretError")).toContain("Secret")
    expect(storage.items.get("manualPeriodError")).toContain("Period")
    expect(storage.items.has("manualDigitsError")).toBe(false)
    expect(storage.items.get("manualPeriod")).toBe("0")
    expect(storage.writes.has(TOKENS_SETTINGS_KEY)).toBe(false)
  })

  it("resets every field and error", () => {
    const storage = filledIn()
    storage.items.set("manualLabelError", "error")

    resetManualEntry(storage)

    expect(manualKeys(storage)).toEqual([])
  })
})
