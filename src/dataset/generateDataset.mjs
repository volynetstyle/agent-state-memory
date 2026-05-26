import { fileURLToPath } from "node:url";
import { ensureDir, writeJson, writeJsonl } from "../shared/io.mjs";
import { buildDatasetEvents } from "./events.mjs";
import { buildDatasetQuestions, buildGroundTruth } from "./questions.mjs";
import {
  COURSEWORK_DATASET_META,
  COURSEWORK_DEFAULTS,
  courseworkScenario
} from "./scenarios/coursework.mjs";

const DATA_DIR = "data";

export function buildDataset({
  eventCount = COURSEWORK_DEFAULTS.eventCount,
  seed = COURSEWORK_DEFAULTS.seed
} = {}) {
  const scenario = courseworkScenario(eventCount);
  const events = buildDatasetEvents({ scenario, eventCount, seed });
  const questions = buildDatasetQuestions(scenario);
  const groundTruth = buildGroundTruth(questions);

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

export const DATASET_META = COURSEWORK_DATASET_META;
