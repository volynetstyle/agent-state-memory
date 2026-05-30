import { unique } from "./text.mjs";

function activeEnough(fact) {
  return fact.status !== "obsolete";
}

function factMatchesStep(fact, subject, predicate) {
  return activeEnough(fact) && fact.subject === subject && fact.predicate === predicate;
}

export function hasHopChain(question) {
  return Array.isArray(question.hops) && question.hops.length > 1;
}

export function resolveHopValues(facts, question) {
  if (!hasHopChain(question)) return null;

  let subjects = [];

  for (let index = 0; index < question.hops.length; index += 1) {
    const hop = question.hops[index];
    const sourceSubjects = index === 0 ? [hop.subject ?? question.subject] : subjects;
    const nextValues = [];

    for (const subject of sourceSubjects) {
      for (const fact of facts) {
        if (factMatchesStep(fact, subject, hop.predicate)) {
          nextValues.push(fact.object);
        }
      }
    }

    subjects = unique(nextValues);
    if (subjects.length === 0) break;
  }

  return subjects;
}

export function hopAnswerValues(facts, question) {
  const values = resolveHopValues(facts, question);
  return values ?? [];
}
