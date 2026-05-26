export function extractFacts(event) {
  if (Array.isArray(event.facts)) {
    const extractedFacts = [];

    for (let index = 0; index < event.facts.length; index += 1) {
      const fact = event.facts[index];

      extractedFacts.push({
        id: `${event.id}-f${index + 1}`,
        subject: fact.subject,
        predicate: fact.predicate,
        object: fact.object,
        confidence: fact.confidence ?? 0.9,
        sourceEventId: event.id,
        validFrom: event.timestamp,
        status: "active",
        mutable: Boolean(fact.mutable)
      });
    }

    return extractedFacts;
  }

  return [];
}
