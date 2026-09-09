/// <reference types="@zeppos/device-types" />

/**
 * Ambient declarations for the parts of Zepp OS that `@zeppos/device-types`
 * does not cover.
 *
 * Two gaps, both structural rather than accidental:
 *
 * 1. `@zeppos/device-types` types the **Device App** API only. The Settings App
 *    and Side Service run in the Zepp phone app and have no published typings.
 * 2. The typings track API_LEVEL 4.0 while the target device is 4.2, so newer
 *    surface is missing regardless.
 *
 * Keep this file minimal and delete entries as upstream typings catch up.
 */

/**
 * Per-platform layout modules, resolved by the Zeus loader at build time. The
 * round layout is re-exported so the page gets exact types; add a union here if
 * a second screen geometry is ever targeted.
 */
declare module "zosLoader:./index.[pf].layout.js" {
  const styles: typeof import("./page/index.r.layout")
  export = styles
}

/**
 * Phone-side i18n. Note this is a different module from the device's
 * `@zos/i18n`, despite doing the same job — see the porting analysis §3.7.
 */
declare module "i18n" {
  export function gettext(key: string): string
}

/** Side Service entry point. */
declare function AppSideService(options: {
  onInit?: () => void
  onRun?: () => void
  onDestroy?: () => void
  [key: string]: unknown
}): void

/** Settings App entry point. */
declare function AppSettingsPage(options: {
  state?: Record<string, unknown>
  build: (props: SettingsProps) => unknown
  [key: string]: unknown
}): void

interface SettingsProps {
  settingsStorage: {
    getItem(key: string): string
    setItem(key: string, value: string): void
    removeItem(key: string): void
    clear(): void
    toObject(): Record<string, string>
  }
}

/**
 * Settings App UI components. They are injected as globals rather than
 * imported, and each returns an opaque render function.
 */
type SettingsRenderFunc = unknown

declare function Section(
  props: Record<string, unknown>,
  children?: SettingsRenderFunc[]
): SettingsRenderFunc
declare function Text(
  props: Record<string, unknown>,
  children?: string | SettingsRenderFunc[]
): SettingsRenderFunc
declare function TextInput(props: Record<string, unknown>): SettingsRenderFunc
declare function Button(props: Record<string, unknown>): SettingsRenderFunc
declare function Toggle(props: Record<string, unknown>): SettingsRenderFunc
declare function Select(props: Record<string, unknown>): SettingsRenderFunc
declare function Link(props: Record<string, unknown>): SettingsRenderFunc
declare function View(
  props: Record<string, unknown>,
  children?: SettingsRenderFunc[]
): SettingsRenderFunc
