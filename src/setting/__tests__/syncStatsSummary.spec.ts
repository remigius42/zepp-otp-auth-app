import {
  SYNC_STATS_BASELINE_SETTINGS_KEY,
  SYNC_STATS_SETTINGS_KEY
} from "../../shared/settingsKeys"
import { EMPTY_SYNC_STATS, parseStats } from "../../shared/syncStats"
import {
  resetSyncStats,
  statsSinceReset,
  summarizeStats
} from "../syncStatsSummary"

describe("summarizeStats", () => {
  it("counts Syncs and failures and gives the median latency", () => {
    expect(
      summarizeStats({ pulls: 42, failures: 3, latenciesMs: [900, 400, 480] })
    ).toBe("Sync Stats: 42 Syncs, 3 failed, median 480 ms")
  })

  it("averages the middle pair for an even number of latencies", () => {
    expect(
      summarizeStats({ pulls: 2, failures: 0, latenciesMs: [400, 500] })
    ).toBe("Sync Stats: 2 Syncs, 0 failed, median 450 ms")
  })

  it("leaves out the median when no Sync succeeded", () => {
    expect(summarizeStats({ pulls: 2, failures: 2, latenciesMs: [] })).toBe(
      "Sync Stats: 2 Syncs, 2 failed"
    )
  })

  it("says so when the watch has not reported yet", () => {
    expect(summarizeStats(EMPTY_SYNC_STATS)).toBe(
      "Sync Stats: none yet. Open OTP Auth on the watch."
    )
  })
})

describe("statsSinceReset", () => {
  const baseline = { pulls: 10, failures: 4, latenciesMs: [700, 800] }

  it("counts only the pulls after the reset", () => {
    expect(
      statsSinceReset(
        { pulls: 13, failures: 5, latenciesMs: [700, 800, 500, 600] },
        baseline
      )
    ).toEqual({ pulls: 3, failures: 1, latenciesMs: [500, 600] })
  })

  it("keeps no latencies when no pull since the reset succeeded", () => {
    expect(
      statsSinceReset(
        { pulls: 11, failures: 5, latenciesMs: [700, 800] },
        baseline
      )
    ).toEqual({ pulls: 1, failures: 1, latenciesMs: [] })
  })

  it("leaves the stats alone without a reset", () => {
    const stats = { pulls: 3, failures: 1, latenciesMs: [500, 600] }

    expect(statsSinceReset(stats, EMPTY_SYNC_STATS)).toEqual(stats)
  })

  it("ignores a reset from before the watch started counting afresh", () => {
    const stats = { pulls: 2, failures: 0, latenciesMs: [500, 600] }

    expect(statsSinceReset(stats, baseline)).toEqual(stats)
  })
})

describe("resetSyncStats", () => {
  it("makes the stats read as none until the watch reports again", () => {
    const storage = fakeStorage({
      [SYNC_STATS_SETTINGS_KEY]: JSON.stringify({
        pulls: 13,
        failures: 5,
        latenciesMs: [500]
      })
    })

    resetSyncStats(storage)

    expect(shownStats(storage)).toEqual(EMPTY_SYNC_STATS)
  })

  it("resets before the watch ever reported", () => {
    const storage = fakeStorage({})

    resetSyncStats(storage)

    expect(shownStats(storage)).toEqual(EMPTY_SYNC_STATS)
  })
})

function shownStats(storage: ReturnType<typeof fakeStorage>) {
  return statsSinceReset(
    parseStats(storage.getItem(SYNC_STATS_SETTINGS_KEY)),
    parseStats(storage.getItem(SYNC_STATS_BASELINE_SETTINGS_KEY))
  )
}

function fakeStorage(initial: Record<string, string>) {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => items.get(key),
    setItem: (key: string, value: string) => void items.set(key, value)
  }
}
