import { withVersion } from "../appVersion.mjs"

const APP_JSON = {
  configVersion: "v3",
  app: { appId: 20042, version: { code: 1, name: "0.1.0" } }
}

describe("withVersion", () => {
  it("names the version and counts the code up", () => {
    expect(withVersion(APP_JSON, "0.2.0").app.version).toEqual({
      code: 2,
      name: "0.2.0"
    })
  })

  it("leaves the rest alone", () => {
    const next = withVersion(APP_JSON, "0.2.0")

    expect(next.app.appId).toBe(20042)
    expect(next.configVersion).toBe("v3")
    expect(APP_JSON.app.version).toEqual({ code: 1, name: "0.1.0" })
  })

  /* `npm version` re-running on an unchanged version must not skip a code. */
  it("keeps the code when the name is unchanged", () => {
    expect(withVersion(APP_JSON, "0.1.0").app.version.code).toBe(1)
  })
})
