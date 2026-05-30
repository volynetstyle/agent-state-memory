import { performance } from "node:perf_hooks";
import { buildDataset } from "../dataset/generateDataset.mjs";
import { createEmbeddingRetriever, retrieveEvents, retrieveEventsWithRecency } from "../rag/index.mjs";
import { answerFromRetrievedEvents, answerLatestFromRetrievedEvents } from "../rag/answer.mjs";
import { buildWorldState } from "../state-memory/worldState.mjs";
import { answerFromFacts, buildPrompt } from "../state-memory/buildPrompt.mjs";
import { selectRelevantFacts } from "../state-memory/selectState.mjs";
import { hasHopChain, hopAnswerValues } from "../shared/multihop.mjs";
import { normalize, tokenCount, tokenize } from "../shared/text.mjs";
import { writeJson, writeText } from "../shared/io.mjs";
import { gradeAnswer, summarizeResults } from "../eval/metrics.mjs";

const BASE_TIME = Date.parse("2026-05-27T09:00:00.000Z");

const SLOT_ALIASES = {
  runtime: ["runtime", "execution", "engine", "powers", "runs"],
  storage: ["storage", "store", "database", "persistence"],
  selector_strategy: ["selector", "selectors", "strategy", "dependency", "tracked"],
  topic: ["topic", "subject", "theme", "about", "focus"],
  deadline: ["deadline", "due", "timeframe", "when", "finish"],
  implementation_language: ["language", "implementation", "stack", "coded", "built"],
  retriever: ["retriever", "retrieval", "search", "finder"],
  chunk_unit: ["chunk", "unit", "chunks", "memory"],
  top_k: ["top", "k", "topk", "how many", "retrieved"],
  memory_strategy: ["memory", "strategy", "remember", "context"],
  answer_mode: ["answer", "mode", "respond", "uses"],
  method: ["method", "extractor", "extraction", "how"],
  confidence_policy: ["confidence", "score", "scoring", "certainty"],
  mutable_rule: ["mutable", "update", "rule", "overwrite", "latest"],
  old_fact_status: ["old", "obsolete", "previous", "status"],
  ranking: ["rank", "ranking", "score", "order"],
  limit: ["limit", "how many", "facts", "cap"],
  serialization: ["serialized", "serialization", "stored", "format"],
  obsolete_handling: ["obsolete", "stale", "old", "history"],
  format: ["format", "file", "stored"],
  size: ["size", "how many", "events"],
  contains: ["contains", "dataset", "inside"],
  primary_metric: ["metric", "primary", "main", "measure"],
  latency_unit: ["latency", "unit", "time"],
  output: ["output", "produce", "result"],
  context_source: ["context", "source", "prompt"],
  style: ["style", "prompt", "format"],
  grading: ["grading", "judge", "evaluate"],
  unknown_policy: ["unknown", "missing", "evidence", "guess"],
  result_directory: ["result", "directory", "folder"],
  data_directory: ["data", "directory", "folder"],
  failure_mode: ["failure", "mode", "problem"],
  comparison: ["comparison", "compare", "versus"],
  hypothesis: ["hypothesis", "claim", "test"],
  execution: ["run", "executed", "command"],
  reproducibility: ["reproducibility", "seed", "deterministic"],
  requires: ["requires", "must", "include", "deliverables", "needs"],
  interest: ["interest", "interests", "likes"],
  stores: ["stores", "entities", "keeps"],
  include: ["include", "metrics", "contains"],
  step: ["steps", "pipeline", "process"],
  meeting_time: ["meeting", "time", "scheduled", "calendar"],
  account_owner: ["owner", "owns", "account", "responsible"],
  status: ["status", "state", "done", "blocked", "task"],
  budget: ["budget", "spend", "cost", "shopping"],
  priority: ["priority", "urgent", "severity", "chat"],
  assignee: ["assignee", "assigned", "owner", "task"],
  calendar_dependency: ["calendar", "meeting", "dependency", "depends", "after"],
  delivery_task: ["delivery", "task", "depends", "work", "project"]
};

