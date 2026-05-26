# Stress Experiment

This benchmark intentionally weakens the idealized assumptions of the base experiment.

| Scenario | System | Exact Match | Current Fact Accuracy | Stale Error | Context Hit | MRR | Fallback Rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| clean_extraction | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.4515 | 0.0000 |
| clean_extraction | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.8733 | 0.0000 |
| clean_extraction | State Memory | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 1.0000 | 0.0000 |
| clean_extraction | Defensive State + fallback | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 1.0000 | 0.0000 |
| missing_final_updates | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.4515 | 0.0000 |
| missing_final_updates | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.8733 | 0.0000 |
| missing_final_updates | State Memory | 0.1429 | 0.0000 | 0.8571 | 0.1429 | 0.1429 | 0.0000 |
| missing_final_updates | Defensive State + fallback | 0.1429 | 0.0000 | 0.8571 | 0.1429 | 0.1429 | 0.0000 |
| wrong_extraction_slot | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.4515 | 0.0000 |
| wrong_extraction_slot | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.8733 | 0.0000 |
| wrong_extraction_slot | State Memory | 0.9286 | 0.9167 | 0.0714 | 0.9286 | 0.9286 | 0.0000 |
| wrong_extraction_slot | Defensive State + fallback | 0.9286 | 0.9167 | 0.0714 | 0.9286 | 0.9286 | 0.0000 |
| low_confidence_final_updates | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.4515 | 0.0000 |
| low_confidence_final_updates | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.8733 | 0.0000 |
| low_confidence_final_updates | State Memory | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 1.0000 | 0.0000 |
| low_confidence_final_updates | Defensive State + fallback | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0.9395 | 0.8571 |
| near_simultaneous_conflicts | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.4515 | 0.0000 |
| near_simultaneous_conflicts | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.8733 | 0.0000 |
| near_simultaneous_conflicts | State Memory | 0.1429 | 0.0000 | 0.0000 | 0.1429 | 0.1429 | 0.0000 |
| near_simultaneous_conflicts | Defensive State + fallback | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0.9395 | 0.8571 |
| ambiguous_similar_entities | Classic RAG | 0.2143 | 0.1667 | 0.7143 | 0.9286 | 0.4466 | 0.0000 |
| ambiguous_similar_entities | RAG + recency/latest | 0.9286 | 1.0000 | 0.0000 | 0.9286 | 0.5458 | 0.0000 |
| ambiguous_similar_entities | State Memory | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 1.0000 | 0.0000 |
| ambiguous_similar_entities | Defensive State + fallback | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 1.0000 | 0.0000 |

Defensive State diagnostics:

| Scenario | Rejected Low-Confidence Facts | Stored Conflicts | Soft Replacements | Low-Confidence Question Rate | Conflict Question Rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| clean_extraction | 862 | 0 | 72 | 0.0000 | 0.0000 |
| missing_final_updates | 862 | 0 | 36 | 0.0000 | 0.0000 |
| wrong_extraction_slot | 862 | 0 | 59 | 0.0000 | 0.0000 |
| low_confidence_final_updates | 898 | 0 | 36 | 0.8571 | 0.0000 |
| near_simultaneous_conflicts | 862 | 36 | 72 | 0.0000 | 0.8571 |
| ambiguous_similar_entities | 887 | 0 | 72 | 0.0000 | 0.0000 |

Interpretation: the perfect State Memory result depends on clean fact extraction. When updates are missing or facts are assigned to the wrong slot, State Memory degrades. Defensive State Memory adds a confidence threshold, conflict tracking, versioning and a Temporal RAG fallback for uncertain slots. It helps when uncertainty is visible, but it cannot recover an update that the extractor completely missed unless raw events are rechecked by a reconciliation step.
