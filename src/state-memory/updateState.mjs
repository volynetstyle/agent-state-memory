export function createWorldState() {
  return { facts: [] };
}

function sameSlot(a, b) {
  return a.subject === b.subject && a.predicate === b.predicate;
}

function sameFact(a, b) {
  return sameSlot(a, b) && a.object === b.object;
}

function cloneFacts(facts) {
  const clones = [];

  for (const fact of facts) {
    clones.push({ ...fact });
  }

  return clones;
}

function activeDuplicateExists(facts, fact) {
  for (const oldFact of facts) {
    if (oldFact.status === "active" && sameFact(oldFact, fact)) {
      return true;
    }
  }

  return false;
}

export function applyFact(state, fact) {
  const facts = cloneFacts(state.facts);

  if (fact.mutable) {
    for (const oldFact of facts) {
      if (
        sameSlot(oldFact, fact) &&
        oldFact.status === "active" &&
        oldFact.object !== fact.object
      ) {
        oldFact.status = "obsolete";
        oldFact.validTo = fact.validFrom;
      }
    }
  }

  const duplicateActive = activeDuplicateExists(facts, fact);

  if (!duplicateActive) {
    facts.push({ ...fact });
  }

  return { facts };
}

export function applyFacts(state, facts) {
  return facts.reduce((current, fact) => applyFact(current, fact), state);
}
