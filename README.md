# ChatBot

Multi-intent chatbot with RAG (product info), plan orchestration, and bilingual (HE/EN) support.

## Installation & Run

### 1. Install Dependencies

```bash
# Root (Bun workspaces)
bun install
```

### 2. Python Service Dependencies

```bash
cd python-service
py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment

Create `.env` in `packages/server/` with:

- `OPENAI_API_KEY` (required for RAG, synthesis, fallback)
- `DATABASE_URL` (required for Prisma)

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

## Prerequisites

- **Ollama** (optional): Local LLM for router/planner. [Install](https://ollama.ai/download), then `ollama pull llama3.2`
- **Python 3.9+** with pip
- **OpenAI API key** (required)

## Ollama Setup

1. Install Ollama from https://ollama.ai/download
2. `ollama pull llama3.2` (or set `OLLAMA_MODEL`)
3. Verify: `curl http://localhost:11434/api/tags`

## Folder Structure

| Path | Purpose |
|------|---------|
| `packages/server/` | TypeScript server, orchestration, tools |
| `packages/client/` | Frontend chat UI |
| `python-service/` | Python: sentiment, /search_kb |
| `data/products/` | Product docs (3–5 .txt files) |
| `sample_logs/` | Multi-tool execution logs |
| `docs/` | Architecture, validation, cost estimation |

See [docs/repo_map.md](docs/repo_map.md) for project navigation.

## Links

- [Server README](packages/server/README.md) — architecture, tools, benchmarks
- [docs/architecture.md](docs/architecture.md) — flow diagrams
- [docs/validation_queries.md](docs/validation_queries.md) — orchestration test scenarios

## Environment Variables

- `DEFAULT_LOCALE`: Override language (`he` or `en`)
- `USE_PLAN`: Set to `true` to enable plan orchestration (default: off)
