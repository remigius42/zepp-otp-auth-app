import { hmac } from "@noble/hashes/hmac.js"
import { sha1 as nobleSha1 } from "@noble/hashes/legacy.js"
import { base16encode } from "../base16codec"
import { hmacSha1, hmacSha1Key, sha1 } from "../sha1"

/* ASCII only; `TextEncoder` is not in this project's ES2020 lib. */
const text = (value: string) =>
  Uint8Array.from(value, character => character.charCodeAt(0))
const repeated = (byte: number, length: number) =>
  new Uint8Array(length).fill(byte)
const hex = (bytes: Uint8Array) => base16encode(bytes).toLowerCase()

describe("sha1", () => {
  // see https://www.rfc-editor.org/rfc/rfc3174#section-7.3 and FIPS 180
  it.each([
    ["the empty message", text(""), "da39a3ee5e6b4b0d3255bfef95601890afd80709"],
    ["abc", text("abc"), "a9993e364706816aba3e25717850c26c9cd0d89d"],
    [
      "the 448-bit message",
      text("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"), // spellchecker:disable-line
      "84983e441c3bd26ebaae4aa1f95129e5e54670f1"
    ],
    [
      "one million times a",
      repeated(0x61, 1_000_000),
      "34aa973cd4c4daa4f61eeb2bdbad27316534016f"
    ]
  ])("hashes %s", (_name, message, expected) => {
    expect(hex(sha1(message))).toBe(expected)
  })
})

describe("hmacSha1", () => {
  // see https://www.rfc-editor.org/rfc/rfc2202#section-3
  it.each([
    [
      1,
      repeated(0x0b, 20),
      text("Hi There"),
      "b617318655057264e28bc0b6fb378c8ef146be00"
    ],
    [
      2,
      text("Jefe"),
      text("what do ya want for nothing?"),
      "effcdf6ae5eb2fa2d27416d5f184df9c259a7c79"
    ],
    [
      3,
      repeated(0xaa, 20),
      repeated(0xdd, 50),
      "125d7342b9ac11cd91a39af48aa17b4f63f175d3"
    ],
    [
      4,
      Uint8Array.from({ length: 25 }, (_, index) => index + 1),
      repeated(0xcd, 50),
      "4c9007f4026250c6bc8414f9bf50c86c2d7235da"
    ],
    [
      5,
      repeated(0x0c, 20),
      text("Test With Truncation"),
      "4c1a03424b55e07fe7f27be1d58bb9324a9a5a04"
    ],
    [
      6,
      repeated(0xaa, 80),
      text("Test Using Larger Than Block-Size Key - Hash Key First"),
      "aa4ae5e15272d00e95705637ce8a3b55ed402112"
    ],
    [
      7,
      repeated(0xaa, 80),
      text(
        "Test Using Larger Than Block-Size Key and Larger Than One Block-Size Data"
      ),
      "e8e99d0f45237d786d6bbaa7965c7808bbff1a91"
    ]
  ])("matches RFC 2202 test case %i", (_case, key, message, expected) => {
    expect(hex(hmacSha1(hmacSha1Key(key), message))).toBe(expected)
  })

  it("reuses a key for several messages", () => {
    const key = hmacSha1Key(text("Jefe"))

    hmacSha1(key, text("Hi There"))

    expect(hex(hmacSha1(key, text("what do ya want for nothing?")))).toBe(
      "effcdf6ae5eb2fa2d27416d5f184df9c259a7c79"
    )
  })

  it("agrees with @noble/hashes for keys and messages around the block sizes", () => {
    /* A fixed-seed generator keeps a failure reproducible. */
    let seed = 42
    const randomBytes = (length: number) =>
      Uint8Array.from({ length }, () => {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
        return seed >>> 24
      })

    for (let run = 0; run < 300; run++) {
      const key = randomBytes(run % 150)
      const message = randomBytes((run * 7) % 200)

      expect(hex(hmacSha1(hmacSha1Key(key), message))).toBe(
        hex(hmac(nobleSha1, key, message))
      )
      expect(hex(sha1(message))).toBe(hex(nobleSha1(message)))
    }
  })
})
