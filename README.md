# Coursework State Memory

Minimal reproducible coursework MVP for comparing two memory strategies for long-context LLM agents:

- `RAG baseline`: question -> lexical retriever -> relevant event memories -> answer
- `State Memory`: question -> structured world state -> relevant active facts -> answer

The main experiment is intentionally zero-dependency. It uses deterministic synthetic data and a deterministic answerer so the memory layer can be evaluated without API keys or non-reproducible LLM calls.

An optional LLM-backed experiment is also included. The deterministic experiment isolates memory quality; the LLM experiment validates the same RAG and State Memory contexts with a real local language model.

## Run

```bash
npm run experiment
```

This generates the dataset if needed, runs both systems, and writes:

- `data/events.jsonl`
- `data/questions.json`
- `data/ground_truth.json`
- `results/rag-results.json`
- `results/state-results.json`
- `results/world-state.json`
- `results/summary.json`
- `results/summary.md`
- `results/charts/metrics.csv`

Regenerate the dataset explicitly:

```bash
npm run generate
```

Run a fresh experiment with regenerated data:

```bash
node src/index.mjs --regenerate
```

Run the scalability experiment:

```bash
npm run experiment:scale
```

This evaluates the same systems on `100, 250, 500, 1000, 2500, 5000` events with multiple deterministic seeds and writes:

- `results/scalability/raw-runs.json`
- `results/scalability/summary.json`
- `results/scalability/summary.md`
- `results/scalability/scalability.csv`

Run the mixed knowledge experiment:

```bash
npm run experiment:mixed
```

This evaluates three modes:

- `RAG-only`: retrieval over raw event chunks and long-document chunks
- `State-only`: structured state memory without document retrieval
- `Hybrid`: State Memory for evolving state, RAG for unstructured documents

The mixed benchmark includes current-state questions, stable non-current state questions, and document-detail questions from a synthetic 100-page unstructured document. It writes:

- `results/mixed/rag-only-results.json`
- `results/mixed/state-only-results.json`
- `results/mixed/hybrid-results.json`
- `results/mixed/summary.json`
- `results/mixed/summary.md`

Run the stress experiment:

```bash
npm run experiment:stress
```

This intentionally weakens the clean benchmark assumptions:

- `clean_extraction`: ideal structured facts
- `missing_final_updates`: extractor misses final mutable updates
- `wrong_extraction_slot`: extractor assigns some facts to the wrong entity slot
- `low_confidence_final_updates`: extractor sees updates but assigns low confidence
- `near_simultaneous_conflicts`: two competing updates for the same slot arrive at almost the same time
- `ambiguous_similar_entities`: similar legacy entities add noise

It compares:

- classic RAG
- RAG with recency reranking and latest-fact answering
- State Memory
- Defensive State Memory with confidence thresholding, conflict tracking, short version history and Temporal RAG fallback for uncertain slots

The stress results are written to `results/stress/`.

## Optional LLM Experiment

The LLM-backed experiment uses local Ollama by default:

```bash
npm run experiment:llm
```

Default model:

```bash
llama3.2:3b
```

You can choose another local model:

```bash
npm run experiment:llm -- --model=mistral
```

You can reduce or increase the question subset:

```bash
npm run experiment:llm -- --questions=30
```

For slower CPUs or GitHub runners, the Ollama request timeout and maximum answer length can be tuned:

```bash
npm run experiment:llm -- --questions=30 --unknown=5 --timeout-ms=120000 --num-predict=64
```

The current LLM experiment is a mixed validation benchmark. It runs the same question set through:

- `RAG + LLM`
- `State + LLM`
- `Hybrid + LLM`

The default question set is split across current-state questions, stable-state questions, document-detail questions, and additional unanswerable `UNKNOWN` questions. You can tune it:

```bash
npm run experiment:llm -- --current=10 --stable=6 --document=10 --unknown=5 --model=llama3.2:3b
```

The prompt explicitly instructs the model to answer only from the provided context and return `UNKNOWN` when the answer is absent. Generation uses `temperature: 0` and a fixed seed for lower variance. Results are written to:

- `results/llm/rag-llm-results.json`
- `results/llm/state-llm-results.json`
- `results/llm/hybrid-llm-results.json`
- `results/llm/raw-responses.json`
- `results/llm/summary.json`
- `results/llm/summary.md`

The LLM runner prints progress lines for every system/question pair, for example `[RAG] 3/35 current_state q-001`. This is useful in CI because a 35-question run performs 105 model calls: `RAG + LLM`, `State + LLM`, and `Hybrid + LLM`.

The LLM summary reports normalized accuracy, unknown accuracy, prompt compliance rate, hallucination rate, context tokens, latency breakdown into retrieval, prompt building, LLM generation, and total time, plus top failure examples. Raw answers, normalized answers, contexts, error types, and context-hit flags are stored in `results/llm/raw-responses.json`.

