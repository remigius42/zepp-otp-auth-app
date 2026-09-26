<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage jsQR getUserMedia Lisoveliy ZoLArk manujedi typedarrays -->

# Porting analysis: `fitbit-otp-auth-app` → Amazfit Active 2 (round) / Zepp OS

Date: 2026-09-08 · Analyzed commit: `0e63cc5` (v1.0.1)

## 1. Verdict

**Yes, portable — but it is a rewrite of the presentation and transport layers, not a port.**
Roughly a third of the production code (the interesting third: TOTP, key URI
parsing, validation, formatting) moves over nearly unchanged. Everything that
touches `document`/SVG views, `peerSocket`, `fs`/CBOR, and the Fitbit settings
components has to be rebuilt against Zepp OS APIs.

**QR Enrollment survives — as a file import, not a picker.** Zepp OS has no
`ImagePicker` equivalent and the watch has no camera, but a mini program _can_
receive a file: ZML's Side Service exposes an `inputFile` event alongside
`readFile`, and a shipped store app uses it. The decoder ports too —
`@nuintun/qrcode`'s `Decoder.decode()` is DOM-free; only its ~25-line `scan()`
wrapper is browser-bound (§4.2).

What is genuinely lost is the _one-tap picker_, itself an abuse of Fitbit's
clock-face `ImagePicker`. The replacement is: pick a file → decode locally →
done. Nothing leaves the phone, so §4.4's trust objections — which are about
_hosting_ a scanner, not about QR — do not apply.

Estimated effort: **45–60 h** for feature parity (§5), with Enrollment shipping
as manual key entry plus `otpauth://` URI paste. File-based import is **not** in
that number: text-format import is ~3–4 h (§4.3 option E) and image QR decode a
further ~4–6 h (option F), both scheduled after parity.

## 2. What the current app is made of

| Layer                              | Files                                                                      | LOC (prod)   | Fate                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| TOTP core                          | `app/totp.ts`, `app/base16codec.ts`                                        | ~160         | **Reuse ~verbatim**                                                                                                |
| Key URI / token model / validation | `companion/keyUri.ts`, `common/*`, `companion/tokens.ts` (validation half) | ~200         | **Reuse, minus settings I/O**                                                                                      |
| Token state & persistence          | `app/TokenManager.ts`, `app/SettingsManager.ts`                            | ~350         | Reuse structure; **Token persistence dropped** (ADR-0004), settings persistence swaps `fs`+CBOR for `localStorage` |
| Device UI                          | `app/ui/*`, `resources/*.view`, `resources/styles.css`, `widget.defs`      | ~250 + views | **Rewrite**                                                                                                        |
| Peer messaging                     | `common/PeerMessage.ts`, `companion/peerMessaging.ts`, `app/app.ts`        | ~180         | Rewrite transport, keep protocol                                                                                   |
| Settings page                      | `settings/*.tsx`, `companion/ui/*`                                         | ~350         | **Rewrite** (similar shape, different components)                                                                  |
| Companion glue                     | `companion/companion.ts`, `companion/settings.ts`                          | ~150         | Rewrite as Side Service                                                                                            |
| Tests                              | `**/__tests__`                                                             | ~3 700       | Pure-logic tests reusable; UI tests lost                                                                           |

Notable Fitbit-specific constructs with no direct counterpart:

- `VirtualTileList` + `widget.defs` symbol pool + `configureTile` delegate
- SVG `.view` files and a CSS file driving the six color schemes by class name
- `ImagePicker` and `AdditiveList` settings components
- `fs.readFileSync(path, "cbor")` — CBOR (de)serialization for free
- `clock.ontick` with `granularity = "seconds"`

## 3. Target platform mapping (Zepp OS)

Amazfit Active 2 (round) is a first-class Zepp OS Mini Program target; the round
model is a 1.32″ round AMOLED (`page/round/...` layout path) and has shipped
Zepp OS 4 and, more recently, Zepp OS 5. Distribution is via the Zepp Mini App
store (curated review) or developer mode + QR sideload for private use.

| Fitbit SDK                                                               | Zepp OS equivalent                                                                                                                                                                        | Friction                                                                                                                                                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App (device) JS + SVG views                                              | Device App, `@zos/ui` `createWidget()` — **no SVG, no CSS, no DOM**                                                                                                                       | High: all layout becomes imperative widget construction with absolute coordinates                                                                                                                   |
| `VirtualTileList`                                                        | `widget.SCROLL_LIST` with `data_type_config` / `item_click_func`                                                                                                                          | **High, revised up** — see §3.5. `SCROLL_LIST` items support `text_view` and `image_view` children **only; there is no arc child**, so the per-row progress arc has no direct equivalent            |
| `clock.ontick`                                                           | `setInterval(…, 1000)` + page `onResume`/`onHide` lifecycle                                                                                                                               | Low                                                                                                                                                                                                 |
| `fs` + `"cbor"`                                                          | `@zos/storage` `localStorage` (§3.4)                                                                                                                                                      | Low, but **no CBOR** → use JSON. Only settings are persisted                                                                                                                                        |
| `messaging.peerSocket`                                                   | `@zeppos/zml` `call`/`onCall` (API level ≥ 3.6 since ZML 0.0.28); `@zos/ble` as the fallback                                                                                              | **Low** — ZML chunks and serializes for you (§3.2), so the start/token/end fragmentation protocol is no longer needed for size. Was rated Medium before reading ZML's source                        |
| Companion                                                                | Side Service (runs in Zepp app, `fetch` available, no UI)                                                                                                                                 | Low conceptually                                                                                                                                                                                    |
| `settingsStorage` + `change` listener                                    | Settings App `props.settingsStorage` + Side Service Settings API, same key/value + change-listener model                                                                                  | Low                                                                                                                                                                                                 |
| Settings page JSX (`Section`, `TextInput`, `Toggle`, `Select`, `Button`) | Zepp Settings App JSX-ish `RenderFunc` components: `Section`, `TextInput`, `Toggle`, `Select`, `Slider`, `Button`, `Link`, `Text`, `Image`, `TextImageRow`, `Toast`, `View`, `Auth/OAUTH` | Medium: comparable, but **no `AdditiveList`** and **no `ImagePicker`**                                                                                                                              |
| `.po` i18n via `gettext`                                                 | `@zos/i18n` `getText` on the device; `gettext` from `'i18n'` on the Settings App and Side Service — **the same import this repo already uses**                                            | Low (§3.7) — six `.po` files move to three renamed directories                                                                                                                                      |
| Color schemes via CSS classes                                            | Per-widget color props set in JS                                                                                                                                                          | Medium: needs a small theming helper applied at widget creation. **Reduced from six schemes to three** (§3.3), and `ColorSelect` has no Zepp counterpart — the swatch grid becomes a plain `Select` |
| `crypto-js`, `base32-decode`                                             | Plain npm deps, bundled by the Zeus CLI                                                                                                                                                   | Low — existing Zepp TOTP apps prove HMAC-SHA1/256/512 in JS works on-watch                                                                                                                          |

### 3.0 Project layout

From the Zeus CLI's bundled `os4.0/app` template (read out of
`@zeppos/zeus-cli` rather than by running the interactive `zeus create`):

| Path                             | Role                                                                    | Comes from                    |
| -------------------------------- | ----------------------------------------------------------------------- | ----------------------------- |
| `app.js`                         | app lifecycle (`App({ onCreate, onDestroy })`)                          | —                             |
| `page/index.js`                  | device page (`Page({ build() })`)                                       | `app/ui/*`                    |
| `page/index.[r\|s\|b].layout.js` | **per-platform layout constants**                                       | `resources/*.view`            |
| `page/i18n/*.po`                 | device strings                                                          | `app/i18n/*.po`               |
| `app-side/index.js`              | Side Service (`AppSideService({ onInit, onRun, onDestroy })`)           | `companion/*`                 |
| `app-side/i18n/*.po`             | Side Service strings                                                    | `companion/i18n/*.po`         |
| `setting/index.js`               | Settings App (`AppSettingsPage({ build() })`)                           | `settings/*`                  |
| `setting/i18n/*.po`              | Settings App strings                                                    | `settings/i18n/*.po`          |
| `assets/default.[r\|s\|b]/`      | per-platform images                                                     | `resources/icon.png`          |
| `app.json`                       | manifest: `appId`, permissions, `runtime.apiVersion`, `targets`, `i18n` | `package.json` `fitbit` block |

**Layout is a first-class platform idiom, not something to hand-roll.** The
device page imports
`import * as Styles from 'zosLoader:./index.[pf].layout.js'`, where `[pf]` is
substituted per platform at build time, and coordinates are written with `px()`
from `@zos/utils`. That is a better answer than §11 Q2's "centralize the
constants ourselves": adding a second screen geometry later means adding one
`*.layout.js` file, with no change to page code. The single-target decision
stands, but the mechanism for widening it is already provided.

**`targets.platforms` is a design width, not a device filter [build].** A single
`{ st: "r", dw: 466 }` entry produced **six** per-device `.zpk` builds inside one
`.zab` — 360×360, 416×416, 454×454, 466×466 and two 480×480 (NXP and ZPS
silicon). `st` selects the screen _type_ and `dw` sets the design width that
`px()` scales from; it does not restrict which devices are built.

This retires §11 Q2 as a question for round screens: **there is no "one device
versus a family" trade-off to make** — targeting round gets them all, scaled
automatically, and that is why §8.1's "first layout is nearly free reach for five
devices" understated it. What remains a genuine second layout is the square
class (`st: "s"`), which needs its own `index.s.layout.js`.

