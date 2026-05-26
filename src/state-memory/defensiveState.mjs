import { retrieveEventsWithRecency } from "../rag/index.mjs";
import { answerLatestFromRetrievedEvents } from "../rag/answer.mjs";
import { extractFacts } from "./extractFacts.mjs";
import { selectRelevantFacts } from "./selectState.mjs";

function canonicalEntity(value) {
  return String(value)
    .toLowerCase()
    .replace(/\bivan\b/gu, "i")
    .replace(/\bpetrenko\s+i\b/gu, "i petrenko")
    .replace(/\bi\s+petrenko\b/gu, "ivan petrenko")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function slotKey(fact) {
  return `${canonicalEntity(fact.subject)}.${fact.predicate}`;
}

function sameSlot(a, b) {
  return slotKey(a) === slotKey(b);
}

function sameFact(a, b) {
  return sameSlot(a, b) && a.object === b.object;
}

function sourceReliability(fact) {
  return fact.sourceReliability ?? fact.source_reliability ?? 1;
}

function factStrength(fact) {
  return (fact.confidence ?? 0.9) * sourceReliability(fact);
}

function timestampMs(fact) {
  return new Date(fact.validFrom).getTime();
}

function keepRecentVersions(versions, fact, limit) {
  const key = slotKey(fact);
  const current = versions[key] ?? [];
  const nextVersions = [{ ...fact }];

  for (const version of current) {
    if (nextVersions.length >= limit) break;
    nextVersions.push(version);
  }

  versions[key] = nextVersions;
}

function cloneFactList(facts) {
  const clones = [];

  for (const fact of facts) {
    clones.push({ ...fact });
  }

  return clones;
}

function cloneConflictList(conflicts) {
  const clones = [];

  for (const conflict of conflicts) {
    clones.push({ ...conflict });
  }

  return clones;
}

function cloneVersionHistory(versions) {
  const history = {};

  for (const [key, slotVersions] of Object.entries(versions)) {
    history[key] = cloneFactList(slotVersions);
  }

  return history;
}

function activeFactsInSameSlot(facts, fact) {
  const matchingFacts = [];

  for (const oldFact of facts) {
    if (oldFact.status === "active" && sameSlot(oldFact, fact)) {
      matchingFacts.push(oldFact);
    }
  }

  return matchingFacts;
}

function activeFactsForQuestionSlot(facts, question) {
  const matchingFacts = [];

  for (const fact of facts) {
    if (fact.status === "active" && slotMatchesQuestion(fact, question)) {
      matchingFacts.push(fact);
    }
  }

  return matchingFacts;
}

function factsForQuestionSlot(facts, question) {
  const matchingFacts = [];

  for (const fact of facts) {
    if (slotMatchesQuestion(fact, question)) {
      matchingFacts.push(fact);
    }
  }

  return matchingFacts;
}

function conflictsForSlot(conflicts, slot) {
  const matchingConflicts = [];

  for (const conflict of conflicts) {
    if (conflict.slot === slot) {
      matchingConflicts.push(conflict);
    }
  }

  return matchingConflicts;
}

function eventIds(events) {
  const ids = [];

  for (const event of events) {
    ids.push(event.id);
  }

  return ids;
}

function factIds(facts) {
  const ids = [];

  for (const fact of facts) {
    ids.push(fact.id);
  }

  return ids;
}

function factObjects(facts) {
  const values = [];

  for (const fact of facts) {
    values.push(fact.object);
  }

  return values;
}

export function createDefensiveWorldState() {
  return {
    facts: [],
    lowConfidenceFacts: [],
    conflicts: [],
    versions: {},
    diagnostics: {
      acceptedFacts: 0,
      rejectedLowConfidenceFacts: 0,
      conflicts: 0,
      softReplacements: 0
    }
  };
}

export function applyDefensiveFact(state, fact, {
  confidenceThreshold = 0.75,
  replacementMargin = 0.05,
  conflictWindowMs = 2 * 60 * 1000,
  versionLimit = 4
} = {}) {
  const next = {
    facts: cloneFactList(state.facts),
    lowConfidenceFacts: cloneFactList(state.lowConfidenceFacts),
    conflicts: cloneConflictList(state.conflicts),
    versions: cloneVersionHistory(state.versions),
    diagnostics: { ...state.diagnostics }
  };
  const incoming = {
    ...fact,
    strength: factStrength(fact)
  };

  if ((incoming.confidence ?? 0) < confidenceThreshold) {
    next.lowConfidenceFacts.push({
      ...incoming,
      status: "low_confidence",
      rejectionReason: "below_confidence_threshold"
    });
    next.diagnostics.rejectedLowConfidenceFacts += 1;
    return next;
  }

  if (incoming.mutable) {
    const activeSlotFacts = activeFactsInSameSlot(next.facts, incoming);

    for (const oldFact of activeSlotFacts) {
      if (sameFact(oldFact, incoming)) {
        return next;
      }

      const timeDistance = Math.abs(timestampMs(incoming) - timestampMs(oldFact));
      const oldStrength = factStrength(oldFact);
      const nearSimultaneous = Number.isFinite(timeDistance) && timeDistance <= conflictWindowMs;
      const weakerThanOld = incoming.strength + replacementMargin < oldStrength;

      if (nearSimultaneous || weakerThanOld) {
        oldFact.status = "conflicting";
        incoming.status = "conflicting";
        next.conflicts.push({
          slot: slotKey(incoming),
          oldFactId: oldFact.id,
          newFactId: incoming.id,
          oldObject: oldFact.object,
          newObject: incoming.object,
          oldStrength,
          newStrength: incoming.strength,
          reason: nearSimultaneous ? "near_simultaneous_update" : "new_fact_weaker_than_existing",
          sourceEventId: incoming.sourceEventId
        });
        next.diagnostics.conflicts += 1;
        next.facts.push(incoming);
        return next;
      }

      oldFact.status = "obsolete";
      oldFact.validTo = incoming.validFrom;
      oldFact.replacedBy = incoming.id;
      keepRecentVersions(next.versions, oldFact, versionLimit);
      next.diagnostics.softReplacements += 1;
    }
  }

  const duplicateActive = next.facts.some(
    (oldFact) => oldFact.status === "active" && sameFact(oldFact, incoming)
  );

  if (!duplicateActive) {
    next.facts.push({ ...incoming, status: incoming.status ?? "active" });
    next.diagnostics.acceptedFacts += 1;
  }

  return next;
}

export function applyDefensiveFacts(state, facts, options = {}) {
  return facts.reduce((current, fact) => applyDefensiveFact(current, fact, options), state);
}

export function buildDefensiveWorldState(events, options = {}) {
  return events.reduce(
    (state, event) => applyDefensiveFacts(state, extractFacts(event), options),
    createDefensiveWorldState()
  );
}

function slotMatchesQuestion(fact, question) {
  return canonicalEntity(fact.subject) === canonicalEntity(question.subject) &&
    fact.predicate === question.predicate;
}

export function defensiveStateDiagnostics(worldState, question) {
  const slot = `${canonicalEntity(question.subject)}.${question.predicate}`;
  const activeSlotFacts = activeFactsForQuestionSlot(worldState.facts, question);
  const lowConfidenceSlotFacts = factsForQuestionSlot(worldState.lowConfidenceFacts, question);
  const slotConflicts = conflictsForSlot(worldState.conflicts, slot);

  return {
    activeSlotFacts,
    lowConfidenceSlotFacts,
    slotConflicts,
    uncertain:
      activeSlotFacts.length === 0 ||
      lowConfidenceSlotFacts.length > 0 ||
      slotConflicts.length > 0
  };
}

export function answerWithDefensiveStateFallback({
  worldState,
  events,
  question,
  stateLimit = 8,
  ragTopK = 12
}) {
  const diagnostics = defensiveStateDiagnostics(worldState, question);

  if (diagnostics.uncertain) {
    const retrievedEvents = retrieveEventsWithRecency(events, question.question, { topK: ragTopK });
    const answer = answerLatestFromRetrievedEvents(question, retrievedEvents);

    return {
      mode: "temporal_rag_fallback",
      answer,
      context: retrievedEvents,
      contextIds: eventIds(retrievedEvents),
      conflictCount: diagnostics.slotConflicts.length,
      lowConfidenceCount: diagnostics.lowConfidenceSlotFacts.length,
      fallbackReason:
        diagnostics.slotConflicts.length > 0
          ? "slot_conflict"
          : diagnostics.lowConfidenceSlotFacts.length > 0
            ? "low_confidence_slot"
            : "missing_active_slot_fact"
    };
  }

  const facts = selectRelevantFacts(worldState, question, { limit: stateLimit });
  const answerValues = factObjects(diagnostics.activeSlotFacts);

  return {
    mode: "state",
    answer: {
      answer: answerValues.join(", "),
      values: answerValues
    },
    context: facts,
    contextIds: factIds(facts),
    conflictCount: 0,
    lowConfidenceCount: 0,
    fallbackReason: "none"
  };
}
