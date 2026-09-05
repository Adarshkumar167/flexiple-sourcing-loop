# Submission Checklist

## Repository

- [ ] Initialize Git only when ready; no generated `.next/`, `node_modules/`, or `.env.local` files are tracked.
- [ ] Confirm `.env.example` is tracked and contains no real key.
- [ ] Search the repository for the real API key before publishing.
- [ ] Run `npm ci` from a clean checkout if time permits.
- [ ] Run `npm run check` successfully.
- [ ] Confirm `src/data/profiles.json` contains all 48 supplied profiles.
- [ ] Confirm all three prompts are visible in `src/lib/prompts.ts`.
- [ ] Replace the Loom placeholder near the top of `README.md` with the final public URL.
- [ ] Ensure the repository is public, or explicitly grant the reviewers access.
- [ ] Open the repository URL in a signed-out/private browser window.

## Product smoke pass

- [ ] Free-text requirement produces editable filters and a rubric.
- [ ] Rubric weights total 100 before ranking.
- [ ] Search displays the matched count and 4–5 profiles for the demo query.
- [ ] Every rendered explanation includes actual profile evidence.
- [ ] At least one rating + feedback round changes the logic and reranks.
- [ ] Existing state survives a failed/offline refinement and Retry works.
- [ ] No-match state invites filter editing without making a ranking call.
- [ ] Freeze shows final filters, rubric, history, and ranked shortlist.
- [ ] Refresh restores the current browser-session state.

## Loom

- [ ] 15 minutes or less; target 8–10 minutes.
- [ ] One free-text search through Freeze.
- [ ] At least one feedback-driven refinement.
- [ ] One real failure/recovery moment.
- [ ] Brief explanation of decisions, priorities, cuts, and known limitations.
- [ ] No API key, notifications, private tabs, or unrelated files visible.
- [ ] “Anyone with the link” playback verified in a private browser.

## Final email

Reply in the original thread and use the recipients/CC requested by Flexiple. Keep personal email addresses out of the public repository.

```text
Hi Flexiple Team,

Please find my submission for the Software Engineer Engineering Challenge:

Repository: [repository URL]
Loom walkthrough: [Loom URL]

The README contains the setup instructions, required environment variable, architecture decisions, prompts, deliberate scope cuts, and known limitations. I followed the stated three-hour timebox.

Regards,
Adarsh Kumar
```

Only state that the three-hour timebox was followed if that is accurate. Before sending, click both links from a private browser window.
