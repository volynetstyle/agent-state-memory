import { performance } from "node:perf_hooks";
import { buildDataset } from "../generateDataset.mjs";
import { buildDocumentDataset } from "../document/generateDocumentDataset.mjs";
import { retrieveTextItems } from "../document/retrieveDocuments.mjs";
import { retrieveEvents } from "../rag/retrieve.mjs";
import { selectRelevantFacts } from "../state-memory/selectState.mjs";
import { buildWorldState } from "../state-memory/worldState.mjs";
import { tokenCount } from "../shared/text.mjs";
import { writeJson, writeText } from "../shared/io.mjs";
import { generateWithOllama } from "../llm/ollama.mjs";
import { gradeLlmAnswer, summarizeLlmResults } from "./llmGrading.mjs";

function take(values, count) {
  return values.slice(0, Math.max(0, count));
}

function withType(question, questionType) {
  return { ...question, questionType, unanswerable: false };
}

function buildUnknownQuestions() {
  return [
    {
      id: "unknown-state-001",
      question: "What production analytics database does the user prefer?",
      expected: "UNKNOWN",
      questionType: "unknown",
      unknownSource: "state",
      obsoleteAnswers: [],
      unanswerable: true
    },
    {
      id: "unknown-state-002",
      question: "What is the user's favorite programming font?",
      expected: "UNKNOWN",
      questionType: "unknown",
      unknownSource: "state",
      obsoleteAnswers: [],
      unanswerable: true
    },
    {
      id: "unknown-state-003",
      question: "Which cloud provider hosts Reflex in production?",
      expected: "UNKNOWN",
      questionType: "unknown",
      unknownSource: "state",
      obsoleteAnswers: [],
      unanswerable: true
    },
    {
      id: "unknown-doc-001",
      question: "In the long document, what answer token is recorded for marker DOC-999-9?",
      expected: "UNKNOWN",
      questionType: "unknown",
      unknownSource: "document",
      sourceChunkId: null,
      obsoleteAnswers: [],
      unanswerable: true
    },
    {
      id: "unknown-doc-002",
      question: "Which appendix defines marker DOC-404-4?",
      expected: "UNKNOWN",
      questionType: "unknown",
      unknownSource: "document",
      sourceChunkId: null,
      obsoleteAnswers: [],
      unanswerable: true
    }
  ];
}

function buildQuestionSet(stateQuestions, documentQuestions, {
  currentCount = 10,
  stableCount = 10,
  documentCount = 10,
  unknownCount = 5
} = {}) {
  const current = take(
    stateQuestions
      .filter((question) => question.obsoleteAnswers.length > 0)
      .map((question) => withType(question, "current_state")),
    currentCount
  );
  const stable = take(
    stateQuestions
      .filter((question) => question.obsoleteAnswers.length === 0)
      .map((question) => withType(question, "stable_state")),
    stableCount
  );
  const documents = take(
    documentQuestions.map((question) => withType(question, "document_detail")),
    documentCount
  );
  const unknown = take(buildUnknownQuestions(), unknownCount);

  return [...current, ...stable, ...documents, ...unknown];
}

function expectedValues(question) {
  if (question.unanswerable) return ["UNKNOWN"];
  return Array.isArray(question.expected) ? question.expected : [question.expected];
}

function buildPrompt({ system, question, context }) {
  return [
    `System: ${system}`,
    "Answer only using the provided context.",
    "If the answer is not present in the context, return exactly UNKNOWN.",
    "Return only the short answer, without explanation.",
    "",
    "Context:",
    context || "(empty)",
    "",
    `Question: ${question.question}`
  ].join("\n");
}

function eventContext(question, events) {
  const context = events.map((event) => `- ${event.text}`).join("\n");
  const expected = expectedValues(question);
  const facts = events.flatMap((event) => event.facts ?? []);
  const contextHasGoldFact =
    !question.unanswerable &&
    expected.every((value) =>
      facts.some(
        (fact) =>
          fact.subject === question.subject &&
          fact.predicate === question.predicate &&
          fact.object === value
      )
    );

  return {
    context,
    contextIds: events.map((event) => event.id),
    contextHasGoldFact
  };
}

function stateContext(question, facts) {
  const context = facts
    .map((fact) => `- ${fact.subject}.${fact.predicate} = ${fact.object} (${fact.status})`)
    .join("\n");
  const expected = expectedValues(question);
  const contextHasGoldFact =
    !question.unanswerable &&
    expected.every((value) =>
      facts.some(
        (fact) =>
          fact.subject === question.subject &&
          fact.predicate === question.predicate &&
          fact.object === value
      )
    );

  return {
    context,
    contextIds: facts.map((fact) => fact.id),
    contextHasGoldFact
  };
}

