"use client"
import { useState, FormEvent } from "react"

interface SearchFormProps {
  onSubmit: (params: { company_name?: string; registration_number?: string }) => void
  disabled?: boolean
}

export function SearchForm({ onSubmit, disabled }: SearchFormProps) {
  const [companyName, setCompanyName] = useState("")
  const [regNumber, setRegNumber] = useState("")

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!companyName && !regNumber) return
    onSubmit({ company_name: companyName || undefined, registration_number: regNumber || undefined })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Jurisdiction
        </label>
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-default">
          <span className="text-xl">🇬🇧</span>
          <span className="text-sm font-medium text-slate-700">United Kingdom</span>
          <span className="ml-auto text-xs bg-slate-200 text-slate-500 px-2.5 py-0.5 rounded-full font-medium">
            Only available
          </span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Company Name
        </label>
        <input
          type="text"
          placeholder="e.g. Marks and Spencer"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          disabled={disabled}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:opacity-50 transition-shadow"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Registration Number
        </label>
        <input
          type="text"
          placeholder="e.g. 00000006"
          value={regNumber}
          onChange={(e) => setRegNumber(e.target.value)}
          disabled={disabled}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:opacity-50 transition-shadow"
        />
      </div>

      <button
        type="submit"
        disabled={disabled || (!companyName && !regNumber)}
        className="w-full bg-slate-900 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl px-4 py-3.5 transition-colors flex items-center justify-center gap-2"
      >
        {disabled ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Assessing…
          </>
        ) : (
          <>
            Assess Risk
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </>
        )}
      </button>
    </form>
  )
}
