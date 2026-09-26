import { appendDiag, asDiagTrail, parseDiag } from "../diagTrail"

describe("appendDiag", () => {
  it("appends an entry stamped with the time", () => {
    expect(appendDiag(["1000 init"], "build", 2_500)).toEqual([
      "1000 init",
      "2500 build"
    ])
  })

  it("keeps only the last 40 entries", () => {
    let trail: string[] = []
    for (let i = 0; i < 41; i++) trail = appendDiag(trail, `e${i}`, i)

    expect(trail).toHaveLength(40)
    expect(trail[0]).toBe("1 e1")
  })
})

describe("parseDiag", () => {
  it("reads a stored trail", () => {
    expect(parseDiag('["1 init"]')).toEqual(["1 init"])
  })

  it.each([undefined, "not json", "{}", "[1]"])(
    "starts afresh from %s",
    stored => {
      expect(parseDiag(stored)).toEqual([])
    }
  )
})

describe("asDiagTrail", () => {
  it("accepts an array of strings only", () => {
    expect(asDiagTrail(["a"])).toEqual(["a"])
    expect(asDiagTrail("a")).toBeUndefined()
  })
})
