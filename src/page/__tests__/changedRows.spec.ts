import { changedRows } from "../changedRows"

const row = (name: string, code: string, arc: string) => ({ name, code, arc })

describe("changedRows", () => {
  it("finds no rows when nothing changed", () => {
    const rows = [row("A", "123 456", "arc/default/3.png")]

    expect(
      changedRows(
        rows,
        rows.map(r => ({ ...r }))
      )
    ).toEqual([])
  })

  it("finds the rows whose Code or arc changed", () => {
    const prev = [
      row("A", "123 456", "arc/default/3.png"),
      row("B", "234 567", "arc/default/3.png"),
      row("C", "345 678", "arc/default/3.png")
    ]
    const next = [
      row("A", "123 456", "arc/default/4.png"),
      row("B", "234 567", "arc/default/3.png"),
      row("C", "999 999", "arc/default/3.png")
    ]

    expect(changedRows(prev, next)).toEqual([0, 2])
  })

  it("finds a text countdown change too", () => {
    expect(
      changedRows(
        [{ name: "A", code: "123 456", countdown: "23s" }],
        [{ name: "A", code: "123 456", countdown: "22s" }]
      )
    ).toEqual([0])
  })
})
