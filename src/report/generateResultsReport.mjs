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

function oneDecimal(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  return Number(value).toFixed(1);
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

function subsection(title, body) {
  return [`### ${title}`, "", body.trim(), ""].join("\n");
}

function gain(left, right) {
  return left - right;
}

function speedup(slowerMs, fasterMs) {
  return fasterMs === 0 ? null : slowerMs / fasterMs;
}

function scenarioByName(stress, name) {
  return stress?.scenarios?.find((scenario) => scenario.name === name) ?? null;
}

function lastScalabilityRow(scalability) {
  return scalability?.rows?.at(-1) ?? null;
}

function executiveSummary({ main, mixed, robust, stress, scalability, llm }) {
  if (!main || !mixed || !robust || !stress || !scalability) return "";

  const missingUpdates = scenarioByName(stress, "missing_final_updates");
  const nearConflicts = scenarioByName(stress, "near_simultaneous_conflicts");
  const lastScale = lastScalabilityRow(scalability);
  const scaleSpeedup = speedup(
    lastScale?.rag.averageLatencyMsMean,
    lastScale?.stateMemory.averageLatencyMsMean
  );

  return section(
    "Executive Summary",
    `
1. State Memory solves current-state questions much better than lexical RAG under controlled slot access: ${rounded(main.stateMemory.exactMatchAccuracy)} Exact Match and ${rounded(main.stateMemory.staleFactErrorRate)} Stale Error versus RAG at ${rounded(main.rag.exactMatchAccuracy)} Exact Match and ${rounded(main.rag.staleFactErrorRate)} Stale Error.
2. The deterministic ${rounded(main.stateMemory.exactMatchAccuracy)} score is not an agent-level result. Removing oracle subject/predicate access reduces State Memory to ${rounded(robust.stateNoOracle.exactMatchAccuracy)} Exact Match.
3. Slot inference is the main bottleneck in the robust setup: State no-oracle Exact Match (${rounded(robust.stateNoOracle.exactMatchAccuracy)}) matches slot inference accuracy (${rounded(robust.stateNoOracle.slotInferenceAccuracy)}).
4. RAG remains strong for document-detail questions, while State-only fails on document details. Hybrid reaches ${rounded(mixed.hybrid.exactMatchAccuracy)} Exact Match on mixed structured/document tasks.
5. Defensive State is useful when uncertainty is visible: it recovers near-simultaneous conflicts at ${rounded(nearConflicts?.defensiveStateMemory.exactMatchAccuracy)} Exact Match, but cannot recover missing final updates (${rounded(missingUpdates?.defensiveStateMemory.exactMatchAccuracy)}).
6. State Memory lookup scales with near-constant latency. At ${lastScale?.eventCount} events, RAG averages ${rounded(lastScale?.rag.averageLatencyMsMean)} ms and State Memory averages ${rounded(lastScale?.stateMemory.averageLatencyMsMean)} ms, a ${oneDecimal(scaleSpeedup)}x speedup.
7. The LLM benchmark supports the same conclusion at generation time: Hybrid + LLM reaches ${rounded(llm?.hybrid?.normalizedAccuracy)} normalized accuracy with ${rounded(llm?.hybrid?.hallucinationRate)} hallucination rate.
`
  );
}

function mainFindings({ main, mixed, robust, stress, scalability }) {
  if (!main || !mixed || !robust || !stress || !scalability) return "";

  const conflictScenario = scenarioByName(stress, "near_simultaneous_conflicts");
  const lastScale = lastScalabilityRow(scalability);

  return section(
    "Level 1: Main Findings",
    `
| Finding | Main evidence |
| --- | --- |
| State Memory handles current state | Deterministic: ${rounded(main.stateMemory.exactMatchAccuracy)} vs RAG ${rounded(main.rag.exactMatchAccuracy)} Exact Match |
| Non-oracle benchmark removes overclaim | Robust State no-oracle: ${rounded(robust.stateNoOracle.exactMatchAccuracy)}, not ${rounded(main.stateMemory.exactMatchAccuracy)} |
| Slot inference is bottleneck | Slot inference = ${rounded(robust.stateNoOracle.slotInferenceAccuracy)} |
| Hybrid is best for mixed knowledge | Hybrid = ${rounded(mixed.hybrid.exactMatchAccuracy)} in mixed benchmark |
| Defensive policy helps conflicts | Defensive State = ${rounded(conflictScenario?.defensiveStateMemory.exactMatchAccuracy)} in near-simultaneous conflicts |
| State lookup scales better | ${lastScale?.eventCount} events: State ${rounded(lastScale?.stateMemory.averageLatencyMsMean)} ms vs RAG ${rounded(lastScale?.rag.averageLatencyMsMean)} ms |
`
  );
}

function researchQuestions() {
  return section(
    "Research Questions",
    `
- **RQ1:** Does explicit State Memory reduce stale fact errors compared to RAG?
- **RQ2:** Does the advantage remain when oracle subject/predicate access is removed?
- **RQ3:** Is State Memory sufficient for document-detail questions?
- **RQ4:** How does the approach behave under stress conditions?
- **RQ5:** How does latency scale with event count?
- **RQ6:** Does Hybrid improve LLM-based answering?
`
  );
}

function claims({ main, mixed, robust, stress, scalability, llm }) {
  if (!main || !mixed || !robust || !stress || !scalability) return "";

  const missingUpdates = scenarioByName(stress, "missing_final_updates");
  const lowConfidence = scenarioByName(stress, "low_confidence_final_updates");
  const conflictScenario = scenarioByName(stress, "near_simultaneous_conflicts");
  const lastScale = lastScalabilityRow(scalability);
  const scaleSpeedup = speedup(
    lastScale?.rag.averageLatencyMsMean,
    lastScale?.stateMemory.averageLatencyMsMean
  );

  return section(
    "Claim -> Evidence -> Limitation",
    `
### Claim 1: State Memory is stronger than RAG for evolving current facts

**Evidence.**
In the deterministic memory benchmark, State Memory reaches ${rounded(main.stateMemory.exactMatchAccuracy)} Exact Match and ${rounded(main.stateMemory.staleFactErrorRate)} Stale Error, while RAG reaches ${rounded(main.rag.exactMatchAccuracy)} Exact Match and ${rounded(main.rag.staleFactErrorRate)} Stale Error.

**Interpretation.**
Explicit active/obsolete fact tracking is better suited for evolving facts than lexical retrieval over historical events.

**Limitation.**
This benchmark uses structured subject/predicate access, so it measures memory isolation rather than full natural-language question understanding.

### Claim 2: Removing oracle slot access makes the result more realistic

**Evidence.**
In the robust non-oracle benchmark, State Memory drops from ${rounded(main.stateMemory.exactMatchAccuracy)} deterministic Exact Match to ${rounded(robust.stateNoOracle.exactMatchAccuracy)}. Its slot inference accuracy is also ${rounded(robust.stateNoOracle.slotInferenceAccuracy)}.

**Interpretation.**
The memory store is not the only source of error. Natural-language slot inference becomes the limiting stage.

**Limitation.**
The slot inference module is still lightweight lexical logic, not a trained semantic parser.

### Claim 3: Hybrid memory is the strongest architecture for mixed knowledge

**Evidence.**
On mixed structured state plus document-detail QA, Hybrid reaches ${rounded(mixed.hybrid.exactMatchAccuracy)} Exact Match, compared with RAG-only at ${rounded(mixed.ragOnly.exactMatchAccuracy)} and State-only at ${rounded(mixed.stateOnly.exactMatchAccuracy)}.

**Interpretation.**
Structured current state and long unstructured documents need different memory mechanisms.

**Limitation.**
The document benchmark is synthetic and lexical; it does not yet test noisy real documents or embedding retrieval.

### Claim 4: Defensive State helps visible uncertainty but cannot create missing facts

**Evidence.**
Defensive State recovers near-simultaneous conflicts at ${rounded(conflictScenario?.defensiveStateMemory.exactMatchAccuracy)} Exact Match and marks low-confidence updates with a ${rounded(lowConfidence?.defensiveStateMemory.fallbackRate)} fallback rate. In missing_final_updates, it remains at ${rounded(missingUpdates?.defensiveStateMemory.exactMatchAccuracy)} Exact Match.

**Interpretation.**
Confidence thresholds, conflict tracking and fallback work when uncertainty is represented in state.

**Limitation.**
If the final update is never extracted or stored, state lookup cannot infer it from nowhere.

### Claim 5: State lookup scales better than lexical event retrieval

**Evidence.**
At ${lastScale?.eventCount} events, RAG averages ${rounded(lastScale?.rag.averageLatencyMsMean)} ms and State Memory averages ${rounded(lastScale?.stateMemory.averageLatencyMsMean)} ms, a ${oneDecimal(scaleSpeedup)}x speedup.

**Interpretation.**
The explicit state store avoids scanning and ranking the full event history for every question.

**Limitation.**
These timings are local JavaScript measurements, not a full production database benchmark.

### Claim 6: LLM answering preserves the hybrid advantage

**Evidence.**
Hybrid + LLM reaches ${rounded(llm?.hybrid?.normalizedAccuracy)} normalized accuracy, above RAG + LLM at ${rounded(llm?.rag?.normalizedAccuracy)} and State + LLM at ${rounded(llm?.state?.normalizedAccuracy)}.

**Interpretation.**
The retrieval/state routing decision remains useful even when a generative model produces the final answer.

**Limitation.**
LLM latency dominates runtime and depends on the local model, hardware and Ollama configuration.
`
  );
}

function benchmarkCards({ main, mixed, robust, stress, scalability, llm }) {
  if (!main || !mixed || !robust || !stress || !scalability) return "";

  const missingUpdates = scenarioByName(stress, "missing_final_updates");
  const conflictScenario = scenarioByName(stress, "near_simultaneous_conflicts");
  const lastScale = lastScalabilityRow(scalability);

  return section(
    "Level 2: Benchmark Cards",
    `
### Deterministic Memory Benchmark

**Purpose.**
Tests memory correctness when the system has controlled subject/predicate access.

**Dataset.**
${main.dataset.events} events and ${main.dataset.questions} questions.

**Systems.**
Lexical RAG and State Memory.

**Key result.**
State Memory reaches ${rounded(main.stateMemory.exactMatchAccuracy)} Exact Match and ${rounded(main.stateMemory.staleFactErrorRate)} Stale Error; RAG reaches ${rounded(main.rag.exactMatchAccuracy)} Exact Match and ${rounded(main.rag.staleFactErrorRate)} Stale Error.

**Main limitation.**
This is an oracle-style memory isolation benchmark.

### Robust Question Benchmark

**Purpose.**
Tests whether State Memory remains useful when oracle subject/predicate access is removed.

**Dataset.**
${robust.dataset.events} events and ${robust.dataset.questions} non-oracle questions.

**Question types.**
${robust.dataset.questionTypes.join(", ")}.

**Systems.**
RAG, Temporal RAG and State no-oracle.

**Key result.**
State no-oracle reaches ${rounded(robust.stateNoOracle.exactMatchAccuracy)} Exact Match, compared with Temporal RAG at ${rounded(robust.temporalRag.exactMatchAccuracy)} and RAG at ${rounded(robust.rag.exactMatchAccuracy)}.

**Main failure source.**
Slot inference accuracy is ${rounded(robust.stateNoOracle.slotInferenceAccuracy)}, matching State no-oracle Exact Match.

### Mixed Structured And Document Benchmark

**Purpose.**
Tests whether one memory mechanism can handle both evolving state and long-document detail questions.

**Dataset.**
${mixed.dataset.events} events, ${mixed.dataset.documentPages} document pages and ${mixed.dataset.questions} questions.

**Systems.**
RAG-only, State-only and Hybrid.

**Key result.**
Hybrid reaches ${rounded(mixed.hybrid.exactMatchAccuracy)} Exact Match. State-only reaches ${rounded(mixed.stateOnly.exactMatchAccuracy)} because it cannot answer document-detail questions.

**Main limitation.**
The document corpus is synthetic and should later be replaced or complemented by real long documents.

### Stress Benchmark

**Purpose.**
Tests whether State Memory degrades gracefully when extraction assumptions fail.

**Scenarios.**
clean_extraction, missing_final_updates, wrong_extraction_slot, low_confidence_final_updates, near_simultaneous_conflicts and ambiguous_similar_entities.

**Systems.**
Classic RAG, Temporal RAG, State Memory and Defensive State.

**Key result.**
Defensive State reaches ${rounded(conflictScenario?.defensiveStateMemory.exactMatchAccuracy)} in near-simultaneous conflicts, but missing final updates remain at ${rounded(missingUpdates?.defensiveStateMemory.exactMatchAccuracy)}.

**Main limitation.**
No state policy can recover an update that was never stored without reconciliation against raw events.

### Scalability Benchmark

**Purpose.**
Tests whether latency grows with event count.

**Dataset sizes.**
${scalability.configuration.eventCounts.join(", ")} events across ${scalability.configuration.seedRuns} seeds.

**Key result.**
At ${lastScale?.eventCount} events, State Memory averages ${rounded(lastScale?.stateMemory.averageLatencyMsMean)} ms while RAG averages ${rounded(lastScale?.rag.averageLatencyMsMean)} ms.

**Main limitation.**
This benchmark measures local in-process code rather than networked storage or vector infrastructure.

### Mixed LLM Benchmark

**Purpose.**
Checks whether the memory-routing conclusions survive real local LLM answer generation.

**Model.**
${llm?.configuration?.model ?? "n/a"} with temperature ${llm?.configuration?.temperature ?? "n/a"}.

**Key result.**
Hybrid + LLM reaches ${rounded(llm?.hybrid?.normalizedAccuracy)} normalized accuracy with ${rounded(llm?.hybrid?.hallucinationRate)} hallucination rate.

**Main limitation.**
LLM output introduces formatting and incomplete-answer errors that are separate from memory retrieval.
`
  );
}

function derivedMetrics({ mixed, robust, scalability }) {
  if (!mixed || !robust || !scalability) return "";

  const lastScale = lastScalabilityRow(scalability);

  return section(
    "Derived Metrics",
    `
### Robust Benchmark Deltas

| Comparison | Absolute gain | Relative note |
| --- | ---: | --- |
| State no-oracle vs RAG | ${rounded(gain(robust.stateNoOracle.exactMatchAccuracy, robust.rag.exactMatchAccuracy))} EM | Large non-oracle gap |
| State no-oracle vs Temporal RAG | ${rounded(gain(robust.stateNoOracle.exactMatchAccuracy, robust.temporalRag.exactMatchAccuracy))} EM | State still wins after recency/latest fix |
| State latency vs Temporal RAG | ${oneDecimal(speedup(robust.temporalRag.averageLatencyMs, robust.stateNoOracle.averageLatencyMs))}x faster | ${rounded(robust.stateNoOracle.averageLatencyMs)} ms vs ${rounded(robust.temporalRag.averageLatencyMs)} ms |

### Mixed Benchmark Deltas

| Comparison | Absolute gain | Relative note |
| --- | ---: | --- |
| Hybrid vs RAG-only | ${rounded(gain(mixed.hybrid.exactMatchAccuracy, mixed.ragOnly.exactMatchAccuracy))} EM | Hybrid keeps document RAG while using state for current facts |
| Hybrid vs State-only | ${rounded(gain(mixed.hybrid.exactMatchAccuracy, mixed.stateOnly.exactMatchAccuracy))} EM | State-only cannot answer document details |
| State-only document-detail gap | ${rounded(gain(mixed.byType.hybrid.document_detail.exactMatchAccuracy, mixed.byType.stateOnly.document_detail.exactMatchAccuracy))} EM | Document memory must remain retrieval-based |

### Scalability Speedup

| Events | RAG latency ms | State latency ms | Speedup |
| ---: | ---: | ---: | ---: |
| ${lastScale?.eventCount} | ${rounded(lastScale?.rag.averageLatencyMsMean)} | ${rounded(lastScale?.stateMemory.averageLatencyMsMean)} | ${oneDecimal(speedup(lastScale?.rag.averageLatencyMsMean, lastScale?.stateMemory.averageLatencyMsMean))}x |
`
  );
}

function pipelineBreakdown({ main, mixed, robust, llm }) {
  if (!main || !mixed || !robust) return "";

  return section(
    "Pipeline Breakdown",
    `
| Stage | Metric | Result |
| --- | --- | --- |
| Event generation | deterministic seed | ${main.configuration ? "seeded synthetic events" : "n/a"} |
| Fact extraction | extraction accuracy | Not directly measured; stress tests simulate extraction failures |
| State update | stale rejection | ${rounded(main.stateMemory.obsoleteFactRejectionRate)} obsolete rejection in deterministic benchmark |
| Slot inference | slot accuracy | ${rounded(robust.stateNoOracle.slotInferenceAccuracy)} in robust non-oracle benchmark |
| State selection / retrieval | context hit | ${rounded(robust.stateNoOracle.contextHitRate)} for State no-oracle; ${rounded(robust.temporalRag.contextHitRate)} for Temporal RAG |
| Answering | exact match | ${rounded(robust.stateNoOracle.exactMatchAccuracy)} State no-oracle Exact Match |
| Document retrieval | document-detail accuracy | Hybrid ${rounded(mixed.byType.hybrid.document_detail.exactMatchAccuracy)}; State-only ${rounded(mixed.byType.stateOnly.document_detail.exactMatchAccuracy)} |
| LLM output | hallucination rate | Hybrid + LLM ${rounded(llm?.hybrid?.hallucinationRate)} |

The key diagnostic result is that State Memory degrades primarily at the natural-language slot inference stage, not because explicit active/obsolete state is ineffective.
`
  );
}

function negativeResults({ stress, mixed }) {
  if (!stress || !mixed) return "";

  const missingUpdates = scenarioByName(stress, "missing_final_updates");

  return section(
    "Negative Results",
    `
### State Memory cannot recover facts that were never stored

In the missing_final_updates scenario, State Memory collapses to ${rounded(missingUpdates?.stateMemory.exactMatchAccuracy)} Exact Match and ${rounded(missingUpdates?.stateMemory.currentFactAccuracy)} Current Fact Accuracy.

This is expected: a state-based system cannot infer the final state if the final update is absent from extracted facts. Defensive State also remains at ${rounded(missingUpdates?.defensiveStateMemory.exactMatchAccuracy)} because there is no conflict or low-confidence signal to trigger useful fallback.

### State-only is not a document QA system

In the mixed benchmark, State-only scores ${rounded(mixed.byType.stateOnly.document_detail.exactMatchAccuracy)} on document-detail questions. This is not a failure of state update logic; it shows that arbitrary document details should remain in a retrieval/document memory path.
`
  );
}

function visualizationPlan() {
  return section(
    "Recommended Visualizations",
    `
| Visualization | What it should show | Data source |
| --- | --- | --- |
| Accuracy overview bar chart | RAG, Temporal RAG, State Memory and Hybrid across main benchmarks | summary JSON files |
| Quality vs latency scatter plot | Accuracy/normalized accuracy versus average latency | deterministic, robust, mixed and LLM summaries |
| Scalability line chart | RAG and State latency from 100 to 5000 events | results/scalability/summary.json |
| Robust benchmark heatmap | paraphrase, indirect, noisy and temporal_multi_step by system plus slot inference | results/robust/summary.json |
| Failure taxonomy chart | incomplete_answer, missing_fact, possible_hallucination, stale_fact and slot_inference_failed | LLM result files plus robust summaries |
`
  );
}

function llmErrorTaxonomy(resultSets) {
  const rows = new Map();

  for (const [system, results] of Object.entries(resultSets)) {
    for (const result of results ?? []) {
      const type = result.errorType;
      if (!type || type === "none") continue;

      const row = rows.get(type) ?? { count: 0, systems: new Set() };
      row.count += 1;
      row.systems.add(system);
      rows.set(type, row);
    }
  }

  return rows;
}

function failureTaxonomy({ main, robust, llmResultSets }) {
  const llmRows = llmErrorTaxonomy(llmResultSets);
  const rows = [];

  if (main?.rag?.errorTaxonomy?.stale_fact) {
    rows.push(["stale_fact", main.rag.errorTaxonomy.stale_fact, "RAG", "Deterministic benchmark"]);
  }

  if (robust?.stateNoOracle?.errorTaxonomy?.slot_inference_failed) {
    rows.push([
      "slot_inference_failed",
      robust.stateNoOracle.errorTaxonomy.slot_inference_failed,
      "State no-oracle",
      "Robust benchmark"
    ]);
  }

  for (const [type, row] of llmRows.entries()) {
    rows.push([type, row.count, [...row.systems].join(", "), "Mixed LLM benchmark"]);
  }

  const body = rows
    .map(
      ([type, count, systems, source]) =>
        `| ${tableCell(type)} | ${count} | ${tableCell(systems)} | ${tableCell(source)} |`
    )
    .join("\n");

  return section(
    "Failure Taxonomy",
    `
| Error type | Count | Systems affected | Source |
| --- | ---: | --- | --- |
${body}

The deterministic and robust rows come from aggregate summaries. The LLM rows are counted from full result files, not only from the displayed failure examples.
`
  );
}

function metricDefinitions() {
  return section(
    "Metric Definitions",
    `
- **Exact Match:** answer exactly matches the expected normalized answer.
- **F1:** overlap-style answer quality score used by the deterministic grader.
- **Normalized Accuracy:** LLM answer matches after normalization and minor formatting differences.
- **Current Fact Accuracy:** correctness on questions requiring the latest active fact.
- **Obsolete Rejection:** ability to avoid returning outdated facts.
- **Stale Error:** rate of answers that return obsolete facts as if they were current.
- **Context Hit:** whether the relevant supporting context was retrieved or selected.
- **MRR:** mean reciprocal rank of the first relevant retrieved item.
- **Slot Inference Accuracy:** whether the system inferred the correct subject/predicate from a natural-language question.
- **Fallback Rate:** how often the defensive system refused direct state answering and fell back to temporal RAG.
- **Prompt Compliance:** whether the LLM followed the requested answer format.
- **Hallucination Rate:** rate of LLM answers that introduce unsupported content.
`
  );
}

function mainBenchmark(summary) {
  if (!summary) return "";

  return subsection(
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

  return subsection(
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

function robustBenchmark(summary) {
  if (!summary) return "";

  const typeRows = Object.keys(summary.byType.stateNoOracle)
    .map((type) => {
      const rag = summary.byType.rag[type] ?? {};
      const temporal = summary.byType.temporalRag[type] ?? {};
      const state = summary.byType.stateNoOracle[type] ?? {};
      return `| ${type} | ${rounded(rag.exactMatchAccuracy)} | ${rounded(temporal.exactMatchAccuracy)} | ${rounded(state.exactMatchAccuracy)} | ${rounded(state.slotInferenceAccuracy)} |`;
    })
    .join("\n");
  const domainRows = Object.keys(summary.byDomain.stateNoOracle)
    .map((domain) => {
      const rag = summary.byDomain.rag[domain] ?? {};
      const temporal = summary.byDomain.temporalRag[domain] ?? {};
      const state = summary.byDomain.stateNoOracle[domain] ?? {};
      return `| ${domain} | ${rounded(rag.exactMatchAccuracy)} | ${rounded(temporal.exactMatchAccuracy)} | ${rounded(state.exactMatchAccuracy)} | ${rounded(state.slotInferenceAccuracy)} |`;
    })
    .join("\n");

  return subsection(
    "Robust Question Benchmark",
    `
Dataset: ${summary.dataset.events} events, ${summary.dataset.questions} non-oracle questions.

| System | Exact Match | Current Fact Accuracy | Context Hit | Slot Inference Accuracy | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG | ${rounded(summary.rag.exactMatchAccuracy)} | ${rounded(summary.rag.currentFactAccuracy)} | ${rounded(summary.rag.contextHitRate)} | ${rounded(summary.rag.slotInferenceAccuracy)} | ${rounded(summary.rag.averageContextTokens)} | ${rounded(summary.rag.averageLatencyMs)} |
| Temporal RAG | ${rounded(summary.temporalRag.exactMatchAccuracy)} | ${rounded(summary.temporalRag.currentFactAccuracy)} | ${rounded(summary.temporalRag.contextHitRate)} | ${rounded(summary.temporalRag.slotInferenceAccuracy)} | ${rounded(summary.temporalRag.averageContextTokens)} | ${rounded(summary.temporalRag.averageLatencyMs)} |
| State no-oracle | ${rounded(summary.stateNoOracle.exactMatchAccuracy)} | ${rounded(summary.stateNoOracle.currentFactAccuracy)} | ${rounded(summary.stateNoOracle.contextHitRate)} | ${rounded(summary.stateNoOracle.slotInferenceAccuracy)} | ${rounded(summary.stateNoOracle.averageContextTokens)} | ${rounded(summary.stateNoOracle.averageLatencyMs)} |

| Type | RAG | Temporal RAG | State no-oracle | State slot inference |
| --- | ---: | ---: | ---: | ---: |
${typeRows}

| Domain | RAG | Temporal RAG | State no-oracle | State slot inference |
| --- | ---: | ---: | ---: | ---: |
${domainRows}
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
        ["State Memory", scenario.stateMemory],
        ["Defensive State + fallback", scenario.defensiveStateMemory]
      ]
        .filter(([, metrics]) => metrics)
        .map(
          ([system, metrics]) =>
            `| ${scenario.name} | ${system} | ${rounded(metrics.exactMatchAccuracy)} | ${rounded(metrics.currentFactAccuracy)} | ${rounded(metrics.staleFactErrorRate)} | ${rounded(metrics.contextHitRate)} | ${rounded(metrics.fallbackRate ?? 0)} |`
        )
        .join("\n")
    )
    .join("\n");
  const diagnosticRows = summary.scenarios
    .filter((scenario) => scenario.defensiveStateMemory)
    .map((scenario) => {
      const metrics = scenario.defensiveStateMemory;
      return `| ${scenario.name} | ${metrics.rejectedLowConfidenceFacts} | ${metrics.storedConflicts} | ${metrics.softReplacements} | ${rounded(metrics.lowConfidenceQuestionRate ?? 0)} | ${rounded(metrics.conflictQuestionRate ?? 0)} |`;
    })
    .join("\n");

  return subsection(
    "Stress Benchmark",
    `
| Scenario | System | Exact Match | Current Fact Accuracy | Stale Error | Context Hit | Fallback Rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${rows}

Defensive State diagnostics:

| Scenario | Rejected Low-Confidence Facts | Stored Conflicts | Soft Replacements | Low-Confidence Question Rate | Conflict Question Rate |
| --- | ---: | ---: | ---: | ---: | ---: |
${diagnosticRows}
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

  return subsection(
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

  return subsection(
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

function rawTables(summaries) {
  return section(
    "Level 3: Raw Benchmark Tables",
    [
      mainBenchmark(summaries.main),
      mixedBenchmark(summaries.mixed),
      robustBenchmark(summaries.robust),
      stressBenchmark(summaries.stress),
      scalabilityBenchmark(summaries.scalability),
      llmBenchmark(summaries.llm)
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function finalInterpretation() {
  return section(
    "Interpretation",
    `
The experiments do not show that State Memory is a universal replacement for RAG.
Instead, they show that evolving structured facts and long unstructured documents require different memory mechanisms.

State Memory is strongest when the task depends on current world state.
RAG remains useful for document-detail retrieval.
The hybrid system performs best when both kinds of knowledge are present.
`
  );
}

export async function generateResultsReport() {
  const summaries = {
    main: await readIfExists("results/summary.json"),
    mixed: await readIfExists("results/mixed/summary.json"),
    robust: await readIfExists("results/robust/summary.json"),
    stress: await readIfExists("results/stress/summary.json"),
    scalability: await readIfExists("results/scalability/summary.json"),
    llm: await readIfExists("results/llm/summary.json")
  };
  const llmResultSets = {
    "RAG + LLM": await readIfExists("results/llm/rag-llm-results.json"),
    "State + LLM": await readIfExists("results/llm/state-llm-results.json"),
    "Hybrid + LLM": await readIfExists("results/llm/hybrid-llm-results.json")
  };

  const content = [
    "# Results",
    "",
    "This file is generated from `results/**/summary.json` and LLM result files by `npm run results`.",
    "",
    executiveSummary(summaries),
    mainFindings(summaries),
    researchQuestions(),
    claims(summaries),
    benchmarkCards(summaries),
    derivedMetrics(summaries),
    pipelineBreakdown(summaries),
    negativeResults(summaries),
    failureTaxonomy({ ...summaries, llmResultSets }),
    visualizationPlan(),
    metricDefinitions(),
    rawTables(summaries),
    finalInterpretation()
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
