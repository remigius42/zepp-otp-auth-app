/**
 * Phase 1 probe for §3.6: does a settings-page rebuild preserve scroll
 * position?
 *
 * **Derived from the shipped `todo-list` template**, not from the
 * documentation: same `state` / `setState` / `build(props)` shape, same
 * components, same rule that settings storage is written only from event
 * handlers. Four earlier versions of this file were written from Zepp's prose
 * docs and the Fitbit app's idiom, and all four rendered blank — the template
 * was in `node_modules` the whole time.
 *
 * Two constraints the template encodes implicitly, both of which the earlier
 * versions broke:
 *
 * 1. **`View` is the root, and the vocabulary is `View`, `TextInput`,
 *    `Button`.** The template never uses `Section`, `Text` or `Toggle`.
 * 2. **`build()` must not write to settings storage.** A write fires
 *    `settingsChanged`, which re-runs `build()`, which writes again. A counter
 *    incremented inside `build()` reached 26 rebuilds in one burst and woke the
 *    Side Service on each, which is why the page never settled.
 *
 * Delete along with the device probes at the end of Phase 1; see
 * docs/spike-probes.md.
 */

const PROBE_COUNTER_KEY = "probe.rebuildCount"
const PROBE_ROW_COUNT = 30

interface ProbeSettingsPage {
  state: { props: SettingsProps | undefined; rebuilds: string }
  setState(props: SettingsProps): void
  triggerRebuild(): void
  build(props: SettingsProps): SettingsRenderFunc
}

const probeSettingsPage: ProbeSettingsPage & ThisType<ProbeSettingsPage> = {
  state: {
    props: undefined,
    rebuilds: "0"
  },

  setState(props: SettingsProps) {
    this.state.props = props
    this.state.rebuilds =
      props.settingsStorage.getItem(PROBE_COUNTER_KEY) || "0"
  },

  triggerRebuild() {
    const current = Number(this.state.rebuilds)
    const next = (Number.isFinite(current) ? current : 0) + 1
    this.state.props?.settingsStorage.setItem(PROBE_COUNTER_KEY, String(next))
  },

  build(props: SettingsProps) {
    this.setState(props)

    const rows: SettingsRenderFunc[] = []
    for (let index = 0; index < PROBE_ROW_COUNT; index += 1) {
      rows.push(
        View({ style: { padding: "6px 0" } }, [
          TextInput({
            label: `Row ${String(index)}`,
            settingsKey: `probe.row.${String(index)}`,
            placeholder: "scroll past me"
          })
        ])
      )
    }

    return View({ style: { padding: "12px 20px" } }, [
      View({ style: { fontSize: "14px", marginBottom: "12px" } }, [
        TextInput({
          label: `rebuilds triggered: ${this.state.rebuilds}`,
          disabled: true
        })
      ]),
      ...rows,
      Button({
        label: "Trigger a rebuild",
        style: {
          fontSize: "14px",
          lineHeight: "30px",
          borderRadius: "30px",
          background: "#409EFF",
          color: "white",
          textAlign: "center",
          marginTop: "12px"
        },
        onClick: () => {
          this.triggerRebuild()
        }
      })
    ])
  }
}

AppSettingsPage(probeSettingsPage)
