/**
 * Sync Stats: the evidence for the Store On Watch decision (ADR-0004
 * amendment). Counted on the watch, reported with each launch pull, shown in
 * the Settings App. No Secrets, no Settings.
 */
export interface SyncStats {
  pulls: number
  failures: number
  /** The most recent successful pulls' latencies, oldest first. */
  latenciesMs: number[]
}

const MAX_LATENCIES = 20

export const EMPTY_SYNC_STATS: SyncStats = {
  pulls: 0,
  failures: 0,
  latenciesMs: []
}

export function recordPull(
  stats: SyncStats,
  outcome: "synced" | "failed",
  ms: number
): SyncStats {
  return outcome === "synced"
    ? {
        ...stats,
        pulls: stats.pulls + 1,
        latenciesMs: [...stats.latenciesMs, ms].slice(-MAX_LATENCIES)
      }
    : { ...stats, pulls: stats.pulls + 1, failures: stats.failures + 1 }
}

/** Stored stats, or empty ones if absent or malformed. */
export function parseStats(stored: string | undefined): SyncStats {
  if (stored === undefined) return EMPTY_SYNC_STATS
  try {
    return asSyncStats(JSON.parse(stored)) ?? EMPTY_SYNC_STATS
  } catch {
    return EMPTY_SYNC_STATS
  }
}

/** `value` if it has the shape of `SyncStats`, else `undefined`. */
export function asSyncStats(value: unknown): SyncStats | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const { pulls, failures, latenciesMs } = value as Record<string, unknown>
  return typeof pulls === "number" &&
    typeof failures === "number" &&
    Array.isArray(latenciesMs) &&
    latenciesMs.every(ms => typeof ms === "number")
    ? { pulls, failures, latenciesMs }
    : undefined
}
