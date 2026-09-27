<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage jsQR getUserMedia Lisoveliy ZoLArk manujedi typedarrays -->

# 6. Tooling assessment

Part of the [porting analysis](./README.md).

The toolchain is well-constructed but frozen at early-2023 versions (lockfile
last touched September 2023). Three separate questions: what is simply stale,
what cannot follow the app to Zepp OS, and what was never there.

## 6.1 Outdated — independent of any port

| Tool                        | Here               | Current   | Why it matters                                                                                                                                                                       |
| --------------------------- | ------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ESLint                      | 8.33               | 10.x      | v8 is EOL (Oct 2024). v9+ **requires flat config** — `.eslintrc.js` and `.eslintignore` are no longer read. Unavoidable _if staying on ESLint_; §6.4 recommends replacing it instead |
| `@typescript-eslint/*`      | 5.51               | 8.x       | v5 predates flat config and TS 5.x support                                                                                                                                           |
| TypeScript                  | **not declared**   | 5.x       | No explicit devDependency; resolves transitively to **4.9.5** via `@fitbit/sdk`. The compiler version is an accident of the dependency tree                                          |
| Jest                        | 29.4               | 30.x      | Routine                                                                                                                                                                              |
| Prettier                    | 2.8.3              | 3.x       | v3 changed default formatting → expect one mechanical reformat commit                                                                                                                |
| Husky                       | 8                  | 9         | v9 dropped the `_/husky.sh` shim lines that both hooks still carry                                                                                                                   |
| lint-staged                 | 13                 | 17        | Routine                                                                                                                                                                              |
| commitlint                  | 17                 | 21        | Routine                                                                                                                                                                              |
| Stylelint                   | 14                 | 17        | Moot for the port (§6.2). `stylelint-config-prettier` is **deprecated** — obsolete since Stylelint 15 removed formatting rules                                                       |
| markdownlint-cli2           | 0.6                | 0.23      | Routine                                                                                                                                                                              |
| cspell                      | 6                  | 10        | Routine                                                                                                                                                                              |
| conventional-changelog-cli  | 2                  | 5         | Routine                                                                                                                                                                              |
| license-checker-rseidelsohn | 4                  | 5         | Routine                                                                                                                                                                              |
| Node                        | 18 (`.nvmrc` + CI) | 22/24 LTS | **Node 18 is EOL (April 2025)**                                                                                                                                                      |

CI-specific rot in `.github/workflows/node.js.yml`:

- `actions/upload-artifact@v3` — **v3 was disabled in January 2025**, so the
  tag-build artifact step fails outright. `actions/checkout@v3` and
  `setup-node@v3` are merely old.
- `aquasecurity/trivy-action@master` — floating ref, i.e. an unpinned
  third-party action running in CI. Pin to a tag or SHA.
- `npm ci --legacy-peer-deps` in two jobs — masks a peer-dependency conflict
  rather than resolving it; it comes from the Fitbit SDK.
- `.trivyignore` holds five 2023-era Ruby/docs CVE suppressions with no expiry
  dates — permanent silent ignores.
- `package-lock.json` is `lockfileVersion: 2` (npm 8 era).

Upstream context: `@fitbit/sdk` is **still 6.1.0** — the version this repo
pinned in early 2023. The SDK is not being maintained, Fitbit Studio was
deprecated, Sense 2 / Versa 4 never officially got third-party app support,
and in June 2024 Google removed third-party apps and clock faces from the
gallery for EEA users. Nothing here will get better by waiting; that is part of
the argument for the port.

## 6.2 Does not carry over to Zepp OS

