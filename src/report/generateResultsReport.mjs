import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readJson, writeText } from "../shared/io.mjs";

const OUT = "RESULTS.md";

async function readIfExists(path) {
  return existsSync(path) ? readJson(path) : null;
}

function rounded(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  return Number(value).toFixed(4);
}

function tableCell(value) {
  return String(value ?? "")
    .replace(/\r?\n/gu, " ")
    .replace(/\|/gu, "\\|")
    .trim();
}

function section(title, body) {
  return [`## ${title}`, "", body.trim(), ""].join("\n");
}

function mainBenchmark(summary) {
  if (!summary) return "";

  return section(
    "Deterministic Memory Benchmark",
    `
Dataset: ${summary.dataset.events} events, ${summary.dataset.questions} questions.

| System | Exact Match | F1 | Current Fact Accuracy | Obsolete Rejection | Stale Error | Context Hit | MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG | ${rounded(summary.rag.exactMatchAccuracy)} | ${rounded(summary.rag.f1Score)} | ${rounded(summary.rag.currentFactAccuracy)} | ${rounded(summary.rag.obsoleteFactRejectionRate)} | ${rounded(summary.rag.staleFactErrorRate)} | ${rounded(summary.rag.contextHitRate)} | ${rounded(summary.rag.meanReciprocalRank)} |
| State Memory | ${rounded(summary.stateMemory.exactMatchAccuracy)} | ${rounded(summary.stateMemory.f1Score)} | ${rounded(summary.stateMemory.currentFactAccuracy)} | ${rounded(summary.stateMemory.obsoleteFactRejectionRate)} | ${rounded(summary.stateMemory.staleFactErrorRate)} | ${rounded(summary.stateMemory.contextHitRate)} | ${rounded(summary.stateMemory.meanReciprocalRank)} |

| Case | Count |
| --- | ---: |
| Both correct | ${summary.pairedComparison.bothCorrect} |
| State correct, RAG wrong | ${summary.pairedComparison.rightCorrectLeftWrong} |
| RAG correct, State wrong | ${summary.pairedComparison.leftCorrectRightWrong} |
| Both wrong | ${summary.pairedComparison.bothWrong} |
`
  );
}

function mixedBenchmark(summary) {
  if (!summary) return "";

  const types = ["current_state", "stable_state", "document_detail"];
  const typeRows = types
    .map((type) => {
      const rag = summary.byType.ragOnly[type]?.exactMatchAccuracy ?? 0;
      const state = summary.byType.stateOnly[type]?.exactMatchAccuracy ?? 0;
      const hybrid = summary.byType.hybrid[type]?.exactMatchAccuracy ?? 0;
      return `| ${type} | ${rounded(rag)} | ${rounded(state)} | ${rounded(hybrid)} |`;
    })
    .join("\n");

  return section(
    "Mixed Structured And Document Benchmark",
    `
Dataset: ${summary.dataset.events} events, ${summary.dataset.documentPages} document pages, ${summary.dataset.questions} questions.

| System | Exact Match | Current Fact Accuracy | Context Hit | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| RAG-only | ${rounded(summary.ragOnly.exactMatchAccuracy)} | ${rounded(summary.ragOnly.currentFactAccuracy)} | ${rounded(summary.ragOnly.contextHitRate)} | ${rounded(summary.ragOnly.averageContextTokens)} | ${rounded(summary.ragOnly.averageLatencyMs)} |
| State-only | ${rounded(summary.stateOnly.exactMatchAccuracy)} | ${rounded(summary.stateOnly.currentFactAccuracy)} | ${rounded(summary.stateOnly.contextHitRate)} | ${rounded(summary.stateOnly.averageContextTokens)} | ${rounded(summary.stateOnly.averageLatencyMs)} |
| Hybrid | ${rounded(summary.hybrid.exactMatchAccuracy)} | ${rounded(summary.hybrid.currentFactAccuracy)} | ${rounded(summary.hybrid.contextHitRate)} | ${rounded(summary.hybrid.averageContextTokens)} | ${rounded(summary.hybrid.averageLatencyMs)} |

| Question Type | RAG-only | State-only | Hybrid |
| --- | ---: | ---: | ---: |
${typeRows}
`
  );
}

function stressBenchmark(summary) {
  if (!summary) return "";

  const rows = summary.scenarios
    .map((scenario) =>
      [
        ["Classic RAG", scenario.classicRag],
        ["RAG + recency/latest", scenario.recencyRag],
        ["State Memory", scenario.stateMemory]
      ]
        .map(
          ([system, metrics]) =>
            `| ${scenario.name} | ${system} | ${rounded(metrics.exactMatchAccuracy)} | ${rounded(metrics.currentFactAccuracy)} | ${rounded(metrics.staleFactErrorRate)} | ${rounded(metrics.contextHitRate)} |`
        )
        .join("\n")
    )
    .join("\n");

  return section(
    "Stress Benchmark",
    `
| Scenario | System | Exact Match | Current Fact Accuracy | Stale Error | Context Hit |
| --- | --- | ---: | ---: | ---: | ---: |
${rows}

The stress benchmark intentionally weakens ideal assumptions: missing updates, wrong extraction slots and ambiguous similar entities.
`
  );
}

