<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage jsQR getUserMedia Lisoveliy ZoLArk manujedi typedarrays -->

# Porting analysis: `fitbit-otp-auth-app` → Amazfit Active 2 (round) / Zepp OS

Date: 2026-09-08 · Analyzed commit: `0e63cc5` (v1.0.1)

## Contents

- [1. Verdict](#1-verdict)
- [2. What the current app is made of](#2-what-the-current-app-is-made-of)
- [3. Target platform mapping (Zepp OS), 3.0–3.8](./03-platform-mapping.md)
- [3.9–3.17 Build and hardware findings](./03-build-and-hardware-findings.md)
- [4. The QR code workaround — the part that breaks](./04-qr-workaround.md)
- [5. Effort estimate](./05-effort-estimate.md)
- [6. Tooling assessment](./06-tooling.md)
- [7. Market landscape: OTP apps on Zepp OS](./07-market.md)
- [8. Reach and maintenance cost](./08-reach-and-maintenance.md)
- [9. Risks and unknowns](./09-risks.md)
- [10. Suggested phasing](./10-phasing.md)
- [11. Decisions and remaining questions](./11-decisions.md)
- [Sources](./sources.md)

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

**Amended 2026-09-27: neither import ships.** Export files and QR screenshots
keep Secrets unencrypted on the phone; see the ADR-0001 amendment.

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

---

Next: [3.0–3.8 Target platform mapping](./03-platform-mapping.md) →
