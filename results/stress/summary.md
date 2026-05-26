# Stress Experiment

This benchmark intentionally weakens the idealized assumptions of the base experiment.

| Scenario | System | Exact Match | Current Fact Accuracy | Stale Error | Context Hit | MRR |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| clean_extraction | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.4515 |
| clean_extraction | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.8733 |
| clean_extraction | State Memory | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 1.0000 |
| missing_final_updates | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.4515 |
| missing_final_updates | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.8733 |
| missing_final_updates | State Memory | 0.1429 | 0.0000 | 0.8571 | 0.1429 | 0.1429 |
| wrong_extraction_slot | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.4515 |
| wrong_extraction_slot | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.8733 |
| wrong_extraction_slot | State Memory | 0.9286 | 0.9167 | 0.0714 | 0.9286 | 0.9286 |
| ambiguous_similar_entities | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.4466 |
| ambiguous_similar_entities | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.5458 |
| ambiguous_similar_entities | State Memory | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 1.0000 |

Interpretation: the perfect State Memory result depends on clean fact extraction. When updates are missing or facts are assigned to the wrong slot, State Memory degrades. A stronger RAG baseline with recency/latest-wins can reduce stale errors, so future work should compare against temporal-aware RAG variants instead of only a naive RAG baseline.
