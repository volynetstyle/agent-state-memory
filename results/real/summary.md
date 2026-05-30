# Real Project Trace Experiment

This benchmark keeps all synthetic benchmarks intact and adds a small real-project trace derived from actual repository commits and current working-tree changes. It evaluates Temporal RAG, State Memory, and a LangChain ConversationBufferMemory-style external memory-framework baseline.

Extractor mode: annotated-real-trace.

| System | Exact Match | F1 | Context Hit | Avg Context Tokens | Avg Latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Temporal RAG | 1.0000 | 1.0000 | 1.0000 | 52.5000 | 0.2721 |
| State Memory | 1.0000 | 1.0000 | 1.0000 | 56.5000 | 1.0154 |
| LangChain BufferMemory-style | 0.7500 | 0.8571 | 0.7500 | 70.0000 | 0.0259 |

Paired comparison against the external memory-framework baseline:

| Comparison | Candidate-only wins | Baseline-only wins | McNemar p |
| --- | ---: | ---: | ---: |
| State Memory vs LangChain BufferMemory-style | 2 | 0 | 0.5000 |

Interpretation: this is a small real-trace validation benchmark, not a replacement for the larger synthetic stress and robust benchmarks. Its purpose is to reduce synthetic-only bias and to show how explicit state compares with a buffer-memory framework pattern on repository-derived events.
