import { normalize } from "../shared/text.mjs";

function valuesEqual(actual, expected) {
  return normalize(actual) === normalize(expected);
}

function valueIncluded(actual, expected) {
  const actualText = normalize(actual);
  const expectedText = normalize(expected);
  return actualText === expectedText || actualText.includes(expectedText);
}

function arrayAnswerCorrect(actualValues, expectedValues) {
  const actual = new Set(actualValues.map(normalize));
  return expectedValues.every((value) => actual.has(normalize(value)));
}

export function gradeAnswer(question, answer) {
  const answered = answer.values.length > 0;

  const correct = Array.isArray(question.expected)
    ? arrayAnswerCorrect(answer.values, question.expected)
    : answer.values.some((value) => valuesEqual(value, question.expected));

  const staleFactError = answer.values.some((value) =>
    question.obsoleteAnswers.some((obsolete) => valuesEqual(value, obsolete))
  );

  return {
    answered,
    correct,
    staleFactError
  };
}

export function gradeGeneratedAnswer(question, answerText) {
  const answer = String(answerText ?? "").trim();
  const normalizedAnswer = normalize(answer);
  const answered = normalizedAnswer.length > 0 && normalizedAnswer !== "unknown";

  const correct = Array.isArray(question.expected)
    ? question.expected.every((value) => valueIncluded(answer, value))
    : valueIncluded(answer, question.expected);

  const staleFactError = question.obsoleteAnswers.some((obsolete) =>
    valueIncluded(answer, obsolete)
  );

  return {
    answered,
    correct: answered && correct,
    staleFactError
  };
}

function average(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function safeRate(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function f1Score(precision, recall) {
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

function classifyError(result) {
  if (result.correct) return "none";
  if (result.staleFactError) return "stale_fact";
  if (result.contextHasGoldFact === false) return "missing_fact";
  if (!result.answered) return "unknown_failed";
  return "answer_mismatch";
}

export function summarizeResults(results) {
  const total = results.length;
  const answered = results.filter((result) => result.answered).length;
  const correct = results.filter((result) => result.correct).length;
  const stale = results.filter((result) => result.staleFactError).length;
  const currentFactResults = results.filter((result) =>
    ["current_fact", "current_state"].includes(result.questionType)
  );
  const currentFactCount = currentFactResults.length;
  const currentFactCorrect = currentFactResults.filter((result) => result.correct).length;
  const currentFactStale = currentFactResults.filter((result) => result.staleFactError).length;
  const contextHits = results.filter((result) => result.contextHasGoldFact).length;
  const recallAccuracy = safeRate(correct, total);
  const precision = safeRate(correct, answered);
  const averageContextTokens = average(results.map((result) => result.contextTokens));
  const averageLatencyMs = average(results.map((result) => result.latencyMs));
  const errorTaxonomy = {};

  for (const result of results) {
    const type = result.errorType ?? classifyError(result);
    errorTaxonomy[type] = (errorTaxonomy[type] ?? 0) + 1;
  }

  return {
    totalQuestions: total,
    answered,
    correct,
    exactMatchAccuracy: recallAccuracy,
    answerAccuracy: recallAccuracy,
    recallAccuracy,
    precision,
    f1Score: f1Score(precision, recallAccuracy),
    currentFactQuestions: currentFactCount,
    currentFactAccuracy: safeRate(currentFactCorrect, currentFactCount),
    staleFactErrorRate: safeRate(stale, total),
    currentStaleFactErrorRate: safeRate(currentFactStale, currentFactCount),
    obsoleteFactRejectionRate: safeRate(currentFactCount - currentFactStale, currentFactCount),
    contextHitRate: safeRate(contextHits, total),
    meanReciprocalRank: average(results.map((result) => result.reciprocalRank ?? 0)),
    averageContextTokens,
    averageLatencyMs,
    contextEfficiency: safeRate(recallAccuracy, averageContextTokens),
    latencyEfficiency: safeRate(recallAccuracy, averageLatencyMs),
    errorTaxonomy
  };
}

export function pairedComparison(leftResults, rightResults) {
  const rightById = new Map(rightResults.map((result) => [result.questionId, result]));
  const comparison = {
    bothCorrect: 0,
    rightCorrectLeftWrong: 0,
    leftCorrectRightWrong: 0,
    bothWrong: 0
  };

  for (const left of leftResults) {
    const right = rightById.get(left.questionId);
    if (!right) continue;

    if (left.correct && right.correct) comparison.bothCorrect += 1;
    else if (!left.correct && right.correct) comparison.rightCorrectLeftWrong += 1;
    else if (left.correct && !right.correct) comparison.leftCorrectRightWrong += 1;
    else comparison.bothWrong += 1;
  }

  return comparison;
}
