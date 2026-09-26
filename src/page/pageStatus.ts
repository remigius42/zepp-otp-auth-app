import type { TotpConfig } from "../shared/TotpConfig"

export type PullState = "pending" | "failed" | "synced"

export type PageStatus =
  | { kind: "tokens" }
  | { kind: "waiting" | "failed" | "noTokens"; msgid: string }

/**
 * What the page shows instead of — or as — the Token list. A push can deliver
 * Tokens while the launch pull is still pending or after it failed, so Tokens
 * win over the pull's state. `msgid` goes through `getText` on the device.
 */
export function pageStatus({
  pull,
  tokens
}: {
  pull: PullState
  tokens: TotpConfig[] | undefined
}): PageStatus {
  if (tokens === undefined) {
    return pull === "failed"
      ? {
          kind: "failed",
          msgid:
            "Phone not reachable. Keep Bluetooth on and the Zepp app running. Tap to retry."
        }
      : { kind: "waiting", msgid: "Waiting for your phone..." }
  }
  return tokens.length === 0
    ? { kind: "noTokens", msgid: "Add Tokens in the Zepp app." }
    : { kind: "tokens" }
}
