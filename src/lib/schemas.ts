import { z } from "zod";

export const CompanyTypeSchema = z.enum([
  "startup",
  "scaleup",
  "enterprise",
  "agency",
]);

export const PastCompanySchema = z
  .object({
    company: z.string().trim().min(1),
    company_type: CompanyTypeSchema,
    title: z.string().trim().min(1),
    years: z.number().nonnegative(),
  })
  .strict();

export const ProfileSchema = z
  .object({
    id: z.string().regex(/^p\d{2}$/),
    name: z.string().trim().min(1),
    current_title: z.string().trim().min(1),
    years_experience: z.number().nonnegative(),
    location: z.string().trim().min(1),
    current_company: z.string().trim().min(1),
    current_company_type: CompanyTypeSchema,
    skills: z.array(z.string().trim().min(1)).min(1),
    past_companies: z.array(PastCompanySchema),
    education: z.string().trim().min(1),
    summary: z.string().trim().min(1),
  })
  .strict();

export const ProfilesSchema = z.array(ProfileSchema).min(1);

const FilterStringSchema = z.string().trim().min(1).max(100);
const FilterStringListSchema = z.array(FilterStringSchema).max(16);

export const ObjectiveFiltersSchema = z
  .object({
    locations: FilterStringListSchema,
    minYearsExperience: z.number().int().min(0).max(50).nullable(),
    maxYearsExperience: z.number().int().min(0).max(50).nullable(),
    requiredSkills: FilterStringListSchema,
    anySkills: FilterStringListSchema,
    titleKeywords: FilterStringListSchema,
    currentCompanyTypes: z.array(CompanyTypeSchema).max(4),
    companyBackgroundTypes: z.array(CompanyTypeSchema).max(4),
    companyKeywords: FilterStringListSchema,
    educationKeywords: FilterStringListSchema,
  })
  .strict()
  .superRefine((filters, context) => {
    if (
      filters.minYearsExperience !== null &&
      filters.maxYearsExperience !== null &&
      filters.minYearsExperience > filters.maxYearsExperience
    ) {
      context.addIssue({
        code: "custom",
        message: "Minimum experience cannot exceed maximum experience.",
        path: ["minYearsExperience"],
      });
    }
  });

export const RubricCriterionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/),
    label: z.string().trim().min(2).max(80),
    description: z.string().trim().min(8).max(280),
    weight: z.number().int().min(1).max(100),
  })
  .strict();

export const RubricSchema = z.array(RubricCriterionSchema).min(2).max(6);

export const SearchCriteriaSchema = z
  .object({
    interpretation: z.string().trim().min(10).max(500),
    filters: ObjectiveFiltersSchema,
    rubric: RubricSchema,
  })
  .strict();

export const EvidenceFieldSchema = z.enum([
  "current_title",
  "years_experience",
  "location",
  "current_company",
  "current_company_type",
  "skills",
  "past_companies",
  "education",
  "summary",
]);

export const EvidenceSchema = z
  .object({
    field: EvidenceFieldSchema,
    value: z.string().trim().min(1).max(500),
    reason: z.string().trim().min(4).max(240),
  })
  .strict();

export const CriterionScoreSchema = z
  .object({
    criterionId: z.string().min(1),
    score: z.number().int().min(1).max(5),
    rationale: z.string().trim().min(8).max(350),
    evidence: z.array(EvidenceSchema).min(1).max(3),
  })
  .strict();

export const CandidateAssessmentSchema = z
  .object({
    profileId: z.string().regex(/^p\d{2}$/),
    criterionScores: z.array(CriterionScoreSchema).min(2).max(6),
    overallRationale: z.string().trim().min(12).max(500),
  })
  .strict();

export const RankingModelOutputSchema = z
  .object({
    assessments: z.array(CandidateAssessmentSchema).min(1).max(48),
  })
  .strict();

export const RecruiterRatingSchema = z
  .object({
    profileId: z.string().regex(/^p\d{2}$/),
    rating: z.number().int().min(1).max(5),
  })
  .strict();

export const GenerateCriteriaRequestSchema = z
  .object({
    requirement: z.string().trim().min(10).max(1500),
  })
  .strict();

export const RankRequestSchema = z
  .object({
    filters: ObjectiveFiltersSchema,
    rubric: RubricSchema,
  })
  .strict();

