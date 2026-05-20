const BASE = "https://api.company-information.service.gov.uk"

function authHeader(): Record<string, string> {
  const key = process.env.COMPANIES_HOUSE_API_KEY ?? ""
  const encoded = Buffer.from(`${key}:`).toString("base64")
  return { Authorization: `Basic ${encoded}` }
}

async function chFetch(path: string, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: authHeader(), signal })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function fetchProfile(registrationNumber: string, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  return chFetch(`/company/${registrationNumber}`, signal)
}

export async function fetchOfficers(registrationNumber: string, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  return chFetch(`/company/${registrationNumber}/officers?items_per_page=10`, signal)
}

export async function fetchFilings(registrationNumber: string, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  return chFetch(`/company/${registrationNumber}/filing-history?items_per_page=20`, signal)
}

interface CompanySearchItem {
  company_name: string
  company_number: string
  company_status: string
  address_snippet?: string
  matchScore?: number
  [key: string]: unknown
}

function normalize(s: string): string {
  if (!s) return ""
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(limited|ltd|plc|llp|group|holdings|uk)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function computeMatchScore(query: string, companyName: string | undefined): number {
  if (!companyName) return 0
  const q = normalize(query)
  const n = normalize(companyName)
  if (!q || !n) return 0
  if (n === q) return 100

  const qWords = q.split(" ").filter((w) => w.length > 1)
  const nWords = n.split(" ").filter((w) => w.length > 1)
  if (qWords.length === 0) return 0

  const nWordSet = new Set(nWords)
  const matches = qWords.filter((w) => nWordSet.has(w)).length
  const recall = matches / qWords.length
  const union = new Set([...qWords, ...nWords]).size
  const jaccard = matches / union

  // recall × 0.75: all query words present = high score even with extra words in company name
  // jaccard × 0.25: penalises bloated names to preserve sort discrimination
  return Math.round((recall * 0.75 + jaccard * 0.25) * 100)
}

export async function searchCompanies(name: string): Promise<CompanySearchItem[]> {
  const data = await chFetch(`/search/companies?q=${encodeURIComponent(name)}&items_per_page=10`)
  const raw = (data?.items as Array<Record<string, unknown>>) ?? []
  // Search endpoint returns `title`; profile endpoint returns `company_name` — normalise here
  const items: CompanySearchItem[] = raw.map((item) => ({
    company_name: ((item.title ?? item.company_name ?? "") as string),
    company_number: (item.company_number as string) ?? "",
    company_status: (item.company_status as string) ?? "",
    address_snippet: item.address_snippet as string | undefined,
  }))
  const statusRank = (s: string) => (s === "active" ? 2 : s === "dissolved" ? 0 : 1)
  return items
    .map((item) => ({ ...item, matchScore: computeMatchScore(name, item.company_name) }))
    .sort((a, b) => {
      const statusDiff = statusRank(b.company_status) - statusRank(a.company_status)
      return statusDiff !== 0 ? statusDiff : (b.matchScore ?? 0) - (a.matchScore ?? 0)
    })
}

export async function fetchDirectorAppointments(officerUrl: string, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  // officerUrl is already the full relative path from the CH API (e.g. /officers/abc123/appointments)
  return chFetch(officerUrl, signal)
}
