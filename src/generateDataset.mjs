import { ensureDir, writeJson, writeJsonl } from "./shared/io.mjs";
import { fileURLToPath } from "node:url";

const DATA_DIR = "data";
const BASE_TIME = Date.parse("2026-05-26T09:00:00.000Z");

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function choice(random, values) {
  return values[Math.floor(random() * values.length)];
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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

function mutableText(slot, value, index) {
  const prefix = index === 0 ? "Initial note" : index === 1 ? "Revision" : "Final update";
  return `${prefix}: ${slot.subject} ${slot.predicate.replaceAll("_", " ")} is ${value}.`;
}

function appendText(slot, value) {
  return `Stable note: ${slot.subject} ${slot.predicate.replaceAll("_", " ")} includes ${value}.`;
}

function fillerText(subject, predicate, object) {
  return `Background note: ${subject} ${predicate} is ${object}.`;
}

function sizeValues(eventCount) {
  const first = Math.max(10, Math.floor(eventCount / 4));
  const second = Math.max(first + 1, Math.floor(eventCount / 2));
  return [`${first} events`, `${second} events`, `${eventCount} events`];
}

function getMutableSlots(eventCount) {
  return mutableSlots.map((slot) => {
    if (slot.subject === "Synthetic dataset" && slot.predicate === "size") {
      return {
        ...slot,
        values: sizeValues(eventCount)
      };
    }

    return slot;
  });
}

function materializeEvents(planned, eventCount) {
  planned.sort((a, b) => a.position - b.position);

  if (planned.length <= eventCount) {
    return planned.map((event) => ({
      text: event.text,
      facts: event.facts
    }));
  }

  const buckets = Array.from({ length: eventCount }, () => []);

  planned.forEach((event, index) => {
    const bucketIndex = Math.min(
      eventCount - 1,
      Math.floor((index * eventCount) / planned.length)
    );
    buckets[bucketIndex].push(event);
  });

  return buckets.map((bucket) => ({
    text: bucket.map((event) => event.text).join(" "),
    facts: bucket.flatMap((event) => event.facts)
  }));
}

export function buildDataset({ eventCount = 1000, seed = 42 } = {}) {
  const random = mulberry32(seed);
  const planned = [];
  const effectiveMutableSlots = getMutableSlots(eventCount);

  for (const slot of effectiveMutableSlots) {
    slot.values.forEach((value, index) => {
      const bandStart = index * Math.floor(eventCount / 3);
      const bandWidth = Math.floor(eventCount / 3) - 20;
      const position = bandStart + 5 + Math.floor(random() * Math.max(1, bandWidth));
      planned.push({
        position,
        text: mutableText(slot, value, index),
        facts: [
          {
            subject: slot.subject,
            predicate: slot.predicate,
            object: value,
            mutable: true,
            confidence: 0.95
          }
        ]
      });
    });
  }

  for (const slot of appendSlots) {
    slot.values.forEach((value) => {
      planned.push({
        position: 20 + Math.floor(random() * (eventCount - 40)),
        text: appendText(slot, value),
        facts: [
          {
            subject: slot.subject,
            predicate: slot.predicate,
            object: value,
            mutable: false,
            confidence: 0.95
          }
        ]
      });
    });
  }

  while (planned.length < eventCount) {
    const subject = choice(random, fillerSubjects);
    const predicate = choice(random, fillerPredicates);
    const object = choice(random, fillerObjects);
    planned.push({
      position: Math.floor(random() * eventCount),
      text: fillerText(subject, predicate, object),
      facts: [
        {
          subject,
          predicate,
          object,
          mutable: false,
          confidence: 0.6
        }
      ]
    });
  }

  const materializedEvents = materializeEvents(planned, eventCount);

  const events = materializedEvents.map((event, index) => ({
    id: `e${String(index + 1).padStart(4, "0")}`,
    timestamp: new Date(BASE_TIME + index * 60_000).toISOString(),
    type: "user_message",
    text: event.text,
    facts: event.facts
  }));

  const mutableQuestions = effectiveMutableSlots.map((slot, index) => ({
    id: `q-current-${String(index + 1).padStart(3, "0")}`,
    question: slot.question,
    subject: slot.subject,
    predicate: slot.predicate,
    expected: slot.values.at(-1),
    obsoleteAnswers: slot.values.slice(0, -1)
  }));

  const appendQuestions = appendSlots.map((slot, index) => ({
    id: `q-list-${String(index + 1).padStart(3, "0")}`,
    question: slot.question,
    subject: slot.subject,
    predicate: slot.predicate,
    expected: slot.values,
    obsoleteAnswers: []
  }));

  const questions = [...mutableQuestions, ...appendQuestions];
  const groundTruth = Object.fromEntries(
    questions.map((question) => [
      question.id,
      {
        subject: question.subject,
        predicate: question.predicate,
        expected: question.expected,
        obsoleteAnswers: question.obsoleteAnswers
      }
    ])
  );

  return { events, questions, groundTruth };
}

export async function generateDataset(options = {}) {
  const dataset = buildDataset(options);

  await ensureDir(DATA_DIR);
  await writeJsonl(`${DATA_DIR}/events.jsonl`, dataset.events);
  await writeJson(`${DATA_DIR}/questions.json`, dataset.questions);
  await writeJson(`${DATA_DIR}/ground_truth.json`, dataset.groundTruth);

  return dataset;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dataset = await generateDataset();
  console.log(`Generated ${dataset.events.length} events and ${dataset.questions.length} questions.`);
}

export const DATASET_META = {
  mutableSlotCount: mutableSlots.length,
  appendSlotCount: appendSlots.length,
  defaultEventCount: 1000,
  defaultSeed: 42
};