const QUESTION_TEMPLATES = {
  "Reflex.runtime": {
    paraphrase: "Which execution engine powers Reflex now?",
    indirect: "If I describe Reflex architecture, what should I call the runtime it currently uses?",
    noisy: "Ignore old drafts and unrelated README notes: what engine does Reflex run on after all updates?",
    multi_step: "After the initial and revision notes, what is the latest runtime for Reflex?"
  },
  "Reflex.selector_strategy": {
    paraphrase: "How are selectors handled in Reflex now?",
    indirect: "When explaining Reflex reactivity, which selector approach should be mentioned?",
    noisy: "Skipping background notes, what selector mechanism is currently associated with Reflex?",
    multi_step: "What selector strategy remains after the later Reflex updates?"
  },
  "State Memory coursework.topic": {
    paraphrase: "What is the final subject of the coursework?",
    indirect: "If the title changed over time, what topic should be used in the final report?",
    noisy: "Do not use the old RAG draft: what is the coursework about now?",
    multi_step: "After the topic moved through earlier drafts, what is the current coursework topic?"
  },
  "State Memory coursework.deadline": {
    paraphrase: "When is the coursework due now?",
    indirect: "What timeframe should planning use for finishing the coursework?",
    noisy: "Ignoring older schedule notes, what is the current coursework deadline?",
    multi_step: "After all deadline revisions, what is the latest deadline?"
  },
  "RAG baseline.retriever": {
    paraphrase: "Which search component is used by the RAG baseline?",
    indirect: "When describing the baseline, how does it retrieve memories?",
    noisy: "Ignore random sampler mentions from older notes: what retriever does the baseline use?",
    multi_step: "After retriever revisions, which retrieval method is current for the RAG baseline?"
  },
  "State updater.mutable_rule": {
    paraphrase: "How does the updater handle changing facts?",
    indirect: "What rule should be named for mutable state updates?",
    noisy: "Skipping unrelated state notes, what update rule is active for mutable facts?",
    multi_step: "After earlier overwrite ideas, what mutable fact rule is used?"
  },
  "State Memory coursework.requires": {
    paraphrase: "Which deliverables are required for the coursework?",
    indirect: "What should the final report include to satisfy the requirements?",
    noisy: "Ignore implementation-language notes; list the coursework deliverables.",
    multi_step: "Across all requirement notes, what must the coursework include?"
  },
  "Metrics.include": {
    paraphrase: "Which evaluation measures are part of the metrics set?",
    indirect: "What should be reported when evaluating the memory approaches?",
    noisy: "Ignoring chart script notes, which metrics are included?",
    multi_step: "Combining the metric notes, what measures are included?"
  },
  "Calendar.planning_meeting.meeting_time": {
    paraphrase: "When is the planning meeting scheduled now?",
    indirect: "What time should I put on the calendar for the planning meeting?",
    noisy: "Ignore the first invite: what is the updated planning meeting time?",
    multi_step: "After the meeting was rescheduled, what is its latest time?"
  },
  "CRM.Acme.account_owner": {
    paraphrase: "Who owns the Acme account now?",
    indirect: "Who should be treated as responsible for Acme in the CRM?",
    noisy: "Ignore the old owner note: who is the current Acme owner?",
    multi_step: "After reassignment, who is responsible for the Acme account?"
  },
  "Task.mobile_checkout.status": {
    paraphrase: "What is the latest state of the mobile checkout task?",
    indirect: "If someone asks whether mobile checkout is still blocked, what status should we report?",
    noisy: "Ignore earlier blocked/todo notes: what is the mobile checkout task status now?",
    multi_step: "After todo and blocked states, what is the final status of mobile checkout?"
  },
  "Shopping.laptop.budget": {
    paraphrase: "What budget is currently set for the laptop purchase?",
    indirect: "How much can be spent on the laptop after the budget change?",
    noisy: "Ignore the earlier shopping budget: what is the laptop budget now?",
    multi_step: "After the budget was updated, what amount is current for the laptop?"
  },
  "Support chat.billing_thread.priority": {
    paraphrase: "What priority does the billing thread have now?",
    indirect: "How urgent is the billing support conversation currently?",
    noisy: "Ignore the low-priority note: what is the billing thread priority now?",
    multi_step: "After the support chat priority changed, what is the final priority?"
  },
  "Task.mobile_checkout.calendar_dependency": {
    paraphrase: "What time should the mobile checkout follow-up use from its calendar dependency?",
    indirect: "The mobile checkout task depends on a meeting; what is that meeting's current time?",
    noisy: "Ignore old meeting invites and task status chatter: what time is the meeting that mobile checkout depends on?",
    multi_step: "Following the mobile checkout dependency to the calendar event, what is the latest meeting time?"
  },
  "CRM.Acme.delivery_task": {
    paraphrase: "What is the status of the delivery task connected to the Acme account?",
    indirect: "Acme points to a delivery task; after following that link, what state is the task in?",
    noisy: "Ignore old CRM owner notes and earlier blocked task notes: what is Acme's linked task status now?",
    multi_step: "From Acme to its delivery task and then to task status, what final status should be reported?"
  }
};

