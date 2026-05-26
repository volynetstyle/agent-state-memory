# LLM Experiment Summary

Model: llama3.2:3b

Dataset subset: 20 questions from 1000 events.

| System | Recall | Precision | Stale fact error rate | Avg context tokens | Avg latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| RAG + LLM | 0.8000 | 0.8889 | 0.0000 | 116.8500 | 7498.0601 |
| State Memory + LLM | 0.7500 | 0.8333 | 0.0000 | 81.1500 | 7854.6256 |

This optional experiment validates the same memory pipeline with a real local language model. The deterministic benchmark remains the primary controlled experiment because it isolates memory quality from generation noise.
