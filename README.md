# ChatBot

Multi-intent chatbot with RAG (product info), plan orchestration, and bilingual (HE/EN) support.


## Prerequisites

- **Ollama** (optional): Local LLM for router/planner. [Install](https://ollama.ai/download), then `ollama pull llama3.2 (cmd)`
- **Python 3.9+** with pip
- **OpenAI API key** (required)

## Ollama Setup

1. Install Ollama from https://ollama.ai/download
2. `ollama pull llama3.2` (& set `OLLAMA_MODEL`)
3. Verify: `curl http://localhost:11434/api/tags`


## Installation & Run

### 1. Install Dependencies

```bash
# Root (Bun workspaces)
bun install
```

### 2. Environment

Create `packages/server/.env`:

| Variable | Required for runnig | Notes |
|----------|----------|-------|
| `OPENAI_API_KEY` | Yes | For RAG, synthesis, fallback |
| `DATABASE_URL` | Yes | Prisma connection |
| `PY_SERVICE_URL` | No | Default `http://localhost:8000` |
| `OLLAMA_URL` | No | Default `http://localhost:11434` |
| `OLLAMA_MODEL` | No | Default `llama3.2` |
| `USE_PLAN` | No | `true` enables plan orchestration (default: off) |
| `DEFAULT_LOCALE` | No | `he` or `en` override |
| `PORT` | No | Default `3000` |

### 3. Python Service Dependencies

```bash
cd python-service
py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```



### 4. Knowledge Base Indexing

```bash
cd python-service
python index_kb.py --rebuild
```

### 5. Run

```bash
# Terminal 1: Python service
cd python-service && uvicorn server:app --reload

# Terminal 2: TypeScript server
bun run dev
```

## Folder Structure

| Path | Purpose |
|------|---------|
| `packages/server/` | TypeScript server, orchestration, tools |
| `packages/client/` | Frontend chat UI |
| `python-service/` | Python microservice: sentiment, /search_kb |
| `data/products/` | Product docs (3–5 .txt files), you can change it|
| `sample_logs/` | Multi-tool execution logs for understanding |
| `docs/` | Architecture, validation, cost estimation, verification for working |

See [docs/repo_map.md](docs/repo_map.md) for project navigation.

## Links

- [Server README](packages/server/README.md) — architecture, tools, benchmarks
- [docs/architecture.md](docs/architecture.md) — flow diagrams
- [docs/validation_queries.md](docs/validation_queries.md) — orchestration test scenarios

## Environment Variables

- `DEFAULT_LOCALE`: Override language (`he` or `en`)
- `USE_PLAN`: Set to `true` to enable plan orchestration (default: off)
