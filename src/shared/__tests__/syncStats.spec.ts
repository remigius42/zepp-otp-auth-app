import { EMPTY_SYNC_STATS, parseStats, recordPull } from "../syncStats"

describe("recordPull", () => {
  it("counts a successful pull and keeps its latency", () => {
    expect(recordPull(EMPTY_SYNC_STATS, "synced", 480)).toEqual({
      pulls: 1,
      failures: 0,
      latenciesMs: [480]
    })
  })

  it("counts a failed pull without a latency", () => {
    expect(recordPull(EMPTY_SYNC_STATS, "failed", 10_000)).toEqual({
      pulls: 1,
      failures: 1,
      latenciesMs: []
    })
  })

  it("keeps only the last 20 latencies", () => {
    let stats = EMPTY_SYNC_STATS
    for (let ms = 1; ms <= 21; ms++) stats = recordPull(stats, "synced", ms)

    expect(stats.pulls).toBe(21)
    expect(stats.latenciesMs).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 2)
    )
  })
})

describe("parseStats", () => {
  it("reads stored stats", () => {
    const stats = { pulls: 3, failures: 1, latenciesMs: [400, 500] }

    expect(parseStats(JSON.stringify(stats))).toEqual(stats)
  })

  it.each([
    undefined,
    "not json",
    "null",
    '{"pulls":"3","failures":1,"latenciesMs":[]}',
    '{"pulls":3,"failures":1,"latenciesMs":["400"]}',
    '{"pulls":3,"failures":1}'
  ])("starts afresh from %s", stored => {
    expect(parseStats(stored)).toEqual(EMPTY_SYNC_STATS)
  })
})
