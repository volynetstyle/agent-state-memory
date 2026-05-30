import { tokenize } from "../../shared/text.mjs";

function eventText(event) {
  const factTexts = [];

  for (const fact of event.facts ?? []) {
    factTexts.push(`${fact.subject} ${fact.predicate} ${fact.object}`);
  }

  return `${event.text} ${factTexts.join(" ")}`;
}

function termCounts(tokens) {
  const counts = new Map();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return counts;
}

function documentFrequencies(documents) {
  const frequencies = new Map();

  for (const document of documents) {
    for (const token of new Set(document.tokens)) {
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }
  }

  return frequencies;
}

function idf(documentCount, documentFrequency) {
  return Math.log((1 + documentCount) / (1 + documentFrequency)) + 1;
}

function vectorize(tokens, frequencies, documentCount) {
  const counts = termCounts(tokens);
  const vector = new Map();

  for (const [token, count] of counts.entries()) {
    vector.set(token, count * idf(documentCount, frequencies.get(token) ?? 0));
  }

  return vector;
}

function magnitude(vector) {
  let sum = 0;

  for (const value of vector.values()) {
    sum += value ** 2;
  }

  return Math.sqrt(sum);
}

function cosine(left, right, leftMagnitude, rightMagnitude) {
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;

  let dot = 0;
  const [smaller, larger] = left.size < right.size ? [left, right] : [right, left];

  for (const [token, value] of smaller.entries()) {
    dot += value * (larger.get(token) ?? 0);
  }

  return dot / (leftMagnitude * rightMagnitude);
}

function compareCandidates(left, right) {
  return right.score - left.score || left.index - right.index;
}

export function createEmbeddingRetriever(events) {
  const documents = events.map((event, index) => ({
    event,
    index,
    tokens: tokenize(eventText(event))
  }));
  const frequencies = documentFrequencies(documents);
  const documentCount = Math.max(1, documents.length);
  const indexed = documents.map((document) => {
    const vector = vectorize(document.tokens, frequencies, documentCount);
    return {
      ...document,
      vector,
      magnitude: magnitude(vector)
    };
  });

  return {
    retrieveEvents(question, { topK = 12 } = {}) {
      const queryVector = vectorize(tokenize(question), frequencies, documentCount);
      const queryMagnitude = magnitude(queryVector);
      const candidates = indexed
        .map((document) => ({
          event: document.event,
          index: document.index,
          score: cosine(queryVector, document.vector, queryMagnitude, document.magnitude)
        }))
        .filter((candidate) => candidate.score > 0);

      candidates.sort(compareCandidates);
      return candidates.slice(0, topK).map((candidate) => candidate.event);
    }
  };
}

export function retrieveEventsWithVector(events, question, options = {}) {
  return createEmbeddingRetriever(events).retrieveEvents(question, options);
}
