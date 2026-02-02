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

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | OpenAI API key for fallback |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model for router/chat |
| `PY_SERVICE_URL` | `http://localhost:8000` | Python sentiment service URL |

---

## Performance Benchmarks

Benchmarks measure end-to-end latency for each component. Run 5 requests per component and compute average.

### Timer Locations

| Component | File | Timer Wraps | Log Format |
|-----------|------|-------------|------------|
| Router (Ollama) | `classifier.service.ts` | `callOllama()` call inside `classifyIntent()` | `[benchmark] router-ollama latency=XXXms` |
| Router (OpenAI) | `classifier.service.ts` | `llmClient.generateText()` fallback call | `[benchmark] router-openai latency=XXXms` |
| General Chat (Ollama) | `general-chat.service.ts` | `callOllama()` call | `[benchmark] general-chat latency=XXXms` |
| Python Sentiment | `router.service.ts` | `callPythonSentiment()` call | `[benchmark] python-sentiment latency=XXXms` |

### Results (N=5)

| Component | Avg Latency | Notes |
|-----------|-------------|-------|
| Router (Ollama) | TBD ms | llama3.2, localhost |
| Router (OpenAI) | TBD ms | gpt-4.1, fallback |
| General Chat (Ollama) | TBD ms | llama3.2, localhost |
| Sentiment (Python) | TBD ms | distilbert, localhost |

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