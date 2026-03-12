# ToolWeaver
### 🧠 Planner-Orchestrated Bilingual Chatbot

A plan-driven chatbot that converts natural-language queries into **multi-step tool workflows** and answers in **Hebrew or English** using a hybrid **local-first + cloud-fallback** LLM architecture.

ToolWeaver is designed to go beyond a single prompt/response chatbot. Instead of directly calling one model and hoping it handles everything, it:

- 🧭 generates a structured execution plan
- 🔗 resolves dependencies between tool calls
- ⚙️ executes tools step by step
- 🧩 synthesizes one coherent final answer
- 📚 grounds product answers through RAG over real documents
- 🌍 works end-to-end in both Hebrew and English

---

## 🚀 Why this project exists

Most chatbot projects are thin wrappers around a single LLM call.

ToolWeaver explores a more structured approach: treat user queries as **execution problems**, not just prompts.

Instead of relying on one model to answer everything directly, the system separates the problem into stages:

1. **Planning** — decide which tools are needed
2. **Execution** — run those tools in dependency-aware order
3. **Synthesis** — combine results into one final answer

This makes the system more:

- 🧠 **interpretable** — the reasoning path is explicit
- 🔧 **extensible** — new tools can be added without redesigning the app
- 💸 **cost-aware** — local models handle cheap/common tasks first
- 📐 **architecturally interesting** — orchestration and ML workloads are clearly separated

---

## ✨ Core capabilities

- 🧭 **Planner-driven orchestration** — converts each message into a structured JSON tool plan
- 🔗 **Dependency-aware execution** — supports placeholders such as `<result_from_tool_1>` between steps
- 🌍 **Bilingual flow** — auto-detects Hebrew or English and responds in the same language
- 📚 **Document-grounded RAG** — product queries are answered from indexed documents via ChromaDB retrieval
- 🏠 **Local-first inference** — Ollama handles general chat locally when possible
- ☁️ **Cloud fallback** — OpenAI handles planning, grounded generation, synthesis, and fallback reliability
- 🧪 **Review analysis pipeline** — supports sentiment and aspect-level review analysis
- 🧱 **Microservice split** — Bun/TypeScript for orchestration, Python for ML/NLP workloads

---

## 🏗 Architecture at a glance

```text
User → POST /api/chat → Planner → JSON plan
                    → Executor → Tool₁ → Tool₂ → ... → ToolN
                    → Synthesis → Final response
```

### 📦 Stack overview

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | Bun, Express 5, TypeScript, Zod |
| AI / ML | Python (FastAPI), ChromaDB, sentence-transformers, DistilBERT |
| LLM | Ollama (local) + OpenAI (cloud) |

### 🧩 Main architectural pieces

- **Planner** — converts user input into a JSON execution plan with 1–5 tool calls
- **Executor** — runs tools sequentially and resolves placeholders between steps
- **Synthesis** — merges multi-tool outputs into one coherent response
- **RAG pipeline** — retrieves product knowledge from local indexed documents
- **Hybrid model router** — uses Ollama first where possible and falls back to OpenAI when needed

---

## 🔥 What makes this project interesting

This is not just a chatbot UI over an LLM API.

The project is interesting because it combines several engineering ideas in one system:

- 🧠 **Explicit planning** instead of implicit “single-shot” reasoning
- 🔗 **Multi-step tool chaining** with inter-step dependency resolution
- 🌍 **End-to-end bilingual behavior** across planning, execution, and answer generation
- 🏠☁️ **Hybrid local/cloud inference strategy** to balance cost, latency, and quality
- 📚 **Grounded RAG answers** for product information instead of free-form hallucinated responses
- 🧱 **Service separation** between orchestration logic and Python-based ML workloads

---

## 🛠 Supported tools

