import { hmac } from "@noble/hashes/hmac.js"
import { sha512 as nobleSha512 } from "@noble/hashes/sha2.js"
import { base16encode } from "../base16codec"
import { hmacSha512, hmacSha512Key, sha512 } from "../sha512"

const text = (value: string) => new TextEncoder().encode(value)
const repeated = (byte: number, length: number) =>
  new Uint8Array(length).fill(byte)
const hex = (bytes: Uint8Array) => base16encode(bytes).toLowerCase()

describe("sha512", () => {
  // see FIPS 180-4 and https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values
  it.each([
    [
      "the empty message",
      text(""),
      "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
    ],
    [
      "abc",
      text("abc"),
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
    ],
    [
      "the 896-bit message",
      text(
        // spellchecker:disable-next-line
        "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"
      ),
      "8e959b75dae313da8cf4f72814fc143f8f7779c6eb9f7fa17299aeadb6889018501d289e4900f7e4331b99dec4b5433ac7d329eeb6dd26545e96e55b874be909"
    ],
    [
      "one million times a",
      repeated(0x61, 1_000_000),
      "e718483d0ce769644e2e42c7bc15b4638e1f98b13b2044285632a803afa973ebde0ff244877ea60a4cb0432ce577c31beb009c5c2c49aa2e4eadb217ad8cc09b"
    ]
  ])("hashes %s", (_name, message, expected) => {
    expect(hex(sha512(message))).toBe(expected)
  })
})

describe("hmacSha512", () => {
  // see https://www.rfc-editor.org/rfc/rfc4231#section-4
  it.each([
    [
      1,
      repeated(0x0b, 20),
      text("Hi There"),
      "87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854"
    ],
    [
      2,
      text("Jefe"),
      text("what do ya want for nothing?"),
      "164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737"
    ],
    [
      6,
      repeated(0xaa, 131),
      text("Test Using Larger Than Block-Size Key - Hash Key First"),
      "80b24263c7c1a3ebb71493c1dd7be8b49b46d1f41b4aeec1121b013783f8f3526b56d037e05f2598bd0fd2215d6a1e5295e64f73f63f0aec8b915a985d786598"
    ]
  ])("matches RFC 4231 test case %i", (_case, key, message, expected) => {
    expect(hex(hmacSha512(hmacSha512Key(key), message))).toBe(expected)
  })

  it("reuses a key for several messages", () => {
    const key = hmacSha512Key(text("Jefe"))

    hmacSha512(key, text("Hi There"))

    expect(hex(hmacSha512(key, text("what do ya want for nothing?")))).toBe(
      "164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737"
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
      const key = randomBytes(run % 300)
      const message = randomBytes((run * 7) % 400)

      expect(hex(hmacSha512(hmacSha512Key(key), message))).toBe(
        hex(hmac(nobleSha512, key, message))
      )
      expect(hex(sha512(message))).toBe(hex(nobleSha512(message)))
    }
  })
})
