import type { SyncState } from "./syncState"

/**
 * What the list and the Token page share, in memory only (ADR-0004). Each
 * page is a bundle of its own (ADR-0006), so a module both import is two
 * copies; the app's `globalData` is one object for both.
 */
export interface Session {
  /** The latest Sync; `undefined` until the first one arrives. */
  sync: SyncState | undefined
  /** Whether the Token page is open, and so handles pushes. */
  tokenOpen: boolean
}

type GlobalData = { session?: Session }

/** The session, created on first use. */
export function session(
  globalData = (getApp() as unknown as { _options: { globalData: GlobalData } })
    ._options.globalData
): Session {
  if (globalData.session === undefined) {
    globalData.session = {
      sync: undefined,
      tokenOpen: false
    }
  }
  return globalData.session
}