### 3.1 On-device JavaScript runtime

The two platforms differ in engine and language level, and this is visible in
the current source: several constructs exist purely to appease Fitbit's engine.

|                | Fitbit OS                                                                                                | Zepp OS                                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine         | **JerryScript** — interpreter, no JIT; descended from Pebble's Rocky.js bindings                         | **QuickJS — confirmed [build].** `@zeppos/zpm` ships `qjsc` bytecode-compiler binaries for four host platforms and runs them over every emitted file; this was previously recorded as community inference |
| Language level | Build emits a **single ES5.1 bundle** per target (TS → rollup)                                           | **ES2020 [build]** — `zpm` configures `rollup-plugin-esbuild` with `target: "ES2020"` for the device bundle, which is more specific than the docs' "ES6 supported"                                        |
| Dynamic code   | Allowed                                                                                                  | **`eval` and `new Function` prohibited**, with one carve-out: `new Function('return this')` — evidently present so bundled npm libs can locate the global object                                          |
| Timers         | `setTimeout`, `clock.ontick` with `granularity`                                                          | `setTimeout` / `setInterval` (since 2.x, replacing the 1.0 timer widget), plus `@zos/timer` `createSysTimer` for service / screen-off timing                                                              |
| Memory model   | JerryScript's compressed 16-bit pointers → 512 KB heap ceiling, ~64K live objects; per-app budgets tight | Roomier, still embedded-constrained                                                                                                                                                                       |

**Documented ambiguity — resolved from ZML's source, 2026-09-09.** The Zepp OS
JavaScript-support page lists **`Promise`, generator functions and timers as
unsupported**, and it is tagged **v3+**, so the "stale from Zepp OS 1.0" theory
in an earlier draft of this report was wrong. The page describes the bare
engine; the framework layer supplies the rest. `@zeppos/zml` 0.0.41 makes this
explicit by shipping per-platform shims selected by rollup aliases at build time
(`rollup.config.mjs`):

| Shim            | 1.0 / 2.0 build                                                 | 3.0+ device build                                                                  |
| --------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `promise.js`    | `promise-2.0.js` → `globalThis.Promise = es6Promise` (polyfill) | `promise-3.0.js` → `export const Promise = globalThis.Promise` (pass-through)      |
| `setTimeout.js` | `device-setTimeout-2.0.js`                                      | `device-setTimeout-3.0.js` → re-exports `@zos/timer`'s `setTimeout`/`clearTimeout` |

So on an API 3.0+ device build **ZML assumes a native `globalThis.Promise` and
would break outright if there weren't one** — strong evidence that Promises are
present on Active 2 (API 4.x), though not proof. Downgraded from spike blocker
to a one-line sanity check. Timers are real but route through `@zos/timer`
rather than a global `setTimeout`, which is worth knowing before writing the
countdown tick. `app/ui/index.ts`'s device-side `async`/`await` is therefore not
at risk — and §3.1 already notes it mostly evaporates anyway, since Zepp
navigation is synchronous.

Consequences for the port:

- **Some ES5 workarounds become unnecessary.** `padStartWithZeros` in
  `app/totp.ts`, and the "`Map` … is not available" comment driving
  `TokenPasswordCache`'s nested `Record<string, Record<string, Record<number,
string>>>`, exist only for JerryScript. Recommendation: port them unchanged
  first — the existing tests come along for free — then simplify deliberately as
  a separate step.
- **The device-side `async` code largely evaporates.** Zepp navigation (`push`)
  is synchronous, so `await document.location.replace(...)` in
  `app/ui/index.ts` has nothing to await. This sidesteps the `Promise` question
  for the UI layer however it resolves.
- **`crypto-js` should be fine**: pure ES5, and the one construct bundled libs
  typically need — `new Function('return this')` — is the explicitly permitted
  exception.
- **Fitbit's memory ceiling explains choices that can be relaxed.** The
  15-element tile pool in `resources/tokens.view` and trimming the password
  cache to two entries per token (`keepTwoCachedPasswordsByToken`) were
  JerryScript-era economies; `SCROLL_LIST` does its own recycling.

### 3.2 Transport: `@zeppos/zml` vs. `@zos/ble` — settled from source

Read from `zepp-health/zml` at version **0.0.41** on 2026-09-09, plus the
official API pages. The prose docs answer almost none of this; the source
answers all of it.

**What the transport has to provide**, derived from `companion/peerMessaging.ts`
and `app/app.ts`: `open`/`close` connection events (they drive both the
send-on-connect trigger _and_ the settings-page connection indicator);
fire-and-forget send of a structured object; unidirectional push, phone →
watch, always phone-initiated; a `readyState` guard. Not required:
request/response, watch-initiated calls, `fetch` proxying, file transfer.

|                                  | `@zos/ble`                                                                              | `@zeppos/zml` 0.0.41                                                                                                                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Level                            | platform primitive                                                                      | Zepp-maintained wrapper over the Messaging API                                                                                                                                                                                 |
| Push side-service → device       | Messaging API `peerSocket.send(buffer)`                                                 | `this.call({ method, params })` → device `onCall(data)` — exactly this app's shape                                                                                                                                             |
| Payload type                     | **binary only** — "developers need to convert the data structure themselves" **[docs]** | plain objects; ZML does `JSON.stringify`/`parse` in `src/shared/data.js`                                                                                                                                                       |
| Chunking                         | **yours**                                                                               | **handled.** `MESSAGE_SIZE = 3600`, `MESSAGE_HEADER = 16`, `HM_MESSAGE_PROTO_HEADER = 66` → ~3 518 B usable per chunk; splits, tags each chunk with a `seqId`, sorts on receipt, validates total length and throws on mismatch |
| Out-of-order delivery            | yours                                                                                   | handled by the `seqId` sort                                                                                                                                                                                                    |
| Connection state, device side    | `connectStatus()`, `addListener`/`removeListener`                                       | `onBleChanged(cb)` / `offOnBleChanged(cb)`                                                                                                                                                                                     |
| Connection state, **phone side** | —                                                                                       | **absent** — see below                                                                                                                                                                                                         |
| Settings storage + change events | —                                                                                       | `settingsLib` (`getItem`/`setItem`/`removeItem`/`clear`/`getAll`) and `onSettingsChange({key, newValue, oldValue})` on `base-side` — a direct analogue of Fitbit's `settingsStorage` + `change` listener                       |
| API_LEVEL floor                  | ~2.0                                                                                    | 3.0 for the library; **3.6 since 0.0.28**. Moot on a 4.x target                                                                                                                                                                |

**Recommendation: ZML.** It removes the two things the analysis had costed as
risk — manual chunking and manual serialization — and its `call`/`onCall` pair
is precisely the unidirectional push this app needs. ZML's headline feature
(device-side `httpRequest` proxied through the phone) is the opposite direction
and simply goes unused.

**Two consequences that change the plan:**

1. **The per-token fragmentation protocol is no longer load-bearing.** It exists
   because Fitbit's `peerSocket` capped messages at ~1 KB. ZML reassembles up to
   arbitrary length with sequencing and length validation, so the whole token
   array fits one `call`. Keep `common/PeerMessage.ts` as the application
   protocol — it is the seam that keeps the transport swappable — but the
   start/token/end split, the `count` and the `index` become redundancy layered
   on a transport that already guarantees ordering and completeness. Decide
   deliberately rather than porting it out of habit.
2. **Phone-side connection status has no equivalent — a new parity gap.**
   `onBleChanged` is device-side only: it lives in the `DeviceApp` message
   builder (`src/core/common/message.js`) and is wired up by the device app and
   page plugins. `zml.d.ts`'s `base-side` interface exposes `call`, `onCall`,
   `onRequest`, `onSettingsChange` and `settingsLib` — **no BLE-state
   callback**, and the Side Service Messaging API documents none either. So
   `settings/ConnectionStatus.tsx`, which today renders in every settings
   section, cannot be reproduced as-is. Options: drop it, infer staleness from a
   device-side heartbeat written back into settings storage, or show the
   indicator on the watch instead of the phone. Not costed in §5.

### 3.3 Color schemes reduced to three

Six schemes ship today; three of them (`fb-aqua`, `fb-mint`, `fb-pink`) are
Fitbit's brand palette and have no reason to exist on an Amazfit device. The
Zepp app keeps:

| Scheme                      | Primary             | Secondary            | Background |
| --------------------------- | ------------------- | -------------------- | ---------- |
| **binary poetry** (default) | `#ffd502` CRT amber | `#704d00`            | black      |
| **white**                   | `#ffffff`           | `#555555` dark grey  | black      |
| **black**                   | `#000000`           | `#999999` light grey | white      |

`common/ColorSchemes.ts` ports directly with the three Fitbit entries deleted.
This also softens the loss of `ColorSelect`: a three-item `Select` reads fine as
a dropdown, where six colors really wanted a swatch grid.

### 3.4 Persistence: settings only

Per ADR-0004 the watch does **not** persist Tokens — they live in memory and a
Sync happens on every connection. What still needs persisting on-device is the
app's own settings (color scheme, enlarged view), for which `@zos/storage`
`localStorage` is the right fit: key-value JSON, kept in memory for repeated
reads, one `device:os.local_storage` permission line in `app.json`. `@zos/fs` is
unnecessary once there is no Token blob to write.

Worth recording, since it is the reason Tokens are not stored: Zepp's documented
storage model is **isolation plus permissions, not encryption at rest**. Each
Mini Program gets its own `/data` root isolated from other Mini Programs, and
nothing in the documentation claims at-rest crypto. That is the same posture
Fitbit had — so persisting would not have been a regression, merely no better.