Use this mode in the coursework as an additional validation experiment, not as the primary controlled benchmark.

## What Is Implemented

The dataset contains 1000 timestamped events. Some events introduce stable facts, while others update mutable facts. For example, an older event may say that the coursework topic is `RAG for agents`, and a later event updates it to `State Memory for LLM agents`.

The RAG baseline stores events as text chunks and retrieves top-k relevant memories. It has no explicit state update rule, so old and new facts can be retrieved together.

State Memory extracts structured facts from each event and applies update rules:

- mutable facts use `latest wins`
- old mutable facts become `obsolete`
- append-only facts remain active
- the prompt receives only selected active facts

## Metrics

The evaluator reports:

- `exactMatchAccuracy`: share of answers that exactly match the expected answer
- `recallAccuracy`: share of questions answered correctly
- `precision`: correctness among non-unknown answers
- `f1Score`: harmonic mean of precision and recall
- `currentFactAccuracy`: accuracy on questions that require the latest mutable fact
- `obsoleteFactRejectionRate`: share of mutable-fact cases where obsolete facts were not used
- `staleFactErrorRate`: share of answers that used obsolete facts
- `contextHitRate`: share of questions where the correct fact reached the answer context
- `meanReciprocalRank`: ranking quality for the first correct fact in retrieved/selected context
- `averageContextTokens`: approximate context size
- `averageLatencyMs`: local retrieval/selection latency
- `contextCompressionRatio`: full history tokens divided by average context tokens
- `contextEfficiency`: exact-match accuracy divided by average context tokens
- `latencyEfficiency`: exact-match accuracy divided by average latency

The results also include a paired comparison table:

- both systems correct
- State Memory correct while RAG is wrong
- RAG correct while State Memory is wrong
- both systems wrong

The most important metric for the coursework argument is `staleFactErrorRate`, because the main hypothesis is that structured state reduces obsolete-fact errors compared with retrieval over raw history.

## Coursework Positioning

In the base experiment, the language model is replaced with a deterministic answer module to isolate the quality of the memory mechanism. In the optional experiment, a local LLM is used as the answerer to validate that the same effect can be observed with a real generative component.

This gives two complementary experiments:

- `Experiment 1`: RAG vs State Memory with deterministic answerer over 1000 events.
- `Experiment 2`: RAG vs State Memory with local LLM answerer over a smaller question subset.
- `Experiment 3`: RAG-only vs State-only vs Hybrid on mixed structured state and unstructured 100-page document QA.

The third experiment is important for limitations: State Memory is not a replacement for RAG over large unstructured documents. It is a state layer for evolving facts, goals, tasks and user/project state. For document-heavy QA, the stronger architecture is hybrid.

The stress experiment is important for self-criticism: perfect State Memory scores depend on clean extraction. If final updates are missing or facts are assigned to the wrong slot, State Memory degrades. The defensive variant shows practical mitigations: low-confidence facts are rejected into a buffer, conflicting facts are preserved instead of silently overwriting each other, recent versions are retained, and uncertain slots fall back to Temporal RAG. It also shows the remaining hard limit: if extraction fully misses an update, the state layer needs reconciliation against raw events or documents to recover it. Stronger temporal RAG baselines can reduce stale errors, so future work should compare State Memory against temporal-aware RAG instead of only naive RAG.

## Docker And CI

Run the deterministic benchmark in Docker:

```bash
docker build -t coursework-state-memory .
docker run --rm coursework-state-memory
```

Run another command in the same image:

```bash
docker run --rm coursework-state-memory npm run experiment:mixed
```

For LLM experiments, run Ollama on the host and pass its URL into the container:

```bash
docker run --rm -e OLLAMA_URL=http://host.docker.internal:11434 coursework-state-memory npm run experiment:llm -- --model=llama3.2:3b --questions=30 --unknown=5
```

GitHub Actions includes:

- `CI`: runs syntax checks and deterministic experiments on push/pull request.
- `Ollama LLM Experiment`: manual workflow that installs Ollama, pulls the selected model, runs `npm run experiment:llm`, regenerates `RESULTS.md`, commits `RESULTS.md` plus `results/llm` back to the branch, and uploads the same files as artifacts.

The Ollama workflow caches downloaded model files with `actions/cache`. The first run for a model still downloads it, but later runs restore `${{ github.workspace }}/.ollama/models` before `ollama pull`, so the pull step should become a quick availability check. If a model tag changes or the cache needs to be refreshed, bump the workflow input `cache_version`.

## Repository Shape

```text
coursework-state-memory/
|- data/
|- results/
|- src/
|  |- eval/
|  |- document/
|  |- llm/
|  |- rag/
|  |- shared/
|  `- state-memory/
|- package.json
`- README.md
```
