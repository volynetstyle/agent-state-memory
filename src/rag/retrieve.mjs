import { overlapScore, tokenize } from "../shared/text.mjs";

function eventText(event) {
  return `${event.text} ${event.facts
    .map((fact) => `${fact.subject} ${fact.predicate} ${fact.object}`)
    .join(" ")}`;
}

export function retrieveEvents(events, question, { topK = 12 } = {}) {
  const queryTokens = new Set(tokenize(question));

  return events
    .map((event, index) => {
      const text = eventText(event);
      const textTokens = tokenize(text);
      const exactMatches = textTokens.filter((token) => queryTokens.has(token)).length;
      const score = overlapScore(question, text) + exactMatches * 0.1;

      return { event, score, index };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, topK)
    .map((item) => item.event);
}

export function retrieveEventsWithRecency(events, question, { topK = 12, recencyWeight = 0.35 } = {}) {
  const queryTokens = new Set(tokenize(question));
  const maxIndex = Math.max(1, events.length - 1);

  return events
    .map((event, index) => {
      const text = eventText(event);
      const textTokens = tokenize(text);
      const exactMatches = textTokens.filter((token) => queryTokens.has(token)).length;
      const relevance = overlapScore(question, text) + exactMatches * 0.1;
      const recency = index / maxIndex;
      const score = relevance + recency * recencyWeight;

      return { event, score, relevance, index };
    })
    .filter((item) => item.relevance > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, topK)
    .map((item) => item.event);
}
