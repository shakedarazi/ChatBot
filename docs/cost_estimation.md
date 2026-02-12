# Cost Estimation

## OpenAI Usage

| Component | Model | Typical Tokens | Est. Cost/1K |
|-----------|-------|----------------|--------------|
| Router fallback | gpt-4.1 | ~300 in, ~50 out | ~$0.003 |
| Planner fallback | gpt-4.1 | ~500 in, ~150 out | ~$0.007 |
| RAG generation | gpt-4.1 | ~800 in, ~100 out | ~$0.009 |
| Synthesis | gpt-4.1 | ~600 in, ~150 out | ~$0.008 |
| General chat fallback | gpt-4.1 | ~400 in, ~100 out | ~$0.005 |

Formula: `cost ≈ (input_tokens/1000 * $0.01) + (output_tokens/1000 * $0.03)` (approx gpt-4 pricing)

## Typical Request Costs

- **Single product query (RAG):** ~$0.01
- **Multi-tool (Weather + Exchange + Synthesis):** ~$0.02
- **With Ollama for router/planner:** ~$0.01 (RAG/synthesis only)

## Reducing Cost

1. Use Ollama for router and planner (local = $0)
2. Cache RAG chunks when same query repeats
3. Use smaller models for simple intents
