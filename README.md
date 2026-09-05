# Sourcing Studio — AI Recruiter Refinement Loop

A focused full-stack implementation of Flexiple's sourcing refinement challenge. A recruiter describes a role in plain English, reviews editable hard filters and a weighted rubric, ranks the locally filtered profile pool with Gemini, teaches the search through ratings and written feedback, and freezes an evidence-backed shortlist. The differentiator is an auditable pipeline: application code owns filtering, evidence validation, weighted totals, structural diffs, and privacy-safe execution traces.

> **Loom walkthrough:** add the public Loom URL here after recording. The prepared talk track is in [`docs/LOOM-WALKTHROUGH.md`](docs/LOOM-WALKTHROUGH.md).

## What works

1. **Free-text brief** — the recruiter enters one natural-language requirement.
2. **Generate criteria** — a server-side Gemini call returns objective filters, a recruiter-readable interpretation, and a weighted subjective rubric.
3. **Edit directly** — every filter, rubric name, description, and weight is editable before search.
4. **Filter locally** — deterministic TypeScript checks all 48 supplied profiles; the LLM does not decide who passes a hard constraint.
5. **Rank with evidence** — Gemini scores every filtered candidate against every rubric criterion. The server validates IDs, score coverage, and exact canonical evidence, computes weighted totals, and returns the top five.
6. **Inspect the execution** — successful criteria, ranking, and refinement operations expose a latency waterfall, candidate funnel, provider calls/retries, optional token usage, grounding coverage, and versioned provider-schema fingerprints.
7. **Refine transparently** — ratings and recruiter feedback update the search. A server-computed before/after diff is factual authority; separate model prose explains its rationale.
8. **Freeze** — the final filters, rubric, refinement trail, evidence, ranked shortlist, and execution history become a read-only summary.
9. **Recover safely** — loading, no-match, malformed-output, timeout, rate-limit, network, and configuration paths preserve the last successful state.

## Run locally

### Prerequisites

- Node.js 20 or newer (validated on Node.js 24.5.0)
- npm
- A Gemini Developer API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Setup

```bash
npm install
cp .env.example .env.local
```

Set the key in `.env.local`:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

`GEMINI_MODEL` is optional; `gemini-3.5-flash-lite` is the default. After setting the key, run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> The key is read only inside Node.js Route Handlers. It is never returned to or bundled into the browser. `.env.local` is ignored by Git; `.env.example` contains names only.

## Suggested demo

Click **Use a demo brief**, or enter:

> Find RDS-focused engineers in Bangalore with 4–7 years of experience, PostgreSQL and AWS RDS skills, and startup backgrounds. Prefer product backend experience over pure reliability specialization.

After criteria generation, open **Inspect execution trace** to show the prompt version, provider-schema fingerprint, call/retry accounting, and privacy boundary. Run the search, then open the ranking trace to show the 48-profile local funnel and grounding audit.

Rate a product-backend candidate highly and a reliability-only candidate lower, then submit:

> Product backend experience matters more than pure database reliability. Scale-up exposure is a plus, not a hard requirement.

The expected behavior is a rubric adjustment rather than an overfitted scale-up hard filter, followed by a rerank. Show the deterministic red/green before/after diff first, then expand the model rationale and the merged refinement/reranking trace.

## Architecture

```text
Browser (React client)
  ├─ validates every API response with Zod
  ├─ keeps the last good state and up to 40 traces in sessionStorage
  └─ POSTs recruiter actions
       │
       ├─ /api/criteria
       │    ├─ Gemini: brief → objective filters + weighted rubric
       │    └─ server: normalize rubric + emit successful execution trace
       │
       ├─ /api/rank
       │    ├─ TypeScript: filter all 48 local profiles
       │    ├─ zero survivors: skip Gemini and emit a no-call trace
       │    ├─ Gemini: score every survivor against every criterion
       │    └─ TypeScript: ground evidence + compute totals + emit audit trace
       │
       └─ /api/refine
            ├─ Gemini: feedback/ratings → next filters + next rubric
            ├─ TypeScript: normalize and diff before/after criteria
            ├─ TypeScript + Gemini: rerun filter/rank/ground/score
            └─ server: merge refinement and reranking telemetry
```

