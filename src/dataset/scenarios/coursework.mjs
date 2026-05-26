export const COURSEWORK_BASE_TIME = Date.parse("2026-05-26T09:00:00.000Z");

export const COURSEWORK_DEFAULTS = {
  eventCount: 1000,
  seed: 42
};

const mutableSlots = [
  {
    subject: "Reflex",
    predicate: "runtime",
    values: ["event-sourced runtime", "actor runtime", "reactive graph runtime"],
    question: "What runtime does Reflex use?"
  },
  {
    subject: "Reflex",
    predicate: "storage",
    values: ["local arrays", "normalized object store", "graph-indexed store"],
    question: "What storage does Reflex use?"
  },
  {
    subject: "Reflex",
    predicate: "selector_strategy",
    values: ["manual subscriptions", "selector cache", "dependency-tracked selectors"],
    question: "What selector strategy does Reflex use?"
  },
  {
    subject: "State Memory coursework",
    predicate: "topic",
    values: ["RAG for agents", "long-context prompting", "State Memory for LLM agents"],
    question: "What is the current coursework topic?"
  },
  {
    subject: "State Memory coursework",
    predicate: "deadline",
    values: ["ten days", "two weeks", "one week"],
    question: "What is the current coursework deadline?"
  },
  {
    subject: "State Memory coursework",
    predicate: "implementation_language",
    values: ["Python", "TypeScript", "zero-dependency Node.js"],
    question: "What implementation language is used for the coursework MVP?"
  },
  {
    subject: "RAG baseline",
    predicate: "retriever",
    values: ["random memory sampler", "cosine embedding search", "lexical top-k retriever"],
    question: "What retriever does the RAG baseline use?"
  },
  {
    subject: "RAG baseline",
    predicate: "chunk_unit",
    values: ["paragraph chunks", "daily summaries", "event chunks"],
    question: "What chunk unit does the RAG baseline use?"
  },
  {
    subject: "RAG baseline",
    predicate: "top_k",
    values: ["3", "8", "12"],
    question: "What top-k value does the RAG baseline use?"
  },
  {
    subject: "State Memory agent",
    predicate: "memory_strategy",
    values: ["full history", "RAG retrieval", "structured world state"],
    question: "What memory strategy does the State Memory agent use?"
  },
  {
    subject: "State Memory agent",
    predicate: "answer_mode",
    values: ["free-form generation", "retrieved chunks only", "selected active facts"],
    question: "What answer mode does the State Memory agent use?"
  },
  {
    subject: "Fact extractor",
    predicate: "method",
    values: ["manual annotation", "LLM extraction", "rule-based JSON extraction"],
    question: "What method does the Fact extractor use?"
  },
  {
    subject: "Fact extractor",
    predicate: "confidence_policy",
    values: ["unscored facts", "binary confidence", "numeric confidence"],
    question: "What confidence policy does the Fact extractor use?"
  },
  {
    subject: "State updater",
    predicate: "mutable_rule",
    values: ["append everything", "manual overwrite", "latest wins"],
    question: "What mutable fact rule does the State updater use?"
  },
  {
    subject: "State updater",
    predicate: "old_fact_status",
    values: ["kept active", "deleted", "marked obsolete"],
    question: "What status is assigned to old mutable facts?"
  },
  {
    subject: "State selector",
    predicate: "ranking",
    values: ["random facts", "recency only", "slot and keyword scoring"],
    question: "How does the State selector rank facts?"
  },
  {
    subject: "State selector",
    predicate: "limit",
    values: ["3 facts", "5 facts", "8 facts"],
    question: "What fact limit does the State selector use?"
  },
  {
    subject: "World state",
    predicate: "serialization",
    values: ["YAML", "SQLite rows", "JSON facts"],
    question: "How is the World state serialized?"
  },
  {
    subject: "World state",
    predicate: "obsolete_handling",
    values: ["keeps obsolete facts active", "removes obsolete facts", "stores obsolete facts with validTo"],
    question: "How does World state handle obsolete facts?"
  },
  {
    subject: "Event store",
    predicate: "format",
    values: ["CSV", "plain text transcript", "JSONL"],
    question: "What format does the Event store use?"
  },
  {
    subject: "Synthetic dataset",
    predicate: "size",
    values: ["100 events", "500 events", "1000 events"],
    question: "How many events are in the synthetic dataset?"
  },
  {
    subject: "Synthetic dataset",
    predicate: "contains",
    values: ["only stable facts", "only random notes", "stable facts and fact updates"],
    question: "What does the synthetic dataset contain?"
  },
  {
    subject: "Evaluation suite",
    predicate: "primary_metric",
    values: ["BLEU", "semantic similarity", "stale fact error rate"],
    question: "What is the primary metric in the Evaluation suite?"
  },
  {
    subject: "Evaluation suite",
    predicate: "latency_unit",
    values: ["seconds", "microseconds", "milliseconds"],
    question: "What latency unit does the Evaluation suite use?"
  },
  {
    subject: "Metrics report",
    predicate: "output",
    values: ["terminal only", "CSV only", "JSON result files"],
    question: "What output does the Metrics report produce?"
  },
  {
    subject: "Prompt builder",
    predicate: "context_source",
    values: ["full transcript", "retrieved memories", "selected state slice"],
    question: "What context source does the Prompt builder use?"
  },
  {
    subject: "Prompt builder",
    predicate: "style",
    values: ["chat transcript", "bullet state summary", "structured memory prompt"],
    question: "What prompt style does the Prompt builder use?"
  },
  {
    subject: "Answer evaluator",
    predicate: "grading",
    values: ["manual grading", "LLM judge", "exact normalized matching"],
    question: "What grading method does the Answer evaluator use?"
  },
  {
    subject: "Answer evaluator",
    predicate: "unknown_policy",
    values: ["always guess", "hallucinate likely answers", "return unknown when evidence is missing"],
    question: "What unknown policy does the Answer evaluator use?"
  },
  {
    subject: "Coursework repository",
    predicate: "result_directory",
    values: ["output", "reports", "results"],
    question: "What result directory does the Coursework repository use?"
  },
  {
    subject: "Coursework repository",
    predicate: "data_directory",
    values: ["fixtures", "dataset", "data"],
    question: "What data directory does the Coursework repository use?"
  },
  {
    subject: "Long-context agent",
    predicate: "failure_mode",
    values: ["syntax errors", "retrieval noise", "stale fact usage"],
    question: "What failure mode is studied for the Long-context agent?"
  },
  {
    subject: "Memory benchmark",
    predicate: "comparison",
    values: ["State Memory only", "Full History only", "RAG versus State Memory"],
    question: "What comparison does the Memory benchmark run?"
  },
  {
    subject: "Memory benchmark",
    predicate: "hypothesis",
    values: ["RAG is always perfect", "longer prompts are always better", "State Memory reduces stale fact errors"],
    question: "What hypothesis does the Memory benchmark test?"
  },
  {
    subject: "Experiment runner",
    predicate: "execution",
    values: ["manual notebook cells", "shell script", "single Node command"],
    question: "How is the Experiment runner executed?"
  },
  {
    subject: "Experiment runner",
    predicate: "reproducibility",
    values: ["random each run", "external API dependent", "deterministic seeded data"],
    question: "How is Experiment runner reproducibility handled?"
  }
];

