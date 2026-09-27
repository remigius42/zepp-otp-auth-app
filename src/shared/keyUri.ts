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
  return extractTotpConfig(parseKeyUri(keyUri))
}

interface KeyUri {
  labelWithOptionalIssuer: string
  params: Map<string, string>
}

/**
 * Split a key URI by hand rather than with `URL`/`URLSearchParams`: the
 * Settings App rejected every pasted URI on hardware, and a missing URL API in
 * its runtime is the suspected cause. Plain string handling runs everywhere.
 */
function parseKeyUri(keyUri: string): KeyUri {
  const match =
    /^([a-z][a-z0-9+.-]*):\/\/[^/?#]*\/([^?#]*)(?:\?([^#]*))?/i.exec(
      keyUri.trim()
    )
  /* Neither message quotes the input: it may hold a Secret, and the message
   * ends up in settings storage and the bridge log. */
  if (!match) {
    throw Error("Not a key URI")
  }
  const [, scheme = "", rawLabel = "", query = ""] = match
  if (scheme.toLowerCase() !== "otpauth") {
    throw Error(
      `Key URI protocol mismatch: expected "otpauth:" but got "${scheme}:"`
    )
  }
  return {
    labelWithOptionalIssuer: decode(rawLabel),
    params: parseQuery(query)
  }
}

function parseQuery(query: string) {
  const params = new Map<string, string>()
  for (const pair of query.split("&")) {
    if (!pair) continue
    const separator = pair.indexOf("=")
    const key = separator === -1 ? pair : pair.slice(0, separator)
    const value = separator === -1 ? "" : pair.slice(separator + 1)
    if (!params.has(decode(key))) params.set(decode(key), decode(value))
  }
  return params
}

/** As `URLSearchParams` does: `+` is a space in form-encoded text. */
function decode(text: string) {
  return decodeURIComponent(text.replace(/\+/g, " "))
}

function extractTotpConfig({ labelWithOptionalIssuer, params }: KeyUri) {
  const [issuerPrefix, labelAfterColon] = labelWithOptionalIssuer.split(":")
  const fallbackIssuer =
    labelAfterColon === undefined ? undefined : issuerPrefix
  const totpConfig: TotpConfig = {
    label: labelAfterColon ?? issuerPrefix ?? "",
    issuer: params.get("issuer") || fallbackIssuer,
    /* An absent `secret` yields an empty string rather than undefined:
     * `validateConfig` rejects empty secrets already. */
    secret: params.get("secret") ?? "",
    algorithm: params.get("algorithm") || "SHA1",
    digits: params.get("digits") || "6",
    period: params.get("period") || "30"
  }
  return totpConfig
}
