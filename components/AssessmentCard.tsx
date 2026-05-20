"use client"
import { useState } from "react"
import type { RiskAssessment } from "@/lib/schema"
import { ConfidenceBar } from "./ConfidenceBar"

interface ProgressItem {
  type: string
  source?: string
  durationMs?: number
  error?: string
}

interface Props {
  progress: ProgressItem[]
  partialData: Record<string, unknown>
  assessment: RiskAssessment | null
}

const RISK_STYLE: Record<string, { badge: string; border: string; label: string }> = {
  low:     { badge: "bg-emerald-100 text-emerald-800", border: "border-emerald-200", label: "Low Risk" },
  medium:  { badge: "bg-amber-100 text-amber-800",    border: "border-amber-200",   label: "Medium Risk" },
  high:    { badge: "bg-red-100 text-red-800",         border: "border-red-200",     label: "High Risk" },
  unknown: { badge: "bg-slate-100 text-slate-600",    border: "border-slate-200",   label: "Unknown" },
}

const STATUS_STYLE: Record<string, string> = {
  active:      "bg-emerald-100 text-emerald-700",
  dissolved:   "bg-red-100 text-red-700",
  liquidation: "bg-orange-100 text-orange-700",
  unknown:     "bg-slate-100 text-slate-500",
}

const SOURCE_META: Record<string, { label: string }> = {
  ch_profile:       { label: "Company Profile" },
  ch_officers:      { label: "Directors & Officers" },
  ch_filings:       { label: "Filing History" },
  adverse_media:    { label: "Adverse Media" },
  director_network: { label: "Director Network" },
}

function Skeleton({ className }: { className: string }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 text-right font-medium">{value ?? <span className="text-slate-300">—</span>}</span>
    </div>
  )
}

