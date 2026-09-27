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
 * What the Token page does after a Sync. It follows its Token by the Secret,
 * which a rename or reorder keeps: to its row if unchanged, else the first
 * with it. Gone, it returns to the list. A new color scheme re-launches it,
 * since colors are fixed at widget creation.
 */
export function afterSync(
  shown: TotpConfig,
  row: number,
  tokens: TotpConfig[],
  previous: AppSettings,
  next: AppSettings
): TokenPageUpdate {
  const nextRow =
    tokens[row]?.secret === shown.secret
      ? row
      : tokens.findIndex(token => token.secret === shown.secret)
  if (nextRow === -1) return { kind: "back" }
  return {
    kind: next.colorScheme === previous.colorScheme ? "show" : "relaunch",
    row: nextRow
  }
}
