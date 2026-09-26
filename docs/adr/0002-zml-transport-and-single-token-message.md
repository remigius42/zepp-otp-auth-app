# `@zeppos/zml` as the Sync transport, and one message per Sync

Sync needs to push the full set of Tokens from the phone to the watch:
unidirectional, phone-initiated, fire-and-forget, structured objects. Both
`@zos/ble` and `@zeppos/zml` can carry that. We chose **ZML**, because reading
its source (v0.0.41) showed it removes the two things that made this the
riskiest line in the estimate — manual chunking and manual serialization — and
its `call`/`onCall` pair is exactly this shape. Consequently we also **collapse
the start/token/end fragmentation envelope into a single
`UPDATE_TOKENS_MESSAGE`** carrying the whole array.

## Why ZML over `@zos/ble`

The prose documentation answers almost none of this; the source answers all of
it. From `zepp-health/zml` at v0.0.41:

- **It chunks.** `MESSAGE_SIZE = 3600`, `MESSAGE_HEADER = 16`,
  `HM_MESSAGE_PROTO_HEADER = 66` → roughly 3 518 usable bytes per chunk. It
  splits, tags each chunk with a `seqId`, sorts on receipt, validates the
  reassembled length and throws on mismatch. Out-of-order delivery is handled.
- **It serializes objects** (`JSON.stringify`/`parse` in `src/shared/data.js`).
  The raw Messaging API underneath is binary-only and, in Zepp's own words,
  "developers need to convert the data structure themselves".
- **`this.call({ method, params })` → device `onCall(data)`** is unidirectional
  push from the Side Service, which is precisely what Sync is. ZML's headline
  feature — device-side `httpRequest` proxied through the phone — is the
  opposite direction and goes unused, and that is fine.
- **It brings the settings layer too**: `settingsLib` and `onSettingsChange` on
  `base-side` are direct analogues of Fitbit's `settingsStorage` and its
  `change` listener.
- Its API_LEVEL floor of 3.6 (since ZML 0.0.28) is free on an API 4.x target.

`@zos/ble` remains the documented fallback. To keep that real, the application
protocol in `common/PeerMessage.ts` stays independent of the transport, with a
thin adapter beneath it. Swapping transports should be one file, not a
rewrite — which is also what makes this decision cheap to revisit.

## Why one message instead of start/token/end

The Fitbit app sends an `UPDATE_TOKENS_START_MESSAGE` carrying a `count`, then
one `UPDATE_TOKENS_TOKEN_MESSAGE` per Token carrying an `index`, then an
`UPDATE_TOKENS_END_MESSAGE`. That envelope exists for exactly one reason, which
the original TSDoc states outright: Fitbit's `peerSocket` had a
`MAX_MESSAGE_SIZE` of about 1 KB, so the application layer had to fragment.

ZML already guarantees ordering and completeness. Keeping `count` and `index`
would layer a second integrity mechanism on a transport that has one, and
neither mechanism would be exercised in practice. A Sync is always the full set
of Tokens, so a single message carrying the array loses nothing.

## Consequences

- `TokenManager`'s message-assembly tests are **rewritten, not inherited** —
  the reassembly logic they cover ceases to exist. This is one of the few places
  where the port loses existing test coverage rather than carrying it over.
- The estimate for this layer drops from 6 h to 4 h.
- If the transport is ever swapped back to `@zos/ble`, fragmentation has to come
  back with it. The adapter boundary is what makes that tractable; do not let
  application code reach past it.
- Throughput is still unmeasured. Chunking is handled, but wall-clock time to
  push a full Token set is not something the source can tell us.
- Phone-side connection state is not available through ZML — see
  [ADR-0003](./0003-no-phone-side-connection-status.md).

## Amendment, 2026-09-26: the watch pulls on launch

"Phone-initiated" was wrong. Fitbit's companion pushed on `peerSocket` `open`;
the Side Service has no such event (ADR-0003), and a `settingsChanged` launch
only fires on settings writes. With Tokens held in memory only (ADR-0004),
nothing would ever Sync a freshly opened watch app.

So Sync has two triggers and one payload:

- **Pull:** the page's `onInit` calls `request({ method: "GET_TOKENS" })`; the
  Side Service answers in `onRequest` with the whole array.
- **Push:** `onSettingsChange` on a Token key sends the same payload via `call`.
  Dropped if the page is closed — the next launch pulls.

**Per-Token messages stay rejected.** The per-key trigger makes the _trigger_
cheaper, not the payload: each write costs a process launch plus one `call`
either way, and a watch starting empty needs the full set regardless.
