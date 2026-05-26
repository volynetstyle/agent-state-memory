import { performance } from "node:perf_hooks";
import { readJson, readJsonl, writeJson, writeText } from "../shared/io.mjs";
import { normalize, tokenCount } from "../shared/text.mjs";
import { retrieveEvents } from "../rag/index.mjs";
import { answerFromRetrievedEvents } from "../rag/answer.mjs";
import { answerFromFacts, buildPrompt } from "../state-memory/buildPrompt.mjs";
import { selectRelevantFacts } from "../state-memory/selectState.mjs";
import { buildWorldState } from "../state-memory/worldState.mjs";
import { gradeAnswer, pairedComparison, summarizeResults } from "../eval/metrics.mjs";

function expectedValues(question) {
  return Array.isArray(question.expected) ? question.expected : [question.expected];
}

function sameValue(a, b) {
  return normalize(a) === normalize(b);
}

function questionType(question) {
  return question.obsoleteAnswers.length > 0 ? "current_fact" : "append_fact";
}

function factMatchesSlot(question, fact) {
  return fact.subject === question.subject && fact.predicate === question.predicate;
}

function factMatchesExpected(question, fact) {
  return (
    factMatchesSlot(question, fact) &&
    expectedValues(question).some((expected) => sameValue(fact.object, expected))
  );
}

function factMatchesObsolete(question, fact) {
  return (
    factMatchesSlot(question, fact) &&
    question.obsoleteAnswers.some((obsolete) => sameValue(fact.object, obsolete))
  );
}

function contextMetricsFromFacts(question, rankedFacts) {
  const slotFacts = rankedFacts.filter((fact) => factMatchesSlot(question, fact));
  const contextHasGoldFact = expectedValues(question).every((expected) =>
    slotFacts.some((fact) => sameValue(fact.object, expected))
  );
  const contextHasObsoleteFact = rankedFacts.some((fact) => factMatchesObsolete(question, fact));
  const goldIndex = rankedFacts.findIndex((fact) => factMatchesExpected(question, fact));

  return {
    contextHasGoldFact,
    contextHasObsoleteFact,
    goldRank: goldIndex >= 0 ? goldIndex + 1 : null,
    reciprocalRank: goldIndex >= 0 ? 1 / (goldIndex + 1) : 0
  };
}

function contextMetricsFromEvents(question, rankedEvents) {
  const rankedEventFacts = rankedEvents.flatMap((event) => event.facts);
  const contextHasGoldFact = expectedValues(question).every((expected) =>
    rankedEventFacts.some((fact) => factMatchesSlot(question, fact) && sameValue(fact.object, expected))
  );
  const contextHasObsoleteFact = rankedEventFacts.some((fact) => factMatchesObsolete(question, fact));
  const goldIndex = rankedEvents.findIndex((event) =>
    event.facts.some((fact) => factMatchesExpected(question, fact))
  );

  return {
    contextHasGoldFact,
    contextHasObsoleteFact,
    goldRank: goldIndex >= 0 ? goldIndex + 1 : null,
    reciprocalRank: goldIndex >= 0 ? 1 / (goldIndex + 1) : 0
  };
}

function classifyError(grade, contextMetrics) {
  if (grade.correct) return "none";
  if (grade.staleFactError) return "stale_fact";
  if (!contextMetrics.contextHasGoldFact) return "missing_fact";
  if (!grade.answered) return "unknown_failed";
  return "answer_mismatch";
}

export function evaluateRag(events, questions, options) {
  return questions.map((question) => {
    const start = performance.now();
    const retrievedEvents = retrieveEvents(events, question.question, options);
    const answer = answerFromRetrievedEvents(question, retrievedEvents);
    const latencyMs = performance.now() - start;
    const grade = gradeAnswer(question, answer);
    const contextMetrics = contextMetricsFromEvents(question, retrievedEvents);
    const context = retrievedEvents.map((event) => event.text).join("\n");

    return {
      questionId: question.id,
      questionType: questionType(question),
      question: question.question,
      expected: question.expected,
      answer: answer.answer,
      answerValues: answer.values,
      retrievedEventIds: retrievedEvents.map((event) => event.id),
      contextTokens: tokenCount(context),
      latencyMs,
      ...contextMetrics,
      errorType: classifyError(grade, contextMetrics),
      ...grade
    };
  });
}

