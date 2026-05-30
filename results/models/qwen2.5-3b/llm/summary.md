# Mixed LLM Experiment

Model: qwen2.5:3b

Temperature: 0

Seed: 42

Request timeout ms: 120000

Num predict: 64

Question set: 31 total (10 current_state, 6 stable_state, 10 document_detail, 5 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.8065 | 1.0000 | 0.9032 | 0.0000 | 207.2581 | 17592.4926 |
| State + LLM | 0.6129 | 1.0000 | 0.9355 | 0.0000 | 64.0645 | 4151.8395 |
| Hybrid + LLM | 0.9032 | 1.0000 | 0.9032 | 0.0323 | 187.9032 | 16193.0793 |

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 0.8000 | 1.0000 | 0.9000 |
| stable_state | 0.3333 | 0.6667 | 0.6667 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |
| unknown | 1.0000 | 1.0000 | 1.0000 |

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | 5.7826 | 0.0069 | 17592.4926 | 17598.3309 |
| State + LLM | 3.5527 | 0.0040 | 4151.8395 | 4155.4198 |
| Hybrid + LLM | 2.1287 | 0.0035 | 16193.0793 | 16195.2273 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | current_state | incomplete_answer | dependency-tracked selectors | UNKNOWN |
| rag | current_state | incomplete_answer | structured world state | RAG |
| rag | stable_state | missing_fact | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | Error analysis, experiments, metrics |
| rag | stable_state | incomplete_answer | reactive systems, LLM agents, machine learning, memory architectures | State Memory stores includes user profile. |
| rag | stable_state | missing_fact | user profile, projects, goals, tasks, facts | UNKNOWN |
| rag | stable_state | missing_fact | recall, precision, context size, latency, stale fact error rate, compression ratio | UNKNOWN |
| state | stable_state | incomplete_answer | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | State Memory for LLM agents |
| state | stable_state | incomplete_answer | reactive systems, LLM agents, machine learning, memory architectures | memory architectures, reactive systems, machine learning |
| state | document_detail | missing_fact | VALUE-001-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-011-1 | UNKNOWN |
