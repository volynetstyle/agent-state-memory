# Real Project Trace Experiment

This benchmark keeps all synthetic benchmarks intact and adds a small real-project trace derived from actual repository commits and current working-tree changes. It evaluates Temporal RAG, State Memory, and a LangChain ConversationBufferMemory-style external memory-framework baseline.

Extractor mode: ollama-llm-extractor. Parse-error events: 0.

| System | Exact Match | F1 | Context Hit | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Temporal RAG | 0.0000 | 0.0000 | 0.0000 | 49.0000 | 0.5202 |
| State Memory | 0.0000 | 0.0000 | 0.0000 | 47.1250 | 1.2803 |
| LangChain BufferMemory-style | 0.0000 | 0.0000 | 0.0000 | 70.0000 | 0.0353 |

Paired comparison against the external memory-framework baseline:

| Comparison | Candidate-only wins | Baseline-only wins | McNemar p |
| --- | ---: | ---: | ---: |
| State Memory vs LangChain BufferMemory-style | 0 | 0 | 1.0000 |

Interpretation: this is a small real-trace validation benchmark, not a replacement for the larger synthetic stress and robust benchmarks. Its purpose is to reduce synthetic-only bias and to show how explicit state compares with a buffer-memory framework pattern on repository-derived events.