### Main boundaries

| Concern | Location | Responsibility |
|---|---|---|
| Interactive workflow | `src/components/sourcing-workspace.tsx` | State machine, response validation, snapshot consistency, retries, history, freeze |
| Criteria editing | `src/components/criteria-editor.tsx` | Direct recruiter control over hard filters and weights |
| Candidate trust UI | `src/components/candidate-card.tsx` | Scores, retained field evidence, profile details, ratings |
| Visual refinement diff | `src/components/criteria-diff-view.tsx` | Deterministic additions, removals, updates, order and weight shifts |
| Execution inspector | `src/components/execution-trace-panel.tsx` | Waterfall, funnel, grounding, usage, version labels, privacy boundary |
| Runtime contracts | `src/lib/schemas.ts` | Strict Zod schemas for data, model output, APIs, traces, and persisted state |
| Objective filtering | `src/lib/filter-profiles.ts` | Deterministic local predicates and objective match evidence |
| Ranking integrity | `src/lib/ranking.ts` | Weight normalization, complete score coverage, exact evidence grounding, totals |
| Criteria diff | `src/lib/criteria-diff.ts` | Server-authored structural comparison independent of model prose |
| Trace aggregation | `src/lib/execution-trace.ts` | Timings, calls, retries, usage, funnel, grounding, and privacy flags |
| LLM boundary | `src/lib/gemini.ts` | Server-only SDK client, provider JSON Schema, retries, repair, safe errors, telemetry |
| Orchestration | `src/lib/search-service.ts` | Generate, filter, rank, refine, rerank, and trace composition |
| Prompts | [`src/lib/prompts.ts`](src/lib/prompts.ts) | All three complete production prompts |
| Sample data | `src/data/profiles.json` | Entire supplied 48-profile fictional pool |

## Auditable execution and deterministic refinement

The pipeline is deliberately split into:

```text
deterministic hard filters → bounded LLM scoring → exact evidence grounding → server totals
```

### Deterministic criteria diff

The refinement model returns a complete proposed configuration, not a patch. The server then compares the normalized before and after objects:

- array filters are compared as case/whitespace-normalized sets, so reordering alone is not a change;
- scalar filters retain exact before/after values;
- rubric criteria are tracked by stable ID;
- additions, removals, label/description edits, weight shifts, and priority-order changes are explicit;
- a truthful no-op is represented as an empty diff and `changes: []`.

The visual diff is computed from those objects. Model-authored `changes` remain a separate rationale and are never treated as factual authority.

### Execution trace

Each successful API operation returns a strict `ExecutionTrace` with:

- server-timed named steps and total duration;
- requested/returned model names when supplied by Gemini;
- actual provider-call count, bounded transport retries, structure repairs, and retry sleep;
- aggregate token counters when the provider returns them (`Not returned` otherwise);
- application prompt version labels and a SHA-256 fingerprint of the sanitized schema sent to Gemini;
- the 48-profile hard-filter funnel and per-filter exclusion counts;
- assessment, criterion, and retained-evidence coverage;
- an explicit flag that weighted totals were computed in application code.

The SDK's internal retry loop is disabled with `maxRetries: 0`; only the bounded application retry policy can issue another provider call, so successful trace call counts are not hidden behind SDK retries.

### Privacy boundary

A trace persists aggregate behavior only. It does **not** persist raw prompts, recruiter feedback, candidate records, API keys, provider response bodies/headers, or provider interaction IDs. Candidate records are sent to Gemini only for the bounded ranking operation; they are not copied into telemetry. Failed provider operations preserve the previous UI state but do not fabricate or store a successful trace.

The version labels are not content hashes of the prompt, and the displayed schema hash covers the provider-compatible sanitized schema—not every runtime-only Zod constraint. The UI labels this boundary directly.

## LLM interaction design

