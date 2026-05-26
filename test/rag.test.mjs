import assert from "node:assert/strict";
import test from "node:test";
import { answerFromRetrievedEvents, answerLatestFromRetrievedEvents } from "../src/rag/answer.mjs";
import { createRetriever, retrieveEvents, retrieveEventsWithRecency } from "../src/rag/index.mjs";

const events = [
  {
    id: "old",
    timestamp: "2026-01-01T10:00:00.000Z",
    text: "Initial note: Task checkout status is todo.",
    facts: [{ subject: "Task.checkout", predicate: "status", object: "todo" }]
  },
  {
    id: "new",
    timestamp: "2026-01-01T11:00:00.000Z",
    text: "Final update: Task checkout status is done.",
    facts: [{ subject: "Task.checkout", predicate: "status", object: "done" }]
  }
];

const question = {
  question: "What is the checkout status?",
  subject: "Task.checkout",
  predicate: "status",
  expected: "done",
  obsoleteAnswers: ["todo"]
};

test("lexical retriever keeps stable ordering for equal relevance", () => {
  const retrieved = retrieveEvents(events, "Task checkout status", { topK: 2 });

  assert.deepEqual(
    retrieved.map((event) => event.id),
    ["old", "new"]
  );
});

test("recency retriever can prioritize recent matching events", () => {
  const retrieved = retrieveEventsWithRecency(events, "Task checkout status", {
    topK: 1,
    recencyWeight: 1
  });

  assert.equal(retrieved[0].id, "new");
});

test("latest answerer resolves current value from retrieved history", () => {
  assert.equal(answerFromRetrievedEvents(question, events).answer, "todo");
  assert.equal(answerLatestFromRetrievedEvents(question, events).answer, "done");
});

test("RAG facade exposes named lexical retriever", () => {
  const retriever = createRetriever("lexical");

  assert.equal(typeof retriever.retrieveEvents, "function");
  assert.throws(() => createRetriever("unknown"), /Unknown retriever/u);
});
