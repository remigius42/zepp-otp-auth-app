import { gettext } from "i18n"
import {
  SYNC_STATS_BASELINE_SETTINGS_KEY,
  SYNC_STATS_SETTINGS_KEY
} from "../shared/settingsKeys"
import { EMPTY_SYNC_STATS, type SyncStats } from "../shared/syncStats"
import type { SettingsStorage } from "./uriPaste"

/** One line for the Settings App: how reliably the watch Syncs. */
export function summarizeStats({
  pulls,
  failures,
  latenciesMs
}: SyncStats): string {
  if (pulls === 0) {
    return gettext("Sync Stats: none yet. Open OTP Auth on the watch.")
  }
  const counts = gettext("Sync Stats: @pulls Syncs, @failures failed")
    .replace("@pulls", String(pulls))
    .replace("@failures", String(failures))
  if (latenciesMs.length === 0) return counts
  return `${counts}${gettext(", median @median ms").replace(
    "@median",
    String(Math.round(median(latenciesMs)))
  )}`
}

/**
 * The stats counted since `baseline`, the stats at the last reset. Fewer
 * pulls than at the reset means the watch started counting afresh — a
 * reinstall — so its stats are all since the reset.
 */
export function statsSinceReset(
  stats: SyncStats,
  baseline: SyncStats
): SyncStats {
  if (stats.pulls < baseline.pulls || stats.failures < baseline.failures) {
    return stats
  }
  const pulls = stats.pulls - baseline.pulls
  const failures = stats.failures - baseline.failures
  const synced = pulls - failures
  return {
    pulls,
    failures,
    latenciesMs: synced === 0 ? [] : stats.latenciesMs.slice(-synced)
  }
}

/** Reset tapped: the stats reported so far become the baseline. */
export function resetSyncStats(
  storage: Pick<SettingsStorage, "getItem" | "setItem">
) {
  storage.setItem(
    SYNC_STATS_BASELINE_SETTINGS_KEY,
    storage.getItem(SYNC_STATS_SETTINGS_KEY) ?? JSON.stringify(EMPTY_SYNC_STATS)
  )
}

function median(values: number[]) {
  /* Sorts a copy. `toSorted` is ES2023, and the Settings App runtime is not a
   * browser — nothing on the laptop tells us what it lacks (§3.6.1). */
  // oxlint-disable-next-line unicorn/no-array-sort
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  const lower = sorted[middle - 1] ?? upper
  return sorted.length % 2 === 1 ? upper : (lower + upper) / 2
}
