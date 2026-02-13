# 🤖 ChatBot

A multi-intent chatbot that routes user queries to the right tools, uses RAG for product info, and supports Hebrew and English.

## ✨ Key Features

- **🧭 Intent routing** — Weather, exchange rates, math, review analysis, product info, general chat
- **📚 RAG (Retrieval-Augmented Generation)** — Answers product questions from `data/products/` via ChromaDB + OpenAI
- **🔗 Plan orchestration** — Multi-step flows (e.g. "price + convert + add 50") when `USE_PLAN=true`
- **🌐 Bilingual** — Replies in the user's language (Hebrew or English)

## ⚙️ How It Works

1. **User message** → Classified by router (Ollama or OpenAI)
2. **Single intent** → One tool: weather, exchange rate, math, review analysis, product info, or general chat
3. **Product info** → Python service searches ChromaDB, then OpenAI answers from retrieved chunks
4. **Complex query** (with `USE_PLAN=true`) → Planner creates a multi-step plan, tools run in order, results synthesized into one answer

## 🛠️ Tech Stack

| Layer    | Stack                                                           |
| -------- | --------------------------------------------------------------- |
| Frontend | React, Vite                                                     |
| Backend  | Bun, Express, TypeScript                                        |
| AI / ML  | Python (FastAPI), ChromaDB, sentence-transformers, transformers |
| LLM      | Ollama (local) + OpenAI (fallback, RAG, synthesis)              |

## 📋 Prerequisites

- **Ollama** (optional): Local LLM for router/planner. [Install](https://ollama.ai/download), then `ollama pull llama3.2`
- **Python 3.10 / 3.11 / 3.12** with pip (use 3.12 — PyTorch doesn't fully support 3.13)
- **OpenAI API key** (required)

### 🦙 Ollama Setup

1. Install Ollama from https://ollama.ai/download
2. `ollama pull llama3.2` (or set `OLLAMA_MODEL`)
3. Verify: `curl http://localhost:11434/api/tags`

## 🚀 Installation & Run

### 1. Install Dependencies

```bash
# Root (Bun workspaces)
bun install
```

### 2. Environment

Create `apps/server/.env`:

| Variable         | Required | Notes                                            |
| ---------------- | -------- | ------------------------------------------------ |
| `OPENAI_API_KEY` | ✅       | For RAG, synthesis, fallback                     |
| `DATABASE_URL`   | ✅       | Prisma connection                                |
| `PY_SERVICE_URL` | No       | Default `http://localhost:8000`                  |
| `OLLAMA_URL`     | No       | Default `http://localhost:11434`                 |
| `OLLAMA_MODEL`   | No       | Default `llama3.2`                               |
| `USE_PLAN`       | No       | `true` enables plan orchestration (default: off) |
| `DEFAULT_LOCALE` | No       | `he` or `en` override                            |
| `PORT`           | No       | Default `3000`                                   |

### 3. Python Service Dependencies

```bash
cd services/python
py -m venv .venv
.\.venv\Scripts\activate
python -m pip install -U pip setuptools wheel
pip install httpx
pip install --no-cache-dir --only-binary=:all: chromadb
pip install -r requirements.txt
```

### 4. Knowledge Base Indexing
## only in first time / when you change the data
```bash
cd services/python
py index_kb.py --rebuild
```

### 5. Run

```bash
# Terminal 1: Python service
cd services/python
.\.venv\Scripts\activate
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: TypeScript server + client (from repo root)
bun run dev
```

## 📁 Folder Structure

| Path                    | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| `apps/server/`          | TypeScript server, orchestration, tools    |
| `apps/client/`          | Frontend chat UI                           |
| `services/python/`      | Python microservice: sentiment, /search_kb |
| `data/products/`        | Product docs (3–5 .txt files)              |
| `examples/sample_logs/` | Multi-tool execution logs                  |
| `docs/`                 | Architecture, validation, verification     |

📖 See [docs/repo_map.md](docs/repo_map.md) for project navigation.

## 📎 Links

- [Server README](apps/server/README.md) — architecture, tools, benchmarks
- [docs/architecture.md](docs/architecture.md) — flow diagrams
- [docs/validation_queries.md](docs/validation_queries.md) — orchestration test scenarios
- [docs/verification_guide.md](docs/verification_guide.md) — step-by-step verification
