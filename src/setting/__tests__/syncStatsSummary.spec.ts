import { EMPTY_SYNC_STATS } from "../../shared/syncStats"
import { summarizeStats } from "../syncStatsSummary"

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
