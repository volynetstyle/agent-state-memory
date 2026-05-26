import { performance } from "node:perf_hooks";
import { buildDataset } from "../dataset/generateDataset.mjs";
import { buildDocumentDataset } from "../dataset/documentDataset.mjs";
import { answerFromDocumentChunks, retrieveTextItems } from "../document/retrieveDocuments.mjs";
import { retrieveEvents } from "../rag/index.mjs";
import { answerFromRetrievedEvents } from "../rag/answer.mjs";
import { buildWorldState } from "../state-memory/worldState.mjs";
import { answerFromFacts, buildPrompt } from "../state-memory/buildPrompt.mjs";
import { selectRelevantFacts } from "../state-memory/selectState.mjs";
import { tokenCount } from "../shared/text.mjs";
import { writeJson, writeText } from "../shared/io.mjs";
import { gradeAnswer, summarizeResults } from "../eval/metrics.mjs";

function typeOfQuestion(question) {
  if (question.questionType) return question.questionType;
  return question.obsoleteAnswers.length > 0 ? "current_state" : "stable_state";
}

function withQuestionType(question, questionType) {
  return { ...question, questionType };
}

function eventContextMetrics(question, retrievedEvents) {
  const expected = Array.isArray(question.expected) ? question.expected : [question.expected];
  const facts = retrievedEvents.flatMap((event) => event.facts ?? []);
  const slotFacts = facts.filter(
    (fact) => fact.subject === question.subject && fact.predicate === question.predicate
  );
  const contextHasGoldFact = expected.every((value) =>
    slotFacts.some((fact) => fact.object === value)
  );
  const goldRank = retrievedEvents.findIndex((event) =>
    event.facts?.some(
      (fact) =>
        fact.subject === question.subject &&
        fact.predicate === question.predicate &&
        expected.includes(fact.object)
    )
  );

  return {
    contextHasGoldFact,
    goldRank: goldRank >= 0 ? goldRank + 1 : null,
    reciprocalRank: goldRank >= 0 ? 1 / (goldRank + 1) : 0
  };
}

function documentContextMetrics(question, chunks) {
  const goldRank = chunks.findIndex((chunk) => chunk.id === question.sourceChunkId);

  return {
    contextHasGoldFact: goldRank >= 0,
    goldRank: goldRank >= 0 ? goldRank + 1 : null,
    reciprocalRank: goldRank >= 0 ? 1 / (goldRank + 1) : 0
  };
}

function stateContextMetrics(question, facts) {
  const expected = Array.isArray(question.expected) ? question.expected : [question.expected];
  const slotFacts = facts.filter(
    (fact) => fact.subject === question.subject && fact.predicate === question.predicate
  );
  const contextHasGoldFact = expected.every((value) =>
    slotFacts.some((fact) => fact.object === value)
  );
  const goldRank = facts.findIndex(
    (fact) =>
      fact.subject === question.subject &&
      fact.predicate === question.predicate &&
      expected.includes(fact.object)
  );

  return {
    contextHasGoldFact,
    goldRank: goldRank >= 0 ? goldRank + 1 : null,
    reciprocalRank: goldRank >= 0 ? 1 / (goldRank + 1) : 0
  };
}

function classifyError(grade, contextMetrics) {
  if (grade.correct) return "none";
  if (grade.staleFactError) return "stale_fact";
  if (!contextMetrics.contextHasGoldFact) return "missing_fact";
  if (!grade.answered) return "unknown_failed";
  return "answer_mismatch";
}

