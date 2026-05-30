import { hasHopChain, hopAnswerValues } from "../shared/multihop.mjs";
import { unique } from "../shared/text.mjs";

function factMatchesQuestionSlot(fact, question) {
  return fact.subject === question.subject && fact.predicate === question.predicate;
}

function slotValuesFromEvents(events, question) {
  const values = [];

  for (const event of events) {
    for (const fact of event.facts ?? []) {
      if (factMatchesQuestionSlot(fact, question)) {
        values.push(fact.object);
      }
    }
  }

  return values;
}

function eventsContainingQuestionSlot(events, question) {
  const matchingEvents = [];

  for (const event of events) {
    const facts = event.facts ?? [];

    for (const fact of facts) {
      if (factMatchesQuestionSlot(fact, question)) {
        matchingEvents.push(event);
        break;
      }
    }
  }

  return matchingEvents;
}

function compareNewestEventsFirst(left, right) {
  return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
}

function factsFromEvents(events) {
  return events.flatMap((event) => event.facts ?? []);
}

function factsFromNewestEvents(events) {
  return [...events].sort(compareNewestEventsFirst).flatMap((event) => event.facts ?? []);
}

function answerFromValues(question, values) {
  if (Array.isArray(question.expected)) {
    const uniqueValues = unique(values);

    return {
      answer: uniqueValues.length > 0 ? uniqueValues.join(", ") : "unknown",
      values: uniqueValues
    };
  }

  const value = values[0];

  return {
    answer: value ?? "unknown",
    values: value ? [value] : []
  };
}

export function answerFromRetrievedEvents(question, retrievedEvents) {
  if (hasHopChain(question)) {
    return answerFromValues(question, hopAnswerValues(factsFromEvents(retrievedEvents), question));
  }

  const values = slotValuesFromEvents(retrievedEvents, question);
  return answerFromValues(question, values);
}

export function answerLatestFromRetrievedEvents(question, retrievedEvents) {
  if (hasHopChain(question)) {
    return answerFromValues(question, hopAnswerValues(factsFromNewestEvents(retrievedEvents), question));
  }

  const newestSlotEvents = eventsContainingQuestionSlot(retrievedEvents, question);

  newestSlotEvents.sort(compareNewestEventsFirst);

  const values = slotValuesFromEvents(newestSlotEvents, question);
  return answerFromValues(question, values);
}
