import type {
  CriteriaDiff,
  ObjectiveFilterField,
  ObjectiveFilters,
  RubricCriterion,
} from "@/lib/schemas";
import { CriteriaDiffSchema } from "@/lib/schemas";

const FILTER_FIELDS: readonly ObjectiveFilterField[] = [
  "locations",
  "minYearsExperience",
  "maxYearsExperience",
  "requiredSkills",
  "anySkills",
  "titleKeywords",
  "currentCompanyTypes",
  "companyBackgroundTypes",
  "companyKeywords",
  "educationKeywords",
];

function normalizedSet(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()))].sort();
}

function filterValuesEqual(
  before: ObjectiveFilters[ObjectiveFilterField],
  after: ObjectiveFilters[ObjectiveFilterField],
): boolean {
  if (Array.isArray(before) && Array.isArray(after)) {
    return JSON.stringify(normalizedSet(before)) === JSON.stringify(normalizedSet(after));
  }
  return before === after;
}

function rubricEqual(
  before: RubricCriterion,
  after: RubricCriterion,
  beforeIndex: number,
  afterIndex: number,
): boolean {
  return (
    before.label === after.label &&
    before.description === after.description &&
    before.weight === after.weight &&
    beforeIndex === afterIndex
  );
}

export function computeCriteriaDiff({
  beforeFilters,
  beforeRubric,
  afterFilters,
  afterRubric,
}: {
  beforeFilters: ObjectiveFilters;
  beforeRubric: readonly RubricCriterion[];
  afterFilters: ObjectiveFilters;
  afterRubric: readonly RubricCriterion[];
}): CriteriaDiff {
  const filterDiffs = FILTER_FIELDS.flatMap((field) => {
    const before = beforeFilters[field];
    const after = afterFilters[field];
    if (filterValuesEqual(before, after)) return [];
    return [{ field, before, after }];
  });

  const beforeById = new Map(
    beforeRubric.map((criterion, index) => [criterion.id, { criterion, index }]),
  );
  const afterById = new Map(
    afterRubric.map((criterion, index) => [criterion.id, { criterion, index }]),
  );
  const orderedIds = [
    ...beforeRubric.map((criterion) => criterion.id),
    ...afterRubric
      .map((criterion) => criterion.id)
      .filter((criterionId) => !beforeById.has(criterionId)),
  ];

  const rubricDiffs: CriteriaDiff["rubric"] = [];
  for (const criterionId of orderedIds) {
    const beforeEntry = beforeById.get(criterionId);
    const afterEntry = afterById.get(criterionId);

    if (!beforeEntry && afterEntry) {
      rubricDiffs.push({
        criterionId,
        changeType: "added",
        before: null,
        after: afterEntry.criterion,
        beforeIndex: null,
        afterIndex: afterEntry.index,
      });
      continue;
    }
    if (beforeEntry && !afterEntry) {
      rubricDiffs.push({
        criterionId,
        changeType: "removed",
        before: beforeEntry.criterion,
        after: null,
        beforeIndex: beforeEntry.index,
        afterIndex: null,
      });
      continue;
    }
    if (
      beforeEntry &&
      afterEntry &&
      !rubricEqual(
        beforeEntry.criterion,
        afterEntry.criterion,
        beforeEntry.index,
        afterEntry.index,
      )
    ) {
      rubricDiffs.push({
        criterionId,
        changeType: "updated",
        before: beforeEntry.criterion,
        after: afterEntry.criterion,
        beforeIndex: beforeEntry.index,
        afterIndex: afterEntry.index,
      });
    }
  }

  return CriteriaDiffSchema.parse({
    filters: filterDiffs,
    rubric: rubricDiffs,
  });
}