### 3.5 The per-row progress arc has no `SCROLL_LIST` equivalent

An earlier draft of this report said `SCROLL_LIST` items take "text/arc children
via `TEXT`/`ARC` widgets". **That was wrong.** There is no arc child and no way
to nest an arbitrary widget inside a row.

**Corrected again, from the typings [types], 2026-09-09.** "Two child arrays,
`text_view` and `image_view`" was also wrong, and understated what rows can do.
`ScrollListItemConfigOptions` in `@zeppos/device-types` 4.0 declares **five**
child arrays: `text_view`, `image_view`, **`fill_view`** (with `radius` and
`alpha`), plus `layout_view` and `layout_config`. Each still binds to a data
property by `key`.

`fill_view` matters. A filled, rounded rectangle per row, bound to row data, is
a native per-row progress **bar** — which is option (c) below without the
font-glyph gamble, and it would retire ADR-0005's pre-rendered arc frames
entirely. Whether its geometry is actually data-drivable rather than fixed in
`item_config` is not answerable from a type declaration, so it goes to the
spike; see `docs/spike-probes.md`.

This matters because the current design mutates a real arc per row every second:
`app/ui/tokens.ts` sets `startAngle`/`sweepAngle` on a per-tile `ArcElement`
from the elapsed fraction of that Token's Period. Options, none free:

|       | Approach                                                                                                          | Cost                       | Notes                                                                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **a** | `image_view` cycling pre-rendered arc frames                                                                      | asset script + bundle size | Visually identical to today. ~30 frames per color scheme; no runtime tinting, so frames multiply by scheme                 |
| **b** | Text countdown (`23s`) in the row                                                                                 | trivial                    | Honest and legible; loses the at-a-glance analog read                                                                      |
| **c** | Block-glyph progress bar in a `text_view`                                                                         | trivial                    | Depends on font glyph coverage — verify before committing                                                                  |
| **d** | One global countdown instead of per-row                                                                           | trivial                    | **Wrong by construction** — Periods are per-Token (see `CONTEXT.md`), so a single countdown lies for any Token not on 30 s |
| **e** | Abandon `SCROLL_LIST`; hand-build the list from absolute-positioned `TEXT` + `ARC` widgets with our own recycling | large                      | Preserves the design exactly, but this is the 10 h line turning into something much bigger                                 |

**Decision: (a), with (b) as the fallback** — ADR-0005.

**Unresolved and pivotal: how to update one row.** The two documentation sources
disagree. The widget reference describes
`setProperty(prop.UPDATE_ITEM, { index, item_data })` — a per-row patch. Other
readings of the same docs show only `setProperty(prop.UPDATE_DATA, { …,
data_array })`, which re-supplies the whole dataset and, at 1 Hz, risks resetting
scroll position and focus while the user is scrolling. Which of these is real
decides the design: with `UPDATE_ITEM`, option (a) or (b) is comfortable; with
whole-array refresh only, the countdown may have to live outside the list
entirely, or (e) becomes serious. **Resolve this in the spike** — it is cheap on
hardware and expensive to discover halfway through the UI build.

**A third source now disagrees with both [types].** `@zeppos/device-types` 4.0's
`IHmUIPropertyType` lists neither `UPDATE_ITEM` **nor** `UPDATE_DATA` — it stops
at `MORE`, `TEXT`, `DATASET` and the geometry props. So the typings cannot
adjudicate either, and the question narrows to one only the device can answer:
which keys does the runtime's `prop` object actually carry? `page/probe/index`
logs them, settling §3.5 from a transcript rather than from a reading of the
docs.

### 3.6 Settings App: only the Token list is a rewrite

The Settings App was costed at 11 h on the assumption that it is a rewrite. Read
component by component, most of it is not:

| Component                 | Uses                                    | Fate                                                                       |
| ------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| `SectionIntroduction`     | `Section`, `Text`, `Link`               | **1:1**                                                                    |
| `SectionLicenses`         | `Section`, `Text`                       | **1:1**, plus retargeting `bin/generate_licenses_data.sh`                  |
| `ValidationMessage`       | `Text`                                  | **1:1**                                                                    |
| `SectionAddTokenManually` | `TextInput`, `Select`, `Button`, `Text` | **~1:1** — every control exists on Zepp                                    |
| `SectionSettings`         | `Toggle`, `Text`, `ColorSelect`         | 1:1 except the swatch grid, which becomes a `Select` of three names (§3.3) |
| `ConnectionStatus`        | —                                       | **deleted** (ADR-0003)                                                     |
| **`SectionTokens`**       | **`AdditiveList`**                      | **the only genuine rewrite**                                               |

The structural change is uniform and mechanical: Fitbit passes `settingsStorage`
down as a prop to each section, whereas Zepp uses `AppSettingsPage({ state,
build(props) })` with a single `build` lifecycle that re-runs whenever settings
storage changes. Same reactive model, different entry point. **Revised estimate:
7 h.**

**The Token list is built flat and in place:** per Token, a rename `TextInput`
and a row of `Button`s — `↑`, `↓`, `✕`. That is the direct analogue of today's
`AdditiveList` behavior, discoverable without introducing a mode, and the
simplest thing that works.

**Fallback, if a specific risk materializes:** a `Select` listing the Tokens plus
a single set of controls acting on the selection — constant size, controls never
move. The risk in question is that the settings page re-runs `build()` on _every_
settings-storage write, so tapping `↑` on the eighth Token rebuilds the whole
page. If that resets scroll position, reordering degrades into scroll-tap-hunt.
The fallback is immune because its controls sit at a fixed position.

**Spike item:** does a settings-page rebuild preserve scroll position? One
`Toggle` on a deliberately long page answers it in two minutes. This is the
phone-side twin of the `SCROLL_LIST` refresh question in §3.5.

### 3.7 i18n: same format on the watch, no mechanism on the phone

**On the device, this is a near-verbatim port.** Zepp uses `.po` files with the
same `msgid` / `msgstr` shape, placed in `page/i18n/${lang}.po` where `lang` is a
country-code key from Zepp's Multilingual Mapping table (`en-US.po`, `de-DE.po`
— the names this repo already uses). `getText('key')` from `@zos/i18n` resolves
against the device's system language, available since API_LEVEL 2.0.
`getLanguage()` from `@zos/settings` exposes the current language if needed.
Additionally, `app.json` carries its own `i18n` block for the Mini Program's
title in the app list — new, but a few lines.

**The phone side has i18n too, and it is byte-identical to Fitbit's.** The
official `os4.0/app` project template ships `setting/i18n/en-US.po` and
`app-side/i18n/en-US.po`, and both entry points open with
`import { gettext } from 'i18n'` — the same module specifier and the same
function name this repo already uses. The per-surface `.po` directory layout
also matches one-for-one:

| Fitbit                | Zepp                 | Import                                  | Strings |
| --------------------- | -------------------- | --------------------------------------- | ------- |
| `app/i18n/*.po`       | `page/i18n/*.po`     | `getText` from `@zos/i18n`              | ~5      |
| `companion/i18n/*.po` | `app-side/i18n/*.po` | `gettext` from `'i18n'` — **unchanged** | ~10     |
| `settings/i18n/*.po`  | `setting/i18n/*.po`  | `gettext` from `'i18n'` — **unchanged** | ~30     |

So the migration is: copy six `.po` files into three renamed directories, and
change `gettext(` to `getText(` in device code only. No build step, no
`gettext-parser`, no hand-rolled lookup. **Estimate stays at the original 3 h**,
and §3's original "Low — files largely reusable" rating was correct.

> **How this was gotten wrong twice.** An earlier revision of this section
> claimed the phone side had no i18n API and costed a `.po` → JS compiler at
> +2 h. That came from a search-engine summary asserting `@zos/i18n` is
> device-only and that "the common workaround is a plain JS key/value map" —
> which is true of `@zos/i18n` specifically and irrelevant, because the phone
> side uses a different module named `i18n`. The correction came from reading the
> CLI's bundled project template. Same lesson as §4.2, applied one section too
> late: **read the artifact, not the prose about it.**

**Behavioral difference worth knowing before it surprises someone:** on Zepp the
watch language and the phone language are set independently — the watch's is
under Zepp app → Profile → device → Watch settings → System Language, while the
Settings App follows the phone's locale. So the device UI and the settings UI can
legitimately end up in different languages. Fitbit did not have this split.

**Rejected: `@silver-zepp/polyglot`.** A third-party toolkit offering dynamic
language switching, an in-app language picker, and `.po` → Excel migration. It
solves problems this app does not have — two languages, no runtime switching
requirement — and would add a dependency plus an `.xlsx` authoring format in
place of `.po`. Worth remembering it exists if the language count ever grows.

### 3.8 Where `@zeppos/device-types` 4.0 is wrong

§6.2 notes the typings track API level 4 while the device may run Zepp OS 5, and
that gaps should be expected. Scaffolding Phase 1 turned that from a caveat into
a list, and the gaps are not all the "missing newer surface" kind — some
contradict the platform's own documentation and its own libraries. All read from
`dist/index.d.ts` at 4.0.0 [types]:

