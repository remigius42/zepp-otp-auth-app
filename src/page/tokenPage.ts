import type { AppSettings } from "../shared/AppSettings"
import type { TotpConfig } from "../shared/TotpConfig"

/**
 * The row index the list passes as router params. Only the index: params go
 * through the system and the bridge logs (ADR-0006), a Secret must not.
 */
export function rowFromParams(params: string | undefined) {
  return params !== undefined && /^\d+$/.test(params) ? +params : undefined
}

export type TokenPageUpdate =
  | { kind: "back" }
  | { kind: "relaunch" | "show"; row: number }

/**
 * What the Token page does after a Sync. It follows its Token by Issuer and
 * Label, which a rename or reorder keeps and no two Tokens share (the
 * duplicate check in `shared/tokens`); Secrets can repeat. Gone, it returns
 * to the list. A new color scheme re-launches it, since colors are fixed at
 * widget creation.
 */
export function afterSync(
  shown: TotpConfig,
  tokens: TotpConfig[],
  previous: AppSettings,
  next: AppSettings
): TokenPageUpdate {
  const nextRow = tokens.findIndex(
    token => token.issuer === shown.issuer && token.label === shown.label
  )
  if (nextRow === -1) return { kind: "back" }
  return {
    kind: next.colorScheme === previous.colorScheme ? "show" : "relaunch",
    row: nextRow
  }
}