| Tool | Purpose | Source / Notes |
|---|---|---|
| `getWeather` | Weather lookup | Open-Meteo API |
| `getExchangeRate` | Currency rate lookup | Hardcoded rates |
| `calculateMath` | Safe math evaluation | Parser-based, no `eval` |
| `analyzeReview` | Review analysis / ABSA | OpenAI-based analysis |
| `getProductInformation` | Product Q&A over docs | Python retrieval + OpenAI RAG |
| `generalChat` | Free-form chat | Ollama primary → OpenAI fallback |

---

## 🌍 Example use cases

- `מה מזג האוויר בלונדון ומה שער GBP ל-ILS?`
- `Tell me about the Smart Watch S5.`
- `נתח לי את הביקורת הזאת ותזהה אספקטים חיוביים ושליליים`
- `What is 15% of 240, and should I take a coat to Paris tomorrow?`

---

## 🧪 Example query flow

For a user query like:

```text
What's the weather in London and the GBP to ILS rate?
```

The system may execute a flow like this:

1. 🧭 The planner receives the prompt and generates a JSON execution plan
2. ⚙️ The executor calls `getWeather`
3. ⚙️ The executor calls `getExchangeRate`
4. 🧩 The synthesis layer combines both results into one final answer
5. 🌍 The answer is returned in the user’s language

For more complex workflows, later steps can reference previous tool outputs using placeholders such as:

```text
<result_from_tool_1>
```

That allows the executor to pass structured results from one step into the next.

---

## 🧠 Engineering highlights

- ✅ JSON plan validation using **Zod**
- 🔁 Cascading fallback strategy: **Ollama → OpenAI**
- 🔗 Placeholder-based dependency resolution between tools
- 📚 Local vector retrieval using **ChromaDB** + `sentence-transformers`
- 🧱 Clean split between **TypeScript orchestration** and **Python ML services**
- 🌍 Language-aware behavior for both Hebrew and English
- 🛡 Safe math execution via parser rather than `eval`

---

## ⚖️ Key tradeoffs

### Sequential execution vs speed
The executor currently runs tool calls sequentially. This keeps dependency handling simple and predictable, but increases total latency for multi-step workflows.

### Local inference vs reliability
Ollama reduces cost and supports local-first execution, but it is less reliable for structured JSON generation. That is why planning and general chat include OpenAI fallback behavior.

### Python service split vs operational simplicity
Separating ML/NLP logic into Python makes model integration cleaner, but adds inter-service communication overhead and a larger failure surface.

### Embedded vector store vs production readiness
ChromaDB is convenient for local development and demos, but a production system would likely need a managed vector database.

---

## 📊 Performance and cost summary

The full benchmark and architectural analysis are better treated as supporting documentation rather than the core README.

### High-level takeaways

- ⚡ **Fastest component:** local RAG retrieval
- 🐢 **Slowest component:** planner / routing stage
- 💸 **Cheapest path:** Ollama-only general chat
- 🎯 **Most accurate path:** OpenAI-based RAG generation and synthesis
- 🏠 **Best local wins:** retrieval and basic sentiment tasks
- ☁️ **Best cloud use cases:** planning reliability, grounded generation, and final synthesis

Detailed latency, cost, and architecture analysis can live in a separate document such as:

```text
docs/benchmarking-and-analysis.md
```

---

## 🛡 Failure handling

ToolWeaver is designed with practical fallback behavior rather than assuming every component always succeeds.

### Current failure isolation behavior

- If **Ollama** fails, planning/chat can fall back to **OpenAI**
- If the **Python service** is unavailable, chat/weather/math may still work
- If **synthesis** fails, raw tool results can still be concatenated
- If a specific tool fails mid-plan, the system degrades rather than fully crashing when possible

This is not full production-grade resilience yet, but it demonstrates deliberate fault-aware design.

---

## 🚀 Future improvements

