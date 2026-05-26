# Mixed LLM Experiment

Model: llama3.2:3b

Temperature: 0

Seed: 42

Request timeout ms: 120000

Num predict: 32

Question set: 4 total (1 current_state, 1 stable_state, 1 document_detail, 1 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.7500 | 1.0000 | 0.7500 | 0.0000 | 159.7500 | 10915.6349 |
| State + LLM | 0.5000 | 1.0000 | 0.7500 | 0.0000 | 65.5000 | 4340.5043 |
| Hybrid + LLM | 0.7500 | 1.0000 | 0.7500 | 0.0000 | 147.5000 | 11189.9571 |

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 1.0000 | 1.0000 | 1.0000 |
| stable_state | 0.0000 | 0.0000 | 0.0000 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |
| unknown | 1.0000 | 1.0000 | 1.0000 |

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | 4.5177 | 0.0101 | 10915.6349 | 10920.2481 |
| State + LLM | 2.9083 | 0.0043 | 4340.5043 | 4343.4725 |
| Hybrid + LLM | 2.5601 | 0.0122 | 11189.9571 | 11192.5571 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | stable_state | missing_fact | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | includes implementation, baseline comparison, metrics, error analysis, experiments. |
| state | stable_state | incomplete_answer | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | baseline comparison, metrics, error analysis, experiments, conclusions |
| state | document_detail | missing_fact | VALUE-001-1 | UNKNOWN |
| hybrid | stable_state | incomplete_answer | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | experiments, conclusions |
