import type { ObjectiveFilters, Profile } from "@/lib/schemas";

const SKILL_ALIASES: Record<string, string> = {
  postgres: "postgresql",
  postgresql: "postgresql",
  rds: "awsrds",
  awsrelationaldatabaseservice: "awsrds",
  node: "nodejs",
  js: "javascript",
  ts: "typescript",
};

const LOCATION_ALIASES: Record<string, string> = {
  bengaluru: "bangalore",
  bangaluru: "bangalore",
};

function normalizedWords(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compact(value: string): string {
  return normalizedWords(value).replace(/\s/g, "");
}

function normalizeSkill(value: string): string {
  const normalized = compact(value);
  return SKILL_ALIASES[normalized] ?? normalized;
}

function normalizeLocation(value: string): string {
  const normalized = normalizedWords(value);
  return LOCATION_ALIASES[normalized] ?? normalized;
}

function includesPhrase(source: string, phrase: string): boolean {
  return normalizedWords(source).includes(normalizedWords(phrase));
}

export type FilterDecision = {
  profile: Profile;
  matched: boolean;
  failedFilters: string[];
};

export type FilterResult = {
  matches: Profile[];
  decisions: FilterDecision[];
};

export function evaluateProfile(
  profile: Profile,
  filters: ObjectiveFilters,
): FilterDecision {
  const failedFilters: string[] = [];
  const candidateSkills = new Set(profile.skills.map(normalizeSkill));
  const candidateLocations = new Set([normalizeLocation(profile.location)]);
  const candidateTitles = [
    profile.current_title,
    ...profile.past_companies.map((company) => company.title),
  ];
  const candidateCompanies = [
    profile.current_company,
    ...profile.past_companies.map((company) => company.company),
  ];
  const backgroundTypes = new Set([
    profile.current_company_type,
    ...profile.past_companies.map((company) => company.company_type),
  ]);

  if (
    filters.locations.length > 0 &&
    !filters.locations.some((location) =>
      candidateLocations.has(normalizeLocation(location)),
    )
  ) {
    failedFilters.push("location");
  }

  if (
    filters.minYearsExperience !== null &&
    profile.years_experience < filters.minYearsExperience
  ) {
    failedFilters.push("minimum experience");
  }

  if (
    filters.maxYearsExperience !== null &&
    profile.years_experience > filters.maxYearsExperience
  ) {
    failedFilters.push("maximum experience");
  }

  if (
    !filters.requiredSkills.every((skill) =>
      candidateSkills.has(normalizeSkill(skill)),
    )
  ) {
    failedFilters.push("required skills");
  }

  if (
    filters.anySkills.length > 0 &&
    !filters.anySkills.some((skill) => candidateSkills.has(normalizeSkill(skill)))
  ) {
    failedFilters.push("alternative skills");
  }

  if (
    filters.titleKeywords.length > 0 &&
    !filters.titleKeywords.some((keyword) =>
      candidateTitles.some((title) => includesPhrase(title, keyword)),
    )
  ) {
    failedFilters.push("title");
  }

  if (
    filters.currentCompanyTypes.length > 0 &&
    !filters.currentCompanyTypes.includes(profile.current_company_type)
  ) {
    failedFilters.push("current company type");
  }

  if (
    filters.companyBackgroundTypes.length > 0 &&
    !filters.companyBackgroundTypes.some((type) => backgroundTypes.has(type))
  ) {
    failedFilters.push("company background");
  }

  if (
    filters.companyKeywords.length > 0 &&
    !filters.companyKeywords.some((keyword) =>
      candidateCompanies.some((company) => includesPhrase(company, keyword)),
    )
  ) {
    failedFilters.push("company");
  }

  if (
    !filters.educationKeywords.every((keyword) =>
      includesPhrase(profile.education, keyword),
    )
  ) {
    failedFilters.push("education");
  }

  return {
    profile,
    matched: failedFilters.length === 0,
    failedFilters,
  };
}

export function filterProfiles(
  allProfiles: readonly Profile[],
  filters: ObjectiveFilters,
): FilterResult {
  const decisions = allProfiles.map((profile) =>
    evaluateProfile(profile, filters),
  );

  return {
    decisions,
    matches: decisions
      .filter((decision) => decision.matched)
      .map((decision) => decision.profile),
  };
}

export function buildObjectiveEvidence(
  profile: Profile,
  filters: ObjectiveFilters,
): string[] {
  const evidence: string[] = [];

  if (filters.locations.length > 0) {
    evidence.push(`Location: ${profile.location}`);
  }

  if (
    filters.minYearsExperience !== null ||
    filters.maxYearsExperience !== null
  ) {
    evidence.push(`${profile.years_experience} years of experience`);
  }

  const requestedSkills = [...filters.requiredSkills, ...filters.anySkills];
  const matchedSkills = profile.skills.filter((skill) =>
    requestedSkills.some(
      (requestedSkill) =>
        normalizeSkill(requestedSkill) === normalizeSkill(skill),
    ),
  );
  if (matchedSkills.length > 0) {
    evidence.push(`Skills: ${matchedSkills.join(", ")}`);
  }

  if (filters.titleKeywords.length > 0) {
    evidence.push(`Current title: ${profile.current_title}`);
  }

  if (
    filters.currentCompanyTypes.length > 0 ||
    filters.companyBackgroundTypes.length > 0
  ) {
    const pastTypes = profile.past_companies.map(
      (company) => company.company_type,
    );
    evidence.push(
      `Company background: ${[
        profile.current_company_type,
        ...new Set(pastTypes),
      ].join(", ")}`,
    );
  }

  if (filters.companyKeywords.length > 0) {
    evidence.push(
      `Companies: ${[
        profile.current_company,
        ...profile.past_companies.map((company) => company.company),
      ].join(", ")}`,
    );
  }

  if (filters.educationKeywords.length > 0) {
    evidence.push(`Education: ${profile.education}`);
  }

  return evidence;
}
