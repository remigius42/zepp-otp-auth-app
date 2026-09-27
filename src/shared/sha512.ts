/* spellchecker:ignore rotr */

/**
 * SHA-512 and HMAC-SHA512, hand-written because the watch has no BigInt
 * (ADR-0007): `@noble/hashes` builds SHA-512's constants with it, so SHA-512
 * Tokens were rejected. Every 64-bit word here is a pair of 32-bit halves,
 * high and low, in parallel typed arrays; additions carry by hand. Otherwise
 * built like `./sha1` and `./sha256`.
 */

/**
 * First 64 bits of the fractional parts of the first 80 primes' cube roots,
 * high and low halves.
 */
const K_HI = /* @__PURE__ */ Int32Array.of(
  0x428a2f98,
  0x71374491,
  0xb5c0fbcf,
  0xe9b5dba5,
  0x3956c25b,
  0x59f111f1,
  0x923f82a4,
  0xab1c5ed5,
  0xd807aa98,
  0x12835b01,
  0x243185be,
  0x550c7dc3,
  0x72be5d74,
  0x80deb1fe,
  0x9bdc06a7,
  0xc19bf174,
  0xe49b69c1,
  0xefbe4786,
  0x0fc19dc6,
  0x240ca1cc,
  0x2de92c6f,
  0x4a7484aa,
  0x5cb0a9dc,
  0x76f988da,
  0x983e5152,
  0xa831c66d,
  0xb00327c8,
  0xbf597fc7,
  0xc6e00bf3,
  0xd5a79147,
  0x06ca6351,
  0x14292967,
  0x27b70a85,
  0x2e1b2138,
  0x4d2c6dfc,
  0x53380d13,
  0x650a7354,
  0x766a0abb,
  0x81c2c92e,
  0x92722c85,
  0xa2bfe8a1,
  0xa81a664b,
  0xc24b8b70,
  0xc76c51a3,
  0xd192e819,
  0xd6990624,
  0xf40e3585,
  0x106aa070,
  0x19a4c116,
  0x1e376c08,
  0x2748774c,
  0x34b0bcb5,
  0x391c0cb3,
  0x4ed8aa4a,
  0x5b9cca4f,
  0x682e6ff3,
  0x748f82ee,
  0x78a5636f,
  0x84c87814,
  0x8cc70208,
  0x90befffa,
  0xa4506ceb,
  0xbef9a3f7,
  0xc67178f2,
  0xca273ece,
  0xd186b8c7,
  0xeada7dd6,
  0xf57d4f7f,
  0x06f067aa,
  0x0a637dc5,
  0x113f9804,
  0x1b710b35,
  0x28db77f5,
  0x32caab7b,
  0x3c9ebe0a,
  0x431d67c4,
  0x4cc5d4be,
  0x597f299c,
  0x5fcb6fab,
  0x6c44198c
)
const K_LO = /* @__PURE__ */ Int32Array.of(
  0xd728ae22,
  0x23ef65cd,
  0xec4d3b2f,
  0x8189dbbc,
  0xf348b538,
  0xb605d019,
  0xaf194f9b,
  0xda6d8118,
  0xa3030242,
  0x45706fbe,
  0x4ee4b28c,
  0xd5ffb4e2,
  0xf27b896f,
  0x3b1696b1,
  0x25c71235,
  0xcf692694,
  0x9ef14ad2,
  0x384f25e3,
  0x8b8cd5b5,
  0x77ac9c65,
  0x592b0275,
  0x6ea6e483,
  0xbd41fbd4,
  0x831153b5,
  0xee66dfab,
  0x2db43210,
  0x98fb213f,
  0xbeef0ee4,
  0x3da88fc2,
  0x930aa725,
  0xe003826f,
  0x0a0e6e70,
  0x46d22ffc,
  0x5c26c926,
  0x5ac42aed,
  0x9d95b3df,
  0x8baf63de,
  0x3c77b2a8,
  0x47edaee6,
  0x1482353b,
  0x4cf10364,
  0xbc423001,
  0xd0f89791,
  0x0654be30,
  0xd6ef5218,
  0x5565a910,
  0x5771202a,
  0x32bbd1b8,
  0xb8d2d0c8,
  0x5141ab53,
  0xdf8eeb99,
  0xe19b48a8,
  0xc5c95a63,
  0xe3418acb,
  0x7763e373,
  0xd6b2b8a3,
  0x5defb2fc,
  0x43172f60,
  0xa1f0ab72,
  0x1a6439ec,
  0x23631e28,
  0xde82bde9,
  0xb2c67915,
  0xe372532b,
  0xea26619c,
  0x21c0c207,
  0xcde0eb1e,
  0xee6ed178,
  0x72176fba,
  0xa2c898a6,
  0xbef90dae,
  0x131c471b,
  0x23047d84,
  0x40c72493,
  0x15c9bebc,
  0x9c100d4c,
  0xcb3e42b6,
  0xfc657e2a,
  0x3ad6faec,
  0x4a475817
)

