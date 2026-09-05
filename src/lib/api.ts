import "server-only";

import { z, type ZodType } from "zod";
import { LlmServiceError } from "@/lib/gemini";
import type { ApiErrorPayload } from "@/lib/schemas";

export class InvalidRequestError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "InvalidRequestError";
    this.details = details;
  }
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 10).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "body";
    return `${path}: ${issue.message}`;
  });
}

export async function parseJsonRequest<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new InvalidRequestError("Request body must be valid JSON.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new InvalidRequestError(
      "The request did not match the expected shape.",
      formatZodIssues(parsed.error),
    );
  }
  return parsed.data;
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof InvalidRequestError) {
    const payload: ApiErrorPayload = {
      error: {
        code: "INVALID_REQUEST",
        message: error.message,
        retryable: false,
        details: error.details,
      },
    };
    return Response.json(payload, { status: 400 });
  }

  if (error instanceof LlmServiceError) {
    const payload: ApiErrorPayload = {
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        details: error.details,
      },
    };
    return Response.json(payload, { status: error.status });
  }

  console.error("Unexpected API error", error);
  const payload: ApiErrorPayload = {
    error: {
      code: "INTERNAL_ERROR",
      message: "Something unexpected went wrong. Your previous search state is unchanged.",
      retryable: true,
    },
  };
  return Response.json(payload, { status: 500 });
}
