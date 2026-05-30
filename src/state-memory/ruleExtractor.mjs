function fact(subject, predicate, object, { mutable = true, confidence = 0.75 } = {}) {
  return { subject, predicate, object, mutable, confidence };
}

function factsForText(text) {
  const lower = text.toLowerCase();
  const facts = [];

  if (lower.includes("improved llm experiment observability")) {
    facts.push(fact("LLM experiment", "observability", "improved"));
  }
  if (lower.includes("cached ollama models")) {
    facts.push(fact("Ollama workflow", "cache_policy", "cache model files"));
  }
  if (lower.includes("defensive state memory stress tests")) {
    facts.push(fact("Stress benchmark", "coverage", "defensive State Memory stress tests"));
  }
  if (lower.includes("non-oracle robust question benchmark")) {
    facts.push(fact("Robust benchmark", "oracle_access", "removed"));
  }
  if (lower.includes("implemented the experiment runner")) {
    facts.push(fact("Experiment runner", "status", "implemented"));
  }
  if (lower.includes("syntax checking") && lower.includes("result verification")) {
    facts.push(
      fact("Verification pipeline", "includes", "syntax checks, result verification, and tests", {
        mutable: false
      })
    );
  }
  if (lower.includes("documented local quality checks")) {
    facts.push(fact("README", "verification_section", "local quality checks"));
  }
  if (lower.includes("input validation") && lower.includes("result verification")) {
    facts.push(fact("Ollama workflow", "validation", "input validation and result verification"));
  }
  if (lower.includes("corrected node input handling")) {
    facts.push(fact("Node execution", "input_handling", "corrected"));
  }
  if (lower.includes("refined the condition for publishing results")) {
    facts.push(fact("Results publishing", "condition", "refined"));
  }
  if (lower.includes("updated llm benchmark results")) {
    facts.push(fact("LLM benchmark results", "status", "updated"));
  }
  if (lower.includes("updated verified llm results")) {
    facts.push(fact("LLM benchmark results", "status", "verified and updated"));
  }
  if (lower.includes("reframed oracle results as diagnostic")) {
    facts.push(fact("Oracle result", "positioning", "diagnostic upper-bound"));
  }
  if (lower.includes("temporal rag the main robust baseline")) {
    facts.push(fact("Robust benchmark", "main_baseline", "Temporal RAG"));
  }
  if (lower.includes("added statistical checks")) {
    facts.push(
      fact("Results report", "statistics", "bootstrap confidence intervals and McNemar tests")
    );
  }

  return facts;
}

export function extractFactsWithRules(event) {
  return factsForText(event.text).map((extractedFact, index) => ({
    id: `${event.id}-rule-f${index + 1}`,
    ...extractedFact,
    sourceEventId: event.id,
    validFrom: event.timestamp,
    status: "active"
  }));
}

export function extractEventsWithRules(events) {
  return events.map((event) => ({
    ...event,
    facts: extractFactsWithRules(event)
  }));
}