function scalabilityBenchmark(summary) {
  if (!summary) return "";

  const rows = summary.rows
    .map(
      (row) =>
        `| ${row.eventCount} | ${rounded(row.rag.exactMatchAccuracyMean)} +/- ${rounded(row.rag.exactMatchAccuracyStd)} | ${rounded(row.stateMemory.exactMatchAccuracyMean)} +/- ${rounded(row.stateMemory.exactMatchAccuracyStd)} | ${rounded(row.rag.currentFactAccuracyMean)} | ${rounded(row.stateMemory.currentFactAccuracyMean)} | ${rounded(row.rag.averageLatencyMsMean)} | ${rounded(row.stateMemory.averageLatencyMsMean)} |`
    )
    .join("\n");

  return section(
    "Scalability Benchmark",
    `
| Events | RAG Exact Match | State Exact Match | RAG Current Fact | State Current Fact | RAG Latency ms | State Latency ms |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

| System | Exact Match Degradation | Current Fact Degradation |
| --- | ---: | ---: |
| RAG | ${rounded(summary.degradation.ragExactMatch)} | ${rounded(summary.degradation.ragCurrentFact)} |
| State Memory | ${rounded(summary.degradation.stateExactMatch)} | ${rounded(summary.degradation.stateCurrentFact)} |
`
  );
}

function llmBenchmark(summary) {
  if (!summary) return "";

  if (summary.rag && summary.state && summary.hybrid) {
    const types = ["current_state", "stable_state", "document_detail", "unknown"];
    const typeRows = types
      .map((type) => {
        const rag = summary.rag.byType[type]?.normalizedAccuracy ?? 0;
        const state = summary.state.byType[type]?.normalizedAccuracy ?? 0;
        const hybrid = summary.hybrid.byType[type]?.normalizedAccuracy ?? 0;
        return `| ${type} | ${rounded(rag)} | ${rounded(state)} | ${rounded(hybrid)} |`;
      })
      .join("\n");
    const failures = summary.failureExamples ?? [];
    const failureRows =
      failures.length === 0
        ? "No failures in this run."
        : [
            "| System | Type | Error | Expected | Raw Answer |",
            "| --- | --- | --- | --- | --- |",
            ...failures.map(
              (failure) =>
                `| ${tableCell(failure.system)} | ${tableCell(failure.questionType)} | ${tableCell(failure.errorType)} | ${tableCell(failure.expected)} | ${tableCell(failure.rawAnswer)} |`
            )
          ].join("\n");

    return section(
      "Mixed LLM Benchmark",
      `
Model: ${summary.configuration.model}, temperature: ${summary.configuration.temperature}, seed: ${summary.configuration.seed}, timeout: ${summary.configuration.timeoutMs ?? "n/a"} ms, num_predict: ${summary.configuration.numPredict ?? "n/a"}.

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | ${rounded(summary.rag.normalizedAccuracy)} | ${rounded(summary.rag.unknownAccuracy)} | ${rounded(summary.rag.promptComplianceRate)} | ${rounded(summary.rag.hallucinationRate)} | ${rounded(summary.rag.averageContextTokens)} | ${rounded(summary.rag.averageLlmMs)} |
| State + LLM | ${rounded(summary.state.normalizedAccuracy)} | ${rounded(summary.state.unknownAccuracy)} | ${rounded(summary.state.promptComplianceRate)} | ${rounded(summary.state.hallucinationRate)} | ${rounded(summary.state.averageContextTokens)} | ${rounded(summary.state.averageLlmMs)} |
| Hybrid + LLM | ${rounded(summary.hybrid.normalizedAccuracy)} | ${rounded(summary.hybrid.unknownAccuracy)} | ${rounded(summary.hybrid.promptComplianceRate)} | ${rounded(summary.hybrid.hallucinationRate)} | ${rounded(summary.hybrid.averageContextTokens)} | ${rounded(summary.hybrid.averageLlmMs)} |

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
${typeRows}

Top failure examples:

${failureRows}
`
    );
  }

  return section(
    "LLM Benchmark",
    `
Model: ${summary.configuration.model}.

| System | Recall | Precision | Stale Error | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | ${rounded(summary.rag.recallAccuracy)} | ${rounded(summary.rag.precision)} | ${rounded(summary.rag.staleFactErrorRate)} | ${rounded(summary.rag.averageContextTokens)} | ${rounded(summary.rag.averageLatencyMs)} |
| State + LLM | ${rounded(summary.stateMemory.recallAccuracy)} | ${rounded(summary.stateMemory.precision)} | ${rounded(summary.stateMemory.staleFactErrorRate)} | ${rounded(summary.stateMemory.averageContextTokens)} | ${rounded(summary.stateMemory.averageLatencyMs)} |
`
  );
}

export async function generateResultsReport() {
  const main = await readIfExists("results/summary.json");
  const mixed = await readIfExists("results/mixed/summary.json");
  const stress = await readIfExists("results/stress/summary.json");
  const scalability = await readIfExists("results/scalability/summary.json");
  const llm = await readIfExists("results/llm/summary.json");

  const content = [
    "# Results",
    "",
    "This file is generated from `results/**/summary.json` by `npm run results`.",
    "",
    mainBenchmark(main),
    mixedBenchmark(mixed),
    stressBenchmark(stress),
    scalabilityBenchmark(scalability),
    llmBenchmark(llm),
    "## Interpretation",
    "",
    "State Memory is strongest for evolving current state because it stores active and obsolete facts explicitly. RAG remains appropriate for long unstructured documents. The mixed and stress benchmarks show that the practical architecture is hybrid, and that State Memory quality depends on reliable fact extraction and update rules.",
    ""
  ]
    .filter(Boolean)
    .join("\n");

  await writeText(OUT, content);
  return OUT;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = await generateResultsReport();
  console.log(`Generated ${out}`);
}
