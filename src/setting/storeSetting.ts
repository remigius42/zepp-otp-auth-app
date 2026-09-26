import type { SettingsStorage } from "./uriPaste"

/**
 * A Settings control changed. JSON-encoded, as `settingsFromStorage` reads
 * it; the write wakes the Side Service, which pushes a Sync.
 */
export function storeSetting(
  storage: Pick<SettingsStorage, "setItem">,
  key: string,
  value: unknown
) {
  storage.setItem(key, JSON.stringify(value))
}