/** The 80-word message schedule, high and low halves. */
const wHi = /* @__PURE__ */ new Int32Array(80)
const wLo = /* @__PURE__ */ new Int32Array(80)
/** The final, padded block of a message. */
const tail = /* @__PURE__ */ new Uint8Array(128)

const TWO_32 = 0x100000000

/* 64-bit rotations and shifts right, one function per half. `n` < 32 except
 * where a name says otherwise; rotating by `n` >= 32 swaps the halves. */
const rotrHi = (hi: number, lo: number, n: number) =>
  (hi >>> n) | (lo << (32 - n))
const rotrLo = (hi: number, lo: number, n: number) =>
  (lo >>> n) | (hi << (32 - n))
const shrLo = (hi: number, lo: number, n: number) =>
  (lo >>> n) | (hi << (32 - n))

/** Hash one 128-byte block, whose words are already loaded, into `state`. */
function compress(stateHi: Int32Array, stateLo: Int32Array) {
  for (let i = 16; i < 80; i++) {
    let xh = wHi[i - 15] as number
    let xl = wLo[i - 15] as number
    const s0h = rotrHi(xh, xl, 1) ^ rotrHi(xh, xl, 8) ^ (xh >>> 7)
    const s0l = rotrLo(xh, xl, 1) ^ rotrLo(xh, xl, 8) ^ shrLo(xh, xl, 7)
    xh = wHi[i - 2] as number
    xl = wLo[i - 2] as number
    /* rotr 61 = rotr 29 of the swapped halves. */
    const s1h = rotrHi(xh, xl, 19) ^ rotrLo(xh, xl, 29) ^ (xh >>> 6)
    const s1l = rotrLo(xh, xl, 19) ^ rotrHi(xh, xl, 29) ^ shrLo(xh, xl, 6)
    const lo =
      (s1l >>> 0) +
      ((wLo[i - 7] as number) >>> 0) +
      (s0l >>> 0) +
      ((wLo[i - 16] as number) >>> 0)
    wHi[i] =
      (s1h +
        (wHi[i - 7] as number) +
        s0h +
        (wHi[i - 16] as number) +
        Math.floor(lo / TWO_32)) |
      0
    wLo[i] = lo | 0
  }

  let ah = stateHi[0] as number
  let al = stateLo[0] as number
  let bh = stateHi[1] as number
  let bl = stateLo[1] as number
  let ch = stateHi[2] as number
  let cl = stateLo[2] as number
  let dh = stateHi[3] as number
  let dl = stateLo[3] as number
  let eh = stateHi[4] as number
  let el = stateLo[4] as number
  let fh = stateHi[5] as number
  let fl = stateLo[5] as number
  let gh = stateHi[6] as number
  let gl = stateLo[6] as number
  let hh = stateHi[7] as number
  let hl = stateLo[7] as number
  for (let i = 0; i < 80; i++) {
    /* rotr 41 = rotr 9 of the swapped halves. */
    const sigma1h = rotrHi(eh, el, 14) ^ rotrHi(eh, el, 18) ^ rotrLo(eh, el, 9)
    const sigma1l = rotrLo(eh, el, 14) ^ rotrLo(eh, el, 18) ^ rotrHi(eh, el, 9)
    const chooseH = (eh & fh) ^ (~eh & gh)
    const chooseL = (el & fl) ^ (~el & gl)
    const t1l =
      (hl >>> 0) +
      (sigma1l >>> 0) +
      (chooseL >>> 0) +
      ((K_LO[i] as number) >>> 0) +
      ((wLo[i] as number) >>> 0)
    const t1h =
      hh +
      sigma1h +
      chooseH +
      (K_HI[i] as number) +
      (wHi[i] as number) +
      Math.floor(t1l / TWO_32)

    /* rotr 34 and 39 = rotr 2 and 7 of the swapped halves. */
    const sigma0h = rotrHi(ah, al, 28) ^ rotrLo(ah, al, 2) ^ rotrLo(ah, al, 7)
    const sigma0l = rotrLo(ah, al, 28) ^ rotrHi(ah, al, 2) ^ rotrHi(ah, al, 7)
    const majorityH = (ah & bh) ^ (ah & ch) ^ (bh & ch)
    const majorityL = (al & bl) ^ (al & cl) ^ (bl & cl)
    const t2l = (sigma0l >>> 0) + (majorityL >>> 0)
    const t2h = sigma0h + majorityH + Math.floor(t2l / TWO_32)

    hh = gh
    hl = gl
    gh = fh
    gl = fl
    fh = eh
    fl = el
    const newEl = (dl >>> 0) + ((t1l | 0) >>> 0)
    eh = (dh + t1h + Math.floor(newEl / TWO_32)) | 0
    el = newEl | 0
    dh = ch
    dl = cl
    ch = bh
    cl = bl
    bh = ah
    bl = al
    const newAl = ((t1l | 0) >>> 0) + ((t2l | 0) >>> 0)
    ah = (t1h + t2h + Math.floor(newAl / TWO_32)) | 0
    al = newAl | 0
  }

  addInto(stateHi, stateLo, 0, ah, al)
  addInto(stateHi, stateLo, 1, bh, bl)
  addInto(stateHi, stateLo, 2, ch, cl)
  addInto(stateHi, stateLo, 3, dh, dl)
  addInto(stateHi, stateLo, 4, eh, el)
  addInto(stateHi, stateLo, 5, fh, fl)
  addInto(stateHi, stateLo, 6, gh, gl)
  addInto(stateHi, stateLo, 7, hh, hl)
}

