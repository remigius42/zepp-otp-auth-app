<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage Lisoveliy ZoLArk galulex qjsc zpm noble msgids typedarrays transpiles ENOENT -->

# 12. Dead ends and corrections

Part of the [porting analysis](./README.md).

Several claims in this analysis did not survive contact with the platform. They
are corrected in place where they were made, marked _Corrected_, _Superseded_
or _Amendment_ with a date, and the commit that reversed each one says what was
believed and what happened instead. This chapter collects them in one table so
the pattern is visible: what was believed, where the belief came from, what the
watch actually did, and where the correction is recorded.

The **Source** column is the interesting one. The platform has four accounts of
itself — the prose documentation, the `@zeppos/device-types` typings, the
library and toolchain source, and the runtime on the watch — and each dead end
below is a case of trusting one of the first three over the last. "Habit" means
an assumption carried over from the Fitbit app without checking.

Entries recorded only in commit history carry the commit hashes; the rest name
the section or decision record.

## Engine and build

| Believed                                                                                    | Source      | Actually                                                                                                                                                                            | Recorded                           |
| ------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Zeus builds TypeScript                                                                      | Unstated    | Its esbuild plugin includes `.js` only, `tsconfig: false`; `.ts` resolves and never transpiles. Hence the precompile step.                                                          | ADR-0006                           |
| `targets.platforms` filters devices; one entry means one device                             | Guess       | It sets a design width. One entry built six per-device packages, 360–480 px.                                                                                                        | §3.0                               |
| The engine is "QuickJS-class", supporting ES6, later ES2020                                 | Community   | `qjsc -h` says QuickJS 2020-07-05. ES2020 is what zpm lowers _our_ sources to; `node_modules` pass through untouched.                                                               | §3.1, §3.1.1, §3.10, ADR-0006      |
| The JS-support page listing `Promise` and timers as unsupported is stale from OS 1.0        | Prose       | It describes the bare engine; ZML and `@zos/timer` supply the rest. `Promise` and a global `setTimeout` both work on the device.                                                    | §3.1, §3.1.1                       |
| `crypto-js` is fine: pure ES5, and `new Function('return this')` is the permitted exception | Source      | `new Function('return this')` is not `globalThis` on the device, and the UMD wrapper broke under Zeus's CommonJS interop anyway: `cannot read property 'WordArray' of undefined`.   | §3.1.1, §3.10                      |
| Zeus lowers npm dependencies                                                                | Toolchain   | It does not. `@noble/hashes` used `\|\|=`, and the device gave a bare `SyntaxError` naming no file. `bundle: true` and `bin/check-engine.mjs` since.                                | §3.10, ADR-0006 amendment          |
| Any emitted bundle is fine                                                                  | Toolchain   | A bundle with no `import` or `export` left gets CommonJS-wrapped, and the wrapper throws on the device. `src/app.ts` keeps a side-effect import for that reason alone.              | ADR-0006 amendment                 |
| SHA-512 comes free with the hash library                                                    | Source      | `@noble/hashes` builds its SHA-512 constants with `BigInt`, which this QuickJS lacks: `TypeError: not a function` at module load. Dropped, then rewritten by hand in 32-bit halves. | §3.10, §3.16, ADR-0007             |
| Laptop QuickJS timings predict the watch                                                    | Habit       | SHA-512 was 6× SHA-256 on the laptop and 28× on the watch, call overhead being the difference. Inlining helped 1.5× here and 2.1× there.                                            | §3.17                              |
| The launch stall is the hashing                                                             | Observation | The diagnostic trail added to time the hashes did 3–6 s of hashing itself; the stall "was mostly the measurement". Trail removed twice.                                             | §3.15, §3.17, `02abd59`, `b873795` |
| Empty the build directory by deleting and recreating it                                     | Habit       | Zeus runs from inside it; a shell or bridge holding the deleted inode then fails every command with `ENOENT: uv_cwd`. Clear the contents, keep the directory.                       | `a90ba10`                          |
| A locally built `.zab` is the release artifact                                              | Habit       | `qjsc` stamps the absolute build path, user name included, into every page. Release the CI artifact.                                                                                | RELEASING.md                       |

## Installing on the watch

