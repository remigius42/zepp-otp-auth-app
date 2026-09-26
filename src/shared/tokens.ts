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
  const parsed = totpConfigFromUri(uri)
  /* Some issuers emit lowercase names; totp() keys its hashes by uppercase. */
  const token = { ...parsed, algorithm: parsed.algorithm.toUpperCase() }
  const [error] = validateConfig(token).values()
  if (error !== undefined) return { error }

  return { tokens: [...parseTokens(storedTokens), token] }
}

function parseTokens(storedTokens: string | undefined): TotpConfig[] {
  return storedTokens ? (JSON.parse(storedTokens) as TotpConfig[]) : []
}
