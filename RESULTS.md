# Results
This file is generated from `results/**/summary.json` and LLM result files by `npm run results`.
## Executive Summary

1. The deterministic 1.0000 score is an oracle/diagnostic upper-bound result, not the main agent-level claim.
2. The main non-oracle comparison is State Memory versus Temporal/vector RAG: State no-oracle reaches 0.8000 Exact Match, while Temporal RAG reaches 0.6833, local vector RAG reaches 0.6667 and naive RAG reaches 0.1333.
3. The small State-vs-Temporal/vector gap shows that much of the naive-RAG failure comes from missing temporal/latest-fact handling; explicit state still improves accuracy, context hit rate and latency in the robust benchmark.
4. RAG remains strong for document-detail questions, while State-only fails on document details. Hybrid reaches 1.0000 Exact Match on mixed structured/document tasks.
5. Defensive State is useful when uncertainty is visible: it recovers near-simultaneous conflicts at 1.0000 Exact Match, but cannot recover missing final updates (0.1429).
6. State Memory lookup scales with near-constant latency. At 5000 events, RAG averages 13.7903 ms and State Memory averages 0.4510 ms, a 30.6x speedup; state build/write cost is 0.0053 ms per event.
7. The LLM benchmark supports hybrid routing: Hybrid + LLM reaches 0.9355 normalized accuracy with 0.0000 hallucination rate.
8. A real project-trace benchmark is included: State Memory reaches 1.0000 Exact Match, while the LangChain BufferMemory-style baseline reaches 0.7500.
9. The real extractor benchmark shows extraction sensitivity: the rule extractor reaches 0.7143 extraction recall and 0.8750 downstream QA Exact Match.

## Level 1: Main Findings

| Finding | Main evidence |
| --- | --- |
| Oracle benchmark is diagnostic | Controlled slot access gives State 1.0000 Exact Match |
| Temporal and vector RAG are stronger baselines | Robust State 0.8000 vs Temporal RAG 0.6833 and local vector RAG 0.6667 |
| Naive RAG is a weak baseline | Robust naive RAG 0.1333 Exact Match |
| Slot inference is bottleneck | Slot inference = 0.8000 with 12 analyzed failures |
| Hybrid is best for mixed knowledge | Hybrid = 1.0000 in mixed benchmark |
| Real trace reduces synthetic-only risk | Real project trace: State 1.0000 vs LangChain BufferMemory-style 0.7500 |
| Extraction quality bounds State Memory | Rule extractor recall 0.7143 -> QA 0.8750 |
| Defensive policy helps conflicts | Defensive State = 1.0000 in near-simultaneous conflicts |
| State lookup scales better | 5000 events: State 0.4510 ms vs RAG 13.7903 ms |
| State writes are measured | 5000 events: state build 26.2552 ms, 0.0053 ms/event |

## Research Questions

- **RQ1:** Does explicit State Memory reduce stale fact errors compared to RAG?
- **RQ2:** Does the advantage remain against Temporal RAG when oracle subject/predicate access is removed?
- **RQ3:** Is State Memory sufficient for document-detail questions?
- **RQ4:** How does the approach behave under stress conditions?
- **RQ5:** How does latency scale with event count?
- **RQ6:** Does Hybrid improve LLM-based answering?
- **RQ7:** Does the approach work on a small real project trace and against an external memory-framework baseline?
- **RQ8:** How does State Memory degrade when real extraction misses facts?
- **RQ9:** How does State Memory compare with vector-store-shaped RAG rather than only lexical RAG?
- **RQ10:** Which slot-inference errors explain the remaining non-oracle failures?
- **RQ11:** What is the write/update cost of maintaining explicit state under a stream of events?
- **RQ12:** What happens when questions require cross-domain, multi-hop dependencies?

## Claim -> Evidence -> Limitation

### Claim 1: The oracle result is a diagnostic upper bound

**Evidence.**
In the deterministic memory benchmark, State Memory reaches 1.0000 Exact Match and 0.0000 Stale Error, while RAG reaches 0.2143 Exact Match and 0.7143 Stale Error.

**Interpretation.**
With structured subject/predicate access, explicit active/obsolete fact tracking can represent the current state without stale retrieved facts.

**Limitation.**
This is an oracle-style memory-isolation benchmark. It should be treated as an upper-bound diagnostic, not as the headline agent result.

### Claim 2: State Memory remains stronger than Temporal/vector RAG in the main robust benchmark

**Evidence.**
In the robust non-oracle benchmark, State Memory reaches 0.8000 Exact Match, compared with Temporal RAG at 0.6833, local vector RAG at 0.6667 and naive RAG at 0.1333.

**Interpretation.**
Naive RAG fails largely because it lacks recency/latest-fact handling. Temporal and vector-style RAG close much of that gap, so the remaining State Memory gain is a narrower but more meaningful comparison.

**Limitation.**
The robust benchmark is still synthetic, and the slot inference module is lightweight lexical logic rather than a trained semantic parser. The vector baseline is an in-process TF-IDF vector-store proxy, not Chroma, Pinecone or Weaviate.

### Claim 3: Hybrid memory is the strongest architecture for mixed knowledge

**Evidence.**
On mixed structured state plus document-detail QA, Hybrid reaches 1.0000 Exact Match, compared with RAG-only at 0.6765 and State-only at 0.4118.

