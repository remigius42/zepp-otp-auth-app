import { gettext } from "i18n"

/**
 * Phase 1 probe for §3.6: does a settings-page rebuild preserve scroll
 * position?
 *
 * The Settings App re-runs `build()` on every settings-storage write. If that
 * also resets scroll position, then the flat Token list — rename `TextInput`
 * plus `↑` `↓` `✕` per Token — degrades into scroll-tap-hunt as soon as the
 * list is longer than a screen, and the `Select`-plus-single-editor fallback
 * wins instead.
 *
 * The probe is deliberately crude: enough rows to guarantee scrolling, and a
 * `Toggle` at the bottom whose only job is to trigger a rebuild. Scroll down,
 * tap it, and see where the page ends up. The counter proves the rebuild
 * happened even if nothing moves.
 *
 * Delete along with the device probes at the end of Phase 1; see
 * docs/spike-probes.md.
 */

const PROBE_TOGGLE_KEY = "probe.scrollToggle"
const PROBE_COUNTER_KEY = "probe.buildCount"
const PROBE_ROW_COUNT = 30

AppSettingsPage({
  build(props) {
    const buildCount =
      Number(props.settingsStorage.getItem(PROBE_COUNTER_KEY) || "0") + 1
    props.settingsStorage.setItem(PROBE_COUNTER_KEY, String(buildCount))

    const rows = []
    for (let index = 0; index < PROBE_ROW_COUNT; index += 1) {
      rows.push(
        TextInput({
          label: `Row ${String(index)}`,
          settingsKey: `probe.row.${String(index)}`,
          placeholder: "scroll past me"
        })
      )
    }

    return View({}, [
      Section({ title: gettext("Tokens") }, [
        Text({ paragraph: true }, gettext("Tokens section description"))
      ]),
      Section({ title: "Scroll-position probe (§3.6)" }, [
        Text(
          { paragraph: true },
          `build() has run ${String(buildCount)} times. Scroll to the bottom, tap the toggle, and note whether the page stays put.`
        ),
        ...rows,
        Toggle({
          label: "Trigger a rebuild",
          settingsKey: PROBE_TOGGLE_KEY
        })
      ])
    ])
  }
})
