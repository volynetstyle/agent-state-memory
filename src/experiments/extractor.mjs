import { performance } from "node:perf_hooks";
import { gradeAnswer, summarizeResults } from "../eval/metrics.mjs";
import { readJson, readJsonl, writeJson, writeText } from "../shared/io.mjs";
import { normalize, tokenCount } from "../shared/text.mjs";
import { answerFromFacts, buildPrompt } from "../state-memory/buildPrompt.mjs";
import { extractEventsWithLlm } from "../state-memory/llmExtractor.mjs";
import { extractEventsWithRules } from "../state-memory/ruleExtractor.mjs";
import { selectRelevantFacts } from "../state-memory/selectState.mjs";
import { buildWorldState } from "../state-memory/worldState.mjs";

function factKey(fact) {
  return [fact.subject, fact.predicate, fact.object].map((value) => normalize(value)).join("\u0001");
}

function slotKey(fact) {
  return [fact.subject, fact.predicate].map((value) => normalize(value)).join("\u0001");
}

function subjectKey(fact) {
  return normalize(fact.subject);
}

function safeRate(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function countMatching(predicted, gold, keyFn) {
  const remaining = new Map();

  for (const fact of gold) {
    const key = keyFn(fact);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  let matches = 0;
  for (const fact of predicted) {
    const key = keyFn(fact);
    const count = remaining.get(key) ?? 0;
    if (count === 0) continue;
    matches += 1;
    remaining.set(key, count - 1);
  }

  return matches;
}

function exactMatchedPairs(predicted, gold) {
  const remaining = new Map();

  for (const fact of gold) {
    const key = factKey(fact);
    const facts = remaining.get(key) ?? [];
    facts.push(fact);
    remaining.set(key, facts);
  }

  const pairs = [];
  for (const fact of predicted) {
    const key = factKey(fact);
    const facts = remaining.get(key) ?? [];
    const match = facts.shift();
    if (match) pairs.push([fact, match]);
  }

  return pairs;
}

function factsFromEvents(events) {
  return events.flatMap((event) => event.facts ?? []);
}

function conflictKeys(events) {
  const active = new Map();
  const conflicts = new Set();
  const sortedEvents = [...events].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  );

  for (const event of sortedEvents) {
    for (const fact of event.facts ?? []) {
      if (!fact.mutable) continue;
      const slot = slotKey(fact);
      const previous = active.get(slot);
      if (previous && normalize(previous.object) !== normalize(fact.object)) {
        conflicts.add(`${event.id}\u0001${slot}`);
      }
      active.set(slot, fact);
    }
  }

  return conflicts;
}

function extractionMetrics(predictedEvents, goldEvents) {
  const predictedFacts = factsFromEvents(predictedEvents);
  const goldFacts = factsFromEvents(goldEvents);
  const exactMatches = countMatching(predictedFacts, goldFacts, factKey);
  const slotMatches = countMatching(predictedFacts, goldFacts, slotKey);
  const entityMatches = countMatching(predictedFacts, goldFacts, subjectKey);
  const mutablePairs = exactMatchedPairs(predictedFacts, goldFacts);
  const mutableMatches = mutablePairs.filter(
    ([predicted, gold]) => Boolean(predicted.mutable) === Boolean(gold.mutable)
  ).length;
  const predictedConflicts = conflictKeys(predictedEvents);
  const goldConflicts = conflictKeys(goldEvents);
  const conflictMatches = [...predictedConflicts].filter((key) => goldConflicts.has(key)).length;
  const conflictUniverse = new Set([...predictedConflicts, ...goldConflicts]);

  return {
    goldFacts: goldFacts.length,
    predictedFacts: predictedFacts.length,
    exactMatches,
    extractionPrecision: safeRate(exactMatches, predictedFacts.length),
    extractionRecall: safeRate(exactMatches, goldFacts.length),
    extractionF1:
      exactMatches === 0
        ? 0
        : (2 * exactMatches) / Math.max(1, predictedFacts.length + goldFacts.length),
    slotAccuracy: safeRate(slotMatches, predictedFacts.length),
    entityResolutionAccuracy: safeRate(entityMatches, predictedFacts.length),
    mutableClassificationAccuracy: safeRate(mutableMatches, mutablePairs.length),
    goldConflicts: goldConflicts.size,
    predictedConflicts: predictedConflicts.size,
    conflictDetectionPrecision: safeRate(conflictMatches, predictedConflicts.size),
    conflictDetectionRecall: safeRate(conflictMatches, goldConflicts.size),
    conflictDetectionAccuracy:
      conflictUniverse.size === 0
        ? 1
        : safeRate(conflictMatches, conflictUniverse.size)
  };
}

function expectedValues(question) {
  return Array.isArray(question.expected) ? question.expected : [question.expected];
}

function contextMetricsFromFacts(question, facts) {
  const contextHasGoldFact = expectedValues(question).every((expected) =>
    facts.some(
      (fact) =>
        fact.subject === question.subject &&
        fact.predicate === question.predicate &&
        fact.object === expected
    )
  );
  const goldIndex = facts.findIndex(
    (fact) =>
      fact.subject === question.subject &&
      fact.predicate === question.predicate &&
      expectedValues(question).includes(fact.object)
  );

  return {
    contextHasGoldFact,
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

function evaluateStateQa(events, questions, { stateLimit }) {
  const worldState = buildWorldState(events);

  return questions.map((question) => {
    const start = performance.now();
    const facts = selectRelevantFacts(worldState, question, { limit: stateLimit });
    const prompt = buildPrompt(question, facts);
    const answer = answerFromFacts(question, facts);
    const latencyMs = performance.now() - start;
    const contextMetrics = contextMetricsFromFacts(question, facts);
    const grade = gradeAnswer(question, answer);

    return {
      system: "state_memory",
      questionId: question.id,
      questionType: question.obsoleteAnswers.length > 0 ? "current_fact" : "stable_fact",
      question: question.question,
      expected: question.expected,
      answer: answer.answer,
      answerValues: answer.values,
      contextIds: facts.map((fact) => fact.id),
      contextTokens: tokenCount(prompt),
      latencyMs,
      ...contextMetrics,
      errorType: classifyError(grade, contextMetrics),
      ...grade
    };
  });
}

function stripFacts(events) {
  return events.map(({ facts, ...event }) => event);
}

function cloneEvents(events) {
  return JSON.parse(JSON.stringify(events));
}

function normalizeGoldEvents(events) {
  return cloneEvents(events).map((event) => ({
    ...event,
    facts: (event.facts ?? []).map((fact, index) => ({
      id: `${event.id}-gold-f${index + 1}`,
      ...fact,
      sourceEventId: event.id,
      validFrom: event.timestamp,
      status: "active"
    }))
  }));
}

async function buildExtractorRuns(goldEvents, { includeLlmExtractor, ollama }) {
  const rawEvents = stripFacts(goldEvents);
  const runs = [
    {
      name: "Gold annotations",
      key: "gold",
      extractor: { mode: "curated-gold", llmEnabled: false },
      events: normalizeGoldEvents(goldEvents)
    },
    {
      name: "Rule extractor",
      key: "rule",
      extractor: { mode: "rule-extractor", llmEnabled: false },
      events: extractEventsWithRules(rawEvents)
    }
  ];

  if (includeLlmExtractor) {
    runs.push({
      name: `LLM extractor (${ollama.model ?? "ollama"})`,
      key: "llm",
      extractor: {
        mode: "ollama-llm-extractor",
        llmEnabled: true,
        model: ollama.model
      },
      events: await extractEventsWithLlm(rawEvents, ollama)
    });
  }

  return runs;
}

function rounded(value) {
  return Number(value ?? 0).toFixed(4);
}

function metricRow(run) {
  return `| ${run.name} | ${rounded(run.metrics.extractionPrecision)} | ${rounded(run.metrics.extractionRecall)} | ${rounded(run.metrics.extractionF1)} | ${rounded(run.metrics.slotAccuracy)} | ${rounded(run.metrics.entityResolutionAccuracy)} | ${rounded(run.metrics.mutableClassificationAccuracy)} | ${rounded(run.metrics.conflictDetectionAccuracy)} | ${run.parseErrorEvents ?? 0} | ${rounded(run.qa.exactMatchAccuracy)} |`;
}

function buildMarkdown(summary) {
  const rows = summary.extractors.map(metricRow).join("\n");

  return `# Real Extractor Benchmark

This benchmark evaluates the full raw-event pipeline: raw event text -> extractor -> State Store -> QA.

| Extractor | Extraction Precision | Extraction Recall | Extraction F1 | Slot Accuracy | Entity Resolution | Mutable Classification | Conflict Detection | Parse-error Events | Downstream QA EM |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

Interpretation: the gold extractor is the clean-extraction upper bound. The rule extractor shows how State Memory degrades when extraction misses facts. Passing \`--llm-extractor\` adds a real Ollama-backed LLM extractor to the same benchmark.
`;
}

export async function runExtractorBenchmark({
  eventsPath = "data/real/events.jsonl",
  questionsPath = "data/real/questions.json",
  resultsDir = "results/extractor",
  stateLimit = 6,
  includeLlmExtractor = process.argv.includes("--llm-extractor"),
  ollama = {}
} = {}) {
  const goldEvents = await readJsonl(eventsPath);
  const questions = await readJson(questionsPath);
  const goldNormalizedEvents = normalizeGoldEvents(goldEvents);
  const runs = await buildExtractorRuns(goldEvents, { includeLlmExtractor, ollama });
  const extractors = [];

  for (const run of runs) {
    const qaResults = evaluateStateQa(run.events, questions, { stateLimit });
    const summary = {
      name: run.name,
      key: run.key,
      extractor: run.extractor,
      metrics: extractionMetrics(run.events, goldNormalizedEvents),
      parseErrorEvents: run.events.filter((event) => event.extractionError).length,
      qa: summarizeResults(qaResults),
      resultFiles: {
        extractedEvents: `${run.key}-extracted-events.json`,
        qaResults: `${run.key}-qa-results.json`
      }
    };

    await writeJson(`${resultsDir}/${summary.resultFiles.extractedEvents}`, run.events);
    await writeJson(`${resultsDir}/${summary.resultFiles.qaResults}`, qaResults);
    extractors.push(summary);
  }

  const benchmarkSummary = {
    dataset: {
      source: "real repository commits and current coursework working-tree changes",
      events: goldEvents.length,
      questions: questions.length,
      goldFacts: factsFromEvents(goldNormalizedEvents).length
    },
    configuration: {
      stateLimit,
      includeLlmExtractor
    },
    extractors
  };

  await writeJson(`${resultsDir}/summary.json`, benchmarkSummary);
  await writeText(`${resultsDir}/summary.md`, buildMarkdown(benchmarkSummary));

  return benchmarkSummary;
}
