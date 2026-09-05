import type { ZodType } from "zod";
import { ApiErrorPayloadSchema } from "@/lib/schemas";

const CLIENT_TIMEOUT_MS = 95_000;

export class ApiClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details: string[];

  constructor({
    code,
    message,
    retryable,
    details = [],
  }: {
    code: string;
    message: string;
    retryable: boolean;
    details?: string[];
  }) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export async function postJson<T>({
  path,
  body,
  schema,
}: {
  path: string;
  body: unknown;
  schema: ZodType<T>;
}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ApiClientError({
        code: "INVALID_SERVER_RESPONSE",
        message:
          "The server returned an unreadable response. Your previous search state is unchanged.",
        retryable: true,
      });
    }

    if (!response.ok) {
      const parsedError = ApiErrorPayloadSchema.safeParse(payload);
      if (parsedError.success) {
        throw new ApiClientError({
          code: parsedError.data.error.code,
          message: parsedError.data.error.message,
          retryable: parsedError.data.error.retryable,
          details: parsedError.data.error.details,
        });
      }
      throw new ApiClientError({
        code: "REQUEST_FAILED",
        message:
          "The request failed without a valid error response. Your previous search state is unchanged.",
        retryable: response.status >= 500,
      });
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiClientError({
        code: "INVALID_SERVER_RESPONSE",
        message:
          "The server response failed client-side validation and was not applied.",
        retryable: true,
        details: parsed.error.issues.slice(0, 6).map((issue) => {
          const location = issue.path.length > 0 ? issue.path.join(".") : "response";
          return `${location}: ${issue.message}`;
        }),
      });
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError({
        code: "CLIENT_TIMEOUT",
        message:
          "The request timed out. Your previous search state is unchanged.",
        retryable: true,
      });
    }
    throw new ApiClientError({
      code: "NETWORK_ERROR",
      message:
        "The app could not reach the server. Check your connection, then retry; your previous state is safe.",
      retryable: true,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}
