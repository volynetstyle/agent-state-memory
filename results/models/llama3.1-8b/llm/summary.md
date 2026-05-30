# Mixed LLM Experiment

Model: llama3.1:8b

Temperature: 0

Seed: 42

Request timeout ms: 120000

Num predict: 64

Question set: 31 total (10 current_state, 6 stable_state, 10 document_detail, 5 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.8387 | 1.0000 | 0.8710 | 0.0323 | 207.2581 | 39311.1143 |
| State + LLM | 0.6129 | 1.0000 | 0.9355 | 0.0000 | 64.0645 | 9658.6053 |
| Hybrid + LLM | 0.9677 | 1.0000 | 0.9677 | 0.0000 | 187.9032 | 36045.8480 |

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 0.8000 | 0.9000 | 0.9000 |
| stable_state | 0.5000 | 0.8333 | 1.0000 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |
| unknown | 1.0000 | 1.0000 | 1.0000 |

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | 5.7349 | 0.0065 | 39311.1143 | 39316.8995 |
| State + LLM | 1.4620 | 0.0039 | 9658.6053 | 9660.0996 |
| Hybrid + LLM | 2.1930 | 0.0030 | 36045.8480 | 36048.0576 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | current_state | incomplete_answer | zero-dependency Node.js | Node.js |
| rag | current_state | incomplete_answer | structured world state | RAG retrieval. |
| rag | stable_state | missing_fact | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | RAG, implementation, baseline comparison, metrics, error analysis, experiments. |
| rag | stable_state | missing_fact | user profile, projects, goals, tasks, facts | goals, facts |
| rag | stable_state | missing_fact | recall, precision, context size, latency, stale fact error rate, compression ratio | UNKNOWN |
| state | current_state | incomplete_answer | zero-dependency Node.js | Node.js |
| state | stable_state | incomplete_answer | event logging, fact extraction, state update, state selection, prompt building | update, selection, event logging, fact extraction, prompt building |
| state | document_detail | missing_fact | VALUE-001-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-011-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-021-1 | UNKNOWN |
