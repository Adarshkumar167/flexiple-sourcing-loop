import type { CriteriaDiff, RubricDiff } from "@/lib/schemas";

const FILTER_LABELS: Record<CriteriaDiff["filters"][number]["field"], string> = {
  locations: "Locations",
  minYearsExperience: "Minimum experience",
  maxYearsExperience: "Maximum experience",
  requiredSkills: "Required skills",
  anySkills: "Alternative skills",
  titleKeywords: "Title keywords",
  currentCompanyTypes: "Current company types",
  companyBackgroundTypes: "Company background",
  companyKeywords: "Company keywords",
  educationKeywords: "Education keywords",
};

function formatValue(value: string[] | number | null): string {
  if (value === null) return "Not set";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "None";
  return String(value);
}

function rubricChangeSummary(change: RubricDiff): string[] {
  if (!change.before || !change.after) return [];
  const details: string[] = [];
  if (change.before.label !== change.after.label) {
    details.push(`Name: ${change.before.label} → ${change.after.label}`);
  }
  if (change.before.weight !== change.after.weight) {
    const delta = change.after.weight - change.before.weight;
    details.push(
      `Weight: ${change.before.weight}% → ${change.after.weight}% (${delta > 0 ? "+" : ""}${delta}%)`,
    );
  }
  if (change.before.description !== change.after.description) {
    details.push("Scoring guidance changed");
  }
  if (change.beforeIndex !== change.afterIndex) {
    details.push(
      `Priority: #${(change.beforeIndex ?? 0) + 1} → #${(change.afterIndex ?? 0) + 1}`,
    );
  }
  return details;
}

export default function CriteriaDiffView({
  diff,
  compact = false,
}: {
  diff: CriteriaDiff;
  compact?: boolean;
}) {
  const totalChanges = diff.filters.length + diff.rubric.length;

  if (totalChanges === 0) {
    return (
      <div className="rounded-xl border border-[#d7e1da] bg-white/80 px-3 py-2.5 text-xs leading-5 text-[#637169]">
        No structural criteria changed; the search was rerun against the existing logic.
      </div>
    );
  }

  if (compact) {
    return (
      <p className="mt-1 text-[11px] font-semibold text-[#49705a]">
        {diff.filters.length} filter · {diff.rubric.length} rubric change
        {diff.rubric.length === 1 ? "" : "s"}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {diff.filters.length > 0 && (
        <section>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#65766b]">
            Objective filters
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {diff.filters.map((change) => (
              <div
                key={change.field}
                className="rounded-xl border border-[#dce4de] bg-white p-3"
              >
                <p className="text-xs font-bold text-[#294b37]">
                  {FILTER_LABELS[change.field]}
                </p>
                <div className="mt-2 grid gap-1.5 text-[11px] leading-4">
                  <p className="rounded-md bg-[#fff1ec] px-2 py-1.5 text-[#8c4c36] line-through decoration-[#cf8c75]">
                    − {formatValue(change.before)}
                  </p>
                  <p className="rounded-md bg-[#eaf7ef] px-2 py-1.5 font-semibold text-[#286044]">
                    + {formatValue(change.after)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {diff.rubric.length > 0 && (
        <section>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#65766b]">
            Weighted rubric
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {diff.rubric.map((change) => {
              const label = change.after?.label ?? change.before?.label ?? change.criterionId;
              const details = rubricChangeSummary(change);
              const tone =
                change.changeType === "added"
                  ? "border-[#cce5d5] bg-[#edf8f1] text-[#286044]"
                  : change.changeType === "removed"
                    ? "border-[#efd4ca] bg-[#fff4ef] text-[#8c4c36]"
                    : "border-[#d7dfda] bg-white text-[#365b44]";
              return (
                <div
                  key={`${change.changeType}-${change.criterionId}`}
                  className={`rounded-xl border p-3 ${tone}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-bold">{label}</p>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em]">
                      {change.changeType}
                    </span>
                  </div>
                  {change.changeType === "added" && change.after && (
                    <p className="mt-2 text-[11px] leading-4">
                      Added at {change.after.weight}% — {change.after.description}
                    </p>
                  )}
                  {change.changeType === "removed" && change.before && (
                    <p className="mt-2 text-[11px] leading-4">
                      Removed from {change.before.weight}% — {change.before.description}
                    </p>
                  )}
                  {details.length > 0 && (
                    <ul className="mt-2 grid gap-1 text-[11px] leading-4">
                      {details.map((detail) => (
                        <li key={detail}>• {detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
