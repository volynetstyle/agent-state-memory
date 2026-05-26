import { normalize, tokenize } from "../shared/text.mjs";

function scoreFact(fact, question) {
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
  if (fact.status === "active") score += 2;
  if (fact.status === "obsolete") score -= 8;

  score += fact.confidence ?? 0;
  return score;
}

export function selectRelevantFacts(worldState, question, { limit = 8 } = {}) {
  const selected = worldState.facts
    .filter((fact) => fact.status === "active")
    .map((fact) => ({ fact, score: scoreFact(fact, question) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || normalize(a.fact.id).localeCompare(normalize(b.fact.id)))
    .slice(0, limit)
    .map((item) => item.fact);

  const directSlotFacts = worldState.facts.filter(
    (fact) =>
      fact.status === "active" &&
      fact.subject === question.subject &&
      fact.predicate === question.predicate
  );

  const byId = new Map([...directSlotFacts, ...selected].map((fact) => [fact.id, fact]));
  return [...byId.values()].slice(0, Math.max(limit, directSlotFacts.length));
}
