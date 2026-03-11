# ChatBot

> A plan-orchestrated, bilingual chatbot that decomposes user queries into multi-step tool chains — powered by local and cloud LLMs.

## 🚀 Overview

ChatBot turns natural language into structured execution plans. A planner analyzes every message, selects the right tools, resolves inter-step dependencies, and synthesizes a single coherent answer — all in Hebrew or English.

## 🧠 Core Concepts

- **Planner** - Converts user input into a JSON execution plan (1–5 tool calls with dependency placeholders)
- **Executor** - Runs tools sequentially, replacing `<result_from_tool_N>` placeholders between steps
- **Synthesis** - Merges multi-tool results into one answer via OpenAI
- **RAG** - Product queries are grounded in real documents via ChromaDB semantic search
- **Hybrid LLM** - Ollama handles general chat locally (free); OpenAI handles planning, RAG, analysis, and synthesis

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
- 🌍 **Bilingual** - auto-detects and responds in Hebrew or English
- 🏠 **Local-first** - Ollama for free inference, OpenAI only where needed

## 📊 ביצועים ועלויות (Performance & Cost)

Benchmarks measured on a local development environment. Latency is the average across multiple runs. Quality is rated 1–5 based on output accuracy and relevance.

| רכיב המערכת / תרחיש        | מודל (ספק)                   | זמן תגובה ממוצע (ms) | איכות / דיוק (1‑5) | עלות משוערת |
| --------------------------- | ---------------------------- | -------------------- | ------------------- | ----------- |
| Router (סיווג & תכנון)      | Ollama (Llama3)              | 4572ms                 | 5                   | 0           |
| Router (סיווג & תכנון)      | OpenAI GPT-3.5 (Fallback)    | 5961ms                 | 5                   | $0.05           |
| General Chat                | Ollama (Llama3)              | 1299ms                 | 4.7                   | 0           |
| Review Sentiment (Basic)    | Hugging Face (Python)        | 2334ms                    | 4.5                 | 0           |
| Review Analysis (Full)      | OpenAI GPT-3.5               | 12234ms                    | 5                   | $0.12           |
| RAG Retrieval (KB Search)   | Hugging Face (Python)        | 392ms                  | 4.8                   | 0           |
| RAG Generation (Answer)     | OpenAI GPT-3.5               | 1543ms                 | 5                   | $0.07           |
| Orchestration Synthesis     | OpenAI GPT-3.5               | 1468ms                 | 4.5                   | $0.06           |

**Key takeaways:**

