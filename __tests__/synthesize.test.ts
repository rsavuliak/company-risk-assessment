import { synthesizeWithRetry, buildFallbackAssessment } from "@/lib/llm/synthesize"
import { openrouter } from "@/lib/llm/client"
import type { RawSourceData } from "@/lib/schema"
import llmOutput from "./fixtures/llm-output.json"
import chProfile from "./fixtures/ch-profile.json"
import chOfficers from "./fixtures/ch-officers.json"
import chFilings from "./fixtures/ch-filings.json"

jest.mock("@/lib/llm/client", () => ({
  openrouter: { chat: { completions: { create: jest.fn() } } },
  PRIMARY_MODEL: "anthropic/claude-haiku-4-5",
  FALLBACK_MODEL: "anthropic/claude-sonnet-4-6",
}))

const mockCreate = openrouter.chat.completions.create as jest.Mock

const emptyRaw: RawSourceData = {
  ch_profile: null,
  ch_officers: null,
  ch_filings: null,
  adverse_media: null,
  director_network: null,
}

const fullRaw: RawSourceData = {
  ch_profile: chProfile as Record<string, unknown>,
  ch_officers: chOfficers as Record<string, unknown>,
  ch_filings: chFilings as Record<string, unknown>,
  adverse_media: [],
  director_network: null,
}

// Fixture-based valid LLM output (overall: "low")
const validArgs = JSON.stringify(llmOutput)

// Minimal unknown-risk output for retry path tests
const unknownArgs = JSON.stringify({
  company: { name: "Unknown", registration_number: "00000000", jurisdiction: "england-wales", incorporation_date: null, status: "unknown", address: null },
  risk_indicators: { company_age_months: null, is_recently_incorporated: false, filing_history_count: null, has_limited_filing_history: false, directors: [], adverse_media_snippets: [], has_adverse_media: false },
  risk_score: { overall: "unknown", explanation: "Insufficient data.", contributing_factors: [] },
})

function mockLLMResponse(args: string) {
  return { choices: [{ message: { tool_calls: [{ function: { arguments: args } }] } }] }
}

describe("synthesizeWithRetry", () => {
  beforeEach(() => mockCreate.mockReset())

  it("returns parsed LLM output on first successful attempt", async () => {
    mockCreate.mockResolvedValueOnce(mockLLMResponse(validArgs))
    const result = await synthesizeWithRetry(fullRaw)
    expect(result.risk_score.overall).toBe("low")
    expect(result.company.name).toBe("THORNFIELD CONSULTING LIMITED")
  })

  it("retries on schema validation failure and succeeds on second attempt", async () => {
    mockCreate
      .mockResolvedValueOnce(mockLLMResponse(JSON.stringify({ invalid: "data" })))
      .mockResolvedValueOnce(mockLLMResponse(unknownArgs))
    const result = await synthesizeWithRetry(emptyRaw)
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(result.risk_score.overall).toBe("unknown")
  })

  it("returns fallback assessment after max attempts exhausted", async () => {
    mockCreate.mockResolvedValue(mockLLMResponse(JSON.stringify({ bad: "schema" })))
    const result = await synthesizeWithRetry(emptyRaw, 2)
    expect(result.risk_score.overall).toBe("unknown")
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })
})

describe("buildFallbackAssessment", () => {
  it("returns unknown-risk assessment when all sources are null", () => {
    const result = buildFallbackAssessment(emptyRaw)
    expect(result.risk_score.overall).toBe("unknown")
    expect(result.confidence.score).toBe(0)
    expect(result.company.name).toBe("Unknown")
  })

  it("reflects higher confidence when sources are populated", () => {
    const result = buildFallbackAssessment(fullRaw)
    expect(result.confidence.fields_populated).toBeGreaterThan(0)
  })
})
