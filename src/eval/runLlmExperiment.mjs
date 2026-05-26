import { performance } from "node:perf_hooks";
import { readJson, readJsonl, writeJson, writeText } from "../shared/io.mjs";
import { tokenCount } from "../shared/text.mjs";
import { retrieveEvents } from "../rag/retrieve.mjs";
import { selectRelevantFacts } from "../state-memory/selectState.mjs";
import { buildWorldState } from "../state-memory/worldState.mjs";
import { generateWithOllama } from "../llm/ollama.mjs";
import { gradeGeneratedAnswer, summarizeResults } from "./metrics.mjs";

function buildRagPrompt(question, retrievedEvents) {
  const context = retrievedEvents.map((event) => `- ${event.text}`).join("\n");

  return [
    "Answer only using the provided context.",
    "If the answer is not present in the context, return exactly UNKNOWN.",
    "Return only the short answer, without explanation.",
    "",
    "Context:",
    context,
    "",
    `Question: ${question.question}`
  ].join("\n");
}

function buildStatePrompt(question, facts) {
  const factLines = facts.map(
    (fact) => `- ${fact.subject}.${fact.predicate} = ${fact.object} (${fact.status})`
  );

  return [
    "Answer only using the provided current state.",
    "If the answer is not present in the current state, return exactly UNKNOWN.",
    "Return only the short answer, without explanation.",
    "",
    "Current state:",
    ...factLines,
    "",
    `Question: ${question.question}`
  ].join("\n");
}

function chooseQuestions(questions, limit) {
  const mutable = questions.filter((question) => question.obsoleteAnswers.length > 0);
  const appendOnly = questions.filter((question) => question.obsoleteAnswers.length === 0);
  return [...mutable, ...appendOnly].slice(0, limit);
}

async function evaluateRagWithLlm(events, questions, options) {
  const results = [];

  for (const question of questions) {
    const start = performance.now();
    const retrievedEvents = retrieveEvents(events, question.question, { topK: options.ragTopK });
    const prompt = buildRagPrompt(question, retrievedEvents);
    const answer = await generateWithOllama(prompt, options.ollama);
    const latencyMs = performance.now() - start;
    const grade = gradeGeneratedAnswer(question, answer);

    results.push({
      questionId: question.id,
      question: question.question,
      expected: question.expected,
      answer,
      retrievedEventIds: retrievedEvents.map((event) => event.id),
      contextTokens: tokenCount(prompt),
      latencyMs,
      ...grade
    });
  }

  return results;
}

async function evaluateStateWithLlm(worldState, questions, options) {
  const results = [];

  for (const question of questions) {
    const start = performance.now();
    const facts = selectRelevantFacts(worldState, question, { limit: options.stateLimit });
    const prompt = buildStatePrompt(question, facts);
    const answer = await generateWithOllama(prompt, options.ollama);
    const latencyMs = performance.now() - start;
    const grade = gradeGeneratedAnswer(question, answer);

    results.push({
      questionId: question.id,
      question: question.question,
      expected: question.expected,
      answer,
      selectedFactIds: facts.map((fact) => fact.id),
      contextTokens: tokenCount(prompt),
      latencyMs,
      ...grade
    });
  }

  return results;
}

function rounded(value) {
  return Number(value).toFixed(4);
}

function buildLlmSummaryMarkdown(summary) {
  return `# LLM Experiment Summary

Model: ${summary.configuration.model}

Dataset subset: ${summary.dataset.questions} questions from ${summary.dataset.events} events.

| System | Recall | Precision | Stale fact error rate | Avg context tokens | Avg latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | ${rounded(summary.rag.recallAccuracy)} | ${rounded(summary.rag.precision)} | ${rounded(summary.rag.staleFactErrorRate)} | ${rounded(summary.rag.averageContextTokens)} | ${rounded(summary.rag.averageLatencyMs)} |
| State Memory + LLM | ${rounded(summary.stateMemory.recallAccuracy)} | ${rounded(summary.stateMemory.precision)} | ${rounded(summary.stateMemory.staleFactErrorRate)} | ${rounded(summary.stateMemory.averageContextTokens)} | ${rounded(summary.stateMemory.averageLatencyMs)} |

This optional experiment validates the same memory pipeline with a real local language model. The deterministic benchmark remains the primary controlled experiment because it isolates memory quality from generation noise.
`;
}

export async function runLlmExperiment({
  eventsPath = "data/events.jsonl",
  questionsPath = "data/questions.json",
  resultsDir = "results/llm",
  questionLimit = 50,
  ragTopK = 12,
  stateLimit = 8,
  ollama = {}
} = {}) {
  const events = await readJsonl(eventsPath);
  const allQuestions = await readJson(questionsPath);
  const questions = chooseQuestions(allQuestions, questionLimit);
  const worldState = buildWorldState(events);
  const model = ollama.model ?? process.env.OLLAMA_MODEL ?? "llama3.2:3b";

  const ragResults = await evaluateRagWithLlm(events, questions, {
    ragTopK,
    ollama: { ...ollama, model }
  });
  const stateResults = await evaluateStateWithLlm(worldState, questions, {
    stateLimit,
    ollama: { ...ollama, model }
  });

  const summary = {
    dataset: {
      events: events.length,
      questions: questions.length,
      activeFacts: worldState.facts.filter((fact) => fact.status === "active").length,
      obsoleteFacts: worldState.facts.filter((fact) => fact.status === "obsolete").length
    },
    configuration: {
      model,
      ragTopK,
      stateLimit,
      questionLimit
    },
    rag: summarizeResults(ragResults),
    stateMemory: summarizeResults(stateResults)
  };

  await writeJson(`${resultsDir}/rag-llm-results.json`, ragResults);
  await writeJson(`${resultsDir}/state-llm-results.json`, stateResults);
  await writeJson(`${resultsDir}/summary.json`, summary);
  await writeText(`${resultsDir}/summary.md`, buildLlmSummaryMarkdown(summary));

  return summary;
}
