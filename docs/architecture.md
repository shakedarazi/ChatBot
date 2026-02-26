# ChatBot Architecture

## High-Level Flow

```
User → API (POST /api/chat) → Chat Controller → Chat Service
  → Planner (Ollama → OpenAI fallback) → JSON execution plan
  → Plan Executor (sequential tool execution)
  → Tools (Weather, Exchange, Math, Review, ProductInfo, GeneralChat)
  → Synthesis (multi-tool) | Direct response (single-tool)
  → Response
```

## Microservice Separation

- **Python service:** AI/ML — sentiment (transformers), embeddings (sentence-transformers), ChromaDB. No orchestration logic.
- **TypeScript server:** Orchestration, planning, tools, API, RAG prompt injection. No embedding/ChromaDB logic.

## RAG Pipeline

1. Query → getProductInformation(productName, query, userInput)
2. buildKBQuery → searchKB(query, topK) [HTTP to Python /search_kb]
3. Python: ChromaDB semantic search → chunks
4. Format chunks → RAG_PRODUCT_PROMPT with {chunks}, {original_user_question}, {query_token}, {target_language}
5. OpenAI → grounded answer

## Plan Flow

1. planPlanner(userInput) → ROUTER_SYSTEM_PROMPT → JSON `{ plan, final_answer_synthesis_required }`
2. executePlan: for each tool in plan, resolve placeholders (`<result_from_tool_N>`), execute, store result
3. If final_answer_synthesis_required: synthesizeAnswer(toolResults) → SYNTHESIS_PROMPT
4. If planner fails: fallback to generalChat directly
5. Return final message

## Key Deliverables

| File                        | Purpose                     |
| --------------------------- | --------------------------- |
| apps/server/index.ts        | Entry point, bootstrap only |
| apps/server/prompts.ts      | All prompts                 |
| services/python/server.py   | /analyze, /search_kb        |
| services/python/index_kb.py | KB indexing                 |
| data/products/              | Product documents (3 files) |
| examples/sample_logs/       | Execution logs              |