| Item                                                                                                                                                                                                           | Disposition                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stylelint` + `stylelint-config-standard` + `stylelint-config-prettier` + `stylelint-no-indistinguishable-colors`, `.stylelintrc.yaml`, `.stylelintignore`, the CI lint step, the lint-staged `**/*.css` entry | **Delete.** Zepp OS has no CSS. The BEM selector pattern and the Fitbit `font-family` exception go with it                                                                    |
| `@fitbit/sdk`, `@fitbit/sdk-cli`, `fitbit-sdk-types`                                                                                                                                                           | → `@zeppos/zeus-cli` (1.9.3), `@zeppos/device-types` (4.0.0), optionally `@zeppos/zml`. Note the typings track **API level 4** while Active 2 may run Zepp OS 5 — expect gaps |
| Root `tsconfig.json` extending `./node_modules/@fitbit/sdk/sdk-tsconfig.json`                                                                                                                                  | No vendor tsconfig exists on Zepp — write your own. Target can be ES2015+ given §3.1, instead of the Fitbit ES5.1 output                                                      |
| Four per-folder tsconfigs (`app`, `common`, `companion`, `settings`) and the matching ESLint `overrides[].parserOptions.project` entries                                                                       | Remap to Zepp's layout (`page/`, `app-side/`, `setting/`, `shared/`, `app.js`)                                                                                                |
| `app/__mocks__/document.ts` (94 lines) and `app/__mocks__/fs.ts`                                                                                                                                               | Rewrite as `@zos/*` mocks; add a jest `moduleNameMapper` for the `@zos/…` specifiers                                                                                          |
| `npm run build` → `fitbit-build`; `npm run debug` → `fitbit` shell; `build/app.fba` + `.sig`                                                                                                                   | → `zeus build` / `zeus preview`; artifact becomes a `.zab` bundle. CI artifact path changes                                                                                   |
| `jest.config.ts` `collectCoverageFrom` globs (`{app,common,companion,resources,settings}`)                                                                                                                     | Remap to the new folders                                                                                                                                                      |
| cspell dictionary                                                                                                                                                                                              | Add `zepp`, `zeus`, `zos`, `amazfit`, `zab`; drop `nuintun`/`qrcode`/`cbor` when those dependencies go                                                                        |
| `bin/generate_licenses_data.sh` → `settings/licenses.js`                                                                                                                                                       | Keep, retarget the output path to the Zepp settings app                                                                                                                       |
| Jekyll docs job + html-proofer, Codacy coverage upload                                                                                                                                                         | Keep unchanged                                                                                                                                                                |

## 6.3 Missing — gaps that exist today and hurt more after the port

1. **No dependency-update automation.** No Dependabot config, no Renovate. This
   is the direct cause of §6.1. Add one, and cover the `github-actions`
   ecosystem too so the v3-action rot doesn't recur.
2. **No type-check step anywhere.** All five tsconfigs set `noEmit: true` but
   nothing runs `tsc`. Type errors surface only via the Fitbit build or via
   ts-jest on files that happen to have tests. Add `npm run typecheck` and a CI
   step — on Zepp there is no vendor build to catch them for you. Note
   `oxlint --type-check` (§6.4) emits TypeScript diagnostics from the same
   program it lints with, which covers part of this; keep a plain `tsc --noEmit`
   as the authoritative check regardless, since tsgolint tracks TypeScript 7.
3. **No aggregate local scripts.** `lint`, `format`, and `typecheck` exist only
   as CI steps and lint-staged entries; `npm run lint` doesn't exist.
   Contributors cannot reproduce CI in one command.
4. **No coverage thresholds.** `jest.config.ts` collects and uploads coverage
   but enforces no floor. Matters more on Zepp, where the UI layer becomes
   untestable and coverage will drop — without a threshold that regression is
   invisible.
   **Decided:** enforce **≥ 80 % per file**, not merely globally, since a global
   floor lets a well-tested core mask an untested module. Configure it in Vitest
   as `coverage.thresholds` with `perFile: true`. Files that genuinely cannot be
   covered — the imperative `@zos/ui` widget construction, the Settings App
   render functions — get explicit `coverage.exclude` entries rather than a
   lowered floor, so the exclusion list stays visible and reviewable instead of
   being hidden in an averaged number.
5. **No `engines` field** pinning Node to match `.nvmrc` and CI.
6. **No `npm audit` step.** Trivy covers CVEs, but only against production
   dependencies in a separate job.
7. **No Zepp test seam.** Establish the `@zos/*` mock convention on day 1 rather
   than retrofitting it; consider the community ZeppPlayer emulator for manual
   checks alongside the official simulator.
8. Minor: no CODEOWNERS, no PR template, no SBOM.

## 6.4 Linter choice: ESLint vs. oxlint vs. Biome

Since ESLint has to be touched either way, it is worth asking whether it should
be replaced rather than migrated.

**Recommendation: oxlint**, for this repo and for the Zepp one.

The historical objection — no type-aware rules — no longer holds. Oxlint's
type-aware mode went **stable in July 2026**, covering 59 of the 61
typescript-eslint type-aware rules via tsgolint (built on TypeScript 7 / tsgo),
benchmarked 12–18× faster than ESLint with typescript-eslint. That matters here
specifically because this config depends on type-aware linting:
`recommended-requiring-type-checking`, four per-folder
`parserOptions.project` entries, and `jest/unbound-method` (itself a type-aware
rule).

Trade-offs:

|               | For                                                                                                                                                                                                                                                                                  | Against                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **oxlint**    | Skips the flat-config migration entirely; collapses six devDependencies (`eslint`, `@typescript-eslint/*`, `eslint-config-prettier`, `eslint-plugin-jest`, `eslint-plugin-tsdoc`) into one or two; `--type-check` overlaps the §6.3 gap; config is simpler on the JS-first Zepp side | **Loses `eslint-plugin-tsdoc`.** TSDoc syntax is used deliberately across this codebase and `tsdoc/syntax` is currently an `error`. No tsdoc equivalent — oxlint has jsdoc rules only                                                                                                                                                             |
| **ESLint 10** | Keeps every current rule including tsdoc; most conservative                                                                                                                                                                                                                          | Flat-config migration of `.eslintrc.js` + `.eslintignore` + four project overrides; keeps the plugin sprawl                                                                                                                                                                                                                                       |
| **Biome**     | One tool for lint + format                                                                                                                                                                                                                                                           | Type inference is a ground-up reimplementation at ~75 % of typescript-eslint's catch rate, and the 2026 roadmap prioritises Vue/Svelte/HTML and YAML over deepening inference. Also wants to own formatting, displacing a Prettier pass that covers Markdown, YAML and JSON tree-wide from a three-line config. Largest blast radius, weakest fit |

Consequences:

- The "migration is unavoidable" note on the ESLint row in §6.1 holds only if
  you stay on ESLint.
- Accept the loss of `tsdoc/syntax` rather than running two linters for one
  rule. Doc comments stay conventional; they just stop being validated.
- Keep Prettier, cspell, markdownlint, commitlint and Husky unchanged.
- **Don't migrate twice.** If this repo is modernized in place, go straight to
  oxlint instead of ESLint 8 → 10 → oxlint later. Start the Zepp repo on oxlint
  from day one.

## 6.5 Effort

Retargeting the toolchain (Zeus CLI, typings, tsconfigs, jest mocks, dropping
Stylelint) is already inside the 3 h scaffolding line in §5. Modernizing the
shared tooling — swapping ESLint for oxlint, Prettier 3 reformat, Husky 9,
Node 22, action bumps, Dependabot, the missing scripts and thresholds — is
**+3–5 h** (down from the ESLint-migration path, which the oxlint route skips)
and is worth doing in this repo first, so the port starts from a current
baseline rather than inheriting three years of drift.

---

← Previous: [5. Effort estimate](./05-effort-estimate.md)\
Next: [7. Market landscape](./07-market.md) →
