<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage jsQR getUserMedia Lisoveliy ZoLArk manujedi typedarrays -->

# 4. The QR code workaround — the part that breaks

Part of the [porting analysis](./README.md).

## 4.1 How it works today

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

## 4.2 What survives on Zepp OS, and what doesn't

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

## 4.3 Replacement options, ranked

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

## 4.4 Why the webview scanner (option C) is rejected

It was initially costed at 10–16 h with a feasibility spike. That was too
generous. Reasons to drop it outright:

### Trust, in descending severity

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

### Feasibility

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

## 4.5 Enrollment UX in practice

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

---

← Previous: [3.9–3.12 Build and hardware findings](./03-build-and-hardware-findings.md)\
Next: [5. Effort estimate](./05-effort-estimate.md) →
