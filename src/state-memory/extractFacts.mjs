export function extractFacts(event) {
  if (Array.isArray(event.facts)) {
    return event.facts.map((fact, index) => ({
      id: `${event.id}-f${index + 1}`,
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object,
      confidence: fact.confidence ?? 0.9,
      sourceEventId: event.id,
      validFrom: event.timestamp,
      status: "active",
      mutable: Boolean(fact.mutable)
    }));
  }

  return [];
}
