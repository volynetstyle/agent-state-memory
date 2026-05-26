# Results
This file is generated from `results/**/summary.json` by `npm run results`.
## Deterministic Memory Benchmark

Dataset: 1000 events, 42 questions.

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

## Mixed Structured And Document Benchmark

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

## Stress Benchmark

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

The stress benchmark intentionally weakens ideal assumptions: missing updates, wrong extraction slots, low-confidence updates, near-simultaneous conflicts and ambiguous similar entities.

## Scalability Benchmark

| Events | RAG Exact Match | State Exact Match | RAG Current Fact | State Current Fact | RAG Latency ms | State Latency ms |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 0.2460 +/- 0.0275 | 1.0000 +/- 0.0000 | 0.1759 | 1.0000 | 0.4826 | 0.2754 |
| 250 | 0.2143 +/- 0.0000 | 1.0000 +/- 0.0000 | 0.1667 | 1.0000 | 0.9306 | 0.4471 |
| 500 | 0.2143 +/- 0.0000 | 1.0000 +/- 0.0000 | 0.1667 | 1.0000 | 1.6941 | 0.5882 |
| 1000 | 0.2143 +/- 0.0000 | 1.0000 +/- 0.0000 | 0.1667 | 1.0000 | 3.1892 | 0.5957 |
| 2500 | 0.2143 +/- 0.0000 | 1.0000 +/- 0.0000 | 0.1667 | 1.0000 | 7.7221 | 0.5962 |
| 5000 | 0.2143 +/- 0.0000 | 1.0000 +/- 0.0000 | 0.1667 | 1.0000 | 15.5933 | 0.5495 |

| System | Exact Match Degradation | Current Fact Degradation |
| --- | ---: | ---: |
| RAG | 0.0317 | 0.0093 |
| State Memory | 0.0000 | 0.0000 |

## Mixed LLM Benchmark

Model: llama3.2:3b, temperature: 0, seed: 42, timeout: 120000 ms, num_predict: 64.

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.8065 | 1.0000 | 0.8710 | 0.0323 | 207.2581 | 16788.4294 |
| State + LLM | 0.5806 | 1.0000 | 0.9032 | 0.0000 | 64.0645 | 4073.4492 |
| Hybrid + LLM | 0.9355 | 1.0000 | 0.9355 | 0.0000 | 187.9032 | 15343.3162 |

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

## Interpretation
State Memory is strongest for evolving current state because it stores active and obsolete facts explicitly. RAG remains appropriate for long unstructured documents. The mixed and stress benchmarks show that the practical architecture is hybrid, and that State Memory quality depends on reliable fact extraction and update rules.