# ChatBot Verification Guide

Step-by-step verification against the grading rubric. Commands are for Windows (PowerShell/CMD); Linux equivalents are in the Appendix.

---

## A. Repo Audit Snapshot

Key files (as of inspection):

| Path                                            | Purpose                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `apps/server/prompts.ts`                        | All prompts (ROUTER_SYSTEM_PROMPT, RAG_PRODUCT_PROMPT, SYNTHESIS_PROMPT, etc.) |
| `apps/server/services/chat.service.ts`          | sendMessage → planPlanner → executePlan (or generalChat fallback)    |
| `apps/server/services/planner.service.ts`       | planPlanner(userInput) → RouterPlan                                  |
| `apps/server/services/plan-executor.service.ts` | executePlan, tool dispatch, synthesis                                |
| `apps/server/services/product-info.service.ts`  | getProductInformation, searchKB, RAG                                 |
| `services/python/server.py`                     | /analyze, /search_kb, /health                                        |
| `services/python/index_kb.py`                   | KB indexing (load, chunk, embed, ChromaDB)                           |
| `services/python/kb_service.py`                 | ChromaDB + sentence-transformers                                     |
| `data/products/*.txt`                           | Product docs (3 files)                                               |
| `examples/sample_logs/*.txt`                    | Orchestration logs                                                   |
| `docs/architecture.md`, `docs/repo_map.md`      | Architecture docs                                                    |

**Environment:** `.env` must be in `apps/server/`. Loaded via `dotenv.config({ path: path.join(import.meta.dir, '.env') })` in `apps/server/index.ts`.

---

## B. Prerequisites

### 1. Python (use 3.12)

```powershell
py -3.12 --version
```

Expect: `Python 3.12.x`. PyTorch does not fully support 3.13 yet.

### 2. Create and activate venv (Windows, in python service)

```powershell
cd services/python
py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment variables

Create `apps/server/.env`:

| Variable         | Required | Default                  | Description                  |
| ---------------- | -------- | ------------------------ | ---------------------------- |
| `OPENAI_API_KEY` | Yes      | —                        | OpenAI API key               |
| `PY_SERVICE_URL` | No       | `http://localhost:8000`  | Python microservice URL      |
| `OLLAMA_URL`     | No       | `http://localhost:11434` | Ollama server URL            |
| `OLLAMA_MODEL`   | No       | `llama3.2`               | Ollama model name            |
| `DEFAULT_LOCALE` | No       | auto-detect              | Force `he` or `en`           |
| `PORT`           | No       | `3000`                   | Server port                  |

### 4. Index KB

```powershell
cd services/python
python index_kb.py --rebuild
```

Expect: logs showing chunks indexed.

### 5. Bun install

```powershell
bun --version
bun install
```

From root: `bun run build` (in apps/server) to verify TypeScript compiles.

### 6. Start services (two terminals)

**Terminal 1 — Python service:**

```powershell
cd services/python
.\.venv\Scripts\activate
uvicorn server:app --host 0.0.0.0 --port 8000
```

Expect: "Uvicorn running on http://0.0.0.0:8000", "KB service initialized successfully".

**Terminal 2 — TypeScript server + client:**

```powershell
bun run dev
```

Expect: server on port 3000, client on port 5173 (Vite).

Verify Python service: `Invoke-RestMethod -Uri http://localhost:8000/health -Method Get`

---

## C. Verification Steps by Rubric Item

### 1. Planning

**Goal:** Every user message goes through the planner. Detect complex intents, return valid plan JSON, detect getProductInformation.

**Test prompts:**

- EN: `What's the weather in Berlin and the GBP to ILS exchange rate?`
- EN: `What's the battery life of the Laptop Pro X1?`
- HE: `מה זמן הסוללה של Laptop Pro X1?`

**Commands:**

```powershell
$body = @{ prompt = "What's the weather in Berlin and the GBP to ILS exchange rate?"; conversationId = [guid]::NewGuid().ToString() } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3000/api/chat -Method Post -Body $body -ContentType "application/json"
```

**Expected:**

- Complex query: server logs show plan JSON with `plan` array and `final_answer_synthesis_required`
- Product query: planner returns getProductInformation tool in plan
- HE query: response in Hebrew

**Pass/Fail:**

- [ ] Plan JSON has `plan` (array) and `final_answer_synthesis_required` (boolean)
- [ ] getProductInformation detected for product queries
- [ ] Complex multi-tool query produces multi-step plan

---

### 2. Advanced Tool Orchestration

**Goal:** Execute chain in TypeScript, resolve `<result_from_tool_N>`, synthesize final answer.

