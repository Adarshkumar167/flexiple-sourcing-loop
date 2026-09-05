# Loom Walkthrough — 8–10 Minute Talk Track

The assignment allows up to 15 minutes. Aim for 8–10 minutes, one continuous take, and a visible end-to-end product rather than a code tour.

## Before recording

- Add a working `GEMINI_API_KEY` to `.env.local` and restart the app.
- Run `npm run check` once.
- Open a clean browser session and click **Start over** if old state exists.
- Keep DevTools available for the offline recovery demonstration, but closed initially.
- Hide `.env.local`, terminal history, notifications, bookmarks, and unrelated tabs.
- Confirm the Loom permission is **Anyone with the link can view**.

## Demo inputs

### Initial brief

> Find RDS-focused engineers in Bangalore with 4–7 years of experience, PostgreSQL and AWS RDS skills, and startup backgrounds. Prefer product backend experience over pure reliability specialization.

### Ratings and refinement

Rate one product-backend candidate `5` and one database-reliability specialist `2`, then enter:

> Product backend experience matters more than pure database reliability. Scale-up exposure is a plus, not a hard requirement.

## Talk track

### 0:00–0:45 — Frame the product

- “This is a single-session sourcing refinement loop over the complete supplied 48-profile dataset.”
- “Gemini interprets and scores; deterministic TypeScript owns hard filtering and weighted totals.”
- Point out the four visible stages: Brief, Criteria, Refine, Freeze.

### 0:45–1:40 — Free text to structured search logic

- Paste or select the demo brief.
- Click **Build search logic**.
- Let the loading state remain visible for a moment.
- Explain that the API key stays in a Node.js Route Handler and all model output is schema-validated.

### 1:40–3:00 — Review and edit criteria

- Read Gemini’s short interpretation.
- Show objective filters and explain AND/OR semantics for skills.
- Change one harmless field and change it back to demonstrate direct editing.
- Show the subjective rubric, weights, and **Balance to 100** behavior if useful.
- Click **Run search**.

### 3:00–4:45 — Inspect ranked evidence

- Point out `matched / 48 evaluated locally`.
- Open one or two rubric-evidence accordions.
- Explain that cited evidence values must exist in the selected structured profile.
- Point out that Gemini returns 1–5 criterion scores while application code computes the final weighted fit.
- Expand **Full profile details** briefly.

### 4:45–6:15 — Feedback-driven refinement

- Apply the prepared `5` and `2` ratings.
- Enter the prepared feedback.
- Click **Refine & rerank**.
- Show the change banner: what changed and why.
- Call out that “scale-up is a plus” should modify the rubric rather than overfit a hard filter.
- Show the new order and the visible conversation/refinement trail.

### 6:15–7:15 — Failure and safe recovery

- Open DevTools → Network and select **Offline**.
- Submit another short refinement such as “Keep the same logic; slightly favor stronger title alignment.”
- Show the inline network error and emphasize that filters, rubric, ratings/message, and existing results remain intact.
- Restore **Online**.
- Click **Retry safely** and show the successful completion.

This demonstrates a real transport failure rather than a mocked LLM response.

### 7:15–8:15 — Freeze

- Click **Freeze shortlist**.
- Show the read-only final filters, rubric, refinement trail, ranked candidates, evidence, and frozen timestamp.
- Mention that refresh restores this state only within the browser session.

### 8:15–9:30 — Decisions and cuts

Show the README, not individual implementation files:

- Real server-side Gemini calls and committed prompts
- Local deterministic filtering
- Zod and JSON Schema validation
- Grounded evidence and server-computed totals
- State-preserving retries
- Deliberate cuts: auth, DB, vector search, streaming, multiple providers, deployment

Close by stating the actual timebox honestly and showing the repository URL.

## Avoid during the recording

- Do not display the API key or `.env.local`.
- Do not read every README section or source file.
- Do not claim a feature you did not exercise.
- Do not call the no-match screen an LLM failure; it deliberately avoids the ranking call.
- Do not exceed 15 minutes.
