/**
 * The phone-side settings storage, as the Settings App's `settingsStorage`
 * and the Side Service's `settingsLib` both provide it. Structural rather
 * than `SettingsProps["settingsStorage"]`, so shared code does not depend on
 * the Settings App's ambient declarations.
 */
export interface SettingsStorage {
  getItem(key: string): string | undefined
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
