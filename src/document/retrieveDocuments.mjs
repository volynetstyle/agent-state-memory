import { overlapScore, tokenize } from "../shared/text.mjs";

export function retrieveTextItems(items, question, { topK = 8 } = {}) {
  const queryTokens = new Set(tokenize(question));

  return items
    .map((item, index) => {
      const textTokens = tokenize(item.text);
      const exactMatches = textTokens.filter((token) => queryTokens.has(token)).length;
      const score = overlapScore(question, item.text) + exactMatches * 0.1;

      return { item, index, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, topK)
    .map((entry) => entry.item);
}

export function answerFromDocumentChunks(question, chunks) {
  const chunk = chunks.find((item) => item.answers?.[question.id]);
  const value = chunk?.answers?.[question.id];

  return {
    answer: value ?? "unknown",
    values: value ? [value] : []
  };
}
