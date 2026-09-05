import { apiErrorResponse, parseJsonRequest } from "@/lib/api";
import { refineSearch } from "@/lib/search-service";
import { RefineRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJsonRequest(request, RefineRequestSchema);
    const refinement = await refineSearch(input);
    return Response.json(refinement);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
