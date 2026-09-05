import type { ExecutionTrace } from "@/lib/schemas";

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${milliseconds} ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds < 10_000 ? 2 : 1)} s`;
}

function formatTokens(value: number | null): string {
  return value === null ? "Not returned" : value.toLocaleString();
}

const FILTER_LABELS: Record<string, string> = {
  location: "Location",
  minimumExperience: "Min experience",
  maximumExperience: "Max experience",
  requiredSkills: "Required skills",
  alternativeSkills: "Alternative skills",
  title: "Title",
  currentCompanyType: "Current company",
  companyBackground: "Company background",
  company: "Company name",
  education: "Education",
};

export default function ExecutionTracePanel({
  trace,
  defaultOpen = false,
  title = "Inspect execution trace",
}: {
  trace: ExecutionTrace;
  defaultOpen?: boolean;
  title?: string;
}) {
  const maxStepDuration = Math.max(
    1,
    ...trace.steps.map((step) => step.durationMs),
  );
  const failedFilters = trace.funnel
    ? Object.entries(trace.funnel.failedFilterCounts).filter(
        ([, count]) => count > 0,
      )
    : [];

  return (
    <details
      open={defaultOpen}
      className="group min-w-0 overflow-hidden rounded-2xl border border-[#d8e0da] bg-white shadow-[0_16px_40px_rgba(23,54,37,0.06)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#2d8b5d]">
            Auditable pipeline · {trace.operation}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[#223128]">
            {title}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-full bg-[#edf6f0] px-2.5 py-1 text-[10px] font-bold text-[#35634a]">
            {formatDuration(trace.durationMs)}
          </span>
          <span className="text-sm font-bold text-[#728078] transition group-open:rotate-180">
            ↓
          </span>
        </div>
      </summary>

      <div className="grid min-w-0 gap-5 border-t border-[#e4e9e5] px-5 py-5 text-xs">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-bold text-[#394a40]">Latency waterfall</p>
            <code className="text-[9px] text-[#88938c]">
              {trace.id.slice(0, 8)}
            </code>
          </div>
          <div className="grid gap-2.5">
            {trace.steps.map((step, index) => (
              <div
                key={`${step.name}-${index}`}
                className="grid min-w-0 grid-cols-[minmax(90px,0.9fr)_minmax(70px,1.3fr)_54px] items-center gap-2"
              >
                <span className="truncate text-[10px] font-semibold text-[#59675e]">
                  {step.label}
                </span>
                <div className="h-2 min-w-0 overflow-hidden rounded-full bg-[#edf0ee]">
                  <div
                    className={`h-full rounded-full ${
                      step.status === "skipped" ? "bg-[#cbd2cd]" : "bg-[#5ca97a]"
                    }`}
                    style={{
                      width:
                        step.status === "skipped"
                          ? "4%"
                          : `${Math.max(4, (step.durationMs / maxStepDuration) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-right text-[10px] tabular-nums text-[#7a867e]">
                  {step.status === "skipped" ? "skipped" : formatDuration(step.durationMs)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {trace.funnel && (
          <section className="min-w-0 rounded-xl bg-[#f4f8f5] p-3.5">
            <p className="font-bold text-[#394a40]">Candidate funnel</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ["Local pool", trace.funnel.totalProfiles],
                ["Matched", trace.funnel.hardFilterMatched],
                ["Excluded", trace.funnel.hardFilterExcluded],
                ["LLM window", trace.funnel.sentToModel],
                ["Returned", trace.funnel.returnedResults],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`min-w-0 rounded-lg bg-white px-2.5 py-2 ${
                    index === 4 ? "col-span-2" : ""
                  }`}
                >
                  <p className="text-base font-bold tabular-nums text-[#24573c]">
                    {value}
                  </p>
                  <p className="break-words text-[9px] font-semibold uppercase leading-3 tracking-[0.06em] text-[#7a887f]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
            {failedFilters.length > 0 && (
              <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
                {failedFilters.map(([filter, count]) => (
                  <span
                    key={filter}
                    className="max-w-full truncate rounded-md border border-[#dce5df] bg-white px-2 py-1 text-[9px] text-[#65736a]"
                    title={`${FILTER_LABELS[filter] ?? filter}: ${count}`}
                  >
                    {FILTER_LABELS[filter] ?? filter}: {count}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {trace.grounding && (
          <section className="min-w-0 rounded-xl border border-[#cce3d4] bg-[#eef8f1] p-3.5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold text-[#28583e]">Grounding audit</p>
                <p className="mt-1 text-[10px] leading-4 text-[#5f7768]">
                  Every rendered criterion retained at least one value found in the selected structured profile field.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-sm font-black text-[#247044]">
                {trace.grounding.evidenceCoveragePercent}%
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="min-w-0 rounded-lg bg-white/80 p-2">
                <p className="font-bold text-[#294d38]">
                  {trace.grounding.candidatesValidated}/{trace.grounding.candidatesExpected}
                </p>
                <p className="truncate text-[9px] text-[#748078]">Candidates</p>
              </div>
              <div className="min-w-0 rounded-lg bg-white/80 p-2">
                <p className="font-bold text-[#294d38]">
                  {trace.grounding.criteriaValidated}/{trace.grounding.criteriaExpected}
                </p>
                <p className="truncate text-[9px] text-[#748078]">Criteria</p>
              </div>
              <div className="min-w-0 rounded-lg bg-white/80 p-2">
                <p className="font-bold text-[#294d38]">
                  {trace.grounding.evidenceGrounded}/{trace.grounding.evidenceReceived}
                </p>
                <p className="truncate text-[9px] text-[#748078]">Evidence kept</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] font-semibold text-[#477059]">
              Weighted totals computed in application code · {trace.grounding.evidenceDropped} unsupported evidence item(s) dropped
            </p>
          </section>
        )}

        <section className="grid min-w-0 gap-3">
          <div className="min-w-0 rounded-xl border border-[#e0e5e1] p-3.5">
            <p className="font-bold text-[#394a40]">Model execution</p>
            {trace.llm ? (
              <dl className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[10px]">
                <dt className="text-[#768178]">Model requested</dt>
                <dd
                  className="min-w-0 truncate text-right font-mono text-[#344a3c]"
                  title={trace.llm.modelsRequested.join(", ")}
                >
                  {trace.llm.modelsRequested.join(", ")}
                </dd>
                <dt className="text-[#768178]">Provider calls</dt>
                <dd className="text-right font-bold tabular-nums text-[#344a3c]">{trace.llm.providerCalls}</dd>
                <dt className="text-[#768178]">Transport retries</dt>
                <dd className="text-right font-bold tabular-nums text-[#344a3c]">{trace.llm.transportRetries}</dd>
                <dt className="text-[#768178]">Schema repairs</dt>
                <dd className="text-right font-bold tabular-nums text-[#344a3c]">{trace.llm.structureRepairs}</dd>
                <dt className="text-[#768178]">Input tokens</dt>
                <dd className="text-right font-bold tabular-nums text-[#344a3c]">{formatTokens(trace.llm.usage.input)}</dd>
                <dt className="text-[#768178]">Output tokens</dt>
                <dd className="text-right font-bold tabular-nums text-[#344a3c]">{formatTokens(trace.llm.usage.output)}</dd>
              </dl>
            ) : (
              <p className="mt-2 text-[10px] leading-4 text-[#728078]">
                No model call was made; deterministic filtering produced zero survivors.
              </p>
            )}
          </div>

          <div className="min-w-0 rounded-xl border border-[#e0e5e1] p-3.5">
            <p className="font-bold text-[#394a40]">Prompt version & provider schema</p>
            <p className="mt-1 text-[9px] leading-4 text-[#7b8780]">
              Version labels identify application templates; each hash fingerprints the sanitized schema sent to Gemini.
            </p>
            {trace.llm ? (
              <div className="mt-2 grid min-w-0 gap-2">
                {trace.llm.artifacts.map((artifact) => {
                  const artifactLabel = `${artifact.promptId} → ${artifact.schemaId}`;
                  return (
                    <div
                      key={`${artifact.promptId}-${artifact.schemaId}`}
                      className="min-w-0"
                    >
                      <p
                        className="truncate text-[10px] font-bold text-[#3c5c48]"
                        title={artifactLabel}
                      >
                        {artifactLabel}
                      </p>
                      <code
                        className="mt-0.5 block max-w-full truncate text-[9px] text-[#88938c]"
                        title={artifact.schemaHash}
                      >
                        {artifact.schemaHash}
                      </code>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-[#728078]">Not applicable.</p>
            )}
          </div>
        </section>

        <div className="min-w-0 rounded-xl border border-[#e7ddd2] bg-[#fffaf5] px-3.5 py-3 text-[10px] leading-4 text-[#756555]">
          <span className="font-bold text-[#67513e]">Privacy boundary:</span> raw prompts, recruiter feedback, candidate records, provider interaction IDs, and API keys are never persisted in this trace. SDK retries are disabled so provider-call counts are exact.
        </div>
      </div>
    </details>
  );
}
