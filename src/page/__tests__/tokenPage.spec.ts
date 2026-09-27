/* spell-checker:ignore GEZDGNBVGY3TQOJQ MFRGGZDFMZTWQ */

import { ColorSchemeName } from "../../shared/ColorSchemes"
import { afterSync, rowFromParams } from "../tokenPage"

const TOKEN = {
  label: "john",
  issuer: "GitHub",
  secret: "GEZDGNBVGY3TQOJQ",
  algorithm: "SHA1",
  digits: "6",
  period: "30"
}

const OTHER = { ...TOKEN, label: "jane", secret: "MFRGGZDFMZTWQ" }

const SETTINGS = {
  colorScheme: ColorSchemeName.default,
  shouldUseLargeTokenView: false
}

describe("rowFromParams", () => {
  it("reads the row index", () => {
    expect(rowFromParams("0")).toBe(0)
    expect(rowFromParams("12")).toBe(12)
  })

  it("rejects anything but a row index", () => {
    for (const params of [undefined, "", " ", "-1", "1.5", "x", "{}"]) {
      expect(rowFromParams(params)).toBeUndefined()
    }
  })
})

describe("afterSync", () => {
  it("stays on an unchanged row", () => {
    expect(afterSync(TOKEN, [OTHER, TOKEN], SETTINGS, SETTINGS)).toEqual({
      kind: "show",
      row: 1
    })
  })

  it("follows a renamed Token", () => {
    const renamed = { ...TOKEN, displayName: "Work" }

    expect(afterSync(TOKEN, [renamed], SETTINGS, SETTINGS)).toEqual({
      kind: "show",
      row: 0
    })
  })

  it("follows a Token to its new row", () => {
    expect(afterSync(TOKEN, [OTHER, TOKEN], SETTINGS, SETTINGS)).toEqual({
      kind: "show",
      row: 1
    })
  })

  /* On hardware the Test Tokens all shared one Secret, and a move or delete
   * showed whichever Token then held the row. */
  it("tells apart Tokens that share a Secret", () => {
    const twin = { ...TOKEN, label: "jane" }

    expect(afterSync(TOKEN, [twin, TOKEN], SETTINGS, SETTINGS)).toEqual({
      kind: "show",
      row: 1
    })
    expect(afterSync(TOKEN, [twin], SETTINGS, SETTINGS)).toEqual({
      kind: "back"
    })
  })

  it("returns to the list when its Token is gone", () => {
    expect(afterSync(TOKEN, [OTHER], SETTINGS, SETTINGS)).toEqual({
      kind: "back"
    })
    expect(afterSync(TOKEN, [], SETTINGS, SETTINGS)).toEqual({
      kind: "back"
    })
  })

  it("re-launches on a new color scheme", () => {
    const white = { ...SETTINGS, colorScheme: ColorSchemeName.white }

    expect(afterSync(TOKEN, [OTHER, TOKEN], SETTINGS, white)).toEqual({
      kind: "relaunch",
      row: 1
    })
  })

  it("ignores the enlarged view, which it does not use", () => {
    const large = { ...SETTINGS, shouldUseLargeTokenView: true }

    expect(afterSync(TOKEN, [TOKEN], SETTINGS, large)).toEqual({
      kind: "show",
      row: 0
    })
  })
})
