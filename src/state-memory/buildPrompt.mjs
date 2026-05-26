function factMatchesQuestionSlot(fact, question) {
  return fact.subject === question.subject && fact.predicate === question.predicate;
}

function factLine(fact) {
  return `- ${fact.subject}.${fact.predicate} = ${fact.object} (${fact.status})`;
}

function promptFactLines(facts) {
  const lines = [];

  for (const fact of facts) {
    lines.push(factLine(fact));
  }

  return lines;
}

function slotFacts(facts, question) {
  const matchingFacts = [];

  for (const fact of facts) {
    if (factMatchesQuestionSlot(fact, question)) {
      matchingFacts.push(fact);
    }
  }

  return matchingFacts;
}

function factObjects(facts) {
  const values = [];

  for (const fact of facts) {
    values.push(fact.object);
  }

  return values;
}

export function buildPrompt(question, facts) {
  const factLines = promptFactLines(facts);

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
  const matchingFacts = slotFacts(facts, question);

  if (Array.isArray(question.expected)) {
    const values = factObjects(matchingFacts);
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