| Declaration                  | Gap                                                                                                                    | Consequence                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Page.Option`                | A closed interface of `state` / `onInit` / `build` / `onDestroy`. No `onResume`, no `onPause`, no index signature      | Registering a lifecycle hook is a type error, so the spike question has to be asked through a cast — `page/probe/index` |
| `@zos/timer`                 | Exports `createSysTimer` and `stopTimer` only — no `setTimeout` / `clearTimeout`, which is what ZML re-exports from it | The documented timer story and the shipped library disagree, and the typings side with neither                          |
| `@zos/storage` `getItem`     | Declared as returning `void`; it returns the stored value                                                              | Every read needs a cast                                                                                                 |
| `IHmUIPropertyType` (`prop`) | No `UPDATE_ITEM`, no `UPDATE_DATA`                                                                                     | §3.5 cannot be settled from the typings                                                                                 |
| `ScrollListFillViewOptions`  | No `color`, though `item_bg_color` is declared one level up                                                            | A colored `fill_view` is unrepresentable, so the probe builds its `SCROLL_LIST` through a cast                          |

None of these is fatal — each is one cast — but they are worth recording for two
reasons. The mechanical one: casts around undeclared surface should stay
annotated with _why_, or they read later as sloppiness rather than as evidence.
The substantive one: this is the same lesson as §3.2, §3.7 and §4.2, arriving
from a fourth direction. **Prose, typings, library source and runtime are four
different accounts of this platform, and only the last one is authoritative.**

### 3.9 Getting a build onto the watch, and the four hours it cost

Not a design question, but the first genuinely expensive surprise of the port,
and none of it is in the effort estimate. Recorded because the failures were
all misattributed at first, and because every message involved was actively
misleading.

**Three independent problems, presenting as one.**

1. **The Zeus CLI and the Zepp app must be the same _account_, not the same
   email address.** The phone was signed in with Google SSO; `zeus login` opens
   Zepp's universal login, which takes **email and password only — there is no
   third-party sign-in**. Registering a fresh account with the same address
   creates a different userID, and both `zeus preview` and `zeus bridge` pair by
   account. Zepp documents the workaround — bind an email to the SSO account,
   log out, use Forgot Password to set a password — but only on a page about the
   _Simulator_ (`guides/faq/third-party-login.md`), and nothing connects it to
   the CLI.
2. **`appId` must be one nobody else owns.** `1000001` was invented while
   scaffolding. The watch rejected every package carrying it. Zepp assigns
   appIds at registration and the 1000000+ block is where assigned IDs live — so
   that number is somebody's app. The template range (`20001`+) is free.
3. The app icon was below the documented minimum size. Harmless, but it was the
   only defect the build itself flagged, which made it the obvious suspect and
   cost a cycle.

**What the messages actually say.** The appId collision surfaces as
`Failed to unzip package` when installing from a preview QR, and as
`Install lite app result: failed` over the developer bridge. The account
mismatch surfaces as `No connectable online App or Simulator`. Not one of the
three names the field, the account or the file at fault.

**What worked: bisect against a stock template.** Building the Zeus
`hello-world` template unmodified and installing _that_ split the problem in one
step — it installed, so device, account and relay were fine and the fault was in
our package. Copying `build/zeus` to a scratch directory and patching one
manifest field per copy then isolated `appId` in a single round. Reading error
messages would never have got there.

**Two tools worth keeping.** `zeus bridge` beats the preview QR for iteration:
it pushes over the established connection instead of a CDN download, and it
streams device logs into the terminal. And the relay's client list can be read
directly by shimming the CLI's WebSocket — `{"type":"debug"}` is the phone,
`{"type":"development"}` is the CLI, and seeing both is the only reliable proof
that the accounts match.

### 3.10 `crypto-js` does not survive the bundler — the one wrong call that mattered

§3.1 concluded: "**`crypto-js` should be fine**: pure ES5, and the one construct
bundled libs typically need — `new Function('return this')` — is the explicitly
permitted exception." Both halves were wrong, and the second was wrong in a way
that made the first irrelevant.

**What the device says [device].** `new Function('return this')` does not throw,
but the object it returns is **not `globalThis`** — it has `Math`, so it is a
global-ish object, just not the one. And `crypto-js` fails regardless, for an
unrelated reason:

- Importing a submodule (`crypto-js/enc-hex`) yields an object with no `parse`
  method: `TypeError: not a function`.
- Importing the package root crashes the page outright:
  `TypeError: cannot read property 'WordArray' of undefined`, thrown from
  `requireLibTypedarrays` → `requireCryptoJs`.

**Why.** `crypto-js`'s UMD wrapper ends `}(this, function (CryptoJS) {…})`, so
its `root` comes from module-scope `this` — `undefined` under ESM. The Zeus
bundler's CommonJS interop then initializes `lib-typedarrays` before `core` has
finished, and `C.lib` is undefined when the typed-array extension reads it. This
is a **packaging** failure, not an engine one: `base32-decode`'s default import
works on the same device in the same bundle, and the engine has `Map`, `Set`,
`Promise`, typed arrays and working timers.

**Resolution: `@noble/hashes` 2.4.0** — MIT, zero production dependencies, pure
ESM (`"type": "module"`), so there is no UMD wrapper for the interop to get wrong. Cure53-audited
at 1.0.0, though **SHA-1 is explicitly outside the audit scope**; HMAC and
SHA-256/512 are inside it, and HMAC-SHA1 is unaffected by SHA-1's collision
weaknesses. The swap is ~15 lines in `totp.ts` and **all 36 TOTP tests pass
unchanged**, RFC vectors included, across all three algorithms.

This also closes the open question TODO.md filed under "decide consciously
rather than inherit": `crypto-js` was the app's only cryptographic dependency,
inherited from `fitbit-otp-auth-app`, and officially discontinued. The platform
forced the decision earlier than planned and in the same direction.

**The lesson, again.** §3.1's judgement came from reading the library's source
and the platform's documentation and reasoning about them. Both readings were
locally correct and jointly useless, because the failure lives in the seam
between them — the bundler. Same conclusion as §3.2, §3.7, §4.2 and §3.8:
**only the device is authoritative.** This one cost the crypto core of the app
being non-functional on hardware while every test on the laptop stayed green.

## 4. The QR code workaround — the part that breaks

### 4.1 How it works today

`settings/SectionTokens.tsx` uses Fitbit's `ImagePicker` — a component whose
intended purpose is letting a user pick a photo for a clock face background:

```tsx
<ImagePicker
  settingsKey={NewTokenButton.addTokenViaQrTag}
  imageWidth={300}
  imageHeight={300}
/>
```

The picker writes `{"imageUri": "..."}` into settings storage. The companion
(`companion/companion.ts` → `companion/tokens.ts`) picks that up on the settings
`change` event and runs a pure-JS QR decoder over the URI:

```ts
const qrcode = new Decoder().setOptions({ canOverwriteImage: true })
const { data: otpUri } = await qrcode.scan(imageUri) // @nuintun/qrcode
const tokenConfig = totpConfigFromUri(otpUri)
```

The abuse is threefold: an image-for-decoration component is used as a data
input channel; the phone's own downscaling (`imageWidth`/`imageHeight`) is used
as preprocessing for the decoder; and the companion runtime is relied upon to
provide enough of a browser-ish environment for `@nuintun/qrcode` to rasterize
the image. Your own code comment already documents how fragile that is —
"increasing above 400 lead to unusable recognition rates and beyond 600 might
crash the Companion app."

### 4.2 What survives on Zepp OS, and what doesn't

**The one-tap picker does not survive.** The Settings App UI set is
`Auth/OAUTH`, `Button`, `Image`, `Link`, `Section`, `Select`, `Slider`, `Text`,
`TextImageRow`, `TextInput`, `Toast`, `Toggle`, `View`; `Image` is display-only
(`src` = URL or base64). There is no `ImagePicker` equivalent, and the watch has
no camera, so on-device scanning is out too.

**Handing a file to a mini program does work**, which is what makes QR
Enrollment reachable by another route. Two pieces of evidence, neither of them
the documentation:

- **[source]** `@zeppos/zml` 0.0.41 exposes, on the Side Service,
  `fileSystem.onInputFile(cb)` → `fs.on('inputFile', cb)`, alongside
  `readFile(path, opt)` and `writeFile(path, data, opt)`
  (`src/core/side/file-system/file-system.js`).
- **[store]** galulex's "Authenticator" (2026-08-01) offers a file upload that
  imports Tokens either from a file or from an image. Observed in the Zepp app,
  2026-09-09.

Neither appears on the Settings App component page or the Side Service pages.
**Treat Zepp's prose documentation as incomplete rather than authoritative** —
this is the third place in this report where its source or its shipped apps say
more than its docs do; see also §3.2 (ZML chunking) and §3.5 (`SCROLL_LIST`
children).

**The QR decoder itself ports.** `@nuintun/qrcode` 3.3.0 — already pinned in the
Fitbit app — has two entry points, and only one needs a browser:

| Method                                                   | Depends on                                                                              | Ports?                                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `Decoder.decode(data: Uint8ClampedArray, width, height)` | nothing — `binarize()` then `scan()`, pure computation                                  | **yes, unchanged**                                                             |
| `Decoder.scan(src: string)`                              | `new Image()`, `document.createElement('canvas')`, `getContext('2d')`, `getImageData()` | no — but it is a ~25-line wrapper ending in `this.decode(data, width, height)` |

`companion/tokens.ts:36` calls `scan()`, which is what makes the decoder _look_
browser-bound. The decoding logic underneath is portable as-is.

So the only genuinely missing piece is **rasterization**: uploaded file bytes →
RGBA array. That needs a pure-JS PNG decoder plus an inflate; PNG is what phone
screenshots are on both Android and iOS, so PNG alone likely suffices.
`image.convert({ filePath, targetFilePath })` does not help — it is file-path
based and produces a watch-display-format _file_, not pixel data. Estimate for
full image QR import: **~4–6 h**, ordinary testable logic, no platform risk.
`test/qr_codes/generateQrCodes.mjs` ports too, since it uses the same package's
`Encoder`.

**Bundle cost, measured [build] 2026-09-09.** Both decoders were imported into
the Side Service and built with `zeus build`, then the emitted `app-side.js` was
read out of the `.zpk`:

| Side Service contents           | `app-side.js` | `.zpk` |
| ------------------------------- | ------------- | ------ |
| Baseline (the current stub)     | 2.0 KB        | 19 KB  |
| \+ `fast-png` (pulls in `pako`) | 41.5 KB       | 49 KB  |
| \+ `@nuintun/qrcode` `Decoder`  | 69.2 KB       | 66 KB  |
| \+ both — i.e. option F in full | 108.9 KB      | 79 KB  |

So option F costs roughly **107 KB** of Side Service bundle, 42 KB gzipped. The
Side Service runs inside the Zepp phone app rather than on the watch, and no
documented size limit for it was found, so this is a number to hold against
store review rather than a device constraint. Two thirds of it is the QR
decoder, which option E does not need — E's text-format parsing adds
approximately nothing.

**Where the ecosystem sits.** Every inspectable Zepp OS authenticator
(`ZoLArk173/Authenticator`, `manujedi/Authenticator`, `Lisoveliy/TOTPFit`)
enrolls by pasting an `otpauth://` URI into a phone-side text field. galulex's
store app appears to go further. Enrollment here therefore becomes
**pick-a-file** rather than tap-a-button — a real regression against the Fitbit
one-tap flow, but not the loss of the capability.

