import { existsSync } from "node:fs";
import { generateDataset } from "./generateDataset.mjs";
import { runExperiment } from "./eval/runExperiment.mjs";

if (!existsSync("data/events.jsonl") || process.argv.includes("--regenerate")) {
  await generateDataset();
}

const summary = await runExperiment();

console.log(JSON.stringify(summary, null, 2));
