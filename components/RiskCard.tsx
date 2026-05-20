import type { RiskAssessment } from "@/lib/schema"
import { ConfidenceBar } from "./ConfidenceBar"

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

export function RiskCard({ assessment }: { assessment: RiskAssessment }) {
  const { company, risk_score, risk_indicators, confidence, metadata } = assessment
  const risk = RISK_STYLE[risk_score.overall] ?? RISK_STYLE.unknown
  const statusStyle = STATUS_STYLE[company.status] ?? STATUS_STYLE.unknown

  const incorporationDate = company.incorporation_date
    ? new Date(company.incorporation_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null

  return (
    <div className={`bg-white border-2 ${risk.border} rounded-2xl overflow-hidden shadow-sm`}>

      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <h2 className="font-space-grotesk font-bold text-xl text-slate-900 leading-tight">{company.name}</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {company.registration_number} · {company.jurisdiction}
            </p>
          </div>
          <span className={`shrink-0 text-sm font-bold px-3 py-1.5 rounded-full ${risk.badge}`}>
            {risk.label}
          </span>
        </div>
        <ConfidenceBar
          score={confidence.score}
          fieldsPopulated={confidence.fields_populated}
          fieldsTotal={confidence.fields_total}
        />
      </div>

      <div className="px-6 py-5 space-y-6">

        {/* Summary */}
        <p className="text-sm text-slate-700 leading-relaxed">{risk_score.explanation}</p>

        {/* Contributing factors */}
        {risk_score.contributing_factors.length > 0 && (
          <Section title="Risk Factors">
            <ul className="space-y-2">
              {risk_score.contributing_factors.map((f, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                  <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                  {f}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Adverse media */}
        {risk_indicators.has_adverse_media && risk_indicators.adverse_media_snippets.length > 0 && (
          <Section title="Adverse Media">
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-3">
              {risk_indicators.adverse_media_snippets.map((s, i) => (
                <p key={i} className="text-sm text-red-800 leading-relaxed">&ldquo;{s}&rdquo;</p>
              ))}
            </div>
          </Section>
        )}

        {/* Company details */}
        <Section title="Company Details">
          <div className="divide-y divide-slate-100">
            <Field label="Status" value={
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle}`}>
                {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
              </span>
            } />
            {incorporationDate && (
              <Field
                label="Incorporated"
                value={`${incorporationDate}${risk_indicators.company_age_months !== null ? ` (${risk_indicators.company_age_months} months ago)` : ""}`}
              />
            )}
            {company.address && <Field label="Address" value={company.address} />}
            <Field
              label="Filing history"
              value={
                risk_indicators.filing_history_count !== null
                  ? `${risk_indicators.filing_history_count} filing${risk_indicators.filing_history_count !== 1 ? "s" : ""}${risk_indicators.has_limited_filing_history ? " — limited" : ""}`
                  : null
              }
            />
          </div>
        </Section>

        {/* Directors */}
        {risk_indicators.directors.length > 0 && (
          <Section title="Directors">
            <div className="space-y-3">
              {risk_indicators.directors.map((d, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {d.role}
                      {d.appointed_on && ` · appointed ${new Date(d.appointed_on).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`}
                    </p>
                    {d.other_appointments_count !== null && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {d.other_appointments_count === 0
                          ? "No other appointments"
                          : `${d.other_appointments_count} other appointment${d.other_appointments_count !== 1 ? "s" : ""}`}
                      </p>
                    )}
                  </div>
                  {d.is_prolific_director && (
                    <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Prolific
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Footer */}
        <p className="text-xs text-slate-400">
          Assessed {new Date(metadata.assessed_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · prompt v{metadata.prompt_version}
        </p>
      </div>
    </div>
  )
}
