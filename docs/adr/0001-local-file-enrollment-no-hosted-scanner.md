# Enrollment: local file import, never a hosted scanner

The Fitbit app enrolls Tokens in one tap by abusing `ImagePicker` — a component
meant for clock-face wallpaper — as a data input channel, then decoding the QR
image in the companion with `@nuintun/qrcode`. Zepp OS has no such component, so
that exact trick does not port. It does, however, let a mini program receive a
file: ZML's Side Service exposes `fileSystem.onInputFile(cb)` → `fs.on(
'inputFile', cb)` alongside `readFile(path, opt)`, and a shipped store app uses
it. We therefore enroll Tokens **from local input only** — typed, pasted, or
read from a file the user supplies — and **never by handing the Secret to
anything we host**.

## The decision

Ship in this order:

|                        | Path                                                                                         | When         | Cost                                            |
| ---------------------- | -------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------- |
| **Manual Entry**       | Type the Secret and parameters from the service's "can't scan? enter this key manually" text | v1           | ported, tested                                  |
| **URI Paste**          | Paste a whole `otpauth://` URI into one field                                                | v1           | ~2 h, `keyUri.ts` and its tests reused verbatim |
| **File Import, text**  | `onInputFile` → `readFile` → parse `otpauth-migration://`, Aegis / 2FAS / Proton exports     | after parity | ~3–4 h                                          |
| **File Import, image** | `readFile` → pure-JS PNG decode → RGBA → `Decoder.decode()`                                  | after parity | ~4–6 h                                          |

The first two are what the effort estimate is built on and what the app needs to
be usable at all. The file-import paths are additive and deliberately sequenced
after parity so that a stalled port loses a bonus rather than a core claim.

## Why image import is worth doing rather than writing off

`@nuintun/qrcode` 3.3.0 — the version already pinned in the Fitbit app — has two
entry points, and only one of them needs a browser:

| Method                                                   | Depends on                                                          | Ports?                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `Decoder.decode(data: Uint8ClampedArray, width, height)` | nothing; `binarize()` then `scan()`, pure computation               | **yes, unchanged**                                              |
| `Decoder.scan(src: string)`                              | `new Image()`, `document.createElement('canvas')`, `getImageData()` | no — but it is ~25 lines that end by calling `this.decode(...)` |

`companion/tokens.ts` calls `scan()`, which is what made the decoder look
browser-bound. The decoding logic underneath is portable as-is. The only genuinely
new work is rasterization: file bytes → RGBA. That needs a pure-JS PNG decoder
plus an inflate, and PNG is what phone screenshots are on both Android and iOS,
so PNG alone likely suffices. `test/qr_codes/generateQrCodes.mjs` ports too — it
uses the same package's `Encoder`, so QR fixtures keep being generated from
`otpauth://` examples.

The remaining risk is Side Service bundle size, not feasibility. Measure it in
the spike.

## What is rejected, and why

**A hosted webview scanner** — a self-hosted page scanning via `getUserMedia`
and returning the URI through the `Auth`/`OAUTH` component's callback. This is
the only option that would restore literal one-tap Enrollment, so the rejection
is the part worth remembering:

1. **It would make this project a trust anchor it currently isn't.** With no
   backend, nobody has to trust the maintainer's infrastructure. Whoever controls
   a hosted scanner domain can silently ship JavaScript that exfiltrates every
   Secret ever scanned, and users cannot verify at runtime that it didn't.
   "Client-side only" is an unauditable promise.
2. **The Secret would travel in a URL.** OAuth-style redirects carry the payload
   in a query string — webview history, referrer leakage, and any log on the
   path. A faithful OAuth implementation exchanges the code server-side, i.e. it
   would put the Secret on a server by design.
3. **Domain expiry or takeover** is a permanent tail risk for a security app that
   may outlive the maintainer's interest in hosting anything.
4. It is probably blocked anyway: `getUserMedia` in an embedded webview needs the
   host app to grant camera access to arbitrary third-party pages, which the Zepp
   app almost certainly does not do.
5. It would make adding a Token require internet access in an app that otherwise
   needs none.

**A backend import service** — a Side Service `fetch` pulling an export blob
from a URL the user generates elsewhere — is rejected for the same reasons in
milder form, plus it contradicts the app's zero-backend property.

**On-watch camera scanning** is not an option: the watch has no camera.

**These objections are about _hosting_, not about QR.** Local file import raises
none of them, because nothing leaves the phone. Conflating the two is what
originally made QR look impossible here.

## Consequences

- **The one-tap picker is gone regardless.** Even with image import, Enrollment
  becomes pick-a-file rather than tap-a-button. The project page's current
  lead bullet — "add tokens using your smartphone camera" — needs rewriting
  either way.
- Until file import ships, users on iOS have a worse time than users on Android:
  no built-in Lens equivalent, and the Camera app often reports "no usable data
  found" for `otpauth://` when no app handles the scheme. The end-user docs
  should name working alternatives.
- The docs should prefer **on-device** QR readers over Google Lens, which
  uploads the image and so sends the Secret to a third party. Image file import
  removes this problem entirely, which is a further argument for it.
- Some share paths percent-escape `:` and `@` in copied `otpauth://` URIs.
  Validation messages must name this failure mode explicitly rather than saying
  "invalid URI".
- **Zepp's prose documentation is not authoritative on platform limits.** Both
  the file-input capability and the portability of the decoder were absent from
  the docs and present in the source and in shipped apps. Verify limits against
  source or a shipped artifact before recording one as a constraint.

## Amendment, 2026-09-27: no file import after all

Both file-import paths are dropped. Enrollment stays Manual Entry and URI
Paste.

The objections above are about where the Secret goes. They miss where it
stays. A plain export file holds every Secret unencrypted in phone storage,
usually in Downloads, where backups copy it and any app with storage access
can read it, long after the import. A QR image is worse: the only way to get
an authenticator's export QR into a file is a screenshot, and gallery apps
upload screenshots to the cloud by default. Importing either would teach users
to create such files. URI Paste only passes the Secret through the clipboard.

**Encrypted exports would not have this flaw.** Aegis and 2FAS can
password-protect theirs. Importing only those is the one form of Bulk Import
left open. It would need the key derivation and AES-GCM to run in the Side
Service, and a password field whose value never reaches settings storage.
That is several hours of work, to be done only if manual Enrollment proves
tedious in use.

The "Consequences" above still hold where they concern hosting and the
documentation. The ones about image import no longer apply.
