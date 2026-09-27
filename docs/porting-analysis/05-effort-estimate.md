<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage jsQR getUserMedia Lisoveliy ZoLArk manujedi typedarrays -->

# 5. Effort estimate

Part of the [porting analysis](./README.md).

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

**Actual hours, recorded per phase. The numbers above are the original estimate and
stay unedited** — the write-up compares against them.

| Phase             | Estimate | Actual | Where the difference went                                                                                                                                                                                                              |
| ----------------- | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Spike          | 4 h      | ~6 h   | ≥1 h of device deploys that `check:engine` would have caught on the laptop; ≥0.5 h of blank Settings App pages (§3.6.1); 0.5 h account (§3.9)                                                                                          |
| 2. Vertical slice | 12 h     | ~1.9 h | Under, not over: ~0.7 h design review, ~0.4 h building test-first, ~0.8 h on-device fixes — Settings App lacks `URL`, `base32-decode` fails there, screen-off exits the app. Estimated from commit and log timestamps, less 1 h dinner |

Revising the estimate was deferred until after Phase 2. Two phases now point
in opposite directions — 1.5× over, then ~6× under — so no single factor
applies. The pattern is that building is cheaper than estimated and hardware
friction is the variable; the remaining numbers stay as the original baseline.

---

← Previous: [4. The QR code workaround](./04-qr-workaround.md)\
Next: [6. Tooling assessment](./06-tooling.md) →
