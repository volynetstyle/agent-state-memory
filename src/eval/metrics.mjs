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
  const actual = new Set();

  for (const value of actualValues) {
    actual.add(normalize(value));
  }

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

function isCurrentFactResult(result) {
  return result.questionType === "current_fact" || result.questionType === "current_state";
}

function createResultSummaryCounts() {
  return {
    total: 0,
    answered: 0,
    correct: 0,
    stale: 0,
    currentFactCount: 0,
    currentFactCorrect: 0,
    currentFactStale: 0,
    contextHits: 0,
    contextTokenSum: 0,
    latencyMsSum: 0,
    reciprocalRankSum: 0,
    errorTaxonomy: {}
  };
}

function countResult(summary, result) {
  summary.total += 1;
  summary.contextTokenSum += result.contextTokens;
  summary.latencyMsSum += result.latencyMs;
  summary.reciprocalRankSum += result.reciprocalRank ?? 0;

  if (result.answered) summary.answered += 1;
  if (result.correct) summary.correct += 1;
  if (result.staleFactError) summary.stale += 1;
  if (result.contextHasGoldFact) summary.contextHits += 1;

  if (isCurrentFactResult(result)) {
    summary.currentFactCount += 1;
    if (result.correct) summary.currentFactCorrect += 1;
    if (result.staleFactError) summary.currentFactStale += 1;
  }

  const type = result.errorType ?? classifyError(result);
  summary.errorTaxonomy[type] = (summary.errorTaxonomy[type] ?? 0) + 1;
}

export function summarizeResults(results) {
  const counts = createResultSummaryCounts();

  for (const result of results) {
    countResult(counts, result);
  }

  const recallAccuracy = safeRate(counts.correct, counts.total);
  const precision = safeRate(counts.correct, counts.answered);
  const averageContextTokens = safeRate(counts.contextTokenSum, counts.total);
  const averageLatencyMs = safeRate(counts.latencyMsSum, counts.total);

  return {
    totalQuestions: counts.total,
    answered: counts.answered,
    correct: counts.correct,
    exactMatchAccuracy: recallAccuracy,
    answerAccuracy: recallAccuracy,
    recallAccuracy,
    precision,
    f1Score: f1Score(precision, recallAccuracy),
    currentFactQuestions: counts.currentFactCount,
    currentFactAccuracy: safeRate(counts.currentFactCorrect, counts.currentFactCount),
    staleFactErrorRate: safeRate(counts.stale, counts.total),
    currentStaleFactErrorRate: safeRate(counts.currentFactStale, counts.currentFactCount),
    obsoleteFactRejectionRate: safeRate(
      counts.currentFactCount - counts.currentFactStale,
      counts.currentFactCount
    ),
    contextHitRate: safeRate(counts.contextHits, counts.total),
    meanReciprocalRank: safeRate(counts.reciprocalRankSum, counts.total),
    averageContextTokens,
    averageLatencyMs,
    contextEfficiency: safeRate(recallAccuracy, averageContextTokens),
    latencyEfficiency: safeRate(recallAccuracy, averageLatencyMs),
    errorTaxonomy: counts.errorTaxonomy
  };
}

function resultsByQuestionId(results) {
  const byId = new Map();

  for (const result of results) {
    byId.set(result.questionId, result);
  }

  return byId;
}

export function pairedComparison(leftResults, rightResults) {
  const rightById = resultsByQuestionId(rightResults);
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