- Fastest: RAG Retrieval (392 ms) · Slowest: Router/Planner (~4500–6000 ms)
- Ollama ~25% faster than OpenAI fallback for planning (4572 vs 5961 ms)
- All local components (Ollama, Hugging Face, ChromaDB): zero API cost
- OpenAI components consistently score 5/5 on quality at ~1500 ms
- See [Analysis & Conclusions](#3-analysis--conclusions-extended) for architectural analysis of these results

<details>
<summary>Notes: latency data mappings</summary>

| Latency source name   | Mapped to table row         |
| --------------------- | --------------------------- |
| Router (Ollama)       | Router (סיווג & תכנון) - Ollama |
| Router (OpenAI)       | Router (סיווג & תכנון) - OpenAI |
| Planner (Ollama)      | Same as Router (Ollama); in the current architecture the planner serves as the router |
| Kb search             | RAG Retrieval (KB Search)   |
| RAG generation        | RAG Generation (Answer)     |
| General Chat          | General Chat                |
| Orchestration synthesis | Orchestration Synthesis   |

Review Sentiment (Basic) and Review Analysis (Full) had no latency data provided - marked as "—".

</details>

## 3. Analysis & Conclusions (Extended)

An in-depth look at the architectural decisions, their consequences, and the trade-offs in this system. The analysis is grounded in the benchmark data above and the actual codebase.

---

### 🧠 Model Selection: Local vs Cloud

Each component uses the model that best fits its accuracy requirements, latency budget, and cost constraints:

**Router/Planner — Ollama (primary) → OpenAI (fallback):**
The planner produces a small JSON plan (~100–150 output tokens). We try Ollama first because it's faster (~4572ms vs ~5961ms) and free. The catch: Ollama doesn't always return valid JSON, so we automatically fall back to OpenAI when parsing fails. This saves API costs on roughly 60–70% of requests (when Ollama succeeds) while keeping reliability through the fallback. In `planner.service.ts`: Ollama is called with `timeoutMs: 30000`; if it fails or returns unparseable output, we switch to `gpt-4.1`.

**General Chat — Ollama (primary) → OpenAI (fallback):**
Free-form conversation generates longer responses (~100–300 tokens). Routing every message through OpenAI would get expensive fast, so Ollama serves as the primary model (1299ms, $0). In `general-chat.service.ts`, there's a language-retry mechanism: if the response comes back in the wrong language, a second call is made with an explicit language instruction. If Ollama fails entirely (timeout/network), we fall back to OpenAI with `maxTokens: 300`.

**RAG Retrieval — sentence-transformers + ChromaDB (fully local):**
The fastest component in the system (392ms). Embedding generation is a compute task, not a generative one — the local model (`all-MiniLM-L6-v2`) handles it perfectly. ChromaDB stores vectors locally, so there's no external network call. This is the one place where running locally has zero trade-offs: no quality loss, no cost, minimal latency.

**RAG Generation — OpenAI only:**
Generating grounded answers demands high accuracy — the model must answer strictly from the retrieved chunks and never fabricate facts. `gpt-4.1` at `temperature: 0.3` provides strong instruction-following. Local models don't meet the bar for RAG grounding; the hallucination risk is too high.

**Review Analysis — DistilBERT (basic) + OpenAI (full):**
Basic sentiment (positive/negative) runs locally via DistilBERT in Python — fast and free. Full Aspect-Based Sentiment Analysis (ABSA) requires understanding aspects, opinions, and their relationships, plus a self-correction loop to fix malformed JSON output. That's too complex for a local model.

**Synthesis — OpenAI only:**
Merging results from multiple tools into a single coherent answer (1468ms). This requires strong instruction-following and factual consistency. `gpt-4.1` at `temperature: 0.5` allows some phrasing flexibility while preserving accuracy. If OpenAI fails, we fall back to concatenating the raw tool results — coherence is lost, but the information is preserved.

---

### ⚙️ Microservices Architecture Impact

The system is split into three services: TypeScript server (orchestration), Python service (AI/ML), and Ollama (local LLM). Here's how that split plays out:

**📈 Performance:**
HTTP calls between TypeScript and Python add ~50–100ms of overhead per request (`/search_kb`, `/analyze`). But the separation lets us run heavy ML models (PyTorch, transformers) in a Python environment tuned for that workload, while orchestration runs on TypeScript/Bun, which is significantly faster for I/O and coordination. ChromaDB runs in-process with Python, so vector search doesn't require an additional network hop.

**💰 Cost:**
The Python service runs locally — embeddings and sentiment analysis are free. Only RAG generation, synthesis, and full review analysis hit the paid OpenAI API. The planner tries Ollama first, so OpenAI is only called as a fallback. A typical general chat request costs $0 (Ollama only). A full multi-tool query runs ~$0.02–0.03 (planner + tools + synthesis).

**🔄 Flexibility:**
Each tool is self-contained — adding a new one requires a schema update, a handler, and a service implementation. The Python service can be swapped out without touching the TypeScript orchestration layer. Each tool manages its own error handling and fallback logic independently.

**📐 Scalability:**
The Python service is stateful (models loaded in memory) but can be horizontally replicated. The TypeScript server is mostly stateless (except for `history.json`). ChromaDB is embedded — a production deployment would need a managed vector DB (Pinecone/Qdrant/Weaviate). User conversations don't share state (beyond the same `conversationId`).

**🛡️ Failure Isolation:**
If the Python service goes down, the TypeScript server keeps working — weather, exchange, math, and general chat still function. If Ollama is unavailable, the planner and general chat fall back to OpenAI. If a tool fails mid-plan, the executor handles it gracefully (falls back to `generalChat` or concatenates whatever succeeded). For synthesis: if OpenAI fails, results are concatenated as a fallback — less coherent, but no data is lost.

---

### ⚖️ Trade-offs & Challenges

**Scheduling:**
The executor runs tools sequentially because placeholder resolution (`<result_from_tool_1>`) requires results from previous steps. Dependent tools can't be parallelized by definition. Independent tools (e.g., weather + exchange) could theoretically run concurrently, but the current executor doesn't support that. The result: total latency for a multi-tool query equals the sum of all individual tool latencies.

**Reliability:**
The system uses cascading fallbacks: Ollama → OpenAI for the planner and general chat. But each fallback adds latency and cost. If the planner fails entirely, there's no plan — the system drops straight to `generalChat`, losing multi-tool capability. If synthesis fails, results are concatenated instead of merged. There's no automatic retry — a tool failure is final at the individual tool level.

**Inter-service communication:**
TypeScript ↔ Python communication is plain HTTP — no message queue, no retry. `/search_kb` and `/analyze` are single points of failure. There's no circuit breaker or health-check polling from the TypeScript side. If Python stops responding, the request times out and the user sees an error.

**Inter-model communication:**
The planner outputs JSON that must be parseable by the executor. If Ollama produces malformed JSON, parsing fails and we fall back to OpenAI. Placeholder resolution relies on string replacement, which is fragile if a tool's output happens to contain placeholder-like strings. Zod schema validation (`plan.schema.ts`) ensures the plan is structurally valid, but doesn't catch semantic errors.

**Latency vs Quality:**

| Component | Local (Ollama/HF) | Cloud (OpenAI) | Trade-off |
|-----------|-------------------|----------------|-----------|
| Planner | 4572ms, accuracy — | 5961ms, accuracy 5/5 | Speed vs reliability |
| General Chat | 1299ms, $0 | ~1500ms, $ | Cost vs language quality |
| RAG Generation | — | 1543ms, 5/5 | No alternative — accuracy is mandatory |

**Cost vs Accuracy:**
- General chat via Ollama: $0 per request, but risk of mixed-language responses
- Planner via Ollama: $0 when it succeeds (~60–70%), ~$0.007 on fallback
- Full multi-tool query: ~$0.02–0.03 (planner + tools + synthesis)
- General chat only: $0 if Ollama succeeds, ~$0.005 on fallback

---

### 🚀 Future Improvements

| # | Improvement | Description | Expected Impact |
|---|-------------|-------------|-----------------|
| 1 | **Caching** | Cache planner results for similar queries; cache RAG chunks for repeated product lookups | Reduce latency and API calls by 30–50% |
| 2 | **Parallel execution** | Run independent tools concurrently (weather ∥ exchange) inside the executor | Cut multi-tool query latency |
| 3 | **Smart model routing** | Lightweight classifier (regex/heuristic) to detect single-tool queries and skip the planner | Save ~5000ms and $0.007 on simple requests |
| 4 | **Fine-tuning** | Train a small local model on planner JSON examples | Replace the OpenAI fallback, reduce cost |
| 5 | **Circuit breaker** | Add circuit breaker + retry with exponential backoff for Python service calls | Improve reliability during transient failures |
| 6 | **gRPC** | Replace HTTP with gRPC for TypeScript ↔ Python communication | Reduce per-call overhead by ~30–50ms |
| 7 | **Managed vector DB** | Migrate from embedded ChromaDB to Pinecone/Qdrant/Weaviate | Production-grade scalability and persistence |
| 8 | **Redis** | Replace `history.json` with Redis for conversation management | Scalability and data loss prevention |
| 9 | **Score threshold** | Filter out low-similarity chunks before sending to RAG generation | Reduce noise and improve RAG answer accuracy |
| 10 | **Query expansion** | Use an LLM to rephrase/expand the KB query before retrieval | Improve retrieval recall |

---

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