**Test prompt:** `Laptop Pro X1 costs how much in USD? Convert that to shekels and add 50.`

**Expected in logs:**

- `[executor] step 1/3: getProductInformation`
- `[executor] step 2/3: getExchangeRate`
- `[executor] step 3/3: calculateMath`
- `[executor] resolved params:` shows placeholder replaced with numbers
- `[benchmark] synthesis latency=`
- `[benchmark] total-plan latency=`

**Pass/Fail:**

- [ ] Tools run in order per plan
- [ ] Placeholders resolved (no literal `<result_from_tool_1>` in calculateMath)
- [ ] Final answer is synthesized (single coherent response)

---

### 3. RAG (Python)

**Goal:** Index script loads data, chunks 200–500 words with overlap, uses ChromaDB; /search_kb returns relevant text.

**Check indexer:**

```powershell
cd services/python
python index_kb.py --rebuild
```

Expect: logs show `Loaded: *.txt`, `chunks`, `Embeddings generated`, `Indexing complete`.

**Inspect code:** `index_kb.py` has `CHUNK_SIZE_WORDS = 400`, `CHUNK_OVERLAP_WORDS = 50`, `chunk_text()` splits by words.

**Test /search_kb:**

```powershell
$body = '{"query":"laptop battery","top_k":3}'
Invoke-RestMethod -Uri http://localhost:8000/search_kb -Method Post -Body $body -ContentType "application/json"
```

Expect: `chunks` array; each chunk has `text`, `metadata.source`, `metadata.chunk_index`, `score`. Content should mention battery.

**Pass/Fail:**

- [ ] Indexer loads from `data/products`
- [ ] Chunking uses 200–500 words with overlap
- [ ] ChromaDB used (PersistentClient)
- [ ] /search_kb returns relevant chunks

---

### 4. RAG (TypeScript)

**Goal:** getProductInformation calls Python, injects chunks into RAG prompt, produces grounded answer.

**Test prompts:**

- EN: `What are the specs of the Wireless Headphones Z3?`
- HE: `מהם המפרטים של Wireless Headphones Z3?`

**Expected in logs:**

- `[product-info] product=`
- `[benchmark] kb-search latency=`
- `[benchmark] rag-generation latency=`

**Check code:** `product-info.service.ts` uses `searchKB()`, `RAG_PRODUCT_PROMPT` with `{chunks}`, `{original_user_question}`, `{query_token}`, `{target_language}`.

**Pass/Fail:**

- [ ] getProductInformation triggers searchKB (Python /search_kb)
- [ ] RAG_PRODUCT_PROMPT receives chunks
- [ ] Answer is grounded (reflects product docs)
- [ ] HE query yields Hebrew response

---

### 5. Knowledge Base Data

**Goal:** `data/products` exists with 3 rich .txt docs.

**Commands:**

```powershell
Get-ChildItem data\products\*.txt
```

Expect: 3 files (e.g. laptop_pro_x1.txt, smart_watch_s5.txt, wireless_headphones_z3.txt).

**Content:** Each file should have specs, price, features suitable for demo queries.

**Pass/Fail:**

- [ ] 3 .txt files
- [ ] Rich content (specs, price, features)

---

### 6. Prompt Engineering

**Goal:** ROUTER_SYSTEM_PROMPT includes few-shot planning; SYNTHESIS_PROMPT has merge instructions; prompts in prompts.ts.

**Check files:**

```powershell
Select-String -Path "apps\server\prompts.ts" -Pattern "ROUTER_SYSTEM_PROMPT|SYNTHESIS_PROMPT|RAG_PRODUCT_PROMPT"
```

**Inspect prompts.ts:**

- ROUTER_SYSTEM_PROMPT: few-shot examples (weather+exchange, review+product, exchange+product+math)
- SYNTHESIS_PROMPT: "Merge", "Preserve key facts", "Do not contradict"
- All prompts exported from prompts.ts (no inline strings in services)

**Pass/Fail:**

- [ ] ROUTER_SYSTEM_PROMPT has few-shot plan examples
- [ ] SYNTHESIS_PROMPT has merge instructions
- [ ] Prompts only in prompts.ts

---

### 7. Code Quality & Architecture

**Goal:** Clear microservice split, correct lib usage, documented and error-handled code.

**Check:**

- `docs/architecture.md`: Python = AI/ML; TypeScript = orchestration
- Python: chromadb, sentence-transformers, transformers
- TypeScript: OpenAI SDK, zod
- No orchestration logic in Python (except kb search)
- try/catch in planner, plan-executor, product-info, Python /search_kb

**Pass/Fail:**

