import { performance } from "node:perf_hooks";
import { buildDataset } from "../dataset/generateDataset.mjs";
import { retrieveEvents, retrieveEventsWithRecency } from "../rag/index.mjs";
import { answerFromRetrievedEvents, answerLatestFromRetrievedEvents } from "../rag/answer.mjs";
import { buildWorldState } from "../state-memory/worldState.mjs";
import { answerFromFacts, buildPrompt } from "../state-memory/buildPrompt.mjs";
import { selectRelevantFacts } from "../state-memory/selectState.mjs";
import {
  answerWithDefensiveStateFallback,
  buildDefensiveWorldState
} from "../state-memory/defensiveState.mjs";
import { tokenCount } from "../shared/text.mjs";
import { writeJson, writeText } from "../shared/io.mjs";
import { gradeAnswer, summarizeResults } from "../eval/metrics.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mutateExtractedFacts(events, { mode, seed = 1 }) {
  const nextEvents = clone(events);
  let counter = seed;

  for (const event of nextEvents) {
    for (const fact of [...event.facts]) {
      const slotKey = `${fact.subject}.${fact.predicate}`;
      counter += 1;

      if (mode === "missing_updates" && fact.mutable && event.text.startsWith("Final update")) {
        event.facts = event.facts.filter((candidate) => candidate !== fact);
        continue;
      }

      if (mode === "wrong_slot" && fact.mutable && counter % 7 === 0) {
        fact.subject = `${fact.subject} archive`;
        continue;
      }

      if (mode === "low_confidence_updates" && fact.mutable && event.text.startsWith("Final update")) {
        fact.confidence = 0.6;
        fact.sourceReliability = 0.6;
        continue;
      }

      if (mode === "conflicting_updates" && fact.mutable && event.text.startsWith("Final update")) {
        event.facts.push({
          ...fact,
          object: `${fact.object} disputed`,
          confidence: 0.92,
          sourceReliability: 0.85
        });
        continue;
      }

      if (mode === "ambiguous_entities" && fact.mutable && counter % 5 === 0) {
        event.facts.push({
          ...fact,
          subject: `${fact.subject} legacy`,
          object: `${fact.object} legacy`,
          confidence: 0.7
        });
      }
    }
  }

  return nextEvents;
}

function addAmbiguousNoise(events, questions) {
  const noisyEvents = clone(events);
  const mutableQuestions = questions.filter((question) => question.obsoleteAnswers.length > 0);
  let offset = 0;

  for (const question of mutableQuestions) {
    offset += 1;
    noisyEvents.push({
      id: `noise-${String(offset).padStart(4, "0")}`,
      timestamp: new Date(Date.parse("2026-05-30T09:00:00.000Z") + offset * 60_000).toISOString(),
      type: "system_observation",
      text:
        `Noise note: ${question.subject} archive ${question.predicate.replaceAll("_", " ")} ` +
        `is ${question.obsoleteAnswers[0] ?? "unknown"} for a different legacy entity.`,
      facts: [
        {
          subject: `${question.subject} archive`,
          predicate: question.predicate,
          object: question.obsoleteAnswers[0] ?? "unknown",
          mutable: true,
          confidence: 0.6
        }
      ]
    });
  }

  return noisyEvents;
}

function expectedValues(question) {
  return Array.isArray(question.expected) ? question.expected : [question.expected];
}

