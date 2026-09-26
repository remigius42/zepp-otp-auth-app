/* spell-checker:ignore HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ mjuxiltmpextewrwmnfeity MZXW */

import type { TotpConfig } from "../TotpConfig"

vi.mock("base32-decode", () => ({
  default: () => {
    throw new Error("base32-decode is unavailable in the Settings App")
  }
}))
import { validateConfig } from "../validateConfig"

const VALID: TotpConfig = {
  label: "john.doe@email.com",
  issuer: "GitHub",
  secret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ",
  algorithm: "SHA1",
  digits: "6",
  period: "30"
}

describe("validateConfig", () => {
  it("accepts a valid configuration", () => {
    expect(validateConfig(VALID).size).toBe(0)
  })

  it.each([
    { field: "label", msgid: "Error: Label must not be empty" },
    { field: "secret", msgid: "Error: Secret must not be empty" },
    { field: "algorithm", msgid: "Error: Algorithm must be selected" },
    { field: "digits", msgid: "Error: Number of digits must be selected" },
    { field: "period", msgid: "Error: Period must not be empty" }
  ] as const)("rejects an empty $field", ({ field, msgid }) => {
    expect(validateConfig({ ...VALID, [field]: "" }).get(field)).toBe(msgid)
  })

  // https://github.com/google/google-authenticator/wiki/Key-Uri-Format#issuer
  it("rejects an Issuer that contradicts the Label's issuer prefix", () => {
    const config = { ...VALID, label: "GitHub:john", issuer: "GitLab" }

    expect(validateConfig(config).get("issuer")).toBe(
      "Error: Issuer should match label issuer prefix"
    )
  })

  it("rejects a Secret that is not base32", () => {
    const config = { ...VALID, secret: "not a valid base32 string" }

    expect(validateConfig(config).get("secret")).toBe(
      "Error: Secret cannot be decoded"
    )
  })

  /* On hardware base32-decode fails in the Settings App runtime, cause
   * unknown, and rejected valid Secrets; validation must not depend on it. */
  it("validates the Secret without base32-decode", () => {
    expect(validateConfig(VALID).get("secret")).toBeUndefined()
  })

  it("accepts trailing base32 padding", () => {
    const config = { ...VALID, secret: "MZXW6===" }

    expect(validateConfig(config).get("secret")).toBeUndefined()
  })

  it("ignores the casing of the Secret", () => {
    const config = { ...VALID, secret: "mjuxiltmpextewrwmnfeity" }

    expect(validateConfig(config).get("secret")).toBeUndefined()
  })

  it.each(["23.42", "-23", "0", "abc"])("rejects the Period %s", period => {
    expect(validateConfig({ ...VALID, period }).get("period")).toBe(
      "Error: Period must be a whole number greater 0"
    )
  })
})
