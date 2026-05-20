import OpenAI from "openai"

export const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://github.com/romansavuliak/company-risk-assessment",
    "X-Title": "Company Risk Assessment",
  },
})

export const PRIMARY_MODEL = "anthropic/claude-haiku-4-5"
export const FALLBACK_MODEL = "anthropic/claude-sonnet-4-6"
