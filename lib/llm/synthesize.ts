import { zodToJsonSchema } from "zod-to-json-schema"
import { LLMOutputSchema, RiskAssessmentSchema, PROMPT_VERSION, type LLMOutput, type RawSourceData, type RiskAssessment } from "../schema"
import { calculateConfidence } from "../confidence"
import { openrouter, PRIMARY_MODEL } from "./client"
import { buildPrompt } from "./prompt"

const toolDefinition = {
  type: "function" as const,
  function: {
    name: "submit_risk_assessment",
    description: "Submit the structured risk assessment result",
    parameters: zodToJsonSchema(LLMOutputSchema),
  },
}

async function callLLM(raw: RawSourceData, previousError?: string): Promise<unknown> {
  const completion = await openrouter.chat.completions.create({
    model: PRIMARY_MODEL,
    temperature: 0,
    max_tokens: 2000,
    tools: [toolDefinition],
    tool_choice: { type: "function", function: { name: "submit_risk_assessment" } },
    messages: [{ role: "user", content: buildPrompt(raw, previousError) }],
  })
  const args = completion.choices[0]?.message?.tool_calls?.[0]?.function?.arguments
  return JSON.parse(args ?? "{}")
}

export async function synthesizeWithRetry(raw: RawSourceData, maxAttempts = 3): Promise<LLMOutput> {
  let previousError: string | undefined
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await callLLM(raw, previousError)
      // Validate against LLMOutputSchema (not RiskAssessmentSchema — confidence is server-side)
      const parsed = LLMOutputSchema.safeParse(response)
      if (parsed.success) return parsed.data
      previousError = parsed.error.message
    } catch (e) {
      previousError = String(e)
    }
  }
  return buildFallbackAssessment(raw) as LLMOutput
}

export function buildFallbackAssessment(raw: RawSourceData): RiskAssessment {
  const confidence = calculateConfidence(raw)
  return {
    company: { name: "Unknown", registration_number: "Unknown", jurisdiction: "Unknown", incorporation_date: null, status: "unknown", address: null },
    risk_indicators: { company_age_months: null, is_recently_incorporated: false, filing_history_count: null, has_limited_filing_history: false, directors: [], adverse_media_snippets: [], has_adverse_media: false },
    risk_score: { overall: "unknown", explanation: "Assessment could not be completed due to insufficient data or LLM errors.", contributing_factors: [] },
    confidence: { score: 0, fields_populated: confidence.fields_populated, fields_total: confidence.fields_total },
    metadata: { assessed_at: new Date().toISOString(), prompt_version: PROMPT_VERSION, sources_used: [], source_errors: [] },
  }
}

export function mergeAssessment(llmOutput: LLMOutput, raw: RawSourceData, sourcesUsed: string[], sourceErrors: Array<{ source: string; error: string }>): RiskAssessment {
  const confidence = calculateConfidence(raw)
  return RiskAssessmentSchema.parse({
    ...llmOutput,
    confidence,
    metadata: {
      assessed_at: new Date().toISOString(),
      prompt_version: PROMPT_VERSION,
      sources_used: sourcesUsed,
      source_errors: sourceErrors,
    },
  })
}