export function evaluateStateMemory(worldState, questions, options) {
  return questions.map((question) => {
    const start = performance.now();
    const facts = selectRelevantFacts(worldState, question, options);
    const prompt = buildPrompt(question, facts);
    const answer = answerFromFacts(question, facts);
    const latencyMs = performance.now() - start;
    const grade = gradeAnswer(question, answer);
    const contextMetrics = contextMetricsFromFacts(question, facts);

    return {
      questionId: question.id,
      questionType: questionType(question),
      question: question.question,
      expected: question.expected,
      answer: answer.answer,
      answerValues: answer.values,
      selectedFactIds: facts.map((fact) => fact.id),
      contextTokens: tokenCount(prompt),
      latencyMs,
      ...contextMetrics,
      errorType: classifyError(grade, contextMetrics),
      ...grade
    };
  });
}

function rounded(value) {
  return Number(value).toFixed(4);
}

function buildMetricsCsv(summary) {
  const rows = [
    [
      "system",
      "exact_match_accuracy",
      "recall",
      "precision",
      "f1",
      "current_fact_accuracy",
      "obsolete_rejection_rate",
      "stale_fact_error_rate",
      "context_hit_rate",
      "mrr",
      "avg_context_tokens",
      "avg_latency_ms",
      "context_efficiency",
      "latency_efficiency",
      "compression_ratio"
    ],
    [
      "RAG",
      rounded(summary.rag.exactMatchAccuracy),
      rounded(summary.rag.recallAccuracy),
      rounded(summary.rag.precision),
      rounded(summary.rag.f1Score),
      rounded(summary.rag.currentFactAccuracy),
      rounded(summary.rag.obsoleteFactRejectionRate),
      rounded(summary.rag.staleFactErrorRate),
      rounded(summary.rag.contextHitRate),
      rounded(summary.rag.meanReciprocalRank),
      rounded(summary.rag.averageContextTokens),
      rounded(summary.rag.averageLatencyMs),
      rounded(summary.rag.contextEfficiency),
      rounded(summary.rag.latencyEfficiency),
      rounded(summary.rag.contextCompressionRatio)
    ],
    [
      "State Memory",
      rounded(summary.stateMemory.exactMatchAccuracy),
      rounded(summary.stateMemory.recallAccuracy),
      rounded(summary.stateMemory.precision),
      rounded(summary.stateMemory.f1Score),
      rounded(summary.stateMemory.currentFactAccuracy),
      rounded(summary.stateMemory.obsoleteFactRejectionRate),
      rounded(summary.stateMemory.staleFactErrorRate),
      rounded(summary.stateMemory.contextHitRate),
      rounded(summary.stateMemory.meanReciprocalRank),
      rounded(summary.stateMemory.averageContextTokens),
      rounded(summary.stateMemory.averageLatencyMs),
      rounded(summary.stateMemory.contextEfficiency),
      rounded(summary.stateMemory.latencyEfficiency),
      rounded(summary.stateMemory.contextCompressionRatio)
    ]
  ];

  return `${rows.map((row) => row.join(",")).join("\n")}\n`;
}

