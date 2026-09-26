<!-- spell-checker:ignore Zepp zeus zos Amazfit -->

# Phase 1 spike probes — runbook

Diagnostic scaffolding for the questions in TODO.md's Phase 1 list. It exists to
turn "probably" into a recorded observation, and it is deleted at the end of
Phase 1 along with `SPIKE_TOKEN`.

Everything here needs the actual watch. Nothing in it can be answered from the
simulator alone with any confidence, because the open questions are precisely
the ones where the documentation, the typings and the runtime disagree.

## What is where

| File                            | Answers                                                               |
| ------------------------------- | --------------------------------------------------------------------- |
| `src/page/probe/index.ts`       | Runtime: `Promise`, `Map`, `new Function`, crypto, timers, storage    |
| `src/page/probe/scrollList.ts`  | §3.5: `UPDATE_ITEM` vs `UPDATE_DATA`, and whether `fill_view` renders |
| `src/setting/index.ts`          | §3.6: does a settings rebuild preserve scroll position                |
| `src/page/probe/probeScreen.ts` | The line renderer the probes share                                    |

The main page gets a **Probes** button, which is the only way in: Zepp OS
launches the first page in `app.json` and offers no page picker.

## Running it

```sh
npm run dev      # compile, then `zeus dev` — sideload and stream the console
```

The screen is a convenience. **The `console.log` transcript is the record** —
every probe line is logged as well as rendered, so a session yields text that
goes straight into the write-up. Capture it.

## What to look for

### 1. Runtime probe (`page/probe/index`)

Reads as a checklist; `✓` lines need no interpretation. Two things are not
self-explanatory:

- **`prop keys: …`** in the transcript. This is the §3.5 answer. `prop` is
  handed over by the runtime, so if `UPDATE_ITEM` is not in it, per-row patching
  does not exist on this device, whatever the widget reference says.
- **Lifecycle counts.** They are persisted in `localStorage`, so they survive
  the page. The sequence that answers "does `Page` get `onResume`/`onPause`?":
  1. Open the probe page. Note the counts.
  2. Press the crown / swipe back to the watch face, then return to the app.
  3. Open the probe page again and compare.

  If `onResume` and `onPause` stay at 0 while `build` climbs, the page is torn
  down and rebuilt rather than resumed — which is what
  `@zeppos/device-types` 4.0 implies, and it means the countdown timer has no
  hook to stop on. Reset with the button when the numbers get confusing.

### 2. `SCROLL_LIST` probe (`page/probe/scrollList`)

The pivotal one. Three observations, in order:

1. **Does `fill_view` render?** Each row should show an amber bar on the left.
   If it does, rows admit a third child type the porting analysis said they did
   not, a native per-row progress bar exists, and **ADR-0005's pre-rendered arc
   frames may be unnecessary**. Record whether its geometry can be driven from
   the row's data — the probe binds it to a `bar` key.
2. **`UPDATE_ITEM`.** Tap it. Either the status line reports it absent, or it
   reports "accepted" — in which case check that **row 0 alone** changed. An
   accepted call that silently redraws everything is not a per-row patch.
3. **`UPDATE_DATA`, and then `1 Hz auto`.** Scroll down first, then tap. The
   question is not whether it works but whether scroll position survives. Then
   start the 1 Hz refresh and **try to scroll while it runs** — that is the real
   countdown scenario, and the one that decides whether the countdown can live
   inside the list at all.

### 3. Settings scroll-position probe

In the Zepp app, open the mini program's settings. Scroll to the bottom of the
30-row probe section, tap **Trigger a rebuild**, and note where the page lands.
The build counter proves the rebuild happened even if nothing visibly moves.

If scroll position resets, the flat Token list (§3.6) degrades into
scroll-tap-hunt once the list is longer than a screen, and the
`Select`-plus-single-editor fallback wins.

## Recording the answers

Findings graduate to `docs/ZEPP_OS_PORTING_ANALYSIS.md`; decisions that needed
reasoning graduate to `docs/adr/`. The dead ends and corrections are the most
interesting material for the write-up, so record what was expected as well as
what happened.
