"use client"
import { useState, useCallback } from "react"
import { SearchForm } from "@/components/SearchForm"
import { DisambiguationList } from "@/components/DisambiguationList"
import { AssessmentCard } from "@/components/AssessmentCard"
import type { RiskAssessment, SSEEvent } from "@/lib/schema"

type AppState = "idle" | "loading" | "disambiguation" | "done" | "error"

interface ProgressItem {
  type: string
  source?: string
  durationMs?: number
  error?: string
  data?: { name: string; number: string }
}

export default function Home() {
  const [state, setState] = useState<AppState>("idle")
  const [progress, setProgress] = useState<ProgressItem[]>([])
  const [partialData, setPartialData] = useState<Record<string, unknown>>({})
  const [companies, setCompanies] = useState<Array<{ name: string; number: string; status: string; address: string; matchScore?: number }>>([])
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const runAssessment = useCallback(async (params: Record<string, string | undefined>) => {
    setState("loading")
    setProgress([])
    setPartialData({})
    setAssessment(null)
    setErrorMsg("")

    try {
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const err = await res.json()
        setErrorMsg(err.error ?? "Request failed")
        setState("error")
        return
      }

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() ?? ""

        for (const chunk of lines) {
          if (!chunk.startsWith("data: ")) continue
          const event: SSEEvent = JSON.parse(chunk.slice(6))

          if (event.type === "disambiguation_required") {
            setCompanies(event.data)
            setState("disambiguation")
            reader.cancel()
            return
          }
          if (event.type === "company_found") {
            setPartialData((p) => ({ ...p, name: event.data.name, number: event.data.number }))
            setProgress((p) => [...p, event as ProgressItem])
          } else if (event.type === "source_complete") {
            if (event.data) {
              setPartialData((p) => ({ ...p, [event.source]: event.data }))
            }
            setProgress((p) => [...p, event as ProgressItem])
          } else if (event.type === "assessment_complete") {
            setAssessment(event.data)
            setState("done")
          } else if (event.type === "error") {
            setErrorMsg(event.message)
            setState("error")
          } else {
            setProgress((p) => [...p, event as ProgressItem])
          }
        }
      }
    } catch (e) {
      setErrorMsg(String(e))
      setState("error")
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <h1 className="font-space-grotesk text-3xl font-bold text-slate-900 mb-8">
            Company Risk Assessment
          </h1>
          <SearchForm
            onSubmit={(p) => runAssessment(p as Record<string, string | undefined>)}
            disabled={state === "loading"}
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {(state === "loading" || state === "done") && (
          <AssessmentCard
            progress={progress}
            partialData={partialData}
            assessment={assessment}
          />
        )}

        {state === "disambiguation" && (
          <DisambiguationList
            companies={companies}
            onSelect={(c) => runAssessment({ registration_number: c.number })}
          />
        )}

        {state === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  )
}
