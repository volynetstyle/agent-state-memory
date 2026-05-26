import { unique } from "../shared/text.mjs";

export function answerFromRetrievedEvents(question, retrievedEvents) {
  const matchingFacts = retrievedEvents.flatMap((event) =>
    event.facts
      .filter((fact) => fact.subject === question.subject && fact.predicate === question.predicate)
      .map((fact) => fact.object)
  );

  if (Array.isArray(question.expected)) {
    const values = unique(matchingFacts);
    return {
      answer: values.length > 0 ? values.join(", ") : "unknown",
      values
    };
  }

  const value = matchingFacts[0];
  return {
    answer: value ?? "unknown",
    values: value ? [value] : []
  };
}