**Interpretation.**
Structured current state and long unstructured documents need different memory mechanisms.

**Limitation.**
The document benchmark is synthetic and lexical; it does not yet test noisy real documents or embedding retrieval.

### Claim 4: Defensive State helps visible uncertainty but cannot create missing facts

**Evidence.**
Defensive State recovers near-simultaneous conflicts at 1.0000 Exact Match and marks low-confidence updates with a 0.8571 fallback rate. In missing_final_updates, it remains at 0.1429 Exact Match.

**Interpretation.**
Confidence thresholds, conflict tracking and fallback work when uncertainty is represented in state.

**Limitation.**
If the final update is never extracted or stored, state lookup cannot infer it from nowhere.

### Claim 5: State lookup scales better than lexical event retrieval

**Evidence.**
At 5000 events, RAG averages 13.7903 ms and State Memory averages 0.4510 ms, a 30.6x speedup.

**Interpretation.**
The explicit state store avoids scanning and ranking the full event history for every question.

**Limitation.**
These timings are local JavaScript measurements, not a full production database benchmark.

### Claim 5b: State maintenance write cost is measurable and currently low in-process

**Evidence.**
At 5000 events, building the state store averages 26.2552 ms, or 0.0053 ms per event.

**Interpretation.**
The current state update path is cheap for the benchmark sizes and should be reported alongside read latency.

**Limitation.**
This is an in-process JavaScript update path without network persistence, locking, compaction or production database writes.

### Claim 6: LLM answering preserves the hybrid advantage

**Evidence.**
Hybrid + LLM reaches 0.9355 normalized accuracy, compared with RAG + LLM at 0.8065 and State + LLM at 0.5806.

**Interpretation.**
The retrieval/state routing decision remains useful even when a generative model produces the final answer.

**Limitation.**
LLM latency dominates runtime and depends on the local model, hardware and Ollama configuration.

### Claim 7: Real-trace validation reduces synthetic-only risk

**Evidence.**
On the real repository-derived project trace, State Memory reaches 1.0000 Exact Match, compared with the LangChain BufferMemory-style baseline at 0.7500.

**Interpretation.**
Explicit state can retain older but still relevant project facts that fall out of a fixed recent-message buffer.

**Limitation.**
The real trace is small and repository-specific. It should be treated as a validation slice, not as a broad real-world benchmark.

### Claim 8: Extraction quality is a measurable bottleneck

**Evidence.**
In the real extractor benchmark, the rule extractor reaches 1.0000 precision, 0.7143 recall and 0.8750 downstream QA Exact Match.

**Interpretation.**
State Memory degrades when the extractor misses facts, even when the facts it does extract are precise. This makes extraction recall a visible bottleneck rather than a hidden assumption.

**Limitation.**
The default extractor benchmark runs the deterministic rule extractor for CI. Passing `--llm-extractor` adds a real Ollama-backed LLM extractor, but those results depend on the local model.

## Level 2: Benchmark Cards

### Diagnostic Oracle Memory Benchmark

**Purpose.**
Tests memory correctness under controlled subject/predicate access as an upper-bound diagnostic.

**Dataset.**
1000 events and 42 questions.

**Systems.**
Lexical RAG and State Memory.

**Key result.**
State Memory reaches 1.0000 Exact Match and 0.0000 Stale Error; RAG reaches 0.2143 Exact Match and 0.7143 Stale Error.

**Main limitation.**
This is an oracle-style memory isolation benchmark.

### Robust Question Benchmark

**Purpose.**
Tests whether State Memory remains useful when oracle subject/predicate access is removed.

**Dataset.**
1013 events and 60 non-oracle questions.

**Question types.**
paraphrase, indirect, noisy, temporal_multi_step.

**Systems.**
RAG, local vector RAG, Temporal RAG and State no-oracle.

**Key result.**
State no-oracle reaches 0.8000 Exact Match, compared with Temporal RAG at 0.6833, local vector RAG at 0.6667 and naive RAG at 0.1333.

**Main failure source.**
Slot inference accuracy is 0.8000, matching State no-oracle Exact Match. The benchmark now includes 8 cross-domain multi-hop dependency questions.

### Mixed Structured And Document Benchmark

**Purpose.**
Tests whether one memory mechanism can handle both evolving state and long-document detail questions.

**Dataset.**
1000 events, 100 document pages and 102 questions.

**Systems.**
RAG-only, State-only and Hybrid.

**Key result.**
Hybrid reaches 1.0000 Exact Match. State-only reaches 0.4118 because it cannot answer document-detail questions.

**Main limitation.**
The document corpus is synthetic and should later be replaced or complemented by real long documents.

### Stress Benchmark

**Purpose.**
Tests whether State Memory degrades gracefully when extraction assumptions fail.

**Scenarios.**
clean_extraction, missing_final_updates, wrong_extraction_slot, low_confidence_final_updates, near_simultaneous_conflicts and ambiguous_similar_entities.

**Systems.**
Classic RAG, Temporal RAG, State Memory and Defensive State.

**Key result.**
Defensive State reaches 1.0000 in near-simultaneous conflicts, but missing final updates remain at 0.1429.

**Main limitation.**
No state policy can recover an update that was never stored without reconciliation against raw events.

### Scalability Benchmark

**Purpose.**
Tests whether latency grows with event count.

**Dataset sizes.**
100, 250, 500, 1000, 2500, 5000 events across 3 seeds.

