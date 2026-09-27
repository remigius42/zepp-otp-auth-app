<!-- spell-checker:ignore Zepp zeus zml nuintun qrcode Amazfit otpauth localStorage settingsStorage jsQR getUserMedia Lisoveliy ZoLArk manujedi typedarrays -->

# 11. Decisions and remaining questions

Part of the [porting analysis](./README.md).

Resolved in the design session of 2026-09-09. See `CONTEXT.md` for the glossary
and `docs/adr/` for the decisions that needed reasoning recorded.

| #   | Question                                    | Resolution                                                                                                                                                                                                              |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Is losing one-tap QR enrollment acceptable? | **Moot — QR survives as file import** (§4.2). v1 ships Manual Entry + URI Paste; text file import (~3–4 h) and image QR decode (~4–6 h) follow after parity. Hosted scanning stays rejected on trust grounds — ADR-0001 |
| 2   | One device target or a family?              | **Active 2 round (466 × 466) only.** No responsive layer, but all coordinates in one layout-constants module so a second geometry is a data change                                                                      |
| 3   | Store release or sideload?                  | **Neither is the goal.** Public Repo + a project page on binarypoetry.ch are the deliverables; a Store Listing is a deferred byproduct                                                                                  |
| 4   | Shared `common/` or separate repo?          | **Separate repo, code copied** with attribution. The two will diverge (§3.1), copying brings the tests along, and a frozen Fitbit repo shouldn't be coupled to a live one                                               |
| 5   | Build or contribute to TOTPFit?             | **Build** — see §8.4                                                                                                                                                                                                    |
| 6   | Add `otpauth-migration://` Bulk Import?     | **Yes, import-only, after parity** (§10 step 5)                                                                                                                                                                         |
| —   | Reorder, with no list component?            | **Move-up/move-down buttons per Token** in the Settings App                                                                                                                                                             |
| —   | Transport?                                  | **`@zeppos/zml`**, protocol collapsed to one message — ADR-0002                                                                                                                                                         |
| —   | Phone-side connection status?               | **Dropped**; ZML exposes BLE state on the device only — ADR-0003                                                                                                                                                        |
| —   | On-watch Token storage?                     | **Not initially**; revisit if the connection proves unstable — ADR-0004                                                                                                                                                 |
| —   | Color schemes?                              | **Three** — binary poetry, white, black (§3.3)                                                                                                                                                                          |
| —   | Linter and test runner?                     | **oxlint** (timeboxed, ESLint 9 as fallback) and **Vitest**; everything else copied from the `vite-press` repo's current stack. §6.5's "modernize the Fitbit repo first" is dropped — that repo stays frozen            |
| —   | Coverage floor?                             | **≥ 80 % per file** (`perFile: true`), with explicit `coverage.exclude` entries for genuinely untestable UI rather than a lower threshold (§6.3)                                                                        |
| —   | Settings App token list?                    | **Flat in-place list** — rename `TextInput` plus `↑` `↓` `✕` per Token; `Select`-plus-single-editor as the fallback (§3.6)                                                                                              |
| —   | i18n?                                       | **Straight copy.** All three surfaces are `.po`-based; the phone side keeps `import { gettext } from 'i18n'` verbatim (§3.7)                                                                                            |

Still open:

1. **Device UI shape** (§3.5) — how the per-row countdown is rendered, given
   `SCROLL_LIST` rows admit only `text_view` and `image_view` children. Blocked
   on the spike question of whether `UPDATE_ITEM` exists. The 10 h line and the
   largest remaining unknown.
2. **Partly answered** (§7.1): the store holds five authenticators, all
   third-party, publishers and dates shown — there is no first-party Zepp app,
   so nobody has privileged camera access. What is still unobserved is **how any
   of them enrolls accounts**. The one worth installing is **galulex's
   "Authenticator" (2026-08-01)**, the newest and the likely subject of the press
   coverage. The question that matters: does its settings page use any component
   outside the public Settings App set? If not, §4.2 holds for everyone.
3. Whether Zepp **developer mode** broadens on-watch file access. It does not
   affect ADR-0004's outcome, but it decides how strongly the docs should warn
   if Token storage is ever added back.
