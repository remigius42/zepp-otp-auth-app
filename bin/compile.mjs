#!/usr/bin/env node
// Compiles the TypeScript sources in src/ into a Zeus-buildable project in
// build/zeus/. See docs/adr/0006-typescript-via-precompile-step.md.
//
// Zeus cannot consume .ts, so everything it reads has to be emitted as .js
// first. Non-TypeScript files (app.json, *.po, assets) are copied verbatim.

import { build, context } from "esbuild"
import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises"
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

/**
 * German for Swiss phones. On a `de-CH` phone the Settings App's `gettext`
 * returned the msgid: the runtime matches the locale exactly and ignores the
 * `en-US` fallback. So `de-CH` gets `de-DE`'s translations, copied at build
 * time so the two cannot drift. Whether this works is Phase 3's S1 hardware
 * check; see TODO.md.
 */
const LOCALE_ALIASES = { "de-DE": ["de-CH"] }

async function copyLocaleAliases() {
  const catalogs = await collect(`${OUT}/**/i18n/*.po`)
  await Promise.all(
    catalogs.flatMap(catalog => {
      const locale = catalog.slice(catalog.lastIndexOf("/") + 1, -".po".length)
      return (LOCALE_ALIASES[locale] ?? []).map(alias =>
        cp(catalog, join(dirname(catalog), `${alias}.po`))
      )
    })
  )
}

/**
 * Module specifiers the Zeus toolchain resolves itself, which must survive
 * bundling untouched: the `@zos/*` device APIs, the phone-side `i18n` module,
 * and the per-platform layout loader.
 */
const ZEUS_PROVIDED = ["@zos/*", "i18n", "zosLoader:*"]

/**
 * Bundle npm dependencies into the entry points rather than leaving them for
 * Zeus.
 *
 * Zeus compiles only the project's own sources; it passes `node_modules`
 * through untouched, and its bytecode compiler then rejects anything newer than
 * it understands. `@noble/hashes` uses `||=` (ES2021), which produced a bare
 * `SyntaxError: unexpected token in expression: '='` from QJSC with no hint as
 * to which file or which dependency.
 *
 * Bundling here means esbuild lowers dependency code to the same ES2020
 * target as ours, so the hazard cannot recur for any future dependency. The
 * cost is that shared modules are inlined per entry point instead of being
 * loaded once -- acceptable on a device where the bundle is compiled to
 * bytecode anyway. See docs/adr/0006-typescript-via-precompile-step.md.
 */
const options = {
  entryPoints: await collect(`${SRC}/**/*.ts`),
  outdir: OUT,
  outbase: SRC,
  bundle: true,
  external: ZEUS_PROVIDED,
  /* Runs before any dependency code in every bundle, filling standard-library
   * gaps in the device's QuickJS. `npm run check:engine` fails the build if a
   * bundle uses a polyfilled built-in without this present. */
  inject: [`${SRC}/shared/enginePolyfills.ts`],
  format: "esm",
  target: "es2020",
  sourcemap: true,
  logLevel: "info"
}

/**
 * Empty the output directory without removing the directory itself.
 *
 * `zeus` is run from inside `build/zeus`, so a shell or a `zeus bridge` session
 * usually has it as its working directory. Deleting and recreating it leaves
 * those processes holding a deleted inode, and every subsequent command fails
 * with `ENOENT: uv_cwd`. Clearing the contents keeps the inode stable.
 */
async function emptyOutDir() {
  await mkdir(OUT, { recursive: true })
  const entries = await readdir(OUT)
  await Promise.all(
    entries.map(entry => rm(join(OUT, entry), { recursive: true, force: true }))
  )
}

await assertAppJsonReferencesJs()
await emptyOutDir()
await copyAssets()
await copyLocaleAliases()

if (watch) {
  const ctx = await context(options)
  await ctx.watch()
  console.log(`watching ${SRC} → ${OUT}`)
} else {
  await build(options)
}
