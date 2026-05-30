import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootstrapMetricIntervals, mcnemarExactTest } from "../eval/metrics.mjs";
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

function pValue(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  if (value < 0.0001) return "<0.0001";
  return Number(value).toFixed(4);
}

function metricIntervalCell(interval) {
  if (!interval) return "n/a";
  return `${rounded(interval.estimate)} [${rounded(interval.lower)}, ${rounded(interval.upper)}]`;
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

function executiveSummary({ main, mixed, robust, stress, scalability, llm, real, extractor }) {
  if (!main || !mixed || !robust || !stress || !scalability) return "";

  const missingUpdates = scenarioByName(stress, "missing_final_updates");
  const nearConflicts = scenarioByName(stress, "near_simultaneous_conflicts");
  const lastScale = lastScalabilityRow(scalability);
  const scaleSpeedup = speedup(
    lastScale?.rag.averageLatencyMsMean,
    lastScale?.stateMemory.averageLatencyMsMean
  );
  const ruleExtractor = extractor?.extractors?.find((item) => item.key === "rule");

  return section(
    "Executive Summary",
    `
1. The deterministic ${rounded(main.stateMemory.exactMatchAccuracy)} score is an oracle/diagnostic upper-bound result, not the main agent-level claim.
2. The main non-oracle comparison is State Memory versus Temporal RAG: State no-oracle reaches ${rounded(robust.stateNoOracle.exactMatchAccuracy)} Exact Match, while Temporal RAG reaches ${rounded(robust.temporalRag.exactMatchAccuracy)} and naive RAG reaches ${rounded(robust.rag.exactMatchAccuracy)}.
3. The small State-vs-Temporal gap shows that much of the naive-RAG failure comes from missing temporal/latest-fact handling; explicit state still improves accuracy, context hit rate and latency in the robust benchmark.
4. RAG remains strong for document-detail questions, while State-only fails on document details. Hybrid reaches ${rounded(mixed.hybrid.exactMatchAccuracy)} Exact Match on mixed structured/document tasks.
5. Defensive State is useful when uncertainty is visible: it recovers near-simultaneous conflicts at ${rounded(nearConflicts?.defensiveStateMemory.exactMatchAccuracy)} Exact Match, but cannot recover missing final updates (${rounded(missingUpdates?.defensiveStateMemory.exactMatchAccuracy)}).
6. State Memory lookup scales with near-constant latency. At ${lastScale?.eventCount} events, RAG averages ${rounded(lastScale?.rag.averageLatencyMsMean)} ms and State Memory averages ${rounded(lastScale?.stateMemory.averageLatencyMsMean)} ms, a ${oneDecimal(scaleSpeedup)}x speedup.
7. The LLM benchmark supports hybrid routing: Hybrid + LLM reaches ${rounded(llm?.hybrid?.normalizedAccuracy)} normalized accuracy with ${rounded(llm?.hybrid?.hallucinationRate)} hallucination rate.
8. A real project-trace benchmark is included: State Memory reaches ${rounded(real?.stateMemory?.exactMatchAccuracy)} Exact Match, while the LangChain BufferMemory-style baseline reaches ${rounded(real?.langChainBufferMemory?.exactMatchAccuracy)}.
9. The real extractor benchmark shows extraction sensitivity: the rule extractor reaches ${rounded(ruleExtractor?.metrics.extractionRecall)} extraction recall and ${rounded(ruleExtractor?.qa.exactMatchAccuracy)} downstream QA Exact Match.
`
  );
}

function mainFindings({ main, mixed, robust, stress, scalability, real, extractor }) {
  if (!main || !mixed || !robust || !stress || !scalability) return "";

  const conflictScenario = scenarioByName(stress, "near_simultaneous_conflicts");
  const lastScale = lastScalabilityRow(scalability);
  const ruleExtractor = extractor?.extractors?.find((item) => item.key === "rule");

  return section(
    "Level 1: Main Findings",
    `
| Finding | Main evidence |
| --- | --- |
| Oracle benchmark is diagnostic | Controlled slot access gives State ${rounded(main.stateMemory.exactMatchAccuracy)} Exact Match |
| Temporal RAG is the main baseline | Robust State ${rounded(robust.stateNoOracle.exactMatchAccuracy)} vs Temporal RAG ${rounded(robust.temporalRag.exactMatchAccuracy)} |
| Naive RAG is a weak baseline | Robust naive RAG ${rounded(robust.rag.exactMatchAccuracy)} Exact Match |
| Slot inference is bottleneck | Slot inference = ${rounded(robust.stateNoOracle.slotInferenceAccuracy)} |
| Hybrid is best for mixed knowledge | Hybrid = ${rounded(mixed.hybrid.exactMatchAccuracy)} in mixed benchmark |
| Real trace reduces synthetic-only risk | Real project trace: State ${rounded(real?.stateMemory?.exactMatchAccuracy)} vs LangChain BufferMemory-style ${rounded(real?.langChainBufferMemory?.exactMatchAccuracy)} |
| Extraction quality bounds State Memory | Rule extractor recall ${rounded(ruleExtractor?.metrics.extractionRecall)} -> QA ${rounded(ruleExtractor?.qa.exactMatchAccuracy)} |
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
- **RQ2:** Does the advantage remain against Temporal RAG when oracle subject/predicate access is removed?
- **RQ3:** Is State Memory sufficient for document-detail questions?
- **RQ4:** How does the approach behave under stress conditions?
- **RQ5:** How does latency scale with event count?
- **RQ6:** Does Hybrid improve LLM-based answering?
- **RQ7:** Does the approach work on a small real project trace and against an external memory-framework baseline?
- **RQ8:** How does State Memory degrade when real extraction misses facts?
`
  );
}

function claims({ main, mixed, robust, stress, scalability, llm, real, extractor }) {
  if (!main || !mixed || !robust || !stress || !scalability) return "";

  const missingUpdates = scenarioByName(stress, "missing_final_updates");
  const lowConfidence = scenarioByName(stress, "low_confidence_final_updates");
  const conflictScenario = scenarioByName(stress, "near_simultaneous_conflicts");
  const lastScale = lastScalabilityRow(scalability);
  const scaleSpeedup = speedup(
    lastScale?.rag.averageLatencyMsMean,
    lastScale?.stateMemory.averageLatencyMsMean
  );
  const ruleExtractor = extractor?.extractors?.find((item) => item.key === "rule");

  return section(
    "Claim -> Evidence -> Limitation",
    `
### Claim 1: The oracle result is a diagnostic upper bound

**Evidence.**
In the deterministic memory benchmark, State Memory reaches ${rounded(main.stateMemory.exactMatchAccuracy)} Exact Match and ${rounded(main.stateMemory.staleFactErrorRate)} Stale Error, while RAG reaches ${rounded(main.rag.exactMatchAccuracy)} Exact Match and ${rounded(main.rag.staleFactErrorRate)} Stale Error.

**Interpretation.**
With structured subject/predicate access, explicit active/obsolete fact tracking can represent the current state without stale retrieved facts.

**Limitation.**
This is an oracle-style memory-isolation benchmark. It should be treated as an upper-bound diagnostic, not as the headline agent result.

### Claim 2: State Memory remains stronger than Temporal RAG in the main robust benchmark

**Evidence.**
In the robust non-oracle benchmark, State Memory reaches ${rounded(robust.stateNoOracle.exactMatchAccuracy)} Exact Match, compared with Temporal RAG at ${rounded(robust.temporalRag.exactMatchAccuracy)} and naive RAG at ${rounded(robust.rag.exactMatchAccuracy)}.

**Interpretation.**
Naive RAG fails largely because it lacks recency/latest-fact handling. Temporal RAG closes much of that gap, so the remaining State Memory gain is a narrower but more meaningful comparison.

**Limitation.**
The robust benchmark is still synthetic, and the slot inference module is lightweight lexical logic rather than a trained semantic parser.

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
Hybrid + LLM reaches ${rounded(llm?.hybrid?.normalizedAccuracy)} normalized accuracy, compared with RAG + LLM at ${rounded(llm?.rag?.normalizedAccuracy)} and State + LLM at ${rounded(llm?.state?.normalizedAccuracy)}.

**Interpretation.**
The retrieval/state routing decision remains useful even when a generative model produces the final answer.

**Limitation.**
LLM latency dominates runtime and depends on the local model, hardware and Ollama configuration.

### Claim 7: Real-trace validation reduces synthetic-only risk

**Evidence.**
On the real repository-derived project trace, State Memory reaches ${rounded(real?.stateMemory?.exactMatchAccuracy)} Exact Match, compared with the LangChain BufferMemory-style baseline at ${rounded(real?.langChainBufferMemory?.exactMatchAccuracy)}.

**Interpretation.**
Explicit state can retain older but still relevant project facts that fall out of a fixed recent-message buffer.

**Limitation.**
The real trace is small and repository-specific. It should be treated as a validation slice, not as a broad real-world benchmark.

### Claim 8: Extraction quality is a measurable bottleneck

**Evidence.**
In the real extractor benchmark, the rule extractor reaches ${rounded(ruleExtractor?.metrics.extractionPrecision)} precision, ${rounded(ruleExtractor?.metrics.extractionRecall)} recall and ${rounded(ruleExtractor?.qa.exactMatchAccuracy)} downstream QA Exact Match.

**Interpretation.**
State Memory degrades when the extractor misses facts, even when the facts it does extract are precise. This makes extraction recall a visible bottleneck rather than a hidden assumption.

**Limitation.**
The default extractor benchmark runs the deterministic rule extractor for CI. Passing \`--llm-extractor\` adds a real Ollama-backed LLM extractor, but those results depend on the local model.
`
  );
}

function benchmarkCards({ main, mixed, robust, stress, scalability, llm, real, extractor }) {
  if (!main || !mixed || !robust || !stress || !scalability) return "";

  const missingUpdates = scenarioByName(stress, "missing_final_updates");
  const conflictScenario = scenarioByName(stress, "near_simultaneous_conflicts");
  const lastScale = lastScalabilityRow(scalability);

  return section(
    "Level 2: Benchmark Cards",
    `
### Diagnostic Oracle Memory Benchmark

**Purpose.**
Tests memory correctness under controlled subject/predicate access as an upper-bound diagnostic.

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
State no-oracle reaches ${rounded(robust.stateNoOracle.exactMatchAccuracy)} Exact Match, compared with Temporal RAG at ${rounded(robust.temporalRag.exactMatchAccuracy)} and naive RAG at ${rounded(robust.rag.exactMatchAccuracy)}.

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

### Real Project Trace Benchmark

**Purpose.**
Reduces synthetic-only bias by evaluating a real repository-derived event trace.

**Dataset.**
${real?.dataset?.events ?? "n/a"} real project events and ${real?.dataset?.questions ?? "n/a"} questions.

**Systems.**
Temporal RAG, State Memory and LangChain ConversationBufferMemory-style baseline.

**Key result.**
State Memory reaches ${rounded(real?.stateMemory?.exactMatchAccuracy)} Exact Match; LangChain BufferMemory-style reaches ${rounded(real?.langChainBufferMemory?.exactMatchAccuracy)}.

**Main limitation.**
The dataset is intentionally small and should later be expanded with more manually curated real traces.

### Real Extractor Benchmark

**Purpose.**
Tests the full raw-event pipeline: raw event text -> extractor -> State Store -> QA.

**Dataset.**
${extractor?.dataset?.events ?? "n/a"} real project events, ${extractor?.dataset?.goldFacts ?? "n/a"} gold facts and ${extractor?.dataset?.questions ?? "n/a"} downstream questions.

**Systems.**
Curated gold extractor, deterministic rule extractor, and optional Ollama LLM extractor.

**Key result.**
The rule extractor reaches ${rounded(extractor?.extractors?.find((item) => item.key === "rule")?.metrics.extractionRecall)} extraction recall and ${rounded(extractor?.extractors?.find((item) => item.key === "rule")?.qa.exactMatchAccuracy)} downstream QA Exact Match.

**Main limitation.**
The default report does not include LLM extractor rows unless the benchmark is run with \`--llm-extractor\`.
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

function statisticalChecks(resultSets) {
  const confidenceRows = [
    ["Diagnostic oracle", "RAG", resultSets.mainRag],
    ["Diagnostic oracle", "State Memory", resultSets.mainState],
    ["Robust non-oracle", "RAG", resultSets.robustRag],
    ["Robust non-oracle", "Temporal RAG", resultSets.robustTemporalRag],
    ["Robust non-oracle", "State no-oracle", resultSets.robustState],
    ["Mixed", "RAG-only", resultSets.mixedRagOnly],
    ["Mixed", "State-only", resultSets.mixedStateOnly],
    ["Mixed", "Hybrid", resultSets.mixedHybrid],
    ["Real trace", "Temporal RAG", resultSets.realTemporalRag],
    ["Real trace", "State Memory", resultSets.realState],
    ["Real trace", "LangChain BufferMemory-style", resultSets.realLangChain]
  ]
    .filter(([, , results]) => Array.isArray(results))
    .map(([benchmark, system, results]) => {
      const intervals = bootstrapMetricIntervals(results);
      return `| ${benchmark} | ${system} | ${metricIntervalCell(intervals.exactMatchAccuracy)} | ${metricIntervalCell(intervals.f1Score)} |`;
    })
    .join("\n");

  const comparisonRows = [
    [
      "Diagnostic oracle",
      "State Memory vs RAG",
      resultSets.mainRag,
      resultSets.mainState
    ],
    [
      "Robust non-oracle",
      "Temporal RAG vs naive RAG",
      resultSets.robustRag,
      resultSets.robustTemporalRag
    ],
    [
      "Robust non-oracle",
      "State no-oracle vs Temporal RAG",
      resultSets.robustTemporalRag,
      resultSets.robustState
    ],
    ["Mixed", "Hybrid vs RAG-only", resultSets.mixedRagOnly, resultSets.mixedHybrid],
    ["Mixed", "Hybrid vs State-only", resultSets.mixedStateOnly, resultSets.mixedHybrid],
    ["Real trace", "State Memory vs LangChain BufferMemory-style", resultSets.realLangChain, resultSets.realState]
  ]
    .filter(([, , left, right]) => Array.isArray(left) && Array.isArray(right))
    .map(([benchmark, comparison, left, right]) => {
      const test = mcnemarExactTest(left, right);
      const note = test.pValue < 0.05 ? "paired difference detected" : "not significant on this sample";
      return `| ${benchmark} | ${comparison} | ${test.pairedCount} | ${test.rightCorrectLeftWrong} | ${test.leftCorrectRightWrong} | ${pValue(test.pValue)} | ${note} |`;
    })
    .join("\n");

  return section(
    "Statistical Checks",
    `
Bootstrap confidence intervals use 1000 deterministic resamples over question-level results and report 95% intervals for Exact Match and F1. McNemar exact tests use paired exact-match outcomes for systems evaluated on the same question IDs.

| Benchmark | System | Exact Match 95% CI | F1 95% CI |
| --- | --- | ---: | ---: |
${confidenceRows}

| Benchmark | Comparison | Paired N | Candidate-only wins | Baseline-only wins | McNemar p | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
${comparisonRows}

These tests quantify uncertainty on the fixed benchmark samples. They do not remove the synthetic-data and benchmark-design limitations described below.
`
  );
}

function threatsToValidity() {
  return section(
    "Threats To Validity",
    `
- **Synthetic data bias:** the events, facts and questions are generated in a controlled environment. The experiments show behavior under designed temporal-memory conditions, not proven superiority on arbitrary real agent tasks.
- **Oracle access:** the deterministic benchmark uses structured subject/predicate access and is therefore an oracle/diagnostic upper-bound setting. The robust benchmark is the main evidence for non-oracle behavior.
- **Baseline strength:** naive lexical RAG is intentionally weak for temporal updates. Temporal RAG is the primary implemented baseline for current-fact claims, but the project still does not benchmark production vector stores, learned retrievers or full agent frameworks.
- **Extraction assumptions:** the main experiments use clean structured facts. The extractor benchmark measures fact precision, recall, slot accuracy, entity resolution, mutable classification and conflict detection, but the default CI run uses a deterministic rule extractor; LLM extractor scores require a local Ollama run.
- **Limited real-world validation:** the robust benchmark adds semi-realistic calendar, CRM, task, shopping and support-chat domains, and the real-trace benchmark adds repository-derived events. The real trace is still small and should be expanded.
- **Sample size:** question counts are modest, so confidence intervals and McNemar tests should be read as benchmark diagnostics rather than universal population estimates.
`
  );
}

function relatedWorkPositioning() {
  return section(
    "Related Work Positioning",
    `
| Approach | Memory model | Relationship to this project | Status in this coursework |
| --- | --- | --- | --- |
| [LangGraph persistence and stores](https://docs.langchain.com/oss/python/langgraph/persistence) | Thread state checkpoints plus cross-thread stores with optional semantic search | Closest framework-level analogue for persisted graph state and long-term user/application memory | Conceptual comparison; not implemented as a runtime baseline |
| [LangChain memory concepts](https://docs.langchain.com/oss/python/concepts/memory) | Short-term thread state and long-term namespaced memory | Provides the broader agent-memory architecture around which LangGraph state stores are positioned | Implemented as a ConversationBufferMemory-style real-trace baseline |
| [MemGPT](https://arxiv.org/abs/2310.08560) | OS-inspired virtual context management across memory tiers | Related motivation: managing limited context by moving information between active and external memory | Conceptual comparison; no MemGPT runtime baseline |
| [Letta stateful agents](https://docs.letta.com/guides/core-concepts/stateful-agents) and [memory blocks](https://docs.letta.com/guides/core-concepts/memory/memory-blocks) | Persistent editable memory blocks pinned into context plus external memory | Similar emphasis on persistent agent state, but Letta memory blocks are agent-managed text/context units rather than deterministic slot records | Conceptual comparison; no Letta baseline |
| Temporal RAG in this repo | Recency reranking plus latest-fact answering over raw events | Strongest implemented retrieval baseline for temporal updates | Main baseline for robust current-state claims |
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
| Fact extraction | extraction accuracy | Real extractor benchmark reports precision, recall, slot, entity and conflict metrics |
| State update | stale rejection | ${rounded(main.stateMemory.obsoleteFactRejectionRate)} obsolete rejection in the diagnostic oracle benchmark |
| Slot inference | slot accuracy | ${rounded(robust.stateNoOracle.slotInferenceAccuracy)} in robust non-oracle benchmark |
| State selection / retrieval | context hit | ${rounded(robust.stateNoOracle.contextHitRate)} for State no-oracle; ${rounded(robust.temporalRag.contextHitRate)} for Temporal RAG |
| Answering | exact match | ${rounded(robust.stateNoOracle.exactMatchAccuracy)} State no-oracle Exact Match |
| Document retrieval | document-detail accuracy | Hybrid ${rounded(mixed.byType.hybrid.document_detail.exactMatchAccuracy)}; State-only ${rounded(mixed.byType.stateOnly.document_detail.exactMatchAccuracy)} |
| LLM output | hallucination rate | Hybrid + LLM ${rounded(llm?.hybrid?.hallucinationRate)} |
| Real-trace validation | external framework baseline | State Memory vs LangChain BufferMemory-style |

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
| Quality vs latency scatter plot | Accuracy/normalized accuracy versus average latency | diagnostic oracle, robust, mixed and LLM summaries |
| Scalability line chart | RAG and State latency from 100 to 5000 events | results/scalability/summary.json |
| Robust benchmark heatmap | paraphrase, indirect, noisy and temporal_multi_step by system plus slot inference | results/robust/summary.json |
| Real trace comparison | Temporal RAG, State Memory and LangChain BufferMemory-style on repository events | results/real/summary.json |
| Extractor degradation chart | Extraction recall versus downstream State Memory QA | results/extractor/summary.json |
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
    rows.push(["stale_fact", main.rag.errorTaxonomy.stale_fact, "RAG", "Diagnostic oracle benchmark"]);
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

The diagnostic oracle and robust rows come from aggregate summaries. The LLM rows are counted from full result files, not only from the displayed failure examples.
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
- **Extraction Precision:** share of extracted facts that exactly match a gold subject/predicate/object fact.
- **Extraction Recall:** share of gold subject/predicate/object facts recovered by the extractor.
- **Entity Resolution Accuracy:** share of extracted facts whose subject matches a gold entity.
- **Conflict Detection Accuracy:** agreement between predicted and gold mutable-slot replacement events.
- **Fallback Rate:** how often the defensive system refused direct state answering and fell back to temporal RAG.
- **Prompt Compliance:** whether the LLM followed the requested answer format.
- **Hallucination Rate:** rate of LLM answers that introduce unsupported content.
`
  );
}

function mainBenchmark(summary) {
  if (!summary) return "";

  return subsection(
    "Diagnostic Oracle Memory Benchmark",
    `
Dataset: ${summary.dataset.events} events, ${summary.dataset.questions} questions. This benchmark provides controlled subject/predicate access and should be read as an upper-bound memory-isolation diagnostic.

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

function realBenchmark(summary) {
  if (!summary) return "";

  return subsection(
    "Real Project Trace Benchmark",
    `
Dataset: ${summary.dataset.events} real repository-derived events, ${summary.dataset.questions} questions.

Extractor mode: ${summary.extractor.mode}.

| System | Exact Match | F1 | Context Hit | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Temporal RAG | ${rounded(summary.temporalRag.exactMatchAccuracy)} | ${rounded(summary.temporalRag.f1Score)} | ${rounded(summary.temporalRag.contextHitRate)} | ${rounded(summary.temporalRag.averageContextTokens)} | ${rounded(summary.temporalRag.averageLatencyMs)} |
| State Memory | ${rounded(summary.stateMemory.exactMatchAccuracy)} | ${rounded(summary.stateMemory.f1Score)} | ${rounded(summary.stateMemory.contextHitRate)} | ${rounded(summary.stateMemory.averageContextTokens)} | ${rounded(summary.stateMemory.averageLatencyMs)} |
| LangChain BufferMemory-style | ${rounded(summary.langChainBufferMemory.exactMatchAccuracy)} | ${rounded(summary.langChainBufferMemory.f1Score)} | ${rounded(summary.langChainBufferMemory.contextHitRate)} | ${rounded(summary.langChainBufferMemory.averageContextTokens)} | ${rounded(summary.langChainBufferMemory.averageLatencyMs)} |

| Comparison | Candidate-only wins | Baseline-only wins | McNemar p |
| --- | ---: | ---: | ---: |
| State Memory vs LangChain BufferMemory-style | ${summary.stateVsLangChain.rightCorrectLeftWrong} | ${summary.stateVsLangChain.leftCorrectRightWrong} | ${pValue(summary.stateVsLangChain.pValue)} |
`
  );
}

function extractorBenchmark(summary) {
  if (!summary) return "";

  const rows = summary.extractors
    .map(
      (extractor) =>
        `| ${tableCell(extractor.name)} | ${rounded(extractor.metrics.extractionPrecision)} | ${rounded(extractor.metrics.extractionRecall)} | ${rounded(extractor.metrics.extractionF1)} | ${rounded(extractor.metrics.slotAccuracy)} | ${rounded(extractor.metrics.entityResolutionAccuracy)} | ${rounded(extractor.metrics.mutableClassificationAccuracy)} | ${rounded(extractor.metrics.conflictDetectionAccuracy)} | ${rounded(extractor.qa.exactMatchAccuracy)} |`
    )
    .join("\n");

  return subsection(
    "Real Extractor Benchmark",
    `
Dataset: ${summary.dataset.events} raw repository-derived events, ${summary.dataset.goldFacts} gold facts, ${summary.dataset.questions} downstream questions.

| Extractor | Extraction Precision | Extraction Recall | Extraction F1 | Slot Accuracy | Entity Resolution | Mutable Classification | Conflict Detection | Downstream QA EM |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}
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
      llmBenchmark(summaries.llm),
      realBenchmark(summaries.real),
      extractorBenchmark(summaries.extractor)
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
    llm: await readIfExists("results/llm/summary.json"),
    real: await readIfExists("results/real/summary.json"),
    extractor: await readIfExists("results/extractor/summary.json")
  };
  const llmResultSets = {
    "RAG + LLM": await readIfExists("results/llm/rag-llm-results.json"),
    "State + LLM": await readIfExists("results/llm/state-llm-results.json"),
    "Hybrid + LLM": await readIfExists("results/llm/hybrid-llm-results.json")
  };
  const resultSets = {
    mainRag: await readIfExists("results/rag-results.json"),
    mainState: await readIfExists("results/state-results.json"),
    robustRag: await readIfExists("results/robust/rag-results.json"),
    robustTemporalRag: await readIfExists("results/robust/temporal-rag-results.json"),
    robustState: await readIfExists("results/robust/state-no-oracle-results.json"),
    mixedRagOnly: await readIfExists("results/mixed/rag-only-results.json"),
    mixedStateOnly: await readIfExists("results/mixed/state-only-results.json"),
    mixedHybrid: await readIfExists("results/mixed/hybrid-results.json"),
    realTemporalRag: await readIfExists("results/real/temporal-rag-results.json"),
    realState: await readIfExists("results/real/state-memory-results.json"),
    realLangChain: await readIfExists("results/real/langchain-buffer-memory-results.json")
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
    statisticalChecks(resultSets),
    pipelineBreakdown(summaries),
    negativeResults(summaries),
    threatsToValidity(),
    relatedWorkPositioning(),
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
