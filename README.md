# Sourcing Studio — AI Recruiter Refinement Loop

A focused full-stack implementation of Flexiple's sourcing refinement challenge. A recruiter describes a role in plain English, reviews editable hard filters and a weighted rubric, ranks the locally filtered profile pool with Gemini, teaches the search through ratings and written feedback, and freezes an evidence-backed shortlist.

> **Loom walkthrough:** add the public Loom URL here after recording. The prepared talk track is in [`docs/LOOM-WALKTHROUGH.md`](docs/LOOM-WALKTHROUGH.md).

## What works

1. **Free-text brief** — the recruiter enters one natural-language requirement.
2. **Generate criteria** — a real server-side Gemini call returns objective filters, a recruiter-readable interpretation, and a weighted subjective rubric.
3. **Edit directly** — every filter, rubric name, description, and weight is editable before search.
4. **Filter locally** — deterministic TypeScript checks all 48 supplied profiles; the LLM does not decide who passes a hard constraint.
5. **Rank with evidence** — Gemini scores every filtered candidate against every rubric criterion. The server validates IDs, score coverage, and evidence against actual profile fields, computes weighted totals, and returns the top five.
6. **Refine repeatedly** — 1–5 ratings and a written recruiter message update the filters/rubric, explain what changed and why, and rerun the complete search.
7. **Freeze** — the final filters, rubric, refinement trail, evidence, and ranked shortlist become a read-only summary.
8. **Recover safely** — loading, no-match, malformed-output, timeout, rate-limit, network, and configuration paths preserve the last successful state.

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

`GEMINI_MODEL` is optional; `gemini-3.5-flash-lite` is the default. After setting the key, the app runs with one command:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> The key is read only inside Node.js Route Handlers. It is never returned to or bundled into the browser. `.env.local` is ignored by Git; `.env.example` contains names only.

## Suggested demo

Click **Use a demo brief**, or enter:

> Find RDS-focused engineers in Bangalore with 4–7 years of experience, PostgreSQL and AWS RDS skills, and startup backgrounds. Prefer product backend experience over pure reliability specialization.

After ranking, rate a product-backend candidate highly and a reliability-only candidate lower, then submit:

> Product backend experience matters more than pure database reliability. Scale-up exposure is a plus, not a hard requirement.

The expected behavior is a rubric adjustment rather than an overfitted scale-up hard filter, followed by a visible rerank and a reasoned change summary.

## Architecture

```text
Browser (React client)
  ├─ validates every API response with Zod
  ├─ keeps the last good state in sessionStorage
  └─ POSTs recruiter actions
       │
       ├─ /api/criteria
       │    └─ Gemini: brief → objective filters + weighted rubric
       │
       ├─ /api/rank
       │    ├─ TypeScript: filter all 48 local profiles
       │    ├─ Gemini: score every survivor against every criterion
       │    └─ TypeScript: ground evidence + compute weighted totals
       │
       └─ /api/refine
            ├─ Gemini: feedback/ratings → next filters + next rubric
            ├─ TypeScript: rerun local filtering
            └─ Gemini + TypeScript: rerank and validate again
```

### Main boundaries

| Concern | Location | Responsibility |
|---|---|---|
| Interactive workflow | `src/components/sourcing-workspace.tsx` | State machine, session recovery, retries, refinement history, freeze |
| Criteria editing | `src/components/criteria-editor.tsx` | Direct recruiter control over hard filters and weights |
| Candidate trust UI | `src/components/candidate-card.tsx` | Scores, real field evidence, profile details, ratings |
| Runtime contracts | `src/lib/schemas.ts` | Strict Zod schemas for data, model output, APIs, and persisted state |
| Objective filtering | `src/lib/filter-profiles.ts` | Deterministic local predicates and objective match evidence |
| Ranking integrity | `src/lib/ranking.ts` | Weight normalization, complete score coverage, grounded evidence, totals |
| LLM boundary | `src/lib/gemini.ts` | Server-only SDK client, JSON Schema output, retries, repair, safe errors |
| Orchestration | `src/lib/search-service.ts` | Generate, filter, rank, refine, rerank |
| Prompts | [`src/lib/prompts.ts`](src/lib/prompts.ts) | All three complete production prompts |
| Sample data | `src/data/profiles.json` | Entire supplied 48-profile fictional pool |

