# ChatBot

> A plan-orchestrated, bilingual chatbot that decomposes user queries into multi-step tool chains — powered by local and cloud LLMs.

## 🚀 Overview

ChatBot turns natural language into structured execution plans. A planner analyzes every message, selects the right tools, resolves inter-step dependencies, and synthesizes a single coherent answer — all in Hebrew or English.

## 🧠 Core Concepts

- **Planner** — Converts user input into a JSON execution plan (1–5 tool calls with dependency placeholders)
- **Executor** — Runs tools sequentially, replacing `<result_from_tool_N>` placeholders between steps
- **Synthesis** — Merges multi-tool results into one answer via OpenAI
- **RAG** — Product queries are grounded in real documents via ChromaDB semantic search
- **Hybrid LLM** — Ollama handles general chat locally (free); OpenAI handles planning, RAG, analysis, and synthesis

## 🏗 Architecture

```
User → POST /api/chat → Planner → JSON plan
  → Executor → Tool₁ → Tool₂ → ... → ToolN
  → Synthesis (if multi-tool) → Response
```

| Layer | Stack |
|-------|-------|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | Bun, Express 5, TypeScript, Zod |
| AI / ML | Python (FastAPI), ChromaDB, sentence-transformers, DistilBERT |
| LLM | Ollama (local) + OpenAI gpt-4.1 (cloud) |

## ✨ Key Features

- 🔗 **Multi-step orchestration** with inter-tool dependency resolution
- 📚 **RAG** over product docs via ChromaDB + OpenAI grounded generation
- 🌦 **Weather**, 💱 **exchange rates**, 🧮 **math**, 📝 **review analysis (ABSA)**, 💬 **general chat**
- 🌍 **Bilingual** — auto-detects and responds in Hebrew or English
- 🏠 **Local-first** — Ollama for free inference, OpenAI only where needed

## ⚙️ How to Run

### Prerequisites

- **[Bun](https://bun.sh)** — JS runtime
- **Python 3.10–3.12** with pip
- **OpenAI API key**
- **Ollama** (optional) — `ollama pull llama3.2`

### 1. Install Dependencies

```bash
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

### 4. Index Knowledge Base (first time only)

```bash
cd services/python
python index_kb.py --rebuild
```

### 5. Start

```bash
# Terminal 1: Python microservice
cd services/python
.venv\Scripts\activate          # or: source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000

# Terminal 2: TypeScript server + React client (from repo root)
bun run dev
```

Client: `http://localhost:5173` — proxies `/api` to backend on port 3000.

## 📡 API

### `POST /api/chat`

```json
{ "prompt": "What's the weather in London and the GBP to ILS rate?", "conversationId": "uuid-v4" }
```

```json
{ "message": "London: 12°C, Partly cloudy. The GBP to ILS rate is 4.7000." }
```

- `prompt`: string, 1–1000 chars (required)
- `conversationId`: UUID v4 (required)
- `/reset` as prompt clears conversation history

### Python Service

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/analyze` | POST | Sentiment analysis (DistilBERT) |
| `/search_kb` | POST | Knowledge base semantic search |
| `/health` | GET | Health check |

## 📂 Project Structure

```
apps/server/          TypeScript backend — orchestration, tools, LLM clients
apps/client/          React chat UI (Vite + Tailwind)
services/python/      Python microservice — sentiment analysis, KB search
data/products/        Product documents (3 .txt files) for RAG
docs/                 Architecture, validation queries, verification guide
examples/sample_logs/ Multi-tool execution log examples
scripts/dev.ts        Dev runner (concurrently starts server + client)
```

## 🔧 Tools

| Tool | Source | Dependency |
|------|--------|------------|
| `getWeather` | `weather.service.ts` | Open-Meteo API (free) |
| `getExchangeRate` | `exchange.service.ts` | Hardcoded rates |
| `calculateMath` | `math.service.ts` | Pure parser (no `eval`) |
| `analyzeReview` | `review-analyzer.service.ts` | OpenAI (ABSA) |
| `getProductInformation` | `product-info.service.ts` | Python → OpenAI RAG |
| `generalChat` | `general-chat.service.ts` | Ollama → OpenAI fallback |

## 🐛 Troubleshooting

| Problem | Fix |
|---------|-----|
| `Ollama not available` | Install Ollama + `ollama pull <model>`, or ignore (OpenAI fallback works) |
| Ollama timeout | Increase `timeoutMs` in `general-chat.service.ts`, or use a smaller model |
| `KB service initialization failed` | Run `python index_kb.py --rebuild` in `services/python/` |
| Product queries empty | Start the Python service on port 8000 |
| Mixed-language output | Use a model with better multilingual support, or rely on OpenAI fallback |

## 🛠 Development

```bash
bun run format                        # Format code
cd apps/server && bun run build       # Type check
cd apps/client && bun run lint        # Lint
```

Pre-commit hooks run `lint-staged` via Husky.

## 📎 Links

- [Server README](apps/server/README.md) — architecture, tools, benchmarks
- [Architecture](docs/architecture.md) — flow diagrams
- [Validation Queries](docs/validation_queries.md) — orchestration test scenarios
- [Verification Guide](docs/verification_guide.md) — step-by-step verification
