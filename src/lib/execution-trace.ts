import "server-only";

import { randomUUID } from "node:crypto";
import {
  ExecutionTraceSchema,
  type ExecutionStep,
  type ExecutionTrace,
  type GroundingAudit,
  type LlmExecution,
  type ProfileFunnel,
  type TokenUsage,
} from "@/lib/schemas";
import type { StructuredGenerationTelemetry } from "@/lib/gemini";

export type ExecutionClock = {
  id: string;
  operation: ExecutionTrace["operation"];
  startedAt: string;
  startedMs: number;
};

function roundedDuration(startedMs: number): number {
  return Math.max(0, Math.round(performance.now() - startedMs));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function sumNullable(
  values: readonly (number | null)[],
): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length > 0
    ? present.reduce((total, value) => total + value, 0)
    : null;
}

function mergeUsage(usages: readonly TokenUsage[]): TokenUsage {
  return {
    input: sumNullable(usages.map((usage) => usage.input)),
    output: sumNullable(usages.map((usage) => usage.output)),
    total: sumNullable(usages.map((usage) => usage.total)),
    thought: sumNullable(usages.map((usage) => usage.thought)),
    cached: sumNullable(usages.map((usage) => usage.cached)),
  };
}

function executionFromGenerations(
  generations: readonly StructuredGenerationTelemetry[],
): LlmExecution | null {
  if (generations.length === 0) return null;
  return {
    provider: "google-genai",
    modelsRequested: unique(
      generations.map((generation) => generation.modelRequested),
    ),
    modelsReturned: unique(
      generations.flatMap((generation) =>
        generation.modelReturned ? [generation.modelReturned] : [],
      ),
    ),
    providerCalls: generations.reduce(
      (total, generation) => total + generation.providerCalls,
      0,
    ),
    transportRetries: generations.reduce(
      (total, generation) => total + generation.transportRetries,
      0,
    ),
    structuredAttempts: generations.reduce(
      (total, generation) => total + generation.structuredAttempts,
      0,
    ),
    structureRepairs: generations.reduce(
      (total, generation) => total + generation.structureRepairs,
      0,
    ),
    retrySleepMs: generations.reduce(
      (total, generation) => total + generation.retrySleepMs,
      0,
    ),
    sdkRetriesDisabled: true,
    usage: mergeUsage(generations.map((generation) => generation.usage)),
    artifacts: generations.map((generation) => generation.artifact),
  };
}

function mergeLlmExecutions(
  generated: LlmExecution | null,
  inherited: readonly (LlmExecution | null)[],
): LlmExecution | null {
  const executions = [generated, ...inherited].filter(
    (execution): execution is LlmExecution => execution !== null,
  );
  if (executions.length === 0) return null;
  return {
    provider: "google-genai",
    modelsRequested: unique(
      executions.flatMap((execution) => execution.modelsRequested),
    ),
    modelsReturned: unique(
      executions.flatMap((execution) => execution.modelsReturned),
    ),
    providerCalls: executions.reduce(
      (total, execution) => total + execution.providerCalls,
      0,
    ),
    transportRetries: executions.reduce(
      (total, execution) => total + execution.transportRetries,
      0,
    ),
    structuredAttempts: executions.reduce(
      (total, execution) => total + execution.structuredAttempts,
      0,
    ),
    structureRepairs: executions.reduce(
      (total, execution) => total + execution.structureRepairs,
      0,
    ),
    retrySleepMs: executions.reduce(
      (total, execution) => total + execution.retrySleepMs,
      0,
    ),
    sdkRetriesDisabled: true,
    usage: mergeUsage(executions.map((execution) => execution.usage)),
    artifacts: executions.flatMap((execution) => execution.artifacts),
  };
}

export function beginExecution(
  operation: ExecutionTrace["operation"],
): ExecutionClock {
  return {
    id: randomUUID(),
    operation,
    startedAt: new Date().toISOString(),
    startedMs: performance.now(),
  };
}

export function beginStep(): number {
  return performance.now();
}

export function completeStep({
  name,
  label,
  startedMs,
  status = "completed",
}: {
  name: string;
  label: string;
  startedMs: number;
  status?: ExecutionStep["status"];
}): ExecutionStep {
  return {
    name,
    label,
    status,
    durationMs: roundedDuration(startedMs),
  };
}

export function skippedStep(name: string, label: string): ExecutionStep {
  return { name, label, status: "skipped", durationMs: 0 };
}

export function finishExecution({
  clock,
  steps,
  generations = [],
  inheritedLlm = [],
  funnel = null,
  grounding = null,
}: {
  clock: ExecutionClock;
  steps: readonly ExecutionStep[];
  generations?: readonly StructuredGenerationTelemetry[];
  inheritedLlm?: readonly (LlmExecution | null)[];
  funnel?: ProfileFunnel | null;
  grounding?: GroundingAudit | null;
}): ExecutionTrace {
  const generated = executionFromGenerations(generations);
  return ExecutionTraceSchema.parse({
    id: clock.id,
    operation: clock.operation,
    startedAt: clock.startedAt,
    durationMs: roundedDuration(clock.startedMs),
    steps,
    llm: mergeLlmExecutions(generated, inheritedLlm),
    funnel,
    grounding,
    privacy: {
      rawPromptStored: false,
      candidateDataLogged: false,
      providerInteractionStored: false,
    },
  });
}