const appendSlots = [
  {
    subject: "State Memory coursework",
    predicate: "requires",
    values: ["implementation", "experiments", "metrics", "baseline comparison", "error analysis", "conclusions"],
    question: "What must the State Memory coursework include?"
  },
  {
    subject: "User",
    predicate: "interest",
    values: ["reactive systems", "LLM agents", "machine learning", "memory architectures"],
    question: "What interests are stored for the user?"
  },
  {
    subject: "State Memory",
    predicate: "stores",
    values: ["user profile", "projects", "goals", "tasks", "facts"],
    question: "What entity types does State Memory store?"
  },
  {
    subject: "Metrics",
    predicate: "include",
    values: ["recall", "precision", "context size", "latency", "stale fact error rate", "compression ratio"],
    question: "What metrics are included?"
  },
  {
    subject: "RAG pipeline",
    predicate: "step",
    values: ["chunking", "retrieval", "prompt building", "answering"],
    question: "What steps are in the RAG pipeline?"
  },
  {
    subject: "State Memory pipeline",
    predicate: "step",
    values: ["event logging", "fact extraction", "state update", "state selection", "prompt building"],
    question: "What steps are in the State Memory pipeline?"
  }
];

const fillerSubjects = [
  "Notebook",
  "README",
  "Chart script",
  "Experiment notes",
  "Methodology section",
  "Related work section",
  "Limitations section"
];

const fillerPredicates = ["status", "note", "focus", "summary"];
const fillerObjects = [
  "ready for coursework text",
  "kept short for the deadline",
  "used only as background context",
  "not part of the scored questions",
  "included for retrieval noise"
];

function sizeValues(eventCount) {
  const first = Math.max(10, Math.floor(eventCount / 4));
  const second = Math.max(first + 1, Math.floor(eventCount / 2));
  return [`${first} events`, `${second} events`, `${eventCount} events`];
}

function mutableSlotsForEventCount(eventCount) {
  const slots = [];

  for (const slot of mutableSlots) {
    if (slot.subject === "Synthetic dataset" && slot.predicate === "size") {
      slots.push({
        ...slot,
        values: sizeValues(eventCount)
      });
      continue;
    }

    slots.push(slot);
  }

  return slots;
}

export function courseworkScenario(eventCount = COURSEWORK_DEFAULTS.eventCount) {
  return {
    baseTime: COURSEWORK_BASE_TIME,
    mutableSlots: mutableSlotsForEventCount(eventCount),
    appendSlots,
    fillerSubjects,
    fillerPredicates,
    fillerObjects
  };
}

export function mutableText(slot, value, index) {
  const prefix = index === 0 ? "Initial note" : index === 1 ? "Revision" : "Final update";
  return `${prefix}: ${slot.subject} ${slot.predicate.replaceAll("_", " ")} is ${value}.`;
}

export function appendText(slot, value) {
  return `Stable note: ${slot.subject} ${slot.predicate.replaceAll("_", " ")} includes ${value}.`;
}

export function fillerText(subject, predicate, object) {
  return `Background note: ${subject} ${predicate} is ${object}.`;
}

export const COURSEWORK_DATASET_META = {
  mutableSlotCount: mutableSlots.length,
  appendSlotCount: appendSlots.length,
  defaultEventCount: COURSEWORK_DEFAULTS.eventCount,
  defaultSeed: COURSEWORK_DEFAULTS.seed
};