function event(id, minutes, text, facts) {
  return {
    id,
    timestamp: new Date(BASE_TIME + minutes * 60_000).toISOString(),
    type: "user_message",
    text,
    facts
  };
}

function buildDomainDataset() {
  const events = [
    event("domain-calendar-001", 1, "Initial calendar note: Calendar planning meeting time is 10:00.", [
      { subject: "Calendar.planning_meeting", predicate: "meeting_time", object: "10:00", mutable: true, confidence: 0.95 }
    ]),
    event("domain-calendar-002", 2, "Final calendar update: Calendar planning meeting time is 11:30.", [
      { subject: "Calendar.planning_meeting", predicate: "meeting_time", object: "11:30", mutable: true, confidence: 0.95 }
    ]),
    event("domain-crm-001", 3, "Initial CRM note: CRM Acme account owner is Ivan.", [
      { subject: "CRM.Acme", predicate: "account_owner", object: "Ivan", mutable: true, confidence: 0.95 }
    ]),
    event("domain-crm-002", 4, "Final CRM update: CRM Acme account owner is Maria.", [
      { subject: "CRM.Acme", predicate: "account_owner", object: "Maria", mutable: true, confidence: 0.95 }
    ]),
    event("domain-task-001", 5, "Initial task note: Task mobile checkout status is todo.", [
      { subject: "Task.mobile_checkout", predicate: "status", object: "todo", mutable: true, confidence: 0.95 }
    ]),
    event("domain-task-002", 6, "Revision task note: Task mobile checkout status is blocked.", [
      { subject: "Task.mobile_checkout", predicate: "status", object: "blocked", mutable: true, confidence: 0.95 }
    ]),
    event("domain-task-003", 7, "Final task update: Task mobile checkout status is done.", [
      { subject: "Task.mobile_checkout", predicate: "status", object: "done", mutable: true, confidence: 0.95 }
    ]),
    event("domain-shopping-001", 8, "Initial shopping note: Shopping laptop budget is 1200 USD.", [
      { subject: "Shopping.laptop", predicate: "budget", object: "1200 USD", mutable: true, confidence: 0.95 }
    ]),
    event("domain-shopping-002", 9, "Final shopping update: Shopping laptop budget is 1500 USD.", [
      { subject: "Shopping.laptop", predicate: "budget", object: "1500 USD", mutable: true, confidence: 0.95 }
    ]),
    event("domain-chat-001", 10, "Initial support chat note: Support chat billing thread priority is low.", [
      { subject: "Support chat.billing_thread", predicate: "priority", object: "low", mutable: true, confidence: 0.95 }
    ]),
    event("domain-chat-002", 11, "Final support chat update: Support chat billing thread priority is urgent.", [
      { subject: "Support chat.billing_thread", predicate: "priority", object: "urgent", mutable: true, confidence: 0.95 }
    ]),
    event("domain-cross-001", 12, "Cross-domain link: Task mobile checkout depends on Calendar planning meeting.", [
      { subject: "Task.mobile_checkout", predicate: "calendar_dependency", object: "Calendar.planning_meeting", mutable: true, confidence: 0.95 }
    ]),
    event("domain-cross-002", 13, "Cross-domain CRM link: CRM Acme delivery task is Task mobile checkout.", [
      { subject: "CRM.Acme", predicate: "delivery_task", object: "Task.mobile_checkout", mutable: true, confidence: 0.95 }
    ])
  ];
  const questions = [
    {
      id: "domain-calendar-current",
      subject: "Calendar.planning_meeting",
      predicate: "meeting_time",
      expected: "11:30",
      obsoleteAnswers: ["10:00"],
      domain: "calendar"
    },
    {
      id: "domain-crm-current",
      subject: "CRM.Acme",
      predicate: "account_owner",
      expected: "Maria",
      obsoleteAnswers: ["Ivan"],
      domain: "crm"
    },
    {
      id: "domain-task-current",
      subject: "Task.mobile_checkout",
      predicate: "status",
      expected: "done",
      obsoleteAnswers: ["todo", "blocked"],
      domain: "tasks"
    },
    {
      id: "domain-shopping-current",
      subject: "Shopping.laptop",
      predicate: "budget",
      expected: "1500 USD",
      obsoleteAnswers: ["1200 USD"],
      domain: "shopping"
    },
    {
      id: "domain-chat-current",
      subject: "Support chat.billing_thread",
      predicate: "priority",
      expected: "urgent",
      obsoleteAnswers: ["low"],
      domain: "chat"
    },
    {
      id: "domain-cross-task-calendar",
      subject: "Task.mobile_checkout",
      predicate: "calendar_dependency",
      expected: "11:30",
      obsoleteAnswers: ["10:00"],
      domain: "cross_domain",
      hops: [
        { subject: "Task.mobile_checkout", predicate: "calendar_dependency" },
        { predicate: "meeting_time" }
      ]
    },
    {
      id: "domain-cross-crm-task",
      subject: "CRM.Acme",
      predicate: "delivery_task",
      expected: "done",
      obsoleteAnswers: ["todo", "blocked"],
      domain: "cross_domain",
      hops: [
        { subject: "CRM.Acme", predicate: "delivery_task" },
        { predicate: "status" }
      ]
    }
  ];

  return { events, questions };
}

