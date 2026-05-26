# Robust Question Experiment

This benchmark removes the oracle lookup assumption: systems receive only the question text and must infer the target subject/predicate slot before answering. The slot metadata is used only for grading.

| System | Exact Match | Current Fact Accuracy | Context Hit | Slot Inference Accuracy | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG | 0.1346 | 0.1591 | 0.6923 | 0.8269 | 75.8846 | 3.9732 |
| Temporal RAG | 0.6923 | 0.8182 | 0.7308 | 0.8269 | 76.8077 | 3.8460 |
| State Memory, no oracle | 0.8269 | 0.9318 | 0.8846 | 0.8269 | 69.2308 | 1.1228 |

Accuracy by question type:

| Type | RAG | Temporal RAG | State no-oracle | State slot inference |
| --- | ---: | ---: | ---: | ---: |
| paraphrase | 0.1538 | 0.6923 | 0.9231 | 0.9231 |
| indirect | 0.1538 | 0.6923 | 0.7692 | 0.7692 |
| noisy | 0.0769 | 0.6154 | 0.7692 | 0.7692 |
| temporal_multi_step | 0.1538 | 0.7692 | 0.8462 | 0.8462 |

Accuracy by domain:

| Domain | RAG | Temporal RAG | State no-oracle | State slot inference |
| --- | ---: | ---: | ---: | ---: |
| coursework_memory | 0.1563 | 0.5000 | 0.7188 | 0.7188 |
| calendar | 0.0000 | 1.0000 | 1.0000 | 1.0000 |
| crm | 0.0000 | 1.0000 | 1.0000 | 1.0000 |
| tasks | 0.0000 | 1.0000 | 1.0000 | 1.0000 |
| shopping | 0.0000 | 1.0000 | 1.0000 | 1.0000 |
| chat | 0.5000 | 1.0000 | 1.0000 | 1.0000 |

Interpretation: this is a harder benchmark than the base memory-isolation experiment. It includes paraphrased, indirect, noisy and temporal multi-step questions across coursework memory plus calendar, CRM, task, shopping and chat domains.
