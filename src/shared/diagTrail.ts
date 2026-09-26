/**
 * The watch's diagnostic trail. Watch `console.log` never reaches `zeus
 * bridge`, so the page appends events here, keeps them in `localStorage`
 * across launches, and sends them with the next launch pull; the Side
 * Service stores them in a settings key, whose writes the bridge does log.
 * Temporary: remove once S2 is verified on hardware (TODO.md).
 */
const MAX_ENTRIES = 40

export function appendDiag(
  trail: string[],
  entry: string,
  nowMs: number
): string[] {
  return [...trail, `${nowMs} ${entry}`].slice(-MAX_ENTRIES)
}

/** A stored trail, or an empty one if absent or malformed. */
export function parseDiag(stored: string | undefined): string[] {
  if (stored === undefined) return []
  try {
    return asDiagTrail(JSON.parse(stored)) ?? []
  } catch {
    return []
  }
}

/** `value` if it is an array of strings, else `undefined`. */
export function asDiagTrail(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every(entry => typeof entry === "string")
    ? (value as string[])
    : undefined
}