**Still unobserved:** how galulex's upload is triggered (share sheet, in-app
button, an undocumented component), and whether it decodes QR images itself or
only accepts text export files. "Either imports or from an image" is a reading
of a UI, not a verified claim.

### 4.3 Replacement options, ranked

| #     | Approach                                                                                                                                                                                      | Effort        | Risk         | Notes                                                                                                                                                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A** | **Paste `otpauth://` URI into a `TextInput`**, run existing `totpConfigFromUri` + validation                                                                                                  | ~2 h          | Low          | Ships. Reuses `keyUri.ts` and all its tests verbatim. Secret transits the clipboard — worth an explicit warning in the UI.                                                                                                                 |
| **B** | **Manual field entry** (label/issuer/secret/algorithm/digits/period)                                                                                                                          | ~4 h          | Low          | You already have this (`SectionAddTokenManually` + `validateConfig`); it becomes the primary path instead of the fallback.                                                                                                                 |
| **C** | **Webview QR scanner**: `Link` or the `Auth/OAUTH` component opens a self-hosted page that scans via `getUserMedia` + jsQR and returns the URI through the OAuth `code` / `onReturn` callback | —             | **Rejected** | See §4.4. Unacceptable trust regression, and probably technically blocked anyway.                                                                                                                                                          |
| **D** | **Companion-side URL import**: side-service `fetch` pulls an encrypted export blob from a URL/short code the user generates elsewhere                                                         | 8 h + backend | Medium       | Moves the problem to a service you'd have to run. Contradicts the app's current zero-backend property. Same trust objection as C, if milder.                                                                                               |
| **E** | **Local file import, text formats** — `onInputFile` → `readFile` → parse `otpauth-migration://`, Aegis / 2FAS / Proton exports                                                                | ~3–4 h        | Low          | No rasterizer needed. Covers the common bulk-export formats, which are text. Folds into the Bulk Import work already scheduled after parity (§7.3)                                                                                         |
| **F** | **Local file import, images** — E plus pure-JS PNG decode → RGBA → `Decoder.decode()`                                                                                                         | +4–6 h        | Low–Medium   | Restores "screenshot the QR and import it". Reuses `@nuintun/qrcode`'s DOM-free `decode()` unchanged (§4.2); only rasterization is new. Risk is Side Service bundle size, not feasibility. **No trust objection — everything stays local** |

**Recommendation:** ship **A + B** first — they are what the effort estimate is
built on and what makes the app usable at all. Then **E**, folded into the Bulk
Import work already scheduled after parity. Then **F**, which is the only option
that meaningfully restores the one-tap flow.

C and D stay rejected; §4.4 explains why. Note the distinction, though, because
it is easy to miss: **§4.4's objections are to _hosting_, not to QR.** E and F
keep everything on the phone and raise none of them.

### 4.4 Why the webview scanner (option C) is rejected

It was initially costed at 10–16 h with a feasibility spike. That was too
generous. Reasons to drop it outright:

#### Trust, in descending severity

1. **It makes this project a trust anchor it currently isn't.** With no backend,
   nobody has to trust the maintainer's infrastructure. A hosted scanner page
   means whoever controls that domain can silently ship JS that exfiltrates
   every secret ever scanned, and users cannot verify at runtime that it didn't.
   "Client-side only" is an unauditable promise.
2. **The secret would travel in a URL.** OAuth redirects carry the payload in a
   query string — webview/browser history, possible referrer leakage, and any
   log on the path. A faithful OAuth implementation exchanges the code
   _server-side_, i.e. it would put the TOTP shared secret on a server by design.
3. **Domain expiry or takeover** is a permanent tail risk for a security app
   that may outlive the maintainer's interest in hosting anything.

#### Feasibility

- `getUserMedia` inside an embedded webview requires the host app to grant it
  (`onPermissionRequest` on Android; camera entitlement and explicit `WKWebView`
  configuration on iOS). The Zepp app almost certainly does not do this for
  arbitrary third-party pages — likely a hard dead end before any of the
  interesting work starts.
- It requires impersonating an OAuth provider to a component that expects
  `authorizeUrl` / `requestTokenUrl` / a token exchange. Fragile against SDK
  updates and a plausible store-review flag.
- It would make adding a token require internet access in an app that otherwise
  needs none.

The upside is saving one paste. That does not justify any of the above.

### 4.5 Enrollment UX in practice

What users will actually do, and what the docs should recommend:

- **Best: the "can't scan? enter this key manually" text** that nearly every
  service offers alongside its enrollment QR. Gives the base32 secret directly,
  feeds option B, no clipboard mangling, nothing leaves the device.
- **Android:** Google Lens and most stock camera QR scanners decode
  `otpauth://` and offer the raw text to copy. Caveat: if an authenticator app
  is registered for the scheme, the scanner may launch that app instead of
  showing the text.
- **iOS:** no built-in Lens equivalent. The Camera app / Control Center Code
  Scanner often reports "No usable data found" for `otpauth://` when no app
  handles the scheme. Working alternatives: Lens inside the Google app or
  Chrome, Live Text on a photo of the code, or any QR reader that displays raw
  text.
- **Prefer on-device scanners over Google Lens.** Lens uploads the image to
  Google, so the shared secret leaves the device to a third party. Stock camera
  scanners decode locally. Worth saying explicitly in the user docs rather than
  recommending Lens for convenience.
- Copied `otpauth://` URIs are known to get percent-escaped by some share paths
  (`:`, `@`), which is why existing Zepp authenticators warn about hand-editing
  them. Validation messages should be explicit about this failure mode.

## 5. Effort estimate

Hours below are _my_ working hours (writing, iterating, testing code), assuming
you are available for on-device verification and design calls. They exclude your
time.

| Work item                                                                                                                                                                                        | Hours                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Scaffolding: Zeus CLI project, `app.json` targets, TS/ESLint/Jest/Prettier setup mirroring current toolchain                                                                                     | 3                            |
| Port pure logic + tests: `totp`, `base16codec`, `keyUri`, `formatTokens`, `validateConfig`                                                                                                       | 3                            |
| Persistence: app **settings** only via `@zos/storage` `localStorage`, JSON instead of CBOR — **Tokens are not persisted** (ADR-0004)                                                             | 1                            |
| Side Service + ZML messaging: `call`/`onCall`, clock-drift compensation, connection-status replacement (§3.2) — **revised down from 6 h**, since ZML removes the chunking and serialization work | 4                            |
| Settings App: hand-rolled token list (§3.6) — the only real rewrite. Introduction, licenses, validation messages, manual-entry form, toggles and color select all port near-verbatim             | 7                            |
| Device UI: `SCROLL_LIST` token list, progress arc, enlarged view, three color schemes as JS theming, no-tokens view, clock-sync message                                                          | 10                           |
| Round-screen (466 px) layout tuning and ergonomics                                                                                                                                               | 3                            |
| Simulator + on-device iteration, debugging BLE and rendering quirks                                                                                                                              | 6                            |
| i18n (`.po` files copied into `page/`, `app-side/`, `setting/`, §3.7), docs/README updates, store-submission prep                                                                                | 3                            |
| Contingency (~15 %)                                                                                                                                                                              | 7                            |
| **Total (feature parity minus QR)**                                                                                                                                                              | **~47 h** — plan **45–60 h** |
| Optional: additional Amazfit targets (square Active 2, Balance, T-Rex 3)                                                                                                                         | +6–10 h                      |

No QR-replacement line item: option C is rejected (§4.4) and the remaining
options are either already inside the settings-app estimate (A, B) or out of
scope (D, E).

Estimate assumes: one device model first; feature parity excluding "store tokens
on watch", clock-drift compensation, enlarged view, and three color schemes;
test coverage maintained on pure logic but **not** on UI (no Zepp equivalent of
your `document` mock — expect overall coverage to drop noticeably).

## 6. Tooling assessment

The toolchain is well-constructed but frozen at early-2023 versions (lockfile
last touched September 2023). Three separate questions: what is simply stale,
what cannot follow the app to Zepp OS, and what was never there.

