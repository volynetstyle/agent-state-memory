import { buildDataset } from "../dataset/generateDataset.mjs";
import { writeJson, writeText } from "../shared/io.mjs";
import { tokenCount } from "../shared/text.mjs";
import { buildWorldState } from "../state-memory/worldState.mjs";
import { pairedComparison, summarizeResults } from "../eval/metrics.mjs";
import { evaluateRag, evaluateStateMemory } from "./deterministic.mjs";

function average(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values) {
  if (values.length <= 1) return 0;
  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function rounded(value) {
  return Number(value).toFixed(4);
}

function summarizeAcrossSeeds(rows, system) {
  const values = (metric) => rows.map((row) => row[system][metric]);

  return {
    exactMatchAccuracyMean: average(values("exactMatchAccuracy")),
    exactMatchAccuracyStd: std(values("exactMatchAccuracy")),
    f1ScoreMean: average(values("f1Score")),
    currentFactAccuracyMean: average(values("currentFactAccuracy")),
    obsoleteFactRejectionRateMean: average(values("obsoleteFactRejectionRate")),
    staleFactErrorRateMean: average(values("staleFactErrorRate")),
    contextHitRateMean: average(values("contextHitRate")),
    meanReciprocalRankMean: average(values("meanReciprocalRank")),
    averageContextTokensMean: average(values("averageContextTokens")),
    averageLatencyMsMean: average(values("averageLatencyMs")),
    contextEfficiencyMean: average(values("contextEfficiency")),
    latencyEfficiencyMean: average(values("latencyEfficiency"))
  };
}

function runSingle({ eventCount, seed, ragTopK, stateLimit }) {
  const dataset = buildDataset({ eventCount, seed });
  const worldState = buildWorldState(dataset.events);
  const fullHistoryTokens = tokenCount(dataset.events.map((event) => event.text).join("\n"));
  const ragResults = evaluateRag(dataset.events, dataset.questions, { topK: ragTopK });
  const stateResults = evaluateStateMemory(worldState, dataset.questions, { limit: stateLimit });

  return {
    seed,
    eventCount,
    fullHistoryTokens,
    questions: dataset.questions.length,
    rag: summarizeResults(ragResults),
    stateMemory: summarizeResults(stateResults),
    pairedComparison: pairedComparison(ragResults, stateResults)
  };
}

function buildCsv(rows) {
  const header = [
    "events",
    "seeds",
    "rag_exact_mean",
    "rag_exact_std",
    "state_exact_mean",
    "state_exact_std",
    "rag_f1_mean",
    "state_f1_mean",
    "rag_current_fact_accuracy",
    "state_current_fact_accuracy",
    "rag_obsolete_rejection",
    "state_obsolete_rejection",
    "rag_stale_error",
    "state_stale_error",
    "rag_context_hit",
    "state_context_hit",
    "rag_mrr",
    "state_mrr",
    "rag_avg_context",
    "state_avg_context",
    "rag_avg_latency",
    "state_avg_latency",
    "rag_context_efficiency",
    "state_context_efficiency"
  ];

  const body = rows.map((row) => [
    row.eventCount,
    row.seedRuns,
    rounded(row.rag.exactMatchAccuracyMean),
    rounded(row.rag.exactMatchAccuracyStd),
    rounded(row.stateMemory.exactMatchAccuracyMean),
    rounded(row.stateMemory.exactMatchAccuracyStd),
    rounded(row.rag.f1ScoreMean),
    rounded(row.stateMemory.f1ScoreMean),
    rounded(row.rag.currentFactAccuracyMean),
    rounded(row.stateMemory.currentFactAccuracyMean),
    rounded(row.rag.obsoleteFactRejectionRateMean),
    rounded(row.stateMemory.obsoleteFactRejectionRateMean),
    rounded(row.rag.staleFactErrorRateMean),
    rounded(row.stateMemory.staleFactErrorRateMean),
    rounded(row.rag.contextHitRateMean),
    rounded(row.stateMemory.contextHitRateMean),
    rounded(row.rag.meanReciprocalRankMean),
    rounded(row.stateMemory.meanReciprocalRankMean),
    rounded(row.rag.averageContextTokensMean),
    rounded(row.stateMemory.averageContextTokensMean),
    rounded(row.rag.averageLatencyMsMean),
    rounded(row.stateMemory.averageLatencyMsMean),
    rounded(row.rag.contextEfficiencyMean),
    rounded(row.stateMemory.contextEfficiencyMean)
  ]);

  return `${[header, ...body].map((row) => row.join(",")).join("\n")}\n`;
}

function buildMarkdown(summary) {
  const rows = summary.rows
    .map(
      (row) =>
        `| ${row.eventCount} | ${rounded(row.rag.exactMatchAccuracyMean)} +/- ${rounded(row.rag.exactMatchAccuracyStd)} | ${rounded(row.stateMemory.exactMatchAccuracyMean)} +/- ${rounded(row.stateMemory.exactMatchAccuracyStd)} | ${rounded(row.rag.currentFactAccuracyMean)} | ${rounded(row.stateMemory.currentFactAccuracyMean)} | ${rounded(row.rag.averageContextTokensMean)} | ${rounded(row.stateMemory.averageContextTokensMean)} | ${rounded(row.rag.averageLatencyMsMean)} | ${rounded(row.stateMemory.averageLatencyMsMean)} |`
    )
    .join("\n");

  return `# Scalability Experiment

Event counts: ${summary.configuration.eventCounts.join(", ")}

Seeds per event count: ${summary.configuration.seedRuns}

| Events | RAG Exact Match | State Exact Match | RAG Current Fact | State Current Fact | RAG Context | State Context | RAG Latency ms | State Latency ms |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

Quality degradation from ${summary.degradation.fromEvents} to ${summary.degradation.toEvents} events:

| System | Exact Match Degradation | Current Fact Degradation |
| --- | ---: | ---: |
| RAG | ${rounded(summary.degradation.ragExactMatch)} | ${rounded(summary.degradation.ragCurrentFact)} |
| State Memory | ${rounded(summary.degradation.stateExactMatch)} | ${rounded(summary.degradation.stateCurrentFact)} |
`;
}

export async function runScalabilityExperiment({
  eventCounts = [100, 250, 500, 1000, 2500, 5000],
  seedRuns = 3,
  seedStart = 42,
  ragTopK = 12,
  stateLimit = 8,
  resultsDir = "results/scalability"
} = {}) {
  const rows = [];
  const rawRuns = [];

  for (const eventCount of eventCounts) {
    const perSeed = [];

    for (let offset = 0; offset < seedRuns; offset += 1) {
      const run = runSingle({
        eventCount,
        seed: seedStart + offset,
        ragTopK,
        stateLimit
      });
      perSeed.push(run);
      rawRuns.push(run);
    }

    rows.push({
      eventCount,
      seedRuns,
      questions: perSeed[0]?.questions ?? 0,
      fullHistoryTokensMean: average(perSeed.map((run) => run.fullHistoryTokens)),
      rag: summarizeAcrossSeeds(perSeed, "rag"),
      stateMemory: summarizeAcrossSeeds(perSeed, "stateMemory")
    });
  }

  const first = rows[0];
  const last = rows.at(-1);
  const summary = {
    configuration: {
      eventCounts,
      seedRuns,
      seedStart,
      ragTopK,
      stateLimit
    },
    rows,
    degradation: {
      fromEvents: first.eventCount,
      toEvents: last.eventCount,
      ragExactMatch: first.rag.exactMatchAccuracyMean - last.rag.exactMatchAccuracyMean,
      stateExactMatch:
        first.stateMemory.exactMatchAccuracyMean - last.stateMemory.exactMatchAccuracyMean,
      ragCurrentFact: first.rag.currentFactAccuracyMean - last.rag.currentFactAccuracyMean,
      stateCurrentFact:
        first.stateMemory.currentFactAccuracyMean - last.stateMemory.currentFactAccuracyMean
    }
  };

  await writeJson(`${resultsDir}/raw-runs.json`, rawRuns);
  await writeJson(`${resultsDir}/summary.json`, summary);
  await writeText(`${resultsDir}/scalability.csv`, buildCsv(rows));
  await writeText(`${resultsDir}/summary.md`, buildMarkdown(summary));

  return summary;
}
