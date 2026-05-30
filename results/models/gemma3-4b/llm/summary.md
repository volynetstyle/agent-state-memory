# Mixed LLM Experiment

Model: gemma3:4b

Temperature: 0

Seed: 42

Request timeout ms: 120000

Num predict: 64

Question set: 31 total (10 current_state, 6 stable_state, 10 document_detail, 5 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.8710 | 1.0000 | 0.9032 | 0.0000 | 207.2581 | 20644.8041 |
| State + LLM | 0.6774 | 1.0000 | 1.0000 | 0.0000 | 64.0645 | 5709.3718 |
| Hybrid + LLM | 0.9677 | 1.0000 | 0.9677 | 0.0000 | 187.9032 | 19386.4109 |

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 0.9000 | 1.0000 | 1.0000 |
| stable_state | 0.5000 | 1.0000 | 0.8333 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |
| unknown | 1.0000 | 1.0000 | 1.0000 |

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | 8.3202 | 0.0085 | 20644.8041 | 20653.1967 |
| State + LLM | 1.8082 | 0.0051 | 5709.3718 | 5711.2123 |
| Hybrid + LLM | 2.8174 | 0.0045 | 19386.4109 | 19389.2539 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | current_state | incomplete_answer | structured world state | RAG retrieval |
| rag | stable_state | missing_fact | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | implementation, baseline comparison, metrics, error analysis, experiments |
| rag | stable_state | missing_fact | user profile, projects, goals, tasks, facts | goals |
| rag | stable_state | missing_fact | recall, precision, context size, latency, stale fact error rate, compression ratio | UNKNOWN |
| state | document_detail | missing_fact | VALUE-001-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-011-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-021-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-031-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-041-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-051-1 | UNKNOWN |
