<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage jsQR getUserMedia Lisoveliy ZoLArk manujedi typedarrays -->

# 3. Target platform mapping (Zepp OS)

Part of the [porting analysis](./README.md).

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

## 3.0 Project layout

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

## 3.1 On-device JavaScript runtime

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

## 3.1.1 What the engine actually is, measured [device]

Confirmed on an Amazfit Active 2 (round), 2026-09-26, by the probe in
`src/page/probe/`. Several of these correct claims made earlier in this
document.

| Claim                         | Result                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Promise`                     | **present**, resolves                                                                                     |
| `Map`, `Set`                  | **present**, full set/get/delete/size/iteration                                                           |
| `globalThis`                  | present                                                                                                   |
| `new Function('return this')` | **returns an object that is _not_ `globalThis`** — it has `Math`, so it is global-ish, but identity fails |
| **`BigInt`**                  | **absent.** `typeof BigInt === "undefined"`; `qjsc` rejects a `1n` literal outright                       |
| `Object.hasOwn`               | absent (ES2022) — polyfilled                                                                              |
| Global `setTimeout`           | present, fired at 506 ms for a 500 ms delay                                                               |
| `@zos/timer` `setTimeout`     | present, fired at 578 ms                                                                                  |
| `@zos/storage` `localStorage` | set/get/remove all work                                                                                   |
| Engine version                | **QuickJS 2020-07-05**, from `qjsc -h`                                                                    |

**`@zos/timer` exports far more than its typings admit:** `setTimeout`,
`clearTimeout`, `setImmediate`, `clearImmediate`, `setInterval`,
`clearInterval`, `createTimer`, `stopTimer`, `createSysTimer`. The 4.0 typings
declare only the last two (§3.8).

**The engine is older than the toolchain's own target.** zpm compiles our
sources to ES2020, but the runtime is a mid-2020 QuickJS with BigInt compiled
out, and `node_modules` is passed through unchanged. Nothing on the laptop can
see this, which is why `npm run check:engine` now compiles every bundle with the
shipped `qjsc` and scans for post-2020 built-ins before anything reaches the
watch.

## 3.2 Transport: `@zeppos/zml` vs. `@zos/ble` — settled from source

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

## 3.3 Color schemes reduced to three

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

## 3.4 Persistence: settings only

Per ADR-0004 the watch does **not** persist Tokens — they live in memory and a
Sync happens on every connection. What still needs persisting on-device is the
app's own settings (color scheme, enlarged view), for which `@zos/storage`
`localStorage` is the right fit: key-value JSON, kept in memory for repeated
reads, one `device:os.local_storage` permission line in `app.json`. `@zos/fs` is
unnecessary once there is no Token blob to write.

**Superseded, 2026-09-26: the watch persists nothing.** Reinstalling wipes
`localStorage` (§3.1.1), and a watch without its phone shows no Tokens anyway,
so Settings stay phone-side and travel in the Sync payload — ADR-0004
amendment.

Worth recording, since it is the reason Tokens are not stored: Zepp's documented
storage model is **isolation plus permissions, not encryption at rest**. Each
Mini Program gets its own `/data` root isolated from other Mini Programs, and
nothing in the documentation claims at-rest crypto. That is the same posture
Fitbit had — so persisting would not have been a regression, merely no better.

## 3.5 The per-row progress arc has no `SCROLL_LIST` equivalent

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

## 3.5.1 §3.5 settled on hardware [device]

Observed on an Amazfit Active 2 (round), 2026-09-26.

| Question                            | Answer                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Does `prop.UPDATE_ITEM` exist?      | **Yes, `= 66`**                                                                                                                         |
| Does `prop.UPDATE_DATA` exist?      | Yes, `= 53`                                                                                                                             |
| Does `UPDATE_ITEM` patch one row?   | **Yes — row 0 alone changes.** Confirmed visually                                                                                       |
| Does `UPDATE_DATA` preserve scroll? | **No.** It redraws every row, and a 1 Hz refresh **scrolls back to the top every tick**, making it unusable while the user is scrolling |
| Does `fill_view` render?            | **Yes** — a third child type the earlier draft said did not exist                                                                       |

**So the design question is closed in favour of per-row patching.** The
countdown lives inside the list, updated with
`setProperty(prop.UPDATE_ITEM, { index, item_data })` once per second per
visible row. `UPDATE_DATA` is reserved for a genuine change of the Token set,
where losing scroll position is correct anyway. Option (e) — hand-building the
list — is off the table, and the 10 h estimate for the device UI stands.

**`prop` carries a richer `SCROLL_LIST` API than either the docs or the typings
describe.** `getOwnPropertyNames(prop)` on the device returns 88 entries
including `DELETE_ITEM`, `MOVE_ITEM`, `ITEM_MORE`, `ITEM_REFRESH`, `LIST_TOP`,
`ITEM_HEIGHT` and `SCROLLBAR_VISIBLE`. `DELETE_ITEM` and `MOVE_ITEM` looked
relevant to the Token list but **do not change its design**: delete and reorder
happen in the Settings App, and every Sync replaces the whole set, so the watch
uses `UPDATE_DATA` for a set change — where losing scroll position is correct —
and never mutates the list structurally. Note that **`Object.keys(prop)` returns
`[]`** — the runtime hides these from enumeration, so any enumeration-based
capability check reports every property as missing. An earlier revision of the
probe did exactly that and produced a confident false negative.

**`fill_view` is probably a color swatch, not a progress bar.** It renders, but
binding `bar: 50` produced a _navy_ bar — and 50 is `0x000032`. That points at
the `key` binding the fill **color** rather than any geometry, with width and
height fixed in `item_config`. If so it cannot express progress, and
[ADR-0005](../adr/0005-progress-arc-as-prerendered-image-frames.md) stands
unchanged. Pending one confirmation: rows bound to `0xffd502`, `0xff0000` and
`0x00ff00` should come out amber, red and green.

## 3.6 Settings App: only the Token list is a rewrite

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

## 3.6.1 §3.6 settled on hardware [device]

Observed 2026-09-26 with a 30-row settings page and a button that writes one key.

**Scroll position is preserved across a rebuild.** Scrolled to the bottom,
tapped the button, and the page stayed where it was; values typed into rows 0
and 25 persisted. So the risk the fallback existed to hedge against does not
materialize: **the flat in-place Token list stands**, and the
`Select`-plus-single-editor design is dropped rather than held in reserve.

Three things learned the hard way while getting that answer, all of which cost
more than the answer did:

1. **`build()` must never write to settings storage.** A write fires
   `settingsChanged`, which re-runs `build()`, which writes again. A rebuild
   counter incremented inside `build()` reached **26 rebuilds in one burst**.
   Writes belong in event handlers only. This constrains the Phase 3 Token
   list, where rename, reorder and delete all write.
2. **Every settings write wakes the Side Service**, with
   `launchArgs.launchType === "settingsChanged"` naming the changed key. That
   is useful — it is how the phone side learns a Token changed without polling —
   but it also means a chatty settings UI launches a service process per
   keystroke-ish action. Relevant to ADR-0002's sync design.
3. **The Settings App has no log channel on real hardware.** The Zepp App's log
   screen covers Device App and Side Service only, and Zeus wraps the emitted
   settings bundle in `try { … } catch (e) { console.log(e) }`. A single throw
   therefore produces a blank page and nothing else. **Debug by rendering:**
   build each component inside a `try`/`catch` that falls back to a
   `TextInput({ label, disabled: true })`.
   **Correction, 2026-09-26:** there _is_ a channel, just not `console.log`.
   `zeus bridge` logs every settings-storage write as a `settingsChanged`
   event with key, old and new value — so writing a diagnostic to a settings
   key makes it visible in the bridge log.
4. **The Settings App runtime is not a browser.** It has no `URL` API — the
   key URI parser threw on every paste until rewritten with plain string
   handling — and `base32-decode` fails there too, cause unknown, while the
   same code passes on Node. Treat it as its own engine: nothing on the
   laptop exercises it.

**And the method that should have been used first.** Four versions of the probe
page were written from Zepp's prose docs plus the Fitbit app's idiom, and all
four rendered blank. The fix was to install the shipped `todo-list` template
unmodified — it rendered — and then copy its shape: `View` as root, and only
`View`, `TextInput` and `Button`, which are the components it actually uses. It
never uses `Section`, `Text` or `Toggle`, all three of which the earlier
versions were built from, and §3.6's table above assumes port "1:1". **Those
three are unverified**; `Section` and `Toggle` are needed for the real settings
UI and should be confirmed individually before Phase 3 depends on them.

## 3.7 i18n: same format on the watch, no mechanism on the phone

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

**Locales match exactly, with no fallback [device].** On a `de-CH` phone the
Settings App showed raw msgids — neither the German nor the English text —
although zpm injects `gettextFactory(table, lang, "en-US")`. The runtime looks
the phone's locale up verbatim, finds no `de-CH` table, and does not fall back
to `de-DE` or to the declared `en-US`. Shipping a `de-CH.po` fixed it:
`bin/compile.mjs` copies `de-DE.po` to `de-CH.po` at build time, and the page
rendered German, 2026-09-26. Every further regional variant (`de-AT`, `en-GB`,
…) would need the same alias — and until it has one, that phone sees msgids,
which is why msgids are kept as readable English sentences.

**Rejected: `@silver-zepp/polyglot`.** A third-party toolkit offering dynamic
language switching, an in-app language picker, and `.po` → Excel migration. It
solves problems this app does not have — two languages, no runtime switching
requirement — and would add a dependency plus an `.xlsx` authoring format in
place of `.po`. Worth remembering it exists if the language count ever grows.

## 3.8 Where `@zeppos/device-types` 4.0 is wrong

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

---

← Previous: [1–2. Verdict and the current app](./README.md)\
Next: [3.9–3.16 Build and hardware findings](./03-build-and-hardware-findings.md) →
