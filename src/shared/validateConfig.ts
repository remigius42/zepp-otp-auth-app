import { gettext } from "i18n"
import { gettextWithReplacement } from "./i18nUtils"
import type { TotpConfig } from "./TotpConfig"
import { SUPPORTED_ALGORITHMS } from "./totp"

export type TotpConfigField = keyof Omit<TotpConfig, "displayName">

/**
 * RFC 4648 base32, any case, optional trailing padding. Exactly the inputs
 * `base32-decode` accepts, checked without calling it: it fails in the
 * Settings App runtime on hardware, rejecting valid Secrets.
 */
const BASE32 = /^[A-Z2-7]+=*$/i

/**
 * Check a Token's configuration before it is enrolled or synced.
 *
 * @returns a user-facing message per invalid field; empty when valid
 */
export function validateConfig(config: TotpConfig) {
  const errors = new Map<TotpConfigField, string>()

  if (!config.label) {
    errors.set("label", gettext("Error: Label must not be empty"))
  } else {
    const labelIssuerPrefix = config.label.match(/^([^:]+):/)?.[1]
    if (
      labelIssuerPrefix &&
      config.issuer &&
      config.issuer !== labelIssuerPrefix
    ) {
      errors.set(
        "issuer",
        gettextWithReplacement(
          "Error: Issuer should match label issuer prefix",
          "@issuer_prefix",
          labelIssuerPrefix
        )
      )
    }
  }
  if (!config.secret) {
    errors.set("secret", gettext("Error: Secret must not be empty"))
  } else if (!BASE32.test(config.secret)) {
    errors.set("secret", gettext("Error: Secret cannot be decoded"))
  }
  if (!config.digits) {
    errors.set("digits", gettext("Error: Number of digits must be selected"))
  }
  if (!config.period) {
    errors.set("period", gettext("Error: Period must not be empty"))
  } else if (!/^\d+$/.test(config.period) || Number(config.period) <= 0) {
    errors.set(
      "period",
      gettext("Error: Period must be a whole number greater 0")
    )
  }

  const supported: readonly string[] = SUPPORTED_ALGORITHMS
  if (!config.algorithm) {
    errors.set("algorithm", gettext("Error: Algorithm must be selected"))
  } else if (!supported.includes(config.algorithm)) {
    errors.set("algorithm", gettext("Error: Algorithm is not supported"))
  }

  return errors
}