function contextMetricsFromEvents(question, rankedEvents) {
  const facts = rankedEvents.flatMap((event) => event.facts ?? []);
  const contextHasGoldFact = expectedValues(question).every((expected) =>
    facts.some(
      (fact) =>
        fact.subject === question.subject &&
        fact.predicate === question.predicate &&
        fact.object === expected
    )
  );
  const goldIndex = rankedEvents.findIndex((event) =>
    event.facts?.some(
      (fact) =>
        fact.subject === question.subject &&
        fact.predicate === question.predicate &&
        expectedValues(question).includes(fact.object)
    )
  );

  return {
    contextHasGoldFact,
    goldRank: goldIndex >= 0 ? goldIndex + 1 : null,
    reciprocalRank: goldIndex >= 0 ? 1 / (goldIndex + 1) : 0
  };
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

function decorateResult({ question, answer, contextMetrics, contextTokens, latencyMs, contextIds }) {
  const grade = gradeAnswer(question, answer);

  return {
    questionId: question.id,
    questionType: question.obsoleteAnswers.length > 0 ? "current_fact" : "append_fact",
    question: question.question,
    expected: question.expected,
    answer: answer.answer,
    answerValues: answer.values,
    contextIds,
    contextTokens,
    latencyMs,
    ...contextMetrics,
    errorType: classifyError(grade, contextMetrics),
    ...grade
  };
}

function evaluateClassicRag(events, questions, options) {
  return questions.map((question) => {
    const start = performance.now();
    const retrievedEvents = retrieveEvents(events, question.question, options);
    const answer = answerFromRetrievedEvents(question, retrievedEvents);
    const latencyMs = performance.now() - start;

    return decorateResult({
      question,
      answer,
      contextMetrics: contextMetricsFromEvents(question, retrievedEvents),
      contextTokens: tokenCount(retrievedEvents.map((event) => event.text).join("\n")),
      latencyMs,
      contextIds: retrievedEvents.map((event) => event.id)
    });
  });
}

function evaluateRecencyRag(events, questions, options) {
  return questions.map((question) => {
    const start = performance.now();
    const retrievedEvents = retrieveEventsWithRecency(events, question.question, options);
    const answer = answerLatestFromRetrievedEvents(question, retrievedEvents);
    const latencyMs = performance.now() - start;

    return decorateResult({
      question,
      answer,
      contextMetrics: contextMetricsFromEvents(question, retrievedEvents),
      contextTokens: tokenCount(retrievedEvents.map((event) => event.text).join("\n")),
      latencyMs,
      contextIds: retrievedEvents.map((event) => event.id)
    });
  });
}

function evaluateStateMemory(eventsForExtractor, questions, options) {
  const worldState = buildWorldState(eventsForExtractor);

  return questions.map((question) => {
    const start = performance.now();
    const facts = selectRelevantFacts(worldState, question, { limit: options.stateLimit });
    const prompt = buildPrompt(question, facts);
    const answer = answerFromFacts(question, facts);
    const latencyMs = performance.now() - start;

    return decorateResult({
      question,
      answer,
      contextMetrics: contextMetricsFromFacts(question, facts),
      contextTokens: tokenCount(prompt),
      latencyMs,
      contextIds: facts.map((fact) => fact.id)
    });
  });
}

function summarizeDefensiveResults(results, worldState) {
  const summary = summarizeResults(results);
  const fallbackCount = results.filter((result) => result.memoryMode === "temporal_rag_fallback").length;
  const conflictCount = results.filter((result) => result.conflictCount > 0).length;
  const lowConfidenceCount = results.filter((result) => result.lowConfidenceCount > 0).length;

  return {
    ...summary,
    fallbackRate: results.length === 0 ? 0 : fallbackCount / results.length,
    conflictQuestionRate: results.length === 0 ? 0 : conflictCount / results.length,
    lowConfidenceQuestionRate: results.length === 0 ? 0 : lowConfidenceCount / results.length,
    rejectedLowConfidenceFacts: worldState.diagnostics.rejectedLowConfidenceFacts,
    storedConflicts: worldState.diagnostics.conflicts,
    softReplacements: worldState.diagnostics.softReplacements
  };
}

function evaluateDefensiveStateMemory(rawEvents, eventsForExtractor, questions, options) {
  const worldState = buildDefensiveWorldState(eventsForExtractor, options.defensiveState);
  const results = questions.map((question) => {
    const start = performance.now();
    const decision = answerWithDefensiveStateFallback({
      worldState,
      events: rawEvents,
      question,
      stateLimit: options.stateLimit,
      ragTopK: options.ragTopK
    });
    const latencyMs = performance.now() - start;
    const contextMetrics =
      decision.mode === "temporal_rag_fallback"
        ? contextMetricsFromEvents(question, decision.context)
        : contextMetricsFromFacts(question, decision.context);
    const contextTokens =
      decision.mode === "temporal_rag_fallback"
        ? tokenCount(decision.context.map((event) => event.text).join("\n"))
        : tokenCount(buildPrompt(question, decision.context));

    return {
      ...decorateResult({
        question,
        answer: decision.answer,
        contextMetrics,
        contextTokens,
        latencyMs,
        contextIds: decision.contextIds
      }),
      memoryMode: decision.mode,
      fallbackReason: decision.fallbackReason,
      conflictCount: decision.conflictCount,
      lowConfidenceCount: decision.lowConfidenceCount
    };
  });

  return {
    results,
    summary: summarizeDefensiveResults(results, worldState),
    diagnostics: worldState.diagnostics,
    conflicts: worldState.conflicts,
    lowConfidenceFacts: worldState.lowConfidenceFacts,
    versions: worldState.versions
  };
}

function compactDefensiveDiagnostics(defensive, limit = 20) {
  return {
    diagnostics: defensive.diagnostics,
    conflictExamples: defensive.conflicts.slice(0, limit),
    lowConfidenceExamples: defensive.lowConfidenceFacts.slice(0, limit).map((fact) => ({
      id: fact.id,
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object,
      confidence: fact.confidence,
      sourceReliability: fact.sourceReliability,
      sourceEventId: fact.sourceEventId,
      rejectionReason: fact.rejectionReason
    })),
    versionSlots: Object.fromEntries(
      Object.entries(defensive.versions).map(([slot, versions]) => [slot, versions.length])
    )
  };
}

function rounded(value) {
  return Number(value).toFixed(4);
}

function buildMarkdown(summary) {
  const rows = summary.scenarios
    .map((scenario) =>
      [
        ["Classic RAG", scenario.classicRag],
        ["RAG + recency/latest", scenario.recencyRag],
        ["State Memory", scenario.stateMemory],
        ["Defensive State + fallback", scenario.defensiveStateMemory]
      ]
        .map(
          ([name, metrics]) =>
            `| ${scenario.name} | ${name} | ${rounded(metrics.exactMatchAccuracy)} | ${rounded(metrics.currentFactAccuracy)} | ${rounded(metrics.staleFactErrorRate)} | ${rounded(metrics.contextHitRate)} | ${rounded(metrics.meanReciprocalRank)} | ${rounded(metrics.fallbackRate ?? 0)} |`
        )
        .join("\n")
    )
    .join("\n");
  const diagnosticRows = summary.scenarios
    .map((scenario) => {
      const metrics = scenario.defensiveStateMemory;
      return `| ${scenario.name} | ${metrics.rejectedLowConfidenceFacts} | ${metrics.storedConflicts} | ${metrics.softReplacements} | ${rounded(metrics.lowConfidenceQuestionRate ?? 0)} | ${rounded(metrics.conflictQuestionRate ?? 0)} |`;
    })
    .join("\n");

  return `# Stress Experiment

This benchmark intentionally weakens the idealized assumptions of the base experiment.

| Scenario | System | Exact Match | Current Fact Accuracy | Stale Error | Context Hit | MRR | Fallback Rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

Defensive State diagnostics:

| Scenario | Rejected Low-Confidence Facts | Stored Conflicts | Soft Replacements | Low-Confidence Question Rate | Conflict Question Rate |
| --- | ---: | ---: | ---: | ---: | ---: |
${diagnosticRows}

Interpretation: the perfect State Memory result depends on clean fact extraction. When updates are missing or facts are assigned to the wrong slot, State Memory degrades. Defensive State Memory adds a confidence threshold, conflict tracking, versioning and a Temporal RAG fallback for uncertain slots. It helps when uncertainty is visible, but it cannot recover an update that the extractor completely missed unless raw events are rechecked by a reconciliation step.
`;
}

export async function runStressExperiment({
  eventCount = 1000,
  seed = 42,
  ragTopK = 12,
  stateLimit = 8,
  defensiveState = {
    confidenceThreshold: 0.75,
    replacementMargin: 0.05,
    conflictWindowMs: 2 * 60 * 1000,
    versionLimit: 4
  },
  resultsDir = "results/stress"
} = {}) {
  const dataset = buildDataset({ eventCount, seed });
  const scenarios = [
    {
      name: "clean_extraction",
      ragEvents: dataset.events,
      stateEvents: dataset.events
    },
    {
      name: "missing_final_updates",
      ragEvents: dataset.events,
      stateEvents: mutateExtractedFacts(dataset.events, { mode: "missing_updates", seed })
    },
    {
      name: "wrong_extraction_slot",
      ragEvents: dataset.events,
      stateEvents: mutateExtractedFacts(dataset.events, { mode: "wrong_slot", seed })
    },
    {
      name: "low_confidence_final_updates",
      ragEvents: dataset.events,
      stateEvents: mutateExtractedFacts(dataset.events, { mode: "low_confidence_updates", seed })
    },
    {
      name: "near_simultaneous_conflicts",
      ragEvents: dataset.events,
      stateEvents: mutateExtractedFacts(dataset.events, { mode: "conflicting_updates", seed })
    },
    {
      name: "ambiguous_similar_entities",
      ragEvents: addAmbiguousNoise(dataset.events, dataset.questions),
      stateEvents: mutateExtractedFacts(dataset.events, { mode: "ambiguous_entities", seed })
    }
  ];

  const evaluatedScenarios = scenarios.map((scenario) => {
    const classicRagResults = evaluateClassicRag(scenario.ragEvents, dataset.questions, {
      topK: ragTopK
    });
    const recencyRagResults = evaluateRecencyRag(scenario.ragEvents, dataset.questions, {
      topK: ragTopK
    });
    const stateResults = evaluateStateMemory(scenario.stateEvents, dataset.questions, {
      stateLimit
    });
    const defensive = evaluateDefensiveStateMemory(
      scenario.ragEvents,
      scenario.stateEvents,
      dataset.questions,
      {
        ragTopK,
        stateLimit,
        defensiveState
      }
    );

    return {
      name: scenario.name,
      classicRag: summarizeResults(classicRagResults),
      recencyRag: summarizeResults(recencyRagResults),
      stateMemory: summarizeResults(stateResults),
      defensiveStateMemory: defensive.summary,
      resultFiles: {
        classicRag: `${scenario.name}-classic-rag.json`,
        recencyRag: `${scenario.name}-recency-rag.json`,
        stateMemory: `${scenario.name}-state-memory.json`,
        defensiveStateMemory: `${scenario.name}-defensive-state-memory.json`,
        defensiveDiagnostics: `${scenario.name}-defensive-diagnostics.json`
      },
      rawResults: {
        classicRagResults,
        recencyRagResults,
        stateResults,
        defensiveStateResults: defensive.results,
        defensiveDiagnostics: compactDefensiveDiagnostics(defensive)
      }
    };
  });

  for (const scenario of evaluatedScenarios) {
    await writeJson(`${resultsDir}/${scenario.resultFiles.classicRag}`, scenario.rawResults.classicRagResults);
    await writeJson(`${resultsDir}/${scenario.resultFiles.recencyRag}`, scenario.rawResults.recencyRagResults);
    await writeJson(`${resultsDir}/${scenario.resultFiles.stateMemory}`, scenario.rawResults.stateResults);
    await writeJson(
      `${resultsDir}/${scenario.resultFiles.defensiveStateMemory}`,
      scenario.rawResults.defensiveStateResults
    );
    await writeJson(
      `${resultsDir}/${scenario.resultFiles.defensiveDiagnostics}`,
      scenario.rawResults.defensiveDiagnostics
    );
    delete scenario.rawResults;
  }

  const summary = {
    dataset: {
      events: dataset.events.length,
      questions: dataset.questions.length
    },
    configuration: {
      ragTopK,
      stateLimit,
      defensiveState
    },
    scenarios: evaluatedScenarios
  };

  await writeJson(`${resultsDir}/summary.json`, summary);
  await writeText(`${resultsDir}/summary.md`, buildMarkdown(summary));

  return summary;
}