function buildSummaryMarkdown(summary) {
  return `# Experiment Summary

Dataset: ${summary.dataset.events} events, ${summary.dataset.questions} questions, ${summary.dataset.fullHistoryTokens} approximate full-history tokens.

| System | Exact Match | F1 | Current Fact Accuracy | Obsolete Rejection | Stale Error | Context Hit | MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG | ${rounded(summary.rag.exactMatchAccuracy)} | ${rounded(summary.rag.f1Score)} | ${rounded(summary.rag.currentFactAccuracy)} | ${rounded(summary.rag.obsoleteFactRejectionRate)} | ${rounded(summary.rag.staleFactErrorRate)} | ${rounded(summary.rag.contextHitRate)} | ${rounded(summary.rag.meanReciprocalRank)} |
| State Memory | ${rounded(summary.stateMemory.exactMatchAccuracy)} | ${rounded(summary.stateMemory.f1Score)} | ${rounded(summary.stateMemory.currentFactAccuracy)} | ${rounded(summary.stateMemory.obsoleteFactRejectionRate)} | ${rounded(summary.stateMemory.staleFactErrorRate)} | ${rounded(summary.stateMemory.contextHitRate)} | ${rounded(summary.stateMemory.meanReciprocalRank)} |

| System | Avg Context Tokens | Avg Latency ms | Context Efficiency | Latency Efficiency | Compression Ratio |
| --- | ---: | ---: | ---: | ---: | ---: |
| RAG | ${rounded(summary.rag.averageContextTokens)} | ${rounded(summary.rag.averageLatencyMs)} | ${rounded(summary.rag.contextEfficiency)} | ${rounded(summary.rag.latencyEfficiency)} | ${rounded(summary.rag.contextCompressionRatio)} |
| State Memory | ${rounded(summary.stateMemory.averageContextTokens)} | ${rounded(summary.stateMemory.averageLatencyMs)} | ${rounded(summary.stateMemory.contextEfficiency)} | ${rounded(summary.stateMemory.latencyEfficiency)} | ${rounded(summary.stateMemory.contextCompressionRatio)} |

Paired comparison:

| Case | Count |
| --- | ---: |
| Both correct | ${summary.pairedComparison.bothCorrect} |
| State correct, RAG wrong | ${summary.pairedComparison.rightCorrectLeftWrong} |
| RAG correct, State wrong | ${summary.pairedComparison.leftCorrectRightWrong} |
| Both wrong | ${summary.pairedComparison.bothWrong} |

Interpretation: State Memory keeps mutable facts as explicit active/obsolete state, so current-fact questions avoid stale answers in this synthetic benchmark. RAG retrieves raw historical event chunks and can surface old versions of mutable facts.
`;
}

export async function runExperiment({
  eventsPath = "data/events.jsonl",
  questionsPath = "data/questions.json",
  resultsDir = "results",
  ragTopK = 12,
  stateLimit = 8
} = {}) {
  const events = await readJsonl(eventsPath);
  const questions = await readJson(questionsPath);
  const worldState = buildWorldState(events);

  const fullHistoryTokens = tokenCount(events.map((event) => event.text).join("\n"));
  const ragResults = evaluateRag(events, questions, { topK: ragTopK });
  const stateResults = evaluateStateMemory(worldState, questions, { limit: stateLimit });

  const summary = {
    dataset: {
      events: events.length,
      questions: questions.length,
      activeFacts: worldState.facts.filter((fact) => fact.status === "active").length,
      obsoleteFacts: worldState.facts.filter((fact) => fact.status === "obsolete").length,
      fullHistoryTokens
    },
    configuration: {
      ragTopK,
      stateLimit
    },
    rag: summarizeResults(ragResults),
    stateMemory: summarizeResults(stateResults),
    pairedComparison: pairedComparison(ragResults, stateResults)
  };

  summary.rag.contextCompressionRatio =
    fullHistoryTokens / Math.max(1, summary.rag.averageContextTokens);
  summary.stateMemory.contextCompressionRatio =
    fullHistoryTokens / Math.max(1, summary.stateMemory.averageContextTokens);

  await writeJson(`${resultsDir}/rag-results.json`, ragResults);
  await writeJson(`${resultsDir}/state-results.json`, stateResults);
  await writeJson(`${resultsDir}/summary.json`, summary);
  await writeJson(`${resultsDir}/world-state.json`, worldState);
  await writeText(`${resultsDir}/summary.md`, buildSummaryMarkdown(summary));
  await writeText(`${resultsDir}/charts/metrics.csv`, buildMetricsCsv(summary));

  return summary;
}
