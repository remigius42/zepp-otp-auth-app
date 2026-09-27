#!/usr/bin/env node
// Checks that everything we ship can actually run on the device's JavaScript
// engine, without needing the device.
//
// Zepp OS runs QuickJS 2020-07-05 (print it with `qjsc -h`), which is older
// than the ES2020 target the toolchain advertises, and its standard library is
// missing anything specified after mid-2020. Neither `tsc`, `oxlint` nor Vitest
// can see this: they all run on modern Node. The failures surface on the watch
// as a bare `SyntaxError` or `TypeError: not a function` during module
// evaluation, with a stack pointing into a bundled file.
//
// Two checks, catching the two ways it goes wrong:
//
//   1. SYNTAX -- compile every bundle with the toolchain's own `qjsc`. This is
//      the same binary `zeus build` uses, so it is authoritative. Caught
//      `@noble/hashes` using `||=` (ES2021).
//   2. BUILT-INS -- `qjsc` compiles a call to a missing function perfectly
//      happily, so syntax checking alone is not enough. Scan the bundles for
//      built-ins this engine does not have. Caught `Object.hasOwn` (ES2022),
//      called by `@noble/hashes` at module load, back when the hashes were
//      noble's.
//
// A real interpreter of the same vintage would subsume both, but is not
// shipped; this gets most of the value from the binaries we already have.

import { build } from "esbuild"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { glob } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const SRC = "src"

/**
 * Built-ins absent from QuickJS 2020-07-05, with the specification that added
 * them.
 */
const UNSUPPORTED_BUILTINS = [
  {
    pattern: /\bBigInt\s*\(/g,
    name: "BigInt()",
    since: "ES2020, compiled out of this build"
  },
  {
    pattern: /\breplaceAll\s*\(/g,
    name: "String.prototype.replaceAll",
    since: "ES2021"
  },
  { pattern: /\bPromise\.any\s*\(/g, name: "Promise.any", since: "ES2021" },
  { pattern: /\bnew WeakRef\b/g, name: "WeakRef", since: "ES2021" },
  {
    pattern: /\bnew FinalizationRegistry\b/g,
    name: "FinalizationRegistry",
    since: "ES2021"
  },
  { pattern: /\.at\s*\(/g, name: "Array/String.prototype.at", since: "ES2022" },
  /* Polyfilled while `@noble/hashes` called it at module load; nothing on the
   * watch uses it since the hashes are our own. */
  {
    pattern: /\bObject\.hasOwn\s*\(/g,
    name: "Object.hasOwn",
    since: "ES2022"
  },
  {
    pattern: /\bstructuredClone\s*\(/g,
    name: "structuredClone",
    since: "ES2022"
  },
  {
    pattern: /\bfindLast(Index)?\s*\(/g,
    name: "Array.prototype.findLast",
    since: "ES2023"
  },
  {
    pattern: /\b(toSorted|toReversed|toSpliced)\s*\(/g,
    name: "Array change-by-copy methods",
    since: "ES2023"
  },
  {
    pattern: /\bObject\.groupBy\s*\(/g,
    name: "Object.groupBy",
    since: "ES2024"
  },
  {
    pattern: /\bnew Text(Encoder|Decoder)\b/g,
    name: "TextEncoder/TextDecoder",
    since: "not in QuickJS core"
  }
]

/** The `qjsc` build for this host, as shipped by `@zeppos/zpm`. */
function qjscBinary() {
  const base = "node_modules/@zeppos/zpm/bin"
  if (process.platform === "win32") return join(base, "qjsc_win32.exe")
  if (process.platform === "darwin") {
    return join(
      base,
      process.arch === "arm64" ? "qjsc_darwin_arm64" : "qjsc_darwin"
    )
  }
  return join(base, process.arch === "arm64" ? "qjsc_arm64" : "qjsc")
}

/**
 * Stand in for the device modules so `qjsc` can resolve imports. A CommonJS
 * body means esbuild permits any named import without knowing the real shape.
 */
const stubPlugin = {
  name: "zeus-provided-stubs",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^(@zos\/|zosLoader:|i18n$)/ }, args => ({
      path: args.path,
      namespace: "zeus-stub"
    }))
    pluginBuild.onLoad({ filter: /.*/, namespace: "zeus-stub" }, () => ({
      contents: "module.exports = new Proxy({}, { get: () => () => {} })",
      loader: "js"
    }))
  }
}

async function entryPoints() {
  const found = []
  for await (const entry of glob(`${SRC}/**/*.ts`)) {
    if (!entry.endsWith(".d.ts") && !entry.includes("__tests__"))
      found.push(entry)
  }
  return found
}

const outDir = await mkdtemp(join(tmpdir(), "zepp-engine-check-"))
const failures = []

try {
  await build({
    entryPoints: await entryPoints(),
    outdir: outDir,
    outbase: SRC,
    bundle: true,
    format: "esm",
    target: "es2020",
    plugins: [stubPlugin],
    logLevel: "silent"
  })

  const bundles = []
  for await (const bundle of glob(`${outDir}/**/*.js`)) bundles.push(bundle)

  for (const bundle of bundles) {
    const label = bundle.slice(outDir.length + 1)

    try {
      await execFileAsync(qjscBinary(), [
        "-c",
        "-m",
        "-o",
        join(outDir, "out.c"),
        bundle
      ])
    } catch (error) {
      const message = `${error.stderr || error.stdout || error.message}`.trim()
      failures.push(`${label}: qjsc rejected it\n    ${message.split("\n")[0]}`)
    }

    const contents = await readFile(bundle, "utf8")
    for (const { pattern, name, since } of UNSUPPORTED_BUILTINS) {
      pattern.lastIndex = 0
      if (pattern.test(contents)) {
        failures.push(
          `${label}: uses ${name} (${since}), absent from QuickJS 2020-07-05`
        )
      }
    }
  }

  if (failures.length > 0) {
    console.error("Device engine check failed:\n")
    for (const failure of failures) console.error(`  - ${failure}`)
    console.error(
      "\nAvoid the construct, or lower or polyfill it before it reaches the\n" +
        "bundle (bin/compile.mjs)."
    )
    process.exitCode = 1
  } else {
    console.log(
      `Device engine check passed: ${bundles.length} bundles compile with ` +
        `${basename(qjscBinary())} and use no unsupported built-ins.`
    )
  }
} finally {
  await rm(outDir, { recursive: true, force: true })
}