function documentContext(question, chunks) {
  const context = chunks.map((chunk) => `- ${chunk.text}`).join("\n");
  const contextHasGoldFact =
    !question.unanswerable && chunks.some((chunk) => chunk.id === question.sourceChunkId);

  return {
    context,
    contextIds: chunks.map((chunk) => chunk.id),
    contextHasGoldFact
  };
}

function routeForSystem(system, question) {
  if (system === "state") return "state";
  if (question.questionType === "document_detail") return "document";
  if (question.questionType === "unknown" && question.unknownSource === "document") {
    return system === "hybrid" ? "document" : "document";
  }
  if (system === "hybrid") return "state";
  return question.questionType === "document_detail" ? "document" : "events";
}

function getContext({ system, question, events, documents, worldState, ragTopK, documentTopK, stateLimit }) {
  const route = routeForSystem(system, question);
  const start = performance.now();

  if (route === "document") {
    const chunks = retrieveTextItems(documents, question.question, { topK: documentTopK });
    return {
      route,
      retrievalMs: performance.now() - start,
      ...documentContext(question, chunks)
    };
  }

  if (route === "state") {
    if (question.questionType === "document_detail") {
      return {
        route,
        retrievalMs: performance.now() - start,
        context: "",
        contextIds: [],
        contextHasGoldFact: false
      };
    }

    const facts = selectRelevantFacts(worldState, question, { limit: stateLimit });
    return {
      route,
      retrievalMs: performance.now() - start,
      ...stateContext(question, facts)
    };
  }

  const retrievedEvents = retrieveEvents(events, question.question, { topK: ragTopK });
  return {
    route,
    retrievalMs: performance.now() - start,
    ...eventContext(question, retrievedEvents)
  };
}

async function evaluateSystem({ system, questions, events, documents, worldState, ollama, ragTopK, documentTopK, stateLimit }) {
  const results = [];

  for (const question of questions) {
    const totalStart = performance.now();
    const contextInfo = getContext({
      system,
      question,
      events,
      documents,
      worldState,
      ragTopK,
      documentTopK,
      stateLimit
    });
    const promptStart = performance.now();
    const prompt = buildPrompt({
      system,
      question,
      context: contextInfo.context
    });
    const promptBuildMs = performance.now() - promptStart;
    const llmStart = performance.now();
    const rawAnswer = await generateWithOllama(prompt, ollama);
    const llmMs = performance.now() - llmStart;
    const totalMs = performance.now() - totalStart;
    const grade = gradeLlmAnswer(question, rawAnswer, {
      contextHasGoldFact: contextInfo.contextHasGoldFact
    });

    results.push({
      system,
      route: contextInfo.route,
      questionId: question.id,
      questionType: question.questionType,
      unanswerable: Boolean(question.unanswerable),
      question: question.question,
      expected: question.expected,
      context: contextInfo.context,
      contextIds: contextInfo.contextIds,
      contextHasGoldFact: contextInfo.contextHasGoldFact,
      rawAnswer,
      contextTokens: tokenCount(prompt),
      retrievalMs: contextInfo.retrievalMs,
      promptBuildMs,
      llmMs,
      totalMs,
      ...grade
    });
  }

  return results;
}

function rounded(value) {
  return Number(value).toFixed(4);
}

function row(systemName, metrics) {
  return `| ${systemName} | ${rounded(metrics.normalizedAccuracy)} | ${rounded(metrics.unknownAccuracy)} | ${rounded(metrics.promptComplianceRate)} | ${rounded(metrics.hallucinationRate)} | ${rounded(metrics.averageContextTokens)} | ${rounded(metrics.averageLlmMs)} |`;
}

function typeRows(summary) {
  const types = ["current_state", "stable_state", "document_detail", "unknown"];

  return types
    .map((type) => {
      const rag = summary.rag.byType[type]?.normalizedAccuracy ?? 0;
      const state = summary.state.byType[type]?.normalizedAccuracy ?? 0;
      const hybrid = summary.hybrid.byType[type]?.normalizedAccuracy ?? 0;
      return `| ${type} | ${rounded(rag)} | ${rounded(state)} | ${rounded(hybrid)} |`;
    })
    .join("\n");
}

