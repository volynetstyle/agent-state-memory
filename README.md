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

The prompt explicitly instructs the model to answer only from the provided context and return `UNKNOWN` when the answer is absent. Results are written to:

- `results/llm/rag-llm-results.json`
- `results/llm/state-llm-results.json`
- `results/llm/summary.json`
- `results/llm/summary.md`

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
