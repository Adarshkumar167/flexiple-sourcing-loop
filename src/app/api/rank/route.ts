import { apiErrorResponse, parseJsonRequest } from "@/lib/api";
import { rankSearch } from "@/lib/search-service";
import { RankRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { filters, rubric } = await parseJsonRequest(
      request,
      RankRequestSchema,
    );
    const ranking = await rankSearch({ filters, rubric });
    return Response.json(ranking);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
