# server

To install dependencies (client + server):

```bash
bun install (client , server, root)
```

To run:

```bash
bun run dev
```

This project was created using `bun init` in bun v1.3.3. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

---

## Local LLM (Ollama)

This project uses **Ollama** for local LLM inference with OpenAI as fallback.

### Requirements

1. **Ollama must be installed and running** (as a system service or desktop app)
   - Windows: Install from https://ollama.ai/download (runs as background service)
   - macOS: `brew install ollama` (runs as background service)
   - Linux: Install per https://ollama.ai/download

2. **A model must be available** (e.g., `llama3.2`, `gemma:2b`)
   - Pull a model: `ollama pull llama3.2`
   - Or set `OLLAMA_MODEL` env var to match your installed model

### Startup Behavior

On server start, the system:
1. Checks Ollama availability via `GET http://localhost:11434/api/tags`
2. Lists available models
3. If Ollama is unreachable → logs warning, uses OpenAI fallback
4. If model not found → logs warning with available alternatives

**No manual `ollama serve` required** - the system detects Ollama automatically.

### Verify Ollama is Running

```bash
curl http://localhost:11434/api/tags
# Should return JSON with "models" array
```

---

## Environment Variables

Place `.env` in `packages/server/` (loaded deterministically at startup).

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | OpenAI API key for fallback |
| `DATABASE_URL` | (required) | Prisma database connection |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model for router/chat |
| `PY_SERVICE_URL` | `http://localhost:8000` | Python sentiment + KB service URL |
| `USE_PLAN` | (unset=off) | When `true`, enables plan orchestration |
| `DEFAULT_LOCALE` | (auto) | Override language: `he` or `en` |

---

## Architecture

**Orchestration:** Chat → Planner/Router → Plan Executor | Single-Intent Router → Tools → Synthesis

**RAG flow:** getProductInformation → /search_kb (Python) → ChromaDB → RAG_GENERATION_PROMPT → OpenAI → grounded answer

**Tools:** getWeather, getExchangeRate, calculateMath, analyzeReview, getProductInformation, generalChat

**Sample logs:** See `../sample_logs/` for multi-tool orchestration examples.

**Bilingual:** HE/EN support via `detectLanguage` and `DEFAULT_LOCALE`.

---

## Performance Benchmarks

Benchmarks measure end-to-end latency for each component. Run 5 requests per component and compute average.

### Timer Locations

| Component | File | Timer Wraps | Log Format |
|-----------|------|-------------|------------|
| Router (Ollama) | `classifier.service.ts` | `callOllama()` | `[benchmark] router-ollama latency=XXXms` |
| Router (OpenAI) | `classifier.service.ts` | OpenAI fallback | `[benchmark] router-openai latency=XXXms` |
| Planner | `planner.service.ts` | Ollama/OpenAI | `[benchmark] router-planner latency=XXXms` |
| KB Search | `product-info.service.ts` | `searchKB()` | `[benchmark] kb-search latency=XXXms` |
| RAG Generation | `product-info.service.ts` | OpenAI | `[benchmark] rag-generation latency=XXXms` |
| Synthesis | `plan-executor.service.ts` | OpenAI | `[benchmark] synthesis latency=XXXms` |
| Total Plan | `plan-executor.service.ts` | Full orchestration | `[benchmark] total-plan latency=XXXms` |
| General Chat | `general-chat.service.ts` | `callOllama()` | `[benchmark] general-chat latency=XXXms` |
| Sentiment | `router.service.ts` | `callPythonSentiment()` | `[benchmark] python-sentiment latency=XXXms` |

### Results (N=5)

| Component | Avg Latency | Notes |
|-----------|-------------|-------|
| Router (Ollama) | TBD ms | llama3.2, localhost |
| Router (OpenAI) | TBD ms | gpt-4.1, fallback |
| Planner (Ollama) | TBD ms | plan orchestration |
| KB Search | TBD ms | Python /search_kb |
| RAG Generation | TBD ms | OpenAI |
| Synthesis | TBD ms | OpenAI |
| General Chat | TBD ms | llama3.2, localhost |
| Sentiment | TBD ms | distilbert, localhost |

### Model Comparison (Ollama vs OpenAI)

| Use Case | Ollama | OpenAI | Trade-off |
|----------|--------|--------|-----------|
| Router | $0, lower latency | ~$0.01/1K tokens | Use Ollama when available |
| Planner | $0 | ~$0.01/1K tokens | Ollama may have lower planning accuracy |
| RAG / Synthesis | N/A | Required | OpenAI for grounded answers |

**Cost/Accuracy:** Local (Ollama) offers zero cost and lower latency for router/planner but may have lower accuracy on complex plans. Cloud (OpenAI) costs ~$0.01/1K tokens with higher accuracy. Recommended: Ollama for router/planner when available; OpenAI for RAG, synthesis, and fallback.

### Benchmark Procedure

```bash
# Scenario 1: Router (Ollama) - 5 runs
for i in {1..5}; do
  curl -s -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"prompt":"weather in Haifa","conversationId":"test-'$i'"}'
done
# Grep logs: [benchmark] router-ollama latency
# Expected avg: 300-700ms

# Scenario 2: Router (OpenAI) - stop Ollama, 5 runs
# Expected avg: 800-1500ms

# Scenario 3: Python Sentiment - 5 direct calls
for i in {1..5}; do
  curl -s -X POST http://localhost:8000/analyze \
    -H "Content-Type: application/json" \
    -d '{"text":"The food was great"}'
done
# Expected avg: 50-150ms
```