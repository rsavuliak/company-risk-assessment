/**
 * @jest-environment node
 */
import { POST } from "@/app/api/assess/route"
import { NextRequest } from "next/server"
import chProfile from "../fixtures/ch-profile.json"
import chOfficers from "../fixtures/ch-officers.json"
import chFilings from "../fixtures/ch-filings.json"
import chSearch from "../fixtures/ch-search.json"
// Single-match result derived from fixture (avoids disambiguation path)
const singleSearchResult = [{
  company_name: chSearch.items[0].title,
  company_number: chSearch.items[0].company_number,
  company_status: chSearch.items[0].company_status,
  address_snippet: chSearch.items[0].address_snippet,
  matchScore: 95,
}]

// Multi-match result derived from fixture (triggers disambiguation path)
const multiSearchResult = chSearch.items.map((item) => ({
  company_name: item.title,
  company_number: item.company_number,
  company_status: item.company_status,
  address_snippet: item.address_snippet,
  matchScore: 90,
}))

jest.mock("@/lib/sources/companies-house", () => ({
  searchCompanies: jest.fn(),
  fetchProfile: jest.fn(),
  fetchOfficers: jest.fn(),
  fetchFilings: jest.fn(),
  fetchDirectorAppointments: jest.fn(),
}))

jest.mock("@/lib/sources/tavily", () => ({
  searchAdverseMedia: jest.fn().mockResolvedValue([]),
}))

jest.mock("@/lib/llm/synthesize", () => {
  // require inside factory avoids the jest.mock hoisting issue with imported fixtures
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const llmOut = require("../fixtures/llm-output.json")
  return {
    synthesizeWithRetry: jest.fn().mockResolvedValue(llmOut),
    mergeAssessment: jest.fn((_llm: unknown, _raw: unknown, sourcesUsed: string[], sourceErrors: string[]) => ({
      ...llmOut,
      confidence: { score: 0.86, fields_populated: 6, fields_total: 7 },
      metadata: {
        assessed_at: "2026-05-19T22:00:00Z",
        prompt_version: "1.0.0",
        sources_used: sourcesUsed,
        source_errors: sourceErrors,
      },
    })),
  }
})

async function collectSSE(response: Response): Promise<string[]> {
  const text = await response.text()
  return text.split("\n\n").filter((s) => s.startsWith("data: ")).map((s) => s.slice(6))
}

// Set default mock return values before each test (fixtures cannot be used inside jest.mock factory due to hoisting)
beforeEach(() => {
  jest.clearAllMocks()
  const ch = require("@/lib/sources/companies-house")
  ;(ch.searchCompanies as jest.Mock).mockResolvedValue(singleSearchResult)
  ;(ch.fetchProfile as jest.Mock).mockResolvedValue(chProfile)
  ;(ch.fetchOfficers as jest.Mock).mockResolvedValue(chOfficers)
  ;(ch.fetchFilings as jest.Mock).mockResolvedValue(chFilings)
  ;(ch.fetchDirectorAppointments as jest.Mock).mockResolvedValue(null)
})

describe("POST /api/assess", () => {
  it("returns 400 when no identifier provided", async () => {
    const req = new NextRequest("http://localhost/api/assess", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it("streams company_found and assessment_complete for an unambiguous name search", async () => {
    const req = new NextRequest("http://localhost/api/assess", {
      method: "POST",
      body: JSON.stringify({ company_name: "Thornfield Consulting" }),
    })
    const response = await POST(req)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/event-stream")
    const events = await collectSSE(response)
    const types = events.map((e) => JSON.parse(e).type)
    expect(types).toContain("company_found")
    expect(types).toContain("assessment_complete")
  })

  it("streams disambiguation_required when multiple companies match", async () => {
    const { searchCompanies } = require("@/lib/sources/companies-house")
    ;(searchCompanies as jest.Mock).mockResolvedValueOnce(multiSearchResult)
    const req = new NextRequest("http://localhost/api/assess", {
      method: "POST",
      body: JSON.stringify({ company_name: "Thornfield Consulting" }),
    })
    const response = await POST(req)
    const events = await collectSSE(response)
    const types = events.map((e) => JSON.parse(e).type)
    expect(types).toContain("disambiguation_required")
    const disambiguationEvent = JSON.parse(events.find((e) => JSON.parse(e).type === "disambiguation_required")!)
    expect(disambiguationEvent.data[0].name).toBe("THORNFIELD CONSULTING LIMITED")
  })

  it("resolves directly by registration number without searching", async () => {
    const req = new NextRequest("http://localhost/api/assess", {
      method: "POST",
      body: JSON.stringify({ registration_number: "12345678" }),
    })
    const response = await POST(req)
    const events = await collectSSE(response)
    const types = events.map((e) => JSON.parse(e).type)
    expect(types).toContain("company_found")
    expect(types).toContain("assessment_complete")
    const { searchCompanies } = require("@/lib/sources/companies-house")
    expect(searchCompanies).not.toHaveBeenCalled()
  })

  it("assessment_complete event contains fixture company name", async () => {
    const req = new NextRequest("http://localhost/api/assess", {
      method: "POST",
      body: JSON.stringify({ company_name: "Thornfield Consulting" }),
    })
    const response = await POST(req)
    const events = await collectSSE(response)
    const completeEvent = JSON.parse(events.find((e) => JSON.parse(e).type === "assessment_complete")!)
    expect(completeEvent.data.company.name).toBe("THORNFIELD CONSULTING LIMITED")
  })
})
