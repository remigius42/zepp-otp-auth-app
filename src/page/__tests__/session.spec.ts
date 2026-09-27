/* spell-checker:ignore unstub */

import { session } from "../session"

describe("session", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("starts empty", () => {
    expect(session({})).toEqual({
      sync: undefined,
      tokenOpen: false
    })
  })

  it("is one object per globalData, so both pages see the same", () => {
    const globalData = {}

    session(globalData).tokenOpen = true

    expect(session(globalData).tokenOpen).toBe(true)
  })

  it("lives on the app's globalData by default", () => {
    const globalData = {}
    vi.stubGlobal("getApp", () => ({ _options: { globalData } }))

    session().tokenOpen = true

    expect(session(globalData).tokenOpen).toBe(true)
  })
})