- [ ] Microservice separation documented
- [ ] Libs used as intended
- [ ] Error handling present in key paths

---

### 8. Benchmarking

**Goal:** README timing table, local vs cloud comparison, cost/accuracy discussion.

**Check:** `apps/server/README.md` sections:

- "Performance Benchmarks" with table (Planner, KB Search, RAG Generation, Synthesis, etc.)
- "Model Comparison (Ollama vs OpenAI)" table
- Cost/accuracy trade-off text

**Pass/Fail:**

- [ ] Timing table for RAG + orchestration
- [ ] Ollama vs OpenAI comparison
- [ ] Trade-off discussion

---

### 9. Logs (Proof)

**Goal:** 3 complex orchestration scenarios logged with plan JSON, intermediate results, final answer.

**Check files:**

- `examples/sample_logs/multi_tool_weather_exchange.txt`
- `examples/sample_logs/multi_tool_review_product.txt`
- `examples/sample_logs/multi_tool_exchange_product_math.txt`

**Each file should contain:**

1. Plan JSON (`{ plan: [...], final_answer_synthesis_required }`)
2. Intermediate tool results
3. Final synthesized answer

**To regenerate:** Run the server, send each canonical query via chat, capture console output.

**Pass/Fail:**

- [ ] All 3 log files exist
- [ ] Each has plan, intermediate results, final answer

---

### 10. README

**Goal:** Clear install/run; Python deps; Ollama; folder structure.

**Check:** Root `README.md` and `apps/server/README.md`:

- Step-by-step install
- Python venv creation (`py -3.12 -m venv .venv`)
- pip install -r requirements.txt
- Ollama setup
- Folder structure (apps/server, apps/client, services/python, data/products, examples/sample_logs, docs)
- .env location: `apps/server/`

**Pass/Fail:**

- [ ] Install/run instructions complete
- [ ] Python deps + Ollama documented
- [ ] Folder structure matches repo

---

## D. Canonical Demo Queries

### 3 Orchestration Scenarios

| #   | EN                                                                                                        | HE                                                                                |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | What's the weather in Berlin and the GBP to ILS exchange rate?                                            | מה מזג האוויר בברלין ומשקל הלירה בשקלים?                                          |
| 2   | Analyze this review about the Smart Watch S5: "Great battery but band uncomfortable." What are its specs? | תנתח את הביקורת על Smart Watch S5: "סוללה מעולה אבל הרצועה לא נוחה." מהם המפרטים? |
| 3   | Laptop Pro X1 costs how much in USD? Convert that to shekels and add 50.                                  | כמה עולה Laptop Pro X1 בדולרים? המר לשקלים והוסף 50.                              |

### 2 RAG-Only Scenarios (single-tool plan)

| #   | EN                                                | HE                                     |
| --- | ------------------------------------------------- | -------------------------------------- |
| 4   | What's the battery life of the Laptop Pro X1?     | מה זמן הסוללה של Laptop Pro X1?        |
| 5   | What are the specs of the Wireless Headphones Z3? | מהם המפרטים של Wireless Headphones Z3? |

---

## E. Troubleshooting

### Ollama insufficient RAM / OpenAI-only mode

1. Leave Ollama uninstalled or stopped.
2. Server falls back to OpenAI for general chat.
3. Set `OPENAI_API_KEY` in `apps/server/.env`.
4. Validation: Same demo queries; expect `[benchmark] router-planner-openai` in logs instead of Ollama.

### Python dependency issues

**"cannot import name 'Tensor' from 'torch'":** Usually Python 3.13. Recreate venv with 3.12:

```powershell
cd services/python
Remove-Item -Recurse -Force .venv
py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

**chromadb / sentence-transformers install fails:** Ensure Python 3.12; try `pip install --upgrade pip` first.

### /search_kb contract mismatch

Response must be `{ chunks: [ { text, metadata: { source, chunk_index }, score } ] }`. Check `services/python/server.py` maps kb_service output to this shape. TypeScript client in `apps/server/llm/python-kb-client.ts` expects this.

---

## F. Appendix: Linux Equivalents

| Windows                             | Linux                                           |
| ----------------------------------- | ----------------------------------------------- |
| `py -3.12 -m venv .venv`            | `python3.12 -m venv .venv`                      |
| `.\.venv\Scripts\activate`          | `source .venv/bin/activate`                     |
| `Get-ChildItem data\products\*.txt` | `ls data/products/*.txt`                        |
| `[guid]::NewGuid()`                 | `uuidgen` or `cat /proc/sys/kernel/random/uuid` |

For curl chat test (Linux):

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"What's the weather in Berlin?\",\"conversationId\":\"$(uuidgen)\"}"
```
