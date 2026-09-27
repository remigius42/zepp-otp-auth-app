# The per-row progress arc becomes pre-rendered image frames

Each row in the Token list shows a countdown arc for how much of that Token's
Period remains. On Fitbit this is a live `ArcElement` whose `startAngle` and
`sweepAngle` are mutated every second. Zepp's `SCROLL_LIST` cannot do that: an
`item_config` declares only `text_view` and `image_view` children, bound by
`key`, with no arc child and no way to nest an arbitrary widget in a row. We
render the arc as **~30 pre-rendered PNG frames per color scheme**, generated at
build time, and bind an `image_view` to the frame matching the elapsed
percentage.

## Considered options

- **Pre-rendered image frames** (chosen) — visually identical to the current
  app. 30 frames indexed by percentage covers any Period, since the index is a
  fraction rather than a second count. Three color schemes → roughly 90 small
  files.
- **Text countdown, e.g. `23s`** (chosen as fallback) — trivial and perfectly
  legible, but loses the at-a-glance analog read that makes the current list
  scannable.
- **Block-glyph progress bar in a `text_view`** — trivial, but depends on font
  glyph coverage we have not verified.
- **One global countdown for the whole list** — rejected as _wrong by
  construction_. Period is per-Token; a single countdown lies for any Token that
  is not on 30 seconds.
- **Abandon `SCROLL_LIST` and hand-build the list** from absolute-positioned
  `TEXT` and `ARC` widgets with our own recycling — rejected. It preserves the
  design exactly, but rebuilding list recycling by hand is precisely the work
  `SCROLL_LIST` exists to save, and it is the one option that could consume the
  whole schedule.

## Why frames rather than the simpler text countdown

The arc is the app's visual signature — it appears in every screenshot on the
project page. Replacing it with a number would be the most visible way in which
the port looks like a downgrade, and it would be a downgrade chosen for
convenience rather than forced by the platform.

Build-time asset generation is also an established pattern in this codebase
(`bin/generate_licenses_data.sh`), so a frame-generation script fits the existing
shape rather than introducing a new one.

## Consequences

- A build script generates the frames; the frames are build output, not
  hand-maintained assets, and should not be committed as source of truth.
- **Color schemes multiply the frames**, because there is no runtime tinting.
  This is a further argument for having reduced six schemes to three.
- Bundle size grows by roughly 90 small PNGs. Acceptable, but worth measuring
  against Zepp's package limits during the spike.
- **Conditional on an unresolved platform question.** Zepp's documentation
  disagrees with itself on whether `SCROLL_LIST` supports a per-row
  `setProperty(prop.UPDATE_ITEM, { index, item_data })` patch or only a
  whole-array `prop.UPDATE_DATA` refresh. If it is whole-array only, refreshing
  at 1 Hz may reset scroll position and focus mid-scroll, and the countdown may
  have to move out of the list entirely. This is a spike item.
- **Falling back is cheap**: option (b) binds a different value to the same row
  `key`. If frame-swapping at 1 Hz turns out to be janky on real hardware, the
  change is small and local.

## Confirmed on hardware, 2026-09-26

The spike answered both open questions, and the decision stands.

- **Per-row patching exists.** `prop.UPDATE_ITEM` is `66` on an Active 2
  (round), and patching index 0 visibly changes that row alone. The condition
  this ADR was hedged against does not apply, so the countdown stays inside the
  list.
- **Whole-array refresh is confirmed unusable for the countdown.** A 1 Hz
  `prop.UPDATE_DATA` refresh scrolls the list back to the top on every tick.
  That rules out the alternative rather than merely making it unattractive.
- **`fill_view` is not an escape hatch.** Rows do admit a `fill_view` child —
  the porting analysis was wrong to say text and image only — but its data
  `key` binds the fill **color**, not any geometry: binding `0xffd502`,
  `0xff0000` and `0x00ff00` produced amber, red and green bars of identical
  size. So it cannot express progress, and pre-rendered frames in an
  `image_view` remain the way to draw a per-row arc.

Layout note for whoever builds the real rows: in the probe, a child at
`x: px(12)` was clipped by the round screen's corner. Row children need a
horizontal inset well beyond the nominal bounds, and how much depends on
vertical position. That belongs to the §5 round-screen tuning line, but it is
cheaper to design for than to retrofit.

## Amendment, 2026-09-26: how the frames are made

- **Generator:** `bin/generate-arc-frames.mjs`, dependency-free — rasterizes
  with 4×4 supersampling and encodes PNG via `node:zlib`. zpm converts asset
  PNGs to TGA during `zeus build`, so the script never touches TGA.
- **Look:** Fitbit's — full ring in the secondary color, the remaining part of
  the Period in the primary color over it, clockwise from 12 o'clock. Opaque
  background in the scheme's background color; alpha through the TGA
  conversion is unverified.
- **Count and size:** 30 frames × 3 schemes, 64×64 at native resolution.
  Frame index is `floor(elapsedFraction × 30)`; frame 0 is a full ring.
- **Location:** `src/assets/default.r/arc/<scheme>/<n>.png`, gitignored and
  regenerated on build, like `src/setting/licenses.js`.
- **Size risk:** uncompressed TGA is ~16 KB a frame, ~1.5 MB in all. If the
  `.zab` or install time is unacceptable, shrink to 48 px before cutting
  frames.
- **Fallback trigger**, any of: janky swapping at 1 Hz on hardware; frames not
  rendering; a tick over 250 ms with 12 Tokens; bundle still unacceptable at
  48 px. The fallback binds a text countdown to the same row slot.

## Amendment, 2026-09-27: 60 frames, not 30

On hardware, with 30 s and 60 s Tokens side by side, the 60 s arcs seemed to
lag: 30 frames over 60 s step only every 2 s, while 30 s arcs step every
second. **60 frames per scheme** give a 60 s Token one step a second and a 30 s
Token two, so both move at the list's 1 Hz tick. Periods over 60 s still step
less than once a second, which is acceptable since they are rare.

The cost is small: 90 frames took 553 KB unpacked and 150 KB in the device
`.zab`, far below the ~1.5 MB of uncompressed TGA feared above, because the
flat-colored frames compress well.

## Amendment, 2026-09-27: the fallback stays unused

The first 12-Token run hit the 250 ms trigger hard: the slowest tick took
2973 ms. The frames weren't the cause, though: every tick ran one HMAC per
Token, which the Fitbit app never did (analysis §3.11). With the Code cache in
place, **`ARC_FALLBACK` stays `false`.** The countdown fallback would not help
anyway: `23s` also changes every row every second, so it costs the same
`UPDATE_ITEM`s as a frame swap. The frames rendered, 8-digit Codes fit beside
them, and the trail now times the `UPDATE_ITEM`s separately. If they alone
pass 250 ms, the answer is fewer updates per tick, not text instead of
images.

The `.zab` with 60 frames is 2.44 MB (1.57 MB with 30).
