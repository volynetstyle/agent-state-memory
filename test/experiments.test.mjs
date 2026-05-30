import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildDataset } from "../src/dataset/generateDataset.mjs";
import { evaluateRag, evaluateStateMemory, runExperiment as runDeterministicExperiment } from "../src/experiments/deterministic.mjs";
import { availableExperiments, runExperiment } from "../src/experiments/runner.mjs";
import { retrieveEventsWithVector } from "../src/rag/index.mjs";
import { buildExtractionPrompt, factsFromLlmText } from "../src/state-memory/llmExtractor.mjs";
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
  assert.ok(availableExperiments().includes("extractor"));
  assert.ok(availableExperiments().includes("real"));
  assert.ok(availableExperiments().includes("stress"));

  await assert.rejects(
    () => runExperiment({ experiment: "not-a-real-experiment" }),
    /Unknown experiment/u
  );
});

test("extractor benchmark measures extraction and downstream QA degradation", async () => {
  const resultsDir = await mkdtemp(join(tmpdir(), "coursework-extractor-results-"));
  const summary = await runExperiment({
    experiment: "extractor",
    resultsDir
  });
  const gold = summary.extractors.find((extractor) => extractor.key === "gold");
  const rule = summary.extractors.find((extractor) => extractor.key === "rule");

  assert.equal(summary.dataset.goldFacts, 21);
  assert.equal(gold.metrics.extractionRecall, 1);
  assert.equal(gold.qa.exactMatchAccuracy, 1);
  assert.ok(rule.metrics.extractionRecall < gold.metrics.extractionRecall);
  assert.ok(rule.qa.exactMatchAccuracy < gold.qa.exactMatchAccuracy);
});

test("real trace experiment compares State Memory with external memory baseline", async () => {
  const resultsDir = await mkdtemp(join(tmpdir(), "coursework-real-results-"));
  const summary = await runExperiment({
    experiment: "real",
    resultsDir,
    langChainWindowSize: 6
  });

  assert.equal(summary.dataset.events, 12);
  assert.equal(summary.dataset.questions, 8);
  assert.equal(summary.stateMemory.exactMatchAccuracy, 1);
  assert.ok(summary.langChainBufferMemory.exactMatchAccuracy < summary.stateMemory.exactMatchAccuracy);
  assert.equal(summary.extractor.mode, "annotated-real-trace");
});

test("vector retriever returns semantically matching events", () => {
  const events = [
    { id: "a", text: "Calendar planning meeting moved to 11:30.", facts: [] },
    { id: "b", text: "Shopping laptop budget increased to 1500 USD.", facts: [] }
  ];
  const [event] = retrieveEventsWithVector(events, "meeting time", { topK: 1 });

  assert.equal(event.id, "a");
});

test("LLM extractor prompt requests structured mutable facts", () => {
  const prompt = buildExtractionPrompt({
    id: "event-1",
    timestamp: "2026-05-30T09:00:00.000Z",
    text: "Final update: project status is shipped."
  });

  assert.match(prompt, /JSON array/u);
  assert.match(prompt, /subject/u);
  assert.match(prompt, /predicate/u);
  assert.match(prompt, /mutable/u);
});

test("LLM extractor parser accepts common JSON wrappers", () => {
  const fenced = factsFromLlmText(`Here is the JSON:\n\`\`\`json\n[{"subject":"Project","predicate":"status","object":"shipped","mutable":true}]\n\`\`\``);
  const wrapped = factsFromLlmText(
    '{"facts":[{"subject":"Release","predicate":"owner","object":"Alice","mutable":true}]}'
  );

  assert.equal(fenced[0].subject, "Project");
  assert.equal(wrapped[0].predicate, "owner");
  assert.throws(() => factsFromLlmText("No durable facts found."), /invalid JSON|did not return/u);
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