function slotId(question) {
  return `${question.subject}.${question.predicate}`;
}

function baseQuestionsBySlot(baseQuestions) {
  const bySlot = new Map();

  for (const question of baseQuestions) {
    bySlot.set(slotId(question), question);
  }

  return bySlot;
}

function selectedCourseworkQuestions(baseQuestions, selectedIds) {
  const bySlot = baseQuestionsBySlot(baseQuestions);
  const selected = [];

  for (const id of selectedIds) {
    const question = bySlot.get(id);

    if (question) {
      selected.push(question);
    }
  }

  return selected;
}

function domainQuestionWithTemplate(question) {
  return {
    ...question,
    question: QUESTION_TEMPLATES[slotId(question)].paraphrase
  };
}

function domainQuestionsWithTemplates(domainQuestions) {
  const questions = [];

  for (const question of domainQuestions) {
    questions.push(domainQuestionWithTemplate(question));
  }

  return questions;
}

function robustQuestionVariants(question, variants) {
  const templates = QUESTION_TEMPLATES[slotId(question)];
  const questions = [];

  for (const variant of variants) {
    questions.push({
      ...question,
      id: `robust-${question.id}-${variant}`,
      question: templates[variant],
      questionType: variant === "multi_step" ? "temporal_multi_step" : variant,
      domain: question.domain ?? "coursework_memory",
      variant
    });
  }

  return questions;
}

function buildRobustQuestions(baseQuestions, domainQuestions) {
  const selectedIds = [
    "Reflex.runtime",
    "Reflex.selector_strategy",
    "State Memory coursework.topic",
    "State Memory coursework.deadline",
    "RAG baseline.retriever",
    "State updater.mutable_rule",
    "State Memory coursework.requires",
    "Metrics.include"
  ];
  const selected = selectedCourseworkQuestions(baseQuestions, selectedIds);
  const domains = domainQuestionsWithTemplates(domainQuestions);
  const variants = ["paraphrase", "indirect", "noisy", "multi_step"];
  const robustQuestions = [];

  for (const question of selected) {
    for (const robustQuestion of robustQuestionVariants(question, variants)) {
      robustQuestions.push(robustQuestion);
    }
  }

  for (const question of domains) {
    for (const robustQuestion of robustQuestionVariants(question, variants)) {
      robustQuestions.push(robustQuestion);
    }
  }

  return robustQuestions;
}

function candidateSlots(events) {
  const slots = new Map();

  for (const eventItem of events) {
    for (const fact of eventItem.facts ?? []) {
      const key = `${fact.subject}.${fact.predicate}`;
      slots.set(key, {
        subject: fact.subject,
        predicate: fact.predicate,
        aliases: SLOT_ALIASES[fact.predicate] ?? []
      });
    }
  }

  return [...slots.values()];
}

