<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage jsQR getUserMedia Lisoveliy ZoLArk manujedi typedarrays -->

# 10. Suggested phasing

Part of the [porting analysis](./README.md).

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
   (§7.3, +4–6 h). Dropped 2026-09-27 (ADR-0001 amendment).
6. **Optional** — additional device targets.

---

← Previous: [9. Risks and unknowns](./09-risks.md)\
Next: [11. Decisions and remaining questions](./11-decisions.md) →
