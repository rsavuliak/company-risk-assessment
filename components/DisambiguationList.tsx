interface Company {
  name: string
  number: string
  status: string
  address: string
  matchScore?: number
}

interface DisambiguationListProps {
  companies: Company[]
  onSelect: (company: Company) => void
}

const statusStyles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  dissolved: "bg-slate-100 text-slate-500",
  liquidation: "bg-red-100 text-red-700",
}

function MatchBadge({ score }: { score: number }) {
  const style =
    score >= 90
      ? "bg-emerald-100 text-emerald-700"
      : score >= 70
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-500"
  return (
    <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full tabular-nums ${style}`}>
      {score}%
    </span>
  )
}

export function DisambiguationList({ companies, onSelect }: DisambiguationListProps) {
  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <p className="font-space-grotesk font-semibold text-slate-900 text-lg">Multiple matches found</p>
        <p className="text-sm text-slate-500 mt-0.5">Select the company you want to assess</p>
      </div>
      <div className="space-y-2">
        {companies.map((c, i) => (
          <button
            key={c.number}
            onClick={() => onSelect(c)}
            className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-400 hover:shadow-sm transition-all animate-slide-up group"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <p className="font-bold text-slate-900 text-base leading-tight group-hover:text-slate-700">
                {c.name}
              </p>
              {c.matchScore !== undefined && <MatchBadge score={c.matchScore} />}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 font-mono">{c.number}</span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                  statusStyles[c.status] ?? "bg-slate-100 text-slate-500"
                }`}
              >
                {c.status}
              </span>
              {c.address && (
                <span className="text-xs text-slate-400 truncate max-w-xs">{c.address}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
