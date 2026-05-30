import { runExperiment } from "./experiments/runner.mjs";

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

const summary = await runExperiment({
  experiment: "real",
  topK: readNumberArg("top-k", 6),
  stateLimit: readNumberArg("state-limit", 6),
  langChainWindowSize: readNumberArg("langchain-window", 6),
  useLlmExtractor: process.argv.includes("--llm-extractor"),
  ollama: {
    model: readStringArg("model", process.env.OLLAMA_MODEL ?? "llama3.2:3b"),
    timeoutMs: readNumberArg("timeout-ms", 120000),
    numPredict: readNumberArg("num-predict", 256)
  }
});

console.log(JSON.stringify(summary, null, 2));