function scoreSlot(questionText, slot) {
  const text = normalize(questionText);
  const questionTokens = new Set(tokenize(text));
  const subjectTokens = tokenize(slot.subject.replaceAll(".", " "));
  const predicateTokens = tokenize(slot.predicate.replaceAll("_", " "));
  const aliasTokens = tokenize(slot.aliases.join(" "));

  let score = 0;

  for (const token of subjectTokens) {
    if (questionTokens.has(token)) score += 4;
  }
  for (const token of predicateTokens) {
    if (questionTokens.has(token)) score += 3;
  }
  for (const token of aliasTokens) {
    if (questionTokens.has(token)) score += 2;
  }

  if (text.includes(normalize(slot.subject.replaceAll(".", " ")))) score += 6;
  if (text.includes(normalize(slot.predicate.replaceAll("_", " ")))) score += 4;

  return score;
}

function createSlotCandidate(questionText, slot) {
  return {
    slot,
    score: scoreSlot(questionText, slot)
  };
}

function compareSlotCandidates(left, right) {
  return right.score - left.score;
}

function rankedSlotCandidates(questionText, slots) {
  const candidates = [];

  for (const slot of slots) {
    candidates.push(createSlotCandidate(questionText, slot));
  }

  candidates.sort(compareSlotCandidates);
  return candidates;
}

function topSlotCandidates(candidates, limit) {
  const selected = [];

  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    selected.push(candidate);
  }

  return selected;
}

function inferSlot(questionText, slots, threshold = 5) {
  const rankedCandidates = rankedSlotCandidates(questionText, slots);
  const best = rankedCandidates[0];
  const candidates = topSlotCandidates(rankedCandidates, 3);

  if (!best || best.score < threshold) {
    return {
      subject: null,
      predicate: null,
      score: best?.score ?? 0,
      candidates
    };
  }

  return {
    ...best.slot,
    score: best.score,
    candidates
  };
}

function expectedValues(question) {
  return Array.isArray(question.expected) ? question.expected : [question.expected];
}

function contextMetricsFromResolvedValues(question, values) {
  const contextHasGoldFact = expectedValues(question).every((expected) => values.includes(expected));

  return {
    contextHasGoldFact,
    goldRank: contextHasGoldFact ? 1 : null,
    reciprocalRank: contextHasGoldFact ? 1 : 0
  };
}

function contextMetricsFromEvents(question, rankedEvents) {
  const facts = rankedEvents.flatMap((eventItem) => eventItem.facts ?? []);

  if (hasHopChain(question)) {
    return contextMetricsFromResolvedValues(question, hopAnswerValues(facts, question));
  }

  const contextHasGoldFact = expectedValues(question).every((expected) =>
    facts.some(
      (fact) =>
        fact.subject === question.subject &&
        fact.predicate === question.predicate &&
        fact.object === expected
    )
  );
  const goldIndex = rankedEvents.findIndex((eventItem) =>
    eventItem.facts?.some(
      (fact) =>
        fact.subject === question.subject &&
        fact.predicate === question.predicate &&
        expectedValues(question).includes(fact.object)
    )
  );

  return {
    contextHasGoldFact,
    goldRank: goldIndex >= 0 ? goldIndex + 1 : null,
    reciprocalRank: goldIndex >= 0 ? 1 / (goldIndex + 1) : 0
  };
}

function contextMetricsFromFacts(question, facts) {
  if (hasHopChain(question)) {
    return contextMetricsFromResolvedValues(question, hopAnswerValues(facts, question));
  }

  const contextHasGoldFact = expectedValues(question).every((expected) =>
    facts.some(
      (fact) =>
        fact.subject === question.subject &&
        fact.predicate === question.predicate &&
        fact.object === expected
    )
  );
  const goldIndex = facts.findIndex(
    (fact) =>
      fact.subject === question.subject &&
      fact.predicate === question.predicate &&
      expectedValues(question).includes(fact.object)
  );

  return {
    contextHasGoldFact,
    goldRank: goldIndex >= 0 ? goldIndex + 1 : null,
    reciprocalRank: goldIndex >= 0 ? 1 / (goldIndex + 1) : 0
  };
}

