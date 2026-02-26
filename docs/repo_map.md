# Repository Map (Project Navigation)

## Folder Structure

| Folder                  | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `apps/server/`          | TypeScript server — orchestration, planning, tools   |
| `apps/client/`          | React chat UI (Vite + Tailwind)                      |
| `services/python/`      | Python microservice — sentiment, KB search           |
| `data/products/`        | Product documents (3 `.txt` files) for RAG           |
| `examples/sample_logs/` | Multi-tool orchestration execution logs              |
| `docs/`                 | Architecture, validation, verification, cost         |
| `scripts/`              | Dev runner (concurrently starts server + client)     |

## Key Files

| File                                            | Purpose                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/server/index.ts`                          | Entry point, mounts routes, initializes Ollama                                   |
| `apps/server/prompts.ts`                        | All prompts (ROUTER_SYSTEM_PROMPT, RAG_PRODUCT_PROMPT, SYNTHESIS_PROMPT, etc.)    |
| `apps/server/routes.ts`                         | Express route definitions (POST /api/chat)                                       |
| `apps/server/services/chat.service.ts`          | sendMessage → planPlanner → executePlan (or generalChat fallback)                |
| `apps/server/services/planner.service.ts`       | planPlanner(userInput) → RouterPlan \| null                                      |
| `apps/server/services/plan-executor.service.ts` | executePlan(plan, userInput, context)                                            |
| `apps/server/llm/python-kb-client.ts`           | searchKB(query, topK) → Python /search_kb                                        |
| `apps/server/llm/ollama-client.ts`              | Ollama HTTP client with health check and warmup                                  |
| `apps/server/llm/client.ts`                     | OpenAI wrapper (gpt-4.1 via Responses API)                                       |

## Tools

Located in `apps/server/services/tools/`:

| Tool handler            | Function               |
| ----------------------- | ---------------------- |
| `weather.tool.ts`       | getWeather             |
| `exchange.tool.ts`      | getExchangeRate        |
| `math.tool.ts`          | calculateMath          |
| `review.tool.ts`        | analyzeReview          |
| `product.tool.ts`       | getProductInformation  |
| `general-chat.tool.ts`  | generalChat            |

Tool handlers are registered in `apps/server/services/tools/utils/index.ts` and invoked by the plan executor.

## Orchestration Flow

1. `chat.service.sendMessage` called
2. Call `planPlanner(prompt)` (Ollama first, OpenAI fallback)
3. If valid plan: `executePlan(plan, prompt, context)`
4. If planner fails (returns null): fallback to `generalChat` directly

## Adding a New Tool

1. Add the tool name to `apps/server/schemas/plan.schema.ts` toolCallSchema enum
2. Implement the service in `apps/server/services/` (e.g. `new-tool.service.ts`)
3. Create a tool handler in `apps/server/services/tools/` (e.g. `new-tool.tool.ts`)
4. Register it in `apps/server/services/tools/utils/index.ts`
5. Add few-shot examples to `ROUTER_SYSTEM_PROMPT` in `apps/server/prompts.ts`

## DTOs / Schemas

- `apps/server/schemas/plan.schema.ts`: RouterPlan, ToolCall, ToolResult, ResultStore
- `python-kb-client.ts`: ChunkResult, SearchKBResponse
