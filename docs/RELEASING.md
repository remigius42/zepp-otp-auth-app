# Releasing

How a version gets from `main` to a `.zab` file. Where that file then goes —
**Sideload** or **Store Listing** (see [CONTEXT.md](../CONTEXT.md))
— is decided separately and not covered yet.

## 1. Check

1. `npm run lint` and `npm test` pass.
2. The build has been through a batched hardware check on the watch, with test
   Tokens only: the bridge logs Secrets.

## 2. Version

```sh
npm version patch   # or minor, major
```

This bumps `package.json`, and its `version` script gives `src/app.json` the
same `version.name` and counts `version.code` up by one — Zepp tells releases
apart by that integer. `.npmrc` makes the commit `chore(release): <version>`,
and `npm` tags it `v<version>`.

## 3. Build

```sh
npm run build
```

The package lands in `build/zeus/dist/<appId>-OTP_Auth-<version>-<timestamp>.zab`.
It includes Zeus's intermediate products, so one file serves every device with
the same CPU architecture and screen resolution; `zeus prune --ip` in
`build/zeus` strips them, at the cost of a build per device type.

## 4. Push

```sh
git push --follow-tags
```

Attaching the `.zab` to a GitHub release and any store upload wait for the
distribution decision.
