# Mixed LLM Experiment

Model: llama3.2:3b

Temperature: 0

Seed: 42

Request timeout ms: 120000

Num predict: 64

Question set: 31 total (10 current_state, 6 stable_state, 10 document_detail, 5 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.8065 | 1.0000 | 0.8710 | 0.0323 | 207.2581 | 12657.8324 |
| State + LLM | 0.5806 | 1.0000 | 0.9032 | 0.0323 | 64.0645 | 3118.6793 |
| Hybrid + LLM | 0.9355 | 1.0000 | 0.9355 | 0.0000 | 187.9032 | 11603.0226 |

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 0.7000 | 0.9000 | 0.9000 |
| stable_state | 0.5000 | 0.6667 | 0.8333 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |
| unknown | 1.0000 | 1.0000 | 1.0000 |

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | 4.3712 | 0.0052 | 12657.8324 | 12662.2456 |
| State + LLM | 0.9185 | 0.0036 | 3118.6793 | 3119.6190 |
| Hybrid + LLM | 1.6514 | 0.0056 | 11603.0226 | 11604.6912 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | current_state | incomplete_answer | zero-dependency Node.js | UNKNOWN |
| rag | current_state | incomplete_answer | lexical top-k retriever | Cosine embedding search. |
| rag | current_state | incomplete_answer | structured world state | RAG retrieval. |
| rag | stable_state | missing_fact | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | includes implementation, baseline comparison, metrics, error analysis, experiments. |
| rag | stable_state | missing_fact | user profile, projects, goals, tasks, facts | Goals, state updates. |
| rag | stable_state | missing_fact | recall, precision, context size, latency, stale fact error rate, compression ratio | UNKNOWN |
| state | current_state | incomplete_answer | zero-dependency Node.js | Node.js |
| state | stable_state | incomplete_answer | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | experiments and conclusions |
| state | stable_state | possible_hallucination | event logging, fact extraction, state update, state selection, prompt building | State Memory pipeline:  1. state selection 2. event logging 3. fact extraction 4. prompt building |
| state | document_detail | missing_fact | VALUE-001-1 | UNKNOWN |
