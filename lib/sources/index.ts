import { fetchProfile, fetchOfficers, fetchFilings, fetchDirectorAppointments } from "./companies-house"
import { searchAdverseMedia } from "./tavily"
import type { RawSourceData } from "../schema"

const TIMEOUT_MS = 5000
const DIRECTOR_TIMEOUT_MS = 3000
const MAX_DIRECTORS = 3

function withTimeout<T>(factory: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T | null> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)
  return factory(ac.signal)
    .then((v) => { clearTimeout(timer); return v })
    .catch(() => null)
    .finally(() => clearTimeout(timer))
}

export interface SourceResult {
  raw: RawSourceData
  errors: Array<{ source: string; error: string }>
  sourcesUsed: string[]
}

export async function runSources(
  registrationNumber: string,
  companyName: string,
  onSourceStarted: (source: string) => void,
  onSourceComplete: (source: string, durationMs: number, data: unknown) => void,
  onSourceError: (source: string, error: string) => void
): Promise<SourceResult> {
  // Phase 1: parallel gather (profile, officers, filings, adverse media)
  const sources = {
    ch_profile: (signal: AbortSignal) => fetchProfile(registrationNumber, signal),
    ch_officers: (signal: AbortSignal) => fetchOfficers(registrationNumber, signal),
    ch_filings: (signal: AbortSignal) => fetchFilings(registrationNumber, signal),
    adverse_media: (_signal: AbortSignal) => searchAdverseMedia(companyName),
  }

  const keys = Object.keys(sources) as (keyof typeof sources)[]
  keys.forEach(onSourceStarted)

  const results = await Promise.allSettled(
    keys.map(async (key) => {
      const start = Date.now()
      const data = await withTimeout(
        (signal) => sources[key](signal) as Promise<Record<string, unknown> | string[] | null>,
        TIMEOUT_MS
      )
      return { key, data, durationMs: Date.now() - start }
    })
  )

  const raw: RawSourceData = {
    ch_profile: null,
    ch_officers: null,
    ch_filings: null,
    adverse_media: null,
    director_network: null,
  }
  const errors: Array<{ source: string; error: string }> = []
  const sourcesUsed: string[] = []

  for (const [i, result] of results.entries()) {
    const key = keys[i]
    if (result.status === "fulfilled" && result.value.data !== null) {
      ;(raw as unknown as Record<string, unknown>)[key] = result.value.data
      sourcesUsed.push(key)
      onSourceComplete(key, result.value.durationMs, result.value.data)
    } else {
      const error = result.status === "rejected" ? String(result.reason) : "timeout or no data"
      errors.push({ source: key, error })
      onSourceError(key, error)
    }
  }

  // Phase 2: director network — depends on ch_officers result
  if (raw.ch_officers) {
    const officers = (raw.ch_officers as { items?: Array<{ links?: { officer?: { appointments?: string } } }> }).items ?? []
    const top = officers.slice(0, MAX_DIRECTORS)

    onSourceStarted("director_network")
    const start = Date.now()

    const networkResults = await Promise.allSettled(
      top.map((officer) => {
        const url = officer.links?.officer?.appointments
        if (!url) return Promise.resolve(null)
        return withTimeout((signal) => fetchDirectorAppointments(url, signal), DIRECTOR_TIMEOUT_MS)
      })
    )

    const network = networkResults
      .filter((r): r is PromiseFulfilledResult<Record<string, unknown> | null> => r.status === "fulfilled" && r.value !== null)
      .map((r) => r.value as Record<string, unknown>)

    if (network.length > 0) {
      raw.director_network = network
      sourcesUsed.push("director_network")
      onSourceComplete("director_network", Date.now() - start, network)
    } else {
      onSourceError("director_network", "no appointments found")
    }
  }

  return { raw, errors, sourcesUsed }
}
