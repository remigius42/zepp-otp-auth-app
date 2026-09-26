# TypeScript sources, compiled to JavaScript before Zeus sees them

Zeus cannot build TypeScript. `@zeppos/zpm` configures
`rollup-plugin-esbuild` with `include: /\.js?$/`, `tsconfig: false` and
`loaders: { ".json": "json", ".js": "js" }`, so `.ts` is in the module-resolution
extensions but never transpiled — Rollup's JavaScript parser receives the file
and fails on the first type annotation. The official documentation says only
that "Mini Programs are developed in JavaScript" and never mentions TypeScript.

Since the port's largest inherited asset is ~2 300 lines of typed production
code and ~5 500 lines of typed tests, we keep TypeScript and **compile it to
JavaScript into a staging directory that Zeus builds from**.

## Layout

```text
src/            TypeScript sources plus app.json, assets and *.po
build/zeus/     generated: emitted .js plus everything copied verbatim
```

`zeus build` and `zeus dev` run inside `build/zeus/`, which is gitignored.
**`app.json` must reference `*.js` paths**, since it is copied verbatim and Zeus
resolves against emitted JavaScript — a `.ts` path there fails at build time,
not at compile time, which makes it an annoying mistake to diagnose.

Compilation is esbuild for speed, with `tsc --noEmit` kept as the authoritative
type check rather than trusting esbuild, which strips types without checking
them. Emit target is ES2020, matching what zpm already targets for the device
bundle.

## Amendment, 2026-09-26: the step also bundles dependencies

Originally the step only transpiled our own sources (`bundle: false`) and left
npm dependencies for Zeus to resolve. **That is not safe**, and it took a device
build to find out.

zpm's `rollup-plugin-esbuild` is configured with `include: /\.js?$/` but it does
not lower `node_modules` to the ES2020 target it sets for our code. Dependency
code therefore reaches `qjsc` at whatever language level it was published at,
and `qjsc` is an older QuickJS than the target suggests. `@noble/hashes` uses
`||=` — logical OR assignment, ES2021 — and the build failed with:

```text
SyntaxError: unexpected token in expression: '='
    at .../device/page/index.js:1
```

No file, no dependency, no construct named; the location points at the bundled
output, which by then contains every dependency concatenated.

So the step now runs with `bundle: true` and an `external` list of the
specifiers Zeus resolves itself — `@zos/*`, `i18n` and `zosLoader:*`. esbuild
lowers dependency code to the same ES2020 target as ours, and the class of
failure cannot recur for a future dependency.

- **Cost:** shared modules are inlined per entry point rather than loaded once.
  On a device where everything is compiled to bytecode anyway, that is
  acceptable; `page/index.js` is ~33 KB before bytecode compilation.
- **Requirement:** anything Zeus must resolve has to stay in `ZEUS_PROVIDED`, or
  esbuild will try to bundle a module that only exists on the device.
- **Requirement:** every emitted bundle must contain ESM syntax. An entry with
  no remaining `import`/`export` — `app.js` once ZML is inlined — is wrapped by
  Zeus's CommonJS plugin, and the wrapper throws on device with
  `cannot set property 'exports' of undefined`. `src/app.ts` keeps a
  side-effect `@zos/utils` import for this reason.

## Considered alternatives

- **JavaScript with JSDoc annotations and `checkJs: true`**, which is what the
  official template does. Rejected: it means rewriting ~2 300 lines to satisfy a
  bundler's configuration, and JSDoc does not express the discriminated union on
  `PeerMessage` or the `never` exhaustiveness check in `app.ts` without
  significant awkwardness.
- **A hybrid** — pure logic in TypeScript, device and phone code in JavaScript.
  Rejected as the worst of both: two idioms, two mental models, and the boundary
  would drift.
- **`tytydraco/zepp-ts`**, a community tool doing exactly this. Not adopted as a
  dependency: it is a nine-line bash script, last touched December 2022, pinned
  to Zepp OS 1.0 typings. Its approach is sound and is what we implement
  ourselves; its code is not worth inheriting.

## Consequences

- **Zeus error messages point at generated code.** This is the real cost, and it
  bites hardest during on-device debugging. Source maps should be emitted and
  checked early to see whether they survive into anything useful.
- The build is two-stage, so `zeus dev` needs a watcher running alongside it.
- Editor type checking needs `@zeppos/device-types`; note it tracks API_LEVEL 4.0
  while the target device is 4.2, so expect gaps in the typings.
- A `.ts` path accidentally left in `app.json` produces a confusing failure.
  Worth a check in the build script.
- **With `zeus bridge` attached, Zepp's framework logs every message in full —
  Secrets included — and streams them through Zepp's relay to the laptop.**
  Use test Tokens only while debugging over the bridge.

## Incidental findings from the same investigation

These came from reading the toolchain rather than the documentation, and each
corrects or sharpens an earlier claim in the porting analysis:

- **`zpm` ships `qjsc` binaries** for four host platforms. Zepp OS compiles to
  **QuickJS bytecode**; §3.1 previously recorded a QuickJS-class engine as
  community inference.
- **Device bundles target ES2020**, which is more specific than "ES6 supported".
- **`zpm` ships `png2tga`**, so build-time PNG→TGA conversion is provided. This
  is what the pre-rendered progress-arc frames in
  [ADR-0005](./0005-progress-arc-as-prerendered-image-frames.md) will go through.
