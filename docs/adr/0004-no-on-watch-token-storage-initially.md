# Ship without on-watch Token storage; revisit only if the connection proves bad

The Fitbit app can persist Tokens on the watch so it keeps producing Codes when
the phone is out of range. It is opt-in and off by default, because — in the
app's own FAQ — "any person with physical access to the smartwatch would then be
able to access the tokens." We are **not porting this feature initially.** The
watch holds Tokens in memory only, and a Sync happens on every connection.

## Why

**The feature is a workaround, and we do not yet know whether it has a problem
to work around.** It exists because Fitbit's Bluetooth was unreliable — the FAQ
says outright that "not all smartwatches and smartphones have stable Bluetooth
connections." That is a claim about Fitbit hardware and Fitbit's transport, not
a law of nature. Amazfit's BLE stack and ZML's transport
([ADR-0002](./0002-zml-transport-and-single-token-message.md)) may simply be
better. Porting the mitigation before measuring the problem would be carrying
over someone else's bug.

**Zepp guarantees no encryption at rest.** Its documented storage model is
isolation plus permissions: each Mini Program gets its own `/data` root, isolated
from other Mini Programs, and `localStorage` sits behind
`device:os.local_storage`. Nothing in the documentation claims at-rest
encryption. This is the same posture Fitbit had, so persisting would not be a
_regression_ — but it is also no better, and "no better" is a poor reason to
copy a feature we can defer.

**The phone is genuinely the safer place.** Secrets live in phone-side settings
storage in plaintext on both platforms, but a modern phone adds full-disk
encryption, an OS app sandbox and a mandatory screen lock. An Amazfit watch
matches none of that reliably.

**Distribution makes this sharper here.** The app is sideloaded via Zepp
developer mode rather than shipped through a curated store. Whether developer
mode broadens on-watch file access is unverified, and it is the one way this
port's security posture could end up _worse_ than the Fitbit app's rather than
equal.

## Considered and rejected

- **Port it as-is, opt-in and off by default.** The conservative choice and a
  defensible one — it is exactly what the Fitbit app does. Rejected because it
  spends effort on a mitigation whose need is unproven, and because deferring
  costs nothing: the setting, the protocol flag and the persistence layer can
  all be added later without disturbing anything else.
- **App-layer encryption of the stored Tokens.** Rejected as security theater:
  the key would have to sit on the watch beside the ciphertext. Making it real
  needs a user-entered PIN on the watch — a whole feature, on a 466 px round
  screen, that no competitor offers.

## Consequences

- **Sync moves onto the critical path.** It is no longer a background refresh
  but the thing that makes the app usable at all. Launch latency — how long from
  opening the app to the first Code — becomes a primary UX metric.
- **With the phone out of range, the app shows the no-tokens view.** That state
  needs to explain itself ("connect your phone") rather than looking like data
  loss.
- Dropped from the port: `TokenManager.tryRestoreFromDevice()`, the
  `storeTokensOnDevice` flag on the Sync message, the Store On Watch toggle in
  settings, and the `@zos/storage` `localStorage` persistence layer. The 2 h
  persistence line in the estimate mostly disappears; what remains is persisting
  **app settings**, which is unaffected by this decision.
- **This is a deliberate parity regression** and belongs in the README and the
  write-up, not in the footnotes.
- **Revisit trigger, stated up front so the decision stays evidence-driven:** if
  daily use shows the connection dropping often enough to be annoying, add it —
  opt-in and off by default, with the Fitbit warning text carried over. If
  `localStorage` is chosen then, it is key-value JSON, which is the natural shape
  once CBOR is gone.
