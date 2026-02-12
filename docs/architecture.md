# ChatBot Architecture

## High-Level Flow

```
User → API (POST /api/chat) → Chat Controller → Chat Service
  → Planner (USE_PLAN=true) | Router (single-intent)
  → Plan Executor (multi-tool) | Single-Intent Handler
  → Tools (Weather, Exchange, Math, Review, ProductInfo, GeneralChat)
  → Synthesis (multi-tool) | Direct response
  → Response
```

## Microservice Separation

- **Python service:** AI/ML — sentiment (transformers), embeddings (sentence-transformers), ChromaDB. No orchestration logic.
- **TypeScript server:** Orchestration, routing, tools, API, RAG prompt injection. No embedding/ChromaDB logic.

## RAG Pipeline

1. Query → getProductInformation(productName, query, userInput)
2. buildKBQuery → searchKB(query, topK) [HTTP to Python /search_kb]
3. Python: ChromaDB semantic search → chunks
4. Format chunks → RAG_GENERATION_PROMPT with {chunks}, {original_user_question}, {query_token}, {target_language}
5. OpenAI → grounded answer

## Plan Flow

1. planPlanner(userInput) → ROUTER_SYSTEM_PROMPT → JSON `{ plan, final_answer_synthesis_required }`
2. executePlan: for each tool in plan, resolve placeholders, execute, store result
3. If final_answer_synthesis_required: synthesizeAnswer(toolResults) → ORCHESTRATION_SYNTHESIS_PROMPT
4. Return final message

## Key Deliverables

| File | Purpose |
|------|---------|
| packages/server/index.ts | Entry point, bootstrap only |
| packages/server/prompts.ts | All prompts |
| python-service/server.py | /analyze, /search_kb |
| python-service/index_kb.py | KB indexing |
| data/products/ | Product documents |
| sample_logs/ | Execution logs |
