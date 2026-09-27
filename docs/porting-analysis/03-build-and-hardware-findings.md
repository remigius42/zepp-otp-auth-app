<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage jsQR getUserMedia Lisoveliy ZoLArk manujedi typedarrays -->

# 3. Target platform mapping: build and hardware findings

Part of the [porting analysis](./README.md).

## 3.9 Getting a build onto the watch

Not a design question, and not in the effort estimate — about 0.5 h, despite
an earlier note here claiming four. Recorded because the failures were
all misattributed at first, and because every message involved was actively
misleading.

**Three independent problems, presenting as one.**

1. **The Zeus CLI and the Zepp app must be the same _account_, not the same
   email address.** The phone was signed in with Google SSO; `zeus login` opens
   Zepp's universal login, which takes **email and password only — there is no
   third-party sign-in**. Registering a fresh account with the same address
   creates a different userID, and both `zeus preview` and `zeus bridge` pair by
   account. Zepp documents the workaround — bind an email to the SSO account,
   log out, use Forgot Password to set a password — but only on a page about the
   _Simulator_ (`guides/faq/third-party-login.md`), and nothing connects it to
   the CLI.
2. **`appId` must be one nobody else owns.** `1000001` was invented while
   scaffolding. The watch rejected every package carrying it. Zepp assigns
   appIds at registration and the 1000000+ block is where assigned IDs live — so
   that number is somebody's app. The template range (`20001`+) is free.
3. The app icon was below the documented minimum size. Harmless, but it was the
   only defect the build itself flagged, which made it the obvious suspect and
   cost a cycle.

**What the messages actually say.** The appId collision surfaces as
`Failed to unzip package` when installing from a preview QR, and as
`Install lite app result: failed` over the developer bridge. The account
mismatch surfaces as `No connectable online App or Simulator`. Not one of the
three names the field, the account or the file at fault.

**What worked: bisect against a stock template.** Building the Zeus
`hello-world` template unmodified and installing _that_ split the problem in one
step — it installed, so device, account and relay were fine and the fault was in
our package. Copying `build/zeus` to a scratch directory and patching one
manifest field per copy then isolated `appId` in a single round. Reading error
messages would never have got there.

**Two tools worth keeping.** `zeus bridge` beats the preview QR for iteration:
it pushes over the established connection instead of a CDN download, and it
streams device logs into the terminal. And the relay's client list can be read
directly by shimming the CLI's WebSocket — `{"type":"debug"}` is the phone,
`{"type":"development"}` is the CLI, and seeing both is the only reliable proof
that the accounts match.

## 3.10 `crypto-js` does not survive the bundler — the one wrong call that mattered

§3.1 concluded: "**`crypto-js` should be fine**: pure ES5, and the one construct
bundled libs typically need — `new Function('return this')` — is the explicitly
permitted exception." Both halves were wrong, and the second was wrong in a way
that made the first irrelevant.

**What the device says [device].** `new Function('return this')` does not throw,
but the object it returns is **not `globalThis`** — it has `Math`, so it is a
global-ish object, just not the one. And `crypto-js` fails regardless, for an
unrelated reason:

- Importing a submodule (`crypto-js/enc-hex`) yields an object with no `parse`
  method: `TypeError: not a function`.
- Importing the package root crashes the page outright:
  `TypeError: cannot read property 'WordArray' of undefined`, thrown from
  `requireLibTypedarrays` → `requireCryptoJs`.

**Why.** `crypto-js`'s UMD wrapper ends `}(this, function (CryptoJS) {…})`, so
its `root` comes from module-scope `this` — `undefined` under ESM. The Zeus
bundler's CommonJS interop then initializes `lib-typedarrays` before `core` has
finished, and `C.lib` is undefined when the typed-array extension reads it. This
is a **packaging** failure, not an engine one: `base32-decode`'s default import
works on the same device in the same bundle, and the engine has `Map`, `Set`,
`Promise`, typed arrays and working timers.

**Resolution: `@noble/hashes` 2.4.0** — MIT, zero production dependencies, pure
ESM (`"type": "module"`), so there is no UMD wrapper for the interop to get wrong. Cure53-audited
at 1.0.0, though **SHA-1 is explicitly outside the audit scope**; HMAC and
SHA-256/512 are inside it, and HMAC-SHA1 is unaffected by SHA-1's collision
weaknesses. The swap is ~15 lines in `totp.ts` and **all 36 TOTP tests pass
unchanged**, RFC vectors included, across all three algorithms.

This also closes the open question TODO.md filed under "decide consciously
rather than inherit": `crypto-js` was the app's only cryptographic dependency,
inherited from `fitbit-otp-auth-app`, and officially discontinued. The platform
forced the decision earlier than planned and in the same direction.

