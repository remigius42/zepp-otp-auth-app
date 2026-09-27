import { withTimeout } from "../withTimeout"

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("settles as the promise does", async () => {
    await expect(withTimeout(Promise.resolve("tokens"), 1000)).resolves.toBe(
      "tokens"
    )
    await expect(
      withTimeout(Promise.reject(new Error("ble disconnect")), 1000)
    ).rejects.toThrow("ble disconnect")
  })

  /* A pull right after Bluetooth returned never settled on hardware, although
   * ZML was given a timeout. */
  it("rejects once the time is up and the promise has not settled", async () => {
    const result = withTimeout(new Promise(() => {}), 1000)
    const assertion = expect(result).rejects.toThrow("timed out after 1000 ms")

    await vi.advanceTimersByTimeAsync(1000)

    await assertion
  })
})
