import assert from "node:assert/strict";
import test from "node:test";
import { answerFromFacts } from "../src/state-memory/buildPrompt.mjs";
import { buildDefensiveWorldState, defensiveStateDiagnostics } from "../src/state-memory/defensiveState.mjs";
import { selectRelevantFacts } from "../src/state-memory/selectState.mjs";
import { buildWorldState } from "../src/state-memory/worldState.mjs";

const events = [
  {
    id: "e1",
    timestamp: "2026-01-01T10:00:00.000Z",
    facts: [
      {
        subject: "Task.checkout",
        predicate: "status",
        object: "todo",
        mutable: true,
        confidence: 0.95
      }
    ]
  },
  {
    id: "e2",
    timestamp: "2026-01-01T11:00:00.000Z",
    facts: [
      {
        subject: "Task.checkout",
        predicate: "status",
        object: "done",
        mutable: true,
        confidence: 0.95
      }
    ]
  }
];

const question = {
  id: "q1",
  question: "What is the checkout status?",
  subject: "Task.checkout",
  predicate: "status",
  expected: "done",
  obsoleteAnswers: ["todo"]
};

test("world state marks replaced mutable facts obsolete", () => {
  const worldState = buildWorldState(events);
  const oldFact = worldState.facts.find((fact) => fact.object === "todo");
  const newFact = worldState.facts.find((fact) => fact.object === "done");

  assert.equal(oldFact.status, "obsolete");
  assert.equal(oldFact.validTo, events[1].timestamp);
  assert.equal(newFact.status, "active");
});

test("state selection always preserves direct active slot facts", () => {
  const worldState = buildWorldState(events);
  const selected = selectRelevantFacts(worldState, question, { limit: 1 });

  assert.equal(selected.length, 1);
  assert.equal(selected[0].object, "done");
  assert.equal(answerFromFacts(question, selected).answer, "done");
});

test("defensive state detects near-simultaneous conflicts", () => {
  const conflictingEvents = [
    events[0],
    {
      id: "e2",
      timestamp: "2026-01-01T10:01:00.000Z",
      facts: [
        {
          subject: "Task.checkout",
          predicate: "status",
          object: "done",
          mutable: true,
          confidence: 0.95
        }
      ]
    }
  ];
  const worldState = buildDefensiveWorldState(conflictingEvents, {
    confidenceThreshold: 0.75,
    conflictWindowMs: 2 * 60 * 1000
  });
  const diagnostics = defensiveStateDiagnostics(worldState, question);

  assert.equal(worldState.conflicts.length, 1);
  assert.equal(diagnostics.uncertain, true);
  assert.equal(diagnostics.slotConflicts.length, 1);
});
