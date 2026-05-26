# Mixed LLM Experiment

Model: llama3.2:3b

Temperature: 0

Seed: 42

Request timeout ms: 120000

Num predict: 64

Question set: 9 total (2 current_state, 2 stable_state, 2 document_detail, 3 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.8889 | 1.0000 | 0.8889 | 0.0000 | 145.0000 | 11500.3988 |
| State + LLM | 0.6667 | 1.0000 | 0.8889 | 0.0000 | 65.4444 | 4275.4373 |
| Hybrid + LLM | 0.8889 | 1.0000 | 0.8889 | 0.0000 | 138.4444 | 10916.4702 |

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 1.0000 | 1.0000 | 1.0000 |
| stable_state | 0.5000 | 0.5000 | 0.5000 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |
| unknown | 1.0000 | 1.0000 | 1.0000 |

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | 8.9158 | 0.0113 | 11500.3988 | 11509.4055 |
| State + LLM | 2.4266 | 0.0078 | 4275.4373 | 4277.9141 |
| Hybrid + LLM | 2.6772 | 0.0042 | 10916.4702 | 10919.2054 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | stable_state | missing_fact | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | includes implementation, baseline comparison, metrics, error analysis, experiments. |
| state | stable_state | incomplete_answer | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | experiments and conclusions |
| state | document_detail | missing_fact | VALUE-001-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-011-1 | UNKNOWN |
| hybrid | stable_state | incomplete_answer | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | baseline comparison, metrics, error analysis, experiments, conclusions |
