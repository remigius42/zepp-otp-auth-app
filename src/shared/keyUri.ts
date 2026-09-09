import type { TotpConfig } from "./TotpConfig"

/**
 * Parse a key URI into a TotpConfig
 *
 * See
 * https://github.com/google/google-authenticator/wiki/Key-Uri-Format
 * for further details.
 *
 * @param keyUri - string in key URI format
 * @returns totpConfig based on URI
 */
export function totpConfigFromUri(keyUri: string) {
  const url = new URL(keyUri)
  validateProtocol(url)
  return extractTotpConfig(url)
}

function extractTotpConfig(url: URL) {
  const label = getLabel(url)
  const issuer = getIssuer(url)
  const secret = getSecret(url)
  const algorithm = url.searchParams.get("algorithm") || "SHA1"
  const digits = url.searchParams.get("digits") || "6"
  const period = url.searchParams.get("period") || "30"
  const totpConfig: TotpConfig = {
    label,
    issuer,
    secret,
    algorithm,
    digits,
    period
  }
  return totpConfig
}

function validateProtocol(url: URL) {
  if (url.protocol !== "otpauth:") {
    throw Error(
      `Key URI protocol mismatch: expected "otpauth:" but got "${url.protocol}"`
    )
  }
}

function getLabel(url: URL) {
  const labelWithOptionalIssuer = getDecodedLabelWithOptionalIssuer(url)
  const [issuerPrefix, labelAfterColon] = labelWithOptionalIssuer.split(":")
  return labelAfterColon ?? issuerPrefix ?? ""
}

function getIssuer(url: URL) {
  const labelWithOptionalIssuer = getDecodedLabelWithOptionalIssuer(url)
  const issuer = url.searchParams.get("issuer")
  const [issuerPrefix, labelAfterColon] = labelWithOptionalIssuer.split(":")
  const fallbackIssuer =
    labelAfterColon === undefined ? undefined : issuerPrefix
  return issuer || fallbackIssuer
}

function getDecodedLabelWithOptionalIssuer(url: URL) {
  return decodeURIComponent(
    url.href.match(/otpauth:\/\/(?:h|t)otp\/([^?]+)\?.*/)?.[1] ?? ""
  )
}

/* An absent `secret` yields an empty string rather than null: `validateConfig`
 * rejects empty secrets already, so this keeps the rejection path identical
 * while making the TotpConfig honestly typed. */
function getSecret(url: URL) {
  return url.searchParams.get("secret") ?? ""
}
