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

## Evidence from the spike, 2026-09-26

Reinstalling the app over `zeus bridge` wiped `localStorage` (§3.1.1). Had
Tokens been persisted there, every developer install would have lost them.
Whether an ordinary app update does the same is unverified — a bridge install
may uninstall first — so this is supporting evidence, not proof. The same risk
applies to persisted **app settings** (§3.4): check it before relying on them.

## Amendment, 2026-09-26: app settings are not persisted on the watch either

The consequence above kept `localStorage` for app **Settings** (color scheme,
enlarged view). Dropped: Settings stay in phone-side settings storage and ride
the same Sync payload as Tokens. The watch persists neither Tokens nor
Settings.

- A watch that cannot reach the phone shows the no-tokens view anyway, so
  persisted Settings would only color an empty screen.
- The launch pull (417–885 ms) delivers them at no extra cost, and a reinstall
  cannot lose what the watch never stored (§3.1.1).
- One source of truth, no merge logic.
- Cost: the first ~0.5 s after launch renders in the default scheme.

`UpdateSettingsMessage` is folded into the single Sync message (ADR-0002): one
payload carrying Tokens and Settings, pulled on launch and pushed on any Token
or Settings key change.

## Amendment, 2026-09-26: the revisit trigger, made measurable

"Often enough to be annoying" becomes a number: **re-evaluate Store On Watch if
more than 1 in 20 launches fails to Sync over two weeks of daily use.**

The watch counts launches, failed pulls and the last 20 pull latencies in
`localStorage` — diagnostics only, no Secrets, no Settings; losing them on
reinstall is acceptable. Each pull sends them along, and the Settings App
shows them as one line (**Sync Stats**). So the `device:os.local_storage`
permission stays.

## Amendment, 2026-09-27: the watch remembers the color scheme

The "first ~0.5 s in the default scheme" cost above proved worse on hardware:
"Waiting for your phone..." showed amber on black before every first Sync,
then flipped to the chosen scheme, and with the no-tokens message it flipped
right in front of the user. The watch now keeps the color scheme of the last
Sync in `localStorage` and starts in it. The phone stays the source of truth:
every Sync overwrites the stored scheme, and a reinstall that loses it only
brings the flip back once. The enlarged view is still not stored, since the
waiting message doesn't use it.

## Amendment, 2026-09-27: what "the phone is the safer place" rests on

The Tokens sit in plaintext in the Zepp app's settings storage, so the
decision above assumes that storage stays on the phone. Zepp's documentation
presents `settingsStorage` as phone-local key-value storage shared by the
Settings App and the Side Service, and describes no cloud sync for it: the
only documented way for Side Service data to reach a server is the Side
Service calling `fetch` itself ([Settings Storage
API](https://docs.zepp.com/docs/reference/side-service-api/settings-storage/),
[Side Service
introduction](https://docs.zepp.com/docs/1.0/guides/framework/side-service/intro/)).
It does not promise the opposite either, and whether the Zepp app's own
backups (Android auto backup, iCloud) include it is undocumented.

**Checked once, 2026-09-27, weak signal.** A test Token was enrolled, the
Zepp phone app uninstalled and reinstalled from the store, and the account
signed in again: the Settings App came up empty. That is consistent with
phone-local storage but proves little — a sideloaded developer app may be
treated differently from a Store Listing, no OS backup was forced in
between, and only one phone platform was tried. A Token that _had_ come back
would have been conclusive the other way. Treat "phone-local" as the
documentation's claim with one observation behind it, and repeat the check
after a Store Listing, with OS app backup disabled beforehand so Zepp's own
servers are the only channel left.

Two smaller consequences of the same store, accepted rather than fixed:

- **Manual Entry drafts persist.** The Settings App has no state between
  renders other than settings storage, so a Secret typed into Manual Entry
  sits under `manualSecret` until Add or Reset to defaults. It is the same
  plaintext store as the Token set, so this adds nothing new to expose.
- **The watch forgets deleted Tokens.** Tokens are memory-only, but the
  prepared HMAC keys and cached Codes are keyed by Secret and were kept until
  the app exited. Every Sync now drops the entries of Tokens it no longer
  carries (`retainTokens`).

URI Paste keeps nothing: the pasted text leaves settings storage once it has
rendered, on error as on success, and the parser's error messages never quote
the input, since both the settings key and the bridge log would show it.
