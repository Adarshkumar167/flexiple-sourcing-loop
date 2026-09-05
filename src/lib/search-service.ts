import "server-only";

import { computeCriteriaDiff } from "@/lib/criteria-diff";
import {
  beginExecution,
  beginStep,
  completeStep,
  finishExecution,
  skippedStep,
} from "@/lib/execution-trace";
import {
  filterProfiles,
  type FilterDecision,
} from "@/lib/filter-profiles";
import { generateStructured, LlmServiceError } from "@/lib/gemini";
import { profileCatalog, profiles, getProfilesByIds } from "@/lib/profiles";
import {
  buildCriteriaPrompt,
  buildRankingPrompt,
  buildRefinementPrompt,
} from "@/lib/prompts";
import {
  buildRankedCandidatesWithAudit,
  normalizeRubric,
  RankingValidationError,
} from "@/lib/ranking";
import {
  RankingModelOutputSchema,
  RefinementModelOutputSchema,
  SearchCriteriaSchema,
  type FailedFilterCountsSchema,
  type GenerateCriteriaResponse,
  type ObjectiveFilters,
  type ProfileFunnel,
  type RankingApiResponse,
  type RecruiterRating,
  type RefinementResponse,
  type RubricCriterion,
} from "@/lib/schemas";

function catalogForPrompt(): Record<string, readonly string[]> {
  return {
    locations: profileCatalog.locations,
    skills: profileCatalog.skills,
    titles: profileCatalog.titles,
    companies: profileCatalog.companies,
    education: profileCatalog.education,
    companyTypes: profileCatalog.companyTypes,
  };
}

type FailedFilterCounts = {
  [Key in keyof typeof FailedFilterCountsSchema.shape]: number;
};

const FAILED_FILTER_KEYS: Record<string, keyof FailedFilterCounts> = {
  location: "location",
  "minimum experience": "minimumExperience",
  "maximum experience": "maximumExperience",
  "required skills": "requiredSkills",
  "alternative skills": "alternativeSkills",
  title: "title",
  "current company type": "currentCompanyType",
  "company background": "companyBackground",
  company: "company",
  education: "education",
};

function summarizeFilterDecisions(
  decisions: readonly FilterDecision[],
  matchedCount: number,
): ProfileFunnel {
  const failedFilterCounts: FailedFilterCounts = {
    location: 0,
    minimumExperience: 0,
    maximumExperience: 0,
    requiredSkills: 0,
    alternativeSkills: 0,
    title: 0,
    currentCompanyType: 0,
    companyBackground: 0,
    company: 0,
    education: 0,
  };

  for (const decision of decisions) {
    for (const failedFilter of decision.failedFilters) {
      const key = FAILED_FILTER_KEYS[failedFilter];
      if (key) failedFilterCounts[key] += 1;
    }
  }

  return {
    totalProfiles: decisions.length,
    hardFilterMatched: matchedCount,
    hardFilterExcluded: decisions.length - matchedCount,
    sentToModel: 0,
    assessmentsReceived: 0,
    returnedResults: 0,
    failedFilterCounts,
  };
}

export async function generateSearchCriteria(
  requirement: string,
): Promise<GenerateCriteriaResponse> {
  const clock = beginExecution("criteria");
  const steps = [];

  let stepStarted = beginStep();
  const prompt = buildCriteriaPrompt(requirement, catalogForPrompt());
  steps.push(
    completeStep({
      name: "criteria.prompt",
      label: "Build criteria prompt",
      startedMs: stepStarted,
    }),
  );

  stepStarted = beginStep();
  const generated = await generateStructured({
    prompt,
    promptId: "criteria.v1",
    schema: SearchCriteriaSchema,
    schemaId: "search-criteria.v1",
    maxOutputTokens: 5_000,
  });
  steps.push(
    completeStep({
      name: "criteria.generate",
      label: "Generate and validate criteria",
      startedMs: stepStarted,
    }),
  );

  stepStarted = beginStep();
  const criteria = SearchCriteriaSchema.parse({
    ...generated.data,
    rubric: normalizeRubric(generated.data.rubric),
  });
  steps.push(
    completeStep({
      name: "rubric.normalize",
      label: "Normalize rubric weights",
      startedMs: stepStarted,
    }),
  );

  return {
    ...criteria,
    execution: finishExecution({
      clock,
      steps,
      generations: [generated.telemetry],
    }),
  };
}

