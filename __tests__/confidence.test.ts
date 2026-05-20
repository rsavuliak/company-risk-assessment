import { calculateConfidence } from "@/lib/confidence"
import type { RawSourceData } from "@/lib/schema"

const fullRaw: RawSourceData = {
  ch_profile: { company_name: "Acme Ltd", date_of_creation: "2020-01-15" },
  ch_officers: { items: [{ name: "Jane Smith" }] },
  ch_filings: { items: [] },
  adverse_media: [],
  director_network: [{ links: {} }],
}

describe("calculateConfidence", () => {
  it("returns score=1 when all sources populated", () => {
    const result = calculateConfidence(fullRaw)
    expect(result.score).toBe(1)
    expect(result.fields_populated).toBe(7)
    expect(result.fields_total).toBe(7)
  })

  it("penalises null adverse_media (source errored)", () => {
    const raw = { ...fullRaw, adverse_media: null }
    const result = calculateConfidence(raw)
    expect(result.score).toBeLessThan(1)
    expect(result.fields_populated).toBe(6)
  })

  it("does NOT penalise empty adverse_media array (clean result)", () => {
    const raw = { ...fullRaw, adverse_media: [] }
    const result = calculateConfidence(raw)
    expect(result.fields_populated).toBe(7)
  })

  it("penalises null ch_profile", () => {
    const raw = { ...fullRaw, ch_profile: null }
    const result = calculateConfidence(raw)
    expect(result.fields_populated).toBe(5)
  })

  it("returns score=0 when all sources null", () => {
    const empty: RawSourceData = { ch_profile: null, ch_officers: null, ch_filings: null, adverse_media: null, director_network: null }
    const result = calculateConfidence(empty)
    expect(result.score).toBe(0)
  })
})
