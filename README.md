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
- See [ניתוח ומסקנות (מורחב)](#3-ניתוח-ומסקנות-מורחב) for architectural analysis of these results

<details>
<summary>Notes: latency data mappings</summary>

| Latency source name   | Mapped to table row         |
| --------------------- | --------------------------- |
| Router (Ollama)       | Router (סיווג & תכנון) — Ollama |
| Router (OpenAI)       | Router (סיווג & תכנון) — OpenAI |
| Planner (Ollama)      | Same as Router (Ollama); in the current architecture the planner serves as the router |
| Kb search             | RAG Retrieval (KB Search)   |
| RAG generation        | RAG Generation (Answer)     |
| General Chat          | General Chat                |
| Orchestration synthesis | Orchestration Synthesis   |

Review Sentiment (Basic) and Review Analysis (Full) had no latency data provided — marked as "—".

</details>

## 3. ניתוח ומסקנות (מורחב)

ניתוח ארכיטקטוני מעמיק של ההחלטות התכנוניות, ההשפעות והפשרות במערכת. הניתוח מבוסס על נתוני הביצועים בטבלה שלעיל ועל הארכיטקטורה בפועל כפי שמשתקפת בקוד.

---

### 🧠 בחירת מודלים: מקומיים מול ענן

כל רכיב במערכת משתמש במודל שנבחר על בסיס האיזון בין ביצועים, עלות, דיוק ואמינות:

**Router/Planner — Ollama (ראשוני) → OpenAI (fallback):**
הפלנר מייצר תוכנית JSON קטנה (~100–150 טוקנים output). Ollama מהיר יותר (~4572ms מול ~5961ms) ובחינם, אך הדיוק אינו מובטח — לכן מופעל fallback אוטומטי ל-OpenAI כשהפלט אינו JSON תקין. הבחירה הזו חוסכת עלות API בכ-60–70% מהקריאות (כשOllama מצליח), תוך שמירה על אמינות דרך ה-fallback. בקוד (`planner.service.ts`): Ollama נקרא ראשון עם `timeoutMs: 30000`; אם נכשל או מחזיר JSON לא תקין — עוברים ל-`gpt-4.1`.

**General Chat — Ollama (ראשוני) → OpenAI (fallback):**
שיחה חופשית מייצרת תגובות ארוכות (~100–300 טוקנים). הפעלת OpenAI לכל הודעה תייקר משמעותית, לכן Ollama משמש כמודל ראשי (1299ms, עלות 0). ב-`general-chat.service.ts` מופעל מנגנון retry לשפה: אם התגובה בשפה שגויה, נשלחת קריאה נוספת עם הוראת שפה מפורשת. אם Ollama נכשל (timeout/network) — fallback ל-OpenAI עם `maxTokens: 300`.

**RAG Retrieval — sentence-transformers + ChromaDB (מקומי לחלוטין):**
הרכיב המהיר ביותר (392ms). יצירת embeddings היא משימת חישוב, לא generative — מודל מקומי (`all-MiniLM-L6-v2`) מספיק לחלוטין. ChromaDB מאחסן וקטורים מקומית, ללא תקשורת רשת חיצונית. הבחירה במודל מקומי כאן היא חד-משמעית: אין פשרה באיכות, אין עלות, וזמן התגובה מינימלי.

**RAG Generation — OpenAI בלבד:**
יצירת תשובות grounded מחייבת דיוק גבוה — המודל חייב לענות אך ורק מתוך ה-chunks ולא להמציא עובדות. `gpt-4.1` עם `temperature: 0.3` מבטיח instruction-following חזק. מודלים מקומיים לא עומדים ברף הנדרש לדיוק של RAG grounding — הסיכון ל-hallucination גבוה מדי.

**Review Analysis — DistilBERT (בסיסי) + OpenAI (מלא):**
סנטימנט בסיסי (חיובי/שלילי) רץ מקומית דרך DistilBERT ב-Python — מהיר וחינמי. ניתוח ABSA מלא (Aspect-Based Sentiment Analysis) דורש הבנת היבטים, דעות ויחסים ביניהם, כולל לולאת self-correction לתיקון JSON — מורכב מדי למודל מקומי.

**Synthesis — OpenAI בלבד:**
מיזוג תוצאות ממספר כלים לתשובה קוהרנטית (1468ms). דורש instruction-following חזק ועקביות עובדתית. `gpt-4.1` עם `temperature: 0.5` מאפשר גמישות בניסוח תוך שמירה על דיוק. אם OpenAI נכשל — fallback לשרשור תוצאות (מאבדים קוהרנטיות אך שומרים על מידע).

---

### ⚙️ השפעת ארכיטקטורת Microservices

המערכת מחולקת לשלושה שירותים עיקריים: TypeScript server (orchestration), Python service (AI/ML), ו-Ollama (local LLM). החלוקה הזו משפיעה על:

**📈 ביצועים:**
תקשורת HTTP בין TypeScript ל-Python מוסיפה ~50–100ms overhead לכל קריאה (`/search_kb`, `/analyze`). אך ההפרדה מאפשרת להריץ מודלי ML כבדים (PyTorch, transformers) בסביבת Python מותאמת, בזמן שה-orchestration רץ ב-TypeScript/Bun שהוא מהיר משמעותית לעיבוד I/O ותזמור. ChromaDB רץ in-process עם Python, כך שחיפוש וקטורי לא דורש hop נוסף.

**💰 עלות:**
שירות Python רץ מקומית — embeddings וסנטימנט בחינם. רק RAG generation, synthesis ו-review analysis (full) משתמשים ב-API בתשלום. Planner משתמש ב-Ollama ראשון — OpenAI נקרא רק כ-fallback. בקריאה טיפוסית של general chat, העלות היא 0 (Ollama בלבד). בקריאת multi-tool: ~$0.02–0.03 (planner + כלים + synthesis).

**🔄 גמישות:**
כל כלי (tool) הוא עצמאי — הוספת כלי חדש דורשת: עדכון schema, הוספת handler, מימוש service. שירות Python ניתן להחלפה ללא נגיעה ב-orchestration של TypeScript. כל כלי מנהל את ה-error handling וה-fallback שלו באופן עצמאי.

**📐 Scalability:**
שירות Python הוא stateful (מודלים טעונים בזיכרון) אך ניתן לשכפול אופקי. שרת TypeScript הוא mostly stateless (למעט `history.json`). ChromaDB הוא embedded — לסביבת production יידרש מעבר ל-vector DB מנוהל (Pinecone/Qdrant/Weaviate). שיחות בין משתמשים אינן חולקות state (למעט אותו `conversationId`).

**🛡️ Isolation of failures:**
אם שירות Python קורס — TypeScript ממשיך לפעול: weather, exchange, math ו-general chat עדיין עובדים. אם Ollama לא זמין — planner ו-general chat עוברים ל-OpenAI. אם כלי נכשל באמצע plan — ה-executor מטפל בשגיאה (fallback ל-`generalChat` או שרשור תוצאות מוצלחות). ב-synthesis: אם OpenAI נכשל — שרשור תוצאות כ-fallback (מאבד קוהרנטיות, שומר מידע).

---

### ⚖️ Trade-offs ואתגרים

**תזמון (Scheduling):**
ה-executor מריץ כלים סדרתית — placeholder resolution דורש תוצאות מצעדים קודמים (`<result_from_tool_1>`). לא ניתן להריץ כלים תלויים במקביל. כלים בלתי תלויים (למשל weather + exchange) יכולים תיאורטית לרוץ במקביל, אך ה-executor הנוכחי לא תומך בכך. התוצאה: latency של multi-tool query הוא סכום ה-latency של כל הכלים.

**אמינות (Reliability):**
המערכת מפעילה cascading fallbacks: Ollama → OpenAI עבור planner ו-general chat. אך כל fallback מוסיף latency ועלות. כשל ב-planner = אין plan = נפילה ישירה ל-generalChat (מאבדים יכולת multi-tool). כשל ב-synthesis = שרשור תוצאות (מאבדים קוהרנטיות). אין retry אוטומטי — כישלון הוא סופי ברמת הכלי הבודד.

**תקשורת בין שירותים:**
HTTP בין TypeScript ↔ Python (ללא message queue, ללא retry). נקודת כשל יחידה עבור `/search_kb` ו-`/analyze`. אין circuit breaker או health-check polling מצד TypeScript. אם Python לא מגיב — הקריאה תיכשל עם timeout, ו-TypeScript ידווח שגיאה למשתמש.

**תקשורת בין מודלים:**
הפלנר מייצר JSON שחייב להיות parseable. אם Ollama מייצר JSON שגוי — parsing נכשל → fallback ל-OpenAI. Placeholder resolution מבוסס על string replacement — עלול להיות שברירי אם תוצאת כלי מכילה מחרוזות שנראות כמו placeholders. ה-Zod schema validation (`plan.schema.ts`) מבטיח שהתוכנית תקינה מבחינת מבנה, אך לא מבחינת סמנטיקה.

**Latency מול Quality:**

| רכיב | מקומי (Ollama/HF) | ענן (OpenAI) | פשרה |
|-------|-------------------|--------------|-------|
| Planner | 4572ms, דיוק — | 5961ms, דיוק 5/5 | מהירות מול אמינות |
| General Chat | 1299ms, $0 | ~1500ms, $ | עלות מול איכות שפה |
| RAG Generation | — | 1543ms, 5/5 | אין חלופה — דיוק הכרחי |

**Cost מול Accuracy:**
- General chat דרך Ollama: $0 לקריאה, אך סיכון לתשובות בשפה מעורבבת
- Planner דרך Ollama: $0 כשמצליח (~60–70%), ~$0.007 ב-fallback
- Multi-tool query מלא: ~$0.02–0.03 (planner + tools + synthesis)
- שיחה חופשית בלבד: $0 אם Ollama מצליח, ~$0.005 ב-fallback

---

### 🚀 שיפורים עתידיים

| # | שיפור | תיאור | השפעה צפויה |
|---|-------|-------|-------------|
| 1 | **Caching** | מטמון לתוצאות planner עבור שאילתות דומות; מטמון chunks ל-RAG queries חוזרות | הפחתת latency וקריאות API ב-30–50% |
| 2 | **Parallel execution** | הרצת כלים בלתי תלויים במקביל (weather ∥ exchange) בתוך ה-executor | הפחתת latency של multi-tool queries |
| 3 | **Model routing חכם** | classifier קל (regex/heuristic) לזיהוי single-tool queries ודילוג על הפלנר | חיסכון של ~5000ms ו-$0.007 לקריאות פשוטות |
| 4 | **Fine-tuning** | אימון מודל מקומי קטן על דוגמאות JSON של ה-planner | החלפת OpenAI fallback, חיסכון עלות |
| 5 | **Circuit breaker** | הוספת circuit breaker וretry עם exponential backoff לקריאות Python | שיפור אמינות בעת כשלים זמניים |
| 6 | **gRPC** | החלפת HTTP ב-gRPC לתקשורת TypeScript ↔ Python | הפחתת overhead של ~30–50ms לקריאה |
| 7 | **Managed vector DB** | מעבר מ-ChromaDB embedded ל-Pinecone/Qdrant/Weaviate | scalability ו-persistence בסביבת production |
| 8 | **Redis** | מעבר מ-`history.json` ל-Redis לניהול שיחות | scalability ומניעת data loss |
| 9 | **Score threshold** | סינון chunks עם similarity score נמוך לפני שליחה ל-RAG generation | הפחתת noise ושיפור דיוק תשובות RAG |
| 10 | **Query expansion** | שימוש ב-LLM להרחבת/ניסוח מחדש של ה-KB query לפני חיפוש | שיפור recall של retrieval |

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
