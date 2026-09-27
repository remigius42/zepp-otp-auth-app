<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage jsQR getUserMedia Lisoveliy ZoLArk manujedi typedarrays -->

# 9. Risks and unknowns

Part of the [porting analysis](./README.md).

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