**Follow-on: SHA-512 had to be dropped [device].** Swapping the library exposed
a second, deeper constraint. Zepp OS runs **QuickJS 2020-07-05 compiled without
BigInt** — its own `qjsc` rejects a bare `1n` literal with
`SyntaxError: invalid number literal`, which makes this checkable on a laptop in
ten seconds. `@noble/hashes` builds SHA-512's constant table with `BigInt()` at
module load, so importing it kills the page during evaluation with the same
unhelpful `TypeError: not a function`. SHA-1 and SHA-256 pull no BigInt at all,
confirmed by bundling each in isolation.

So the app supports **SHA-1 and SHA-256 only**, a parity regression against
`fitbit-otp-auth-app`, where `crypto-js` made all three free. It is a packaging
problem rather than a mathematical one: SHA-512's round arithmetic is already
32-bit and BigInt is used only to construct the constants, so a vendored copy
with the table precomputed would restore it in ~120 lines. The RFC 6238 SHA-512
vectors are kept in the test suite as explicit rejection cases so that work
starts from a green baseline.

**And a correction to §3.1's "ES2020" claim.** zpm targets ES2020 for _our_
sources, but passes `node_modules` through at whatever level they were published
at, and the engine is older than that target implies. `@noble/hashes` uses `||=`
(ES2021) and QJSC rejected it outright. The fix belongs in our compile step,
which now bundles and lowers dependencies before Zeus sees them
([ADR-0006](../adr/0006-typescript-via-precompile-step.md)); relying on the
platform to normalize dependency syntax does not work.

**The lesson, again.** §3.1's judgement came from reading the library's source
and the platform's documentation and reasoning about them. Both readings were
locally correct and jointly useless, because the failure lives in the seam
between them — the bundler. Same conclusion as §3.2, §3.7, §4.2 and §3.8:
**only the device is authoritative.** This one cost the crypto core of the app
being non-functional on hardware while every test on the laptop stayed green.

## 3.11 Parity on hardware: what the S2–S4 session found [device]

Observed 2026-09-27 on an Active 2 with 12 Tokens. None of these showed in
tests; each cost a device run.

1. **A removed settings key reads back as `null`, not `undefined`.** The
   typings say `string | undefined`. `Number(null)` is `0`, so a cleared
   "pending delete" index pointed at the first Token forever — it showed its
   delete confirmation instead of ↑ ↓ ✕.
2. **A Settings App `TextInput` resets only when its `value` changes.** URI
   Paste cleared its key on success, but the value went from `""` to `""`, so
   the field kept the pasted URI — Secret included. Writing the input before
   removing it makes the value change.
3. **Computing Codes on every tick is the port's own regression.** The Fitbit
   app caches each Code per Period and pre-computes the next one at random
   (`TokenPasswordCache`); the port ran one HMAC per Token per second. With
   11 Tokens the slowest tick took **2973 ms** and blocked scrolling. The
   cache is ported now; whether 12 `UPDATE_ITEM`s per tick are cheap enough
   is still unmeasured.
4. **ZML's handshake can throw synchronously.** `request()` calls `fork()`,
   which sends the handshake outside its own `try`; when `ble.send` fails just
   after Bluetooth returns, the throw escapes `request()` instead of rejecting
   its promise. A caller that only handles rejection is left waiting forever.
5. **The round screen is narrow at the top.** At y ≈ 30 px the 466 px circle is
   only ~228 px wide; a 300 px text band there cut the clock-sync message off.
   It is a system toast now.
6. **Every Sync as `UPDATE_DATA` jumps the list to the top** — the same effect
   §3.5.1 found for ticks. Syncs that keep the row count now patch rows too.

## 3.12 Phase 4's first device session [device]

Observed 2026-09-27 on an Active 2 with 10 Tokens. Fixes are unverified.

1. **ZML's `timeout` does not always fire.** A pull sent just after
   Bluetooth returned neither resolved nor rejected for 45 s despite a 10 s
   timeout. The page now races the pull against its own timer.
2. **A re-created `SCROLL_LIST` keeps its old text colors.** Deleted and
   created again with new `item_config` colors, the list showed the new arc
   frames (they are data) in the old text colors. A freshly opened page
   colors correctly, so a scheme change re-launches the page.
3. **Random pre-computing still stacks HMACs.** With the cache from §3.11,
   the slowest tick was 1331 ms while its `UPDATE_ITEM`s took 11 ms: several
   Tokens rolled a pre-compute in the same tick. Now one Token per tick
   computes ahead.
4. **The Settings App's first render ignores some props.** On first view a
   `Select`'s field is empty and a flex row of buttons stacks; after any
   rebuild both render as specified. A `Select`'s `title` renders as a line
   above its label, and a `TextInput`'s `placeholder` shows only in its edit
   dialog.
