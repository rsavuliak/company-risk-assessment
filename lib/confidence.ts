import type { RawSourceData, RiskAssessment } from "./schema"

type Confidence = RiskAssessment["confidence"]

export function calculateConfidence(raw: RawSourceData): Confidence {
  const checks = [
    raw.ch_profile !== null,
    raw.ch_profile !== null && (raw.ch_profile as Record<string, unknown>).date_of_creation != null,
    raw.ch_officers !== null,
    raw.ch_officers !== null && ((raw.ch_officers as { items?: unknown[] }).items?.length ?? 0) > 0,
    raw.ch_filings !== null,
    raw.adverse_media !== null, // [] = clean (positive signal); null = source errored (penalised)
    raw.director_network !== null,
  ]

  const fields_populated = checks.filter(Boolean).length
  const fields_total = checks.length

  return {
    score: fields_populated / fields_total,
    fields_populated,
    fields_total,
  }
}
