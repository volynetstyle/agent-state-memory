import { runExperiment } from "./experiments/runner.mjs";

function readNumberArg(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? Number(match.slice(prefix.length)) : fallback;
}

const summary = await runExperiment({
  experiment: "robust",
  eventCount: readNumberArg("events", 1000),
  seed: readNumberArg("seed", 42),
  ragTopK: readNumberArg("rag-top-k", 12),
  stateLimit: readNumberArg("state-limit", 8)
});

console.log(JSON.stringify(summary, null, 2));
