import { createLexicalQuery, scoreTextRelevance, topCandidateItems } from "../shared/relevance.mjs";

function eventText(event) {
  const factTexts = [];

  for (const fact of event.facts ?? []) {
    factTexts.push(`${fact.subject} ${fact.predicate} ${fact.object}`);
  }

  return `${event.text} ${factTexts.join(" ")}`;
}

function createEventCandidate(event, index, query) {
  const text = eventText(event);
  const relevance = scoreTextRelevance(query, text);

  return {
    event,
    index,
    relevance: relevance.score,
    score: relevance.score
  };
}

function createRecentEventCandidate(event, index, query, maxIndex, recencyWeight) {
  const candidate = createEventCandidate(event, index, query);
  const recency = index / maxIndex;

  return {
    ...candidate,
    recency,
    score: candidate.relevance + recency * recencyWeight
  };
}

function relevantEventCandidates(events, buildCandidate) {
  const candidates = [];

  for (let index = 0; index < events.length; index += 1) {
    const candidate = buildCandidate(events[index], index);

    if (candidate.relevance > 0) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

function compareStableEventCandidates(left, right) {
  return right.score - left.score || left.index - right.index;
}

function compareRecentEventCandidates(left, right) {
  return right.score - left.score || right.index - left.index;
}

export function retrieveEvents(events, question, { topK = 12 } = {}) {
  const query = createLexicalQuery(question);
  const candidates = relevantEventCandidates(events, (event, index) =>
    createEventCandidate(event, index, query)
  );

  candidates.sort(compareStableEventCandidates);
  return topCandidateItems(candidates, topK, (candidate) => candidate.event);
}

export function retrieveEventsWithRecency(events, question, { topK = 12, recencyWeight = 0.35 } = {}) {
  const query = createLexicalQuery(question);
  const maxIndex = Math.max(1, events.length - 1);
  const candidates = relevantEventCandidates(events, (event, index) =>
    createRecentEventCandidate(event, index, query, maxIndex, recencyWeight)
  );

  candidates.sort(compareRecentEventCandidates);
  return topCandidateItems(candidates, topK, (candidate) => candidate.event);
}
