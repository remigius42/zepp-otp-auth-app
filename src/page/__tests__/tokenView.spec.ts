/* spell-checker:ignore GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ */

import { tokenView } from "../tokenView"

/* RFC 6238 appendix B: SHA-1, 8 digits, T = 59 s → 94287082. */
const RFC_TOKEN = {
  label: "john",
  issuer: "GitHub",
  secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
  algorithm: "SHA1",
  digits: "8",
  period: "30"
}

describe("tokenView", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows the Display Name, the formatted Code and the seconds left", () => {
    vi.useFakeTimers({ now: 59_000 })

    expect(tokenView(RFC_TOKEN)).toEqual({
      name: "GitHub (john)",
      code: "9428 7082",
      secondsRemaining: 1
    })
  })
})