## LLM interaction design

The app uses the pinned official `@google/genai` SDK and defaults to `gemini-3.5-flash-lite`. Each model operation uses `application/json` plus a generated JSON Schema. The returned JSON is then validated with the same Zod contract before application code sees it.

### Calls

1. **Criteria call** — requirement + canonical dataset catalog → interpretation, complete filter object, 3–5 weighted criteria.
2. **Ranking call** — already-filtered profile records + current rubric → one assessment per profile and one score per criterion.
3. **Refinement call** — original brief + current configuration + visible profiles + ratings + message → complete next configuration and change reasons.
4. **Reranking call** — the refinement endpoint reruns deterministic filtering and then invokes the same ranking path.

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
- Evidence declares a profile field and copies a value from that field.
- The server rejects duplicate/unknown profile IDs, missing criteria, and evidence that cannot be grounded in the selected record.
- The model does **not** supply the final total. The server computes:

```text
weighted fit = Σ ((criterion score / 5) × criterion weight)
```

Only the top five are rendered, but every profile surviving local filters is scored.

## Failure and recovery behavior

| Failure | Behavior |
|---|---|
| Invalid model JSON/schema | One explicit repair call; then a safe retryable error |
| Unsupported/partial evidence | Ranking is rejected; previous results remain visible |
| 429, timeout, network, or 5xx | One bounded transport retry with backoff; then actionable UI retry |
| Bad/missing API key or model | Configuration-specific message; key remains server-side |
| Malformed browser/API payload | Rejected by Zod before state changes |
| Zero local matches | No ranking LLM call; recruiter is invited to edit filters |
| Browser refresh | Last successful state restores from `sessionStorage` |

The browser never clears successful criteria/results while a replacement operation is pending. Retrying replays the last recruiter action against the same state.

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
- Evidence anchored to the supplied records
- Recoverability without losing recruiter work
- A polished workflow rather than a shell around API endpoints

### Deliberately cut for the three-hour scope

- Authentication, teams, permissions, and multi-user concurrency
- A database or the notional 98M-profile production index
- Embeddings/vector search and fuzzy semantic retrieval
- Cross-session search history
- Streaming model output
- Multiple LLM providers or a model picker
- Deployment/infrastructure configuration
- Pagination/batched model ranking for pools larger than this sample
- A broad automated test suite; the submission uses strict contracts, lint, typecheck, production build, and focused smoke checks instead

### With more time

1. Unit-test every deterministic filter/alias and evidence-grounding edge case.
2. Add browser integration tests for restore, failed refinement, retry, and freeze.
3. Batch/rerank large candidate pools while preserving globally comparable scores.
4. Add observability for provider latency, retries, token usage, and validation failures without logging recruiter text or secrets.
5. Add a provider adapter only when a second provider is genuinely required.

## Known limitations

- One Gemini request scores the complete filtered pool. That is appropriate for 48 records, not millions.
- Gemini quota and model availability depend on the supplied API key; override `GEMINI_MODEL` if needed.
- The evidence validator checks that cited values exist in the chosen record; it cannot prove that every natural-language rationale is perfectly phrased.
- Manual comma-separated filter edits expect recognizable canonical values or the small documented alias set.
- State is intentionally session-only and local to one browser tab/session.
- No live LLM behavior is possible without the reviewer's own Gemini key.

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
│   ├── criteria-editor.tsx
│   ├── criteria-snapshot.tsx
│   └── sourcing-workspace.tsx
├── data/profiles.json
└── lib/
    ├── api.ts
    ├── client-api.ts
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
