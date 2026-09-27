#!/usr/bin/env node
// Runs as the `version` script of `npm version`: gives src/app.json the new
// package.json version, so the watch app and the repo cannot disagree.

import { readFile, writeFile } from "node:fs/promises"
import { withVersion } from "./appVersion.mjs"

const APP_JSON = "src/app.json"

const { version } = JSON.parse(await readFile("package.json", "utf8"))
const appJson = JSON.parse(await readFile(APP_JSON, "utf8"))
await writeFile(
  APP_JSON,
  `${JSON.stringify(withVersion(appJson, version), null, 2)}\n`
)
