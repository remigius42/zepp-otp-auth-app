import { msUntilNextTick, TICK_MARGIN_MS } from "../tick"

describe("msUntilNextTick", () => {
  it("fires just after the next second boundary", () => {
    expect(msUntilNextTick(10_300, 0)).toBe(700 + TICK_MARGIN_MS)
  })

  it("waits a whole second when a tick fired on time", () => {
    expect(msUntilNextTick(10_000 + TICK_MARGIN_MS, 0)).toBe(1000)
  })

  it("aligns to the drift-shifted second", () => {
    /* The watch is 0.25 s behind: at its 10.3 s it is 10.55 s. */
    expect(msUntilNextTick(10_300, 0.25)).toBe(450 + TICK_MARGIN_MS)
  })

  it("aligns when the watch is ahead of the phone", () => {
    expect(msUntilNextTick(10_300, -0.5)).toBe(200 + TICK_MARGIN_MS)
  })
})
