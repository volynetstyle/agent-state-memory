import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateResultsReport } from "../src/report/generateResultsReport.mjs";
import { readJson } from "../src/shared/io.mjs";

const REQUIRED_REPORT_SECTIONS = [
  "## Executive Summary",
  "## Level 1: Main Findings",
  "## Research Questions",
  "## Claim -> Evidence -> Limitation",
  "## Level 2: Benchmark Cards",
  "## Derived Metrics",
  "## Statistical Checks",
  "## Model Comparison",
  "## Pipeline Breakdown",
  "## Negative Results",
  "## Threats To Validity",
  "## Related Work Positioning",
  "## Failure Taxonomy",
  "## Recommended Visualizations",
  "## Metric Definitions",
  "## Level 3: Raw Benchmark Tables"
];

function approximately(actual, expected, message, epsilon = 0.00005) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${message}: expected ${expected}, got ${actual}`
  );
}

function assertRate(value, label) {
  assert.equal(typeof value, "number", `${label} must be numeric`);
  assert.ok(value >= 0 && value <= 1, `${label} must be in [0, 1], got ${value}`);
}

function assertSummaryRates(system, label) {
  for (const key of [
    "exactMatchAccuracy",
    "currentFactAccuracy",
    "staleFactErrorRate",
    "contextHitRate",
    "meanReciprocalRank"
  ]) {
    if (key in system) assertRate(system[key], `${label}.${key}`);
  }
}

function assertReportContains(content, needle) {
  assert.ok(content.includes(needle), `RESULTS.md must contain: ${needle}`);
}

function oneDecimal(value) {
  return Number(value).toFixed(1);
}

const main = await readJson("results/summary.json");
const mixed = await readJson("results/mixed/summary.json");
const robust = await readJson("results/robust/summary.json");
const stress = await readJson("results/stress/summary.json");
const scalability = await readJson("results/scalability/summary.json");
const llm = await readJson("results/llm/summary.json");
const real = await readJson("results/real/summary.json");
const extractor = await readJson("results/extractor/summary.json");
const llmResultSets = {
  rag: await readJson("results/llm/rag-llm-results.json"),
  state: await readJson("results/llm/state-llm-results.json"),
  hybrid: await readJson("results/llm/hybrid-llm-results.json")
};

assert.equal(main.dataset.events, 1000, "deterministic dataset event count");
assert.equal(main.dataset.questions, 42, "deterministic dataset question count");
assertSummaryRates(main.rag, "main.rag");
assertSummaryRates(main.stateMemory, "main.stateMemory");
approximately(main.stateMemory.exactMatchAccuracy, 1, "State Memory deterministic EM");
approximately(main.stateMemory.staleFactErrorRate, 0, "State Memory deterministic stale rate");
assert.ok(
  main.stateMemory.exactMatchAccuracy > main.rag.exactMatchAccuracy,
  "State Memory must outperform lexical RAG in deterministic benchmark"
);

assert.equal(mixed.dataset.documentPages, 100, "mixed document page count");
assert.equal(mixed.dataset.questions, 102, "mixed question count");
approximately(mixed.byType.ragOnly.document_detail.exactMatchAccuracy, 1, "RAG document detail");
approximately(mixed.byType.stateOnly.document_detail.exactMatchAccuracy, 0, "State-only document detail");
approximately(mixed.hybrid.exactMatchAccuracy, 1, "Hybrid mixed EM");

assert.equal(robust.dataset.questions, 52, "robust question count");
assertSummaryRates(robust.rag, "robust.rag");
assertSummaryRates(robust.temporalRag, "robust.temporalRag");
assertSummaryRates(robust.stateNoOracle, "robust.stateNoOracle");
approximately(
  robust.stateNoOracle.exactMatchAccuracy,
  robust.stateNoOracle.slotInferenceAccuracy,
  "State no-oracle EM should equal slot inference accuracy"
);
assert.ok(
  robust.stateNoOracle.exactMatchAccuracy > robust.temporalRag.exactMatchAccuracy,
  "State no-oracle must outperform Temporal RAG in robust benchmark"
);

const missingUpdates = stress.scenarios.find((scenario) => scenario.name === "missing_final_updates");
const conflicts = stress.scenarios.find((scenario) => scenario.name === "near_simultaneous_conflicts");
assert.ok(missingUpdates, "stress missing_final_updates scenario must exist");
assert.ok(conflicts, "stress near_simultaneous_conflicts scenario must exist");
approximately(missingUpdates.stateMemory.currentFactAccuracy, 0, "missing final updates current accuracy");
approximately(conflicts.defensiveStateMemory.exactMatchAccuracy, 1, "defensive conflict recovery");
assert.ok(
  conflicts.defensiveStateMemory.fallbackRate > 0,
  "defensive conflict scenario must trigger fallback"
);

const lastScale = scalability.rows.at(-1);
const lastScaleSpeedup = lastScale.rag.averageLatencyMsMean / lastScale.stateMemory.averageLatencyMsMean;
assert.equal(lastScale.eventCount, 5000, "largest scalability event count");
assert.ok(
  lastScale.rag.averageLatencyMsMean > lastScale.stateMemory.averageLatencyMsMean,
  "RAG latency must exceed State latency at the largest scale"
);
assert.ok(
  lastScale.rag.averageLatencyMsMean / lastScale.stateMemory.averageLatencyMsMean > 20,
  "largest-scale State speedup must be greater than 20x"
);

assertRate(llm.hybrid.normalizedAccuracy, "llm.hybrid.normalizedAccuracy");
assertRate(llm.hybrid.hallucinationRate, "llm.hybrid.hallucinationRate");
assert.equal(llmResultSets.rag.length, llm.rag.totalQuestions, "RAG LLM result count");
assert.equal(llmResultSets.state.length, llm.state.totalQuestions, "State LLM result count");
assert.equal(llmResultSets.hybrid.length, llm.hybrid.totalQuestions, "Hybrid LLM result count");
assert.equal(
  llm.rag.totalQuestions,
  llm.state.totalQuestions,
  "RAG and State LLM totals must match"
);
assert.equal(
  llm.state.totalQuestions,
  llm.hybrid.totalQuestions,
  "State and Hybrid LLM totals must match"
);
for (const [system, results] of Object.entries(llmResultSets)) {
  for (const result of results) {
    assert.equal(typeof result.questionId, "string", `${system} result questionId`);
    assert.equal(typeof result.errorType, "string", `${system} result errorType`);
    assertRate(Number(result.normalizedMatch), `${system}.${result.questionId}.normalizedMatch`);
    assert.ok(
      Array.isArray(result.contextIds),
      `${system}.${result.questionId}.contextIds must be an array`
    );
  }
}
assert.ok(
  llm.hybrid.normalizedAccuracy > llm.state.normalizedAccuracy,
  "Hybrid + LLM must outperform State + LLM on normalized accuracy"
);

assert.equal(real.dataset.events, 12, "real trace event count");
assert.equal(real.dataset.questions, 8, "real trace question count");
approximately(real.stateMemory.exactMatchAccuracy, 1, "real trace State EM");
assert.ok(
  real.stateMemory.exactMatchAccuracy >= real.langChainBufferMemory.exactMatchAccuracy,
  "State Memory should match or outperform LangChain BufferMemory-style on real trace"
);

const goldExtractor = extractor.extractors.find((item) => item.key === "gold");
const ruleExtractor = extractor.extractors.find((item) => item.key === "rule");
assert.equal(extractor.dataset.events, 12, "extractor event count");
assert.equal(extractor.dataset.goldFacts, 21, "extractor gold fact count");
approximately(goldExtractor.metrics.extractionRecall, 1, "gold extractor recall");
approximately(goldExtractor.qa.exactMatchAccuracy, 1, "gold extractor downstream QA");
assert.ok(ruleExtractor.metrics.extractionRecall < 1, "rule extractor should miss some facts");
assert.ok(ruleExtractor.qa.exactMatchAccuracy < 1, "rule extractor misses should affect QA");

const beforeReport = await readFile("RESULTS.md", "utf8");
await generateResultsReport();
const afterReport = await readFile("RESULTS.md", "utf8");
assert.equal(afterReport, beforeReport, "RESULTS.md must be reproducible from results JSON");

for (const section of REQUIRED_REPORT_SECTIONS) {
  assertReportContains(afterReport, section);
}

assertReportContains(afterReport, `${oneDecimal(lastScaleSpeedup)}x speedup`);
assertReportContains(afterReport, "State Memory cannot recover facts that were never stored");
assertReportContains(afterReport, "Real Project Trace Benchmark");
assertReportContains(afterReport, "Real Extractor Benchmark");
assertReportContains(afterReport, "results/models/<safe_model>/");
assertReportContains(afterReport, "Hybrid LLM Acc");
assertReportContains(afterReport, "Extraction Precision");
assertReportContains(afterReport, "LangChain BufferMemory-style");
assertReportContains(afterReport, "The experiments do not show that State Memory is a universal replacement for RAG.");

console.log("Result verification passed.");
