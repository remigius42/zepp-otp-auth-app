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
