import { gettext } from "i18n"
import type { TotpConfig } from "./TotpConfig"
import { SUPPORTED_ALGORITHMS } from "./totp"

export type TotpConfigField = keyof Omit<TotpConfig, "displayName">

/**
 * Check a Token's configuration before it is enrolled or synced.
 *
 * @returns a user-facing message per invalid field; empty when valid
 */
export function validateConfig(config: TotpConfig) {
  const errors = new Map<TotpConfigField, string>()

  const supported: readonly string[] = SUPPORTED_ALGORITHMS
  if (config.algorithm === "SHA512") {
    /* Named explicitly: the URI is valid, this app is the limitation (ADR-0007). */
    errors.set("algorithm", gettext("Error: SHA-512 is not supported yet"))
  } else if (!supported.includes(config.algorithm)) {
    errors.set("algorithm", gettext("Error: Algorithm is not supported"))
  }

  return errors
}