export async function rankSearch({
  filters,
  rubric,
}: {
  filters: ObjectiveFilters;
  rubric: readonly RubricCriterion[];
}): Promise<RankingApiResponse> {
  const clock = beginExecution("rank");
  const steps = [];

  let stepStarted = beginStep();
  const normalizedRubric = normalizeRubric(rubric);
  steps.push(
    completeStep({
      name: "rubric.normalize",
      label: "Normalize rubric weights",
      startedMs: stepStarted,
    }),
  );

  stepStarted = beginStep();
  const { matches, decisions } = filterProfiles(profiles, filters);
  let funnel = summarizeFilterDecisions(decisions, matches.length);
  steps.push(
    completeStep({
      name: "profiles.filter",
      label: "Apply deterministic hard filters",
      startedMs: stepStarted,
    }),
  );

  if (matches.length === 0) {
    steps.push(skippedStep("ranking.generate", "Rank matched profiles"));
    steps.push(skippedStep("ranking.ground-score", "Ground evidence and score"));
    return {
      matchedCount: 0,
      totalCount: profiles.length,
      results: [],
      execution: finishExecution({ clock, steps, funnel }),
    };
  }

  try {
    stepStarted = beginStep();
    const prompt = buildRankingPrompt(matches, filters, normalizedRubric);
    steps.push(
      completeStep({
        name: "ranking.prompt",
        label: "Build bounded ranking prompt",
        startedMs: stepStarted,
      }),
    );

    stepStarted = beginStep();
    const modelOutput = await generateStructured({
      prompt,
      promptId: "ranking.v1",
      schema: RankingModelOutputSchema,
      schemaId: "ranking-model-output.v1",
      maxOutputTokens: 8_192,
    });
    steps.push(
      completeStep({
        name: "ranking.generate",
        label: "Score matched profiles",
        startedMs: stepStarted,
      }),
    );

    stepStarted = beginStep();
    const ranked = buildRankedCandidatesWithAudit(
      matches,
      modelOutput.data.assessments,
      normalizedRubric,
      filters,
    );
    steps.push(
      completeStep({
        name: "ranking.ground-score",
        label: "Ground evidence and compute totals",
        startedMs: stepStarted,
      }),
    );

    funnel = {
      ...funnel,
      sentToModel: matches.length,
      assessmentsReceived: modelOutput.data.assessments.length,
      returnedResults: ranked.results.length,
    };

    return {
      matchedCount: matches.length,
      totalCount: profiles.length,
      results: ranked.results,
      execution: finishExecution({
        clock,
        steps,
        generations: [modelOutput.telemetry],
        funnel,
        grounding: ranked.grounding,
      }),
    };
  } catch (error) {
    if (error instanceof RankingValidationError) {
      throw new LlmServiceError({
        code: "LLM_UNGROUNDED_OUTPUT",
        message:
          "The model returned incomplete or unsupported ranking evidence. Your previous search state is unchanged.",
        retryable: true,
        status: 502,
        details: [error.message],
      });
    }
    throw error;
  }
}

function validateRefinementContext({
  currentResultIds,
  ratings,
}: {
  currentResultIds: readonly string[];
  ratings: readonly RecruiterRating[];
}) {
  if (new Set(currentResultIds).size !== currentResultIds.length) {
    throw new LlmServiceError({
      code: "INVALID_REFINEMENT_CONTEXT",
      message: "The current result list contains duplicate profiles.",
      retryable: false,
      status: 400,
    });
  }
  if (new Set(ratings.map((rating) => rating.profileId)).size !== ratings.length) {
    throw new LlmServiceError({
      code: "INVALID_REFINEMENT_CONTEXT",
      message: "Submit at most one rating per profile.",
      retryable: false,
      status: 400,
    });
  }
  if (ratings.some((rating) => !currentResultIds.includes(rating.profileId))) {
    throw new LlmServiceError({
      code: "INVALID_REFINEMENT_CONTEXT",
      message: "Ratings must refer to a currently visible profile.",
      retryable: false,
      status: 400,
    });
  }
}

