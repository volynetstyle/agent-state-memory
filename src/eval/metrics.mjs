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

function createPrng(seed) {
  let state = seed >>> 0;

  return function next() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function quantile(sortedValues, probability) {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = probability * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function bootstrapSample(results, random) {
  const sample = [];

  for (let index = 0; index < results.length; index += 1) {
    sample.push(results[Math.floor(random() * results.length)]);
  }

  return sample;
}

function interval(values, confidenceLevel) {
  const alpha = 1 - confidenceLevel;
  const sorted = [...values].sort((left, right) => left - right);

  return {
    lower: quantile(sorted, alpha / 2),
    upper: quantile(sorted, 1 - alpha / 2)
  };
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

export function bootstrapMetricIntervals(
  results,
  { iterations = 1000, confidenceLevel = 0.95, seed = 12345 } = {}
) {
  if (results.length === 0) {
    return {
      iterations,
      confidenceLevel,
      seed,
      exactMatchAccuracy: { estimate: 0, lower: 0, upper: 0 },
      f1Score: { estimate: 0, lower: 0, upper: 0 }
    };
  }

  const random = createPrng(seed);
  const exactMatchValues = [];
  const f1Values = [];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const summary = summarizeResults(bootstrapSample(results, random));
    exactMatchValues.push(summary.exactMatchAccuracy);
    f1Values.push(summary.f1Score);
  }

  const pointEstimate = summarizeResults(results);
  const exactMatchInterval = interval(exactMatchValues, confidenceLevel);
  const f1Interval = interval(f1Values, confidenceLevel);

  return {
    iterations,
    confidenceLevel,
    seed,
    exactMatchAccuracy: {
      estimate: pointEstimate.exactMatchAccuracy,
      ...exactMatchInterval
    },
    f1Score: {
      estimate: pointEstimate.f1Score,
      ...f1Interval
    }
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

function binomialLowerTail(n, k) {
  let term = 2 ** -n;
  let sum = term;

  for (let i = 1; i <= k; i += 1) {
    term *= (n - i + 1) / i;
    sum += term;
  }

  return sum;
}

export function mcnemarExactTest(leftResults, rightResults) {
  const comparison = pairedComparison(leftResults, rightResults);
  const discordant =
    comparison.rightCorrectLeftWrong + comparison.leftCorrectRightWrong;
  const smallerDiscordant = Math.min(
    comparison.rightCorrectLeftWrong,
    comparison.leftCorrectRightWrong
  );
  const pValue =
    discordant === 0 ? 1 : Math.min(1, 2 * binomialLowerTail(discordant, smallerDiscordant));
  const statistic =
    discordant === 0
      ? 0
      : ((Math.abs(comparison.rightCorrectLeftWrong - comparison.leftCorrectRightWrong) - 1) ** 2) /
        discordant;

  return {
    ...comparison,
    pairedCount:
      comparison.bothCorrect +
      comparison.rightCorrectLeftWrong +
      comparison.leftCorrectRightWrong +
      comparison.bothWrong,
    discordant,
    statistic,
    pValue
  };
}
