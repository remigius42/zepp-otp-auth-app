<!-- spell-checker:ignore Zepp Amazfit otpauth Fitbit -->

# Zepp OTP Auth

A TOTP authenticator for Amazfit / Zepp OS watches, ported from
`fitbit-otp-auth-app`. Secrets live on the phone and are pushed to the watch;
the watch generates codes offline.

## Language

### The thing being authenticated with

**Token**:
One TOTP account the user has enrolled — its secret plus the parameters needed
to derive a code from it. The unit the user adds, renames, reorders and deletes.
_Avoid_: account, entry, credential, OTP, code (a **Code** is what a Token
produces).

**Code**:
The six-to-eight digit value a **Token** currently produces. Transient; changes
every **Period**.
_Avoid_: password, OTP, token (reserved above), TOTP.

**Secret**:
The base32 shared secret of a **Token**. The only part that is security-critical
and the only part that must never leave the user's own devices.
_Avoid_: key, seed.

**Period**:
How many seconds a **Code** stays valid. Per-**Token**, not global — two Tokens
may have different Periods.
_Avoid_: interval, validity, duration, refresh rate.

### Naming a token

Three distinct fields, routinely confused because all three end up as "the name
on screen":

**Label**:
The account identifier the issuing service put in the `otpauth://` URI, usually
an email address or username. Comes from the service; the user does not choose
it.

**Issuer**:
The service the **Token** belongs to, e.g. `GitHub`. Also from the URI. Optional.

**Display Name**:
A user-supplied override for what the watch shows. Optional; when absent the
watch falls back to Issuer + Label.
_Avoid_: name, title, alias, nickname — "name" alone is ambiguous between all
three of these.

### Getting a token into the app

**Enrollment**:
The act of getting a **Token** into the app for the first time. Distinct from
**Sync**, which moves already-enrolled Tokens to the watch.
_Avoid_: import (reserved for **Bulk Import**), adding, registration, setup.

**Manual Entry**:
Enrollment by typing the **Secret** and parameters into separate fields. The
service's "can't scan? enter this key manually" text is the input.

**URI Paste**:
Enrollment by pasting a whole `otpauth://` URI into one field. Faster than Manual
Entry but sends the **Secret** through the clipboard.

**Bulk Import**:
Enrollment of many **Tokens** at once from an authenticator's export payload,
e.g. `otpauth-migration://`. Import only — there is no export.
_Avoid_: migration (ambiguous with SDK version migration), transfer.

### Moving tokens to the watch

**Settings App**:
The configuration UI on the phone, inside the Zepp app. Where **Enrollment**
happens and **Tokens** are renamed, reordered and deleted.
_Avoid_: config app, companion, settings page.

**Side Service**:
The headless phone-side process that owns the **Tokens** and performs **Sync**.
No UI; distinct from the **Settings App**.
_Avoid_: companion, config app, background app.

**Sync**:
The watch receiving the full set of **Tokens**, plus the **Settings**, from the
**Side Service**. Either side may start it — the watch on launch, the phone when
a Token or Setting changes. Always the complete state — there is no partial or
incremental sync.
_Avoid_: transfer, update, push, transmission.

**Sync Stats**:
How many watch launches Synced and how many failed, plus recent Sync latencies.
Diagnostic evidence for the Store On Watch decision; shown read-only in the
**Settings App**.
_Avoid_: connection status (dropped — see ADR-0003), health, telemetry.

**Store On Watch**:
Persisting synced **Tokens** on the watch so it can produce **Codes** with the
phone out of range. A user setting on Fitbit; **not implemented here** — see
ADR-0004. Tokens live in memory only and a **Sync** happens on every connection.
_Avoid_: offline mode, caching, persistence.

**Settings**:
The user's app preferences — color scheme, enlarged view, **Clock Drift
Compensation**. Owned by the phone like **Tokens** and delivered by the same
**Sync**; the watch persists neither.
_Avoid_: config, preferences, options.

**Clock Drift Compensation**:
A user setting, on by default. When on, the phone sends its own wall-clock time
with every **Sync**; the watch shifts **Codes** and countdowns by the
difference. Without it, a watch a minute out of step produces wrong **Codes**.
_Avoid_: time sync, NTP.

### Shipping it

Three independent channels, previously all called "publishing":

**Public Repo**:
The GPL-3.0 source on GitHub, with releases and end-user documentation. The
baseline; assumed for this project.

**Store Listing**:
A listing in the Zepp Mini App store, reachable only from inside the Zepp phone
app and subject to curated review. Optional and deferred.
_Avoid_: publishing, release — both are ambiguous across these three.

**Sideload**:
Installing the app onto the watch via Zepp developer mode instead of a **Store
Listing**. The guaranteed distribution path; requires developer tooling on the
user's part.
