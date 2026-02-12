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

/**
 * Plan multi-step tool execution from user input.
 * Returns valid RouterPlan or null on parse/validation failure.
 */
export async function planPlanner(
   userInput: string
): Promise<RouterPlan | null> {
   const start = Date.now();

   try {
      // Try Ollama first (consistent with router)
      let rawText: string;
      try {
         const response = await callOllama({
            prompt: userInput,
            system: ROUTER_SYSTEM_PROMPT,
            temperature: 0,
            timeoutMs: 15000,
         });
         rawText = response.text;
         console.log(
            `[benchmark] router-planner latency=${Date.now() - start}ms`
         );
      } catch {
         // Fallback to OpenAI
         const response = await llmClient.generateText({
            model: 'gpt-4.1',
            instructions: ROUTER_SYSTEM_PROMPT,
            prompt: userInput,
            temperature: 0,
            maxTokens: 500,
         });
         rawText = response.text;
         console.log(
            `[benchmark] router-planner-openai latency=${Date.now() - start}ms`
         );
      }

      const extracted = extractFirstJsonObject(rawText);
      if (!extracted) {
         console.log('[planner] JSON extraction failed');
         return null;
      }

      const parsed = JSON.parse(extracted);
      const validated = routerPlanSchema.safeParse(parsed);

      if (!validated.success) {
         console.log(
            '[planner] Zod validation failed:',
            validated.error.message
         );
         return null;
      }

      return validated.data;
   } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[planner] error:', msg);
      return null;
   }
}
