import assert from "node:assert/strict";
import test from "node:test";
import {
  bootstrapMetricIntervals,
  gradeAnswer,
  gradeGeneratedAnswer,
  mcnemarExactTest,
  pairedComparison,
  summarizeResults
} from "../src/eval/metrics.mjs";
import { gradeLlmAnswer, normalizeLlmAnswer, summarizeLlmResults } from "../src/eval/llmGrading.mjs";

test("gradeAnswer handles scalar, list and stale answers", () => {
  const scalarQuestion = {
    expected: "done",
    obsoleteAnswers: ["todo"]
  };
  const listQuestion = {
    expected: ["metrics", "experiments"],
    obsoleteAnswers: []
  };

  assert.deepEqual(gradeAnswer(scalarQuestion, { values: ["done"] }), {
    answered: true,
    correct: true,
    staleFactError: false
  });
  assert.deepEqual(gradeAnswer(scalarQuestion, { values: ["todo"] }), {
    answered: true,
    correct: false,
    staleFactError: true
  });
  assert.equal(gradeAnswer(listQuestion, { values: ["experiments", "metrics"] }).correct, true);
});

test("summarizeResults aggregates rates and paired comparison", () => {
  const left = [
    {
      questionId: "q1",
      questionType: "current_fact",
      answered: true,
      correct: true,
      staleFactError: false,
      contextHasGoldFact: true,
      contextTokens: 10,
      latencyMs: 2,
      reciprocalRank: 1
    },
    {
      questionId: "q2",
      questionType: "current_fact",
      answered: true,
      correct: false,
      staleFactError: true,
      contextHasGoldFact: false,
      contextTokens: 20,
      latencyMs: 4,
      reciprocalRank: 0
    }
  ];
  const right = [
    { questionId: "q1", correct: true },
    { questionId: "q2", correct: true }
  ];
  const summary = summarizeResults(left);

  assert.equal(summary.totalQuestions, 2);
  assert.equal(summary.exactMatchAccuracy, 0.5);
  assert.equal(summary.currentFactAccuracy, 0.5);
  assert.equal(summary.staleFactErrorRate, 0.5);
  assert.equal(summary.averageContextTokens, 15);
  assert.deepEqual(pairedComparison(left, right), {
    bothCorrect: 1,
    rightCorrectLeftWrong: 1,
    leftCorrectRightWrong: 0,
    bothWrong: 0
  });
});

test("bootstrap intervals and McNemar test use paired question outcomes", () => {
  const left = [
    { questionId: "q1", answered: true, correct: true, staleFactError: false, contextTokens: 1, latencyMs: 1 },
    { questionId: "q2", answered: true, correct: false, staleFactError: false, contextTokens: 1, latencyMs: 1 },
    { questionId: "q3", answered: true, correct: false, staleFactError: false, contextTokens: 1, latencyMs: 1 },
    { questionId: "q4", answered: true, correct: false, staleFactError: false, contextTokens: 1, latencyMs: 1 }
  ];
  const right = [
    { questionId: "q1", answered: true, correct: true, staleFactError: false, contextTokens: 1, latencyMs: 1 },
    { questionId: "q2", answered: true, correct: true, staleFactError: false, contextTokens: 1, latencyMs: 1 },
    { questionId: "q3", answered: true, correct: true, staleFactError: false, contextTokens: 1, latencyMs: 1 },
    { questionId: "q4", answered: true, correct: false, staleFactError: false, contextTokens: 1, latencyMs: 1 }
  ];
  const intervals = bootstrapMetricIntervals(right, { iterations: 100, seed: 7 });
  const testResult = mcnemarExactTest(left, right);

  assert.equal(intervals.exactMatchAccuracy.estimate, 0.75);
  assert.ok(intervals.exactMatchAccuracy.lower <= 0.75);
  assert.ok(intervals.exactMatchAccuracy.upper >= 0.75);
  assert.equal(testResult.rightCorrectLeftWrong, 2);
  assert.equal(testResult.leftCorrectRightWrong, 0);
  assert.equal(testResult.discordant, 2);
  assert.equal(testResult.pValue, 0.5);
});

test("LLM grading separates normalization, missing facts and hallucination", () => {
  const question = {
    expected: "zero-dependency Node.js",
    obsoleteAnswers: [],
    unanswerable: false
  };
  const missing = gradeLlmAnswer(question, "UNKNOWN", { contextHasGoldFact: false });
  const hallucination = gradeLlmAnswer(question, "PostgreSQL", {
    contextHasGoldFact: true,
    context: "zero-dependency Node.js"
  });

  assert.equal(normalizeLlmAnswer("The answer is UNKNOWN because no context"), "unknown");
  assert.equal(gradeGeneratedAnswer(question, "zero dependency node js").correct, true);
  assert.equal(missing.errorType, "missing_fact");
  assert.equal(hallucination.errorType, "possible_hallucination");
});

test("summarizeLlmResults builds per-type summaries", () => {
  const results = [
    {
      questionType: "current_state",
      unanswerable: false,
      exactMatch: true,
      normalizedMatch: true,
      promptCompliant: true,
      possibleHallucination: false,
      unknownCorrect: null,
      contextTokens: 10,
      retrievalMs: 1,
      promptBuildMs: 1,
      llmMs: 10,
      totalMs: 12
    },
    {
      questionType: "unknown",
      unanswerable: true,
      exactMatch: true,
      normalizedMatch: true,
      promptCompliant: true,
      possibleHallucination: false,
      unknownCorrect: true,
      contextTokens: 5,
      retrievalMs: 1,
      promptBuildMs: 1,
      llmMs: 6,
      totalMs: 8
    }
  ];
  const summary = summarizeLlmResults(results);

  assert.equal(summary.normalizedAccuracy, 1);
  assert.equal(summary.unknownAccuracy, 1);
  assert.equal(summary.byType.current_state.normalizedAccuracy, 1);
});
