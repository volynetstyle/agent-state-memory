import {
  retrieveEvents as retrieveLexicalEvents,
  retrieveEventsWithRecency as retrieveLexicalEventsWithRecency
} from "./retrievers/lexical.mjs";
import {
  createEmbeddingRetriever,
  retrieveEventsWithVector
} from "./retrievers/embedding.mjs";

export {
  answerFromRetrievedEvents,
  answerLatestFromRetrievedEvents
} from "./answer.mjs";

export {
  retrieveEvents,
  retrieveEventsWithRecency
} from "./retrievers/lexical.mjs";

export { createBm25Retriever } from "./retrievers/bm25.mjs";
export { createEmbeddingRetriever, retrieveEventsWithVector } from "./retrievers/embedding.mjs";

export const retrievers = {
  lexical: {
    retrieveEvents: retrieveLexicalEvents,
    retrieveEventsWithRecency: retrieveLexicalEventsWithRecency
  },
  vector: {
    createEmbeddingRetriever,
    retrieveEvents: retrieveEventsWithVector
  }
};

export function createRetriever(name = "lexical") {
  const retriever = retrievers[name];

  if (!retriever) {
    throw new Error(`Unknown retriever "${name}". Available retrievers: ${Object.keys(retrievers).join(", ")}`);
  }

  return retriever;
}