export const RefineRequestSchema = z
  .object({
    requirement: z.string().trim().min(10).max(1500),
    filters: ObjectiveFiltersSchema,
    rubric: RubricSchema,
    ratings: z.array(RecruiterRatingSchema).max(5),
    feedback: z.string().trim().max(1500),
    currentResultIds: z.array(z.string().regex(/^p\d{2}$/)).min(1).max(5),
    round: z.number().int().min(1).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.ratings.length === 0 && value.feedback.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Add at least one rating or a written feedback message.",
        path: ["feedback"],
      });
    }
  });

export const RefinementChangeSchema = z
  .object({
    area: z.enum(["filters", "rubric"]),
    change: z.string().trim().min(4).max(240),
    reason: z.string().trim().min(4).max(300),
  })
  .strict();

export const RefinementModelOutputSchema = z
  .object({
    recruiterIntent: z.string().trim().min(8).max(400),
    filters: ObjectiveFiltersSchema,
    rubric: RubricSchema,
    changes: z.array(RefinementChangeSchema).min(1).max(8),
  })
  .strict();

export const RankedCandidateSchema = z
  .object({
    profile: ProfileSchema,
    weightedScore: z.number().min(0).max(100),
    criterionScores: z.array(CriterionScoreSchema).min(2).max(6),
    overallRationale: z.string().trim().min(12).max(500),
    objectiveEvidence: z.array(z.string().trim().min(1).max(300)).max(10),
  })
  .strict();

export const RankingResponseSchema = z
  .object({
    matchedCount: z.number().int().min(0).max(48),
    totalCount: z.number().int().min(1).max(48),
    results: z.array(RankedCandidateSchema).max(5),
  })
  .strict();

export const RefinementResponseSchema = z
  .object({
    recruiterIntent: z.string().trim().min(8).max(400),
    filters: ObjectiveFiltersSchema,
    rubric: RubricSchema,
    changes: z.array(RefinementChangeSchema).min(1).max(8),
    ranking: RankingResponseSchema,
  })
  .strict();

export const RefinementHistoryEntrySchema = z
  .object({
    round: z.number().int().min(1).max(20),
    feedback: z.string().max(1500),
    ratings: z.array(RecruiterRatingSchema).max(5),
    recruiterIntent: z.string().trim().min(8).max(400),
    changes: z.array(RefinementChangeSchema).min(1).max(8),
    createdAt: z.string().datetime(),
  })
  .strict();

export const SearchSessionStateSchema = z
  .object({
    version: z.literal(1),
    stage: z.enum(["search", "criteria", "results", "frozen"]),
    requirement: z.string().max(1500),
    interpretation: z.string().max(500),
    filters: ObjectiveFiltersSchema.nullable(),
    rubric: z.array(RubricCriterionSchema).max(6),
    ranking: RankingResponseSchema.nullable(),
    ratings: z.record(
      z.string().regex(/^p\d{2}$/),
      z.number().int().min(1).max(5),
    ),
    feedback: z.string().max(1500),
    round: z.number().int().min(0).max(20),
    history: z.array(RefinementHistoryEntrySchema).max(20),
    frozenAt: z.string().datetime().nullable(),
  })
  .strict();

export const ApiErrorPayloadSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        retryable: z.boolean(),
        details: z.array(z.string()).optional(),
      })
      .strict(),
  })
  .strict();

export type CompanyType = z.infer<typeof CompanyTypeSchema>;
export type PastCompany = z.infer<typeof PastCompanySchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type ObjectiveFilters = z.infer<typeof ObjectiveFiltersSchema>;
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;
export type SearchCriteria = z.infer<typeof SearchCriteriaSchema>;
export type EvidenceField = z.infer<typeof EvidenceFieldSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type CriterionScore = z.infer<typeof CriterionScoreSchema>;
export type CandidateAssessment = z.infer<typeof CandidateAssessmentSchema>;
export type RecruiterRating = z.infer<typeof RecruiterRatingSchema>;
export type RefinementChange = z.infer<typeof RefinementChangeSchema>;
export type RankedCandidate = z.infer<typeof RankedCandidateSchema>;
export type RankingResponse = z.infer<typeof RankingResponseSchema>;
export type RefinementResponse = z.infer<typeof RefinementResponseSchema>;
export type RefinementHistoryEntry = z.infer<
  typeof RefinementHistoryEntrySchema
>;
export type SearchSessionState = z.infer<typeof SearchSessionStateSchema>;
export type ApiErrorPayload = z.infer<typeof ApiErrorPayloadSchema>;