/** Add the 64-bit word `hi`:`lo` to word `j` of the state. */
function addInto(
  stateHi: Int32Array,
  stateLo: Int32Array,
  j: number,
  hi: number,
  lo: number
) {
  const sum = ((stateLo[j] as number) >>> 0) + (lo >>> 0)
  stateHi[j] = ((stateHi[j] as number) + hi + Math.floor(sum / TWO_32)) | 0
  stateLo[j] = sum | 0
}

/** Load 16 big-endian 64-bit words from `bytes` at `offset`. */
function loadBlock(bytes: Uint8Array, offset: number) {
  for (let j = 0; j < 16; j++, offset += 8) {
    wHi[j] =
      ((bytes[offset] as number) << 24) |
      ((bytes[offset + 1] as number) << 16) |
      ((bytes[offset + 2] as number) << 8) |
      (bytes[offset + 3] as number)
    wLo[j] =
      ((bytes[offset + 4] as number) << 24) |
      ((bytes[offset + 5] as number) << 16) |
      ((bytes[offset + 6] as number) << 8) |
      (bytes[offset + 7] as number)
  }
}

interface State {
  hi: Int32Array
  lo: Int32Array
}

/**
 * Hash `message` into `state`, as if `prefixLength` bytes had already been
 * hashed into it, and pad. `prefixLength` is a multiple of 128.
 */
