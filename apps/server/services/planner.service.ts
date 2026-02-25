// packages/server/services/planner.service.ts
// Plan orchestration: LLM plans multi-step tool execution

import { routerPlanSchema, type RouterPlan } from '../schemas/plan.schema';
import { llmClient } from '../llm/client';
import { callOllama } from '../llm/ollama-client';
import { ROUTER_SYSTEM_PROMPT } from '../prompts';

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

function tryParseAndValidatePlan(rawText: string): RouterPlan | null {
   const extracted = extractFirstJsonObject(rawText);
   if (!extracted) return null;

   let parsed: unknown;
   try {
      parsed = JSON.parse(extracted);
   } catch {
      return null;
   }

   const validated = routerPlanSchema.safeParse(parsed);
   if (!validated.success) return null;

   console.log('===== GENERATED PLAN =====');
   console.log(JSON.stringify(validated.data, null, 2));
   console.log('==========================');

   return validated.data;
}

export async function planPlanner(
   userInput: string
): Promise<RouterPlan | null> {
   const start = Date.now();
   console.log('[planner] Incoming user input:', userInput);

   // Try Ollama first
   try {
      const response = await callOllama({
         prompt: userInput,
         system: ROUTER_SYSTEM_PROMPT,
         temperature: 0.2,
         timeoutMs: 30000,
      });

      const plan = tryParseAndValidatePlan(response.text);
      console.log(`[benchmark] planner-ollama latency=${Date.now() - start}ms`);

      if (plan) return plan;
   } catch (err) {
      console.log(`[planner] Ollama failed:`, String(err));
   }

   // Fallback to OpenAI
   try {
      console.log('[planner] Falling back to OpenAI');
      const response = await llmClient.generateText({
         model: 'gpt-4.1',
         instructions: ROUTER_SYSTEM_PROMPT,
         prompt: userInput,
         temperature: 0.2,
         maxTokens: 700,
      });

      const plan = tryParseAndValidatePlan(response.text);
      console.log(
         `[benchmark] planner-openai latency=${Date.now() - start}ms}`
      );

      return plan;
   } catch (err) {
      console.error('[planner] OpenAI failed:', err);
      return null;
   }
}