The app uses the pinned official `@google/genai` SDK and defaults to `gemini-3.5-flash-lite`. Each model operation requests `application/json` with a generated provider-compatible JSON Schema. Returned JSON is then validated with the full Zod runtime contract before application code sees it.

### Calls

1. **Criteria call** — requirement + canonical dataset catalog → interpretation, complete filter object, 3–5 weighted criteria.
2. **Ranking call** — already-filtered profile records + current rubric → one assessment per profile and one score per criterion.
3. **Refinement call** — original brief + current configuration + visible profiles + ratings + message → complete next configuration and optional change reasons.
4. **Reranking call** — the refinement endpoint reruns deterministic filtering and then invokes the same ranking path when survivors exist.

### Why not one giant prompt?

Separating planning, filtering, and ranking keeps hard constraints deterministic, makes failures recoverable at a clear boundary, and allows the recruiter to inspect/edit logic before profile ranking. It also prevents the model from silently relaxing filters while scoring candidates.

## Objective-filter semantics

Structured profile fields—not the prose summary—are authoritative for hard filters. This matters because supplied summaries can be intentionally broad or repetitive.

| Field | Semantics |
|---|---|
| `locations` | OR, exact normalized location; Bengaluru/Bangalore aliases are explicit |
| `min/maxYearsExperience` | Inclusive bounds |
| `requiredSkills` | AND: every skill must exist in `skills` |
| `anySkills` | OR: at least one alternative must exist |
| `titleKeywords` | OR across current and past title strings |
| `currentCompanyTypes` | OR against current company type only |
| `companyBackgroundTypes` | OR across current and past company types |
| `companyKeywords` | OR across current and past company names |
| `educationKeywords` | AND against the education string |

Common deterministic aliases such as `Postgres` → `PostgreSQL`, `RDS` → `AWS RDS`, and `Bengaluru` → `Bangalore` are intentionally narrow rather than an opaque semantic match.

## Ranking and evidence integrity

- Gemini must return every filtered profile exactly once.
- Every profile must receive every current rubric criterion exactly once.
- Criterion scores are integers from 1–5.
- Evidence declares a profile field and copies one approved canonical representation from that field.
- Grounding uses field-scoped, case/punctuation-normalized equality—not loose reverse substring matching.
- Each criterion must retain at least one grounded evidence item; unsupported extras are dropped and counted.
- The server rejects duplicate/unknown profile IDs, missing criteria, and criteria with no grounded evidence.
- The model does **not** supply the final total. The server computes:

```text
weighted fit = Σ ((criterion score / 5) × criterion weight)
```

Only the top five are rendered, but every profile surviving local filters is scored and validated.

## Failure and recovery behavior

| Failure | Behavior |
|---|---|
| Invalid model JSON/schema | One explicit repair call; then a safe retryable error |
| Unsupported/partial evidence | Ranking is rejected; previous results remain visible |
| 429, timeout, network, or 5xx | One bounded transport retry with backoff; then actionable UI retry |
| Bad/missing API key or model | Configuration-specific message; key remains server-side |
| Malformed browser/API payload | Rejected by Zod before state changes |
| Zero local matches | No ranking LLM call; trace marks model steps skipped |
| In-flight criteria edit | Successful ranking restores the submitted criteria snapshot, keeping result and trace consistent |
| Browser refresh | Last successful state restores from `sessionStorage`; old v1 state defaults traces to `[]` |

The browser never clears successful criteria/results while a replacement operation is pending. Retrying replays the current recruiter action without corrupting the last successful result.

## State model

Stable stages are:

```text
brief → criteria → results ↔ refinement → frozen
```

Pending work and errors are orthogonal to the stable stage, so the current screen stays usable and explainable during slow or failed calls. State lasts only in the current browser session. There is no login, database, multi-user state, or cross-session persistence.

## Decisions, priorities, and cuts

### Prioritized

