export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { searchCompanies, fetchProfile } from "@/lib/sources/companies-house"
import { runSources } from "@/lib/sources"
import { synthesizeWithRetry, mergeAssessment } from "@/lib/llm/synthesize"
import { PRIMARY_MODEL } from "@/lib/llm/client"
import { formatSSE, type SSEEvent } from "@/lib/schema"
import { logSource, logAssessment, hashRawData } from "@/lib/logger"
import { randomUUID } from "crypto"

interface AssessRequest {
  company_name?: string
  registration_number?: string
  jurisdiction?: string
}

export async function POST(req: NextRequest): Promise<Response> {
  const body: AssessRequest = await req.json().catch(() => ({}))

  if (!body.company_name && !body.registration_number) {
    return NextResponse.json({ error: "Provide company_name or registration_number" }, { status: 400 })
  }

  const requestId = randomUUID()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: SSEEvent) {
        controller.enqueue(encoder.encode(formatSSE(event)))
      }

      try {
        let registrationNumber = body.registration_number ?? ""
        let companyName = body.company_name ?? ""

        if (!registrationNumber && companyName) {
          const matches = await searchCompanies(companyName)
          if (matches.length === 0) {
            emit({ type: "error", message: "No companies found matching that name" })
            controller.close()
            return
          }
          if (matches.length > 1) {
            emit({
              type: "disambiguation_required",
              data: matches.slice(0, 5).map((m) => ({
                name: m.company_name,
                number: m.company_number,
                status: m.company_status,
                address: m.address_snippet ?? "",
                matchScore: m.matchScore,
              })),
            })
            controller.close()
            return
          }
          registrationNumber = matches[0].company_number
          companyName = matches[0].company_name
        } else if (registrationNumber) {
          const profile = await fetchProfile(registrationNumber)
          if (!profile) {
            emit({ type: "error", message: "Company not found" })
            controller.close()
            return
          }
          companyName = (profile.company_name as string) ?? companyName
        }

        emit({ type: "company_found", data: { name: companyName, number: registrationNumber } })

        const { raw, errors, sourcesUsed } = await runSources(
          registrationNumber,
          companyName,
          (source) => {
            logSource({ ts: new Date().toISOString(), request_id: requestId, source, status: "started" })
            emit({ type: "source_started", source })
          },
          (source, durationMs, rawData) => {
            let partial: unknown
            if (source === "ch_profile" && rawData) {
              const p = rawData as Record<string, unknown>
              const addr = p.registered_office_address as Record<string, unknown> | undefined
              partial = {
                status: p.company_status,
                date_of_creation: p.date_of_creation,
                address: [addr?.address_line_1, addr?.locality, addr?.postal_code].filter(Boolean).join(", ") || null,
              }
            } else if (source === "ch_officers" && rawData) {
              const o = rawData as { items?: Array<Record<string, unknown>> }
              partial = {
                directors: (o.items ?? []).slice(0, 5).map((d) => ({
                  name: d.name,
                  role: d.officer_role,
                  appointed_on: d.appointed_on ?? null,
                })),
              }
            } else if (source === "ch_filings" && rawData) {
              const f = rawData as Record<string, unknown>
              partial = { filing_count: f.total_count ?? null }
            }
            logSource({ ts: new Date().toISOString(), request_id: requestId, source, duration_ms: durationMs, status: "complete" })
            emit({ type: "source_complete", source, durationMs, data: partial })
          },
          (source, error) => {
            logSource({ ts: new Date().toISOString(), request_id: requestId, source, status: "error", error })
            emit({ type: "source_error", source, error })
          }
        )

        const LLM_TIMEOUT_MS = 25_000
        const llmOutput = await Promise.race([
          synthesizeWithRetry(raw),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Assessment timed out — try again")), LLM_TIMEOUT_MS)
          ),
        ])
        const assessment = mergeAssessment(llmOutput, raw, sourcesUsed, errors)

        logAssessment({
          ts: new Date().toISOString(),
          request_id: requestId,
          prompt_version: assessment.metadata.prompt_version,
          model: PRIMARY_MODEL,
          raw_data_hash: hashRawData(raw),
          confidence_score: assessment.confidence.score,
          overall_risk: assessment.risk_score.overall,
        })

        emit({ type: "assessment_complete", data: assessment, source_data: raw })
      } catch (e) {
        emit({ type: "error", message: String(e) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
