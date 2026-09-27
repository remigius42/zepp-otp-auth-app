/**
 * `app.json` with its version named `version`. Zepp tells releases apart by
 * the integer `code`, so a new name counts it up by one.
 */
export function withVersion(appJson, version) {
  const { code, name } = appJson.app.version
  return {
    ...appJson,
    app: {
      ...appJson.app,
      version: { code: name === version ? code : code + 1, name: version }
    }
  }
}
