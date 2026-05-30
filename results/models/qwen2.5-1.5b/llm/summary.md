# Mixed LLM Experiment

Model: qwen2.5:1.5b

Temperature: 0

Seed: 42

Request timeout ms: 120000

Num predict: 64

Question set: 31 total (10 current_state, 6 stable_state, 10 document_detail, 5 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.5806 | 1.0000 | 0.8065 | 0.0000 | 207.2581 | 8708.5087 |
| State + LLM | 0.6452 | 1.0000 | 0.9677 | 0.0000 | 64.0645 | 2159.0501 |
| Hybrid + LLM | 0.8710 | 1.0000 | 0.9677 | 0.0000 | 187.9032 | 8082.9133 |

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 0.5000 | 1.0000 | 1.0000 |
| stable_state | 0.3333 | 0.8333 | 0.8333 |
| document_detail | 0.6000 | 0.0000 | 0.7000 |
| unknown | 1.0000 | 1.0000 | 1.0000 |

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | 5.6855 | 0.0058 | 8708.5087 | 8714.2410 |
| State + LLM | 4.5159 | 0.0038 | 2159.0501 | 2163.5987 |
| Hybrid + LLM | 2.0876 | 0.0036 | 8082.9133 | 8085.0210 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | current_state | incomplete_answer | reactive graph runtime | actor |
| rag | current_state | incomplete_answer | zero-dependency Node.js | TypeScript |
| rag | current_state | incomplete_answer | lexical top-k retriever | UNKNOWN |
| rag | current_state | incomplete_answer | event chunks | daily summaries |
| rag | current_state | incomplete_answer | 12 | 8 |
| rag | stable_state | missing_fact | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | Implementation, baseline comparison, metrics, error analysis, and experiments. |
| rag | stable_state | incomplete_answer | reactive systems, LLM agents, machine learning, memory architectures | UNKNOWN |
| rag | stable_state | missing_fact | user profile, projects, goals, tasks, facts | goals |
| rag | stable_state | missing_fact | recall, precision, context size, latency, stale fact error rate, compression ratio | UNKNOWN |
| rag | document_detail | incomplete_answer | VALUE-011-1 | UNKNOWN |
