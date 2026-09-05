"use client";

import { useEffect, useMemo, useState } from "react";
import CandidateCard from "@/components/candidate-card";
import CriteriaEditor from "@/components/criteria-editor";
import CriteriaSnapshot from "@/components/criteria-snapshot";
import { ApiClientError, postJson } from "@/lib/client-api";
import {
  RankRequestSchema,
  RankingResponseSchema,
  RefineRequestSchema,
  RefinementResponseSchema,
  SearchCriteriaSchema,
  SearchSessionStateSchema,
  type ObjectiveFilters,
  type RecruiterRating,
  type RubricCriterion,
  type SearchSessionState,
} from "@/lib/schemas";

const STORAGE_KEY = "flexiple-sourcing-loop:v1";
const DEMO_REQUIREMENT =
  "Find RDS-focused engineers in Bangalore with 4–7 years of experience, PostgreSQL and AWS RDS skills, and startup backgrounds. Prefer product backend experience over pure reliability specialization.";

const STEPS = [
  { label: "Brief", caption: "Describe the search" },
  { label: "Criteria", caption: "Review the logic" },
  { label: "Refine", caption: "Rate and teach" },
  { label: "Freeze", caption: "Lock the shortlist" },
];

type PendingAction = "criteria" | "rank" | "refine" | null;
type RetryAction = Exclude<PendingAction, null>;

type DisplayError = {
  code: string;
  message: string;
  retryable: boolean;
  details: string[];
};

function createInitialState(): SearchSessionState {
  return {
    version: 1,
    stage: "search",
    requirement: "",
    interpretation: "",
    filters: null,
    rubric: [],
    ranking: null,
    ratings: {},
    feedback: "",
    round: 0,
    history: [],
    frozenAt: null,
  };
}

function activeStep(stage: SearchSessionState["stage"]): number {
  if (stage === "search") return 0;
  if (stage === "criteria") return 1;
  if (stage === "results") return 2;
  return 3;
}

function asDisplayError(error: unknown): DisplayError {
  if (error instanceof ApiClientError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details,
    };
  }
  return {
    code: "UNEXPECTED_CLIENT_ERROR",
    message:
      "Something unexpected happened in the browser. Your previous search state is unchanged.",
    retryable: true,
    details: [],
  };
}

function localError(message: string, details: string[] = []): DisplayError {
  return {
    code: "CHECK_SEARCH_INPUTS",
    message,
    retryable: false,
    details,
  };
}

function AppMark() {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[#173f2c] shadow-[0_8px_22px_rgba(20,67,43,0.25)]">
      <span className="absolute h-5 w-5 rotate-45 rounded-[4px] border-2 border-[#bce2c9]" />
      <span className="h-2 w-2 rounded-full bg-[#ffb18e]" />
    </div>
  );
}