| # | Improvement | Why it matters |
|---|---|---|
| 1 | Caching | Reduce repeated planner and RAG costs |
| 2 | Parallel execution | Run independent tools concurrently |
| 3 | Smart routing | Skip planner for obvious single-tool queries |
| 4 | Planner fine-tuning | Improve local planner reliability |
| 5 | Circuit breaker + retry | Improve Python service reliability |
| 6 | gRPC | Reduce TypeScript ↔ Python overhead |
| 7 | Managed vector DB | Improve persistence and scalability |
| 8 | Redis conversation store | Replace `history.json` for safer state handling |
| 9 | Similarity thresholding | Improve retrieval precision |
| 10 | Query expansion | Improve recall for KB search |

---

## ⚙️ How to run

### Prerequisites

- **Bun**
- **Python 3.10–3.12** with `pip`
- **OpenAI API key**
- **Ollama** (optional but recommended)

To use Ollama locally:

```bash
ollama pull llama3.2
```

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

Create `apps/server/.env`:

```env
OPENAI_API_KEY=sk-your-key-here
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
PY_SERVICE_URL=http://localhost:8000
DEFAULT_LOCALE=auto
PORT=3000
```

### 3. Set up the Python service

```bash
cd services/python
py -3.12 -m venv .venv
```

**Windows**

```bash
.venv\Scripts\activate
```

**macOS / Linux**

```bash
source .venv/bin/activate
```

Then install dependencies:

```bash
pip install -r requirements.txt
```

### 4. Index the knowledge base (first time only)

```bash
cd services/python
python index_kb.py --rebuild
```

### 5. Start the services

**Terminal 1 — Python microservice**

```bash
cd services/python
.venv\Scripts\activate   # Windows
uvicorn server:app --host 0.0.0.0 --port 8000
```

**Terminal 2 — backend + frontend**

```bash
bun run dev
```

Client runs on:

```text
http://localhost:5173
```

---

## 📡 API

### `POST /api/chat`

Request:

```json
{ "prompt": "What's the weather in London and the GBP to ILS rate?", "conversationId": "uuid-v4" }
```

Response:

```json
{ "message": "London: 12°C, Partly cloudy. The GBP to ILS rate is 4.7000." }
```

### Request rules

- `prompt`: required, 1–1000 characters
- `conversationId`: required, UUID v4
- using `/reset` as the prompt clears conversation history

### Python service endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/analyze` | POST | Sentiment / review analysis |
| `/search_kb` | POST | Semantic search over product docs |
| `/health` | GET | Health check |

---

## 📂 Project structure

```text
apps/server/          TypeScript backend — orchestration, tools, LLM clients
apps/client/          React chat UI (Vite + Tailwind)
services/python/      Python microservice — sentiment analysis, KB search
data/products/        Product documents for RAG
docs/                 Architecture, validation queries, verification guide
examples/sample_logs/ Multi-tool execution log examples
scripts/dev.ts        Dev runner for server + client
```

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| Ollama not available | Install Ollama or rely on OpenAI fallback |
| Ollama timeout | Increase timeout or use a smaller model |
| KB service initialization failed | Run `python index_kb.py --rebuild` |
| Product queries return empty | Make sure the Python service is running on port 8000 |
| Mixed-language output | Use a stronger multilingual model or rely on fallback |

---

## 🛠 Development

```bash
bun run format
cd apps/server && bun run build
cd apps/client && bun run lint
```

---

## ✅ What this project demonstrates

ToolWeaver demonstrates more than a chat interface.

It shows how to build a **planner-driven AI system** with:

- 🧭 structured tool orchestration
- 🔗 dependency-aware multi-step execution
- 🌍 bilingual UX
- 🏠☁️ hybrid local/cloud model routing
- 📚 grounded RAG over local documents
- 🧱 service separation across TypeScript and Python
- ⚖️ explicit engineering tradeoffs around latency, cost, and reliability

---

## Summary

**ToolWeaver** is a bilingual, plan-orchestrated chatbot that turns user queries into explicit tool workflows rather than single-shot model calls.

Its main value is not just answering questions, but demonstrating how **planning, execution, fallback strategy, RAG grounding, and hybrid model routing** can be combined into a more structured AI application architecture.

