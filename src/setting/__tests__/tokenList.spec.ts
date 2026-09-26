/* spell-checker:ignore HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ */

import {
  PENDING_DELETE_INDEX_SETTINGS_KEY,
  TOKENS_SETTINGS_KEY
} from "../../shared/settingsKeys"
import {
  cancelDelete,
  confirmDelete,
  handleMove,
  handleRename,
  pendingDeleteIndex,
  requestDelete
} from "../tokenList"

const TOKEN_A = {
  label: "alice",
  issuer: "ACME",
  secret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ",
  algorithm: "SHA1",
  digits: "6",
  period: "30"
}
const TOKEN_B = { ...TOKEN_A, label: "bob" }

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

const withTokens = (extra: Record<string, string> = {}) =>
  fakeStorage({
    [TOKENS_SETTINGS_KEY]: JSON.stringify([TOKEN_A, TOKEN_B]),
    ...extra
  })

const storedTokens = (storage: ReturnType<typeof fakeStorage>) =>
  JSON.parse(storage.items.get(TOKENS_SETTINGS_KEY) ?? "")

describe("Token list handlers", () => {
  it("renames with one write of the Tokens", () => {
    const storage = withTokens()

    handleRename(storage, 0, "Work")

    expect(storedTokens(storage)[0]).toEqual({
      ...TOKEN_A,
      displayName: "Work"
    })
    expect(storage.writes.get(TOKENS_SETTINGS_KEY)).toBe(1)
  })

  it("moves with one write of the Tokens", () => {
    const storage = withTokens()

    handleMove(storage, 0, 1)

    expect(storedTokens(storage)).toEqual([TOKEN_B, TOKEN_A])
    expect(storage.writes.get(TOKENS_SETTINGS_KEY)).toBe(1)
  })

  it("asks before deleting, without touching the Tokens", () => {
    const storage = withTokens()

    requestDelete(storage, 1)

    expect(pendingDeleteIndex(storage)).toBe(1)
    expect(storage.writes.has(TOKENS_SETTINGS_KEY)).toBe(false)
  })

  it("deletes on confirmation with one write, and stops asking", () => {
    const storage = withTokens({ [PENDING_DELETE_INDEX_SETTINGS_KEY]: "1" })

    confirmDelete(storage)

    expect(storedTokens(storage)).toEqual([TOKEN_A])
    expect(storage.writes.get(TOKENS_SETTINGS_KEY)).toBe(1)
    expect(pendingDeleteIndex(storage)).toBeUndefined()
  })

  it.each([
    [
      "cancel",
      (storage: ReturnType<typeof fakeStorage>) => cancelDelete(storage)
    ],
    [
      "rename",
      (storage: ReturnType<typeof fakeStorage>) => handleRename(storage, 0, "x")
    ],
    [
      "move",
      (storage: ReturnType<typeof fakeStorage>) => handleMove(storage, 0, 1)
    ]
  ])("stops asking on %s", (_name, act) => {
    const storage = withTokens({ [PENDING_DELETE_INDEX_SETTINGS_KEY]: "1" })

    act(storage)

    expect(pendingDeleteIndex(storage)).toBeUndefined()
    expect(storedTokens(storage)).toHaveLength(2)
  })

  it.each(["2", "-1", "garbage"])(
    "ignores a stale pending delete %j",
    stored => {
      const storage = withTokens({
        [PENDING_DELETE_INDEX_SETTINGS_KEY]: stored
      })

      expect(pendingDeleteIndex(storage)).toBeUndefined()
      confirmDelete(storage)
      expect(storedTokens(storage)).toEqual([TOKEN_A, TOKEN_B])
    }
  )
})
