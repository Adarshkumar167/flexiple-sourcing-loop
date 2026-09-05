# Loom Walkthrough — 9–11 Minute Talk Track

The assignment allows up to 15 minutes. Aim for one continuous take centered on recruiter trust: deterministic filtering, bounded model judgment, exact evidence grounding, server totals, and an auditable refinement loop.

## Before recording

- Add a working `GEMINI_API_KEY` to `.env.local`; never paste it into chat or show the file.
- Restart the app after any environment change, then run one complete private rehearsal.
- Run `npm run check` and `npm audit` once.
- Confirm one live criteria → rank → refine flow succeeds under the current Gemini quota.
- Open each execution trace during rehearsal. Confirm latency/call fields render; token fields may legitimately say **Not returned**.
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

## Exact narrative

### 0:00–0:50 — Frame the engineering problem

Show the product, not the code.

> “This is a single-session sourcing refinement loop over the complete supplied 48-profile dataset. The hard problem is not generating JSON—it is deciding what the model may control, proving which evidence survived validation, and showing exactly why a recruiter’s search changed.”

> “The pipeline is deterministic hard filters, bounded LLM scoring, exact evidence grounding, then server-computed totals. I do not claim this local sample solves Flexiple’s 98-million-profile retrieval problem.”

Point out the visible Brief, Criteria, Refine, and Freeze progression.

### 0:50–1:55 — Free text to inspectable search logic

- Paste or select the demo brief.
- Click **Build search logic**.
- Explain that the key stays in a Node.js Route Handler and every response is runtime-validated.
- Open **Inspect execution trace**.

Say:

> “This trace is server-authored. It shows step latency, actual provider calls, bounded retries, structure repairs, and provider usage when Gemini returns it. SDK retries are disabled, so the wrapper is not hiding extra calls.”

Point to **Prompt version & provider schema**:

> “These are application template version labels plus a fingerprint of the sanitized schema sent to Gemini—not a raw prompt inspector and not a hash of every runtime Zod rule.”

Point to the privacy boundary:

> “Raw prompts, recruiter feedback, candidate payloads, API keys, and provider interaction IDs are never persisted in telemetry.”

Do not claim token values if the UI says **Not returned**.

### 1:55–3:05 — Recruiter controls hard versus soft logic

- Read Gemini’s short interpretation.
- Show objective filters and explain required-skill AND versus alternative-skill OR semantics.
- Change one harmless field and change it back to demonstrate direct editing.
- Show rubric descriptions and weights; use **Balance to 100** only if useful.

Say:

> “Gemini proposes this configuration, but the recruiter can inspect and edit it before any candidate is ranked. The model cannot silently relax hard filters during scoring.”

Click **Run search**.

### 3:05–4:55 — Prove the ranking path

- Point out `matched / 48 evaluated locally`.
- Expand one or two rubric-evidence sections.
- Open the ranking execution trace.
- Show the candidate funnel: local pool, matched, excluded, LLM window, returned.
- Show the grounding audit and weighted-total statement.

Say:

> “Every survivor is scored exactly once against every criterion. Evidence must equal an approved canonical representation from the declared profile field after normalization. Unsupported extras are dropped; a criterion with no grounded evidence rejects the ranking.”

> “Gemini returns only 1-to-5 criterion scores. Application code computes the weighted fit and chooses the top five.”

If useful, briefly expand **Full profile details** to connect cited evidence to the source record.

### 4:55–6:55 — Feedback, factual diff, and merged trace

- Apply the prepared `5` and `2` ratings.
- Enter the prepared refinement text.
- Click **Refine & rerank**.
- Start with the red/green deterministic diff.

Say:

> “The model returns a complete proposed configuration. The server compares normalized before and after objects. Array order alone does not count; rubric additions, removals, descriptions, weights, and priority order do.”

> “This visual diff is factual authority. The expandable model rationale is separate explanatory prose.”

Call out that “scale-up is a plus” should affect the rubric, not become an overfitted hard filter. If Gemini returns no structural change, show the truthful empty diff rather than inventing a change.

Open the latest execution trace:

> “A refinement is two bounded model stages when candidates survive: update the logic, then rerank. This trace merges both stages while retaining the deterministic filter funnel and grounding audit.”

Show the new shortlist order and refinement trail.

### 6:55–7:55 — Demonstrate real failure recovery

- Open DevTools → Network and select **Offline**.
- Submit another short refinement, for example: “Keep the same logic; slightly favor stronger title alignment.”
- Show the inline network error and unchanged successful state.
- Restore **Online**.
- Click **Retry safely** and show completion.

Say:

> “This is a real transport failure, not a mocked model response. Failed provider operations preserve the last successful state and do not fabricate a success trace.”

If quota makes a second live call risky, demonstrate offline failure without retry and state that limitation honestly.

### 7:55–8:45 — Freeze the decision record

- Click **Freeze shortlist**.
- Show the read-only final filters, rubric, deterministic refinement trail, ranked evidence, execution trace, and frozen timestamp.
- Mention that refresh restores state only within this browser session and old v1 session blobs hydrate with an empty trace list.

### 8:45–10:15 — Close on judgment, not feature count

Show the README sections **Auditable execution and deterministic refinement**, **Decisions, priorities, and cuts**, and **Known limitations and claim boundary**.

Say:

> “I deliberately rejected a theatrical provider switcher because I had no second credentialed path to validate. I also rejected claiming BM25 or vectors solve 98-million-profile search without an index, embeddings pipeline, retrieval evaluation, and scale tests.”

> “The differentiator I chose is defensible trust infrastructure: deterministic diffs, exact grounding, truthful retry accounting, strict contracts, and privacy-safe traces.”

> “The repository passes lint, TypeScript, production build, audit, and focused offline behavior probes. The live provider fields shown in this recording are limited to what this Gemini key actually returned.”

Close by showing the repository URL and stating the actual timebox only if accurate.

## Claims to use

- “Deterministic hard filters → bounded LLM scoring → exact evidence grounding → server totals.”
- “The server-computed diff is factual authority; model prose is rationale.”
- “SDK retries are disabled, so successful trace provider-call counts reflect wrapper invocations.”
- “Provider token fields are displayed only when returned.”
- “The trace stores aggregate behavior, not raw prompts or candidate payloads.”
- “This is validated for the supplied 48-profile corpus, not claimed as a 98M-scale retrieval system.”

## Claims to avoid

- “The system is production-ready for 98 million profiles.”
- “The schema hash fingerprints the whole prompt and every runtime validator.”
- “Every failed provider attempt has a stored trace.”
- “Grounding proves every sentence in the rationale is true.”
- “Token counts are always available.”
- “Multiple providers are supported.”

## Avoid during the recording

- Do not display the API key or `.env.local`.
- Do not open raw provider responses, terminal history, or private candidate/recruiter payloads.
- Do not read every README section or tour every source file.
- Do not claim a field you did not exercise in the live flow.
- Do not call the no-match screen an LLM failure; it deliberately avoids the ranking call.
- Do not exceed 15 minutes.
