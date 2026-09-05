"use client";

import { normalizeRubric } from "@/lib/ranking";
import type {
  CompanyType,
  ObjectiveFilters,
  RubricCriterion,
} from "@/lib/schemas";

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: "startup", label: "Startup" },
  { value: "scaleup", label: "Scale-up" },
  { value: "enterprise", label: "Enterprise" },
  { value: "agency", label: "Agency" },
];

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function CommaListInput({
  id,
  label,
  hint,
  values,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  return (
    <label className="grid gap-2" htmlFor={id}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-[#17231d]">{label}</span>
        <span className="text-xs text-[#6b776f]">{hint}</span>
      </span>
      <input
        key={values.join("|")}
        id={id}
        defaultValue={values.join(", ")}
        onBlur={(event) => onChange(parseList(event.currentTarget.value))}
        placeholder={placeholder}
        className="h-11 rounded-xl border border-[#d8dfda] bg-white px-3.5 text-sm text-[#17231d] outline-none transition placeholder:text-[#9aa39d] focus:border-[#2d8b5d] focus:ring-4 focus:ring-[#2d8b5d]/10"
      />
    </label>
  );
}

function CompanyTypePicker({
  title,
  hint,
  values,
  onChange,
}: {
  title: string;
  hint: string;
  values: CompanyType[];
  onChange: (values: CompanyType[]) => void;
}) {
  function toggle(value: CompanyType) {
    onChange(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold text-[#17231d]">{title}</legend>
      <p className="text-xs text-[#6b776f]">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {COMPANY_TYPES.map((option) => {
          const selected = values.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(option.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                selected
                  ? "border-[#235f43] bg-[#e1f4e9] text-[#18462f]"
                  : "border-[#d8dfda] bg-white text-[#66736b] hover:border-[#9fb4a7]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function CriteriaEditor({
  filters,
  rubric,
  busy,
  onFiltersChange,
  onRubricChange,
  onRun,
  onBack,
}: {
  filters: ObjectiveFilters;
  rubric: RubricCriterion[];
  busy: boolean;
  onFiltersChange: (filters: ObjectiveFilters) => void;
  onRubricChange: (rubric: RubricCriterion[]) => void;
  onRun: () => void;
  onBack: () => void;
}) {
  const totalWeight = rubric.reduce(
    (total, criterion) => total + criterion.weight,
    0,
  );

  function updateFilter<K extends keyof ObjectiveFilters>(
    key: K,
    value: ObjectiveFilters[K],
  ) {
    onFiltersChange({ ...filters, [key]: value });
  }

  function updateCriterion(
    id: string,
    patch: Partial<RubricCriterion>,
  ) {
    onRubricChange(
      rubric.map((criterion) =>
        criterion.id === id ? { ...criterion, ...patch } : criterion,
      ),
    );
  }

  function addCriterion() {
    if (rubric.length >= 6) return;
    let suffix = rubric.length + 1;
    while (rubric.some((criterion) => criterion.id === `criterion-${suffix}`)) {
      suffix += 1;
    }
    onRubricChange([
      ...rubric,
      {
        id: `criterion-${suffix}`,
        label: "New criterion",
        description: "Describe the preference this criterion should measure.",
        weight: 10,
      },
    ]);
  }

  function removeCriterion(id: string) {
    if (rubric.length <= 2) return;
    onRubricChange(rubric.filter((criterion) => criterion.id !== id));
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-[#dbe2dd] bg-white p-5 shadow-[0_18px_45px_rgba(24,55,38,0.06)] sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2d8b5d]">
              Objective filters
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#132019]">
              Who must make the cut?
            </h2>
          </div>
          <span className="rounded-full bg-[#f2f6f3] px-3 py-1 text-xs font-medium text-[#607067]">
            Applied locally
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <CommaListInput
            id="locations"
            label="Locations"
            hint="any match"
            values={filters.locations}
            placeholder="Bangalore, Remote - India"
            onChange={(values) => updateFilter("locations", values)}
          />
          <CommaListInput
            id="title-keywords"
            label="Title keywords"
            hint="any current or past title"
            values={filters.titleKeywords}
            placeholder="Backend, Database Reliability"
            onChange={(values) => updateFilter("titleKeywords", values)}
          />
          <div className="grid gap-2">
            <span className="text-sm font-semibold text-[#17231d]">
              Experience range
            </span>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                aria-label="Minimum years of experience"
                type="number"
                min={0}
                max={50}
                value={filters.minYearsExperience ?? ""}
                onChange={(event) =>
                  updateFilter(
                    "minYearsExperience",
                    event.target.value === "" ? null : Number(event.target.value),
                  )
                }
                placeholder="Min"
                className="h-11 rounded-xl border border-[#d8dfda] px-3 text-sm outline-none focus:border-[#2d8b5d] focus:ring-4 focus:ring-[#2d8b5d]/10"
              />
              <span className="text-sm text-[#88928c]">to</span>
              <input
                aria-label="Maximum years of experience"
                type="number"
                min={0}
                max={50}
                value={filters.maxYearsExperience ?? ""}
                onChange={(event) =>
                  updateFilter(
                    "maxYearsExperience",
                    event.target.value === "" ? null : Number(event.target.value),
                  )
                }
                placeholder="Max"
                className="h-11 rounded-xl border border-[#d8dfda] px-3 text-sm outline-none focus:border-[#2d8b5d] focus:ring-4 focus:ring-[#2d8b5d]/10"
              />
            </div>
          </div>
          <CommaListInput
            id="required-skills"
            label="Required skills"
            hint="all must match"
            values={filters.requiredSkills}
            placeholder="PostgreSQL, AWS RDS"
            onChange={(values) => updateFilter("requiredSkills", values)}
          />
          <CommaListInput
            id="any-skills"
            label="Alternative skills"
            hint="at least one"
            values={filters.anySkills}
            placeholder="Go, Python"
            onChange={(values) => updateFilter("anySkills", values)}
          />
          <CommaListInput
            id="company-keywords"
            label="Company names"
            hint="any current or past"
            values={filters.companyKeywords}
            placeholder="Freshworks, Razorpay"
            onChange={(values) => updateFilter("companyKeywords", values)}
          />
          <CommaListInput
            id="education-keywords"
            label="Education keywords"
            hint="all must match"
            values={filters.educationKeywords}
            placeholder="M.Tech, IISc"
            onChange={(values) => updateFilter("educationKeywords", values)}
          />
          <CompanyTypePicker
            title="Current company type"
            hint="Leave empty unless the current stage is a hard requirement."
            values={filters.currentCompanyTypes}
            onChange={(values) => updateFilter("currentCompanyTypes", values)}
          />
          <CompanyTypePicker
            title="Company background"
            hint="Matches current or past company history."
            values={filters.companyBackgroundTypes}
            onChange={(values) => updateFilter("companyBackgroundTypes", values)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#dbe2dd] bg-white p-5 shadow-[0_18px_45px_rgba(24,55,38,0.06)] sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d1683f]">
              Subjective rubric
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#132019]">
              How should the survivors rank?
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                totalWeight === 100
                  ? "bg-[#e1f4e9] text-[#1c6542]"
                  : "bg-[#fff0e9] text-[#a74724]"
              }`}
            >
              {totalWeight}% total
            </span>
            {totalWeight !== 100 && (
              <button
                type="button"
                onClick={() => onRubricChange(normalizeRubric(rubric))}
                className="text-xs font-semibold text-[#236b49] underline decoration-[#9fc6ad] underline-offset-4"
              >
                Balance to 100
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3">
          {rubric.map((criterion, index) => (
            <div
              key={criterion.id}
              className="grid gap-3 rounded-xl border border-[#e1e6e2] bg-[#fbfcfb] p-4 lg:grid-cols-[40px_1fr_2fr_90px_36px] lg:items-center"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#17231d] text-xs font-bold text-white">
                {index + 1}
              </span>
              <label className="grid gap-1 text-xs font-semibold text-[#6b776f]">
                Name
                <input
                  value={criterion.label}
                  maxLength={80}
                  onChange={(event) =>
                    updateCriterion(criterion.id, { label: event.target.value })
                  }
                  className="h-10 rounded-lg border border-[#d8dfda] bg-white px-3 text-sm font-medium text-[#17231d] outline-none focus:border-[#2d8b5d]"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-[#6b776f]">
                What it measures
                <input
                  value={criterion.description}
                  maxLength={280}
                  onChange={(event) =>
                    updateCriterion(criterion.id, {
                      description: event.target.value,
                    })
                  }
                  className="h-10 rounded-lg border border-[#d8dfda] bg-white px-3 text-sm font-normal text-[#17231d] outline-none focus:border-[#2d8b5d]"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-[#6b776f]">
                Weight
                <div className="relative">
                  <input
                    aria-label={`${criterion.label} weight`}
                    type="number"
                    min={1}
                    max={100}
                    value={criterion.weight}
                    onChange={(event) =>
                      updateCriterion(criterion.id, {
                        weight: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[#d8dfda] bg-white px-3 pr-7 text-sm text-[#17231d] outline-none focus:border-[#2d8b5d]"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-2.5 text-xs text-[#849087]">
                    %
                  </span>
                </div>
              </label>
              <button
                type="button"
                disabled={rubric.length <= 2}
                onClick={() => removeCriterion(criterion.id)}
                aria-label={`Remove ${criterion.label}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-[#9a6250] transition hover:bg-[#fff0e9] disabled:cursor-not-allowed disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={rubric.length >= 6}
            onClick={addCriterion}
            className="rounded-lg border border-dashed border-[#aab8af] px-3 py-2 text-sm font-semibold text-[#536158] transition hover:border-[#2d8b5d] hover:text-[#236b49] disabled:opacity-40"
          >
            + Add criterion
          </button>
          <p className="text-xs text-[#78847c]">
            Scores are 1–5; the server computes the weighted total.
          </p>
        </div>
      </section>

      <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="h-11 rounded-xl border border-[#d2dad4] bg-white px-5 text-sm font-semibold text-[#4a584f] transition hover:bg-[#f6f8f6] disabled:opacity-50"
        >
          Back to brief
        </button>
        <button
          type="button"
          onClick={onRun}
          disabled={busy || totalWeight !== 100}
          className="h-12 rounded-xl bg-[#1e7149] px-7 text-sm font-bold text-white shadow-[0_12px_30px_rgba(30,113,73,0.22)] transition hover:bg-[#175c3b] disabled:cursor-not-allowed disabled:bg-[#a5b6ab] disabled:shadow-none"
        >
          {busy ? "Ranking profiles…" : "Run search"}
        </button>
      </div>
    </div>
  );
}
