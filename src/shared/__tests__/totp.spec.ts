/* spellchecker:ignore MJUXILTMPEXTEWRWMNFEITY */

import { TotpConfig } from "../TotpConfig"
import { currentPeriod, totp } from "../totp"

describe("totp", () => {
  const RFC4226_TEST_VECTORS = [
    [0, 755224],
    [1, 287082],
    [2, 359152],
    [3, 969429],
    [4, 338314],
    [5, 254676],
    [6, 287922],
    [7, 162583],
    [8, 399871],
    [9, 520489]
  ]
  const RFC4226_TEST_VECTORS_BASE32_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" // 12345678901234567890 encoded as text via https://emn178.github.io/online-tools/base32_encode.html // spellchecker:disable-line

  const RFC6238_TEST_VECTORS_BASE32_SECRETS = {
    SHA1: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", // spellchecker:disable-line
    SHA256: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA====", // spellchecker:disable-line
    SHA512:
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA=" // spellchecker:disable-line
  }
  const RFC6238_TEST_VECTORS = [
    ...[
      { algorithm: "SHA1", totp: "94287082" },
      { algorithm: "SHA256", totp: "46119246" }
    ].map(entry => ({ ...entry, seconds: 59 })),
    ...[
      { algorithm: "SHA1", totp: "07081804" },
      { algorithm: "SHA256", totp: "68084774" }
    ].map(entry => ({ ...entry, seconds: 1111111109 })),
    ...[
      { algorithm: "SHA1", totp: "14050471" },
      { algorithm: "SHA256", totp: "67062674" }
    ].map(entry => ({ ...entry, seconds: 1111111111 })),
    ...[
      { algorithm: "SHA1", totp: "89005924" },
      { algorithm: "SHA256", totp: "91819424" }
    ].map(entry => ({ ...entry, seconds: 1234567890 })),
    ...[
      { algorithm: "SHA1", totp: "69279037" },
      { algorithm: "SHA256", totp: "90698825" }
    ].map(entry => ({ ...entry, seconds: 2000000000 })),
    ...[
      { algorithm: "SHA1", totp: "65353130" },
      { algorithm: "SHA256", totp: "77737706" }
    ].map(entry => ({ ...entry, seconds: 20000000000 }))
  ]

  /* SHA-512 is not supported: Zepp OS runs QuickJS without BigInt, which
   * `@noble/hashes` needs to build SHA-512's constant table. The RFC 6238
   * vectors are kept so restoring support is a matter of deleting this block
   * and moving them back. See totp.ts's SUPPORTED_ALGORITHMS. */
  const RFC6238_SHA512_VECTORS_PENDING_SUPPORT = [
    { seconds: 59, totp: "90693936" },
    { seconds: 1111111109, totp: "25091201" },
    { seconds: 1111111111, totp: "99943326" },
    { seconds: 1234567890, totp: "93441116" },
    { seconds: 2000000000, totp: "38618901" },
    { seconds: 20000000000, totp: "47863826" }
  ]

  it.each(RFC6238_SHA512_VECTORS_PENDING_SUPPORT)(
    "should reject SHA512 with an explicit message at $seconds seconds",
    ({ seconds }) => {
      vi.useFakeTimers()
      vi.setSystemTime(seconds * 1000)
      const totpConfig: TotpConfig = {
        label: "some label",
        secret: RFC6238_TEST_VECTORS_BASE32_SECRETS.SHA512,
        algorithm: "SHA512",
        digits: "8",
        period: "30"
      }

      expect(() => totp(totpConfig)).toThrow(/Unsupported algorithm "SHA512"/)
      vi.useRealTimers()
    }
  )

  // see https://www.rfc-editor.org/rfc/rfc4226#page-32
  it.each(RFC4226_TEST_VECTORS)(
    "should yield the correct result for RFC 4226 test vector %i",
    (input, expected) => {
      const SOME_TOTP_PERIOD = 30
      vi.useFakeTimers()
      vi.setSystemTime(input * 1000 * SOME_TOTP_PERIOD)
      const totpConfig: TotpConfig = {
        label: "some label",
        secret: RFC4226_TEST_VECTORS_BASE32_SECRET,
        algorithm: "SHA1",
        digits: "6",
        period: String(SOME_TOTP_PERIOD)
      }

      expect(totp(totpConfig)).toBe(String(expected))
      vi.useRealTimers()
    }
  )

  // see https://www.rfc-editor.org/rfc/rfc6238#appendix-B
  it.each(RFC6238_TEST_VECTORS)(
    "should yield the correct result for RFC 6238 test vector at $seconds seconds with algorithm $algorithm",
    ({ seconds, algorithm, totp: expectedTotp }) => {
      vi.useFakeTimers()
      vi.setSystemTime(seconds * 1000)
      const totpConfig: TotpConfig = {
        label: "some label",
        secret:
          RFC6238_TEST_VECTORS_BASE32_SECRETS[
            algorithm as keyof typeof RFC6238_TEST_VECTORS_BASE32_SECRETS
          ],
        algorithm,
        digits: "8",
        period: "30"
      }

      expect(totp(totpConfig)).toBe(expectedTotp)
      vi.useRealTimers()
    }
  )

  it("ignores the casing of the base32 encoded secret", () => {
    const SOME_TOTP_PERIOD = 30
    vi.useFakeTimers()
    vi.setSystemTime(42 * 1000 * SOME_TOTP_PERIOD)
    const SECRET_IN_MIXED_CASE = "aBcDeFgHiJkLmNoPqRsT"
    const totpConfigMixedCaseSecret: TotpConfig = {
      label: "some label",
      secret: SECRET_IN_MIXED_CASE,
      algorithm: "SHA1",
      digits: "6",
      period: String(SOME_TOTP_PERIOD)
    }
    const totpConfigUpperCaseSecret = {
      ...totpConfigMixedCaseSecret,
      secret: SECRET_IN_MIXED_CASE.toUpperCase()
    }

    expect(totp(totpConfigMixedCaseSecret)).toBe(
      totp(totpConfigUpperCaseSecret)
    )
  })

  it("defaults to current period and not the next", () => {
    vi.useFakeTimers()
    vi.setSystemTime(42 * 1000)
    const totpConfig: TotpConfig = {
      label: "some label",
      secret: "MJUXILTMPEXTEWRWMNFEITY",
      algorithm: "SHA1",
      digits: "8",
      period: "30"
    }

    expect(totp(totpConfig, 0)).toBe(totp(totpConfig, 0, false))
    vi.useRealTimers()
  })

  it("when configured for next period returns the TOTP for the next period", () => {
    vi.useFakeTimers()
    vi.setSystemTime(42 * 1000)
    const SOME_PERIOD = 30
    const totpConfig: TotpConfig = {
      label: "some label",
      secret: "MJUXILTMPEXTEWRWMNFEITY",
      algorithm: "SHA1",
      digits: "8",
      period: String(SOME_PERIOD)
    }

    const totpForNextPeriod = totp(totpConfig, 0, true)

    vi.advanceTimersByTime(SOME_PERIOD * 1000)
    expect(totpForNextPeriod).toBe(totp(totpConfig, 0, false))
    vi.useRealTimers()
  })

  it("defaults to a clock drift of 0", () => {
    vi.useFakeTimers()
    vi.setSystemTime(42 * 1000)
    const totpConfig: TotpConfig = {
      label: "some label",
      secret: "MJUXILTMPEXTEWRWMNFEITY",
      algorithm: "SHA1",
      digits: "8",
      period: "30"
    }

    expect(totp(totpConfig)).toBe(totp(totpConfig, 0))
    vi.useRealTimers()
  })

  it("considers the clock drift", () => {
    vi.useFakeTimers()
    const SOME_SYSTEM_TIME = 42 * 1000
    vi.setSystemTime(SOME_SYSTEM_TIME)
    const totpConfig: TotpConfig = {
      label: "some label",
      secret: "MJUXILTMPEXTEWRWMNFEITY",
      algorithm: "SHA1",
      digits: "8",
      period: "30"
    }
    const SOME_CLOCK_DRIFT_IN_SECONDS = 42

    const totpWithClockDrift = totp(totpConfig, SOME_CLOCK_DRIFT_IN_SECONDS)

    vi.setSystemTime(SOME_SYSTEM_TIME + SOME_CLOCK_DRIFT_IN_SECONDS * 1000)
    expect(totpWithClockDrift).toBe(totp(totpConfig, 0))
    vi.useRealTimers()
  })

  describe("currentPeriod", () => {
    it("returns the current period (starting at 0) based on the given duration in seconds", () => {
      vi.useFakeTimers()
      const SOME_SECONDS = 42
      vi.setSystemTime(SOME_SECONDS * 1000)

      const period = currentPeriod(30)

      expect(period).toBe(1)
      vi.useRealTimers()
    })

    it("by default has a clock drift of 0", () => {
      vi.useFakeTimers()
      const SOME_SECONDS = 42
      vi.setSystemTime(SOME_SECONDS * 1000)
      const SOME_PERIOD = 30

      const actualPeriod = currentPeriod(SOME_PERIOD)

      const periodWithZeroClockDrift = currentPeriod(SOME_PERIOD, 0)
      expect(actualPeriod).toBe(periodWithZeroClockDrift)
      vi.useRealTimers()
    })

    it("considers the clock drift", () => {
      vi.useFakeTimers()
      const SOME_SECONDS = 42
      vi.setSystemTime(SOME_SECONDS * 1000)
      const SOME_PERIOD = 30
      const CLOCK_DRIFT_EQUAL_ONE_PERIOD = SOME_PERIOD

      const actualPeriod = currentPeriod(
        SOME_PERIOD,
        CLOCK_DRIFT_EQUAL_ONE_PERIOD
      )

      const expectedPeriod = currentPeriod(SOME_PERIOD, 0) + 1
      expect(actualPeriod).toBe(expectedPeriod)
      vi.useRealTimers()
    })
  })
})
