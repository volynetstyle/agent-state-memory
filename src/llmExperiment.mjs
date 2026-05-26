import { existsSync } from "node:fs";
import { generateDataset } from "./generateDataset.mjs";
import { runLlmMixedExperiment } from "./eval/runLlmMixedExperiment.mjs";

function readNumberArg(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? Number(match.slice(prefix.length)) : fallback;
}

function readStringArg(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

if (!existsSync("data/events.jsonl") || process.argv.includes("--regenerate")) {
  await generateDataset();
}

const questionLimit = readNumberArg("questions", 50);
const model = readStringArg("model", process.env.OLLAMA_MODEL ?? "llama3.2:3b");
const currentCount = readNumberArg("current", Math.floor(questionLimit / 3));
const stableCount = readNumberArg("stable", Math.floor(questionLimit / 3));
const documentCount = readNumberArg("document", questionLimit - currentCount - stableCount);
const unknownCount = readNumberArg("unknown", 5);

if (process.argv.includes("--dry-run")) {
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        message: "LLM experiment is configured. Remove --dry-run to call Ollama.",
        model,
        currentCount,
        stableCount,
        documentCount,
        unknownCount,
        command: "npm run experiment:llm"
      },
      null,
      2
    )
  );
  process.exit(0);
}

try {
  const summary = await runLlmMixedExperiment({
    currentCount,
    stableCount,
    documentCount,
    unknownCount,
    ollama: { model }
  });

  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error.message);
  console.error("");
  console.error("Start Ollama and make sure the model is available, for example:");
  console.error(`  ollama pull ${model}`);
  console.error("  npm run experiment:llm");
  process.exit(1);
}
