// packages/server/services/planner.service.ts
// Plan orchestration: LLM plans multi-step tool execution

import { routerPlanSchema, type RouterPlan } from '../schemas/plan.schema';
import { llmClient } from '../llm/client';
import { callOllama } from '../llm/ollama-client';
import { ROUTER_SYSTEM_PROMPT } from '../prompts';

/**
 * Extract the first valid JSON object from free-form LLM text
 */
function extractFirstJsonObject(text: string): string | null {
   const start = text.indexOf('{');
   if (start === -1) return null;

   let depth = 0;
   for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') depth--;
      if (depth === 0) return text.slice(start, i + 1);
   }
   return null;
}

/**
 * Parse, validate and PRINT the generated plan (project requirement)
 */
async function tryParseAndValidatePlan(
   rawText: string
): Promise<RouterPlan | null> {
   const extracted = extractFirstJsonObject(rawText);
   if (!extracted) return null;

   let parsed: unknown;
   try {
      parsed = JSON.parse(extracted);
   } catch {
      return null;
   }

   const validated = routerPlanSchema.safeParse(parsed);
   if (!validated.success) {
      console.log('[planner] Zod validation failed:', validated.error.message);
      return null;
   }

   console.log('===== GENERATED PLAN =====');
   console.log(JSON.stringify(validated.data, null, 2));
   console.log('==========================');

   return validated.data;
}

/**
 * Planner entry point
 * - Tries Ollama first
 * - Falls back to OpenAI if needed
 * - Returns a validated RouterPlan or null
 */
export async function planPlanner(
   userInput: string
): Promise<RouterPlan | null> {
   const start = Date.now();

   // 1) Try Ollama first (fast/local)
   try {
      const response = await callOllama({
         prompt: userInput,
         system: ROUTER_SYSTEM_PROMPT,
         temperature: 0.2,
         timeoutMs: 30000,
      });

      const plan = await tryParseAndValidatePlan(response.text);
      console.log(`[benchmark] planner-ollama latency=${Date.now() - start}ms`);

      if (plan) return plan;
   } catch (err) {
      console.log(`[planner] ollama failed: ${String(err)}`);
   }

   // 2) Fallback to OpenAI
   try {
      const response = await llmClient.generateText({
         model: 'gpt-4.1',
         instructions: ROUTER_SYSTEM_PROMPT,
         prompt: userInput,
         temperature: 0.2,
         maxTokens: 700,
      });

      const plan = await tryParseAndValidatePlan(response.text);
      console.log(`[benchmark] planner-openai latency=${Date.now() - start}ms`);

      return plan;
   } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[planner] error:', msg);
      return null;
   }
}
