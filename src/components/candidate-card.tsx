import type {
  RankedCandidate,
  RubricCriterion,
} from "@/lib/schemas";

const SCORE_STYLES: Record<number, string> = {
  1: "bg-[#f9e5df] text-[#983b25]",
  2: "bg-[#fff0df] text-[#9a5a19]",
  3: "bg-[#f4efcf] text-[#766615]",
  4: "bg-[#e4f2e8] text-[#286443]",
  5: "bg-[#cfeada] text-[#174d31]",
};

const RATING_LABELS = ["Poor fit", "Weak fit", "Possible", "Strong", "Excellent"];

function fieldLabel(field: string): string {
  return field.replaceAll("_", " ");
}

export default function CandidateCard({
  candidate,
  rubric,
  rank,
  rating,
  onRate,
  readOnly = false,
}: {
  candidate: RankedCandidate;
  rubric: RubricCriterion[];
  rank: number;
  rating?: number;
  onRate?: (rating: number) => void;
  readOnly?: boolean;
}) {
  const { profile } = candidate;
  const rubricById = new Map(rubric.map((criterion) => [criterion.id, criterion]));

  return (
    <article className="overflow-hidden rounded-2xl border border-[#dce3de] bg-white shadow-[0_18px_50px_rgba(24,55,38,0.07)]">
      <div className="border-b border-[#e8ece9] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#17231d] text-sm font-bold text-white shadow-sm">
              #{rank}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xl font-semibold tracking-[-0.02em] text-[#142019]">
                {profile.name}
              </h3>
              <p className="mt-0.5 text-sm font-medium text-[#4e5c53]">
                {profile.current_title} · {profile.current_company}
              </p>
              <p className="mt-1 text-xs text-[#7b867f]">
                {profile.location} · {profile.years_experience} years · {profile.current_company_type}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-end gap-1 sm:flex-col">
            <span className="text-3xl font-bold tracking-[-0.05em] text-[#1c6844]">
              {candidate.weightedScore.toFixed(1)}
            </span>
            <span className="pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#849087]">
              weighted fit
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {profile.skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-[#dde5df] bg-[#f7faf8] px-2.5 py-1 text-[11px] font-semibold text-[#506057]"
            >
              {skill}
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-[#526057]">
          {candidate.overallRationale}
        </p>

        {candidate.objectiveEvidence.length > 0 && (
          <div className="mt-4 rounded-xl border border-[#d9eadf] bg-[#f2f9f4] p-3.5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#397653]">
              Passed objective filters
            </p>
            <div className="flex flex-wrap gap-1.5">
              {candidate.objectiveEvidence.map((evidence) => (
                <span
                  key={evidence}
                  className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-[#355342] shadow-sm"
                >
                  {evidence}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#718078]">
          Rubric evidence
        </p>
        {candidate.criterionScores.map((criterionScore) => {
          const criterion = rubricById.get(criterionScore.criterionId);
          return (
            <details
              key={criterionScore.criterionId}
              className="group rounded-xl border border-[#e1e6e2] bg-[#fbfcfb] open:bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#26342c]">
                    {criterion?.label ?? criterionScore.criterionId}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-[#758078]">
                    {criterionScore.rationale}
                  </p>
                </div>
                <span
                  className={`flex h-8 min-w-10 items-center justify-center rounded-lg px-2 text-xs font-bold ${SCORE_STYLES[criterionScore.score]}`}
                >
                  {criterionScore.score}/5
                </span>
              </summary>
              <div className="grid gap-2 border-t border-[#e8ece9] px-4 py-3.5">
                <p className="text-xs leading-5 text-[#59675e]">
                  {criterionScore.rationale}
                </p>
                {criterionScore.evidence.map((evidence, index) => (
                  <div
                    key={`${evidence.field}-${evidence.value}-${index}`}
                    className="rounded-lg bg-[#f3f6f4] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[#e4ebe6] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#617168]">
                        {fieldLabel(evidence.field)}
                      </span>
                      <span className="text-xs font-semibold text-[#26342c]">
                        {evidence.value}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-[#6c786f]">
                      {evidence.reason}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <details className="border-t border-[#e8ece9] bg-[#fafbfa] px-5 py-3 sm:px-6">
        <summary className="cursor-pointer text-xs font-semibold text-[#5f6e65]">
          Full profile details
        </summary>
        <div className="grid gap-3 pb-2 pt-4 text-xs text-[#58665e] sm:grid-cols-2">
          <div>
            <p className="font-bold text-[#2d3932]">Education</p>
            <p className="mt-1 leading-5">{profile.education}</p>
          </div>
          <div>
            <p className="font-bold text-[#2d3932]">Past companies</p>
            <ul className="mt-1 grid gap-1 leading-5">
              {profile.past_companies.length > 0 ? (
                profile.past_companies.map((company) => (
                  <li key={`${company.company}-${company.title}`}>
                    {company.title} at {company.company} · {company.years}y · {company.company_type}
                  </li>
                ))
              ) : (
                <li>No past companies listed</li>
              )}
            </ul>
          </div>
          <p className="leading-5 sm:col-span-2">{profile.summary}</p>
        </div>
      </details>

      {!readOnly && onRate && (
        <div className="border-t border-[#e4e9e5] bg-[#f8faf8] px-5 py-4 sm:px-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold text-[#344139]">Your fit rating</p>
              <p className="mt-0.5 text-[11px] text-[#77837b]">
                This rating teaches the next refinement round.
              </p>
            </div>
            <div className="flex gap-1.5" role="group" aria-label={`Rate ${profile.name}`}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${RATING_LABELS[value - 1]} (${value} of 5)`}
                  aria-pressed={rating === value}
                  title={RATING_LABELS[value - 1]}
                  onClick={() => onRate(value)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-bold transition ${
                    rating === value
                      ? "border-[#1e7149] bg-[#1e7149] text-white shadow-sm"
                      : "border-[#d5ddd7] bg-white text-[#657169] hover:border-[#73a788] hover:text-[#1e7149]"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
