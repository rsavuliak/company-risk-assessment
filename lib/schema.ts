import { z } from "zod"

export const PROMPT_VERSION = "1.1.0"

const DirectorSchema = z.object({
  name: z.string(),
  role: z.string(),
  appointed_on: z.string().nullable(),
  other_appointments_count: z.number().nullable(),
  is_prolific_director: z.boolean(),
})

export const LLMOutputSchema = z.object({
  company: z.object({
    name: z.string(),
    registration_number: z.string(),
    jurisdiction: z.string(),
    incorporation_date: z.string().nullable(),
    status: z.enum(["active", "dissolved", "liquidation", "unknown"]),
    address: z.string().nullable(),
  }),
  risk_indicators: z.object({
    company_age_months: z.number().nullable(),
    is_recently_incorporated: z.boolean(),
    filing_history_count: z.number().nullable(),
    has_limited_filing_history: z.boolean(),
    directors: z.array(DirectorSchema),
    adverse_media_snippets: z.array(z.string()).max(5),
    has_adverse_media: z.boolean(),
  }),
  risk_score: z.object({
    overall: z.enum(["low", "medium", "high", "unknown"]),
    explanation: z.string().max(500),
    contributing_factors: z.array(z.string()),
  }),
})

export const RiskAssessmentSchema = LLMOutputSchema.extend({
  confidence: z.object({
    score: z.number().min(0).max(1),
    fields_populated: z.number(),
    fields_total: z.number(),
  }),
  metadata: z.object({
    assessed_at: z.string(),
    prompt_version: z.string(),
    sources_used: z.array(z.string()),
    source_errors: z.array(z.object({ source: z.string(), error: z.string() })),
  }),
})

export type LLMOutput = z.infer<typeof LLMOutputSchema>
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>
export type Director = z.infer<typeof DirectorSchema>

export interface RawSourceData {
  ch_profile: Record<string, unknown> | null
  ch_officers: Record<string, unknown> | null
  ch_filings: Record<string, unknown> | null
  adverse_media: string[] | null
  director_network: Record<string, unknown>[] | null
}

export type SSEEvent =
  | { type: "company_found"; data: { name: string; number: string } }
  | { type: "disambiguation_required"; data: Array<{ name: string; number: string; status: string; address: string; matchScore?: number }> }
  | { type: "source_started"; source: string }
  | { type: "source_complete"; source: string; durationMs: number; data?: unknown }
  | { type: "source_error"; source: string; error: string }
  | { type: "assessment_complete"; data: RiskAssessment; source_data: RawSourceData }
  | { type: "error"; message: string }

export function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}