| Believed                                                           | Source | Actually                                                                                                                                                                                                 | Recorded     |
| ------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Same email on the phone and in `zeus login` means the same account | Guess  | The phone used Google SSO; `zeus login` has no SSO, and registering with the same email created a second account. Nothing connects the two, and the error says `No connectable online App or Simulator`. | §3.9         |
| Any unused `appId` will do for development                         | Guess  | `1000001` belongs to someone. The watch answered `Failed to unzip package` and `Install lite app result: failed`, neither naming the field. Found by bisecting against the stock template.               | §3.9         |
| The icon size caused the failed installs                           | Guess  | It was the only defect the build flagged, and it was harmless. The two problems above were the cause.                                                                                                    | §3.9         |
| A rebuilt `.zab` carries the current translations                  | Guess  | A long-running `zeus bridge` installs new code with the catalogs it read at start. Restart the bridge before every install.                                                                              | §3.14, §3.15 |

## Transport and Sync

| Believed                                                           | Source    | Actually                                                                                                                                                                                                                        | Recorded                         |
| ------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Sync needs manual chunking and serialization; friction "Medium"    | Prose     | ZML chunks, orders and length-checks, and JSON-serializes. One message per Sync; the estimate dropped from 6 h to 4 h.                                                                                                          | §3.2, ADR-0002                   |
| Sync is phone-initiated, pushed on connect like Fitbit's companion | Habit     | ZML gives the Side Service no connection event, and a settings-change launch fires only on writes. With Tokens in memory nothing would ever Sync a freshly opened watch. The watch pulls on launch; the phone pushes on change. | ADR-0002 amendment               |
| A failed push should show a Toast on the phone                     | Reasoning | Pushing to a closed watch app is normal, and `call` gives no reliable failure signal. Only the launch pull can fail visibly, on the watch.                                                                                      | ADR-0003 amendment               |
| Retry a failed pull on `onResume`                                  | Guess     | With Bluetooth off: 30 failed pulls in a minute and a black screen, each failure pausing and resuming the page. Retry on tap only.                                                                                              | ADR-0003 "Corrected on hardware" |
| `request()` rejects on failure and its `timeout` fires             | Source    | The handshake throws synchronously outside its own `try`; a pull sent right after Bluetooth returned neither resolved nor rejected for 45 s. The page races its own 10 s timer.                                                 | §3.11, §3.12, §3.14              |
| The Side Service stays up while Bluetooth reconnects               | Source    | The Zepp app closes it right after `bleConnected`, so nothing the page sent reached the phone until ZML's transport was closed and re-opened. That alone recovers; the "re-open the app" fallback is unnecessary.               | §3.15                            |
| The drift stamp lives in the start message                         | Design    | There is no start message. It rides the single Sync message, stamped when the payload is built, so the Side Service's launch time does not count as transit.                                                                    | ADR-0002 amendment               |
| The watch can take the Sync payload as typed                       | Habit     | Only our own Side Service sends it, but the phone checks the Sync Stats coming the other way. The watch now checks the shape and ignores a malformed message.                                                                   | `916022b`                        |

## The watch UI

