# ChatBot Verification Guide

Step-by-step verification against the grading rubric. Commands are for Windows (PowerShell/CMD); Linux equivalents are in the Appendix.

---

## A. Repo Audit Snapshot

Key files (as of inspection):

| Path | Purpose |
|------|---------|
| `packages/server/prompts.ts` | All prompts (ROUTER_PROMPT, ROUTER_SYSTEM_PROMPT, RAG_GENERATION_PROMPT, ORCHESTRATION_SYNTHESIS_PROMPT) |
| `packages/server/services/chat.service.ts` | sendMessage → planPlanner / routeMessage |
| `packages/server/services/planner.service.ts` | planPlanner(userInput) → RouterPlan |
| `packages/server/services/plan-executor.service.ts` | executePlan, tool dispatch, synthesis |
| `packages/server/services/router.service.ts` | Single-intent routing |
| `packages/server/services/product-info.service.ts` | getProductInformation, searchKB, RAG |
| `python-service/server.py` | /analyze, /search_kb |
| `python-service/index_kb.py` | KB indexing (load, chunk, embed, ChromaDB) |
| `python-service/kb_service.py` | ChromaDB + sentence-transformers |
| `data/products/*.txt` | Product docs |
| `sample_logs/*.txt` | Orchestration logs |
| `docs/architecture.md`, `docs/repo_map.md` | Architecture docs |

**Environment:** `.env` must be in `packages/server/`. Loaded via `dotenv.config({ path: path.join(import.meta.dir, '.env') })` in `packages/server/index.ts`.

---

## B. Prerequisites

### 1. Python (use 3.12)

```powershell
py -3.12 --version
```

Expect: `Python 3.12.x`. PyTorch does not fully support 3.13 yet.

### 2. Create and activate venv (Windows, in python service)

```powershell
cd python-service
py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```


### 3. Environment variables

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

### 4. Index KB (in service )

```powershell
cd python-service
python index_kb.py --rebuild
```

Expect: logs showing chunks indexed.

### 5. Bun install

```powershell
bun --version
bun install
```

From root: `bun run build` (in packages/server) to verify TypeScript compiles.

### 6. Start services (two terminals)

**Terminal 1 — Python service:**
```powershell
cd python-service
.\.venv\Scripts\activate
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```
Expect: "Uvicorn running on http://0.0.0.0:8000", "KB service initialized successfully".

**Terminal 2 — TypeScript server + client:**
```powershell
bun run dev
```
Expect: server on port 3000, client on Vite port.

Verify Python service: `Invoke-RestMethod -Uri http://localhost:8000/health -Method Get`

---

## C. Verification Steps by Rubric Item

### 1. Router & Planning

**Goal:** Detect complex intents, return valid plan JSON, detect getProductInformation.

**Setup:** `USE_PLAN=true` in `packages/server/.env`, or set before run. Start Python service + TS server.

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
- Product query: `intent: getProductInformation` in logs (single-intent) or planner returns getProductInformation tool
- HE query: response in Hebrew

**Pass/Fail:**
- [ ] Plan JSON has `plan` (array) and `final_answer_synthesis_required` (boolean)
- [ ] getProductInformation intent detected for product queries
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
cd python-service
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
- [ ] Indexer loads from `data/products` (or DATA_DIR)
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
- [ ] RAG_GENERATION_PROMPT receives chunks
- [ ] Answer is grounded (reflects product docs)
- [ ] HE query yields Hebrew response

---

### 5. Knowledge Base Data

**Goal:** `data/products` exists with 3–5 rich .txt docs.

**Commands:**
```powershell
Get-ChildItem data\products\*.txt
```

Expect: 3–5 files (e.g. laptop_pro_x1.txt, smart_watch_s5.txt, wireless_headphones_z3.txt).

**Content:** Each file should have specs, price, features suitable for demo queries. At least one with minimal Hebrew.

**Pass/Fail:**
- [ ] 3–5 .txt files
- [ ] Rich content (specs, price, features)
- [ ] At least one file with Hebrew

---

### 6. Prompt Engineering

**Goal:** ROUTER_PROMPT / ROUTER_SYSTEM_PROMPT include few-shot planning; SYNTHESIS_PROMPT has merge instructions; prompts in prompts.ts.

**Check files:**
```powershell
Select-String -Path "packages\server\prompts.ts" -Pattern "ROUTER_SYSTEM_PROMPT|ORCHESTRATION_SYNTHESIS_PROMPT|RAG_GENERATION"
```

