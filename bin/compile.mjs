#!/usr/bin/env node
// Compiles the TypeScript sources in src/ into a Zeus-buildable project in
// build/zeus/. See docs/adr/0006-typescript-via-precompile-step.md.
//
// Zeus cannot consume .ts, so everything it reads has to be emitted as .js
// first. Non-TypeScript files (app.json, *.po, assets) are copied verbatim.

import { build, context } from "esbuild"
import { cp, mkdir, readFile, rm } from "node:fs/promises"
import { glob } from "node:fs/promises"
import { dirname, join, relative } from "node:path"

const SRC = "src"
const OUT = "build/zeus"
const watch = process.argv.includes("--watch")

/**
 * Zeus resolves module paths in app.json against the emitted JavaScript, so a
 * `.ts` path there fails at build time with a confusing error rather than at
 * compile time. Catch it here instead.
 */
async function assertAppJsonReferencesJs() {
  const appJson = JSON.parse(await readFile(join(SRC, "app.json"), "utf8"))
  const offenders = JSON.stringify(appJson).match(/"[^"]*\.ts"/g)
  if (offenders) {
    throw new Error(
      `app.json must reference emitted .js paths, found: ${offenders.join(", ")}`
    )
  }
}

/** Type declarations and tests are development-only and never ship to the watch. */
const isShipped = file => !file.endsWith(".d.ts") && !file.includes("__tests__")

async function collect(pattern) {
  const found = []
  for await (const entry of glob(pattern)) {
    if (isShipped(entry)) found.push(entry)
  }
  return found
}

async function copyAssets() {
  const files = await collect(`${SRC}/**/*`)
  await Promise.all(
    files
      .filter(file => !file.endsWith(".ts"))
      .map(async file => {
        const target = join(OUT, relative(SRC, file))
        await mkdir(dirname(target), { recursive: true })
        await cp(file, target, { recursive: false }).catch(() => {})
      })
  )
}

const options = {
  entryPoints: await collect(`${SRC}/**/*.ts`),
  outdir: OUT,
  outbase: SRC,
  bundle: false,
  format: "esm",
  target: "es2020",
  sourcemap: true,
  logLevel: "info"
}

await assertAppJsonReferencesJs()
await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })
await copyAssets()

if (watch) {
  const ctx = await context(options)
  await ctx.watch()
  console.log(`watching ${SRC} → ${OUT}`)
} else {
  await build(options)
}