function buildMarkdown(summary) {
  return `# Mixed LLM Experiment

Model: ${summary.configuration.model}

Temperature: ${summary.configuration.temperature}

Seed: ${summary.configuration.seed}

Question set: ${summary.dataset.questions} total (${summary.dataset.currentStateQuestions} current_state, ${summary.dataset.stableStateQuestions} stable_state, ${summary.dataset.documentQuestions} document_detail, ${summary.dataset.unknownQuestions} unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${row("RAG + LLM", summary.rag)}
${row("State + LLM", summary.state)}
${row("Hybrid + LLM", summary.hybrid)}

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
${typeRows(summary)}

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | ${rounded(summary.rag.averageRetrievalMs)} | ${rounded(summary.rag.averagePromptBuildMs)} | ${rounded(summary.rag.averageLlmMs)} | ${rounded(summary.rag.averageTotalMs)} |
| State + LLM | ${rounded(summary.state.averageRetrievalMs)} | ${rounded(summary.state.averagePromptBuildMs)} | ${rounded(summary.state.averageLlmMs)} | ${rounded(summary.state.averageTotalMs)} |
| Hybrid + LLM | ${rounded(summary.hybrid.averageRetrievalMs)} | ${rounded(summary.hybrid.averagePromptBuildMs)} | ${rounded(summary.hybrid.averageLlmMs)} | ${rounded(summary.hybrid.averageTotalMs)} |
`;
}

export async function runLlmMixedExperiment({
  eventCount = 1000,
  pageCount = 100,
  currentCount = 10,
  stableCount = 10,
  documentCount = 10,
  unknownCount = 5,
  ragTopK = 12,
  documentTopK = 8,
  stateLimit = 8,
  seed = 42,
  resultsDir = "results/llm",
  ollama = {}
} = {}) {
  const stateDataset = buildDataset({ eventCount, seed });
  const documentDataset = buildDocumentDataset({
    pageCount,
    paragraphsPerPage: 3,
    questionLimit: Math.max(documentCount, 10)
  });
  const questions = buildQuestionSet(stateDataset.questions, documentDataset.questions, {
    currentCount,
    stableCount,
    documentCount,
    unknownCount
  });
  const worldState = buildWorldState(stateDataset.events);
  const model = ollama.model ?? process.env.OLLAMA_MODEL ?? "llama3.2:3b";
  const temperature = ollama.temperature ?? 0;
  const ollamaOptions = {
    ...ollama,
    model,
    temperature,
    seed
  };

  const ragResults = await evaluateSystem({
    system: "rag",
    questions,
    events: stateDataset.events,
    documents: documentDataset.documents,
    worldState,
    ollama: ollamaOptions,
    ragTopK,
    documentTopK,
    stateLimit
  });
  const stateResults = await evaluateSystem({
    system: "state",
    questions,
    events: stateDataset.events,
    documents: documentDataset.documents,
    worldState,
    ollama: ollamaOptions,
    ragTopK,
    documentTopK,
    stateLimit
  });
  const hybridResults = await evaluateSystem({
    system: "hybrid",
    questions,
    events: stateDataset.events,
    documents: documentDataset.documents,
    worldState,
    ollama: ollamaOptions,
    ragTopK,
    documentTopK,
    stateLimit
  });
  const rawResponses = [...ragResults, ...stateResults, ...hybridResults];
  const counts = {
    currentStateQuestions: questions.filter((question) => question.questionType === "current_state").length,
    stableStateQuestions: questions.filter((question) => question.questionType === "stable_state").length,
    documentQuestions: questions.filter((question) => question.questionType === "document_detail").length,
    unknownQuestions: questions.filter((question) => question.questionType === "unknown").length
  };
  const summary = {
    dataset: {
      events: stateDataset.events.length,
      documentPages: documentDataset.meta.pageCount,
      documentChunks: documentDataset.meta.chunks,
      questions: questions.length,
      ...counts
    },
    configuration: {
      model,
      temperature,
      seed,
      ragTopK,
      documentTopK,
      stateLimit
    },
    rag: summarizeLlmResults(ragResults),
    state: summarizeLlmResults(stateResults),
    hybrid: summarizeLlmResults(hybridResults)
  };

  await writeJson(`${resultsDir}/rag-llm-results.json`, ragResults);
  await writeJson(`${resultsDir}/state-llm-results.json`, stateResults);
  await writeJson(`${resultsDir}/hybrid-llm-results.json`, hybridResults);
  await writeJson(`${resultsDir}/raw-responses.json`, rawResponses);
  await writeJson(`${resultsDir}/summary.json`, summary);
  await writeText(`${resultsDir}/summary.md`, buildMarkdown(summary));

  return summary;
}
