import { normalize, tokenize } from "../shared/text.mjs";

const ACTIVE_STATUS = "active";

class FactSelection {
  constructor() {
    this.factsById = new Map();
  }

  addFact(fact) {
    if (!this.factsById.has(fact.id)) {
      this.factsById.set(fact.id, fact);
    }
  }

  addFacts(facts) {
    for (const fact of facts) {
      this.addFact(fact);
    }
  }

  addCandidates(candidates) {
    for (const candidate of candidates) {
      this.addFact(candidate.fact);
    }
  }

  take(limit) {
    const facts = [];

    for (const fact of this.factsById.values()) {
      if (facts.length >= limit) break;
      facts.push(fact);
    }

    return facts;
  }
}

function isActiveFact(fact) {
  return fact.status === ACTIVE_STATUS;
}

function factMatchesQuestionSlot(fact, question) {
  return fact.subject === question.subject && fact.predicate === question.predicate;
}

function scoreFactAgainstQuestion(fact, question) {
  const queryTokens = new Set(tokenize(question.question ?? question));
  const factTokens = tokenize(`${fact.subject} ${fact.predicate} ${fact.object}`);
  const slotTokens = tokenize(`${fact.subject} ${fact.predicate}`);
  const objectTokens = tokenize(fact.object);

  let score = 0;
  for (const token of factTokens) {
    if (queryTokens.has(token)) score += 1;
  }
  for (const token of slotTokens) {
    if (queryTokens.has(token)) score += 2;
  }
  for (const token of objectTokens) {
    if (queryTokens.has(token)) score += 0.5;
  }

  if (fact.subject === question.subject) score += 5;
  if (fact.predicate === question.predicate) score += 4;
  if (fact.status === ACTIVE_STATUS) score += 2;
  if (fact.status === "obsolete") score -= 8;

  score += fact.confidence ?? 0;
  return score;
}

function createFactCandidate(fact, question) {
  return {
    fact,
    score: scoreFactAgainstQuestion(fact, question),
    normalizedId: normalize(fact.id)
  };
}

function compareFactCandidates(left, right) {
  return right.score - left.score || left.normalizedId.localeCompare(right.normalizedId);
}

function rankedActiveFactCandidates(facts, question) {
  const candidates = [];

  for (const fact of facts) {
    if (!isActiveFact(fact)) continue;

    const candidate = createFactCandidate(fact, question);
    if (candidate.score > 0) {
      candidates.push(candidate);
    }
  }

  candidates.sort(compareFactCandidates);
  return candidates;
}

function activeQuestionSlotFacts(facts, question) {
  const slotFacts = [];

  for (const fact of facts) {
    if (isActiveFact(fact) && factMatchesQuestionSlot(fact, question)) {
      slotFacts.push(fact);
    }
  }

  return slotFacts;
}

function activeHopFacts(facts, question) {
  if (!Array.isArray(question.hops) || question.hops.length <= 1) return [];

  const selected = [];
  let subjects = [question.hops[0].subject ?? question.subject];

  for (const hop of question.hops) {
    const nextSubjects = [];

    for (const subject of subjects) {
      for (const fact of facts) {
        if (isActiveFact(fact) && fact.subject === subject && fact.predicate === hop.predicate) {
          selected.push(fact);
          nextSubjects.push(fact.object);
        }
      }
    }

    subjects = nextSubjects;
    if (subjects.length === 0) break;
  }

  return selected;
}

export function selectRelevantFacts(worldState, question, { limit = 8 } = {}) {
  const requiredSlotFacts = [
    ...activeQuestionSlotFacts(worldState.facts, question),
    ...activeHopFacts(worldState.facts, question)
  ];
  const rankedCandidates = rankedActiveFactCandidates(worldState.facts, question);
  const selectionLimit = Math.max(limit, requiredSlotFacts.length);
  const selection = new FactSelection();

  selection.addFacts(requiredSlotFacts);
  selection.addCandidates(rankedCandidates);

  return selection.take(selectionLimit);
}
