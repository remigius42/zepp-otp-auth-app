/* spell-checker:ignore GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ JBSWY3DPEHPK3PXP */

import { totp } from "../../shared/totp"
import { createCodeCache } from "../codeCache"

/* RFC 6238 appendix B: SHA-1, 8 digits, T = 59 s → 94287082. */
const RFC_TOKEN = {
  label: "john",
  issuer: "GitHub",
  secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
  algorithm: "SHA1",
  digits: "8",
  period: "30"
}

describe("createCodeCache", () => {
  it("returns the Token's Code", () => {
    expect(createCodeCache()(RFC_TOKEN, 0, 59_000)).toBe("94287082")
  })

  it("computes a Code once per Period, not on every tick", () => {
    const compute = vi.fn<typeof totp>(totp)
    const code = createCodeCache(compute)

    code(RFC_TOKEN, 0, 31_000)
    code(RFC_TOKEN, 0, 45_000)
    code(RFC_TOKEN, 0, 59_000)

    const current = compute.mock.calls.filter(([, , next]) => !next)
    expect(current).toHaveLength(1)
  })

  it("computes again once the Period ends", () => {
    const compute = vi.fn<typeof totp>(totp)
    const code = createCodeCache(compute)

    code(RFC_TOKEN, 0, 59_000)

    expect(code(RFC_TOKEN, 0, 60_000)).toBe(totp(RFC_TOKEN, 0, false, 60_000))
    expect(compute).toHaveBeenCalledTimes(2)
  })

  /* Fitbit's `TokenPasswordCache` pre-computes at random, which stacked
   * several HMACs into one tick: 1331 ms with 10 Tokens on hardware. */
  it("computes the next Period's Code ahead, one Token per tick", () => {
    const compute = vi.fn<typeof totp>(totp)
    const code = createCodeCache(compute)
    const other = { ...RFC_TOKEN, label: "jane" }

    code(RFC_TOKEN, 0, 31_000)
    code(other, 0, 31_000)
    compute.mockClear()
    code(RFC_TOKEN, 0, 32_000)
    code(other, 0, 32_000)

    expect(compute).toHaveBeenCalledTimes(1)
    expect(compute).toHaveBeenCalledWith(RFC_TOKEN, 0, true, 32_000)

    compute.mockClear()
    code(RFC_TOKEN, 0, 33_000)
    code(other, 0, 33_000)

    expect(compute).toHaveBeenCalledTimes(1)
    expect(compute).toHaveBeenCalledWith(other, 0, true, 33_000)
  })

  it("computes no current Code at the Period boundary once ahead", () => {
    const compute = vi.fn<typeof totp>(totp)
    const code = createCodeCache(compute)

    code(RFC_TOKEN, 0, 31_000)
    code(RFC_TOKEN, 0, 32_000)
    compute.mockClear()

    expect(code(RFC_TOKEN, 0, 60_000)).toBe(totp(RFC_TOKEN, 0, false, 60_000))
    expect(compute).not.toHaveBeenCalledWith(RFC_TOKEN, 0, false, 60_000)
  })

  it("keys the cache by the drift-shifted Period", () => {
    const code = createCodeCache(totp)

    code(RFC_TOKEN, 0, 58_000)

    expect(code(RFC_TOKEN, 2.5, 58_000)).toBe(
      totp(RFC_TOKEN, 2.5, false, 58_000)
    )
  })

  it("forgets the Codes of Tokens no longer synced", () => {
    const compute = vi.fn<typeof totp>(totp)
    const code = createCodeCache(compute)
    const other = { ...RFC_TOKEN, label: "jane" }
    code(RFC_TOKEN, 0, 31_000)
    code(other, 0, 31_000)
    compute.mockClear()

    code.retain([other])
    code(RFC_TOKEN, 0, 32_000)
    code(other, 0, 32_000)

    expect(compute).toHaveBeenCalledWith(RFC_TOKEN, 0, false, 32_000)
    expect(compute).not.toHaveBeenCalledWith(other, 0, false, 32_000)
  })

  it("tells Tokens apart that share Issuer and Label", () => {
    const code = createCodeCache(totp)
    const other = { ...RFC_TOKEN, secret: "JBSWY3DPEHPK3PXP" }

    code(RFC_TOKEN, 0, 59_000)

    expect(code(other, 0, 59_000)).toBe(totp(other, 0, false, 59_000))
  })
})