**Key result.**
At 5000 events, State Memory averages 0.4510 ms while RAG averages 13.7903 ms.

**Write cost.**
At 5000 events, state build/update cost is 26.2552 ms total and 0.0053 ms per event.

**Main limitation.**
This benchmark measures local in-process code rather than networked storage or vector infrastructure.

### Mixed LLM Benchmark

**Purpose.**
Checks whether the memory-routing conclusions survive real local LLM answer generation.

**Model.**
llama3.2:3b with temperature 0.

**Key result.**
Hybrid + LLM reaches 0.9355 normalized accuracy with 0.0000 hallucination rate.

**Main limitation.**
LLM output introduces formatting and incomplete-answer errors that are separate from memory retrieval.

### Real Project Trace Benchmark

**Purpose.**
Reduces synthetic-only bias by evaluating a real repository-derived event trace.

**Dataset.**
12 real project events and 8 questions.

**Systems.**
Temporal RAG, State Memory and LangChain ConversationBufferMemory-style baseline.

**Key result.**
State Memory reaches 1.0000 Exact Match; LangChain BufferMemory-style reaches 0.7500.

**Main limitation.**
The dataset is intentionally small and should later be expanded with more manually curated real traces.

### Real Extractor Benchmark

**Purpose.**
Tests the full raw-event pipeline: raw event text -> extractor -> State Store -> QA.

**Dataset.**
12 real project events, 21 gold facts and 8 downstream questions.

**Systems.**
Curated gold extractor, deterministic rule extractor, and optional Ollama LLM extractor.

**Key result.**
The rule extractor reaches 0.7143 extraction recall and 0.8750 downstream QA Exact Match.

**Main limitation.**
The default report does not include LLM extractor rows unless the benchmark is run with `--llm-extractor`.

## Derived Metrics

### Robust Benchmark Deltas

| Comparison | Absolute gain | Relative note |
| --- | ---: | --- |
| State no-oracle vs RAG | 0.6667 EM | Large non-oracle gap |
| State no-oracle vs local vector RAG | 0.1333 EM | Vector-store-shaped retrieval baseline |
| State no-oracle vs Temporal RAG | 0.1167 EM | State still wins after recency/latest fix |
| State latency vs Temporal RAG | 3.2x faster | 1.1056 ms vs 3.5138 ms |
| Cross-domain State EM | 0.6250 | 8 multi-hop dependency questions |
| Slot inference failures | 12 | Failure rate 0.2000 |

### Mixed Benchmark Deltas

| Comparison | Absolute gain | Relative note |
| --- | ---: | --- |
| Hybrid vs RAG-only | 0.3235 EM | Hybrid keeps document RAG while using state for current facts |
| Hybrid vs State-only | 0.5882 EM | State-only cannot answer document details |
| State-only document-detail gap | 1.0000 EM | Document memory must remain retrieval-based |

### Scalability Speedup

| Events | RAG latency ms | State latency ms | Speedup |
| ---: | ---: | ---: | ---: |
| 5000 | 13.7903 | 0.4510 | 30.6x |

### State Update Cost

| Events | State build ms | Write ms / event |
| ---: | ---: | ---: |
| 5000 | 26.2552 | 0.0053 |

## Statistical Checks

Bootstrap confidence intervals use 1000 deterministic resamples over question-level results and report 95% intervals for Exact Match and F1. McNemar exact tests use paired exact-match outcomes for systems evaluated on the same question IDs.

| Benchmark | System | Exact Match 95% CI | F1 95% CI |
| --- | --- | ---: | ---: |
| Diagnostic oracle | RAG | 0.2143 [0.0952, 0.3571] | 0.2169 [0.0952, 0.3571] |
| Diagnostic oracle | State Memory | 1.0000 [1.0000, 1.0000] | 1.0000 [1.0000, 1.0000] |
| Robust non-oracle | RAG | 0.1333 [0.0500, 0.2167] | 0.1455 [0.0550, 0.2407] |
| Robust non-oracle | Local vector RAG | 0.6667 [0.5500, 0.7833] | 0.7407 [0.6274, 0.8468] |
| Robust non-oracle | Temporal RAG | 0.6833 [0.5667, 0.8000] | 0.7593 [0.6486, 0.8571] |
| Robust non-oracle | State no-oracle | 0.8000 [0.7000, 0.9000] | 0.8348 [0.7368, 0.9217] |
| Mixed | RAG-only | 0.6765 [0.5882, 0.7745] | 0.6798 [0.5882, 0.7745] |
| Mixed | State-only | 0.4118 [0.3137, 0.5000] | 0.5833 [0.4776, 0.6667] |
| Mixed | Hybrid | 1.0000 [1.0000, 1.0000] | 1.0000 [1.0000, 1.0000] |
| Real trace | Temporal RAG | 1.0000 [1.0000, 1.0000] | 1.0000 [1.0000, 1.0000] |
| Real trace | State Memory | 1.0000 [1.0000, 1.0000] | 1.0000 [1.0000, 1.0000] |
| Real trace | LangChain BufferMemory-style | 0.7500 [0.5000, 1.0000] | 0.8571 [0.6667, 1.0000] |