function ProgressSteps({ stage }: { stage: SearchSessionState["stage"] }) {
  const current = activeStep(stage);
  return (
    <ol className="hidden items-center gap-1 lg:flex" aria-label="Search progress">
      {STEPS.map((step, index) => {
        const selected = index === current;
        const complete = index < current;
        return (
          <li key={step.label} className="flex items-center">
            {index > 0 && (
              <span
                className={`mx-2 h-px w-8 ${complete || selected ? "bg-[#79ad8d]" : "bg-[#d8dfda]"}`}
              />
            )}
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                  selected
                    ? "bg-[#1e7149] text-white"
                    : complete
                      ? "bg-[#dff1e5] text-[#246b47]"
                      : "bg-[#edf0ee] text-[#89938d]"
                }`}
              >
                {complete ? "✓" : index + 1}
              </span>
              <div>
                <p
                  className={`text-xs font-bold ${selected ? "text-[#1b4d34]" : "text-[#647068]"}`}
                >
                  {step.label}
                </p>
                <p className="text-[10px] text-[#96a099]">{step.caption}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PendingBanner({ action }: { action: Exclude<PendingAction, null> }) {
  const copy = {
    criteria: {
      title: "Turning the brief into search logic",
      detail: "Gemini is separating hard constraints from weighted preferences.",
    },
    rank: {
      title: "Filtering locally, then ranking the survivors",
      detail: "All 48 records are checked in code before Gemini scores the matched pool.",
    },
    refine: {
      title: "Learning from recruiter feedback",
      detail: "The current state stays visible until the new criteria and ranking both validate.",
    },
  }[action];

  return (
    <div className="mb-6 flex items-center gap-4 rounded-2xl border border-[#cfe2d6] bg-[#eef8f1] px-4 py-4 shadow-sm sm:px-5" role="status">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#a8cfb6] border-t-[#1e7149]" />
      </span>
      <div>
        <p className="text-sm font-bold text-[#204d35]">{copy.title}</p>
        <p className="mt-0.5 text-xs leading-5 text-[#5d7465]">{copy.detail}</p>
      </div>
    </div>
  );
}

function ErrorBanner({
  error,
  onDismiss,
  onRetry,
}: {
  error: DisplayError;
  onDismiss: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-[#efc7ba] bg-[#fff6f2] p-4 shadow-sm sm:p-5" role="alert">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f9dfd5] text-sm font-black text-[#a34729]">
          !
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[#7b321e]">Couldn’t complete that step</p>
            <code className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-[#9a5b47]">
              {error.code}
            </code>
          </div>
          <p className="mt-1 text-sm leading-5 text-[#754c3e]">{error.message}</p>
          {error.details.length > 0 && (
            <details className="mt-2 text-xs text-[#8a5b4b]">
              <summary className="cursor-pointer font-semibold">Validation details</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-3 flex gap-2">
            {error.retryable && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg bg-[#8e422a] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#743520]"
              >
                Retry safely
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-[#e3bdae] bg-white px-3 py-1.5 text-xs font-bold text-[#87513f]"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchLanding({
  requirement,
  busy,
  onRequirementChange,
  onSubmit,
}: {
  requirement: string;
  busy: boolean;
  onRequirementChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid items-start gap-8 py-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] lg:gap-12 lg:py-14">
      <section>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#cfddd4] bg-white px-3 py-1.5 text-xs font-bold text-[#356149] shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#42a36c] shadow-[0_0_0_4px_rgba(66,163,108,0.12)]" />
          48 local profiles · real Gemini ranking
        </div>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-[#132019] sm:text-5xl lg:text-[58px]">
          Turn a hiring brief into a shortlist you can defend.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[#5d6b62] sm:text-lg">
          Describe who you need. Review the hard filters and ranking logic, then teach the search with real recruiter feedback.
        </p>

        <form
          className="mt-8 rounded-2xl border border-[#d5ded8] bg-white p-3 shadow-[0_24px_70px_rgba(29,73,48,0.12)] sm:p-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label htmlFor="search-brief" className="sr-only">
            Recruiter requirement
          </label>
          <textarea
            id="search-brief"
            value={requirement}
            onChange={(event) => onRequirementChange(event.target.value)}
            disabled={busy}
            maxLength={1500}
            rows={5}
            placeholder="Example: Find RDS-focused engineers in Bangalore with 4–7 years, PostgreSQL and AWS RDS, and startup experience…"
            className="min-h-36 w-full resize-y rounded-xl border-0 bg-[#f8faf8] px-4 py-4 text-base leading-7 text-[#18241d] outline-none placeholder:text-[#929c95] focus:ring-2 focus:ring-[#57a779]/30 disabled:opacity-60"
          />
          <div className="mt-3 flex flex-col justify-between gap-3 px-1 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => onRequirementChange(DEMO_REQUIREMENT)}
                className="text-xs font-bold text-[#31704e] underline decoration-[#afd2bc] underline-offset-4 disabled:opacity-50"
              >
                Use a demo brief
              </button>
              <span className="text-[11px] text-[#919a94]">
                {requirement.length}/1500
              </span>
            </div>
            <button
              type="submit"
              disabled={busy || requirement.trim().length < 10}
              className="h-12 rounded-xl bg-[#1e7149] px-6 text-sm font-bold text-white shadow-[0_12px_30px_rgba(30,113,73,0.24)] transition hover:-translate-y-0.5 hover:bg-[#175c3b] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#a8b8ad] disabled:shadow-none"
            >
              {busy ? "Building criteria…" : "Build search logic →"}
            </button>
          </div>
        </form>
      </section>

      <aside className="rounded-2xl border border-[#dae2dc] bg-[#17231d] p-6 text-white shadow-[0_24px_70px_rgba(20,42,29,0.16)] sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#96c4a8]">
          One focused loop
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          Judgment stays visible.
        </h2>
        <ol className="mt-7 grid gap-5">
          {[
            ["01", "Generate", "Gemini separates objective constraints from subjective judgment."],
            ["02", "Filter & rank", "Code filters the complete file; the model scores only the survivors."],
            ["03", "Refine", "Ratings and written feedback update the logic and rerun the search."],
            ["04", "Freeze", "The final filters, rubric, evidence, and shortlist lock together."],
          ].map(([number, title, detail]) => (
            <li key={number} className="grid grid-cols-[34px_1fr] gap-3">
              <span className="text-xs font-black text-[#ffad88]">{number}</span>
              <div>
                <p className="text-sm font-bold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[#b9c7be]">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.05] p-4 text-xs leading-5 text-[#c7d3cb]">
          Structured outputs are validated twice—on the server and again before the browser applies them.
        </div>
      </aside>
    </div>
  );
}

export default function SourcingWorkspace() {
  const [state, setState] = useState<SearchSessionState>(createInitialState);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<DisplayError | null>(null);
  const [lastAction, setLastAction] = useState<RetryAction | null>(null);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const stored = window.sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = SearchSessionStateSchema.safeParse(JSON.parse(stored));
          if (parsed.success) setState(parsed.data);
        }
      } catch {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const ratedCount = useMemo(
    () => Object.keys(state.ratings).length,
    [state.ratings],
  );

  function updateFilters(filters: ObjectiveFilters) {
    setState((current) => ({ ...current, filters }));
  }

  function updateRubric(rubric: RubricCriterion[]) {
    setState((current) => ({ ...current, rubric }));
  }

  async function generateCriteria() {
    if (pending) return;
    const requirement = state.requirement.trim();
    if (requirement.length < 10) {
      setError(localError("Describe the role in at least 10 characters."));
      return;
    }

    setError(null);
    setLastAction("criteria");
    setPending("criteria");
    try {
      const criteria = await postJson({
        path: "/api/criteria",
        body: { requirement },
        schema: SearchCriteriaSchema,
      });
      setState((current) => ({
        ...current,
        stage: "criteria",
        requirement,
        interpretation: criteria.interpretation,
        filters: criteria.filters,
        rubric: criteria.rubric,
        ranking: null,
        ratings: {},
        feedback: "",
        round: 0,
        history: [],
        frozenAt: null,
      }));
    } catch (caught) {
      setError(asDisplayError(caught));
    } finally {
      setPending(null);
    }
  }

  async function runRanking() {
    if (pending || !state.filters) return;
    const payload = RankRequestSchema.safeParse({
      filters: state.filters,
      rubric: state.rubric,
    });
    if (!payload.success) {
      setError(
        localError(
          "Fix the filters or rubric before running the search.",
          payload.error.issues.map((issue) =>
            `${issue.path.join(".") || "criteria"}: ${issue.message}`,
          ),
        ),
      );
      return;
    }
    const totalWeight = state.rubric.reduce(
      (total, criterion) => total + criterion.weight,
      0,
    );
    if (totalWeight !== 100) {
      setError(localError("Rubric weights must total exactly 100%."));
      return;
    }

    setError(null);
    setLastAction("rank");
    setPending("rank");
    try {
      const ranking = await postJson({
        path: "/api/rank",
        body: payload.data,
        schema: RankingResponseSchema,
      });
      setState((current) => ({
        ...current,
        stage: "results",
        ranking,
        ratings: {},
        feedback: "",
        frozenAt: null,
      }));
    } catch (caught) {
      setError(asDisplayError(caught));
    } finally {
      setPending(null);
    }
  }

  async function refine() {
    if (pending || !state.filters || !state.ranking) return;
    const ratings: RecruiterRating[] = Object.entries(state.ratings).map(
      ([profileId, rating]) => ({ profileId, rating }),
    );
    const payload = RefineRequestSchema.safeParse({
      requirement: state.requirement,
      filters: state.filters,
      rubric: state.rubric,
      ratings,
      feedback: state.feedback,
      currentResultIds: state.ranking.results.map((result) => result.profile.id),
      round: state.round + 1,
    });
    if (!payload.success) {
      setError(
        localError(
          "Add at least one rating or a written refinement message.",
          payload.error.issues.map((issue) => issue.message),
        ),
      );
      return;
    }

    setError(null);
    setLastAction("refine");
    setPending("refine");
    try {
      const refinement = await postJson({
        path: "/api/refine",
        body: payload.data,
        schema: RefinementResponseSchema,
      });
      const nextRound = state.round + 1;
      setState((current) => ({
        ...current,
        stage: "results",
        filters: refinement.filters,
        rubric: refinement.rubric,
        ranking: refinement.ranking,
        ratings: {},
        feedback: "",
        round: nextRound,
        history: [
          ...current.history,
          {
            round: nextRound,
            feedback: payload.data.feedback,
            ratings: payload.data.ratings,
            recruiterIntent: refinement.recruiterIntent,
            changes: refinement.changes,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    } catch (caught) {
      setError(asDisplayError(caught));
    } finally {
      setPending(null);
    }
  }

  function retryLastAction() {
    if (!lastAction || pending) return;
    if (lastAction === "criteria") void generateCriteria();
    if (lastAction === "rank") void runRanking();
    if (lastAction === "refine") void refine();
  }

  function setRating(profileId: string, rating: number) {
    setState((current) => {
      const ratings = { ...current.ratings };
      if (ratings[profileId] === rating) delete ratings[profileId];
      else ratings[profileId] = rating;
      return { ...current, ratings };
    });
  }

  function freezeSearch() {
    if (!state.ranking || state.ranking.results.length === 0) return;
    setError(null);
    setState((current) => ({
      ...current,
      stage: "frozen",
      ratings: {},
      feedback: "",
      frozenAt: new Date().toISOString(),
    }));
  }

  function resetSearch(force = false) {
    if (
      !force &&
      state.stage !== "search" &&
      !window.confirm("Start a new search? The current session will be cleared.")
    ) {
      return;
    }
    window.sessionStorage.removeItem(STORAGE_KEY);
    setState(createInitialState());
    setPending(null);
    setError(null);
    setLastAction(null);
  }

  const latestHistory = state.history.at(-1);
  const canRefine =
    ratedCount > 0 || state.feedback.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#f4f7f4] text-[#17231d]">
      <header className="sticky top-0 z-30 border-b border-[#dce3de]/90 bg-[#f8faf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <AppMark />
            <div>
              <p className="text-sm font-bold tracking-[-0.01em] text-[#15231b]">
                Sourcing Studio
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#77847c]">
                Explainable recruiter loop
              </p>
            </div>
          </div>
          <ProgressSteps stage={state.stage} />
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-[#d7dfd9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#66736b] sm:inline-flex">
              Session-only state
            </span>
            {state.stage !== "search" && (
              <button
                type="button"
                onClick={() => resetSearch()}
                className="rounded-lg px-3 py-2 text-xs font-bold text-[#6e786f] transition hover:bg-white hover:text-[#2f503d]"
              >
                Start over
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {pending && <PendingBanner action={pending} />}
        {error && (
          <ErrorBanner
            error={error}
            onDismiss={() => setError(null)}
            onRetry={error.retryable ? retryLastAction : undefined}
          />
        )}

        {state.stage === "search" && (
          <SearchLanding
            requirement={state.requirement}
            busy={pending === "criteria"}
            onRequirementChange={(requirement) =>
              setState((current) => ({ ...current, requirement }))
            }
            onSubmit={() => void generateCriteria()}
          />
        )}

        {state.stage === "criteria" && state.filters && (
          <div className="mx-auto max-w-6xl py-5">
            <div className="mb-6 rounded-2xl border border-[#d9e2dc] bg-[#17231d] p-5 text-white shadow-[0_18px_45px_rgba(20,42,29,0.12)] sm:p-6">
              <div className="grid gap-4 md:grid-cols-[170px_1fr] md:items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9cc8ad]">
                    Gemini interpretation
                  </p>
                  <p className="mt-2 text-sm text-[#c9d5cd]">
                    Read this before approving the search logic.
                  </p>
                </div>
                <p className="text-base leading-7 text-[#f1f6f2]">
                  {state.interpretation}
                </p>
              </div>
            </div>
            <CriteriaEditor
              filters={state.filters}
              rubric={state.rubric}
              busy={pending === "rank"}
              onFiltersChange={updateFilters}
              onRubricChange={updateRubric}
              onRun={() => void runRanking()}
              onBack={() =>
                setState((current) => ({ ...current, stage: "search" }))
              }
            />
          </div>
        )}

        {state.stage === "results" && state.filters && state.ranking && (
          <div className="grid gap-7 py-3 lg:grid-cols-[350px_minmax(0,1fr)] lg:items-start">
            <aside className="grid gap-4 lg:sticky lg:top-24">
              <CriteriaSnapshot
                filters={state.filters}
                rubric={state.rubric}
                onEdit={() =>
                  setState((current) => ({ ...current, stage: "criteria" }))
                }
              />

              <section className="rounded-2xl border border-[#d8e0da] bg-white p-5 shadow-[0_16px_40px_rgba(23,54,37,0.06)]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#d1683f]">
                  Teach the search
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[#17231d]">
                  What should change?
                </h2>
                <p className="mt-2 text-xs leading-5 text-[#6f7b73]">
                  Rate candidates, explain the trade-off, or do both. Preferences adjust the rubric unless you clearly state a hard constraint.
                </p>

                {state.history.length > 0 && (
                  <div className="mt-4 max-h-44 space-y-2 overflow-y-auto rounded-xl bg-[#f5f8f6] p-3">
                    {state.history.slice(-3).map((entry) => (
                      <div key={entry.round} className="text-[11px] leading-4">
                        <p className="font-bold text-[#42604d]">Round {entry.round}</p>
                        <p className="mt-0.5 text-[#718078]">
                          {entry.feedback || `${entry.ratings.length} candidate rating(s)`}
                        </p>
                        <p className="mt-1 font-medium text-[#31533f]">
                          ↳ {entry.recruiterIntent}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <label className="mt-4 grid gap-2" htmlFor="refinement-feedback">
                  <span className="flex items-center justify-between text-xs font-bold text-[#4d5d53]">
                    Refinement message
                    <span className="font-medium text-[#929c95]">
                      {state.feedback.length}/1500
                    </span>
                  </span>
                  <textarea
                    id="refinement-feedback"
                    value={state.feedback}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        feedback: event.target.value,
                      }))
                    }
                    disabled={pending === "refine"}
                    maxLength={1500}
                    rows={5}
                    placeholder="Example: Product backend experience matters more than pure database reliability. Scale-up exposure is a plus, not a hard filter."
                    className="resize-y rounded-xl border border-[#d8dfda] bg-[#fbfcfb] p-3 text-sm leading-5 text-[#26342c] outline-none placeholder:text-[#9aa39d] focus:border-[#2d8b5d] focus:ring-4 focus:ring-[#2d8b5d]/10 disabled:opacity-60"
                  />
                </label>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-[#758078]">
                    {ratedCount} of {state.ranking.results.length} rated
                  </span>
                  {state.round > 0 && (
                    <span className="font-bold text-[#4b765c]">
                      Round {state.round + 1}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!canRefine || pending !== null || state.ranking.results.length === 0}
                  onClick={() => void refine()}
                  className="mt-4 h-11 w-full rounded-xl bg-[#1e7149] px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgba(30,113,73,0.2)] transition hover:bg-[#175c3b] disabled:cursor-not-allowed disabled:bg-[#a7b7ac] disabled:shadow-none"
                >
                  {pending === "refine" ? "Refining…" : "Refine & rerank"}
                </button>
                <button
                  type="button"
                  disabled={pending !== null || state.ranking.results.length === 0}
                  onClick={freezeSearch}
                  className="mt-2 h-11 w-full rounded-xl border border-[#b8c8bd] bg-white px-4 text-sm font-bold text-[#315840] transition hover:border-[#6f9f80] hover:bg-[#f1f8f4] disabled:opacity-45"
                >
                  Freeze shortlist
                </button>
              </section>
            </aside>

            <section className="min-w-0">
              {latestHistory && (
                <div className="mb-5 rounded-2xl border border-[#d3e5da] bg-[#edf8f1] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#3f7c58]">
                        Refinement {latestHistory.round} applied
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#254a34]">
                        {latestHistory.recruiterIntent}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#4a775c] shadow-sm">
                      Search rerun complete
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {latestHistory.changes.map((change, index) => (
                      <div
                        key={`${change.area}-${index}`}
                        className="rounded-xl bg-white/80 p-3 text-xs leading-5"
                      >
                        <span className="font-bold capitalize text-[#326148]">
                          {change.area}: {change.change}
                        </span>
                        <p className="mt-0.5 text-[#6b7b70]">{change.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2d8b5d]">
                    Ranked shortlist
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#132019] sm:text-3xl">
                    {state.ranking.results.length > 0
                      ? `Top ${state.ranking.results.length} candidates`
                      : "No profiles passed every filter"}
                  </h1>
                </div>
                <p className="text-sm text-[#758078]">
                  {state.ranking.matchedCount} matched · {state.ranking.totalCount} evaluated locally
                </p>
              </div>

              {state.ranking.results.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#c9d3cc] bg-white p-10 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eef3ef] text-xl">
                    0
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-[#233128]">
                    The hard filters are too narrow
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6d7971]">
                    No LLM ranking call was made. Relax an objective constraint, then run the complete local dataset again.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setState((current) => ({ ...current, stage: "criteria" }))
                    }
                    className="mt-5 rounded-xl bg-[#1e7149] px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Edit filters
                  </button>
                </div>
              ) : (
                <div className="grid gap-5">
                  {state.ranking.results.map((candidate, index) => (
                    <CandidateCard
                      key={candidate.profile.id}
                      candidate={candidate}
                      rubric={state.rubric}
                      rank={index + 1}
                      rating={state.ratings[candidate.profile.id]}
                      onRate={(rating) => setRating(candidate.profile.id, rating)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {state.stage === "frozen" && state.filters && state.ranking && (
          <div className="py-4">
            <section className="mb-7 overflow-hidden rounded-2xl bg-[#17231d] p-6 text-white shadow-[0_24px_70px_rgba(20,42,29,0.16)] sm:p-8">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-[#b9ddc5]">
                    <span className="h-2 w-2 rounded-full bg-[#65c287]" />
                    Search frozen
                  </div>
                  <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                    Final shortlist, with the reasoning intact.
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c5d1c9]">
                    {state.requirement}
                  </p>
                </div>
                <div className="shrink-0 text-sm text-[#b8c7bd] md:text-right">
                  <p className="font-bold text-white">
                    {state.ranking.results.length} shortlisted from {state.ranking.totalCount}
                  </p>
                  <p className="mt-1 text-xs">
                    {state.round} refinement {state.round === 1 ? "round" : "rounds"}
                  </p>
                  {state.frozenAt && (
                    <time className="mt-1 block text-[11px]" dateTime={state.frozenAt}>
                      Frozen {new Date(state.frozenAt).toLocaleString()}
                    </time>
                  )}
                </div>
              </div>
            </section>

            <div className="grid gap-7 lg:grid-cols-[350px_minmax(0,1fr)] lg:items-start">
              <aside className="grid gap-4 lg:sticky lg:top-24">
                <CriteriaSnapshot
                  filters={state.filters}
                  rubric={state.rubric}
                  frozen
                />
                {state.history.length > 0 && (
                  <section className="rounded-2xl border border-[#d8e0da] bg-white p-5 shadow-[0_16px_40px_rgba(23,54,37,0.06)]">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#d1683f]">
                      Refinement trail
                    </p>
                    <div className="mt-4 grid gap-4">
                      {state.history.map((entry) => (
                        <div key={entry.round} className="border-l-2 border-[#b9d8c4] pl-3">
                          <p className="text-xs font-bold text-[#365d46]">
                            Round {entry.round}
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-[#758078]">
                            {entry.feedback || `${entry.ratings.length} candidate rating(s)`}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[#42564a]">
                            {entry.recruiterIntent}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <button
                  type="button"
                  onClick={() => resetSearch(true)}
                  className="h-11 rounded-xl border border-[#cdd7d0] bg-white text-sm font-bold text-[#365b44] transition hover:border-[#73a788] hover:bg-[#f1f8f4]"
                >
                  Start a new search
                </button>
              </aside>

              <section>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2d8b5d]">
                      Final ranking
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#132019]">
                      Ranked candidates
                    </h2>
                  </div>
                  <p className="text-sm text-[#758078]">
                    {state.ranking.matchedCount} passed hard filters
                  </p>
                </div>
                <div className="grid gap-5">
                  {state.ranking.results.map((candidate, index) => (
                    <CandidateCard
                      key={candidate.profile.id}
                      candidate={candidate}
                      rubric={state.rubric}
                      rank={index + 1}
                      readOnly
                    />
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
