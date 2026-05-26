import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildDataset } from "../src/dataset/generateDataset.mjs";
import { evaluateRag, evaluateStateMemory, runExperiment as runDeterministicExperiment } from "../src/experiments/deterministic.mjs";
import { availableExperiments, runExperiment } from "../src/experiments/runner.mjs";
import { buildWorldState } from "../src/state-memory/worldState.mjs";

test("deterministic evaluators produce one result per question", () => {
  const dataset = buildDataset({ eventCount: 140, seed: 42 });
  const questions = dataset.questions.slice(0, 5);
  const worldState = buildWorldState(dataset.events);
  const ragResults = evaluateRag(dataset.events, questions, { topK: 6 });
  const stateResults = evaluateStateMemory(worldState, questions, { limit: 4 });

  assert.equal(ragResults.length, questions.length);
  assert.equal(stateResults.length, questions.length);
  assert.ok(stateResults.every((result) => result.correct));
  assert.ok(stateResults.every((result) => result.contextHasGoldFact));
});

test("experiment runner exposes named experiments and rejects unknown names", async () => {
  assert.ok(availableExperiments().includes("deterministic"));
  assert.ok(availableExperiments().includes("stress"));

  await assert.rejects(
    () => runExperiment({ experiment: "not-a-real-experiment" }),
    /Unknown experiment/u
  );
});

test("deterministic experiment writes a coherent result bundle", async () => {
  const resultsDir = await mkdtemp(join(tmpdir(), "coursework-results-"));
  const summary = await runDeterministicExperiment({
    eventsPath: "data/events.jsonl",
    questionsPath: "data/questions.json",
    resultsDir,
    ragTopK: 6,
    stateLimit: 4
  });

  assert.equal(summary.dataset.questions, 42);
  assert.equal(summary.stateMemory.exactMatchAccuracy, 1);
  assert.ok(summary.rag.contextHitRate > 0);
  assert.ok(summary.stateMemory.averageLatencyMs >= 0);
});
