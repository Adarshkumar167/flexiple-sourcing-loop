import { buildObjectiveEvidence } from "@/lib/filter-profiles";
import type {
  CandidateAssessment,
  CriterionScore,
  Evidence,
  EvidenceField,
  ObjectiveFilters,
  Profile,
  RankedCandidate,
  RubricCriterion,
} from "@/lib/schemas";

export class RankingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RankingValidationError";
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 34);
}

export function normalizeRubric(
  rubric: readonly RubricCriterion[],
): RubricCriterion[] {
  const usedIds = new Set<string>();
  const withStableIds = rubric.map((criterion, index) => {
    const baseId = slugify(criterion.id || criterion.label) || `criterion-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId.slice(0, 35)}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    return { ...criterion, id };
  });

  const totalWeight = withStableIds.reduce(
    (total, criterion) => total + criterion.weight,
    0,
  );
  if (totalWeight <= 0) {
    throw new RankingValidationError("Rubric weights must be positive.");
  }

  const exactWeights = withStableIds.map(
    (criterion) => (criterion.weight / totalWeight) * 100,
  );
  const normalizedWeights = exactWeights.map((weight) =>
    Math.max(1, Math.floor(weight)),
  );

  let difference = 100 - normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  const priority = exactWeights
    .map((weight, index) => ({ index, remainder: weight - Math.floor(weight) }))
    .sort((left, right) => right.remainder - left.remainder);

  while (difference > 0) {
    for (const item of priority) {
      if (difference === 0) break;
      normalizedWeights[item.index] += 1;
      difference -= 1;
    }
  }

  while (difference < 0) {
    const reducible = normalizedWeights
      .map((weight, index) => ({ index, weight }))
      .filter((item) => item.weight > 1)
      .sort((left, right) => right.weight - left.weight);
    if (reducible.length === 0) {
      throw new RankingValidationError("Unable to normalize rubric weights.");
    }
    for (const item of reducible) {
      if (difference === 0) break;
      if (normalizedWeights[item.index] > 1) {
        normalizedWeights[item.index] -= 1;
        difference += 1;
      }
    }
  }

  return withStableIds.map((criterion, index) => ({
    ...criterion,
    weight: normalizedWeights[index],
  }));
}

function normalizeEvidenceText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function evidenceValues(profile: Profile, field: EvidenceField): string[] {
  switch (field) {
    case "current_title":
      return [profile.current_title];
    case "years_experience":
      return [
        String(profile.years_experience),
        `${profile.years_experience} years`,
        `${profile.years_experience} years of experience`,
      ];
    case "location":
      return [profile.location];
    case "current_company":
      return [profile.current_company];
    case "current_company_type":
      return [profile.current_company_type];
    case "skills":
      return profile.skills;
    case "past_companies":
      return profile.past_companies.flatMap((company) => [
        company.company,
        company.company_type,
        company.title,
        `${company.title} at ${company.company}`,
        `${company.company} (${company.company_type})`,
        `${company.years} years at ${company.company}`,
      ]);
    case "education":
      return [profile.education];
    case "summary":
      return [profile.summary];
  }
}

export function isEvidenceGrounded(
  profile: Profile,
  evidence: Evidence,
): boolean {
  const claimedValue = normalizeEvidenceText(evidence.value);
  if (!claimedValue) return false;

  return evidenceValues(profile, evidence.field).some((actualValue) => {
    const normalizedActual = normalizeEvidenceText(actualValue);
    return (
      normalizedActual === claimedValue ||
      normalizedActual.includes(claimedValue) ||
      claimedValue.includes(normalizedActual)
    );
  });
}

function validateCriterionScores(
  profile: Profile,
  scores: readonly CriterionScore[],
  rubric: readonly RubricCriterion[],
): CriterionScore[] {
  const rubricIds = new Set(rubric.map((criterion) => criterion.id));
  const scoreIds = scores.map((score) => score.criterionId);

  if (new Set(scoreIds).size !== scoreIds.length) {
    throw new RankingValidationError(
      `The model returned duplicate criterion scores for ${profile.id}.`,
    );
  }

  if (
    scores.length !== rubric.length ||
    scoreIds.some((criterionId) => !rubricIds.has(criterionId)) ||
    rubric.some(
      (criterion) => !scoreIds.includes(criterion.id),
    )
  ) {
    throw new RankingValidationError(
      `The model did not score every rubric criterion for ${profile.id}.`,
    );
  }

  return scores.map((score) => {
    const groundedEvidence = score.evidence.filter((evidence) =>
      isEvidenceGrounded(profile, evidence),
    );
    if (groundedEvidence.length === 0) {
      throw new RankingValidationError(
        `The model returned unsupported evidence for ${profile.id}/${score.criterionId}.`,
      );
    }
    return { ...score, evidence: groundedEvidence };
  });
}

export function calculateWeightedScore(
  scores: readonly CriterionScore[],
  rubric: readonly RubricCriterion[],
): number {
  const scoreByCriterion = new Map(
    scores.map((criterionScore) => [
      criterionScore.criterionId,
      criterionScore.score,
    ]),
  );

  const weightedScore = rubric.reduce((total, criterion) => {
    const score = scoreByCriterion.get(criterion.id);
    if (score === undefined) {
      throw new RankingValidationError(
        `Missing score for rubric criterion ${criterion.id}.`,
      );
    }
    return total + (score / 5) * criterion.weight;
  }, 0);

  return Math.round(weightedScore * 10) / 10;
}

export function buildRankedCandidates(
  candidateProfiles: readonly Profile[],
  assessments: readonly CandidateAssessment[],
  rubric: readonly RubricCriterion[],
  filters: ObjectiveFilters,
  limit = 5,
): RankedCandidate[] {
  const profileById = new Map(
    candidateProfiles.map((profile) => [profile.id, profile]),
  );
  const assessmentIds = assessments.map((assessment) => assessment.profileId);

  if (new Set(assessmentIds).size !== assessmentIds.length) {
    throw new RankingValidationError("The model returned duplicate profile scores.");
  }

  if (
    assessments.length !== candidateProfiles.length ||
    candidateProfiles.some(
      (profile) => !assessmentIds.includes(profile.id),
    ) ||
    assessments.some(
      (assessment) => !profileById.has(assessment.profileId),
    )
  ) {
    throw new RankingValidationError(
      "The model must score every filtered profile exactly once.",
    );
  }

  return assessments
    .map((assessment) => {
      const profile = profileById.get(assessment.profileId);
      if (!profile) {
        throw new RankingValidationError(
          `Unknown profile ${assessment.profileId}.`,
        );
      }
      const criterionScores = validateCriterionScores(
        profile,
        assessment.criterionScores,
        rubric,
      );
      return {
        profile,
        criterionScores,
        weightedScore: calculateWeightedScore(criterionScores, rubric),
        overallRationale: assessment.overallRationale,
        objectiveEvidence: buildObjectiveEvidence(profile, filters),
      };
    })
    .sort(
      (left, right) =>
        right.weightedScore - left.weightedScore ||
        left.profile.name.localeCompare(right.profile.name),
    )
    .slice(0, limit);
}
