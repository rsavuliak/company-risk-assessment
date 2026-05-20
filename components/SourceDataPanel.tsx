"use client"
import { useState } from "react"
import type { RawSourceData } from "@/lib/schema"

const SOURCE_META: Record<string, { label: string; icon: string }> = {
  ch_profile:       { label: "Company Profile",       icon: "🏢" },
  ch_officers:      { label: "Directors & Officers",   icon: "👥" },
  ch_filings:       { label: "Filing History",         icon: "📋" },
  adverse_media:    { label: "Adverse Media",          icon: "📰" },
  director_network: { label: "Director Network",       icon: "🔗" },
}

function SourceBlock({ name, data }: { name: string; data: unknown }) {
  const [open, setOpen] = useState(false)
  const meta = SOURCE_META[name] ?? { label: name, icon: "⚡" }
  const isNull = data === null

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => !isNull && setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
          isNull ? "opacity-40 cursor-default" : "hover:bg-slate-50 cursor-pointer"
        }`}
      >
        <span className="text-lg shrink-0">{meta.icon}</span>
        <span className="flex-1 text-sm font-semibold text-slate-700">{meta.label}</span>
        {isNull ? (
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">unavailable</span>
        ) : (
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && !isNull && (
        <div className="border-t border-slate-200 bg-slate-950 p-4 overflow-auto max-h-96">
          <pre className="text-xs text-slate-300 font-mono whitespace-pre leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export function SourceDataPanel({ sourceData }: { sourceData: RawSourceData }) {
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setPanelOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Raw Source Data</span>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
            {Object.values(sourceData).filter((v) => v !== null).length} / {Object.keys(sourceData).length} sources
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${panelOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {panelOpen && (
        <div className="border-t border-slate-200 p-4 space-y-2">
          {Object.entries(sourceData).map(([key, value]) => (
            <SourceBlock key={key} name={key} data={value} />
          ))}
        </div>
      )}
    </div>
  )
}
