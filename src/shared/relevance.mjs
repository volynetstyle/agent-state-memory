import { overlapScore, tokenize } from "./text.mjs";

const DEFAULT_EXACT_MATCH_WEIGHT = 0.1;

export function createLexicalQuery(text) {
  return {
    text: String(text ?? ""),
    tokens: new Set(tokenize(text))
  };
}

export function scoreTextRelevance(query, text, { exactMatchWeight = DEFAULT_EXACT_MATCH_WEIGHT } = {}) {
  const textTokens = tokenize(text);
  let exactMatches = 0;

  for (const token of textTokens) {
    if (query.tokens.has(token)) exactMatches += 1;
  }

  const overlap = overlapScore(query.text, text);

  return {
    overlap,
    exactMatches,
    score: overlap + exactMatches * exactMatchWeight
  };
}

export function topCandidateItems(candidates, limit, itemOf) {
  const selected = [];

  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    selected.push(itemOf(candidate));
  }

  return selected;
}