export async function refineSearch({
  requirement,
  filters,
  rubric,
  ratings,
  feedback,
  currentResultIds,
}: {
  requirement: string;
  filters: ObjectiveFilters;
  rubric: readonly RubricCriterion[];
  ratings: readonly RecruiterRating[];
  feedback: string;
  currentResultIds: readonly string[];
}): Promise<RefinementResponse> {
  const clock = beginExecution("refine");
  const steps = [];

  let stepStarted = beginStep();
  validateRefinementContext({ currentResultIds, ratings });
  const visibleProfiles = getProfilesByIds(currentResultIds);
  if (visibleProfiles.length !== currentResultIds.length) {
    throw new LlmServiceError({
      code: "INVALID_REFINEMENT_CONTEXT",
      message: "One or more current profiles do not exist in the local dataset.",
      retryable: false,
      status: 400,
    });
  }
  steps.push(
    completeStep({
      name: "refinement.validate",
      label: "Validate feedback context",
      startedMs: stepStarted,
    }),
  );

  const ratingByProfile = new Map(
    ratings.map((rating) => [rating.profileId, rating.rating]),
  );
  const ratedProfiles = visibleProfiles.map((profile) => ({
    profile,
    rating: ratingByProfile.get(profile.id) ?? null,
  }));

  stepStarted = beginStep();
  const prompt = buildRefinementPrompt({
    requirement,
    filters,
    rubric,
    ratedProfiles,
    ratings,
    feedback,
    catalog: catalogForPrompt(),
  });
  steps.push(
    completeStep({
      name: "refinement.prompt",
      label: "Build feedback prompt",
      startedMs: stepStarted,
    }),
  );

  stepStarted = beginStep();
  const refined = await generateStructured({
    prompt,
    promptId: "refinement.v1",
    schema: RefinementModelOutputSchema,
    schemaId: "refinement-model-output.v1",
    maxOutputTokens: 7_000,
  });
  steps.push(
    completeStep({
      name: "refinement.generate",
      label: "Generate next search logic",
      startedMs: stepStarted,
    }),
  );

  stepStarted = beginStep();
  const normalizedBeforeRubric = normalizeRubric(rubric);
  const normalizedRubric = normalizeRubric(refined.data.rubric);
  steps.push(
    completeStep({
      name: "rubric.normalize",
      label: "Normalize before/after rubrics",
      startedMs: stepStarted,
    }),
  );

  stepStarted = beginStep();
  const criteriaDiff = computeCriteriaDiff({
    beforeFilters: filters,
    beforeRubric: normalizedBeforeRubric,
    afterFilters: refined.data.filters,
    afterRubric: normalizedRubric,
  });
  steps.push(
    completeStep({
      name: "criteria.diff",
      label: "Compute deterministic criteria diff",
      startedMs: stepStarted,
    }),
  );

  const rankingResult = await rankSearch({
    filters: refined.data.filters,
    rubric: normalizedRubric,
  });
  const { execution: rankingExecution, ...ranking } = rankingResult;

  return {
    recruiterIntent: refined.data.recruiterIntent,
    filters: refined.data.filters,
    rubric: normalizedRubric,
    changes: refined.data.changes,
    criteriaDiff,
    ranking,
    execution: finishExecution({
      clock,
      steps: [...steps, ...rankingExecution.steps],
      generations: [refined.telemetry],
      inheritedLlm: [rankingExecution.llm],
      funnel: rankingExecution.funnel,
      grounding: rankingExecution.grounding,
    }),
  };
}
