# Submission Checklist

## Repository and secrets

- [ ] Confirm `.env.local`, `.next/`, and `node_modules/` are ignored and untracked.
- [ ] Confirm `.env.example` is tracked and contains variable names/placeholders only.
- [ ] Scan tracked/source/documentation files for real API-key patterns while explicitly excluding `.env.local`.
- [ ] Confirm no raw prompts, recruiter feedback, candidate payloads, provider response bodies, or provider interaction IDs are persisted in execution traces.
- [ ] Confirm `src/data/profiles.json` contains all 48 supplied fictional profiles.
- [ ] Confirm all three prompts are visible in `src/lib/prompts.ts`.
- [ ] Review `git diff` and `git status`; remove temporary review/build artifacts.
- [ ] Replace the Loom placeholder near the top of `README.md` with the final public URL.
- [ ] Ensure the repository is public, or explicitly grant reviewers access.
- [ ] Open the repository URL in a signed-out/private browser window.

## Automated and focused validation

- [ ] Run `npm ci` from a clean checkout if time permits.
- [ ] Run `npm run check` successfully (ESLint, TypeScript, production build).
- [ ] Run `npm audit` and record the result accurately.
- [ ] Confirm focused diff probes: reordered arrays produce no change; scalar updates and rubric add/remove/weight shifts are detected.
- [ ] Confirm an old v1 session blob without `executions` hydrates with `[]`.
- [ ] Confirm provider schemas omit unsupported `pattern`, `minLength`, `maxLength`, `minItems`, `maxItems`, and `$schema` keys.
- [ ] Confirm exact grounding rejects `13 years` for a profile storing `3` years.
- [ ] Confirm model/API/history contracts accept `changes: []` for a truthful no-op refinement.
- [ ] Confirm zero-match `/api/rank` returns a valid trace with skipped model steps, `execution.llm === null`, and no provider call.
- [ ] Confirm malformed JSON and missing required keys still return `INVALID_REQUEST` without state mutation.

## Live product smoke pass

- [ ] Restart `npm run dev` after setting/changing the local Gemini key or model.
- [ ] Free-text requirement produces editable filters and a rubric.
- [ ] Criteria trace opens and shows latency, prompt version, provider-schema hash, call/retry accounting, and privacy boundary.
- [ ] Rubric weights total 100 before ranking.
- [ ] Demo search displays the matched count and a plausible 4–5-profile shortlist.
- [ ] Ranking trace shows the 48-profile funnel, bounded LLM window, grounding audit, and server-computed-total flag.
- [ ] Every rendered criterion includes retained evidence from the selected structured profile field.
- [ ] Provider token/model-return fields are claimed only when populated; **Not returned** is acceptable.
- [ ] At least one rating + feedback round reranks and produces a deterministic before/after diff.
- [ ] Model rationale is visually separate from the deterministic diff.
- [ ] Refinement trace includes both refinement and reranking stages when survivors exist.
- [ ] Existing state survives a failed/offline refinement; Retry works if quota allows.
- [ ] No-match state invites filter editing and explicitly shows that no ranking LLM call occurred.
- [ ] Freeze shows final filters, rubric, history, ranked shortlist, and trace.
- [ ] Refresh restores the current browser-session state.

## Claim boundary

- [ ] Say this implementation is validated over the supplied 48-profile corpus.
- [ ] Do **not** claim it solves Flexiple’s notional 98M-profile retrieval problem.
- [ ] Do **not** call prompt version labels prompt-content fingerprints.
- [ ] Describe schema hashes as fingerprints of the sanitized provider schema, not the full runtime Zod contract.
- [ ] State that stored traces describe successful operations; failed provider attempts currently return safe errors without a persisted failure trace.
- [ ] State that grounding validates retained field evidence, not every sentence of model rationale.
- [ ] State that multiple providers and vector/BM25 retrieval were deliberate cuts, not hidden capabilities.

## Loom

- [ ] 15 minutes or less; target 9–11 minutes.
- [ ] One free-text search through Freeze.
- [ ] Show one criteria trace, ranking funnel/grounding audit, and merged refinement trace.
- [ ] Show the deterministic visual diff before model-authored rationale.
- [ ] Include at least one feedback-driven refinement.
- [ ] Include one real failure/recovery moment if quota permits.
- [ ] Explain the privacy boundary and exact retry accounting.
- [ ] Explicitly reject a false 98M-scale claim and theatrical multi-provider switching.
- [ ] Briefly explain decisions, priorities, cuts, and known limitations.
- [ ] No API key, `.env.local`, notifications, private tabs, raw payloads, or unrelated files visible.
- [ ] “Anyone with the link” playback verified in a private browser.

## Final email

Reply in the original thread and use the recipients/CC requested by Flexiple. Keep personal email addresses out of the public repository.

```text
Hi Flexiple Team,

Please find my submission for the Software Engineer Engineering Challenge:

Repository: [repository URL]
Loom walkthrough: [Loom URL]

The README contains setup instructions, architecture decisions, prompts, deliberate scope cuts, known limitations, and the validation boundary. The implementation includes a server-authored criteria diff and a privacy-safe execution trace covering the deterministic filter funnel, bounded model calls, evidence grounding, and server-computed totals.

Regards,
Adarsh Kumar
```

Only state that a specific timebox was followed if that is accurate. Before sending, click both links from a private browser window.