| Benchmark | Comparison | Paired N | Candidate-only wins | Baseline-only wins | McNemar p | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Diagnostic oracle | State Memory vs RAG | 42 | 33 | 0 | <0.0001 | paired difference detected |
| Robust non-oracle | Temporal RAG vs naive RAG | 60 | 33 | 0 | <0.0001 | paired difference detected |
| Robust non-oracle | State no-oracle vs local vector RAG | 60 | 8 | 0 | 0.0078 | paired difference detected |
| Robust non-oracle | State no-oracle vs Temporal RAG | 60 | 7 | 0 | 0.0156 | paired difference detected |
| Mixed | Hybrid vs RAG-only | 102 | 33 | 0 | <0.0001 | paired difference detected |
| Mixed | Hybrid vs State-only | 102 | 60 | 0 | <0.0001 | paired difference detected |
| Real trace | State Memory vs LangChain BufferMemory-style | 8 | 2 | 0 | 0.5000 | not significant on this sample |

These tests quantify uncertainty on the fixed benchmark samples. They do not remove the synthetic-data and benchmark-design limitations described below.

## Model Comparison

This table is the multi-model history surface for Ollama runs. GitHub Actions writes each model into `results/models/<safe_model>/`, so running a new model adds or refreshes that row instead of replacing the previous model history. The checked-in active LLM summary is shown as a fallback row until per-model history is committed.

| Model | Source | Hybrid LLM Acc | Hybrid Hallucination | Hybrid Avg LLM ms | Real State EM | Real Buffer EM | Extractor Precision | Extractor Recall | Extractor F1 | Extractor Parse Errors | Extractor QA EM |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gemma3:1b | results/models/gemma3-1b | 0.9355 | 0.0000 | 5747.8673 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 | 0.0000 |
| gemma3:4b | results/models/gemma3-4b | 0.9677 | 0.0000 | 19386.4109 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 | 0.0000 |
| llama3.1:8b | results/models/llama3.1-8b | 0.9677 | 0.0000 | 36045.8480 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 | 0.0000 |
| llama3.2:3b | results/models/llama3.2-3b | 0.9355 | 0.0000 | 11603.0226 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 12 | 0.0000 |
| mistral:7b | results/models/mistral-7b | 1.0000 | 0.0000 | 43067.1499 | 0.0000 | 0.0000 | 0.0435 | 0.0476 | 0.0455 | 1 | 0.0000 |
| phi4-mini | results/models/phi4-mini | 0.9677 | 0.0000 | 18504.2194 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 1 | 0.0000 |
| qwen2.5:1.5b | results/models/qwen2.5-1.5b | 0.8710 | 0.0000 | 8101.7853 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 | 0.0000 |
| qwen2.5:3b | results/models/qwen2.5-3b | 0.9032 | 0.0323 | 16193.0793 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 | 0.0000 |
| qwen2.5:7b | results/models/qwen2.5-7b | 1.0000 | 0.0000 | 35214.2771 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 | 0.0000 |
| qwen3:4b | results/models/qwen3-4b | 0.0000 | 1.0000 | 27944.1519 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 12 | 0.0000 |

## Critical Evidence Gaps

| Gap | Current status | Required next step |
| --- | --- | --- |
| Real cross-domain data | Real trace has 12 repository-derived events and 8 questions | Add 200-500 manually verified real events across repository, calendar, CRM, task, support and shopping/task-management logs |
| Production vector store baseline | Robust benchmark now includes local TF-IDF vector RAG at 0.6667 Exact Match | Add Chroma, Pinecone or Weaviate-backed RAG using the same questions and paired statistical tests |
| Cross-domain validation | Robust benchmark includes 8 cross-domain multi-hop probes | Expand to real workflows where tasks depend on meetings, CRM state and support conversations |
| Slot inference error analysis | 12 failures are summarized with examples and top candidate slots | Replace lexical slot inference with semantic parser/LLM extractor and compare error types |
| State write cost | Scalability benchmark reports state build and write-ms-per-event | Re-run with persistent stores, compaction, concurrent writers and recovery/replay |
| Hard multi-hop questions | Robust benchmark resolves two-hop entity chains | Add longer chains across three or more entities and agent planning/action success metrics |

## Slot Inference Error Analysis

Slot inference is the main bottleneck in the non-oracle State Memory path: 12 of 60 questions fail slot inference.

By question type:

| Type | Questions | Slot failures | Slot accuracy | State EM |
| --- | ---: | ---: | ---: | ---: |
| paraphrase | 15 | 1 | 0.9333 | 0.9333 |
| indirect | 15 | 3 | 0.8000 | 0.8000 |
| noisy | 15 | 5 | 0.6667 | 0.6667 |
| temporal_multi_step | 15 | 3 | 0.8000 | 0.8000 |

By domain:

| Domain | Questions | Slot failures | Slot accuracy | State EM |
| --- | ---: | ---: | ---: | ---: |
| coursework_memory | 32 | 9 | 0.7188 | 0.7188 |
| calendar | 4 | 0 | 1.0000 | 1.0000 |
| crm | 4 | 0 | 1.0000 | 1.0000 |
| tasks | 4 | 0 | 1.0000 | 1.0000 |
| shopping | 4 | 0 | 1.0000 | 1.0000 |
| chat | 4 | 0 | 1.0000 | 1.0000 |
| cross_domain | 8 | 3 | 0.6250 | 0.6250 |

Representative failure examples:

| Type | Domain | Expected slot | Inferred slot | Top candidates |
| --- | --- | --- | --- | --- |
| noisy | coursework_memory | Reflex.runtime | README.note | README.note:14; Reflex.runtime:12; README.status:10 |
| indirect | coursework_memory | RAG baseline.retriever | RAG baseline.top_k | RAG baseline.top_k:6; RAG baseline.retriever:4; RAG baseline.chunk_unit:4 |
| paraphrase | coursework_memory | State updater.mutable_rule | unknown.unknown | State updater.old_fact_status:4; State selector.limit:4; State updater.mutable_rule:4 |
| indirect | coursework_memory | State Memory coursework.requires | unknown.unknown | Metrics report.output:4; Metrics.include:4; Methodology section.summary:0 |
| noisy | coursework_memory | State Memory coursework.requires | State Memory coursework.implementation_language | State Memory coursework.implementation_language:18; Experiment notes.note:8; State Memory coursework.requires:6 |
| temporal_multi_step | coursework_memory | State Memory coursework.requires | Experiment notes.note | Experiment notes.note:8; State Memory coursework.requires:6; Chart script.note:4 |
| indirect | coursework_memory | Metrics.include | State Memory agent.memory_strategy | State Memory agent.memory_strategy:9; State Memory coursework.deadline:6; State Memory.stores:4 |
| noisy | coursework_memory | Metrics.include | Chart script.note | Chart script.note:18; Metrics.include:16; Chart script.summary:14 |

## Pipeline Breakdown

| Stage | Metric | Result |
| --- | --- | --- |
| Event generation | deterministic seed | seeded synthetic events |
| Fact extraction | extraction accuracy | Real extractor benchmark reports precision, recall, slot, entity and conflict metrics |
| State update | stale rejection | 1.0000 obsolete rejection in the diagnostic oracle benchmark |
| Slot inference | slot accuracy | 0.8000 in robust non-oracle benchmark |
| State selection / retrieval | context hit | 0.9000 for State no-oracle; 0.7667 for Temporal RAG; 0.7500 for local vector RAG |
| Answering | exact match | 0.8000 State no-oracle Exact Match |
| Cross-domain multi-hop | exact match | 0.6250 State EM on 8 dependency-chain questions |
| Document retrieval | document-detail accuracy | Hybrid 1.0000; State-only 0.0000 |
| LLM output | hallucination rate | Hybrid + LLM 0.0000 |
| Real-trace validation | external framework baseline | State Memory vs LangChain BufferMemory-style |

The key diagnostic result is that State Memory degrades primarily at the natural-language slot inference stage, not because explicit active/obsolete state is ineffective.

## Negative Results

### State Memory cannot recover facts that were never stored

In the missing_final_updates scenario, State Memory collapses to 0.1429 Exact Match and 0.0000 Current Fact Accuracy.

This is expected: a state-based system cannot infer the final state if the final update is absent from extracted facts. Defensive State also remains at 0.1429 because there is no conflict or low-confidence signal to trigger useful fallback.

### State-only is not a document QA system

In the mixed benchmark, State-only scores 0.0000 on document-detail questions. This is not a failure of state update logic; it shows that arbitrary document details should remain in a retrieval/document memory path.

## Threats To Validity

- **Synthetic data bias:** the events, facts and questions are generated in a controlled environment. The experiments show behavior under designed temporal-memory conditions, not proven superiority on arbitrary real agent tasks.
- **Oracle access:** the deterministic benchmark uses structured subject/predicate access and is therefore an oracle/diagnostic upper-bound setting. The robust benchmark is the main evidence for non-oracle behavior.
- **Baseline strength:** naive lexical RAG is intentionally weak for temporal updates. Temporal RAG and local vector RAG are stronger implemented baselines, but the project still does not benchmark production vector stores such as Chroma, Pinecone or Weaviate.
- **Extraction assumptions:** the main experiments use clean structured facts. The extractor benchmark measures fact precision, recall, slot accuracy, entity resolution, mutable classification and conflict detection, but the default CI run uses a deterministic rule extractor; LLM extractor scores require a local Ollama run.
- **Limited real-world validation:** the robust benchmark adds semi-realistic calendar, CRM, task, shopping, support-chat and cross-domain dependency domains, and the real-trace benchmark adds repository-derived events. The real trace is still small and should be expanded to 200-500 manually verified real events before making broad real-world claims.
- **Sample size:** question counts are modest, so confidence intervals and McNemar tests should be read as benchmark diagnostics rather than universal population estimates.

## Related Work Positioning