**Inspect prompts.ts:**
- ROUTER_SYSTEM_PROMPT: few-shot examples (weather+exchange, review+product, exchange+product+math)
- ORCHESTRATION_SYNTHESIS_PROMPT: "Merge", "Preserve key facts", "Do not contradict"
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

**Check:** `packages/server/README.md` sections:
- "Performance Benchmarks" with table (Router, Planner, KB Search, RAG Generation, Synthesis, etc.)
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
- `sample_logs/multi_tool_weather_exchange.txt`
- `sample_logs/multi_tool_review_product.txt`
- `sample_logs/multi_tool_exchange_product_math.txt`

**Each file should contain:**
1. Plan JSON (`{ plan: [...], final_answer_synthesis_required }`)
2. Intermediate tool results
3. Final synthesized answer

**To regenerate:** Run server with `USE_PLAN=true`, send each canonical query via chat, capture console output.

**Pass/Fail:**
- [ ] All 3 log files exist
- [ ] Each has plan, intermediate results, final answer

---

### 10. README

**Goal:** Clear install/run; Python deps; Ollama; folder structure.

**Check:** Root `README.md` and `packages/server/README.md`:
- Step-by-step install
- Python venv creation (`py -3.12 -m venv .venv`)
- pip install -r requirements.txt
- Ollama setup
- Folder structure (packages/server, packages/client, python-service, data/products, sample_logs, docs)
- .env location: `packages/server/`

**Pass/Fail:**
- [ ] Install/run instructions complete
- [ ] Python deps + Ollama documented
- [ ] Folder structure matches repo

---

## D. Canonical Demo Queries

### 3 Orchestration Scenarios (USE_PLAN=true)

| # | EN | HE |
|---|----|-----|
| 1 | What's the weather in Berlin and the GBP to ILS exchange rate? | מה מזג האוויר בברלין ומשקל הלירה בשקלים? |
| 2 | Analyze this review about the Smart Watch S5: "Great battery but band uncomfortable." What are its specs? | תנתח את הביקורת על Smart Watch S5: "סוללה מעולה אבל הרצועה לא נוחה." מהם המפרטים? |
| 3 | Laptop Pro X1 costs how much in USD? Convert that to shekels and add 50. | כמה עולה Laptop Pro X1 בדולרים? המר לשקלים והוסף 50. |

### 2 RAG-Only Scenarios (single-intent)

| # | EN | HE |
|---|----|-----|
| 4 | What's the battery life of the Laptop Pro X1? | מה זמן הסוללה של Laptop Pro X1? |
| 5 | What are the specs of the Wireless Headphones Z3? | מהם המפרטים של Wireless Headphones Z3? |

---

## E. Troubleshooting

### Ollama insufficient RAM / OpenAI-only mode

1. Leave Ollama uninstalled or stopped.
2. Server falls back to OpenAI for router and planner.
3. Set `OPENAI_API_KEY` in `packages/server/.env`.
4. Set `USE_PLAN=true` for orchestration.
5. Validation: Same demo queries; expect `[benchmark] router-openai` and `[benchmark] router-planner-openai` in logs instead of Ollama.

### Python dependency issues

**"cannot import name 'Tensor' from 'torch'":** Usually Python 3.13. Recreate venv with 3.12:
```powershell
cd python-service
Remove-Item -Recurse -Force .venv
py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

**chromadb / sentence-transformers install fails:** Ensure Python 3.12; try `pip install --upgrade pip` first.

### /search_kb contract mismatch

Response must be `{ chunks: [ { text, metadata: { source, chunk_index }, score } ] }`. Check `python-service/server.py` maps kb_service output to this shape. TypeScript client in `packages/server/llm/python-kb-client.ts` expects this.

### USE_PLAN env mismatch

- Plan orchestration OFF by default.
- Set `USE_PLAN=true` in `packages/server/.env` to enable.
- Do not use `USE_PLAN_ROUTING`; only `USE_PLAN` is read.

---

## F. Appendix: Linux Equivalents

| Windows | Linux |
|---------|-------|
| `py -3.12 -m venv .venv` | `python3.12 -m venv .venv` |
| `.\.venv\Scripts\activate` | `source .venv/bin/activate` |
| `Get-ChildItem data\products\*.txt` | `ls data/products/*.txt` |
| `[guid]::NewGuid()` | `uuidgen` or `cat /proc/sys/kernel/random/uuid` |

For curl chat test (Linux):
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"What's the weather in Berlin?\",\"conversationId\":\"$(uuidgen)\"}"
```
