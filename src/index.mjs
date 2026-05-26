import { existsSync } from "node:fs";
import { generateDataset } from "./dataset/generateDataset.mjs";
import { runExperiment } from "./experiments/runner.mjs";

if (!existsSync("data/events.jsonl") || process.argv.includes("--regenerate")) {
  await generateDataset();
}

const summary = await runExperiment({ experiment: "deterministic" });

console.log(JSON.stringify(summary, null, 2));
