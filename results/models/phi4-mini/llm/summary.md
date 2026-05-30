# Mixed LLM Experiment

Model: phi4-mini

Temperature: 0

Seed: 42

Request timeout ms: 120000

Num predict: 64

Question set: 31 total (10 current_state, 6 stable_state, 10 document_detail, 5 unknown).

| System | Normalized Accuracy | Unknown Accuracy | Prompt Compliance | Hallucination Rate | Avg Context Tokens | Avg LLM ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.8387 | 1.0000 | 0.8387 | 0.0323 | 207.2581 | 20296.7511 |
| State + LLM | 0.6452 | 1.0000 | 0.9677 | 0.0000 | 64.0645 | 4889.5008 |
| Hybrid + LLM | 0.9677 | 1.0000 | 0.9677 | 0.0000 | 187.9032 | 18504.2194 |

Accuracy by question type:

| Type | RAG + LLM | State + LLM | Hybrid + LLM |
| --- | ---: | ---: | ---: |
| current_state | 0.8000 | 0.9000 | 0.9000 |
| stable_state | 0.5000 | 1.0000 | 1.0000 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |
| unknown | 1.0000 | 1.0000 | 1.0000 |

Latency breakdown:

| System | Retrieval ms | Prompt Build ms | LLM ms | Total ms |
| --- | ---: | ---: | ---: | ---: |
| RAG + LLM | 5.4523 | 0.0069 | 20296.7511 | 20302.2599 |
| State + LLM | 4.8103 | 0.0047 | 4889.5008 | 4894.3384 |
| Hybrid + LLM | 2.1490 | 0.0038 | 18504.2194 | 18506.3877 |

Top failure examples:

| System | Type | Error | Expected | Raw Answer |
| --- | --- | --- | --- | --- |
| rag | current_state | incomplete_answer | zero-dependency Node.js | Python |
| rag | current_state | incomplete_answer | lexical top-k retriever | Cosine embedding search. |
| rag | stable_state | missing_fact | implementation, experiments, metrics, baseline comparison, error analysis, conclusions | Implementation, baseline comparison, metrics, and error analysis. |
| rag | stable_state | missing_fact | user profile, projects, goals, tasks, facts | goals, full history of interactions. |
| rag | stable_state | missing_fact | recall, precision, context size, latency, stale fact error rate, compression ratio | Notebook status, Chart script note, Methodology section focus, Chart script summary, Notebook summary, README summary, Limitations section note, Experiment note... |
| state | current_state | incomplete_answer | zero-dependency Node.js | Node.js |
| state | document_detail | missing_fact | VALUE-001-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-011-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-021-1 | UNKNOWN |
| state | document_detail | missing_fact | VALUE-031-1 | UNKNOWN |
