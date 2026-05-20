import { tavily } from "@tavily/core"

export async function searchAdverseMedia(companyName: string): Promise<string[] | null> {
  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY ?? "" })
    const query = `"${companyName}" UK (news OR complaints OR allegations OR regulatory action)`
    const response = await client.search(query, { search_depth: "basic", max_results: 10 })
    return response.results.map((r: { content: string }) => r.content)
  } catch {
    return null
  }
}
