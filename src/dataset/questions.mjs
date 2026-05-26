function mutableQuestion(slot, index) {
  return {
    id: `q-current-${String(index + 1).padStart(3, "0")}`,
    question: slot.question,
    subject: slot.subject,
    predicate: slot.predicate,
    expected: slot.values.at(-1),
    obsoleteAnswers: slot.values.slice(0, -1)
  };
}

function appendQuestion(slot, index) {
  return {
    id: `q-list-${String(index + 1).padStart(3, "0")}`,
    question: slot.question,
    subject: slot.subject,
    predicate: slot.predicate,
    expected: slot.values,
    obsoleteAnswers: []
  };
}

export function buildDatasetQuestions(scenario) {
  const questions = [];

  for (let index = 0; index < scenario.mutableSlots.length; index += 1) {
    questions.push(mutableQuestion(scenario.mutableSlots[index], index));
  }

  for (let index = 0; index < scenario.appendSlots.length; index += 1) {
    questions.push(appendQuestion(scenario.appendSlots[index], index));
  }

  return questions;
}

export function buildGroundTruth(questions) {
  const groundTruth = {};

  for (const question of questions) {
    groundTruth[question.id] = {
      subject: question.subject,
      predicate: question.predicate,
      expected: question.expected,
      obsoleteAnswers: question.obsoleteAnswers
    };
  }

  return groundTruth;
}
