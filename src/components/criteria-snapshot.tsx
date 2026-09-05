import type {
  ObjectiveFilters,
  RubricCriterion,
} from "@/lib/schemas";

function filterChips(filters: ObjectiveFilters): string[] {
  const chips: string[] = [];
  if (filters.locations.length) chips.push(`Location: ${filters.locations.join(" or ")}`);
  if (
    filters.minYearsExperience !== null ||
    filters.maxYearsExperience !== null
  ) {
    chips.push(
      `Experience: ${filters.minYearsExperience ?? "0"}–${
        filters.maxYearsExperience ?? "any"
      } years`,
    );
  }
  if (filters.requiredSkills.length) {
    chips.push(`All skills: ${filters.requiredSkills.join(" + ")}`);
  }
  if (filters.anySkills.length) {
    chips.push(`Any skill: ${filters.anySkills.join(" or ")}`);
  }
  if (filters.titleKeywords.length) {
    chips.push(`Titles: ${filters.titleKeywords.join(" or ")}`);
  }
  if (filters.currentCompanyTypes.length) {
    chips.push(`Current: ${filters.currentCompanyTypes.join(" or ")}`);
  }
  if (filters.companyBackgroundTypes.length) {
    chips.push(`Background: ${filters.companyBackgroundTypes.join(" or ")}`);
  }
  if (filters.companyKeywords.length) {
    chips.push(`Companies: ${filters.companyKeywords.join(" or ")}`);
  }
  if (filters.educationKeywords.length) {
    chips.push(`Education: ${filters.educationKeywords.join(" + ")}`);
  }
  return chips;
}

export default function CriteriaSnapshot({
  filters,
  rubric,
  onEdit,
  frozen = false,
}: {
  filters: ObjectiveFilters;
  rubric: RubricCriterion[];
  onEdit?: () => void;
  frozen?: boolean;
}) {
  const chips = filterChips(filters);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d8e0da] bg-white shadow-[0_16px_40px_rgba(23,54,37,0.06)]">
      <div className="flex items-center justify-between border-b border-[#e5eae6] px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2d8b5d]">
            {frozen ? "Final search logic" : "Current search logic"}
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-[#17231d]">
            Filters & rubric
          </h2>
        </div>
        {onEdit && !frozen && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-[#d7ded9] px-3 py-1.5 text-xs font-bold text-[#326247] transition hover:border-[#75a98b] hover:bg-[#f1f8f4]"
          >
            Edit
          </button>
        )}
      </div>

      <div className="grid gap-5 p-5">
        <div>
          <p className="mb-2 text-xs font-bold text-[#657169]">Hard filters</p>
          <div className="flex flex-wrap gap-1.5">
            {chips.length > 0 ? (
              chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-md bg-[#eef5f0] px-2.5 py-1.5 text-[11px] font-medium leading-4 text-[#315b42]"
                >
                  {chip}
                </span>
              ))
            ) : (
              <span className="rounded-md bg-[#f4f5f4] px-2.5 py-1.5 text-xs text-[#78827b]">
                No hard filters — rank the full pool
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold text-[#657169]">Weighted rubric</p>
          <div className="grid gap-3">
            {rubric.map((criterion) => (
              <div key={criterion.id} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-[#28362e]">
                    {criterion.label}
                  </span>
                  <span className="font-bold text-[#1e7149]">
                    {criterion.weight}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#edf0ee]">
                  <div
                    className="h-full rounded-full bg-[#55a979]"
                    style={{ width: `${criterion.weight}%` }}
                  />
                </div>
                <p className="text-[11px] leading-4 text-[#758078]">
                  {criterion.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
