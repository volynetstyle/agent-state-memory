export function createWorldState() {
  return { facts: [] };
}

function sameSlot(a, b) {
  return a.subject === b.subject && a.predicate === b.predicate;
}

function sameFact(a, b) {
  return sameSlot(a, b) && a.object === b.object;
}

export function applyFact(state, fact) {
  const facts = state.facts.map((oldFact) => ({ ...oldFact }));

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

  const duplicateActive = facts.some(
    (oldFact) => oldFact.status === "active" && sameFact(oldFact, fact)
  );

  if (!duplicateActive) {
    facts.push({ ...fact });
  }

  return { facts };
}

export function applyFacts(state, facts) {
  return facts.reduce((current, fact) => applyFact(current, fact), state);
}
