import { generateWithOllama } from "../llm/ollama.mjs";

export class ExtractorParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "ExtractorParseError";
  }
}

function jsonFromText(text) {
  const trimmed = String(text ?? "").trim();
  const candidates = [];
  const fenced = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gu)].map((match) =>
    match[1].trim()
  );

  candidates.push(...fenced, trimmed);

  for (const candidate of [...candidates]) {
    const arrayStart = candidate.indexOf("[");
    const arrayEnd = candidate.lastIndexOf("]");
    const objectStart = candidate.indexOf("{");
    const objectEnd = candidate.lastIndexOf("}");

    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      candidates.push(candidate.slice(arrayStart, arrayEnd + 1));
    }

    if (objectStart >= 0 && objectEnd > objectStart) {
      candidates.push(candidate.slice(objectStart, objectEnd + 1));
    }
  }

  let lastError = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw new ExtractorParseError(`LLM extractor returned invalid JSON: ${lastError.message}`);
  }

  throw new ExtractorParseError("LLM extractor did not return JSON.");
}

export function factsFromLlmText(text) {
  const parsed = jsonFromText(text);

  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.facts)) return parsed.facts;

  throw new ExtractorParseError("LLM extractor JSON payload is not an array.");
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

Return only a JSON array. Do not use markdown fences or explanatory text.
If the event contains no durable facts, return [].
Each item must have:
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
  const { failOnError: _failOnError, ...ollamaOptions } = ollama;
  const response = await generateWithOllama(buildExtractionPrompt(event), {
    numPredict: 256,
    ...ollamaOptions
  });
  const parsedFacts = factsFromLlmText(response);

  return parsedFacts.map((fact, index) => normalizeFact(event, fact, index)).filter(validFact);
}

export async function extractEventsWithLlm(events, ollama = {}) {
  const { failOnError = false, ...ollamaOptions } = ollama;
  const extractedEvents = [];

  for (const event of events) {
    try {
      const facts = await extractFactsWithLlm(event, ollamaOptions);
      extractedEvents.push({ ...event, facts });
    } catch (error) {
      if (failOnError || !(error instanceof ExtractorParseError)) throw error;
      extractedEvents.push({
        ...event,
        facts: [],
        extractionError: {
          message: error.message
        }
      });
    }
  }

  return extractedEvents;
}
