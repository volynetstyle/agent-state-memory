import { runStressExperiment } from "./eval/runStressExperiment.mjs";

function readNumberArg(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? Number(match.slice(prefix.length)) : fallback;
}

const summary = await runStressExperiment({
  eventCount: readNumberArg("events", 1000),
  seed: readNumberArg("seed", 42)
});

console.log(JSON.stringify(summary, null, 2));
