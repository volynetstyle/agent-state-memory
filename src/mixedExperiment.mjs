import { runMixedExperiment } from "./eval/runMixedExperiment.mjs";

function readNumberArg(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? Number(match.slice(prefix.length)) : fallback;
}

const summary = await runMixedExperiment({
  eventCount: readNumberArg("events", 1000),
  pageCount: readNumberArg("pages", 100),
  documentQuestions: readNumberArg("document-questions", 60),
  seed: readNumberArg("seed", 42)
});

console.log(JSON.stringify(summary, null, 2));
