"use client"

interface ProgressEvent {
  type: string
  source?: string
  durationMs?: number
  error?: string
  data?: { name: string; number: string }
}

type SourceStatus = "loading" | "complete" | "error"

interface SourceState {
  status: SourceStatus
  durationMs?: number
  error?: string
  order: number
}

const SOURCE_META: Record<string, { icon: string; label: string; description: string }> = {
  ch_profile: {
    icon: "🏢",
    label: "Company Profile",
    description: "Registration details & company status",
  },
  ch_officers: {
    icon: "👥",
    label: "Directors & Officers",
    description: "Leadership, appointments & roles",
  },
  ch_filings: {
    icon: "📋",
    label: "Filing History",
    description: "Accounts, confirmations & compliance",
  },
  adverse_media: {
    icon: "📰",
    label: "Adverse Media",
    description: "News, publications & allegations",
  },
  director_network: {
    icon: "🔗",
    label: "Director Network",
    description: "Cross-company appointment mapping",
  },
}

interface ProgressFeedProps {
  events: ProgressEvent[]
}

export function ProgressFeed({ events }: ProgressFeedProps) {
  const sourceMap = new Map<string, SourceState>()
  let companyFound: { name: string; number: string } | null = null
  let orderCounter = 0

  for (const event of events) {
    if (event.type === "company_found" && event.data) {
      companyFound = event.data
    } else if (event.type === "source_started" && event.source) {
      if (!sourceMap.has(event.source)) {
        sourceMap.set(event.source, { status: "loading", order: orderCounter++ })
      }
    } else if (event.type === "source_complete" && event.source) {
      const existing = sourceMap.get(event.source)
      sourceMap.set(event.source, {
        ...(existing ?? { order: orderCounter++ }),
        status: "complete",
        durationMs: event.durationMs,
      })
    } else if (event.type === "source_error" && event.source) {
      const existing = sourceMap.get(event.source)
      sourceMap.set(event.source, {
        ...(existing ?? { order: orderCounter++ }),
        status: "error",
        error: event.error,
      })
    }
  }

  const sources = [...sourceMap.entries()].sort(([, a], [, b]) => a.order - b.order)
  const total = sources.length
  const completed = sources.filter(([, s]) => s.status === "complete").length
  const allDone = total > 0 && sources.every(([, s]) => s.status !== "loading")

  return (
    <div className="bg-slate-900 rounded-2xl overflow-hidden animate-fade-in shadow-xl shadow-slate-900/10">
      {/* Panel header */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-700/50">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Gathering Intelligence
            </p>
            {companyFound ? (
              <p className="font-space-grotesk font-semibold text-white text-xl leading-tight truncate">
                {companyFound.name}
                <span className="text-slate-500 font-normal text-sm ml-2 font-inter">
                  · {companyFound.number}
                </span>
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
                <p className="text-slate-400 text-sm">Resolving company…</p>
              </div>
            )}
          </div>

          {total > 0 && (
            <div className="text-right shrink-0">
              <p className="font-space-grotesk font-bold text-white leading-none">
                <span className="text-4xl">{completed}</span>
                <span className="text-slate-500 text-xl">/{total}</span>
              </p>
              <p className="text-xs text-slate-500 uppercase tracking-wide mt-0.5">sources</p>
            </div>
          )}
        </div>

        {/* Segmented progress bar */}
        {total > 0 && (
          <div className="flex gap-1.5 mt-5">
            {sources.map(([source, s]) => (
              <div
                key={source}
                title={SOURCE_META[source]?.label ?? source}
                className={`h-1 flex-1 rounded-full transition-all duration-700 ${
                  s.status === "complete"
                    ? "bg-emerald-400"
                    : s.status === "error"
                    ? "bg-red-400"
                    : "bg-blue-500 animate-shimmer"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Source cards */}
      <div className="p-4 space-y-2">
        {sources.map(([source, state], index) => {
          const meta = SOURCE_META[source] ?? {
            icon: "⚡",
            label: source,
            description: "Processing…",
          }
          return (
            <div
              key={source}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border-l-4 transition-colors duration-500 animate-slide-up ${
                state.status === "loading"
                  ? "bg-white/5 border-l-blue-500"
                  : state.status === "complete"
                  ? "bg-white/[0.03] border-l-emerald-500"
                  : "bg-white/[0.03] border-l-red-500"
              }`}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="text-2xl shrink-0 select-none">{meta.icon}</span>

              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold leading-tight">{meta.label}</p>
                <p
                  className={`text-xs mt-0.5 truncate transition-colors ${
                    state.status === "error" ? "text-red-400" : "text-slate-400"
                  }`}
                >
                  {state.status === "error"
                    ? (state.error ?? "Source unavailable")
                    : state.status === "complete"
                    ? "Retrieved successfully"
                    : meta.description}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {state.status === "loading" && (
                  <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-400 animate-spin" />
                )}
                {state.status === "complete" && (
                  <>
                    {state.durationMs !== undefined && (
                      <span className="text-xs text-slate-500 tabular-nums">{state.durationMs}ms</span>
                    )}
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                      <svg
                        className="w-3.5 h-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </>
                )}
                {state.status === "error" && (
                  <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Footer */}
        {total > 0 && (
          <div className="pt-2 px-1">
            {allDone ? (
              <p className="text-xs text-emerald-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                All sources retrieved — synthesising with AI…
              </p>
            ) : (
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                Fetching live data from {total} sources…
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
