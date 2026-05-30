# Mixed LLM Experiment

Model: qwen2.5:7b

Temperature: 0

Seed: 42

Request timeout ms: 120000

Num predict: 64

Question set: 31 total (10 current_state, 6 stable_state, 10 document_detail, 5 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.8387 | 1.0000 | 0.9032 | 0.0000 | 207.2581 | 38425.9051 |
| State + LLM | 0.6774 | 1.0000 | 1.0000 | 0.0000 | 64.0645 | 9023.9819 |
| Hybrid + LLM | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 187.9032 | 35214.2771 |

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 0.8000 | 1.0000 | 1.0000 |
| stable_state | 0.5000 | 1.0000 | 1.0000 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |
| unknown | 1.0000 | 1.0000 | 1.0000 |

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | 5.6496 | 0.0060 | 38425.9051 | 38431.6018 |
| State + LLM | 1.5455 | 0.0036 | 9023.9819 | 9025.5497 |
| Hybrid + LLM | 2.1910 | 0.0029 | 35214.2771 | 35216.4852 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | current_state | incomplete_answer | lexical top-k retriever | cosine embedding search |
| rag | current_state | incomplete_answer | structured world state | RAG retrieval |
| rag | stable_state | missing_fact | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | includes implementation, baseline comparison, metrics, error analysis, and experiments |
| rag | stable_state | missing_fact | user profile, projects, goals, tasks, facts | UNKNOWN |
| rag | stable_state | missing_fact | recall, precision, context size, latency, stale fact error rate, compression ratio | UNKNOWN |
| state | document_detail | missing_fact | VALUE-001-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-011-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-021-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-031-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-041-1 | UNKNOWN |
