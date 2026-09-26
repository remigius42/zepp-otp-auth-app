/**
 * Polyfills for standard-library gaps in Zepp OS's JavaScript engine.
 *
 * The device runs **QuickJS 2020-07-05** — printed by the `qjsc` binary that
 * `@zeppos/zpm` ships — so anything standardized after mid-2020 may simply be
 * absent, regardless of the ES2020 target the toolchain advertises. A missing
 * built-in is invisible on the laptop, survives `tsc`, `oxlint` and the whole
 * test suite, and then fails as a bare `TypeError: not a function` during
 * module evaluation on the watch.
 *
 * This file is injected into every bundle by `bin/compile.mjs`, so it runs
 * before any dependency code. Keep it to gaps that are actually reached: the
 * companion guard in the compile step fails the build for unsupported built-ins
 * that are *not* listed here, so a gap without a polyfill cannot ship silently.
 */

/**
 * `Object.hasOwn` is ES2022. `@noble/hashes` calls it while constructing its
 * hash functions at module load, so its absence takes the page down before any
 * of our code runs.
 *
 * The distinctive name is load-bearing: `bin/check-engine.mjs` greps the
 * emitted bundles for it to confirm the polyfill is still present wherever
 * `Object.hasOwn` is used. Renaming it without updating that check would let
 * the gap reopen silently.
 */
export function zeppPolyfillHasOwn(target: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(target, key)
}

const objectConstructor = Object as unknown as {
  hasOwn?: (target: object, key: PropertyKey) => boolean
}

if (typeof objectConstructor.hasOwn !== "function") {
  objectConstructor.hasOwn = zeppPolyfillHasOwn
}