| Believed                                                                   | Source  | Actually                                                                                                                                                                                                                      | Recorded                                 |
| -------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `SCROLL_LIST` rows take `TEXT`/`ARC` children; then: two child arrays only | Prose   | The typings declare five arrays, `fill_view` among them, and `fill_view` renders. Wrong twice.                                                                                                                                | §3.5, ADR-0005                           |
| `fill_view` bound to row data is a native progress bar                     | Typings | The data key binds the fill _color_, not the geometry. `bar: 50` drew navy, `0x000032`. The pre-rendered arc frames stay.                                                                                                     | §3.5.1, ADR-0005 "Confirmed on hardware" |
| Whether per-row patching exists is unknowable from the docs                | Prose   | `prop.UPDATE_ITEM` is 66 and patches one row; `UPDATE_DATA` redraws everything and scrolls to the top on every tick. `prop` has 88 entries the typings omit.                                                                  | §3.5.1, §3.8                             |
| `Object.keys(prop)` lists the runtime's props                              | Guess   | It returns `[]`; `getOwnPropertyNames` is needed. An earlier probe revision "produced a confident false negative".                                                                                                            | §3.5.1                                   |
| A Sync can always re-supply the whole list                                 | Habit   | `UPDATE_DATA` jumps to the top. Syncs that keep the row count patch rows too.                                                                                                                                                 | §3.11                                    |
| Re-creating the list with a new `item_config` re-colors it                 | Guess   | New arcs, old text colors. A scheme change re-launches the page, and that looped until the enlarged view stopped counting as a change on the first Sync.                                                                      | §3.12, §3.14                             |
| `LIST_TOP` restores the scroll position after the Token page returns       | Typings | The list comes back at the top. Whether the page was re-created or the property ignored was never told apart. Code removed.                                                                                                   | §3.16                                    |
| Fitbit's tile pool and Code cache were JerryScript-era economies to relax  | Habit   | One HMAC per Token per tick gave a 2973 ms tick with 11 Tokens. The cache came back, then computing ahead at random still stacked HMACs (1331 ms), then one Token per tick, then hand-written hashes 24× faster than noble's. | §3.11–§3.17, ADR-0005 amendment          |
| A tick over 250 ms means the arc frames are too slow                       | Design  | The trigger fired, and the frames were innocent: each `UPDATE_ITEM` took 11–13 ms. A text countdown would cost the same updates. `ARC_FALLBACK` stays `false`.                                                                | ADR-0005 amendment                       |
| 30 arc frames per scheme suffice                                           | Design  | A 60 s Token stepped every 2 s beside 30 s Tokens. 60 frames; the `.zab` grew from 1.57 to 2.44 MB.                                                                                                                           | ADR-0005 amendment                       |
| The page stays up                                                          | Habit   | Screen off after 10 s, Mini Program gone 10 s later, before a Code could be typed. 60 s on the list, 90 s on the full-screen Token.                                                                                           | `213ff1c`, `7a6f9d8`                     |
| A text band at the top fits                                                | Habit   | At y≈30 the 466 px circle is about 228 px wide. The clock-sync message became a system toast.                                                                                                                                 | §3.11                                    |
| Text and color can be set through `prop.MORE` on a `TEXT` widget           | Typings | Nothing showed. Color at creation, text through `prop.TEXT`.                                                                                                                                                                  | `40c8bb7`                                |
| The secondary, darkened color is readable                                  | Design  | Too dim on the watch. Primary color and larger text for names and the status.                                                                                                                                                 | `e32bf7d`, `9d591a8`                     |
| The full-screen Token can follow its Token by Secret                       | Design  | Every test Token shared one Secret, so move and delete showed the wrong one. Issuer and Label instead; one device session that laptop test data would have saved.                                                             | §3.16                                    |
| The square Fitbit icon will do                                             | Habit   | Out of place on a round watch and outside Zepp's icon spec. Redrawn as a ring on a plate, twice.                                                                                                                              | `6876833`, `80d9527`, `3b49e82`          |

## The Settings App

| Believed                                                                   | Source         | Actually                                                                                                                                                                                                          | Recorded            |
| -------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| The Settings App is a rewrite, 11 h                                        | Guess          | Component by component, only the Token list is one. 7 h.                                                                                                                                                          | §3.6                |
| `Section`, `Text`, `Toggle` port 1:1 from the docs                         | Prose          | Four probe versions written from the docs rendered blank. The shipped `todo-list` template rendered; copying its shape was the method that should have come first.                                                | §3.6.1              |
| `build()` may write settings storage                                       | Habit          | Every write re-runs `build()`: 26 rebuilds in one burst. Every write also launches the Side Service.                                                                                                              | §3.6.1              |
| A rebuild resets the scroll position, so keep a single-editor fallback     | Guess          | Scroll and typed values survive a rebuild of a 30-row page. Fallback dropped.                                                                                                                                     | §3.6.1              |
| The Settings App has no log channel on hardware                            | Observation    | `zeus bridge` logs every settings write with old and new value, so a settings key doubles as a log.                                                                                                               | §3.6.1              |
| The Settings App runtime is browser-like                                   | Habit          | No `URL` API, so the key-URI parser threw on every paste; `base32-decode` fails there too, cause unknown. Hand-split parser and an alphabet check instead.                                                        | §3.6.1              |
| The phone side has no i18n API; budget +2 h for a `.po` compiler           | Search summary | `import { gettext } from "i18n"` is in the CLI's own template, byte-identical to Fitbit. Wrong twice; the first "Low" rating was right.                                                                           | §3.7                |
| zpm injects an `en-US` fallback for unknown locales                        | Source         | A `de-CH` phone showed raw msgids. The compile step copies `de-DE.po` to `de-CH.po`.                                                                                                                              | §3.7                |
| A removed settings key reads back as `undefined`                           | Typings        | It reads back as `null`, and `Number(null)` is 0: the first Token showed its delete confirmation forever.                                                                                                         | §3.11               |
| Removing a `TextInput`'s key clears the field                              | Habit          | A field resets only when its value changes; `""` to `""` kept the pasted URI, Secret included. Set-then-remove in one handler rendered only the final value, so the first fix never worked. Removal waits 300 ms. | §3.11, §3.14, §3.15 |
| `Section`'s `title` renders a heading; `Select`'s `title` titles its popup | Prose          | Both render as plain body text above the label. Own bold headings; titles dropped.                                                                                                                                | §3.12, `1ba28be`    |
| Components lay out on first view as on rebuild                             | Prose          | The first render ignores some props: an empty `Select`, a stacked button row, two `Select`s running their labels together. A `View` apiece.                                                                       | §3.12, §3.15        |
| Base32 validation catches a mistyped Secret                                | Habit          | Base32 has no checksum. A truncated Secret is a valid, different Secret; only characters outside the alphabet are refused. The manual says so.                                                                    | Manual              |

