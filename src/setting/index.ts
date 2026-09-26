import { gettext } from "i18n"

/**
 * Settings App — placeholder until the Token list arrives in Phase 2.
 *
 * Built from `View`, `TextInput` and `Button` only, copied from the shipped
 * `todo-list` template. `Section`, `Text` and `Toggle` are documented but
 * unverified on hardware and should be confirmed individually before anything
 * depends on them; see docs/ZEPP_OS_PORTING_ANALYSIS.md §3.6.1.
 *
 * Two constraints from the spike, both of which apply to the real list:
 *
 * - **`build()` must not write to settings storage.** The write fires
 *   `settingsChanged`, which re-runs `build()`, which writes again.
 * - **Every settings write wakes the Side Service** with the changed key, which
 *   is the push trigger the sync protocol uses (ADR-0002).
 */
AppSettingsPage({
  build() {
    return View({ style: { padding: "12px 20px" } }, [
      TextInput({ label: gettext("Tokens"), disabled: true })
    ])
  }
})