function hashInto(state: State, message: Uint8Array, prefixLength: number) {
  const length = message.length
  const fullBlocksEnd = length - (length % 128)
  for (let offset = 0; offset < fullBlocksEnd; offset += 128) {
    loadBlock(message, offset)
    compress(state.hi, state.lo)
  }

  tail.fill(0)
  tail.set(message.subarray(fullBlocksEnd))
  const rest = length - fullBlocksEnd
  tail[rest] = 0x80
  if (rest >= 112) {
    loadBlock(tail, 0)
    compress(state.hi, state.lo)
    tail.fill(0)
  }
  loadBlock(tail, 0)
  /* The length field is 128 bits; messages here are far below 2^53 bits. */
  const bits = (prefixLength + length) * 8
  wHi[15] = Math.floor(bits / TWO_32)
  wLo[15] = bits | 0
  compress(state.hi, state.lo)
}

/**
 * First 64 bits of the fractional parts of the first 8 primes' square roots,
 * high and low halves.
 */
function initialState(): State {
  return {
    hi: Int32Array.of(
      0x6a09e667,
      0xbb67ae85,
      0x3c6ef372,
      0xa54ff53a,
      0x510e527f,
      0x9b05688c,
      0x1f83d9ab,
      0x5be0cd19
    ),
    lo: Int32Array.of(
      0xf3bcc908,
      0x84caa73b,
      0xfe94f82b,
      0x5f1d36f1,
      0xade682d1,
      0x2b3e6c1f,
      0xfb41bd6b,
      0x137e2179
    )
  }
}

function stateBytes(state: State) {
  const bytes = new Uint8Array(64)
  for (let j = 0; j < 8; j++) {
    const hi = state.hi[j] as number
    const lo = state.lo[j] as number
    bytes[j * 8] = hi >>> 24
    bytes[j * 8 + 1] = hi >>> 16
    bytes[j * 8 + 2] = hi >>> 8
    bytes[j * 8 + 3] = hi
    bytes[j * 8 + 4] = lo >>> 24
    bytes[j * 8 + 5] = lo >>> 16
    bytes[j * 8 + 6] = lo >>> 8
    bytes[j * 8 + 7] = lo
  }
  return bytes
}

/** The SHA-512 digest of `message`. */
export function sha512(message: Uint8Array): Uint8Array {
  const state = initialState()
  hashInto(state, message, 0)
  return stateBytes(state)
}

/** An HMAC-SHA512 key with its inner and outer pad blocks already hashed. */
export interface HmacSha512Key {
  readonly inner: Readonly<State>
  readonly outer: Readonly<State>
}

/** The state after hashing one block of `key` XOR `pad`. */
function padState(key: Uint8Array, pad: number) {
  const block = new Uint8Array(128).fill(pad)
  for (let j = 0; j < key.length; j++) {
    block[j] = (key[j] as number) ^ pad
  }
  const state = initialState()
  loadBlock(block, 0)
  compress(state.hi, state.lo)
  return state
}

/** Prepare `key` for any number of `hmacSha512` calls. */
export function hmacSha512Key(key: Uint8Array): HmacSha512Key {
  const blockKey = key.length > 128 ? sha512(key) : key
  return { inner: padState(blockKey, 0x36), outer: padState(blockKey, 0x5c) }
}

/** The HMAC-SHA512 of `message` under a key from `hmacSha512Key`. */
export function hmacSha512(
  key: HmacSha512Key,
  message: Uint8Array
): Uint8Array {
  const inner = { hi: key.inner.hi.slice(), lo: key.inner.lo.slice() }
  hashInto(inner, message, 128)

  /* The outer message is the 64-byte inner digest: one block, padded by hand. */
  const outer = { hi: key.outer.hi.slice(), lo: key.outer.lo.slice() }
  wHi.set(inner.hi)
  wLo.set(inner.lo)
  wHi[8] = 0x80000000 | 0
  wLo[8] = 0
  wHi.fill(0, 9, 16)
  wLo.fill(0, 9, 15)
  wLo[15] = (128 + 64) * 8
  compress(outer.hi, outer.lo)
  return stateBytes(outer)
}
