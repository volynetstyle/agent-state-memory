# Mixed LLM Experiment

Model: qwen3:4b

Temperature: 0

Seed: 42

Request timeout ms: 120000

Num predict: 64

Question set: 31 total (10 current_state, 6 stable_state, 10 document_detail, 5 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.0000 | 0.0000 | 0.0000 | 1.0000 | 207.2581 | 29764.4525 |
| State + LLM | 0.0000 | 0.0000 | 0.0000 | 1.0000 | 64.0645 | 11471.3667 |
| Hybrid + LLM | 0.0000 | 0.0000 | 0.0000 | 1.0000 | 187.9032 | 27944.1519 |

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 0.0000 | 0.0000 | 0.0000 |
| stable_state | 0.0000 | 0.0000 | 0.0000 |
| document_detail | 0.0000 | 0.0000 | 0.0000 |
| unknown | 0.0000 | 0.0000 | 0.0000 |

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | 7.3306 | 0.0082 | 29764.4525 | 29771.8494 |
| State + LLM | 5.8250 | 0.0047 | 11471.3667 | 11477.2214 |
| Hybrid + LLM | 3.2355 | 0.0043 | 27944.1519 | 27947.4111 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | current_state | possible_hallucination | reactive graph runtime |  |
| rag | current_state | possible_hallucination | graph-indexed store |  |
| rag | current_state | possible_hallucination | dependency-tracked selectors |  |
| rag | current_state | possible_hallucination | State Memory for LLM agents |  |
| rag | current_state | possible_hallucination | one week |  |
| rag | current_state | possible_hallucination | zero-dependency Node.js |  |
| rag | current_state | possible_hallucination | lexical top-k retriever |  |
| rag | current_state | possible_hallucination | event chunks |  |
| rag | current_state | possible_hallucination | 12 |  |
| rag | current_state | possible_hallucination | structured world state |  |
