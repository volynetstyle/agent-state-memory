# Real Extractor Benchmark

This benchmark evaluates the full raw-event pipeline: raw event text -> extractor -> State Store -> QA.

| Extractor | Extraction Precision | Extraction Recall | Extraction F1 | Slot Accuracy | Entity Resolution | Mutable Classification | Conflict Detection | Parse-error Events | Downstream QA EM |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gold annotations | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0 | 1.0000 |
| Rule extractor | 1.0000 | 0.7143 | 0.8333 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0 | 0.8750 |
| LLM extractor (gemma3:4b) | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.1500 | 0.0000 | 0.0000 | 0 | 0.0000 |

Interpretation: the gold extractor is the clean-extraction upper bound. The rule extractor shows how State Memory degrades when extraction misses facts. Passing `--llm-extractor` adds a real Ollama-backed LLM extractor to the same benchmark.
