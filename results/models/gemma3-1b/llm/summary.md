# Mixed LLM Experiment

Model: gemma3:1b

Temperature: 0

Seed: 42

Request timeout ms: 120000

Num predict: 64

Question set: 31 total (10 current_state, 6 stable_state, 10 document_detail, 5 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.7097 | 0.8000 | 0.7419 | 0.0323 | 207.2581 | 5928.1879 |
| State + LLM | 0.5806 | 1.0000 | 0.9032 | 0.0000 | 64.0645 | 1963.2284 |
| Hybrid + LLM | 0.9355 | 1.0000 | 0.9355 | 0.0000 | 187.9032 | 5747.8673 |

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 0.5000 | 1.0000 | 1.0000 |
| stable_state | 0.5000 | 0.5000 | 0.6667 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |
| unknown | 0.8000 | 1.0000 | 1.0000 |

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | 8.3237 | 0.0080 | 5928.1879 | 5936.5707 |
| State + LLM | 1.9019 | 0.0046 | 1963.2284 | 1965.1594 |
| Hybrid + LLM | 3.0919 | 0.0037 | 5747.8673 | 5750.9811 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | current_state | incomplete_answer | dependency-tracked selectors | Manual subscriptions |
| rag | current_state | incomplete_answer | one week | TWO weeks |
| rag | current_state | incomplete_answer | zero-dependency Node.js | TypeScript |
| rag | current_state | incomplete_answer | event chunks | paragraph chunks |
| rag | current_state | incomplete_answer | structured world state | RAG retrieval |
| rag | stable_state | missing_fact | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | Includes implementation, baseline comparison, metrics, and error analysis. |
| rag | stable_state | missing_fact | user profile, projects, goals, tasks, facts | goals |
| rag | stable_state | missing_fact | recall, precision, context size, latency, stale fact error rate, compression ratio | UNKNOWN |
| rag | unknown | unknown_failed | UNKNOWN | Memory architectures |
| state | stable_state | incomplete_answer | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | state Memory coursework.requires = implementation (active) |
