export function buildPrompt(question, facts) {
  const factLines = facts.map(
    (fact) => `- ${fact.subject}.${fact.predicate} = ${fact.object} (${fact.status})`
  );

  return [
    "You are an assistant with access to structured memory.",
    "",
    "Relevant current state:",
    ...factLines,
    "",
    `Question: ${question.question}`
  ].join("\n");
}

export function answerFromFacts(question, facts) {
  const matchingFacts = facts.filter(
    (fact) => fact.subject === question.subject && fact.predicate === question.predicate
  );

  if (Array.isArray(question.expected)) {
    const values = matchingFacts.map((fact) => fact.object);
    return {
      answer: values.length > 0 ? values.join(", ") : "unknown",
      values
    };
  }

  const value = matchingFacts[0]?.object;
  return {
    answer: value ?? "unknown",
    values: value ? [value] : []
  };
}
