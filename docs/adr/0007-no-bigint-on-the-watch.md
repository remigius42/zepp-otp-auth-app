# The watch has no BigInt, so SHA-512 is unsupported until vendored

Zepp OS runs **QuickJS 2020-07-05 compiled without BigInt**: `typeof BigInt` is
`"undefined"` on an Active 2, and the shipped `qjsc` rejects a `1n` literal at
build time. Nothing in the code says so, and nothing on the laptop fails — every
test stays green under Node. We treat it as a hard platform constraint:
**no device bundle may contain BigInt**, enforced by `npm run check:engine`
rather than by review.

Its first casualty is SHA-512. `@noble/hashes` builds SHA-512's constant table
with `BigInt()` at module load, so importing it kills the page during evaluation
with an unhelpful `TypeError: not a function`. The app therefore supports
**SHA-1 and SHA-256 only** — a deliberate parity regression against
`fitbit-otp-auth-app`, where `crypto-js` made all three free (§3.10).

## Considered options

- **Ship without SHA-512** (chosen). SHA-1 covers nearly every real issuer, and
  the Token list and Sync matter more to Phase 2 than a third algorithm.
- **Vendor noble's SHA-512 now**, with the K table precomputed as two
  `Uint32Array` literals. ~120 lines, MIT, needs attribution. The round
  arithmetic is already 32-bit; only the constants need BigInt. Deferred, not
  rejected — this is the restore path.
- **Hand-roll all of HMAC-SHA1/256/512.** Rejected as engineering; kept open as
  a write-up exercise.

## Consequences

- **Upgrading or swapping a crypto dependency is a device test, not a laptop
  test.** A future import of `sha512` from `@noble/hashes` passes every unit
  test and breaks the watch.
- **Enrollment validates the algorithm — which is net-new.** Fitbit's
  `validateConfig` only checked it was non-empty, and `keyUri` passes any string
  through; unknown algorithms failed at Code time. Here:
  1. Never fall back to SHA-1 silently — a plausible wrong Code is worse than a
     crash.
  2. Reject at Enrollment, naming SHA-512 as a known limitation of this app,
     not as an invalid URI — and distinct from the percent-escaping message
     (ADR-0001).
  3. Match algorithm names case-insensitively; some issuers emit lowercase.
  4. Validate again in the Side Service before Sync, so one unsupported Token
     cannot break the watch's whole list.
- **Bulk Import skips rather than fails**: a payload with one SHA-512 Token
  among twenty imports the nineteen and names the one it skipped.
- The RFC 6238 SHA-512 vectors stay in `totp.spec.ts` as rejection cases;
  moving them back is the acceptance criterion for restoring it.
- Belongs in the README and the write-up next to ADR-0003 and ADR-0004.
