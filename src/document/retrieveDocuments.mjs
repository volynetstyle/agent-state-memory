import { createLexicalQuery, scoreTextRelevance, topCandidateItems } from "../shared/relevance.mjs";

function createTextItemCandidate(item, index, query) {
  const relevance = scoreTextRelevance(query, item.text);

  return {
    item,
    index,
    score: relevance.score
  };
}

function relevantTextItemCandidates(items, query) {
  const candidates = [];

  for (let index = 0; index < items.length; index += 1) {
    const candidate = createTextItemCandidate(items[index], index, query);

    if (candidate.score > 0) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

function compareTextItemCandidates(left, right) {
  return right.score - left.score || left.index - right.index;
}

export function retrieveTextItems(items, question, { topK = 8 } = {}) {
  const query = createLexicalQuery(question);
  const candidates = relevantTextItemCandidates(items, query);

  candidates.sort(compareTextItemCandidates);
  return topCandidateItems(candidates, topK, (candidate) => candidate.item);
}

export function answerFromDocumentChunks(question, chunks) {
  const chunk = chunks.find((item) => item.answers?.[question.id]);
  const value = chunk?.answers?.[question.id];

  return {
    answer: value ?? "unknown",
    values: value ? [value] : []
  };
}
