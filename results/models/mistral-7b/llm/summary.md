# Mixed LLM Experiment

Model: mistral:7b

Temperature: 0

Seed: 42

Request timeout ms: 120000

Num predict: 64

Question set: 31 total (10 current_state, 6 stable_state, 10 document_detail, 5 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.8710 | 1.0000 | 0.9032 | 0.0000 | 207.2581 | 46216.6909 |
| State + LLM | 0.6774 | 1.0000 | 1.0000 | 0.0000 | 64.0645 | 12037.3386 |
| Hybrid + LLM | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 187.9032 | 43067.1499 |

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 0.9000 | 1.0000 | 1.0000 |
| stable_state | 0.5000 | 1.0000 | 1.0000 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |
| unknown | 1.0000 | 1.0000 | 1.0000 |

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | 5.6675 | 0.0057 | 46216.6909 | 46222.4033 |
| State + LLM | 4.7179 | 0.0039 | 12037.3386 | 12042.0805 |
| Hybrid + LLM | 2.1283 | 0.0030 | 43067.1499 | 43069.2947 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | current_state | incomplete_answer | structured world state | RAG |
| rag | stable_state | missing_fact | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | Implementation, baseline comparison, metrics, error analysis, experiments |
| rag | stable_state | missing_fact | user profile, projects, goals, tasks, facts | Goals |
| rag | stable_state | missing_fact | recall, precision, context size, latency, stale fact error rate, compression ratio | UNKNOWN (The context does not provide information about the metrics that are included.) |
| state | document_detail | missing_fact | VALUE-001-1 | UNKNOWN (No context provided) |
| state | document_detail | missing_fact | VALUE-011-1 | UNKNOWN (No context provided) |
| state | document_detail | missing_fact | VALUE-021-1 | UNKNOWN (No context provided) |
| state | document_detail | missing_fact | VALUE-031-1 | UNKNOWN (No context provided) |
| state | document_detail | missing_fact | VALUE-041-1 | UNKNOWN (No context provided) |
| state | document_detail | missing_fact | VALUE-051-1 | UNKNOWN (No context provided) |
