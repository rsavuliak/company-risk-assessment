import type { RawSourceData } from "../schema"

export function buildPrompt(raw: RawSourceData, previousError?: string): string {
  const today = new Date().toISOString().slice(0, 10)

  // Pre-compute age server-side to prevent LLM calculation errors and hallucinations
  const dateOfCreation = (raw.ch_profile as Record<string, unknown> | null)?.date_of_creation as string | undefined
  let ageMonths: number | null = null
  let isRecentlyIncorporated = false
  if (dateOfCreation) {
    ageMonths = Math.floor((Date.now() - new Date(dateOfCreation).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    isRecentlyIncorporated = ageMonths < 36
  }

  const ageFact = ageMonths !== null
    ? `- Company age (server-calculated from date_of_creation): ${ageMonths} months. Set company_age_months: ${ageMonths} and is_recently_incorporated: ${isRecentlyIncorporated}. Do NOT recalculate or override these values.`
    : `- Company age: unknown (no date_of_creation in source data). Set company_age_months: null and is_recently_incorporated: false.`

  const parts: string[] = [
    "You are a financial risk analyst. Analyse the following company data and produce a structured risk assessment.",
    "",
    "## Source Data",
    "```json",
    JSON.stringify(raw, null, 2),
    "```",
    "",
    "## Pre-Calculated Facts (use exactly as given — do not override)",
    `- Today's date: ${today}.`,
    ageFact,
    "",
    "## Field Rules",
    "- Set `is_prolific_director: true` if other_appointments_count >= 5.",
    "- Set `has_limited_filing_history: true` if filing_history_count < 3.",
    "- Set `has_adverse_media: true` ONLY for specific named allegations: fraud, regulatory action,",
    "  court judgment, insolvency, or professional misconduct. Generic complaints or low ratings do NOT qualify.",
    "- Adverse media snippets must clearly relate to the specific UK company being assessed (same legal name",
    "  AND UK business context). If a snippet is visibly about a different entity that shares a similar name",
    "  (e.g. a global tech giant vs a UK SME), ignore it. When in doubt, omit the snippet and set has_adverse_media: false.",
    "- Use `overall: 'unknown'` only if you cannot determine risk from available data.",
    "- Limit explanation to 500 characters.",
    "- Limit adverse_media_snippets to 5 items, quoting only relevant excerpts.",
    "",
    "## Risk Scoring (apply the FIRST matching rule)",
    "- `high`: at least one HARD indicator is present — confirmed adverse media (fraud, sanctions, court",
    "  judgment, regulatory action), active insolvency or liquidation, or a prolific director (≥5",
    "  appointments) combined with at least one other risk indicator.",
    "- `medium`: TWO OR MORE soft indicators together tell a coherent and specific risk story.",
    "  Soft indicators are: recently incorporated (< 36 months) AND limited filing history (< 3 filings).",
    "  A single soft indicator — including company age alone — is NOT sufficient for medium.",
    "  An active, compliant company with only age as a concern must be rated low.",
    "- `low`: default for active companies with adequate filings, no adverse media, and no insolvency.",
    "- `unknown`: insufficient data to make any determination.",
    "",
    "## What is NOT a risk signal — omit from contributing_factors entirely",
    "- Zero or few other director appointments: neutral and expected for founders/operators of a focused company.",
    "  Only flag when a director is prolific (≥5 appointments).",
    "- Director residency in FATF Tier 1 / low-risk jurisdictions: UK, US, EU member states, Canada,",
    "  Australia, New Zealand, Japan, Singapore, South Korea, Switzerland. Residency is only relevant for",
    "  directors from FATF grey-listed or high-risk jurisdictions.",
    "- A single routine office address change: normal business activity. Only flag if there are multiple",
    "  changes within 12 months, or if the address is a known mass-registration address.",
    "- Company age between 24–48 months on its own: early-stage but not inherently risky without corroborating signals.",
    "",
    "- Call the `submit_risk_assessment` tool with your result.",
  ]

  if (previousError) {
    parts.push(
      "",
      "## Previous Attempt Error",
      "Your last response failed schema validation. Fix these issues and try again:",
      "```",
      previousError,
      "```"
    )
  }

  return parts.join("\n")
}
