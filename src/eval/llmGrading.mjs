import { normalize, tokenize } from "../shared/text.mjs";

const PREFIXES = [
  "the answer is",
  "answer is",
  "answer",
  "the current topic is",
  "current topic is",
  "the current deadline is",
  "current deadline is",
  "it is",
  "it's",
  "this is"
];

function stripPrefix(value) {
  let next = value;

  for (const prefix of PREFIXES) {
    if (next.startsWith(prefix)) {
      next = next.slice(prefix.length).trim();
    }
  }

  return next;
}

export function normalizeLlmAnswer(value) {
  return stripPrefix(normalize(value).replace(/\bunknown\b.+$/u, "unknown")).trim();
}

function expectedValues(question) {
  if (question.unanswerable) return ["unknown"];
  return Array.isArray(question.expected) ? question.expected : [question.expected];
}

function normalizedExpected(question) {
  return expectedValues(question).map(normalizeLlmAnswer);
}

function answerUsesOnlyContext(answer, context) {
  const answerTokens = tokenize(answer);
  const contextTokens = new Set(tokenize(context));
  return answerTokens.length > 0 && answerTokens.every((token) => contextTokens.has(token));
}

export function gradeLlmAnswer(question, rawAnswer, { contextHasGoldFact = false, context = "" } = {}) {
  const normalizedAnswer = normalizeLlmAnswer(rawAnswer);
  const expected = normalizedExpected(question);
  const exactExpected = Array.isArray(question.expected)
    ? question.expected.join(", ")
    : String(question.expected ?? "UNKNOWN");
  const exactMatch = String(rawAnswer ?? "").trim() === exactExpected;
  const isUnknown = normalizedAnswer === "unknown";
  const normalizedMatch = question.unanswerable
    ? isUnknown
    : expected.every((value) => normalizedAnswer.includes(value));
  const answered = normalizedAnswer.length > 0 && !isUnknown;
  const promptCompliant = question.unanswerable
    ? isUnknown
    : contextHasGoldFact
      ? isUnknown || normalizedMatch
      : isUnknown;
  const possibleHallucination = question.unanswerable
    ? !isUnknown
    : !isUnknown && !normalizedMatch && !answerUsesOnlyContext(rawAnswer, context);

  let errorType = "none";
  if (!normalizedMatch && question.unanswerable) errorType = "unknown_failed";
  else if (!normalizedMatch && !contextHasGoldFact) errorType = "missing_fact";
  else if (!normalizedMatch && possibleHallucination) errorType = "possible_hallucination";
  else if (!normalizedMatch && !possibleHallucination) errorType = "incomplete_answer";
  else if (!normalizedMatch) errorType = "answer_mismatch";

  return {
    answered,
    correct: normalizedMatch,
    exactMatch,
    normalizedMatch,
    normalizedAnswer,
    promptCompliant,
    possibleHallucination,
    unknownCorrect: question.unanswerable ? isUnknown : null,
    errorType
  };
}

function average(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate(count, total) {
  return total === 0 ? 0 : count / total;
}

export function summarizeLlmResults(results) {
  const total = results.length;
  const unknown = results.filter((result) => result.unanswerable);
  const byType = {};

  for (const result of results) {
    byType[result.questionType] ??= [];
    byType[result.questionType].push(result);
  }

  const summary = {
    totalQuestions: total,
    exactMatchAccuracy: rate(results.filter((result) => result.exactMatch).length, total),
    normalizedAccuracy: rate(results.filter((result) => result.normalizedMatch).length, total),
    promptComplianceRate: rate(results.filter((result) => result.promptCompliant).length, total),
    hallucinationRate: rate(results.filter((result) => result.possibleHallucination).length, total),
    unknownAccuracy: rate(unknown.filter((result) => result.unknownCorrect).length, unknown.length),
    averageContextTokens: average(results.map((result) => result.contextTokens)),
    averageRetrievalMs: average(results.map((result) => result.retrievalMs)),
    averagePromptBuildMs: average(results.map((result) => result.promptBuildMs)),
    averageLlmMs: average(results.map((result) => result.llmMs)),
    averageTotalMs: average(results.map((result) => result.totalMs))
  };

  summary.byType = Object.fromEntries(
    Object.entries(byType).map(([type, typeResults]) => [type, summarizeLlmResultsFlat(typeResults)])
  );

  return summary;
}

function summarizeLlmResultsFlat(results) {
  const total = results.length;
  const unknown = results.filter((result) => result.unanswerable);

  return {
    totalQuestions: total,
    exactMatchAccuracy: rate(results.filter((result) => result.exactMatch).length, total),
    normalizedAccuracy: rate(results.filter((result) => result.normalizedMatch).length, total),
    promptComplianceRate: rate(results.filter((result) => result.promptCompliant).length, total),
    hallucinationRate: rate(results.filter((result) => result.possibleHallucination).length, total),
    unknownAccuracy: rate(unknown.filter((result) => result.unknownCorrect).length, unknown.length),
    averageContextTokens: average(results.map((result) => result.contextTokens)),
    averageLlmMs: average(results.map((result) => result.llmMs)),
    averageTotalMs: average(results.map((result) => result.totalMs))
  };
}
