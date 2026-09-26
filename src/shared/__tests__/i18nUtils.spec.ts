import { gettextWithReplacement } from "../i18nUtils"

describe("gettextWithReplacement", () => {
  it("replaces every occurrence of the reference", () => {
    expect(gettextWithReplacement("@x and @x", "@x", "y")).toBe("y and y")
  })
})
