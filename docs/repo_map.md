# Repository Map (Project Navigation)

## Folder Structure

| Folder | Purpose |
|--------|---------|
| `apps/server/` | TypeScript server — orchestration, routing, tools, API |
| `apps/client/` | Frontend chat UI |
| `services/python/` | Python microservice — sentiment, KB search |
| `data/products/` | Product documentation (3–5 .txt files) |
| `examples/sample_logs/` | Multi-tool orchestration execution logs |
| `docs/` | Architecture, validation, cost estimation |

## Key Files

| File | Purpose |
|------|---------|
| `apps/server/index.ts` | Entry point, mounts routes |
| `apps/server/prompts.ts` | All prompts (ROUTER_PROMPT, ROUTER_SYSTEM_PROMPT, RAG_GENERATION_PROMPT, ORCHESTRATION_SYNTHESIS_PROMPT, etc.) |
| `apps/server/routes.ts` | Express route definitions |
| `apps/server/services/chat.service.ts` | sendMessage → planPlanner | routeMessage |
| `apps/server/services/planner.service.ts` | planPlanner(userInput) → RouterPlan \| null |
| `apps/server/services/plan-executor.service.ts` | executePlan(plan, userInput, context) |
| `apps/server/services/router.service.ts` | routeMessage → single-intent handlers |
| `apps/server/llm/python-kb-client.ts` | searchKB(query, topK) → Python /search_kb |

## Tools

Located in `apps/server/services/`:

- `weather.service.ts` — getWeather
- `exchange.service.ts` — getExchangeRate
- `math.service.ts` — calculateMath
- `review-analyzer.service` + `python-sentiment-client` — analyzeReview
- `product-info.service.ts` — getProductInformation (RAG)
- `general-chat.service.ts` — generalChat

Plan-executor invokes these; router invokes same functions for single-intent.

## Orchestration Trigger

1. `chat.service.sendMessage` called
2. If `USE_PLAN === 'true'`: call `planPlanner(prompt)`
3. If valid plan: `executePlan(plan, prompt, context)`
4. Else: `routeMessage(prompt, context, previousResponseId)`

## Adding a New Tool

1. Add tool to `plan.schema.ts` toolCallSchema enum
2. Implement in `apps/server/services/` (e.g. `new-tool.service.ts`)
3. Add case in `plan-executor.service.ts` executeTool switch
4. Add to `router.service.ts` if single-intent routing needed
5. Add to `ROUTER_SYSTEM_PROMPT` few-shot examples

## DTOs / Schemas

- `plan.schema.ts`: RouterPlan, ToolCall, ToolResult
- `python-kb-client.ts`: ChunkResult, SearchKBResponse
