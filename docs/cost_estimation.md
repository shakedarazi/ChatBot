# Cost Estimation

## OpenAI Usage

| Component             | Model   | Typical Tokens    | Est. Cost/1K |
| --------------------- | ------- | ----------------- | ------------ |
| Planner               | gpt-4.1 | ~500 in, ~150 out | ~$0.007      |
| RAG generation        | gpt-4.1 | ~800 in, ~100 out | ~$0.009      |
| Synthesis             | gpt-4.1 | ~600 in, ~150 out | ~$0.008      |
| Review analysis       | gpt-4.1 | ~400 in, ~200 out | ~$0.006      |
| General chat fallback | gpt-4.1 | ~400 in, ~100 out | ~$0.005      |

Formula: `cost ≈ (input_tokens/1000 * $0.01) + (output_tokens/1000 * $0.03)` (approx gpt-4 pricing)

## Typical Request Costs

- **Single product query (RAG):** ~$0.01–0.02 (planner + RAG generation)
- **Multi-tool (Weather + Exchange + Synthesis):** ~$0.02 (planner + synthesis)
- **General chat via Ollama:** ~$0.007 (planner only; Ollama inference is free)

## Reducing Cost

1. Use Ollama for general chat (local = $0 for the chat portion)
2. Cache RAG chunks when same query repeats
3. Use smaller models for simple intents
