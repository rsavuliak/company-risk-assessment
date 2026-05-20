import { fetchProfile, fetchOfficers, fetchFilings, fetchDirectorAppointments, searchCompanies } from "@/lib/sources/companies-house"
import chProfile from "../fixtures/ch-profile.json"
import chOfficers from "../fixtures/ch-officers.json"
import chFilings from "../fixtures/ch-filings.json"
import chSearch from "../fixtures/ch-search.json"

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => mockFetch.mockReset())

describe("fetchProfile", () => {
  it("returns profile data on 200", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => chProfile })
    const result = await fetchProfile("12345678")
    expect(result).toEqual(chProfile)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("12345678"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining("Basic ") }) })
    )
  })

  it("returns null on 404", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    const result = await fetchProfile("00000000")
    expect(result).toBeNull()
  })

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network failure"))
    const result = await fetchProfile("12345678")
    expect(result).toBeNull()
  })
})

describe("fetchOfficers", () => {
  it("returns officers data on 200", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => chOfficers })
    const result = await fetchOfficers("12345678")
    expect(result).toEqual(chOfficers)
  })
})

describe("fetchFilings", () => {
  it("returns filings data on 200", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => chFilings })
    const result = await fetchFilings("12345678")
    expect(result).toEqual(chFilings)
  })
})

describe("fetchDirectorAppointments", () => {
  it("fetches the appointments path returned by the officers endpoint", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    await fetchDirectorAppointments("/officers/abc123xyz/appointments")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/officers/abc123xyz/appointments"),
      expect.anything()
    )
    // must NOT double-append /appointments
    const calledUrl: string = (mockFetch.mock.calls[0][0] as string)
    expect(calledUrl.match(/\/appointments/g)).toHaveLength(1)
  })

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network failure"))
    const result = await fetchDirectorAppointments("/officers/abc123xyz/appointments")
    expect(result).toBeNull()
  })
})

describe("searchCompanies", () => {
  it("returns items sorted active-first, dissolved-last", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => chSearch })
    const result = await searchCompanies("thornfield consulting")
    expect(result[0].company_status).toBe("active")
    expect(result[result.length - 1].company_status).toBe("dissolved")
  })

  it("maps title field to company_name (search API uses title, not company_name)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => chSearch })
    const result = await searchCompanies("thornfield consulting")
    expect(result[0].company_name).toBe("THORNFIELD CONSULTING LIMITED")
  })

  it("attaches a matchScore greater than 0 to each result", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => chSearch })
    const result = await searchCompanies("thornfield consulting")
    expect(result[0].matchScore).toBeGreaterThan(0)
  })

  it("sorts active results above dissolved results of equal match quality", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => chSearch })
    const result = await searchCompanies("thornfield consulting")
    const lastStatus = result[result.length - 1].company_status
    expect(lastStatus).toBe("dissolved")
  })
})