| Approach | Memory model | Relationship to this project | Status in this coursework |
| --- | --- | --- | --- |
| [LangGraph persistence and stores](https://docs.langchain.com/oss/python/langgraph/persistence) | Thread state checkpoints plus cross-thread stores with optional semantic search | Closest framework-level analogue for persisted graph state and long-term user/application memory | Conceptual comparison; not implemented as a runtime baseline |
| [LangChain memory concepts](https://docs.langchain.com/oss/python/concepts/memory) | Short-term thread state and long-term namespaced memory | Provides the broader agent-memory architecture around which LangGraph state stores are positioned | Implemented as a ConversationBufferMemory-style real-trace baseline |
| [MemGPT](https://arxiv.org/abs/2310.08560) | OS-inspired virtual context management across memory tiers | Related motivation: managing limited context by moving information between active and external memory | Conceptual comparison; no MemGPT runtime baseline |
| [Letta stateful agents](https://docs.letta.com/guides/core-concepts/stateful-agents) and [memory blocks](https://docs.letta.com/guides/core-concepts/memory/memory-blocks) | Persistent editable memory blocks pinned into context plus external memory | Similar emphasis on persistent agent state, but Letta memory blocks are agent-managed text/context units rather than deterministic slot records | Conceptual comparison; no Letta baseline |
| Chroma / Pinecone / Weaviate vector stores | Production vector indexes with embedding search, metadata filters and persistence | Stronger RAG baselines than lexical retrieval and closer to deployed agent memory systems | Local TF-IDF vector RAG proxy implemented; production vector DB baseline remains required |
| Temporal RAG in this repo | Recency reranking plus latest-fact answering over raw events | Strongest implemented retrieval baseline for temporal updates | Main baseline for robust current-state claims |

## Failure Taxonomy

| Error type | Count | Systems affected | Source |
| --- | ---: | --- | --- |
| stale_fact | 30 | RAG | Diagnostic oracle benchmark |
| slot_inference_failed | 12 | State no-oracle | Robust benchmark |
| incomplete_answer | 8 | RAG + LLM, State + LLM, Hybrid + LLM | Mixed LLM benchmark |
| missing_fact | 13 | RAG + LLM, State + LLM | Mixed LLM benchmark |

The diagnostic oracle and robust rows come from aggregate summaries. The LLM rows are counted from full result files, not only from the displayed failure examples.

## Recommended Visualizations

| Visualization | What it should show | Data source |
| --- | --- | --- |
| Accuracy overview bar chart | RAG, Temporal RAG, State Memory and Hybrid across main benchmarks | summary JSON files |
| Quality vs latency scatter plot | Accuracy/normalized accuracy versus average latency | diagnostic oracle, robust, mixed and LLM summaries |
| Scalability line chart | RAG and State latency from 100 to 5000 events | results/scalability/summary.json |
| Robust benchmark heatmap | paraphrase, indirect, noisy and temporal_multi_step by system plus slot inference | results/robust/summary.json |
| Slot inference error table | failure examples with expected slot, inferred slot and top candidate slots | results/robust/summary.json |
| Cross-domain multi-hop chart | State, Temporal RAG and vector RAG on dependency-chain questions | results/robust/summary.json |
| State write cost line chart | state build time and write-ms-per-event across event counts | results/scalability/summary.json |
| Real trace comparison | Temporal RAG, State Memory and LangChain BufferMemory-style on repository events | results/real/summary.json |
| Extractor degradation chart | Extraction recall versus downstream State Memory QA | results/extractor/summary.json |
| Model history comparison | Hybrid LLM quality, real-trace accuracy and extractor degradation across Ollama models | results/models/*/{llm,real,extractor}/summary.json |
| Failure taxonomy chart | incomplete_answer, missing_fact, possible_hallucination, stale_fact and slot_inference_failed | LLM result files plus robust summaries |

## Metric Definitions

- **Exact Match:** answer exactly matches the expected normalized answer.
- **F1:** overlap-style answer quality score used by the deterministic grader.
- **Normalized Accuracy:** LLM answer matches after normalization and minor formatting differences.
- **Current Fact Accuracy:** correctness on questions requiring the latest active fact.
- **Obsolete Rejection:** ability to avoid returning outdated facts.
- **Stale Error:** rate of answers that return obsolete facts as if they were current.
- **Context Hit:** whether the relevant supporting context was retrieved or selected.
- **MRR:** mean reciprocal rank of the first relevant retrieved item.
- **Slot Inference Accuracy:** whether the system inferred the correct subject/predicate from a natural-language question.
- **Extraction Precision:** share of extracted facts that exactly match a gold subject/predicate/object fact.
- **Extraction Recall:** share of gold subject/predicate/object facts recovered by the extractor.
- **Entity Resolution Accuracy:** share of extracted facts whose subject matches a gold entity.
- **Conflict Detection Accuracy:** agreement between predicted and gold mutable-slot replacement events.
- **Fallback Rate:** how often the defensive system refused direct state answering and fell back to temporal RAG.
- **Prompt Compliance:** whether the LLM followed the requested answer format.
- **Hallucination Rate:** rate of LLM answers that introduce unsupported content.

## Level 3: Raw Benchmark Tables

### Diagnostic Oracle Memory Benchmark

Dataset: 1000 events, 42 questions. This benchmark provides controlled subject/predicate access and should be read as an upper-bound memory-isolation diagnostic.

| System | Exact Match | F1 | Current Fact Accuracy | Obsolete Rejection | Stale Error | Context Hit | MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG | 0.2143 | 0.2169 | 0.1667 | 0.1667 | 0.7143 | 0.9286 | 0.4515 |
| State Memory | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 1.0000 |

| Case | Count |
| --- | ---: |
| Both correct | 9 |
| State correct, RAG wrong | 33 |
| RAG correct, State wrong | 0 |
| Both wrong | 0 |

### Mixed Structured And Document Benchmark

Dataset: 1000 events, 100 document pages, 102 questions.

| System | Exact Match | Current Fact Accuracy | Context Hit | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| RAG-only | 0.6765 | 0.1667 | 0.9706 | 229.7941 | 3.4061 |
| State-only | 0.4118 | 1.0000 | 0.4118 | 26.9020 | 0.4587 |
| Hybrid | 1.0000 | 1.0000 | 1.0000 | 220.5098 | 1.5941 |

| Question Type | RAG-only | State-only | Hybrid |
| --- | ---: | ---: | ---: |
| current_state | 0.1667 | 1.0000 | 1.0000 |
| stable_state | 0.5000 | 1.0000 | 1.0000 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |

### Robust Question Benchmark

Dataset: 1013 events, 60 non-oracle questions.

| System | Exact Match | Current Fact Accuracy | Context Hit | Slot Inference Accuracy | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG | 0.1333 | 0.1538 | 0.7333 | 0.8000 | 79.9333 | 3.7074 |
| Local vector RAG | 0.6667 | 0.7692 | 0.7500 | 0.8000 | 75.8500 | 0.5830 |
| Temporal RAG | 0.6833 | 0.7885 | 0.7667 | 0.8000 | 80.9500 | 3.5138 |
| State no-oracle | 0.8000 | 0.8846 | 0.9000 | 0.8000 | 72.1833 | 1.1056 |

| Type | RAG | Local vector RAG | Temporal RAG | State no-oracle | State slot inference |
| --- | ---: | ---: | ---: | ---: | ---: |
| paraphrase | 0.1333 | 0.6667 | 0.7333 | 0.9333 | 0.9333 |
| indirect | 0.1333 | 0.7333 | 0.7333 | 0.8000 | 0.8000 |
| noisy | 0.0667 | 0.5333 | 0.5333 | 0.6667 | 0.6667 |
| temporal_multi_step | 0.2000 | 0.7333 | 0.7333 | 0.8000 | 0.8000 |

| Domain | RAG | Local vector RAG | Temporal RAG | State no-oracle | State slot inference |
| --- | ---: | ---: | ---: | ---: | ---: |
| coursework_memory | 0.1563 | 0.4688 | 0.5000 | 0.7188 | 0.7188 |
| calendar | 0.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| crm | 0.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| tasks | 0.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| shopping | 0.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| chat | 0.5000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| cross_domain | 0.1250 | 0.6250 | 0.6250 | 0.6250 | 0.6250 |

Slot inference failure examples:

| Type | Domain | Expected slot | Inferred slot | Question |
| --- | --- | --- | --- | --- |
| noisy | coursework_memory | Reflex.runtime | README.note | Ignore old drafts and unrelated README notes: what engine does Reflex run on after all updates? |
| indirect | coursework_memory | RAG baseline.retriever | RAG baseline.top_k | When describing the baseline, how does it retrieve memories? |
| paraphrase | coursework_memory | State updater.mutable_rule | unknown.unknown | How does the updater handle changing facts? |
| indirect | coursework_memory | State Memory coursework.requires | unknown.unknown | What should the final report include to satisfy the requirements? |
| noisy | coursework_memory | State Memory coursework.requires | State Memory coursework.implementation_language | Ignore implementation-language notes; list the coursework deliverables. |
| temporal_multi_step | coursework_memory | State Memory coursework.requires | Experiment notes.note | Across all requirement notes, what must the coursework include? |
| indirect | coursework_memory | Metrics.include | State Memory agent.memory_strategy | What should be reported when evaluating the memory approaches? |
| noisy | coursework_memory | Metrics.include | Chart script.note | Ignoring chart script notes, which metrics are included? |

### Stress Benchmark

| Scenario | System | Exact Match | Current Fact Accuracy | Stale Error | Context Hit | Fallback Rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| clean_extraction | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.0000 |
| clean_extraction | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.0000 |
| clean_extraction | State Memory | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0.0000 |
| clean_extraction | Defensive State + fallback | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0.0000 |
| missing_final_updates | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.0000 |
| missing_final_updates | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.0000 |
| missing_final_updates | State Memory | 0.1429 | 0.0000 | 0.8571 | 0.1429 | 0.0000 |
| missing_final_updates | Defensive State + fallback | 0.1429 | 0.0000 | 0.8571 | 0.1429 | 0.0000 |
| wrong_extraction_slot | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.0000 |
| wrong_extraction_slot | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.0000 |
| wrong_extraction_slot | State Memory | 0.9286 | 0.9167 | 0.0714 | 0.9286 | 0.0000 |
| wrong_extraction_slot | Defensive State + fallback | 0.9286 | 0.9167 | 0.0714 | 0.9286 | 0.0000 |
| low_confidence_final_updates | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.0000 |
| low_confidence_final_updates | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.0000 |
| low_confidence_final_updates | State Memory | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0.0000 |
| low_confidence_final_updates | Defensive State + fallback | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0.8571 |
| near_simultaneous_conflicts | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.0000 |
| near_simultaneous_conflicts | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.0000 |
| near_simultaneous_conflicts | State Memory | 0.1429 | 0.0000 | 0.0000 | 0.1429 | 0.0000 |
| near_simultaneous_conflicts | Defensive State + fallback | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0.8571 |
| ambiguous_similar_entities | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.0000 |
| ambiguous_similar_entities | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.0000 |
| ambiguous_similar_entities | State Memory | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0.0000 |
| ambiguous_similar_entities | Defensive State + fallback | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0.0000 |

Defensive State diagnostics:

| Scenario | Rejected Low-Confidence Facts | Stored Conflicts | Soft Replacements | Low-Confidence Question Rate | Conflict Question Rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| clean_extraction | 862 | 0 | 72 | 0.0000 | 0.0000 |
| missing_final_updates | 862 | 0 | 36 | 0.0000 | 0.0000 |
| wrong_extraction_slot | 862 | 0 | 59 | 0.0000 | 0.0000 |
| low_confidence_final_updates | 898 | 0 | 36 | 0.8571 | 0.0000 |
| near_simultaneous_conflicts | 862 | 36 | 72 | 0.0000 | 0.8571 |
| ambiguous_similar_entities | 887 | 0 | 72 | 0.0000 | 0.0000 |

### Scalability Benchmark

| Events | RAG Exact Match | State Exact Match | RAG Current Fact | State Current Fact | RAG Latency ms | State Latency ms | State build ms | Write ms/event |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 0.2460 +/- 0.0275 | 1.0000 +/- 0.0000 | 0.1759 | 1.0000 | 0.4470 | 0.2582 | 1.5452 | 0.0155 |
| 250 | 0.2143 +/- 0.0000 | 1.0000 +/- 0.0000 | 0.1667 | 1.0000 | 0.8023 | 0.4011 | 2.4825 | 0.0099 |
| 500 | 0.2143 +/- 0.0000 | 1.0000 +/- 0.0000 | 0.1667 | 1.0000 | 1.6017 | 0.4953 | 4.0705 | 0.0081 |
| 1000 | 0.2143 +/- 0.0000 | 1.0000 +/- 0.0000 | 0.1667 | 1.0000 | 2.8312 | 0.4847 | 6.4577 | 0.0065 |
| 2500 | 0.2143 +/- 0.0000 | 1.0000 +/- 0.0000 | 0.1667 | 1.0000 | 6.9784 | 0.4772 | 16.4946 | 0.0066 |
| 5000 | 0.2143 +/- 0.0000 | 1.0000 +/- 0.0000 | 0.1667 | 1.0000 | 13.7903 | 0.4510 | 26.2552 | 0.0053 |

| System | Exact Match Degradation | Current Fact Degradation |
| --- | ---: | ---: |
| RAG | 0.0317 | 0.0093 |
| State Memory | 0.0000 | 0.0000 |

### Mixed LLM Benchmark

Model: llama3.2:3b, temperature: 0, seed: 42, timeout: 120000 ms, num_predict: 64.

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.8065 | 1.0000 | 0.8710 | 0.0323 | 207.2581 | 16652.0086 |
| State + LLM | 0.5806 | 1.0000 | 0.9032 | 0.0000 | 64.0645 | 4021.4874 |
| Hybrid + LLM | 0.9355 | 1.0000 | 0.9355 | 0.0000 | 187.9032 | 15229.8465 |

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 0.7000 | 0.9000 | 0.9000 |
| stable_state | 0.5000 | 0.6667 | 0.8333 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |
| unknown | 1.0000 | 1.0000 | 1.0000 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | current_state | incomplete_answer | zero-dependency Node.js | UNKNOWN |
| rag | current_state | incomplete_answer | lexical top-k retriever | Cosine embedding search. |
| rag | current_state | incomplete_answer | structured world state | RAG retrieval. |
| rag | stable_state | missing_fact | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | includes implementation, baseline comparison, metrics, error analysis, experiments. |
| rag | stable_state | missing_fact | user profile, projects, goals, tasks, facts | Goals, facts. |
| rag | stable_state | missing_fact | recall, precision, context size, latency, stale fact error rate, compression ratio | UNKNOWN |
| state | current_state | incomplete_answer | zero-dependency Node.js | Node.js |
| state | stable_state | incomplete_answer | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | experiments and conclusions |
| state | stable_state | incomplete_answer | event logging, fact extraction, state update, state selection, prompt building | state selection, event logging, fact extraction, prompt building |
| state | document_detail | missing_fact | VALUE-001-1 | UNKNOWN |

### Real Project Trace Benchmark

Dataset: 12 real repository-derived events, 8 questions.

Extractor mode: annotated-real-trace.

| System | Exact Match | F1 | Context Hit | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Temporal RAG | 1.0000 | 1.0000 | 1.0000 | 52.5000 | 0.2721 |
| State Memory | 1.0000 | 1.0000 | 1.0000 | 56.5000 | 1.0154 |
| LangChain BufferMemory-style | 0.7500 | 0.8571 | 0.7500 | 70.0000 | 0.0259 |

| Comparison | Candidate-only wins | Baseline-only wins | McNemar p |
| --- | ---: | ---: | ---: |
| State Memory vs LangChain BufferMemory-style | 2 | 0 | 0.5000 |

### Real Extractor Benchmark

Dataset: 12 raw repository-derived events, 21 gold facts, 8 downstream questions.

| Extractor | Extraction Precision | Extraction Recall | Extraction F1 | Slot Accuracy | Entity Resolution | Mutable Classification | Conflict Detection | Parse-error Events | Downstream QA EM |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gold annotations | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0 | 1.0000 |
| Rule extractor | 1.0000 | 0.7143 | 0.8333 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0 | 0.8750 |

## Interpretation

The experiments do not show that State Memory is a universal replacement for RAG.
Instead, they show that evolving structured facts and long unstructured documents require different memory mechanisms.

State Memory is strongest when the task depends on current world state.
RAG remains useful for document-detail retrieval.
The hybrid system performs best when both kinds of knowledge are present.
