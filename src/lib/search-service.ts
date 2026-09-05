import "server-only";

import { filterProfiles } from "@/lib/filter-profiles";
import { generateStructured, LlmServiceError } from "@/lib/gemini";
import { profileCatalog, profiles, getProfilesByIds } from "@/lib/profiles";
import {
  buildCriteriaPrompt,
  buildRankingPrompt,
  buildRefinementPrompt,
} from "@/lib/prompts";
import {
  buildRankedCandidates,
  normalizeRubric,
  RankingValidationError,
} from "@/lib/ranking";
import {
  RankingModelOutputSchema,
  RefinementModelOutputSchema,
  SearchCriteriaSchema,
  type ObjectiveFilters,
  type RankingResponse,
  type RecruiterRating,
  type RefinementResponse,
  type RubricCriterion,
  type SearchCriteria,
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

export async function generateSearchCriteria(
  requirement: string,
): Promise<SearchCriteria> {
  const generated = await generateStructured({
    prompt: buildCriteriaPrompt(requirement, catalogForPrompt()),
    schema: SearchCriteriaSchema,
    maxOutputTokens: 5_000,
  });

  return SearchCriteriaSchema.parse({
    ...generated,
    rubric: normalizeRubric(generated.rubric),
  });
}

export async function rankSearch({
  filters,
  rubric,
}: {
  filters: ObjectiveFilters;
  rubric: readonly RubricCriterion[];
}): Promise<RankingResponse> {
  const normalizedRubric = normalizeRubric(rubric);
  const { matches } = filterProfiles(profiles, filters);

  if (matches.length === 0) {
    return {
      matchedCount: 0,
      totalCount: profiles.length,
      results: [],
    };
  }

  try {
    const modelOutput = await generateStructured({
      prompt: buildRankingPrompt(matches, filters, normalizedRubric),
      schema: RankingModelOutputSchema,
      maxOutputTokens: 8_192,
    });

    return {
      matchedCount: matches.length,
      totalCount: profiles.length,
      results: buildRankedCandidates(
        matches,
        modelOutput.assessments,
        normalizedRubric,
        filters,
      ),
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
  if (
    ratings.some((rating) => !currentResultIds.includes(rating.profileId))
  ) {
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

  const ratingByProfile = new Map(
    ratings.map((rating) => [rating.profileId, rating.rating]),
  );
  const ratedProfiles = visibleProfiles.map((profile) => ({
    profile,
    rating: ratingByProfile.get(profile.id) ?? null,
  }));

  const refined = await generateStructured({
    prompt: buildRefinementPrompt({
      requirement,
      filters,
      rubric,
      ratedProfiles,
      ratings,
      feedback,
      catalog: catalogForPrompt(),
    }),
    schema: RefinementModelOutputSchema,
    maxOutputTokens: 7_000,
  });

  const normalizedRubric = normalizeRubric(refined.rubric);
  const ranking = await rankSearch({
    filters: refined.filters,
    rubric: normalizedRubric,
  });

  return {
    recruiterIntent: refined.recruiterIntent,
    filters: refined.filters,
    rubric: normalizedRubric,
    changes: refined.changes,
    ranking,
  };
}
