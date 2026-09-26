# No connection status indicator on the phone

The Fitbit app renders a connection indicator in every section of its settings
page, driven by the companion listening for `peerSocket` `open`/`close` events
and writing the result into settings storage. Zepp OS offers no equivalent:
ZML's `onBleChanged` is **device-side only**, and the Side Service surface
(`call`, `onCall`, `onRequest`, `onSettingsChange`, `settingsLib`) has no
BLE-state callback, nor does the underlying Side Service Messaging API document
one. We are **dropping the indicator** rather than reconstructing it.

## Considered options

- **Drop it** (chosen) — the settings page simply doesn't report connection
  state.
- **Move it to the watch** — show the indicator on-device, where
  `onBleChanged` is available. Rejected for now: the watch is where the user
  reads Codes, not where they diagnose Sync, and it costs screen space on a
  466 px round display that is already tight.
- **Device-side heartbeat** — the watch periodically writes a timestamp back so
  the phone can infer staleness. Rejected: it reconstructs a diagnostic from
  scratch, costs a round-trip on a battery-powered device, and answers "were we
  connected recently" rather than "are we connected now".

## Why dropping is acceptable

The indicator was worth more on Fitbit than it is here. It existed alongside a
transport where the application layer owned fragmentation and message-loss
detection, so "is the socket open" was genuinely diagnostic. Under
[ADR-0002](./0002-zml-transport-and-single-token-message.md), ZML validates
reassembly and throws on mismatch, so a failed Sync surfaces as an error we can
report directly — which is more useful than a green dot.

There is also a natural fallback signal: the user changes something on the
phone and the watch doesn't update. That is the same information the indicator
conveyed, arriving at the moment it matters.

## Consequences

- `settings/ConnectionStatus.tsx` and `companion/ui/connectionStatus.ts` are not
  ported. Their tests go with them — a second place where the port sheds
  coverage rather than carrying it.
- Sync failures need to report themselves. Since the indicator is gone, an
  explicit error or Toast on a failed `call` is no longer a nicety.
- Reversible if it turns out to matter in daily use: moving the indicator to the
  watch stays available, because `onBleChanged` is there whenever we want it.
- This is a genuine parity regression against the Fitbit app, and the analysis
  did not account for it. It should be stated plainly in the README and in the
  blog post rather than quietly omitted.

## Amendment, 2026-09-26: failures surface on the watch

"An explicit error or Toast on a failed `call`" was wrong. A push to a closed
watch app is the normal case — the next launch pulls (ADR-0002 amendment) — and
ZML's `call` gives no reliable failure signal. The failure that matters is the
**launch pull**, and the watch reports it where the user is looking: "Phone not
reachable", tap to retry, and a re-pull on resume while it has no Tokens.
Connection quality is measured rather than indicated — see the ADR-0004
amendment on **Sync Stats**.
