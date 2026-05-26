const WORD_RE = /[\p{L}\p{N}]+/gu;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "by",
  "current",
  "does",
  "for",
  "has",
  "include",
  "is",
  "it",
  "of",
  "on",
  "the",
  "to",
  "use",
  "uses",
  "what",
  "which",
  "with"
]);

export function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .match(WORD_RE)?.filter((token) => !STOP_WORDS.has(token)) ?? [];
}

export function tokenCount(text) {
  return tokenize(text).length;
}

export function unique(values) {
  return [...new Set(values)];
}

export function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function overlapScore(query, text) {
  const queryTokens = tokenize(query);
  const textTokens = tokenize(text);
  const textSet = new Set(textTokens);

  let score = 0;
  for (const token of queryTokens) {
    if (textSet.has(token)) score += 1;
  }

  return score / Math.max(1, queryTokens.length);
}
