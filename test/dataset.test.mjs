import assert from "node:assert/strict";
import test from "node:test";
import { buildDataset } from "../src/dataset/generateDataset.mjs";
import { buildDocumentDataset } from "../src/dataset/documentDataset.mjs";

function ids(values) {
  return values.map((value) => value.id);
}

test("buildDataset is deterministic and internally consistent", () => {
  const first = buildDataset({ eventCount: 120, seed: 7 });
  const second = buildDataset({ eventCount: 120, seed: 7 });

  assert.deepEqual(first, second);
  assert.equal(first.events.length, 120);
  assert.equal(first.questions.length, 42);
  assert.equal(new Set(ids(first.events)).size, first.events.length);
  assert.equal(new Set(ids(first.questions)).size, first.questions.length);

  for (const question of first.questions) {
    assert.deepEqual(first.groundTruth[question.id], {
      subject: question.subject,
      predicate: question.predicate,
      expected: question.expected,
      obsoleteAnswers: question.obsoleteAnswers
    });
  }
});

test("current-state questions point at final mutable values", () => {
  const dataset = buildDataset({ eventCount: 150, seed: 42 });
  const runtimeQuestion = dataset.questions.find(
    (question) => question.subject === "Reflex" && question.predicate === "runtime"
  );
  const runtimeFacts = dataset.events.flatMap((event) =>
    event.facts.filter((fact) => fact.subject === "Reflex" && fact.predicate === "runtime")
  );

  assert.equal(runtimeQuestion.expected, "reactive graph runtime");
  assert.deepEqual(runtimeQuestion.obsoleteAnswers, ["event-sourced runtime", "actor runtime"]);
  assert.equal(runtimeFacts.at(-1).object, runtimeQuestion.expected);
});

test("document dataset separates documents from generated questions", () => {
  const dataset = buildDocumentDataset({ pageCount: 4, paragraphsPerPage: 2, questionLimit: 3 });

  assert.equal(dataset.documents.length, 8);
  assert.equal(dataset.questions.length, 3);
  assert.equal(dataset.meta.questions, 3);
  assert.ok(dataset.questions.every((question) => question.questionType === "document_detail"));
  assert.ok(dataset.documents.every((document) => !("question" in document)));
});