function classifyError(grade, contextMetrics, slotCorrect) {
  if (!slotCorrect) return "slot_inference_failed";
  if (grade.correct) return "none";
  if (grade.staleFactError) return "stale_fact";
  if (!contextMetrics.contextHasGoldFact) return "missing_fact";
  if (!grade.answered) return "unknown_failed";
  return "answer_mismatch";
}

function decorateResult({ system, question, inferredSlot, answer, contextMetrics, contextTokens, latencyMs, contextIds }) {
  const slotCorrect =
    inferredSlot.subject === question.subject && inferredSlot.predicate === question.predicate;
  const grade = gradeAnswer(question, answer);

  return {
    system,
    questionId: question.id,
    questionType: question.questionType,
    domain: question.domain,
    variant: question.variant,
    requiresCurrentFact: question.obsoleteAnswers.length > 0,
    question: question.question,
    expected: question.expected,
    subject: question.subject,
    predicate: question.predicate,
    inferredSubject: inferredSlot.subject,
    inferredPredicate: inferredSlot.predicate,
    slotInferenceScore: inferredSlot.score,
    slotCandidates: inferredSlot.candidates.map((candidate) => ({
      subject: candidate.slot.subject,
      predicate: candidate.slot.predicate,
      score: candidate.score
    })),
    slotCorrect,
    answer: answer.answer,
    answerValues: answer.values,
    contextIds,
    contextTokens,
    latencyMs,
    ...contextMetrics,
    errorType: classifyError(grade, contextMetrics, slotCorrect),
    ...grade
  };
}

function inferredQuestion(question, inferredSlot) {
  const inferred = {
    ...question,
    subject: inferredSlot.subject ?? "__unknown__",
    predicate: inferredSlot.predicate ?? "__unknown__"
  };

  if (hasHopChain(question)) {
    const [firstHop, ...remainingHops] = question.hops;
    return {
      ...inferred,
      hops: [
        {
          ...firstHop,
          subject: inferred.subject,
          predicate: inferred.predicate
        },
        ...remainingHops
      ]
    };
  }

  return {
    ...inferred
  };
}

function evaluateRag(events, questions, slots, { topK, temporal = false }) {
  return questions.map((question) => {
    const start = performance.now();
    const inferredSlot = inferSlot(question.question, slots);
    const lookupQuestion = inferredQuestion(question, inferredSlot);
    const retrievedEvents = temporal
      ? retrieveEventsWithRecency(events, question.question, { topK })
      : retrieveEvents(events, question.question, { topK });
    const answer = temporal
      ? answerLatestFromRetrievedEvents(lookupQuestion, retrievedEvents)
      : answerFromRetrievedEvents(lookupQuestion, retrievedEvents);
    const latencyMs = performance.now() - start;

    return decorateResult({
      system: temporal ? "temporal_rag" : "rag",
      question,
      inferredSlot,
      answer,
      contextMetrics: contextMetricsFromEvents(question, retrievedEvents),
      contextTokens: tokenCount(retrievedEvents.map((eventItem) => eventItem.text).join("\n")),
      latencyMs,
      contextIds: retrievedEvents.map((eventItem) => eventItem.id)
    });
  });
}

function evaluateVectorRag(events, questions, slots, { topK }) {
  const retriever = createEmbeddingRetriever(events);

  return questions.map((question) => {
    const start = performance.now();
    const inferredSlot = inferSlot(question.question, slots);
    const lookupQuestion = inferredQuestion(question, inferredSlot);
    const retrievedEvents = retriever.retrieveEvents(question.question, { topK });
    const answer = answerLatestFromRetrievedEvents(lookupQuestion, retrievedEvents);
    const latencyMs = performance.now() - start;

    return decorateResult({
      system: "vector_rag",
      question,
      inferredSlot,
      answer,
      contextMetrics: contextMetricsFromEvents(question, retrievedEvents),
      contextTokens: tokenCount(retrievedEvents.map((eventItem) => eventItem.text).join("\n")),
      latencyMs,
      contextIds: retrievedEvents.map((eventItem) => eventItem.id)
    });
  });
}

