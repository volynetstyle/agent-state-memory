import { runScalabilityExperiment } from "./eval/runScalabilityExperiment.mjs";

function readNumberArg(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? Number(match.slice(prefix.length)) : fallback;
}

function readEventCounts(fallback) {
  const prefix = "--events=";
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).split(",").map(Number) : fallback;
}

const summary = await runScalabilityExperiment({
  eventCounts: readEventCounts([100, 250, 500, 1000, 2500, 5000]),
  seedRuns: readNumberArg("seeds", 3),
  seedStart: readNumberArg("seed", 42)
});

console.log(JSON.stringify(summary, null, 2));
