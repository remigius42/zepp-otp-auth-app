import { hmac } from "@noble/hashes/hmac.js"
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js"
import { base16encode } from "../base16codec"
import { hmacSha256, hmacSha256Key, sha256 } from "../sha256"

/* ASCII only; `TextEncoder` is not in this project's ES2020 lib. */
const text = (value: string) =>
  Uint8Array.from(value, character => character.charCodeAt(0))
const repeated = (byte: number, length: number) =>
  new Uint8Array(length).fill(byte)
const hex = (bytes: Uint8Array) => base16encode(bytes).toLowerCase()

describe("sha256", () => {
  // see FIPS 180-4 and https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values
  it.each([
    [
      "the empty message",
      text(""),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    ],
    [
      "abc",
      text("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    ],
    [
      "the 448-bit message",
      text("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"), // spellchecker:disable-line
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    ],
    [
      "one million times a",
      repeated(0x61, 1_000_000),
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"
    ]
  ])("hashes %s", (_name, message, expected) => {
    expect(hex(sha256(message))).toBe(expected)
  })
})

describe("hmacSha256", () => {
  // see https://www.rfc-editor.org/rfc/rfc4231#section-4
  it.each([
    [
      1,
      repeated(0x0b, 20),
      text("Hi There"),
      "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7"
    ],
    [
      2,
      text("Jefe"),
      text("what do ya want for nothing?"),
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
    ],
    [
      6,
      repeated(0xaa, 131),
      text("Test Using Larger Than Block-Size Key - Hash Key First"),
      "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54"
    ]
  ])("matches RFC 4231 test case %i", (_case, key, message, expected) => {
    expect(hex(hmacSha256(hmacSha256Key(key), message))).toBe(expected)
  })

  it("reuses a key for several messages", () => {
    const key = hmacSha256Key(text("Jefe"))

    hmacSha256(key, text("Hi There"))

    expect(hex(hmacSha256(key, text("what do ya want for nothing?")))).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
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

      expect(hex(hmacSha256(hmacSha256Key(key), message))).toBe(
        hex(hmac(nobleSha256, key, message))
      )
      expect(hex(sha256(message))).toBe(hex(nobleSha256(message)))
    }
  })
})
