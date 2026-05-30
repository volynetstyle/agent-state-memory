import { runExperiment as runDeterministicExperiment } from "./deterministic.mjs";
import { runExtractorBenchmark } from "./extractor.mjs";
import { runLlmExperiment } from "./llm.mjs";
import { runLlmMixedExperiment } from "./llmMixed.mjs";
import { runMixedExperiment } from "./mixed.mjs";
import { runRealTraceExperiment } from "./real.mjs";
import { runRobustQuestionExperiment } from "./robust.mjs";
import { runScalabilityExperiment } from "./scalability.mjs";
import { runStressExperiment } from "./stress.mjs";

const experimentRegistry = {
  deterministic: runDeterministicExperiment,
  extractor: runExtractorBenchmark,
  oracle: runDeterministicExperiment,
  llm: runLlmExperiment,
  llm_mixed: runLlmMixedExperiment,
  mixed: runMixedExperiment,
  real: runRealTraceExperiment,
  robust: runRobustQuestionExperiment,
  scalability: runScalabilityExperiment,
  stress: runStressExperiment
};

export function availableExperiments() {
  return Object.keys(experimentRegistry);
}

export async function runExperiment({ experiment = "deterministic", ...options } = {}) {
  const run = experimentRegistry[experiment];

  if (!run) {
    throw new Error(
      `Unknown experiment "${experiment}". Available experiments: ${availableExperiments().join(", ")}`
    );
  }

  return run(options);
}

export {
  runDeterministicExperiment,
  runExtractorBenchmark,
  runLlmExperiment,
  runLlmMixedExperiment,
  runMixedExperiment,
  runRealTraceExperiment,
  runRobustQuestionExperiment,
  runScalabilityExperiment,
  runStressExperiment
};
