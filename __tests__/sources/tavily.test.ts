import { searchAdverseMedia } from "@/lib/sources/tavily"
import tavilySearch from "../fixtures/tavily-search.json"

jest.mock("@tavily/core", () => ({
  tavily: jest.fn(),
}))

import { tavily } from "@tavily/core"

const mockSearch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(tavily as jest.Mock).mockReturnValue({ search: mockSearch })
})

describe("searchAdverseMedia", () => {
  it("returns content strings from fixture results", async () => {
    mockSearch.mockResolvedValueOnce(tavilySearch)
    const result = await searchAdverseMedia("THORNFIELD CONSULTING LIMITED")
    expect(result).toEqual(tavilySearch.results.map((r) => r.content))
    expect(result).toHaveLength(tavilySearch.results.length)
  })

  it("returns empty array when no results", async () => {
    mockSearch.mockResolvedValueOnce({ results: [] })
    const result = await searchAdverseMedia("Unknown Corp")
    expect(result).toEqual([])
  })

  it("returns null on error", async () => {
    mockSearch.mockRejectedValueOnce(new Error("API error"))
    const result = await searchAdverseMedia("THORNFIELD CONSULTING LIMITED")
    expect(result).toBeNull()
  })

  it("uses a neutral UK-anchored query with no bias keywords", async () => {
    mockSearch.mockResolvedValueOnce({ results: [] })
    await searchAdverseMedia("THORNFIELD CONSULTING LIMITED")
    const query: string = mockSearch.mock.calls[0][0]
    expect(query).toContain("THORNFIELD CONSULTING LIMITED")
    expect(query).toContain("UK")
    expect(mockSearch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ search_depth: "basic" })
    )
    expect(query).not.toContain("scam")
    expect(query).not.toContain("fraud")
  })
})