## Storage

| Believed                                                     | Source | Actually                                                                                                                                                                                                         | Recorded                 |
| ------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| The watch persists app Settings in `localStorage`            | Design | Reinstalling over the bridge wipes `localStorage`. Settings ride the Sync payload. Then partly reversed: the waiting screen flipped color before every first Sync, so the last color scheme is stored after all. | ADR-0004, two amendments |
| Local file import ships after parity; Bulk Import is Phase 5 | Plan   | Export files and QR screenshots leave Secrets unencrypted in phone storage and cloud photo libraries. Dropped; only encrypted exports remain a possibility.                                                      | ADR-0001 amendment, §10  |
| "The phone is the safer place" needs no footnote             | Prose  | It assumes `settingsStorage` is phone-local, which the docs describe and do not promise. One weak check so far.                                                                                                  | ADR-0004 amendment       |
| The watch's caches follow the Token set                      | Design | Prepared HMAC keys and cached Codes were keyed by Secret and never evicted; a deleted Token's key material stayed until exit.                                                                                    | ADR-0004 amendment       |

## Estimate and market

| Believed                                                               | Source   | Actually                                                                                                                                                                        | Recorded     |
| ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| QR enrollment is impossible without a picker or camera                 | Prose    | ZML's Side Service receives files, and `@nuintun/qrcode`'s decoder is DOM-free. Conflating hosting with QR is what made it look impossible.                                     | §4.2, README |
| A first-party Zepp authenticator exists, with privileged camera access | Press    | Five store listings, all third-party, publishers and dates shown. Two inferences had been built on the gap.                                                                     | §7.1         |
| Six GitHub repos are the field                                         | Guess    | Three of five store listings have no repo. The inspectable field was counted, not the competitive one.                                                                          | §7.1, §7.4   |
| 45–60 h                                                                | Estimate | About 15.7 h. The spike ran 1.5× over, all of it hardware friction; the build phases ran about 6× under. Building is cheaper than estimated; hardware friction is the variable. | §5           |
| The account problems cost 4 h                                          | Memory   | About 0.5 h, once the notes were checked against the log.                                                                                                                       | §5           |

## What the table says

- **Prose lost most often.** Of the sources above, the documentation is wrong or
  incomplete more often than the typings, and the typings more often than the
  library source. The runtime was never wrong, only expensive to ask.
- **Fitbit habits cost device sessions.** Assumptions carried over unexamined —
  the page stays up, the runtime is a browser, clearing a key clears a field,
  the companion pushes on connect — each took a hardware round-trip to
  dislodge. Reading the original before porting was the right rule
  (§3.1 bullet 4); reading it as a list of things to _verify_ rather than to
  relax would have been better.
- **Being wrong twice is the norm, not the exception.** `SCROLL_LIST` children,
  phone-side i18n, the URI field clearing, the hash library, the Settings
  persistence: each needed two corrections, because the first correction was
  made from the next-most-convenient account of the platform rather than the
  device.
- **Test data is part of the method.** Shared Secrets hid a bug; a diagnostic
  that hashed for six seconds measured itself. Both cost a device session.
- **The tooling gaps were cheap to close once named.** `check:engine`, the
  bridge restart rule, `bundle: true` and the neutral build path each turned
  a repeated hardware surprise into a laptop check.

---

← Previous: [11. Decisions and remaining questions](./11-decisions.md)\
Next: [Sources](./sources.md) →
