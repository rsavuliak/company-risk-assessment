import { LLMOutputSchema, RiskAssessmentSchema } from "@/lib/schema"

const validLLMOutput = {
  company: {
    name: "Acme Ltd",
    registration_number: "12345678",
    jurisdiction: "england-wales",
    incorporation_date: "2020-01-15",
    status: "active" as const,
    address: "1 High Street, London",
  },
  risk_indicators: {
    company_age_months: 48,
    is_recently_incorporated: false,
    filing_history_count: 5,
    has_limited_filing_history: false,
    directors: [{ name: "Jane Smith", role: "director", appointed_on: "2020-01-15", other_appointments_count: 2, is_prolific_director: false }],
    adverse_media_snippets: [],
    has_adverse_media: false,
  },
  risk_score: {
    overall: "low" as const,
    explanation: "No significant risk factors identified.",
    contributing_factors: [],
  },
}

describe("LLMOutputSchema", () => {
  it("accepts a valid LLM output object", () => {
    expect(LLMOutputSchema.safeParse(validLLMOutput).success).toBe(true)
  })

  it("rejects when overall is not a recognised value", () => {
    const bad = { ...validLLMOutput, risk_score: { ...validLLMOutput.risk_score, overall: "terrible" } }
    expect(LLMOutputSchema.safeParse(bad).success).toBe(false)
  })

  it("caps adverse_media_snippets at 5 items", () => {
    const bad = { ...validLLMOutput, risk_indicators: { ...validLLMOutput.risk_indicators, adverse_media_snippets: ["a","b","c","d","e","f"] } }
    expect(LLMOutputSchema.safeParse(bad).success).toBe(false)
  })

  it("does NOT have a confidence field (confidence is computed server-side)", () => {
    expect("confidence" in LLMOutputSchema.shape).toBe(false)
  })
})

describe("RiskAssessmentSchema", () => {
  it("accepts a valid full assessment", () => {
    const full = {
      ...validLLMOutput,
      confidence: { score: 0.85, fields_populated: 6, fields_total: 7 },
      metadata: { assessed_at: "2026-05-18T10:00:00Z", prompt_version: "1.0.0", sources_used: ["ch_profile"], source_errors: [] },
    }
    expect(RiskAssessmentSchema.safeParse(full).success).toBe(true)
  })

  it("rejects confidence score above 1", () => {
    const bad = {
      ...validLLMOutput,
      confidence: { score: 1.5, fields_populated: 7, fields_total: 7 },
      metadata: { assessed_at: "2026-05-18T10:00:00Z", prompt_version: "1.0.0", sources_used: [], source_errors: [] },
    }
    expect(RiskAssessmentSchema.safeParse(bad).success).toBe(false)
  })
})