- A complete vertical loop with real model calls
- Explicit hard-versus-soft search semantics
- Directly editable filters and rubric
- Schema validation on both server and browser
- Exact field-scoped evidence grounding and server-computed totals
- Server-authored criteria diffs separated from model rationale
- Privacy-safe, recruiter-visible execution traces
- Recoverability without losing recruiter work
- A polished workflow rather than a shell around API endpoints

### Deliberately cut for the assignment scope

- Authentication, teams, permissions, and multi-user concurrency
- A database or the notional 98M-profile production index
- Embeddings/vector search and fuzzy semantic retrieval
- Cross-session search history
- Streaming model output
- Multiple LLM providers or a model picker
- Deployment/infrastructure configuration
- Pagination/batched model ranking for pools larger than this sample
- A broad automated test suite; the submission uses strict contracts, lint, typecheck, production build, and focused smoke assertions instead

### With more time

1. Unit-test every deterministic filter/alias, diff, and evidence-grounding edge case.
2. Add browser integration tests for restore, failed refinement, retry, trace consistency, and freeze.
3. Build and evaluate a real retrieval index plus globally comparable batched reranking for large pools.
4. Export privacy-safe failed-request metrics to production observability and alerting.
5. Add a provider adapter only when a second provider is genuinely required and can be validated end to end.

## Known limitations and claim boundary

- The supplied environment contains 48 local profiles. This demonstrates the workflow and trust boundaries; it is **not** claimed as a solution for a 98M-profile corpus. Production scale would require an actual index, retrieval evaluation, batching, and load/cost validation.
- One Gemini request scores the complete filtered pool. That is appropriate for 48 records, not millions.
- Gemini quota and model availability depend on the supplied API key; override `GEMINI_MODEL` if needed.
- Token/model-return fields depend on what Gemini returns and display `Not returned` when absent.
- Stored traces describe successful operations. Failed provider attempts return safe errors but currently do not persist a failed trace.
- The evidence validator proves that retained evidence equals an allowed representation from the selected record; it cannot prove that every natural-language rationale is perfectly phrased.
- Manual comma-separated filter edits expect recognizable canonical values or the small documented alias set.
- State is intentionally session-only and local to one browser tab/session.
- No live LLM behavior is possible without the reviewer's own Gemini key.

## Validation

Offline validation completed on Node.js 24.5.0:

```bash
npm run check
npm audit
```

Focused transient assertions (no committed test harness or provider call) cover:

- order-insensitive array-filter diffs;
- scalar filter changes and rubric add/remove/weight shifts;
- old v1 session hydration with `executions: []`;
- removal of unsupported Gemini schema keywords;
- exact evidence grounding, including rejecting `13 years` against stored `3`;
- truthful no-op refinement contracts;
- zero-match `/api/rank` with skipped model steps and `execution.llm === null`;
- malformed JSON and missing-key API contracts.

A successful local Gemini flow is still required before recording to verify live latency, model-return, and token fields for the reviewer's current key/quota. Never paste the key into chat or commit it.

## Commands

```bash
npm run dev        # development server
npm run lint       # ESLint
npm run typecheck  # TypeScript, no emit
npm run build      # production build
npm run check      # lint + typecheck + production build
npm run start      # serve a completed production build
```

## Repository map

```text
src/
├── app/
│   ├── api/{criteria,rank,refine}/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── candidate-card.tsx
│   ├── criteria-diff-view.tsx
│   ├── criteria-editor.tsx
│   ├── criteria-snapshot.tsx
│   ├── execution-trace-panel.tsx
│   └── sourcing-workspace.tsx
├── data/profiles.json
└── lib/
    ├── api.ts
    ├── client-api.ts
    ├── criteria-diff.ts
    ├── execution-trace.ts
    ├── filter-profiles.ts
    ├── gemini.ts
    ├── profiles.ts
    ├── prompts.ts
    ├── ranking.ts
    ├── schemas.ts
    └── search-service.ts
```

## Submission aids

- [Loom walkthrough script](docs/LOOM-WALKTHROUGH.md)
- [Final repository and email checklist](docs/SUBMISSION-CHECKLIST.md)