### 6.1 Outdated — independent of any port

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
deprecated, Sense 2 / Versa 4 never got third-party app support, and in June
2024 Google removed third-party apps and clock faces from the gallery for EEA
users. Nothing here will get better by waiting; that is part of the argument for
the port.

### 6.2 Does not carry over to Zepp OS

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

### 6.3 Missing — gaps that exist today and hurt more after the port

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

### 6.4 Linter choice: ESLint vs. oxlint vs. Biome

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

### 6.5 Effort

Retargeting the toolchain (Zeus CLI, typings, tsconfigs, jest mocks, dropping
Stylelint) is already inside the 3 h scaffolding line in §5. Modernizing the
shared tooling — swapping ESLint for oxlint, Prettier 3 reformat, Husky 9,
Node 22, action bumps, Dependabot, the missing scripts and thresholds — is
**+3–5 h** (down from the ESLint-migration path, which the oxlint route skips)
and is worth doing in this repo first, so the port starts from a current
baseline rather than inheriting three years of drift.

## 7. Market landscape: OTP apps on Zepp OS

**Method, and what each claim rests on.** Every figure below is tagged:
**[repo]** = read from the GitHub API or the repository's own files on
2026-09-09; **[docs]** = quoted from Zepp's developer documentation source;
**[press]** = a single press article, i.e. weakest; **[store]** = observed
directly in the Zepp app's App Store on a paired phone, 2026-09-09;
**[unknown]** = not determinable. No claim here is inferred from plausibility.

There is no public web catalogue of Zepp mini apps — Zepp's own documentation
directs users to the "App Store" section _inside the Zepp app_ — so everything
**[store]** comes from looking, and everything that was **[press]** or
**[unknown]** about the store before that look should be treated as suspect.
Two claims in earlier drafts did not survive it; see §7.1.

### 7.1 Who is in the market

Open-source projects, all figures **[repo]**, read 2026-09-09:

| Repo                                         | License           | ★      | Forks | Created    | Last push  | Enrollment                                                                                                                                                                          |
| -------------------------------------------- | ----------------- | ------ | ----- | ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ZoLArk173/Authenticator`                    | MIT               | **31** | 9     | 2022-08-18 | 2025-09-24 | Paste `otpauth://totp/{ACCOUNT}?secret=&issuer=` in Zepp app settings                                                                                                               |
| `manujedi/Authenticator` (fork of the above) | MIT               | **14** | 3     | 2022-12-23 | 2023-03-24 | Same, plus `algorithm` / `digits` / `period`                                                                                                                                        |
| `Lisoveliy/totpfit`                          | **none declared** | 8      | 1     | 2024-11-09 | 2025-08-08 | `otpauth://` with `issuer`/`algorithm`/`digits`/`period`/`offset`; **plus** `otpauth-migration://` bulk import and Proton Authenticator export; add/sort/edit/delete from the phone |
| `UniqueDroid/totp-authenticator-zeppos`      | GPL-3.0           | 0      | 0     | 2026-08-19 | 2026-08-19 | Unknown — README is a one-line stub                                                                                                                                                 |
| `cubimon/zeppos-totp-generator`              | none              | 0      | 0     | 2025-08-29 | 2025-08-29 | Unknown — no README                                                                                                                                                                 |
| `Alpaca131/GTasks`                           | none              | 0      | 0     | 2022-10-19 | 2022-10-19 | Unknown — no README; description reads "An app to show 2FA code on your ZeppOS watch"                                                                                               |

Notes on the table:

- `Lisoveliy/totpfit`'s GitHub repo is a **mirror**; development happens on the
  author's Gitea, and GitHub carries issues only **[repo]**. Its migration
  support is not just a README claim — the tree contains
  `lib/protobuf-decoder/` **[repo]**.
- `Alpaca131/GTasks` is _not_ a predecessor of the ZoLArk app — it was created
  two months **after** it. `manujedi`'s README credits "ZoLArk173 and Alpaca131
  for the idea and original code", which is the only established link **[repo]**.
- `ZoLArk173`'s README lists its own limitations verbatim: "Cannot rearrange 2FA
  codes. Cannot import URI without manual edit. Won't auto update every 30
  secs." **[repo]**

**Store listings: five, all third-party, publishers shown.** Observed directly in
the Zepp app's App Store on 2026-09-09 **[store]**, searching "Authenticator":

| Listing            | Publisher | Dated      | Also on GitHub (§7.1)?          |
| ------------------ | --------- | ---------- | ------------------------------- |
| Authenticator      | galulex   | 2026-08-01 | no                              |
| TOTP Authenticator | manujedi  | 2023-01-29 | yes — confirms its README claim |
| AMGTOTP            | leen      | 2026-05-30 | no                              |
| Auth               | Tachanka  | 2023-09-28 | no                              |
| TOTPFit            | Lisoveliy | 2025-08-28 | yes                             |

**This refutes two things earlier drafts of this report asserted.**

1. **There is no first-party Zepp Health authenticator.** The Notebookcheck
   article's "Zepp Health also notes that the Authenticator Mini App has been
   revamped" **[press]** does not correspond to a Zepp-published listing. The
   nearest match by date is **galulex's "Authenticator" (2026-08-01)** — a
   third-party app that Zepp appears to have promoted. Zepp _announcing_ an app
   is not Zepp _writing_ one, and this report twice built inferences on the gap.
2. **Publishers are shown.** §7.1 previously warned that attribution "may not be
   displayed at all" and treated it as possibly unanswerable. It is displayed,
   with dates, for every listing.

**Consequence, and it strengthens §4.2:** the privileged-camera-access
hypothesis is dead. Every authenticator in this ecosystem — store and GitHub
alike — is third-party and bound by the same Settings App component set. Nobody
has a QR path we lack that we could not build ourselves — and per §4.2, we
can build it. See `ADR-0001`.

**Also: the field is larger than §7.1's GitHub survey suggested.** Three of the
five listings — galulex, leen, Tachanka — have no repository in that table, so
the six open-source projects were an undercount of the competitive field, though
not of the _inspectable_ one. Whether any of them is polished is still
**[unknown]**; only their existence is established.

**What can be said with confidence:** six open-source projects exist; only two
have any traction (31 and 14 stars); the most-starred self-describes as a
prototype; the fork that reached the store was last touched in March 2023, in
the Zepp OS 2 era. Among _inspectable_ competitors there is no polished
alternative. The store side is not inspectable from here.

### 7.2 Paid vs. free, and the price ceiling

All of the following is **[docs]**, quoted from `docs/guides/faq/paid-app.md` in
`zepp-health/zeppos-docs`:

- "Only certified corporate developers in Mainland China can submit paid Mini
  Programs or Watchfaces in the Zepp Store, and their works can be listed in
  Zepp Stores outside of Mainland China." Becoming one requires contacting Zepp
  OS staff via the developer community.
- Three tiers only: **$1.99 / $2.99 / $3.99** (€1.99 / €2.99 / €3.99).
- "Zepp Health's service fee for developers is 15%, and after deducting the 30%
  commission that Apple or Google takes for in-app purchases, the developer can
  receive a revenue of 100% - 15% - 30% = **55%**."
- "Zepp OS allows developers to use reasonable in-app purchase solutions for
  Mini Programs, such as Kiezelpay or other QR code reward schemes, and the
  payment method must be explained at the time of app submission."
- On paid watch faces from outside Mainland China: "This method is currently not
  supported by the official channel."

Consequences: as a Swiss developer you **cannot list a paid app or watch face
through the official channel**. The realistic options are free, or free with a
Kiezelpay unlock. The six open-source projects are free (they are source
repositories with no payment mechanism) **[repo]**; the store listing's price is
**[unknown]**.

### 7.3 How the field handles the QR problem

**None of the six open-source projects scans a QR code** — every one pastes a
URI **[repo]**. That independently supports §4.2. It is a statement about the
projects that can be inspected; the store listing's flow is **[unknown]**.

The most capable enrollment is TOTPFit's, per its own guide
(`docs/guides/how-to-add-totps/README.md`) **[repo]**:

1. **Single tokens** — "scan QR-Code of service providing 2FA and scan (decode)
   it to a URI", using an image-scanning app; the guide names **Google Lens**.
   Copy the URI, paste it via "Add new TOTP record". Same cloud-upload caveat as
   §4.5.
2. **Google Authenticator bulk import** — "Transfer accounts" → "Export
   accounts", screenshot the QR, decode it to an `otpauth-migration://offline?
