type LogLevel = "info" | "warn" | "error"

interface SourceLog {
  ts: string
  request_id: string
  source: string
  duration_ms?: number
  status: "started" | "complete" | "error"
  error?: string
}

interface AssessmentLog {
  ts: string
  request_id: string
  prompt_version: string
  model: string
  raw_data_hash: string
  confidence_score: number
  overall_risk: string
}

function log(level: LogLevel, data: Record<string, unknown>) {
  const entry = { level, ...data }
  if (level === "error") {
    console.error(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}

export function logSource(data: SourceLog) {
  log(data.status === "error" ? "error" : "info", data as unknown as Record<string, unknown>)
}

export function logAssessment(data: AssessmentLog) {
  log("info", data as unknown as Record<string, unknown>)
}

export function hashRawData(raw: unknown): string {
  const str = JSON.stringify(raw)
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(16)
}
