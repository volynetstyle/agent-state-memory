import { runExperiment as runDeterministicExperiment } from "./deterministic.mjs";
import { runLlmExperiment } from "./llm.mjs";
import { runLlmMixedExperiment } from "./llmMixed.mjs";
import { runMixedExperiment } from "./mixed.mjs";
import { runRobustQuestionExperiment } from "./robust.mjs";
import { runScalabilityExperiment } from "./scalability.mjs";
import { runStressExperiment } from "./stress.mjs";

const experimentRegistry = {
  deterministic: runDeterministicExperiment,
  oracle: runDeterministicExperiment,
  llm: runLlmExperiment,
  llm_mixed: runLlmMixedExperiment,
  mixed: runMixedExperiment,
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
  runLlmExperiment,
  runLlmMixedExperiment,
  runMixedExperiment,
  runRobustQuestionExperiment,
  runScalabilityExperiment,
  runStressExperiment
};
