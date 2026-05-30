import { generateWithOllama } from "../llm/ollama.mjs";

function jsonFromText(text) {
  const trimmed = String(text ?? "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/u);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");

  if (start < 0 || end < start) {
    throw new Error("LLM extractor did not return a JSON array.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeFact(event, fact, index) {
  return {
    id: `${event.id}-llm-f${index + 1}`,
    subject: String(fact.subject ?? "").trim(),
    predicate: String(fact.predicate ?? "").trim(),
    object: String(fact.object ?? "").trim(),
    confidence: Number(fact.confidence ?? 0.7),
    sourceEventId: event.id,
    validFrom: event.timestamp,
    status: "active",
    mutable: Boolean(fact.mutable)
  };
}

function validFact(fact) {
  return fact.subject.length > 0 && fact.predicate.length > 0 && fact.object.length > 0;
}

export function buildExtractionPrompt(event) {
  return `Extract durable agent-memory facts from the event below.

Return only a JSON array. Each item must have:
- subject: stable entity name
- predicate: snake_case property name
- object: concise value string
- mutable: true when newer events can replace this slot, false for append-only/stable facts
- confidence: number from 0 to 1

Event id: ${event.id}
Timestamp: ${event.timestamp}
Event text:
${event.text}
`;
}

export async function extractFactsWithLlm(event, ollama = {}) {
  const response = await generateWithOllama(buildExtractionPrompt(event), {
    numPredict: 256,
    ...ollama
  });
  const parsedFacts = jsonFromText(response);

  if (!Array.isArray(parsedFacts)) {
    throw new Error("LLM extractor JSON payload is not an array.");
  }

  return parsedFacts.map((fact, index) => normalizeFact(event, fact, index)).filter(validFact);
}

export async function extractEventsWithLlm(events, ollama = {}) {
  const extractedEvents = [];

  for (const event of events) {
    const facts = await extractFactsWithLlm(event, ollama);
    extractedEvents.push({ ...event, facts });
  }

  return extractedEvents;
}
