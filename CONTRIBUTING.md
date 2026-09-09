# Contributing

Thank you for your interest in `zepp-otp-auth-app`!

## Code of Conduct

This project and everyone participating in it is governed by the
[Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to
uphold this code.

## Development environment setup

### Prerequisites

1. [Git](https://git-scm.com/downloads) for version control.
2. [Node.js](https://nodejs.org/en/) — the expected version is in
   [.nvmrc](.nvmrc) — and `npm`.
   While not strictly necessary, you might want to use a Node environment
   manager like [nvm](https://github.com/nvm-sh/nvm), which installs the
   required version based on `.nvmrc` automatically.
3. An IDE. [Visual Studio Code](https://code.visualstudio.com/) is the preferred
   option.
4. A Zepp account and the Zepp phone app, to pair a watch and enable developer
   mode. Building does not need an account; installing on a device does.

### Setup instructions

1. `git clone git@github.com:remigius42/zepp-otp-auth-app` to clone the
   repository.
2. `npm install` to install the dependencies.
3. If you are using a GUI for Git, please make sure that the Git configuration
   `core.hooksPath` is supported. Otherwise you might be able to work around
   this via `rm -rf .git/hooks && ln -s ../.husky .git/hooks` (see a related
   [Husky issue comment](https://github.com/typicode/husky/issues/875#issue-809587895)
   for further details).

## Common development tasks

- `npm test` runs the unit tests; `npm run test:watch` keeps them running
- `npm run lint` runs everything CI runs — Prettier, cspell, markdownlint,
  oxlint and `tsc --noEmit`
- `npm run lint:fix` fixes what can be fixed automatically
- `npm run build` compiles and produces an installable `.zab`
- `npm run dev` compiles and starts the Zeus development server
- `npm run compile:watch` recompiles on change, for running alongside `zeus dev`

## How the build works

**Zeus cannot compile TypeScript**, so this repository does it beforehand. See
[ADR-0006](./docs/adr/0006-typescript-via-precompile-step.md) for why, but the
short version:

```text
src/         TypeScript, app.json, assets, *.po   ← you edit here
build/zeus/  emitted JavaScript, everything else copied verbatim
```

`zeus build` runs inside `build/zeus/`, which is generated and gitignored. Two
consequences worth knowing before they confuse you:

- **Zeus error messages point at generated files**, not at `src/`.
- **`app.json` must reference `.js` paths**, never `.ts`, because Zeus resolves
  against the emitted output. `bin/compile.mjs` fails the build if it finds a
  `.ts` path there.

## Conventions

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/),
  enforced by commitlint in a Git hook.
- **Prose is US English.** cspell has no locale configured, so it will not catch
  British spellings for you.
- **Test coverage must stay at or above 80% per file.** Code that genuinely
  cannot be tested — imperative `@zos/ui` widget construction, settings render
  functions, entry-point shims — is listed explicitly in
  [vitest.config.ts](./vitest.config.ts) rather than having the threshold
  lowered. If you need to add to that list, say why in the commit.
- **Keep entry points thin.** `src/app.ts` and `src/app-side/index.ts` only
  register lifecycle objects; anything worth testing belongs in `src/shared/`.
- **Read the artifact, not the prose about it.** Zepp's documentation has been
  incomplete or wrong in several places where its own source and shipped apps
  were not — see the porting analysis for the specific cases.

## Decisions

Choices that were expensive to reach live in [docs/adr/](./docs/adr/). If you
find yourself disagreeing with one, that is fine — but read it first, because
the rejected alternatives are usually recorded along with the reasons.
