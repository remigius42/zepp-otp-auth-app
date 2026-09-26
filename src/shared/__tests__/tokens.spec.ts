/* spell-checker:ignore HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ */

import { addTokenFromUri } from "../tokens"

const SECRET = "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ"

function uri({
  label = "john.doe@email.com",
  issuer = "GitHub",
  algorithm = "SHA1"
} = {}) {
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${SECRET}&issuer=${issuer}&algorithm=${algorithm}&digits=6&period=30`
}

describe("addTokenFromUri", () => {
  it("appends a valid Token to the stored ones", () => {
    const stored = JSON.stringify([
      {
        label: "a",
        issuer: "A",
        secret: SECRET,
        algorithm: "SHA1",
        digits: "6",
        period: "30"
      }
    ])

    const result = addTokenFromUri(stored, uri())

    expect(result).toEqual({
      tokens: [
        expect.objectContaining({ label: "a" }),
        {
          label: "john.doe@email.com",
          issuer: "GitHub",
          secret: SECRET,
          algorithm: "SHA1",
          digits: "6",
          period: "30"
        }
      ]
    })
  })

  it("rejects SHA-512 by name rather than as an invalid URI", () => {
    const result = addTokenFromUri(undefined, uri({ algorithm: "SHA512" }))

    expect(result).toEqual({ error: expect.stringContaining("SHA-512") })
  })

  it("accepts a lowercase algorithm and stores it canonically", () => {
    const result = addTokenFromUri(undefined, uri({ algorithm: "sha256" }))

    expect(result).toEqual({
      tokens: [expect.objectContaining({ algorithm: "SHA256" })]
    })
  })

  it("rejects an unknown algorithm", () => {
    const result = addTokenFromUri(undefined, uri({ algorithm: "MD5" }))

    expect(result).toEqual({ error: expect.stringContaining("Algorithm") })
  })
})
