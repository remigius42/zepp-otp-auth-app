import { gettext } from "i18n"
import { getDisplayName } from "./formatTokens"
import { gettextWithReplacement } from "./i18nUtils"
import { totpConfigFromUri } from "./keyUri"
import type { TotpConfig } from "./TotpConfig"
import { validateConfig } from "./validateConfig"

export type AddTokenResult = { tokens: TotpConfig[] } | { error: string }

/**
 * URI Paste: parse `uri` and append the Token to the stored set.
 *
 * @param storedTokens - the settings-storage value holding the Token set
 * @returns the new Token set to store, or a message for the user
 */
export function addTokenFromUri(
  storedTokens: string | undefined,
  uri: string
): AddTokenResult {
  let parsed: TotpConfig
  try {
    parsed = totpConfigFromUri(uri)
  } catch (error) {
    /* The Settings App cannot console.log on hardware; this message is
     * stored, and settings writes do show in the bridge log (§3.6.1). */
    return {
      error: `${gettext("Error: Not an otpauth:// URI")} (${String(error)})`
    }
  }
  /* Some issuers emit lowercase names; totp() keys its hashes by uppercase. */
  const token = { ...parsed, algorithm: parsed.algorithm.toUpperCase() }
  const [error] = validateConfig(token).values()
  if (error !== undefined) return { error }

  const tokens = parseTokens(storedTokens)
  const existing = tokens.find(candidate => isSameToken(candidate, token))
  if (existing !== undefined) {
    return {
      error: gettextWithReplacement(
        "Error: Token with same label and issuer already exists",
        "@token_list_reference",
        `#${tokens.indexOf(existing) + 1}: ${getDisplayName(existing, true)}`
      )
    }
  }

  return { tokens: [...tokens, token] }
}

const isSameToken = (a: TotpConfig, b: TotpConfig) =>
  a.label === b.label && a.issuer === b.issuer

/**
 * The Token set to Sync: the stored Tokens, re-validated so that one bad
 * Token can never reach — and break — the watch's list (ADR-0007).
 */
export function tokensForSync(storedTokens: string | undefined): TotpConfig[] {
  return parseTokens(storedTokens).filter(
    token => validateConfig(token).size === 0
  )
}

/**
 * Give the Token at `index` a Display Name. Trimmed; an empty name, or one
 * equal to the Issuer-and-Label fallback, removes the Display Name instead.
 */
export function renameToken(
  storedTokens: string | undefined,
  index: number,
  name: string
): TotpConfig[] {
  return parseTokens(storedTokens).map((token, i) => {
    if (i !== index) return token
    const { displayName: _previous, ...unnamed } = token
    const trimmed = name.trim()
    return trimmed === "" || trimmed === getDisplayName(unnamed)
      ? unnamed
      : { ...unnamed, displayName: trimmed }
  })
}

function parseTokens(storedTokens: string | undefined): TotpConfig[] {
  if (!storedTokens) return []
  try {
    return JSON.parse(storedTokens) as TotpConfig[]
  } catch {
    return []
  }
}
