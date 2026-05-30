import { performance } from "node:perf_hooks";
import { answerLatestFromRetrievedEvents } from "../rag/answer.mjs";
import { retrieveEventsWithRecency } from "../rag/index.mjs";
import { gradeAnswer, mcnemarExactTest, pairedComparison, summarizeResults } from "../eval/metrics.mjs";
import { createLangChainBufferMemory } from "../frameworks/langchainBufferMemory.mjs";
import { readJson, readJsonl, writeJson, writeText } from "../shared/io.mjs";
import { tokenCount } from "../shared/text.mjs";
import { answerFromFacts, buildPrompt } from "../state-memory/buildPrompt.mjs";
import { extractEventsWithLlm } from "../state-memory/llmExtractor.mjs";
import { selectRelevantFacts } from "../state-memory/selectState.mjs";
import { buildWorldState } from "../state-memory/worldState.mjs";

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

function decorate({ system, question, answer, contextMetrics, contextTokens, latencyMs, contextIds }) {
  const grade = gradeAnswer(question, answer);

  return {
    system,
    questionId: question.id,
    questionType: question.obsoleteAnswers.length > 0 ? "current_fact" : "stable_fact",
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

function evaluateTemporalRag(events, questions, { topK }) {
  return questions.map((question) => {
    const start = performance.now();
    const retrievedEvents = retrieveEventsWithRecency(events, question.question, { topK });
    const answer = answerLatestFromRetrievedEvents(question, retrievedEvents);
    const latencyMs = performance.now() - start;

    return decorate({
      system: "temporal_rag",
      question,
      answer,
      contextMetrics: contextMetricsFromEvents(question, retrievedEvents),
      contextTokens: tokenCount(retrievedEvents.map((event) => event.text).join("\n")),
      latencyMs,
      contextIds: retrievedEvents.map((event) => event.id)
    });
  });
}

function evaluateStateMemory(events, questions, { stateLimit }) {
  const worldState = buildWorldState(events);

  return questions.map((question) => {
    const start = performance.now();
    const facts = selectRelevantFacts(worldState, question, { limit: stateLimit });
    const prompt = buildPrompt(question, facts);
    const answer = answerFromFacts(question, facts);
    const latencyMs = performance.now() - start;

    return decorate({
      system: "state_memory",
      question,
      answer,
      contextMetrics: contextMetricsFromFacts(question, facts),
      contextTokens: tokenCount(prompt),
      latencyMs,
      contextIds: facts.map((fact) => fact.id)
    });
  });
}

function evaluateLangChainMemory(events, questions, { windowSize }) {
  const memory = createLangChainBufferMemory(events, { windowSize });

  return questions.map((question) => {
    const start = performance.now();
    const { answer, context, contextTokens } = memory.answer(question);
    const latencyMs = performance.now() - start;

    return decorate({
      system: "langchain_buffer_memory",
      question,
      answer,
      contextMetrics: contextMetricsFromEvents(question, context),
      contextTokens,
      latencyMs,
      contextIds: context.map((event) => event.id)
    });
  });
}

async function maybeExtractWithLlm(events, { useLlmExtractor, ollama }) {
  if (!useLlmExtractor) {
    return {
      events,
      extractor: {
        mode: "annotated-real-trace",
        llmEnabled: false,
        note: "Uses curated facts stored with the real repository trace."
      }
    };
  }

  const extractedEvents = await extractEventsWithLlm(
    events.map((event) => ({ ...event, facts: undefined })),
    ollama
  );

  return {
    events: extractedEvents,
    extractor: {
      mode: "ollama-llm-extractor",
      llmEnabled: true,
      model: ollama.model,
      note: "Facts were extracted from raw event text by the local Ollama model."
    }
  };
}

function rounded(value) {
  return Number(value ?? 0).toFixed(4);
}

function row(name, metrics) {
  return `| ${name} | ${rounded(metrics.exactMatchAccuracy)} | ${rounded(metrics.f1Score)} | ${rounded(metrics.contextHitRate)} | ${rounded(metrics.averageContextTokens)} | ${rounded(metrics.averageLatencyMs)} |`;
}

function buildMarkdown(summary) {
  return `# Real Project Trace Experiment

This benchmark keeps all synthetic benchmarks intact and adds a small real-project trace derived from actual repository commits and current working-tree changes. It evaluates Temporal RAG, State Memory, and a LangChain ConversationBufferMemory-style external memory-framework baseline.

Extractor mode: ${summary.extractor.mode}.

| System | Exact Match | F1 | Context Hit | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
${row("Temporal RAG", summary.temporalRag)}
${row("State Memory", summary.stateMemory)}
${row("LangChain BufferMemory-style", summary.langChainBufferMemory)}

Paired comparison against the external memory-framework baseline:

| Comparison | Candidate-only wins | Baseline-only wins | McNemar p |
| --- | ---: | ---: | ---: |
| State Memory vs LangChain BufferMemory-style | ${summary.stateVsLangChain.rightCorrectLeftWrong} | ${summary.stateVsLangChain.leftCorrectRightWrong} | ${rounded(summary.stateVsLangChain.pValue)} |

Interpretation: this is a small real-trace validation benchmark, not a replacement for the larger synthetic stress and robust benchmarks. Its purpose is to reduce synthetic-only bias and to show how explicit state compares with a buffer-memory framework pattern on repository-derived events.
`;
}

export async function runRealTraceExperiment({
  eventsPath = "data/real/events.jsonl",
  questionsPath = "data/real/questions.json",
  resultsDir = "results/real",
  topK = 6,
  stateLimit = 6,
  langChainWindowSize = 6,
  useLlmExtractor = process.argv.includes("--llm-extractor"),
  ollama = {}
} = {}) {
  const rawEvents = await readJsonl(eventsPath);
  const questions = await readJson(questionsPath);
  const extraction = await maybeExtractWithLlm(rawEvents, { useLlmExtractor, ollama });
  const events = extraction.events;

  const temporalRagResults = evaluateTemporalRag(events, questions, { topK });
  const stateResults = evaluateStateMemory(events, questions, { stateLimit });
  const langChainResults = evaluateLangChainMemory(events, questions, {
    windowSize: langChainWindowSize
  });

  const summary = {
    dataset: {
      source: "real repository commits and current coursework working-tree changes",
      events: events.length,
      questions: questions.length
    },
    configuration: {
      topK,
      stateLimit,
      langChainWindowSize
    },
    extractor: extraction.extractor,
    temporalRag: summarizeResults(temporalRagResults),
    stateMemory: summarizeResults(stateResults),
    langChainBufferMemory: summarizeResults(langChainResults),
    stateVsTemporalRag: pairedComparison(temporalRagResults, stateResults),
    stateVsLangChain: mcnemarExactTest(langChainResults, stateResults)
  };

  await writeJson(`${resultsDir}/temporal-rag-results.json`, temporalRagResults);
  await writeJson(`${resultsDir}/state-memory-results.json`, stateResults);
  await writeJson(`${resultsDir}/langchain-buffer-memory-results.json`, langChainResults);
  await writeJson(`${resultsDir}/extracted-events.json`, events);
  await writeJson(`${resultsDir}/summary.json`, summary);
  await writeText(`${resultsDir}/summary.md`, buildMarkdown(summary));

  return summary;
}
