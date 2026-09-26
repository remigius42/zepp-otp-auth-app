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
  it("shows the Display Name, the formatted Code and the seconds left", () => {
    expect(tokenView(RFC_TOKEN, 59_000, 0)).toEqual({
      name: "GitHub (john)",
      code: "9428 7082",
      secondsRemaining: 1
    })
  })

  it("shifts Code and countdown by the clock drift", () => {
    /* The watch is 2.5 s behind the phone: at its 56.5 s it is 59 s. */
    expect(tokenView(RFC_TOKEN, 56_500, 2.5)).toMatchObject({
      code: "9428 7082",
      secondsRemaining: 1
    })
  })
})
