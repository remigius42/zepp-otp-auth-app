export enum ColorSchemeName {
  /** binary poetry amber on black */
  default = "default",
  white = "white",
  black = "black"
}

enum PrimaryColor {
  bp_amber = "#ffd502",
  white = "#ffffff",
  black = "#000000"
}

enum SecondaryColor {
  bp_amber_darkened = "#704d00",
  dark_grey = "#555555",
  light_grey = "#999999"
}

enum BackgroundColor {
  black = "#000000",
  white = "#ffffff"
}

export type Color = PrimaryColor | SecondaryColor | BackgroundColor

interface ColorScheme {
  primaryColor: PrimaryColor
  secondaryColor: SecondaryColor
  backgroundColor: BackgroundColor
}

export const ColorSchemes: Record<ColorSchemeName, ColorScheme> = {
  [ColorSchemeName.default]: {
    primaryColor: PrimaryColor.bp_amber,
    secondaryColor: SecondaryColor.bp_amber_darkened,
    backgroundColor: BackgroundColor.black
  },
  [ColorSchemeName.white]: {
    primaryColor: PrimaryColor.white,
    secondaryColor: SecondaryColor.dark_grey,
    backgroundColor: BackgroundColor.black
  },
  [ColorSchemeName.black]: {
    primaryColor: PrimaryColor.black,
    secondaryColor: SecondaryColor.light_grey,
    backgroundColor: BackgroundColor.white
  }
}

/**
 * Convert a scheme color to the numeric form the Zepp OS UI widgets expect.
 *
 * `@zos/ui` takes colors as 24-bit integers rather than CSS strings, so the
 * hex literals above have to be converted at widget-creation time.
 */
export function toZeppColor(color: Color) {
  return parseInt(color.slice(1), 16)
}
