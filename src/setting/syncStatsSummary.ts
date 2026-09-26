import { gettext } from "i18n"
import type { SyncStats } from "../shared/syncStats"

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
