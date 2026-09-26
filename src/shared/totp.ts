/* spellchecker:ignore HOTP typedarrays */

import { hmac } from "@noble/hashes/hmac.js"
import { sha1 } from "@noble/hashes/legacy.js"
import { sha256, sha512 } from "@noble/hashes/sha2.js"
import base32decode from "base32-decode"
import { TotpConfig } from "./TotpConfig"
import { base16decode } from "./base16codec"

/**
 * Calculate the current Time-based One-Time Password (TOTP) for a given TOTP
 * configuration.
 */
export function totp(
  totpConfig: TotpConfig,
  clockDriftSeconds = 0,
  isForNextPeriod = false
) {
  const {
    secret,
    algorithm,
    digits: digitsString,
    period: periodString
  } = totpConfig

  const digits = Number(digitsString)
  const period = Number(periodString)

  // Step 1 in https://www.rfc-editor.org/rfc/rfc4226#section-5.3
  const messageHexString = counterHexString(
    period,
    isForNextPeriod,
    clockDriftSeconds
  )
  const keyBytes = new Uint8Array(base32decode(secret.toUpperCase(), "RFC4648"))
  const hash = hmacDigest(base16decode(messageHexString), keyBytes, algorithm)

  // Step 2 in https://www.rfc-editor.org/rfc/rfc4226#section-5.3
  const otp = dynamicTruncate(hash)

  // Step 3 in https://www.rfc-editor.org/rfc/rfc4226#section-5.3
  const otpDigits = (otp % 10 ** digits).toString(10)
  return padStartWithZeros(otpDigits, digits)
}

/**
 * Get the current counter as a base16 string to be used in the HMAC as the
 * message.
 *
 * RFC 6238 for Time-based One-Time Passwords (TOTP) extends RFC 4226 for
 * HMAC-based One-Time Passwords (HOTP) by using a time-based moving factor, ie.
 * the counter of HOTP used as the message parameter of the HMAC is replaced by
 * a counter based on the current time and an update interval.
 *
 * See https://www.rfc-editor.org/rfc/rfc6238#page-12 and
 * https://www.rfc-editor.org/rfc/rfc6238#page-13 for further information.
 */
function counterHexString(
  period: number,
  isForNextPeriod: boolean,
  clockDriftSeconds: number
) {
  const targetPeriod = isForNextPeriod
    ? currentPeriod(period, clockDriftSeconds) + 1
    : currentPeriod(period, clockDriftSeconds)
  const periodHexString = targetPeriod.toString(16)
  return padStartWithZeros(periodHexString, 16)
}

/**
 * Get the current period number with respect to the given duration in seconds.
 *
 * @returns current period index starting at 0
 */
export function currentPeriod(period: number, clockDriftSeconds = 0) {
  return Math.floor((Date.now() / 1000 + clockDriftSeconds) / period)
}

/**
 * Dynamically truncate the given hash as specified in RFC 4226 section 5.3.
 *
 * Note that the conversion to a string and back to a number again is skipped.
 * See https://www.rfc-editor.org/rfc/rfc4226#section-5.3 for further
 * information.
 */
function dynamicTruncate(hash: Uint8Array) {
  /* The offset is the low nibble of the final byte, so it is at most 15 and
   * `offset + 3` at most 18. Every HMAC this app supports produces at least 20
   * bytes, so these reads are always in bounds. */
  const byteAt = (index: number) => hash[index] as number

  const offset = byteAt(hash.byteLength - 1) & 0xf
  const binaryOtp =
    ((byteAt(offset) & 0x7f) << 24) |
    (byteAt(offset + 1) << 16) |
    (byteAt(offset + 2) << 8) |
    byteAt(offset + 3)

  return binaryOtp
}

/**
 * Calculate the HMAC of the given message under the given key.
 *
 * `@noble/hashes` rather than `crypto-js`: the latter is a UMD bundle whose
 * wrapper resolves its global from module-scope `this`, which is `undefined`
 * under ESM. The Zeus bundler's CommonJS interop then initializes
 * `lib-typedarrays` before `core` has finished, and the library throws on the
 * device — see docs/ZEPP_OS_PORTING_ANALYSIS.md §3.10. It is also officially
 * discontinued, which this repo inherited from `fitbit-otp-auth-app`.
 */
function hmacDigest(
  message: Uint8Array,
  key: Uint8Array,
  algorithm: string
): Uint8Array {
  const hashFunction =
    algorithm === "SHA1" ? sha1 : algorithm === "SHA256" ? sha256 : sha512

  return hmac(hashFunction, key, message)
}

/**
 * Pad a string by prepending "0" until the given targetLength is reached.
 *
 * Note that `String.prototype.padStart` has only been added in ECMAScript 2017
 * and is therefore not available. `String.prototype.repeat` was added with
 * ECMAScript 2015 and is missing as well.
 */
function padStartWithZeros(input: string, targetLength: number) {
  let paddedInput = input
  while (paddedInput.length < targetLength) {
    paddedInput = "0" + paddedInput
  }
  return paddedInput
}
