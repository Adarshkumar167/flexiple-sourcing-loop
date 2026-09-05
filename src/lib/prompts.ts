import type {
  ObjectiveFilters,
  Profile,
  RecruiterRating,
  RubricCriterion,
} from "@/lib/schemas";

const SHARED_FILTER_SEMANTICS = `
Filter semantics:
- locations: OR. Use canonical dataset values when possible.
- minYearsExperience/maxYearsExperience: inclusive bounds; null when absent.
- requiredSkills: AND; every listed skill must be present in the structured skills field.
- anySkills: OR; at least one listed skill must be present. Use this only for explicit alternatives such as "Go or Python".
- titleKeywords: OR across current and past titles. Keep keywords short and literal.
- currentCompanyTypes: OR across allowed current-company types.
- companyBackgroundTypes: OR across current and past company types.
- companyKeywords: OR across current and past company names.
- educationKeywords: AND against the education field.
- An empty array means that field is not a hard filter.
- Never infer a hard filter from a soft phrase such as "prefer", "ideally", "bonus", or "nice to have"; represent that preference in the rubric instead.
`;

export function buildCriteriaPrompt(
  requirement: string,
  catalog: Record<string, readonly string[]>,
): string {
  return `You are the sourcing-planning component of an AI recruiter. Convert one recruiter's natural-language requirement into transparent objective filters and a subjective weighted rubric.

Recruiter requirement:
${requirement}

Available canonical values from the complete local dataset:
${JSON.stringify(catalog, null, 2)}

${SHARED_FILTER_SEMANTICS}

Rules:
1. Capture only explicit, objectively testable constraints in filters.
2. Put preferences, quality judgments, and trade-offs in a 3-5 criterion rubric.
3. Rubric criterion IDs must be unique lowercase kebab-case.
4. Rubric weights must be positive integers that sum to exactly 100.
5. Use dataset values exactly when the requirement maps to one; do not invent company types.
6. The interpretation must briefly explain the hard-versus-soft split in recruiter language.
7. Return every filter property, using [] or null when absent.
8. Return only the structured response requested by the API schema.`;
}

export function buildRankingPrompt(
  profiles: readonly Profile[],
  filters: ObjectiveFilters,
  rubric: readonly RubricCriterion[],
): string {
  return `You are the ranking component of an AI recruiter. Objective filtering has already happened deterministically in application code. Score every supplied candidate against every rubric criterion; do not add, remove, or override filters.

Applied objective filters:
${JSON.stringify(filters, null, 2)}

Rubric:
${JSON.stringify(rubric, null, 2)}

Filtered candidate records:
${JSON.stringify(profiles, null, 2)}

Scoring scale:
1 = direct negative evidence or very weak alignment
2 = limited alignment
3 = credible alignment
4 = strong alignment
5 = exceptional alignment in this candidate pool

Rules:
1. Return exactly one assessment for every supplied profile ID and no other IDs.
2. For each profile, return exactly one score for every rubric criterion ID and no other criterion IDs.
3. Use only the supplied record. Do not infer employers, responsibilities, scale, impact, or skills that are absent.
4. Every criterion score needs 1-3 evidence items. Set evidence.field to an actual profile field and copy evidence.value verbatim from that field. For arrays or past companies, copy one exact skill, company, title, company type, or rendered phrase such as "Backend Engineer at Freshworks" using values in the record.
5. Explain the connection in evidence.reason and rationale, but keep facts anchored to the record.
6. Differences between candidates should be visible in the 1-5 scores; avoid giving everyone the same score.
7. Return only the structured response requested by the API schema.`;
}

type RatedProfile = {
  profile: Profile;
  rating: number | null;
};

export function buildRefinementPrompt({
  requirement,
  filters,
  rubric,
  ratedProfiles,
  ratings,
  feedback,
  catalog,
}: {
  requirement: string;
  filters: ObjectiveFilters;
  rubric: readonly RubricCriterion[];
  ratedProfiles: readonly RatedProfile[];
  ratings: readonly RecruiterRating[];
  feedback: string;
  catalog: Record<string, readonly string[]>;
}): string {
  return `You are the refinement component of an AI recruiter. Update a search configuration from explicit recruiter feedback while preserving constraints and preferences the recruiter did not challenge.

Original requirement:
${requirement}

Current objective filters:
${JSON.stringify(filters, null, 2)}

Current rubric:
${JSON.stringify(rubric, null, 2)}

Current visible candidates and recruiter ratings:
${JSON.stringify(ratedProfiles, null, 2)}

Submitted ratings:
${JSON.stringify(ratings, null, 2)}

Written recruiter feedback:
${feedback || "No written feedback; infer only from the submitted ratings."}

Available canonical values:
${JSON.stringify(catalog, null, 2)}

${SHARED_FILTER_SEMANTICS}

Refinement rules:
1. Treat explicit language such as "must", "only", "exclude", or "at least" as a possible hard-filter change.
2. Treat "prefer", "prioritize", "more important", "bonus", and relative ratings as rubric evidence unless the recruiter clearly asks for exclusion.
3. Do not overfit a hard filter to one liked or disliked candidate.
4. Preserve unmentioned filters and rubric intent.
5. Return the complete next filters and complete next rubric, not a patch.
6. Rubric criterion IDs must be unique lowercase kebab-case; weights must be positive integers summing to exactly 100.
7. changes must state what changed and why in language a recruiter can trust. Include only real changes.
8. Return every filter property, using [] or null when absent.
9. Return only the structured response requested by the API schema.`;
}
