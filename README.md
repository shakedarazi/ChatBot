# ChatBot

A multi-tool chatbot that plans and executes multi-step queries using local and cloud LLMs. Supports weather, exchange rates, math, review analysis, product information (RAG), and general conversation — in both Hebrew and English.

## Features

- **Plan orchestration** — Every user message is analyzed by a planner that creates a multi-step execution plan (1–5 tool calls), with inter-tool dependencies via result placeholders
- **RAG (Retrieval-Augmented Generation)** — Product questions are answered from `data/products/` documents via ChromaDB semantic search + OpenAI grounded generation
- **6 built-in tools** — Weather (Open-Meteo), exchange rates, math evaluation, review analysis (ABSA), product info (RAG), general chat
- **Bilingual** — Automatically detects and responds in Hebrew or English
- **Ollama + OpenAI** — Uses local Ollama for general chat (free), OpenAI for planning, RAG, review analysis, and synthesis

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 19, Vite, Tailwind CSS, React Query |
| Backend | Bun, Express 5, TypeScript, Zod |
| AI / ML | Python (FastAPI), ChromaDB, sentence-transformers, DistilBERT |
| LLM | Ollama (local, general chat) + OpenAI gpt-4.1 (planning, RAG, synthesis) |

## How It Works

```
User message → POST /api/chat
  → Planner (Ollama → OpenAI fallback) → JSON execution plan
  → Plan Executor runs tools sequentially
  → If multi-tool: Synthesis (OpenAI) merges results
  → Response
```

1. **Planner** receives the user message and outputs a JSON plan: which tools to call, with what parameters, and whether synthesis is needed
2. **Executor** runs each tool in order, resolving result placeholders (`<result_from_tool_1>`) between steps
3. **Single-tool results** are returned directly; **multi-tool results** are merged by the synthesis service via OpenAI

## Prerequisites

- **Bun** — JavaScript runtime and package manager ([install](https://bun.sh))
- **Python 3.10 / 3.11 / 3.12** with pip (PyTorch does not fully support 3.13)
- **OpenAI API key** (required for planning, RAG, review analysis, synthesis)
- **Ollama** (optional) — Local LLM for general chat. [Install](https://ollama.ai/download), then pull a model:
  ```bash
  ollama pull llama3.2
  ```

## Installation

### 1. Install Node Dependencies

```bash
# From repo root (Bun workspaces install both server + client)
bun install
```

### 2. Configure Environment

Create `apps/server/.env`:

```env
OPENAI_API_KEY=sk-your-key-here
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `OLLAMA_URL` | No | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | No | `llama3.2` | Ollama model name |
| `PY_SERVICE_URL` | No | `http://localhost:8000` | Python microservice URL |
| `DEFAULT_LOCALE` | No | auto-detect | Force `he` or `en` |
| `PORT` | No | `3000` | Server port |

### 3. Python Service Setup

```bash
cd services/python
py -3.12 -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 4. Knowledge Base Indexing (first time only)

```bash
cd services/python
python index_kb.py --rebuild
```

This indexes the 3 product documents from `data/products/` into ChromaDB at `services/python/chroma_db/`.

## Running

```bash
# Terminal 1: Python microservice
cd services/python
.venv\Scripts\activate          # or: source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000

# Terminal 2: TypeScript server + React client (from repo root)
bun run dev
```

The client opens at `http://localhost:5173` (Vite dev server, proxies `/api` to the backend on port 3000).

## API

### POST /api/chat

Send a chat message.

**Request:**

```json
{
  "prompt": "What's the weather in London and the GBP to ILS rate?",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**

```json
{
  "message": "London: 12°C, Partly cloudy. The GBP to ILS rate is 4.7000."
}
```

**Validation:**
- `prompt`: string, 1–1000 characters (required)
- `conversationId`: UUID v4 (required)

**Special commands:**
- Send `/reset` as the prompt to clear conversation history

### Python Service Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/analyze` | POST | Sentiment analysis (DistilBERT) |
| `/search_kb` | POST | Knowledge base semantic search |
| `/health` | GET | Health check |

## Project Structure

| Path | Purpose |
|------|---------|
| `apps/server/` | TypeScript backend — orchestration, tools, LLM clients |
| `apps/client/` | React chat UI (Vite + Tailwind) |
| `services/python/` | Python microservice — sentiment analysis, KB search |
| `data/products/` | Product documents (3 `.txt` files) for RAG |
| `docs/` | Architecture docs, validation queries, verification guide |
| `examples/sample_logs/` | Multi-tool execution log examples |
| `scripts/dev.ts` | Dev runner (concurrently starts server + client) |

## Tools Reference

| Tool | Source | External Dependency |
|------|--------|---------------------|
| `getWeather` | `weather.service.ts` | Open-Meteo API (free, no key) |
| `getExchangeRate` | `exchange.service.ts` | Hardcoded rates (USD, EUR, GBP, ILS) |
| `calculateMath` | `math.service.ts` | Pure parser (no `eval`) |
| `analyzeReview` | `review-analyzer.service.ts` | OpenAI (ABSA with self-correction) |
| `getProductInformation` | `product-info.service.ts` | Python /search_kb → OpenAI RAG |
| `generalChat` | `general-chat.service.ts` | Ollama (primary) → OpenAI (fallback) |

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `Ollama not available` on startup | Ollama not installed/running | Install Ollama and run `ollama pull <model>`, or ignore (OpenAI fallback works) |
| Ollama timeout on general chat | Model too slow on CPU | Increase `timeoutMs` in `general-chat.service.ts`, or use a smaller model |
| `KB service initialization failed` | ChromaDB not indexed | Run `python index_kb.py --rebuild` in `services/python/` |
| Product queries return empty | Python service not running | Start the Python service on port 8000 |
| Mixed-language gibberish | Small Ollama model struggles with Hebrew | Use a model with better multilingual support, or rely on OpenAI fallback |

## Development

```bash
# Format code
bun run format

# Type check (server)
cd apps/server && bun run build

# Lint (client)
cd apps/client && bun run lint
```

Pre-commit hooks run `lint-staged` via Husky.

## Links

- [Server README](apps/server/README.md) — architecture, tools, benchmarks
- [docs/architecture.md](docs/architecture.md) — flow diagrams
- [docs/validation_queries.md](docs/validation_queries.md) — orchestration test scenarios
- [docs/verification_guide.md](docs/verification_guide.md) — step-by-step verification