function evaluateState(worldState, questions, slots, { stateLimit }) {
  return questions.map((question) => {
    const start = performance.now();
    const inferredSlot = inferSlot(question.question, slots);
    const lookupQuestion = inferredQuestion(question, inferredSlot);
    const facts = selectRelevantFacts(worldState, lookupQuestion, { limit: stateLimit });
    const prompt = buildPrompt(lookupQuestion, facts);
    const answer = answerFromFacts(lookupQuestion, facts);
    const latencyMs = performance.now() - start;

    return decorateResult({
      system: "state_no_oracle",
      question,
      inferredSlot,
      answer,
      contextMetrics: contextMetricsFromFacts(question, facts),
      contextTokens: tokenCount(prompt),
      latencyMs,
      contextIds: facts.map((fact) => fact.id)
    });
  });
}

function average(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function addRobustSummary(results) {
  const currentFactResults = results.filter((result) => result.requiresCurrentFact);
  const currentFactCorrect = currentFactResults.filter((result) => result.correct).length;

  return {
    ...summarizeResults(results),
    currentFactQuestions: currentFactResults.length,
    currentFactAccuracy:
      currentFactResults.length === 0 ? 0 : currentFactCorrect / currentFactResults.length,
    slotInferenceAccuracy: average(results.map((result) => (result.slotCorrect ? 1 : 0)))
  };
}

function groupSummary(results, key) {
  const groups = {};

  for (const result of results) {
    groups[result[key]] ??= [];
    groups[result[key]].push(result);
  }

  return Object.fromEntries(
    Object.entries(groups).map(([group, groupResults]) => [group, addRobustSummary(groupResults)])
  );
}

function slotInferenceAnalysis(results) {
  const failures = results.filter((result) => !result.slotCorrect);
  const failureRows = (key) => groupSummary(failures, key);

  return {
    failures: failures.length,
    failureRate: failures.length / Math.max(1, results.length),
    byType: failureRows("questionType"),
    byDomain: failureRows("domain"),
    examples: failures.slice(0, 8).map((result) => ({
      questionId: result.questionId,
      questionType: result.questionType,
      domain: result.domain,
      question: result.question,
      expectedSlot: `${result.subject ?? ""}.${result.predicate ?? ""}`,
      inferredSlot: `${result.inferredSubject ?? "unknown"}.${result.inferredPredicate ?? "unknown"}`,
      topCandidates: result.slotCandidates
    }))
  };
}

function rounded(value) {
  return Number(value ?? 0).toFixed(4);
}

function row(name, metrics) {
  return `| ${name} | ${rounded(metrics.exactMatchAccuracy)} | ${rounded(metrics.currentFactAccuracy)} | ${rounded(metrics.contextHitRate)} | ${rounded(metrics.slotInferenceAccuracy)} | ${rounded(metrics.averageContextTokens)} | ${rounded(metrics.averageLatencyMs)} |`;
}

function buildMarkdown(summary) {
  const typeRows = Object.keys(summary.byType.stateNoOracle)
    .map((type) => {
      const rag = summary.byType.rag[type] ?? {};
      const vector = summary.byType.vectorRag[type] ?? {};
      const temporal = summary.byType.temporalRag[type] ?? {};
      const state = summary.byType.stateNoOracle[type] ?? {};
      return `| ${type} | ${rounded(rag.exactMatchAccuracy)} | ${rounded(vector.exactMatchAccuracy)} | ${rounded(temporal.exactMatchAccuracy)} | ${rounded(state.exactMatchAccuracy)} | ${rounded(state.slotInferenceAccuracy)} |`;
    })
    .join("\n");
  const domainRows = Object.keys(summary.byDomain.stateNoOracle)
    .map((domain) => {
      const rag = summary.byDomain.rag[domain] ?? {};
      const vector = summary.byDomain.vectorRag[domain] ?? {};
      const temporal = summary.byDomain.temporalRag[domain] ?? {};
      const state = summary.byDomain.stateNoOracle[domain] ?? {};
      return `| ${domain} | ${rounded(rag.exactMatchAccuracy)} | ${rounded(vector.exactMatchAccuracy)} | ${rounded(temporal.exactMatchAccuracy)} | ${rounded(state.exactMatchAccuracy)} | ${rounded(state.slotInferenceAccuracy)} |`;
    })
    .join("\n");
  const slotFailureRows = Object.entries(summary.slotInferenceAnalysis.byType)
    .map(
      ([type, metrics]) =>
        `| ${type} | ${metrics.totalQuestions} | ${rounded(metrics.slotInferenceAccuracy)} | ${rounded(metrics.exactMatchAccuracy)} |`
    )
    .join("\n");

  return `# Robust Question Experiment

This is the main non-oracle current-state benchmark. Systems receive only the question text and must infer the target subject/predicate slot before answering. The slot metadata is used only for grading. Temporal RAG is the primary retrieval baseline; local vector RAG is included as a stronger vector-store-shaped retrieval baseline, and naive RAG is retained as a weak baseline.

| System | Exact Match | Current Fact Accuracy | Context Hit | Slot Inference Accuracy | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${row("RAG", summary.rag)}
${row("Vector RAG", summary.vectorRag)}
${row("Temporal RAG", summary.temporalRag)}
${row("State Memory, no oracle", summary.stateNoOracle)}

Accuracy by question type:

| Type | RAG | Vector RAG | Temporal RAG | State no-oracle | State slot inference |
| --- | ---: | ---: | ---: | ---: | ---: |
${typeRows}

Accuracy by domain:

| Domain | RAG | Vector RAG | Temporal RAG | State no-oracle | State slot inference |
| --- | ---: | ---: | ---: | ---: | ---: |
${domainRows}

Slot inference failures by question type:

| Type | Failure count | Slot accuracy on failures | Exact match on failures |
| --- | ---: | ---: | ---: |
${slotFailureRows}

Interpretation: this is a harder benchmark than the oracle memory-isolation experiment. Temporal RAG closes much of the naive-RAG gap, which means the measured State Memory advantage should be read against the stronger recency/latest-fact baseline. The benchmark includes paraphrased, indirect, noisy and temporal multi-step questions across coursework memory plus calendar, CRM, task, shopping, chat and cross-domain dependency questions.
`;
}

export async function runRobustQuestionExperiment({
  eventCount = 1000,
  seed = 42,
  ragTopK = 12,
  stateLimit = 8,
  resultsDir = "results/robust"
} = {}) {
  const baseDataset = buildDataset({ eventCount, seed });
  const domainDataset = buildDomainDataset();
  const events = [...baseDataset.events, ...domainDataset.events];
  const questions = buildRobustQuestions(baseDataset.questions, domainDataset.questions);
  const slots = candidateSlots(events);
  const worldState = buildWorldState(events);

  const ragResults = evaluateRag(events, questions, slots, { topK: ragTopK });
  const vectorRagResults = evaluateVectorRag(events, questions, slots, { topK: ragTopK });
  const temporalRagResults = evaluateRag(events, questions, slots, {
    topK: ragTopK,
    temporal: true
  });
  const stateResults = evaluateState(worldState, questions, slots, { stateLimit });

  const summary = {
    dataset: {
      events: events.length,
      questions: questions.length,
      domains: [...new Set(questions.map((question) => question.domain))],
      questionTypes: [...new Set(questions.map((question) => question.questionType))]
    },
    configuration: {
      ragTopK,
      stateLimit,
      slotInferenceThreshold: 5
    },
    rag: addRobustSummary(ragResults),
    vectorRag: addRobustSummary(vectorRagResults),
    temporalRag: addRobustSummary(temporalRagResults),
    stateNoOracle: addRobustSummary(stateResults),
    slotInferenceAnalysis: slotInferenceAnalysis(stateResults),
    byType: {
      rag: groupSummary(ragResults, "questionType"),
      vectorRag: groupSummary(vectorRagResults, "questionType"),
      temporalRag: groupSummary(temporalRagResults, "questionType"),
      stateNoOracle: groupSummary(stateResults, "questionType")
    },
    byDomain: {
      rag: groupSummary(ragResults, "domain"),
      vectorRag: groupSummary(vectorRagResults, "domain"),
      temporalRag: groupSummary(temporalRagResults, "domain"),
      stateNoOracle: groupSummary(stateResults, "domain")
    }
  };

  await writeJson(`${resultsDir}/rag-results.json`, ragResults);
  await writeJson(`${resultsDir}/vector-rag-results.json`, vectorRagResults);
  await writeJson(`${resultsDir}/temporal-rag-results.json`, temporalRagResults);
  await writeJson(`${resultsDir}/state-no-oracle-results.json`, stateResults);
  await writeJson(`${resultsDir}/summary.json`, summary);
  await writeText(`${resultsDir}/summary.md`, buildMarkdown(summary));

  return summary;
}
