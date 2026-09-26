/* spell-checker:ignore GEZDGNBVGY3TQOJQ */

import { pageStatus } from "../pageStatus"

const TOKEN = {
  label: "john",
  issuer: "GitHub",
  secret: "GEZDGNBVGY3TQOJQ",
  algorithm: "SHA1",
  digits: "6",
  period: "30"
}

describe("pageStatus", () => {
  it("waits for the phone before any Sync", () => {
    expect(pageStatus({ pull: "pending", tokens: undefined })).toEqual({
      kind: "waiting",
      msgid: "Waiting for your phone..."
    })
  })

  it("offers a retry when the pull failed", () => {
    expect(pageStatus({ pull: "failed", tokens: undefined })).toEqual({
      kind: "failed",
      msgid:
        "Phone not reachable. Keep Bluetooth on and the Zepp app running. Tap to retry."
    })
  })

  it("explains an empty Token set", () => {
    expect(pageStatus({ pull: "synced", tokens: [] })).toEqual({
      kind: "noTokens",
      msgid: "Add Tokens in the Zepp app."
    })
  })

  it.each(["pending", "failed", "synced"] as const)(
    "shows the Tokens whenever there are some, even if the pull is %s",
    pull => {
      expect(pageStatus({ pull, tokens: [TOKEN] })).toEqual({ kind: "tokens" })
    }
  )
})
