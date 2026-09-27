/**
 * SHA-1 and HMAC-SHA1, hand-written because `@noble/hashes` is too slow on
 * the watch: one HMAC took about 300 ms there, and a Period boundary with 12
 * Tokens stalled the list for seconds — see
 * docs/porting-analysis/03-build-and-hardware-findings.md §3.14 item 1.
 *
 * Written for QuickJS, an interpreter without a JIT, where every call,
 * allocation and property lookup costs: 32-bit words in module-level typed
 * arrays reused across calls, rounds as plain loops over local variables, no
 * closures in the hot path. `hmacSha1Key` hashes the padded key blocks once,
 * so each Code of the same Secret costs two compressions instead of four.
 */

/** The 80-word message schedule, shared by every compression. */
const schedule = new Int32Array(80)
/** The final, padded block of a message. */
const tail = new Uint8Array(64)

/** Hash one 64-byte block, whose words are already in `schedule`, into `state`. */
function compress(state: Int32Array) {
  const w = schedule
  for (let i = 16; i < 80; i++) {
    const x =
      (w[i - 3] as number) ^
      (w[i - 8] as number) ^
      (w[i - 14] as number) ^
      (w[i - 16] as number)
    w[i] = (x << 1) | (x >>> 31)
  }

  let a = state[0] as number
  let b = state[1] as number
  let c = state[2] as number
  let d = state[3] as number
  let e = state[4] as number
  let t: number
  let i = 0
  for (; i < 20; i++) {
    t =
      (((a << 5) | (a >>> 27)) +
        ((b & c) | (~b & d)) +
        e +
        (w[i] as number) +
        0x5a827999) |
      0
    e = d
    d = c
    c = (b << 30) | (b >>> 2)
    b = a
    a = t
  }
  for (; i < 40; i++) {
    t =
      (((a << 5) | (a >>> 27)) +
        (b ^ c ^ d) +
        e +
        (w[i] as number) +
        0x6ed9eba1) |
      0
    e = d
    d = c
    c = (b << 30) | (b >>> 2)
    b = a
    a = t
  }
  for (; i < 60; i++) {
    t =
      (((a << 5) | (a >>> 27)) +
        ((b & c) | (b & d) | (c & d)) +
        e +
        (w[i] as number) +
        0x8f1bbcdc) |
      0
    e = d
    d = c
    c = (b << 30) | (b >>> 2)
    b = a
    a = t
  }
  for (; i < 80; i++) {
    t =
      (((a << 5) | (a >>> 27)) +
        (b ^ c ^ d) +
        e +
        (w[i] as number) +
        0xca62c1d6) |
      0
    e = d
    d = c
    c = (b << 30) | (b >>> 2)
    b = a
    a = t
  }

  state[0] = ((state[0] as number) + a) | 0
  state[1] = ((state[1] as number) + b) | 0
  state[2] = ((state[2] as number) + c) | 0
  state[3] = ((state[3] as number) + d) | 0
  state[4] = ((state[4] as number) + e) | 0
}

/** Load 16 big-endian words from `bytes` at `offset` into `schedule`. */
function loadBlock(bytes: Uint8Array, offset: number) {
  for (let j = 0; j < 16; j++, offset += 4) {
    schedule[j] =
      ((bytes[offset] as number) << 24) |
      ((bytes[offset + 1] as number) << 16) |
      ((bytes[offset + 2] as number) << 8) |
      (bytes[offset + 3] as number)
  }
}

/**
 * Hash `message` into `state`, as if `prefixLength` bytes had already been
 * hashed into it, and pad. `prefixLength` is a multiple of 64.
 */
function hashInto(
  state: Int32Array,
  message: Uint8Array,
  prefixLength: number
) {
  const length = message.length
  const fullBlocksEnd = length - (length % 64)
  for (let offset = 0; offset < fullBlocksEnd; offset += 64) {
    loadBlock(message, offset)
    compress(state)
  }

  tail.fill(0)
  tail.set(message.subarray(fullBlocksEnd))
  const rest = length - fullBlocksEnd
  tail[rest] = 0x80
  if (rest >= 56) {
    loadBlock(tail, 0)
    compress(state)
    tail.fill(0)
  }
  loadBlock(tail, 0)
  const bits = (prefixLength + length) * 8
  schedule[14] = Math.floor(bits / 0x100000000)
  schedule[15] = bits | 0
  compress(state)
}

function initialState() {
  return Int32Array.of(
    0x67452301,
    0xefcdab89 | 0,
    0x98badcfe | 0,
    0x10325476,
    0xc3d2e1f0 | 0
  )
}

function stateBytes(state: Int32Array) {
  const bytes = new Uint8Array(20)
  for (let j = 0; j < 5; j++) {
    const word = state[j] as number
    bytes[j * 4] = word >>> 24
    bytes[j * 4 + 1] = word >>> 16
    bytes[j * 4 + 2] = word >>> 8
    bytes[j * 4 + 3] = word
  }
  return bytes
}

/** The SHA-1 digest of `message`. */
export function sha1(message: Uint8Array): Uint8Array {
  const state = initialState()
  hashInto(state, message, 0)
  return stateBytes(state)
}

/** An HMAC-SHA1 key with its inner and outer pad blocks already hashed. */
export interface HmacSha1Key {
  readonly inner: Int32Array
  readonly outer: Int32Array
}

/** The state after hashing one block of `key` XOR `pad`. */
function padState(key: Uint8Array, pad: number) {
  const block = new Uint8Array(64).fill(pad)
  for (let j = 0; j < key.length; j++) {
    block[j] = (key[j] as number) ^ pad
  }
  const state = initialState()
  loadBlock(block, 0)
  compress(state)
  return state
}

/** Prepare `key` for any number of `hmacSha1` calls. */
export function hmacSha1Key(key: Uint8Array): HmacSha1Key {
  const blockKey = key.length > 64 ? sha1(key) : key
  return { inner: padState(blockKey, 0x36), outer: padState(blockKey, 0x5c) }
}

/** The HMAC-SHA1 of `message` under a key from `hmacSha1Key`. */
export function hmacSha1(key: HmacSha1Key, message: Uint8Array): Uint8Array {
  const inner = key.inner.slice()
  hashInto(inner, message, 64)

  /* The outer message is the 20-byte inner digest: one block, padded by hand. */
  const outer = key.outer.slice()
  schedule.set(inner)
  schedule[5] = 0x80000000 | 0
  schedule.fill(0, 6, 15)
  schedule[15] = (64 + 20) * 8
  compress(outer)
  return stateBytes(outer)
}