data=…` URI, paste once, and all selected records import together.
3. **Proton Authenticator** — export, open the file in a text editor, paste the
   contents.

So the ecosystem's answer to "no camera, no image picker" is **bulk import**
rather than per-token scanning: pay the paste tax once per vault instead of once
per account.

**This is the most valuable feature gap to close.** Google Authenticator's
export payload is base64-wrapped protobuf, and TOTPFit demonstrates it is
tractable on this platform — its tree carries a hand-rolled
`lib/protobuf-decoder/` **[repo]**. Estimate **4–6 h** including tests
(my estimate, not a measured figure), no platform risk. It would beat every
inspectable competitor's enrollment UX and soften the loss of the `ImagePicker`
flow. Not in the §5 totals; recommended as a scoped addition.

### 7.4 Ratings

**Still [unknown].** The store search surfaced names, publishers and dates
(§7.1) but no ratings, review counts or install counts. There is no public web
catalogue either, so the only public proxy remains the GitHub star counts in
§7.1 — an ecosystem where 31 stars is the leader, and where three of the five
store listings have no public repository at all.

What the store _did_ settle is that the field is at least five apps deep rather
than the two-with-traction §7.1 implied. That is a mild argument against the
"the field is thin, so build" reasoning — though §8.4 rests the build decision on
wanting the porting experience, not on market gap, so it does not change the
conclusion.

## 8. Reach and maintenance cost

All device figures **[docs]**, from Zepp's device list, read 2026-09-09.

### 8.1 How many devices, how many generations

Zepp's list carries **34 devices**. By API_LEVEL — the only compatibility axis
that matters, since Zepp OS firmware versions and API levels are decoupled:

| API_LEVEL          | Devices | Which                                                                                                                                                                  |
| ------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| none (Zepp OS 1.0) | 5       | GTR 3, GTR 3 Pro, GTS 3, GTS 4 mini, Band 7 — predate API_LEVEL; effectively out of scope                                                                              |
| 2.0 – 3.0          | 4       | GTR Mini, Bip 5, Bip 5 Unity, T-Rex 2                                                                                                                                  |
| 3.5 – 3.7          | 10      | GTR 4, GTS 4, Cheetah (round/square/Pro), T-Rex Ultra, Falcon, Balance, Active, Active Edge                                                                            |
| 4.0 – 4.4          | 15      | Active 2 (round + square), Balance 2 / 3 / Ultra, T-Rex 3, T-Rex 3 Pro (44 + 48), T-Rex Ultra 2, Bip 6, Bip Max, Cheetah 2 (Pro + Ultra), Active Max, Active 3 Premium |

Targeting **API_LEVEL ≥ 3.6** — the floor for `@zeppos/zml` — reaches **24 of
the 34 devices**, spanning about four hardware generations.

But porting effort does not scale with device count; it scales with **screen
geometry**, because layout is absolute-positioned (§3). Among those 24:

| Layout                                                                                                                         | Devices ≥ 3.6 | Cumulative |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------- | ---------- |
| Round 466 × 466 — **Active 2 Round**, GTR 4, Cheetah 2 Pro, T-Rex 3 Pro 44 mm, Active 3 Premium                                | 5             | 5          |
| Round 480 × 480 — Balance / 2 / 3 / Ultra, T-Rex 3, T-Rex 3 Pro 48 mm, T-Rex Ultra 2, Cheetah Pro, Cheetah 2 Ultra, Active Max | 10            | 15         |
| Square 390 × 450 — Active 2 Square, Bip 6, Active, Cheetah Square, GTS 4                                                       | 5             | 20         |
| Round 454 × 454 (2), round 416 × 416 (1), square 432 × 514 (1)                                                                 | 4             | 24         |

So the **first layout is nearly free reach for five devices**, a second layout
(480 round) reaches 15, and a third (390 × 450 square) reaches 20 of 24. This is
the strongest argument in the report for doing the port at all: the marginal
cost per additional device is close to zero within a resolution class.

### 8.2 Is the API churn as bad as it looks?

**Largely no, and the evidence points the other way [docs].** Zepp documents an
explicit compatibility contract: API_LEVEL "is the version number of Zepp OS's
open capabilities"; "higher version API_LEVEL is fully compatible with lower
version applications"; developers "don't need to track firmware or OS version
numbers, only adapt to API_LEVEL". Levels 2.0 → 4.4 have been **additive**.

The one real discontinuity was **1.0 → 2.0** (ESM modules, `hmUI`/`hmFS` → the
`@zos/*` namespace, new storage and BLE messaging), and it is four years old.
Zepp even ships a migration tool (`@zeppos/zmt`) for it.

That reframes §7.1: the abandoned competitors are not evidence of continuous
churn. `manujedi/Authenticator`'s README is a fossil of that single 1.0 → 2.0
migration — "changed to Zepp OS 2", "New storage API from 2.0" — after which the
author stopped in March 2023 **[repo]**. The rot is one historic break plus
abandonment, not a treadmill.

Honest counterweights:

- The compatibility guarantee is a **vendor promise**, documented but not
  something this report verified empirically.
- Tooling lags the platform: `@zeppos/device-types` is at 4.0 while shipping
  devices are at API_LEVEL 4.4 **[repo/npm]**.
- The genuine recurring cost is **new screen geometries**, not broken APIs.
  Every new resolution class is a new layout, permanently.

### 8.3 Maintenance budget

On the evidence above, a realistic steady state is **~4–8 h/year**: occasional
SDK/CLI bumps, a typings update, and layout work when a device introduces a
resolution you care about. That is not the picture of an ecosystem that will
force a rewrite every year — but it is not zero, and it is strictly more than
this repo costs today.

Worth stating plainly: **`fitbit-otp-auth-app` is cheap to maintain precisely
because Fitbit's platform is dead.** `@fitbit/sdk` has not moved since 2023
(§6.1), so nothing forces work. Zepp OS is alive, which is the point of porting
to it, and aliveness has a subscription fee paid in hours.

### 8.4 So is it worth it?

This depends on one thing the report cannot settle:

- **Personal use** — the treadmill mostly disappears. Pin an API level,
  sideload, ignore new devices, skip store review. The question becomes whether
  45–60 h is a fair price for a working authenticator on a watch you own.
- **Publishing for others** — the ecosystem returns little that is measurable.
  No paid listing is possible (§7.2), no public ratings or install counts exist
  (§7.4), and _polish is the least durable advantage you can build_: a rival can
  match it in a weekend. The advantages that don't rot are TOTP correctness
  under test, clock-drift compensation, and `otpauth-migration://` import
  (§7.3).

A third option deserves weighing: **contribute to `Lisoveliy/totpfit`** instead
of building a seventh app. It already has migration import and phone-side
editing. Blocker: it declares **no license** **[repo]**, so contributing GPL-3.0
code — or reusing its code here — is legally unclear until the author sets one.

**Decision: build.** Two reasons, and the first is the one that settles it.

The project's deliverable is a write-up of what porting an app with Claude is
actually like (§8.4's "personal use" branch, reframed). **Contributing does not
produce that.** Upstreaming a better TOTP core into someone else's Zepp app
exercises none of the interesting surface — no device UI against `@zos/ui`, no
Side Service, no BLE transport, no Settings App, no toolchain bring-up. It would
be a pull request, not a port, and there would be nothing to write about beyond
"I read someone's code and improved a function."

Second, the licensing blocker is real and unilateral. TOTPFit declares no
license, which by default means all rights reserved: its code cannot be reused
here, and a GPL-3.0 contribution into an unlicensed tree leaves both sides in an
unclear position. Resolving it depends on an author who develops primarily on
his own Gitea and mirrors to GitHub for issues **[repo]** — not a dependency
worth putting on the critical path.

The honest counterweight, which the write-up should state rather than bury: on
pure user value, contributing probably wins. TOTPFit already has
`otpauth-migration://` import and phone-side editing, and a seventh authenticator
in a field of six serves nobody who isn't already served. Building is the right
call **because the goal is the experience, not the market** — and that is worth
saying out loud instead of retrofitting a market rationale onto it.

## 9. Risks and unknowns

- **API level fragmentation.** Active 2 units are on Zepp OS 4 or 5 depending on
  firmware; `@zeppos/zml` needs ≥ 3.6. Pin a minimum and state it in the README.
- **Store review.** Zepp's Mini App store is curated. A GPL-3.0 security app
  storing TOTP secrets may draw scrutiny; developer-mode sideloading is the
  guaranteed distribution path.
- **BLE throughput and message size.** Largely retired by §3.2: ZML chunks at
  ~3 518 B, sequences with `seqId`, sorts on receipt and validates total length,
  so neither the size limit nor the out-of-order caveat documented in
  `TokenManager.ts` is your problem any more. What remains is throughput —
  wall-clock time to push a full token set — which is still worth measuring.
- **No phone-side connection status.** ZML exposes `onBleChanged` on the device
  only; the Side Service has no BLE-state callback (§3.2). The settings-page
  connection indicator needs a different design or needs dropping.
- **Secret handling parity.** As on Fitbit, secrets live in phone-side settings
  storage in plaintext and cross BLE. No regression, but no improvement either.
- **Gadgetbridge users** cannot enrol tokens — the phone-side Settings/Messaging
  APIs aren't implemented there. Official Zepp app required.
- **Prior art.** Three Zepp authenticators already exist. Worth a deliberate
  build-vs-contribute decision: your TOTP core, validation, clock-drift
  compensation, and UX are materially better than theirs, which argues for
  porting — but check whether contributing the core to TOTPFit gets users the
  same value faster.

## 10. Suggested phasing

1. **Spike (4 h)** — scaffold, get `totp()` running on the watch showing one
   hard-coded token. Proves the JS engine, the crypto deps, and the toolchain.
   The §3.1 engine questions are now mostly answered from ZML's source, so this
   is a confirmation rather than an investigation: check that `Promise` and
   `Map` are really there, that `@zos/timer`'s `setTimeout` ticks as expected,
   and that `new Function('return this')` survives the bundler for `crypto-js`.
   Cheap here, expensive to discover during the UI build. **Also settle §3.5:
   does `SCROLL_LIST` support a per-row `UPDATE_ITEM` patch, or only a
   whole-array `UPDATE_DATA` refresh?** That answer shapes the entire Device UI
   design, so it belongs in the first four hours rather than the last ten.
2. **Vertical slice (12 h)** — Settings App URI paste (option A) → Side Service →
   BLE → device list of live codes.
3. **Parity (25 h)** — manual entry, rename, delete, reorder via move-up/down
   buttons, settings persistence, three color schemes, enlarged view, clock
   drift. **Measure connection stability throughout** — that measurement is what
   decides whether on-watch Token storage comes back (ADR-0004).
4. **Polish (10 h)** — round-screen tuning, i18n, docs (including the enrollment
   guidance in §4.5), packaging.
5. **Optional, after parity** — `otpauth-migration://` Bulk Import, import-only
   (§7.3, +4–6 h).
6. **Optional** — additional device targets.

## 11. Decisions and remaining questions

Resolved in the design session of 2026-09-09. See `CONTEXT.md` for the glossary
and `docs/adr/` for the decisions that needed reasoning recorded.

| #   | Question                                    | Resolution                                                                                                                                                                                                              |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Is losing one-tap QR enrollment acceptable? | **Moot — QR survives as file import** (§4.2). v1 ships Manual Entry + URI Paste; text file import (~3–4 h) and image QR decode (~4–6 h) follow after parity. Hosted scanning stays rejected on trust grounds — ADR-0001 |
| 2   | One device target or a family?              | **Active 2 round (466 × 466) only.** No responsive layer, but all coordinates in one layout-constants module so a second geometry is a data change                                                                      |
| 3   | Store release or sideload?                  | **Neither is the goal.** Public Repo + a project page on binarypoetry.ch are the deliverables; a Store Listing is a deferred byproduct                                                                                  |
| 4   | Shared `common/` or separate repo?          | **Separate repo, code copied** with attribution. The two will diverge (§3.1), copying brings the tests along, and a frozen Fitbit repo shouldn't be coupled to a live one                                               |
| 5   | Build or contribute to TOTPFit?             | **Build** — see §8.4                                                                                                                                                                                                    |
| 6   | Add `otpauth-migration://` Bulk Import?     | **Yes, import-only, after parity** (§10 step 5)                                                                                                                                                                         |
| —   | Reorder, with no list component?            | **Move-up/move-down buttons per Token** in the Settings App                                                                                                                                                             |
| —   | Transport?                                  | **`@zeppos/zml`**, protocol collapsed to one message — ADR-0002                                                                                                                                                         |
| —   | Phone-side connection status?               | **Dropped**; ZML exposes BLE state on the device only — ADR-0003                                                                                                                                                        |
| —   | On-watch Token storage?                     | **Not initially**; revisit if the connection proves unstable — ADR-0004                                                                                                                                                 |
| —   | Color schemes?                              | **Three** — binary poetry, white, black (§3.3)                                                                                                                                                                          |
| —   | Linter and test runner?                     | **oxlint** (timeboxed, ESLint 9 as fallback) and **Vitest**; everything else copied from the `vite-press` repo's current stack. §6.5's "modernize the Fitbit repo first" is dropped — that repo stays frozen            |
| —   | Coverage floor?                             | **≥ 80 % per file** (`perFile: true`), with explicit `coverage.exclude` entries for genuinely untestable UI rather than a lower threshold (§6.3)                                                                        |
| —   | Settings App token list?                    | **Flat in-place list** — rename `TextInput` plus `↑` `↓` `✕` per Token; `Select`-plus-single-editor as the fallback (§3.6)                                                                                              |
| —   | i18n?                                       | **Straight copy.** All three surfaces are `.po`-based; the phone side keeps `import { gettext } from 'i18n'` verbatim (§3.7)                                                                                            |

Still open:

1. **Device UI shape** (§3.5) — how the per-row countdown is rendered, given
   `SCROLL_LIST` rows admit only `text_view` and `image_view` children. Blocked
   on the spike question of whether `UPDATE_ITEM` exists. The 10 h line and the
   largest remaining unknown.
2. **Partly answered** (§7.1): the store holds five authenticators, all
   third-party, publishers and dates shown — there is no first-party Zepp app,
   so nobody has privileged camera access. What is still unobserved is **how any
   of them enrolls accounts**. The one worth installing is **galulex's
   "Authenticator" (2026-08-01)**, the newest and the likely subject of the press
   coverage. The question that matters: does its settings page use any component
   outside the public Settings App set? If not, §4.2 holds for everyone.
3. Whether Zepp **developer mode** broadens on-watch file access. It does not
   affect ADR-0004's outcome, but it decides how strongly the docs should warn
   if Token storage is ever added back.

## Sources

- [Introduction to Zepp OS](https://docs.zepp.com/docs/intro/)
- [Settings App UI components — Image](https://docs.zepp.com/docs/reference/app-settings-api/ui/image/)
- [Settings App UI components — Auth/OAUTH](https://docs.zepp.com/docs/reference/app-settings-api/ui/auth/)
- [Introduction to the use of UI components](https://docs.zepp.com/docs/guides/framework/app-settings/ui-intro/)
- [Side Service — Fetch API](https://docs.zepp.com/docs/reference/side-service-api/fetch/)
- [Side Service — Messaging API](https://docs.zepp.com/docs/reference/side-service-api/messaging/)
- [Device App API — `@zos/ble` `createConnect`](https://docs.zepp.com/docs/reference/device-app-api/newAPI/ble/createConnect/)
- [Device App API — `@zos/fs` `writeFileSync`](https://docs.zepp.com/docs/v2/reference/device-app-api/newAPI/fs/writeFileSync/)
- [Device App API — TransferFile](https://docs.zepp.com/docs/reference/device-app-api/newAPI/transfer-file/TransferFile/)
- [`@zeppos/zml` API reference](https://zepp-health.github.io/zml/api) ·
  [source, v0.0.41](https://github.com/zepp-health/zml) — `src/shared/message.js`
  (chunking constants), `src/shared/promise-*.js` and
  `src/shared/device-setTimeout-*.js` (per-platform shims), `rollup.config.mjs`
  (shim selection), `zml.d.ts` (`base-side` surface)
- [Zepp OS JavaScript support (device)](https://docs.zepp.com/docs/guides/framework/device/js-support/)
- [Device App API — `@zos/timer` `createSysTimer`](https://docs.zepp.com/docs/reference/device-app-api/newAPI/timer/createSysTimer/)
- [Fitbit: Application Architecture Guide](https://dev.fitbit.com/build/guides/application/)
- [Fitbit ❤️ JerryScript (The New Stack)](https://thenewstack.io/fitbit-%E2%9D%A4%EF%B8%8Fs-jerryscript-javascript-breaks-internet-things/)
- [Fitbit OS memory management (Derek Wilson)](http://derekwilson.net/blog/2020/03/01/fitbit-memory-management)
- [EU Fitbit users to lose access to third-party apps and watch faces](https://www.phonearena.com/news/eu-fitbit-users-to-lose-access-to-third-party-app-and-watch-faces_id156606)
- [Fitbit 3rd-party development is for watch faces, not apps, on Sense 2 and Versa 4](https://9to5google.com/2023/02/17/fitbit-studio/)
- [Submitting Paid Mini Programs or Watchfaces](https://docs.zepp.com/docs/guides/faq/paid-app/)
  ([markdown source](https://github.com/zepp-health/zeppos-docs/blob/main/docs/guides/faq/paid-app.md))
- [Device list (API_LEVEL, screen shape and resolution per device)](https://docs.zepp.com/docs/reference/related-resources/device-list/)
- [API_LEVEL compatibility](https://docs.zepp.com/docs/guides/framework/device/compatibility/) ·
  [Migration from version 1.0](https://docs.zepp.com/docs/guides/version-info/migration-guide/)
- [TOTPFit — how to add TOTP records](https://github.com/Lisoveliy/totpfit/blob/main/docs/guides/how-to-add-totps/README.md)
- [Amazfit users can now download three new Mini Apps (Authenticator revamp)](https://www.notebookcheck.net/Amazfit-smartwatch-users-can-now-download-three-new-Mini-Apps.1249049.0.html)
- [Creating Amazfit apps for the Zepp App Store (with Kiezelpay)](https://waxlyrical.medium.com/creating-amazfit-apps-for-the-zepp-app-store-with-kiezelpay-d4eebf4a08ce)
- [Oxlint type-aware linting: stable](https://oxc.rs/blog/2026-07-22-type-aware-linting-stable) ·
  [guide](https://oxc.rs/docs/guide/usage/linter/type-aware.html) ·
  [oxc-project/tsgolint](https://github.com/oxc-project/tsgolint)
- [Biome 2026 roadmap](https://biomejs.dev/blog/roadmap-2026/) ·
  [Biome v2 type inference](https://biomejs.dev/blog/biome-v2/)
- npm: [`@zeppos/zeus-cli`](https://www.npmjs.com/package/@zeppos/zeus-cli) ·
  [`@zeppos/device-types`](https://www.npmjs.com/package/@zeppos/device-types) ·
  [`@zeppos/zml`](https://www.npmjs.com/package/@zeppos/zml)
- [Do Amazfit smartwatches support third-party apps?](https://in.amazfit.com/pages/faq/do-amazfit-smartwatches-support-third-party-apps)
- [Amazfit Active 2 product page](https://us.amazfit.com/products/active-2-round)
- [Amazfit Active 2 gets first Zepp OS 5 update](https://www.notebookcheck.net/Amazfit-Active-2-gets-new-tap-to-wake-feature-in-first-Zepp-OS-5-update.1073402.0.html)
- [ZoLArk173/Authenticator](https://github.com/ZoLArk173/Authenticator) ·
  [manujedi/Authenticator](https://github.com/manujedi/Authenticator) ·
  [Lisoveliy/TOTPFit](https://github.com/Lisoveliy/totpfit)
- [Gadgetbridge: support for side-app code for Zepp OS](https://codeberg.org/Freeyourgadget/Gadgetbridge/issues/3266)
