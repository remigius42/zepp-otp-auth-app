/* spell-checker:ignore HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ Ajohn Fsecret Ftotp */

import {
  addTokenFromUri,
  addTokenManually,
  deleteToken,
  moveToken,
  renameToken,
  tokensForSync
} from "../tokens"

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

  it("accepts SHA-512", () => {
    const result = addTokenFromUri(undefined, uri({ algorithm: "SHA512" }))

    expect(result).toEqual({
      tokens: [expect.objectContaining({ algorithm: "SHA512" })]
    })
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

  it("rejects a Token whose Label and Issuer are already enrolled", () => {
    const stored = addTokenFromUri(undefined, uri())
    if (!("tokens" in stored)) throw new Error("setup failed")

    const result = addTokenFromUri(JSON.stringify(stored.tokens), uri())

    expect(result).toEqual({ error: expect.stringContaining("already exists") })
  })

  it("names the underlying parse failure, since the Settings App has no log", () => {
    expect(addTokenFromUri(undefined, "https://example.com/x")).toEqual({
      error: expect.stringContaining("protocol mismatch")
    })
  })

  it.each(["not a URI", "https://example.com"])(
    "returns an error instead of throwing for %s",
    input => {
      expect(addTokenFromUri(undefined, input)).toEqual({
        error: expect.stringContaining("otpauth://")
      })
    }
  )
})

describe("tokensForSync", () => {
  it.each([undefined, "", "{not json"])("yields no Tokens for %j", stored => {
    expect(tokensForSync(stored)).toEqual([])
  })

  it("drops invalid Tokens and keeps the rest", () => {
    const valid = {
      label: "a",
      issuer: "A",
      secret: SECRET,
      algorithm: "SHA1",
      digits: "6",
      period: "30"
    }
    const stored = JSON.stringify([
      valid,
      { ...valid, label: "b", algorithm: "MD5" }
    ])

    expect(tokensForSync(stored)).toEqual([valid])
  })
})

const TOKEN_A = {
  label: "alice",
  issuer: "ACME",
  secret: SECRET,
  algorithm: "SHA1",
  digits: "6",
  period: "30"
}
const TOKEN_B = { ...TOKEN_A, label: "bob" }

describe("renameToken", () => {
  const stored = JSON.stringify([TOKEN_A, TOKEN_B])

  it("sets the Display Name of one Token, trimmed", () => {
    expect(renameToken(stored, 1, "  Work  ")).toEqual([
      TOKEN_A,
      { ...TOKEN_B, displayName: "Work" }
    ])
  })

  it.each(["", "   ", "ACME (bob)"])(
    "removes the Display Name when renamed to %j",
    name => {
      const renamed = JSON.stringify([
        TOKEN_A,
        { ...TOKEN_B, displayName: "Work" }
      ])

      expect(renameToken(renamed, 1, name)).toEqual([TOKEN_A, TOKEN_B])
    }
  )
})

describe("moveToken", () => {
  const TOKEN_C = { ...TOKEN_A, label: "carol" }
  const stored = JSON.stringify([TOKEN_A, TOKEN_B, TOKEN_C])

  it("moves a Token down by one", () => {
    expect(moveToken(stored, 0, 1)).toEqual([TOKEN_B, TOKEN_A, TOKEN_C])
  })

  it("moves a Token up by one", () => {
    expect(moveToken(stored, 2, -1)).toEqual([TOKEN_A, TOKEN_C, TOKEN_B])
  })

  it.each([
    [0, -1],
    [2, 1]
  ])("leaves the order alone moving Token %i by %i", (index, delta) => {
    expect(moveToken(stored, index, delta)).toEqual([TOKEN_A, TOKEN_B, TOKEN_C])
  })
})

describe("deleteToken", () => {
  const stored = JSON.stringify([TOKEN_A, TOKEN_B])

  it("removes the Token at the index", () => {
    expect(deleteToken(stored, 0)).toEqual([TOKEN_B])
  })

  it("leaves the Tokens alone for an index out of range", () => {
    expect(deleteToken(stored, 2)).toEqual([TOKEN_A, TOKEN_B])
  })
})

describe("addTokenManually", () => {
  const FIELDS = {
    label: "alice",
    issuer: "ACME",
    secret: SECRET,
    algorithm: "sha256",
    digits: "8",
    period: "60"
  }

  it("appends the Token, with the algorithm upper-cased", () => {
    expect(addTokenManually(JSON.stringify([TOKEN_B]), FIELDS)).toEqual({
      tokens: [TOKEN_B, { ...FIELDS, algorithm: "SHA256" }]
    })
  })

  it("stores no Issuer when it is left empty", () => {
    const result = addTokenManually(undefined, { ...FIELDS, issuer: "" })

    expect(result).toEqual({
      tokens: [expect.not.objectContaining({ issuer: expect.anything() })]
    })
  })

  it("names every invalid field", () => {
    const result = addTokenManually(undefined, {
      label: "",
      issuer: "",
      secret: "",
      algorithm: "",
      digits: "",
      period: ""
    })

    expect("errors" in result && new Set(result.errors.keys())).toEqual(
      new Set(["algorithm", "digits", "label", "period", "secret"])
    )
  })

  it("rejects a Token whose Label and Issuer are already enrolled", () => {
    const result = addTokenManually(JSON.stringify([TOKEN_A]), {
      ...FIELDS,
      label: TOKEN_A.label,
      issuer: TOKEN_A.issuer
    })

    expect("errors" in result && result.errors.get("label")).toContain(
      "already exists"
    )
  })
})

describe("addTokenFromUri with a percent-escaped URI", () => {
  const ESCAPED = `otpauth%3A%2F%2Ftotp%2FGitHub%3Ajohn%3Fsecret%3D${SECRET}`

  it.each([ESCAPED, ESCAPED.replace("otpauth%3A", "OTPAUTH%3a")])(
    "names the escaping for %s",
    input => {
      const result = addTokenFromUri(undefined, input)

      expect(result).toEqual({
        error: expect.stringContaining("percent-escaped")
      })
      expect(result).not.toEqual({
        error: expect.stringContaining("Not an otpauth")
      })
    }
  )

  it("still accepts %3A and %40 inside the label", () => {
    expect(
      addTokenFromUri(undefined, uri({ label: "GitHub:john@example.com" }))
    ).toEqual({
      tokens: [
        expect.objectContaining({
          issuer: "GitHub",
          label: "john@example.com"
        })
      ]
    })
  })
})
