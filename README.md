# Company Risk Assessment

A Next.js app that assesses UK company risk in real time using Companies House data, adverse media search, and AI-powered synthesis.

## How to Run

```bash
cp .env.example .env.local
# Fill in COMPANIES_HOUSE_API_KEY, TAVILY_API_KEY, OPENROUTER_API_KEY
npm install
npm run dev
```

Open http://localhost:3000. Search by company name or registration number.

```bash
npm test              # unit + integration tests
npm run test:coverage # coverage report
```

## Environment Variables

| Variable                  | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `COMPANIES_HOUSE_API_KEY` | Free at developer.company-information.service.gov.uk |
| `TAVILY_API_KEY`          | Adverse media search via Tavily                      |
| `OPENROUTER_API_KEY`      | Routes to Claude Haiku 4.5 via OpenAI-compatible API |

## Architecture

```
POST /api/assess
  ├── Company resolution (name search or direct reg-number lookup)
  │   └── Disambiguation list if >1 match returned
  ├── SSE: company_found
  ├── Phase 1 — parallel gather (Promise.allSettled, 5s AbortController timeout each)
  │   ├── Companies House: company profile
  │   ├── Companies House: officers & directors
  │   ├── Companies House: filing history
  │   └── Tavily: adverse media search
  ├── SSE: source_complete (with sanitised partial data for progressive UI fill)
  ├── Phase 2 — director network (sequential, depends on officers result, 3s timeout)
  ├── LLM synthesis — Claude Haiku 4.5 via OpenRouter
  │   ├── Tool-calling forces schema-conformant output (Zod → JSON Schema)
  │   ├── Retry up to 3× with corrective prompting (previous error fed back)
  │   ├── 25s overall timeout (Promise.race)
  │   └── Fallback assessment on exhaustion
  ├── Confidence score — calculated server-side from raw data (LLM cannot influence it)
  └── SSE: assessment_complete
```

**Key separation:** Two Zod schemas — `LLMOutputSchema` (what the LLM fills in) and `RiskAssessmentSchema` (extends with server-computed `confidence` and `metadata`). The LLM never sees or influences the confidence score.

## Design Decisions

**Server-Sent Events over WebSockets.** One-way server→client data flow matches the assessment pipeline perfectly. Simpler to implement, works through HTTP proxies, no handshake overhead.

**Promise.allSettled for source fetching.** Each source fails independently. A Tavily timeout doesn't block Companies House results. The assessment proceeds with whatever data arrived.

**AbortController timeouts, not Promise.race.** Each source fetch passes an AbortSignal so the underlying HTTP request is actually cancelled when the timeout fires — not just abandoned in the background consuming connections and API quota.

**Server-side age pre-computation.** The LLM prompt includes `ageMonths` calculated from `date_of_creation` before the prompt is sent. This eliminates a whole class of hallucination (LLMs reliably miscalculate relative dates) and was directly responsible for fixing a false-positive "medium" risk rating on a legitimate young company.

**Prompt versioning stamped on every output.** `PROMPT_VERSION` in `lib/schema.ts` is bumped on every prompt change. Every assessment log entry includes `prompt_version`, `confidence_score`, `overall_risk`, and `raw_data_hash`. This makes it possible to compare output quality before/after a prompt change on identical inputs.

**Immutable progressive UI.** Partial source data fills sections immediately as sources complete. Once shown, values are frozen — the LLM result cannot replace them, only add enrichments (prolific badge, appointment counts, age suffix). Small skeleton placeholders signal pending enrichments so the user knows more is coming.

## Trade-offs

**Tavily over free scraping.** Reliable, pre-extracted content, built for LLM consumption. Scraping news sites adds brittle parsers and worse recall. Cost is ~$0.001 per search at this scale.

**Single LLM call for all synthesis.** Simpler to reason about and test. One call per source would reach first partial result faster but makes producing a coherent cross-source risk score harder.

**Director network limited to top 3 directors with a 3s timeout.** Each director requires an additional API call. At top-3 with a tight timeout, the feature contributes useful signal without adding significant tail latency. Expanding to 5+ risks pushing total latency past 10s on large companies.

**Companies House only.** Multi-jurisdiction requires per-jurisdiction source adapters (OpenCorporates, local registries) and a routing layer. Out of scope for this prototype but the source architecture (`lib/sources/`) is designed for it.

## What I'd Do Differently

**Response caching.** Companies House data changes at most daily. A Redis cache keyed on registration number with a 1-hour TTL would eliminate most API calls on repeat lookups and significantly reduce latency for popular companies.

**Streaming LLM output.** Currently the UI shows a skeleton until the full LLM response arrives. With streaming completions, the explanation text could render token-by-token. Zod validation would happen after the stream closes, but perceived latency would drop.

**Assessment history.** Storing results in a database would enable trend detection — a company that was "low" risk last month and is "high" risk today is more interesting than either rating in isolation.

**Multi-jurisdiction.** Add a new file per jurisdiction to `lib/sources/` with the same function signatures, then route in `app/api/assess/route.ts` based on the `jurisdiction` input field.

## Questions for Consideration

**What is a good UX to progressively show results? How will users know when results are final?**

The assessment card appears immediately when the request starts. Each data source has a segment in a progress bar (blue = loading, green = complete, red = error) with a live `X/5 sources` counter. Sections fill in as their source completes — company details from the profile, directors from officers, filing count from filings — with inline skeleton placeholders for LLM-only enrichments (prolific badge, age in months). Once all sources finish, a "Synthesising with AI…" indicator appears. The risk badge, confidence bar, and explanation fill in when the LLM responds, and the card border transitions from grey to the risk colour. Partial data shown before the LLM responds is immutable — it does not change when the LLM result arrives.

**What should happen if the search takes longer than expected?**

Individual sources each have a hard AbortController timeout (5s for main sources, 3s for director network). LLM synthesis has a 25s `Promise.race` timeout. On any timeout, an error SSE event streams to the client with a user-readable message, the stream closes, and partial data already shown remains visible. The user is not left with an infinite spinner.

**What UX is best if no company is found, or several similar matches exist?**

If Companies House returns no results, an inline error message is shown. If it returns multiple matches, a disambiguation list is shown with company name, registration number, status, and address. The user selects one; the assessment then runs directly by registration number with no further ambiguity. For example, "Tunic Pay" resolves to "TUNIC & CO UK LIMITED" via this flow.

**How would you version prompts and track whether a change improved or degraded results?**

`PROMPT_VERSION` is a constant in `lib/schema.ts`, stamped on every assessment output and log entry. Each JSONL log line includes `prompt_version`, `confidence_score`, `overall_risk`, and `raw_data_hash`. To evaluate a change: run the same inputs (fixture files in `__tests__/fixtures/`) before and after, compare confidence score distributions and risk classifications. The `raw_data_hash` ensures you're comparing against identical source data.

## Example Inputs and Outputs

See `__tests__/fixtures/` for representative inputs and expected LLM output structure.

| Input                       | Behaviour                                         |
| --------------------------- | ------------------------------------------------- |
| Name: `"Marks and Spencer"` | Disambiguation list (multiple CH matches)         |
| Name: `"Tunic Pay"`         | Disambiguates to TUNIC & CO UK LIMITED (15259143) |
| Reg number: `"00000006"`    | Direct lookup, no disambiguation                  |
