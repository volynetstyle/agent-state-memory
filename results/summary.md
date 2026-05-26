# Experiment Summary

Dataset: 1000 events, 42 questions, 8158 approximate full-history tokens.

| System | Exact Match | F1 | Current Fact Accuracy | Obsolete Rejection | Stale Error | Context Hit | MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| RAG | 0.2143 | 0.2169 | 0.1667 | 0.1667 | 0.7143 | 0.9286 | 0.4515 |
| State Memory | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 1.0000 |

| System | Avg Context Tokens | Avg Latency ms | Context Efficiency | Latency Efficiency | Compression Ratio |
| --- | ---: | ---: | ---: | ---: | ---: |
| RAG | 87.8810 | 5.7825 | 0.0024 | 0.0371 | 92.8301 |
| State Memory | 65.3333 | 1.2992 | 0.0153 | 0.7697 | 124.8673 |

Paired comparison:

| Case | Count |
| --- | ---: |
| Both correct | 9 |
| State correct, RAG wrong | 33 |
| RAG correct, State wrong | 0 |
| Both wrong | 0 |

Interpretation: State Memory keeps mutable facts as explicit active/obsolete state, so current-fact questions avoid stale answers in this synthetic benchmark. RAG retrieves raw historical event chunks and can surface old versions of mutable facts.
