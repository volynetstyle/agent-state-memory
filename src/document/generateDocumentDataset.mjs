function pad(value, width = 3) {
  return String(value).padStart(width, "0");
}

function topicFor(page) {
  const topics = [
    "memory architecture",
    "retrieval evaluation",
    "state update rules",
    "agent planning",
    "prompt construction",
    "benchmark design",
    "error analysis",
    "latency profiling"
  ];
  return topics[(page - 1) % topics.length];
}

function makeCode(page, paragraph) {
  return `DOC-${pad(page)}-${paragraph}`;
}

function makeValue(page, paragraph) {
  return `VALUE-${pad(page)}-${paragraph}`;
}

function makeChunk(page, paragraph) {
  const code = makeCode(page, paragraph);
  const value = makeValue(page, paragraph);
  const topic = topicFor(page);
  const questionId = `doc-q-${pad(page)}-${paragraph}`;

  return {
    id: `doc-page-${pad(page)}-p${paragraph}`,
    page,
    paragraph,
    text:
      `Page ${page}, paragraph ${paragraph}. This unstructured document section discusses ${topic}. ` +
      `The reference marker ${code} is described in prose, not as a structured state fact. ` +
      `For this marker, the recorded answer token is ${value}. ` +
      `Additional surrounding text mentions experiments, notes, examples and unrelated implementation details.`,
    answers: {
      [questionId]: value
    },
    question: {
      id: questionId,
      question: `In the long document, what answer token is recorded for marker ${code}?`,
      expected: value,
      obsoleteAnswers: [],
      questionType: "document_detail",
      sourceChunkId: `doc-page-${pad(page)}-p${paragraph}`
    }
  };
}

function questionSamplingStride(chunks, questionLimit) {
  return Math.max(1, Math.floor(chunks.length / questionLimit));
}

function selectDocumentQuestions(chunks, questionLimit) {
  const questions = [];
  const stride = questionSamplingStride(chunks, questionLimit);

  for (let index = 0; index < chunks.length; index += stride) {
    if (questions.length >= questionLimit) break;
    questions.push(chunks[index].question);
  }

  return questions;
}

function documentChunks(chunks) {
  const documents = [];

  for (const chunk of chunks) {
    const { question, ...document } = chunk;
    documents.push(document);
  }

  return documents;
}

export function buildDocumentDataset({
  pageCount = 100,
  paragraphsPerPage = 3,
  questionLimit = 60
} = {}) {
  const chunks = [];

  for (let page = 1; page <= pageCount; page += 1) {
    for (let paragraph = 1; paragraph <= paragraphsPerPage; paragraph += 1) {
      chunks.push(makeChunk(page, paragraph));
    }
  }

  const questions = selectDocumentQuestions(chunks, questionLimit);

  return {
    documents: documentChunks(chunks),
    questions,
    meta: {
      pageCount,
      paragraphsPerPage,
      chunks: chunks.length,
      questions: questions.length
    }
  };
}