export function AssessmentCard({ progress, partialData, assessment }: Props) {
  const [jsonOpen, setJsonOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Build source map from progress events
  const sourceMap = new Map<string, { status: "loading" | "complete" | "error"; durationMs?: number; order: number }>()
  let orderCounter = 0
  for (const event of progress) {
    if (event.type === "source_started" && event.source) {
      if (!sourceMap.has(event.source)) {
        sourceMap.set(event.source, { status: "loading", order: orderCounter++ })
      }
    } else if (event.type === "source_complete" && event.source) {
      const existing = sourceMap.get(event.source)
      sourceMap.set(event.source, { ...(existing ?? { order: orderCounter++ }), status: "complete", durationMs: event.durationMs })
    } else if (event.type === "source_error" && event.source) {
      const existing = sourceMap.get(event.source)
      sourceMap.set(event.source, { ...(existing ?? { order: orderCounter++ }), status: "error" })
    }
  }

  const sources = [...sourceMap.entries()].sort(([, a], [, b]) => a.order - b.order)
  const total = sources.length
  const completed = sources.filter(([, s]) => s.status === "complete").length
  const allDone = total > 0 && sources.every(([, s]) => s.status !== "loading")

  // Resolve display values — partial data is immutable once shown; LLM adds enrichments only
  const chProfile = partialData["ch_profile"] as { status?: string; date_of_creation?: string; address?: string } | undefined
  const chOfficers = partialData["ch_officers"] as { directors?: Array<{ name: string; role: string; appointed_on: string | null }> } | undefined
  const chFilings = partialData["ch_filings"] as { filing_count?: number | null } | undefined

  const companyName = (partialData.name as string | undefined) ?? assessment?.company.name
  const regNumber = (partialData.number as string | undefined) ?? assessment?.company.registration_number
  const jurisdiction = assessment?.company.jurisdiction

  const risk = assessment ? (RISK_STYLE[assessment.risk_score.overall] ?? RISK_STYLE.unknown) : null

  const statusRaw = chProfile?.status ?? assessment?.company.status
  const statusStyle = statusRaw ? (STATUS_STYLE[statusRaw] ?? STATUS_STYLE.unknown) : null

  const incorporationDate = chProfile?.date_of_creation ?? assessment?.company.incorporation_date
  const incorporationFormatted = incorporationDate
    ? new Date(incorporationDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null

  const address = chProfile?.address ?? assessment?.company.address ?? null

  const filingCount = chFilings?.filing_count ?? assessment?.risk_indicators.filing_history_count ?? null
  const hasLimitedFilings = assessment?.risk_indicators.has_limited_filing_history ?? false

  const adverseSnippets = assessment?.risk_indicators.adverse_media_snippets ?? []
  const hasAdverseMedia = assessment?.risk_indicators.has_adverse_media ?? false

  const partialDirectors = chOfficers?.directors?.map((d) => ({
    name: d.name as string,
    role: d.role as string,
    appointed_on: d.appointed_on,
  })) ?? []

  // Keep partial list frozen; enrich each entry with LLM details matched by name
  const directors = (() => {
    if (partialDirectors.length === 0) return assessment?.risk_indicators.directors ?? []
    return partialDirectors.map((d) => {
      const llm = assessment?.risk_indicators.directors.find((l) => l.name === d.name)
      return {
        name: d.name,
        role: d.role,
        appointed_on: d.appointed_on,
        other_appointments_count: llm?.other_appointments_count ?? null,
        is_prolific_director: llm?.is_prolific_director ?? false,
      }
    })
  })()
  const directorsEnriched = assessment !== null

  const hasChProfile = chProfile != null || assessment != null
  const hasChOfficers = chOfficers != null || assessment != null
  const hasChFilings = chFilings != null || assessment != null

  function copyJson() {
    if (!assessment) return
    navigator.clipboard.writeText(JSON.stringify(assessment, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`bg-white border-2 ${risk?.border ?? "border-slate-200"} rounded-2xl overflow-hidden shadow-sm transition-colors duration-500`}>

      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0 flex-1">
            {companyName ? (
              <>
                <h2 className="font-space-grotesk font-bold text-xl text-slate-900 leading-tight">{companyName}</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {regNumber}{jurisdiction ? ` · ${jurisdiction}` : ""}
                </p>
              </>
            ) : (
              <>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {risk ? (
              <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${risk.badge}`}>
                {risk.label}
              </span>
            ) : (
              <Skeleton className="h-8 w-24 rounded-full" />
            )}
            {total > 0 && (
              <p className="text-xs text-slate-400 tabular-nums">{completed}/{total} sources</p>
            )}
          </div>
        </div>

        {/* Source progress bar */}
        {total > 0 && (
          <div className="flex gap-1.5">
            {sources.map(([source, s]) => (
              <div
                key={source}
                title={SOURCE_META[source]?.label ?? source}
                className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${
                  s.status === "complete"
                    ? "bg-emerald-400"
                    : s.status === "error"
                    ? "bg-red-400/60"
                    : "bg-blue-400 animate-pulse"
                }`}
              />
            ))}
          </div>
        )}

        {/* Confidence bar — only when assessment is ready */}
        {assessment ? (
          <div className="mt-4">
            <ConfidenceBar
              score={assessment.confidence.score}
              fieldsPopulated={assessment.confidence.fields_populated}
              fieldsTotal={assessment.confidence.fields_total}
            />
          </div>
        ) : total > 0 ? (
          <div className="mt-4">
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex justify-between mt-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-6 py-5 space-y-6">

        {/* Risk explanation */}
        {assessment ? (
          <p className="text-sm text-slate-700 leading-relaxed">{assessment.risk_score.explanation}</p>
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        )}

        {/* Contributing factors */}
        {assessment && assessment.risk_score.contributing_factors.length > 0 && (
          <Section title="Risk Factors">
            <ul className="space-y-2">
              {assessment.risk_score.contributing_factors.map((f, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                  <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                  {f}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Adverse media */}
        {hasAdverseMedia && adverseSnippets.length > 0 && (
          <Section title="Adverse Media">
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-3">
              {adverseSnippets.map((s, i) => (
                <p key={i} className="text-sm text-red-800 leading-relaxed">&ldquo;{s}&rdquo;</p>
              ))}
            </div>
          </Section>
        )}

        {/* Company details */}
        <Section title="Company Details">
          <div className="divide-y divide-slate-100">
            {hasChProfile ? (
              <>
                <Field label="Status" value={
                  statusRaw && statusStyle ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle}`}>
                      {statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1)}
                    </span>
                  ) : <Skeleton className="h-5 w-16 rounded-full" />
                } />
                <Field
                  label="Incorporated"
                  value={incorporationFormatted ? (
                    <span className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span>{incorporationFormatted}</span>
                      {assessment
                        ? assessment.risk_indicators.company_age_months != null
                          ? <span className="text-slate-400 font-normal">({assessment.risk_indicators.company_age_months} months ago)</span>
                          : null
                        : <Skeleton className="h-3 w-16 inline-block" />
                      }
                    </span>
                  ) : <Skeleton className="h-4 w-36" />}
                />
                <Field label="Address" value={address ?? <Skeleton className="h-4 w-48" />} />
              </>
            ) : (
              <>
                <div className="py-2"><Skeleton className="h-4 w-full" /></div>
                <div className="py-2"><Skeleton className="h-4 w-3/4" /></div>
                <div className="py-2"><Skeleton className="h-4 w-5/6" /></div>
              </>
            )}
            <Field
              label="Filing history"
              value={
                hasChFilings
                  ? filingCount !== null
                    ? (
                      <span className="flex items-center gap-1.5">
                        <span>{`${filingCount} filing${filingCount !== 1 ? "s" : ""}`}</span>
                        {assessment
                          ? hasLimitedFilings
                            ? <span className="text-slate-400 font-normal">— limited</span>
                            : null
                          : <Skeleton className="h-3 w-12 inline-block" />
                        }
                      </span>
                    )
                    : "—"
                  : <Skeleton className="h-4 w-20" />
              }
            />
          </div>
        </Section>

        {/* Directors */}
        <Section title="Directors">
          {hasChOfficers ? (
            directors.length > 0 ? (
              <div className="space-y-3">
                {directors.map((d, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {d.role}
                        {d.appointed_on && ` · appointed ${new Date(d.appointed_on).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`}
                      </p>
                      {directorsEnriched
                        ? d.other_appointments_count !== null && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {d.other_appointments_count === 0
                              ? "No other appointments"
                              : `${d.other_appointments_count} other appointment${d.other_appointments_count !== 1 ? "s" : ""}`}
                          </p>
                        )
                        : <Skeleton className="h-3 w-28 mt-1" />
                      }
                    </div>
                    {directorsEnriched
                      ? d.is_prolific_director && (
                        <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Prolific
                        </span>
                      )
                      : <Skeleton className="h-5 w-14 rounded-full shrink-0" />
                    }
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No directors found</p>
            )
          ) : (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-xl space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Footer */}
        {assessment && (
          <p className="text-xs text-slate-400">
            {allDone ? "Assessed" : "Synthesising…"}{" "}
            {new Date(assessment.metadata.assessed_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · prompt v{assessment.metadata.prompt_version}
          </p>
        )}
        {!assessment && allDone && (
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
            Synthesising with AI…
          </p>
        )}

        {/* JSON panel */}
        {assessment && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setJsonOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Structured JSON Output</span>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${jsonOpen ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {jsonOpen && (
              <div className="border-t border-slate-200">
                <div className="flex justify-end px-3 py-2 bg-slate-950 border-b border-slate-800">
                  <button
                    onClick={copyJson}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded font-mono"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="bg-slate-950 p-4 overflow-auto max-h-96">
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre leading-relaxed">
                    {JSON.stringify(assessment, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
