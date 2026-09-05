import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z, type ZodType } from "zod";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const REQUEST_TIMEOUT_MS = 35_000;
const MAX_TRANSPORT_ATTEMPTS = 2;
const MAX_STRUCTURE_ATTEMPTS = 2;

const GEMINI_JSON_SCHEMA_KEYS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

const GEMINI_SCHEMA_MAP_KEYS = new Set(["$defs", "properties"]);
const GEMINI_SCHEMA_ARRAY_KEYS = new Set([
  "anyOf",
  "oneOf",
  "prefixItems",
]);

export class LlmServiceError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number;
  readonly details?: string[];

  constructor({
    code,
    message,
    retryable,
    status,
    details,
  }: {
    code: string;
    message: string;
    retryable: boolean;
    status: number;
    details?: string[];
  }) {
    super(message);
    this.name = "LlmServiceError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.details = details;
  }
}

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new LlmServiceError({
      code: "LLM_NOT_CONFIGURED",
      message:
        "Gemini is not configured. Add GEMINI_API_KEY to .env.local and restart the app.",
      retryable: false,
      status: 503,
    });
  }
  return apiKey;
}

function getModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getErrorStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown provider error";
}

function sanitizeProviderMessage(message: string): string {
  return message
    .replace(/\bAIza[A-Za-z0-9_-]+\b/g, "[REDACTED_API_KEY]")
    .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(
      /((?:x-goog-api-key|gemini_api_key|api[_-]?key)["']?\s*[:=]\s*)["']?[^"',\s}]+/gi,
      "$1[REDACTED]",
    )
    .slice(0, 600);
}

function providerRejectionReason({
  status,
  providerMessage,
}: {
  status: number;
  providerMessage: string;
}): string {
  const normalized = providerMessage.toLowerCase();

  if (
    normalized.includes("max_output_tokens") ||
    normalized.includes("max output tokens") ||
    normalized.includes("output token limit")
  ) {
    return "The requested output-token budget exceeds the configured model's limit.";
  }
  if (
    normalized.includes("too many states") ||
    (normalized.includes("schema") && normalized.includes("complex"))
  ) {
    return "The structured-output schema is too complex for the configured model.";
  }
  if (
    normalized.includes("schema") ||
    normalized.includes("unsupported keyword") ||
    normalized.includes("invalid argument")
  ) {
    return "Gemini rejected part of the structured-output request schema.";
  }
  if (status === 404 || normalized.includes("not found")) {
    return "The configured model name is unavailable to this API key or API version.";
  }
  return `Gemini returned HTTP ${status} before generating a response.`;
}

function isTimeout(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    (error instanceof Error && error.name === "AbortError") ||
    message.includes("timeout") ||
    message.includes("timed out")
  );
}

function isRetryableTransportError(error: unknown): boolean {
  const status = getErrorStatus(error);
  return (
    isTimeout(error) ||
    status === 408 ||
    status === 429 ||
    (status !== undefined && status >= 500) ||
    status === undefined
  );
}

function mapProviderError(error: unknown): LlmServiceError {
  if (error instanceof LlmServiceError) return error;

  const status = getErrorStatus(error);
  if (isTimeout(error)) {
    return new LlmServiceError({
      code: "LLM_TIMEOUT",
      message:
        "The model took too long to respond. Your previous search state is unchanged.",
      retryable: true,
      status: 504,
    });
  }
  if (status === 429) {
    return new LlmServiceError({
      code: "LLM_RATE_LIMITED",
      message:
        "Gemini is temporarily rate limited. Your previous search state is unchanged.",
      retryable: true,
      status: 429,
    });
  }
  if (status === 401 || status === 403) {
    return new LlmServiceError({
      code: "LLM_AUTH_FAILED",
      message:
        "Gemini rejected the configured API key. Check GEMINI_API_KEY and try again.",
      retryable: false,
      status: 503,
    });
  }
  if (status === 400 || status === 404) {
    const providerMessage = sanitizeProviderMessage(getErrorMessage(error));
    const rejectionReason = providerRejectionReason({
      status,
      providerMessage,
    });

    console.error("Gemini request rejected", {
      status,
      model: getModel().slice(0, 100),
      providerMessage,
    });

    return new LlmServiceError({
      code: "LLM_REQUEST_REJECTED",
      message:
        "Gemini rejected the structured-output request. Check the server log for the sanitized provider reason.",
      retryable: false,
      status: 502,
      details: [rejectionReason],
    });
  }
  return new LlmServiceError({
    code: "LLM_UNAVAILABLE",
    message:
      "Gemini is temporarily unavailable. Your previous search state is unchanged.",
    retryable: true,
    status: 502,
  });
}

function stripMarkdownFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function validationDetails(error: z.ZodError): string[] {
  return error.issues.slice(0, 8).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "response";
    return `${path}: ${issue.message}`;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSchemaNode(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!GEMINI_JSON_SCHEMA_KEYS.has(key)) continue;

    if (GEMINI_SCHEMA_MAP_KEYS.has(key)) {
      if (!isRecord(child)) continue;
      sanitized[key] = Object.fromEntries(
        Object.entries(child).map(([name, schema]) => [
          name,
          sanitizeSchemaNode(schema),
        ]),
      );
      continue;
    }

    if (GEMINI_SCHEMA_ARRAY_KEYS.has(key)) {
      if (!Array.isArray(child)) continue;
      sanitized[key] = child.map((schema) => sanitizeSchemaNode(schema));
      continue;
    }

    if (key === "items" || key === "additionalProperties") {
      sanitized[key] = isRecord(child) ? sanitizeSchemaNode(child) : child;
      continue;
    }

    sanitized[key] = child;
  }
  return sanitized;
}

/**
 * Gemini accepts only a subset of JSON Schema. String length/regex keywords are
 * removed here, and nested array cardinality is intentionally left to Zod to
 * avoid provider grammar-complexity failures. Zod remains the final authority.
 */
export function toResponseJsonSchema<T>(
  schema: ZodType<T>,
): Record<string, unknown> {
  return sanitizeSchemaNode(z.toJSONSchema(schema)) as Record<string, unknown>;
}

async function requestGemini({
  prompt,
  responseSchema,
  maxOutputTokens,
}: {
  prompt: string;
  responseSchema: Record<string, unknown>;
  maxOutputTokens: number;
}): Promise<string> {
  const client = new GoogleGenAI({
    apiKey: getApiKey(),
    httpOptions: { timeout: REQUEST_TIMEOUT_MS },
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_TRANSPORT_ATTEMPTS; attempt += 1) {
    try {
      const response = await client.interactions.create({
        model: getModel(),
        input: prompt,
        generation_config: {
          max_output_tokens: maxOutputTokens,
          thinking_level: "low",
        },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: responseSchema,
        },
        store: false,
      });
      const text = response.output_text?.trim();
      if (!text) {
        throw new LlmServiceError({
          code: "LLM_EMPTY_RESPONSE",
          message:
            "The model returned no usable output. Your previous search state is unchanged.",
          retryable: true,
          status: 502,
        });
      }
      return text;
    } catch (error) {
      lastError = error;
      if (
        attempt === MAX_TRANSPORT_ATTEMPTS - 1 ||
        !isRetryableTransportError(error)
      ) {
        throw mapProviderError(error);
      }
      await sleep(700 * (attempt + 1));
    }
  }

  throw mapProviderError(lastError);
}

export async function generateStructured<T>({
  prompt,
  schema,
  maxOutputTokens = 8_192,
}: {
  prompt: string;
  schema: ZodType<T>;
  maxOutputTokens?: number;
}): Promise<T> {
  const responseSchema = toResponseJsonSchema(schema);
  let currentPrompt = prompt;
  let lastDetails: string[] = [];

  for (
    let structureAttempt = 0;
    structureAttempt < MAX_STRUCTURE_ATTEMPTS;
    structureAttempt += 1
  ) {
    const rawText = await requestGemini({
      prompt: currentPrompt,
      responseSchema,
      maxOutputTokens,
    });

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripMarkdownFence(rawText));
    } catch {
      lastDetails = ["response: invalid JSON"];
      currentPrompt = `${prompt}\n\nThe previous response was not valid JSON. Return a corrected response that follows the requested schema exactly, with no markdown fences or commentary.`;
      continue;
    }

    const parsed = schema.safeParse(parsedJson);
    if (parsed.success) return parsed.data;

    lastDetails = validationDetails(parsed.error);
    currentPrompt = `${prompt}\n\nThe previous response failed validation:\n${lastDetails.join("\n")}\nReturn a complete corrected response that follows the requested schema exactly. Do not return a patch or commentary.`;
  }

  throw new LlmServiceError({
    code: "LLM_INVALID_OUTPUT",
    message:
      "The model returned malformed structured output twice. Your previous search state is unchanged.",
    retryable: true,
    status: 502,
    details: lastDetails,
  });
}
