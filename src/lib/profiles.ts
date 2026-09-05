import rawProfiles from "@/data/profiles.json";
import { ProfilesSchema, type Profile } from "@/lib/schemas";

const parsedProfiles = ProfilesSchema.parse(rawProfiles);

export const profiles: readonly Profile[] = Object.freeze(parsedProfiles);

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export const profileCatalog = Object.freeze({
  locations: uniqueSorted(parsedProfiles.map((profile) => profile.location)),
  skills: uniqueSorted(parsedProfiles.flatMap((profile) => profile.skills)),
  titles: uniqueSorted(
    parsedProfiles.flatMap((profile) => [
      profile.current_title,
      ...profile.past_companies.map((company) => company.title),
    ]),
  ),
  companies: uniqueSorted(
    parsedProfiles.flatMap((profile) => [
      profile.current_company,
      ...profile.past_companies.map((company) => company.company),
    ]),
  ),
  education: uniqueSorted(parsedProfiles.map((profile) => profile.education)),
  companyTypes: ["startup", "scaleup", "enterprise", "agency"] as const,
});

export function getProfilesByIds(ids: readonly string[]): Profile[] {
  const requestedIds = new Set(ids);
  return parsedProfiles.filter((profile) => requestedIds.has(profile.id));
}
