# Mixed Knowledge Experiment

This benchmark combines three question types:

- current state questions from event memory
- stable non-current state questions from event memory
- document-detail questions from a synthetic 100-page unstructured document

| System | Exact Match | Current Fact Accuracy | Context Hit | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| RAG-only | 0.6765 | 0.1667 | 0.9706 | 229.7941 | 3.4061 |
| State-only | 0.4118 | 1.0000 | 0.4118 | 26.9020 | 0.4587 |
| Hybrid | 1.0000 | 1.0000 | 1.0000 | 220.5098 | 1.5941 |

Accuracy by question type:

| Question Type | RAG-only | State-only | Hybrid |
| --- | ---: | ---: | ---: |
| current_state | 0.1667 | 1.0000 | 1.0000 |
| stable_state | 0.5000 | 1.0000 | 1.0000 |
| document_detail | 1.0000 | 0.0000 | 1.0000 |

Interpretation: State Memory is strongest for current-state questions, but it cannot answer arbitrary long-document details unless those details are extracted into structured state. RAG remains appropriate for unstructured document QA. The practical architecture is hybrid: State Memory for evolving world state, RAG for large document corpora.
