import "@testing-library/jest-dom"

process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "test-key"
process.env.COMPANIES_HOUSE_API_KEY = process.env.COMPANIES_HOUSE_API_KEY ?? "test-key"
process.env.TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? "test-key"

// Block any real HTTP that slips through an unmocked path — fail loudly rather than silently
// hitting the network. Individual test files override global.fetch with jest.fn() as needed.
global.fetch = ((...args: Parameters<typeof fetch>): ReturnType<typeof fetch> => {
  throw new Error(
    `[test] Real network call blocked: ${String(args[0])}. ` +
    `Set global.fetch = jest.fn() or use jest.mock() before this call.`
  )
}) as typeof fetch
