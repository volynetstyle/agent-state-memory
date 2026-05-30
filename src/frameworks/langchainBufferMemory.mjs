import { answerLatestFromRetrievedEvents } from "../rag/answer.mjs";
import { tokenCount } from "../shared/text.mjs";

function newestFirst(left, right) {
  return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
}

export function createLangChainBufferMemory(events, { windowSize = 6 } = {}) {
  const messages = events.map((event) => ({
    id: event.id,
    timestamp: event.timestamp,
    content: event.text,
    metadata: {
      source: event.type,
      facts: event.facts ?? []
    }
  }));

  return {
    framework: "LangChain ConversationBufferMemory-style baseline",
    windowSize,
    messages,
    retrieve() {
      return events.slice(-windowSize).sort(newestFirst);
    },
    answer(question) {
      const context = this.retrieve(question);
      return {
        answer: answerLatestFromRetrievedEvents(question, context),
        context,
        contextTokens: tokenCount(context.map((event) => event.text).join("\n"))
      };
    }
  };
}
