import { apiErrorResponse, parseJsonRequest } from "@/lib/api";
import { generateSearchCriteria } from "@/lib/search-service";
import { GenerateCriteriaRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { requirement } = await parseJsonRequest(
      request,
      GenerateCriteriaRequestSchema,
    );
    const criteria = await generateSearchCriteria(requirement);
    return Response.json(criteria);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
