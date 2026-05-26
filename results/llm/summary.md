# Mixed LLM Experiment

Model: llama3.2:3b

Temperature: 0

Seed: 42

Question set: 4 total (1 current_state, 1 stable_state, 1 document_detail, 1 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.7500 | 1.0000 | 0.7500 | 0.2500 | 159.7500 | 11875.3821 |
| State + LLM | 0.5000 | 1.0000 | 0.7500 | 0.2500 | 65.5000 | 4459.3383 |
| Hybrid + LLM | 0.7500 | 1.0000 | 0.7500 | 0.2500 | 147.5000 | 11956.6270 |

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
| RAG + LLM | 4.8017 | 0.0104 | 11875.3821 | 11880.2863 |
| State + LLM | 2.7093 | 0.0040 | 4459.3383 | 4462.0940 |
| Hybrid + LLM | 1.8711 | 0.0106 | 11956.6270 | 11958.5375 |