function evaluateRagOnly({ events, documents, questions, ragTopK, documentTopK }) {
  return questions.map((question) => {
    const start = performance.now();
    const questionType = typeOfQuestion(question);
    let answer;
    let contextTokens;
    let contextMetrics;
    let contextIds;

    if (questionType === "document_detail") {
      const chunks = retrieveTextItems(documents, question.question, { topK: documentTopK });
      answer = answerFromDocumentChunks(question, chunks);
      contextTokens = tokenCount(chunks.map((chunk) => chunk.text).join("\n"));
      contextMetrics = documentContextMetrics(question, chunks);
      contextIds = chunks.map((chunk) => chunk.id);
    } else {
      const retrievedEvents = retrieveEvents(events, question.question, { topK: ragTopK });
      answer = answerFromRetrievedEvents(question, retrievedEvents);
      contextTokens = tokenCount(retrievedEvents.map((event) => event.text).join("\n"));
      contextMetrics = eventContextMetrics(question, retrievedEvents);
      contextIds = retrievedEvents.map((event) => event.id);
    }

    const latencyMs = performance.now() - start;
    const grade = gradeAnswer(question, answer);

    return {
      questionId: question.id,
      questionType,
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
  });
}

function evaluateStateOnly({ worldState, questions, stateLimit }) {
  return questions.map((question) => {
    const start = performance.now();
    const questionType = typeOfQuestion(question);

    if (questionType === "document_detail") {
      const latencyMs = performance.now() - start;
      const answer = { answer: "unknown", values: [] };
      const grade = gradeAnswer(question, answer);
      const contextMetrics = {
        contextHasGoldFact: false,
        goldRank: null,
        reciprocalRank: 0
      };

      return {
        questionId: question.id,
        questionType,
        question: question.question,
        expected: question.expected,
        answer: answer.answer,
        answerValues: answer.values,
        contextIds: [],
        contextTokens: 0,
        latencyMs,
        ...contextMetrics,
        errorType: classifyError(grade, contextMetrics),
        ...grade
      };
    }

    const facts = selectRelevantFacts(worldState, question, { limit: stateLimit });
    const prompt = buildPrompt(question, facts);
    const answer = answerFromFacts(question, facts);
    const latencyMs = performance.now() - start;
    const grade = gradeAnswer(question, answer);
    const contextMetrics = stateContextMetrics(question, facts);

    return {
      questionId: question.id,
      questionType,
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

function evaluateHybrid({ events, documents, worldState, questions, ragTopK, documentTopK, stateLimit }) {
  return questions.map((question) => {
    const questionType = typeOfQuestion(question);
    const result =
      questionType === "document_detail"
        ? evaluateRagOnly({ events, documents, questions: [question], ragTopK, documentTopK })[0]
        : evaluateStateOnly({ worldState, questions: [question], stateLimit })[0];

    return {
      ...result,
      routedTo: questionType === "document_detail" ? "document_rag" : "state_memory"
    };
  });
}

function groupSummary(results) {
  const byType = {};

  for (const result of results) {
    byType[result.questionType] ??= [];
    byType[result.questionType].push(result);
  }

  return Object.fromEntries(
    Object.entries(byType).map(([type, typeResults]) => [type, summarizeResults(typeResults)])
  );
}

function rounded(value) {
  return Number(value).toFixed(4);
}

function buildSummaryMarkdown(summary) {
  const systemRows = [
    ["RAG-only", summary.ragOnly],
    ["State-only", summary.stateOnly],
    ["Hybrid", summary.hybrid]
  ]
    .map(
      ([name, metrics]) =>
        `| ${name} | ${rounded(metrics.exactMatchAccuracy)} | ${rounded(metrics.currentFactAccuracy)} | ${rounded(metrics.contextHitRate)} | ${rounded(metrics.averageContextTokens)} | ${rounded(metrics.averageLatencyMs)} |`
    )
    .join("\n");

  const typeRows = Object.keys(summary.byType.hybrid)
    .map((type) => {
      const rag = summary.byType.ragOnly[type] ?? {};
      const state = summary.byType.stateOnly[type] ?? {};
      const hybrid = summary.byType.hybrid[type] ?? {};
      return `| ${type} | ${rounded(rag.exactMatchAccuracy ?? 0)} | ${rounded(state.exactMatchAccuracy ?? 0)} | ${rounded(hybrid.exactMatchAccuracy ?? 0)} |`;
    })
    .join("\n");

  return `# Mixed Knowledge Experiment

This benchmark combines three question types:

- current state questions from event memory
- stable non-current state questions from event memory
- document-detail questions from a synthetic 100-page unstructured document

| System | Exact Match | Current Fact Accuracy | Context Hit | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
${systemRows}

Accuracy by question type:

| Question Type | RAG-only | State-only | Hybrid |
| --- | ---: | ---: | ---: |
${typeRows}

Interpretation: State Memory is strongest for current-state questions, but it cannot answer arbitrary long-document details unless those details are extracted into structured state. RAG remains appropriate for unstructured document QA. The practical architecture is hybrid: State Memory for evolving world state, RAG for large document corpora.
`;
}

export async function runMixedExperiment({
  eventCount = 1000,
  pageCount = 100,
  documentQuestions = 60,
  ragTopK = 12,
  documentTopK = 8,
  stateLimit = 8,
  seed = 42,
  resultsDir = "results/mixed"
} = {}) {
  const stateDataset = buildDataset({ eventCount, seed });
  const documentDataset = buildDocumentDataset({
    pageCount,
    paragraphsPerPage: 3,
    questionLimit: documentQuestions
  });
  const worldState = buildWorldState(stateDataset.events);
  const currentQuestions = stateDataset.questions
    .filter((question) => question.obsoleteAnswers.length > 0)
    .map((question) => withQuestionType(question, "current_state"));
  const stableQuestions = stateDataset.questions
    .filter((question) => question.obsoleteAnswers.length === 0)
    .map((question) => withQuestionType(question, "stable_state"));
  const questions = [...currentQuestions, ...stableQuestions, ...documentDataset.questions];

  const ragOnlyResults = evaluateRagOnly({
    events: stateDataset.events,
    documents: documentDataset.documents,
    questions,
    ragTopK,
    documentTopK
  });
  const stateOnlyResults = evaluateStateOnly({ worldState, questions, stateLimit });
  const hybridResults = evaluateHybrid({
    events: stateDataset.events,
    documents: documentDataset.documents,
    worldState,
    questions,
    ragTopK,
    documentTopK,
    stateLimit
  });

  const summary = {
    dataset: {
      events: stateDataset.events.length,
      documentPages: documentDataset.meta.pageCount,
      documentChunks: documentDataset.meta.chunks,
      questions: questions.length,
      currentStateQuestions: currentQuestions.length,
      stableStateQuestions: stableQuestions.length,
      documentQuestions: documentDataset.questions.length
    },
    configuration: {
      ragTopK,
      documentTopK,
      stateLimit
    },
    ragOnly: summarizeResults(ragOnlyResults),
    stateOnly: summarizeResults(stateOnlyResults),
    hybrid: summarizeResults(hybridResults),
    byType: {
      ragOnly: groupSummary(ragOnlyResults),
      stateOnly: groupSummary(stateOnlyResults),
      hybrid: groupSummary(hybridResults)
    }
  };

  await writeJson(`${resultsDir}/rag-only-results.json`, ragOnlyResults);
  await writeJson(`${resultsDir}/state-only-results.json`, stateOnlyResults);
  await writeJson(`${resultsDir}/hybrid-results.json`, hybridResults);
  await writeJson(`${resultsDir}/summary.json`, summary);
  await writeText(`${resultsDir}/summary.md`, buildSummaryMarkdown(summary));

  return summary;
}
