# Robust Question Experiment

This is the main non-oracle current-state benchmark. Systems receive only the question text and must infer the target subject/predicate slot before answering. The slot metadata is used only for grading. Temporal RAG is the primary retrieval baseline; local vector RAG is included as a stronger vector-store-shaped retrieval baseline, and naive RAG is retained as a weak baseline.

| System | Exact Match | Current Fact Accuracy | Context Hit | Slot Inference Accuracy | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG | 0.1333 | 0.1538 | 0.7333 | 0.8000 | 79.9333 | 3.7074 |
| Vector RAG | 0.6667 | 0.7692 | 0.7500 | 0.8000 | 75.8500 | 0.5830 |
| Temporal RAG | 0.6833 | 0.7885 | 0.7667 | 0.8000 | 80.9500 | 3.5138 |
| State Memory, no oracle | 0.8000 | 0.8846 | 0.9000 | 0.8000 | 72.1833 | 1.1056 |

Accuracy by question type:

| Type | RAG | Vector RAG | Temporal RAG | State no-oracle | State slot inference |
| --- | ---: | ---: | ---: | ---: | ---: |
| paraphrase | 0.1333 | 0.6667 | 0.7333 | 0.9333 | 0.9333 |
| indirect | 0.1333 | 0.7333 | 0.7333 | 0.8000 | 0.8000 |
| noisy | 0.0667 | 0.5333 | 0.5333 | 0.6667 | 0.6667 |
| temporal_multi_step | 0.2000 | 0.7333 | 0.7333 | 0.8000 | 0.8000 |

Accuracy by domain:

| Domain | RAG | Vector RAG | Temporal RAG | State no-oracle | State slot inference |
| --- | ---: | ---: | ---: | ---: | ---: |
| coursework_memory | 0.1563 | 0.4688 | 0.5000 | 0.7188 | 0.7188 |
| calendar | 0.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| crm | 0.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| tasks | 0.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| shopping | 0.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| chat | 0.5000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| cross_domain | 0.1250 | 0.6250 | 0.6250 | 0.6250 | 0.6250 |

Slot inference failures by question type:

| Type | Failure count | Slot accuracy on failures | Exact match on failures |
| --- | ---: | ---: | ---: |
| noisy | 5 | 0.0000 | 0.0000 |
| indirect | 3 | 0.0000 | 0.0000 |
| paraphrase | 1 | 0.0000 | 0.0000 |
| temporal_multi_step | 3 | 0.0000 | 0.0000 |

Interpretation: this is a harder benchmark than the oracle memory-isolation experiment. Temporal RAG closes much of the naive-RAG gap, which means the measured State Memory advantage should be read against the stronger recency/latest-fact baseline. The benchmark includes paraphrased, indirect, noisy and temporal multi-step questions across coursework memory plus calendar, CRM, task, shopping, chat and cross-domain dependency questions.
