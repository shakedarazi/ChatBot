// packages/server/services/classifier.service.ts
import { z } from 'zod';
import { llmClient } from '../llm/client';
import { callOllama } from '../llm/ollama-client';
import { ROUTER_PROMPT, ROUTER_PROMPT_OLLAMA } from '../prompts';

// Zod schema for router response validation
const routerResponseSchema = z.object({
   intent: z.enum([
      'getWeather',
      'calculateMath',
      'getExchangeRate',
      'analyzeReview',
      'getProductInformation',
      'generalChat',
   ]),
   parameters: z.record(z.any()).default({}),
   confidence: z.number().min(0).max(1),
});

export type RouterDecision = z.infer<typeof routerResponseSchema>;

// Safe default for fallback
const SAFE_DEFAULT: RouterDecision = {
   intent: 'generalChat',
   parameters: {},
   confidence: 0.4,
};

function clamp01(n: number): number {
   if (Number.isNaN(n)) return 0;
   if (n < 0) return 0;
   if (n > 1) return 1;
   return n;
}

function safeParseJson(text: string): any | null {
   try {
      return JSON.parse(text);
   } catch {
      return null;
   }
}

// Extract first JSON object from text (handles chatty Ollama output)
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

function normalizeIntent(x: any): RouterDecision['intent'] {
   return x === 'getWeather' ||
      x === 'calculateMath' ||
      x === 'getExchangeRate' ||
      x === 'analyzeReview' ||
      x === 'getProductInformation' ||
      x === 'generalChat'
      ? x
      : 'generalChat';
}

// Try Ollama with retry logic
async function tryOllamaWithRetry(
   userInput: string
): Promise<
   | { success: true; decision: RouterDecision }
   | { success: false; reason: string }
> {
   const MAX_ATTEMPTS = 3;

   for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      console.log(`[router-ollama] attempt ${attempt}/${MAX_ATTEMPTS}`);

      try {
         const response = await callOllama({
            prompt: userInput,
            system: ROUTER_PROMPT_OLLAMA,
            temperature: 0,
            timeoutMs: 30000, // 30s for local model
         });

         const rawText = response.text;
         console.log(
            `[router-ollama] raw: ${rawText.slice(0, 200)}${rawText.length > 200 ? '...' : ''}`
         );

         // Extract JSON from potentially chatty output
         const extracted = extractFirstJsonObject(rawText);
         if (!extracted) {
            console.log(`[router-ollama] retry due to: JSON extraction failed`);
            continue;
         }

         // Parse JSON
         const parsed = safeParseJson(extracted);
         if (!parsed) {
            console.log(`[router-ollama] retry due to: JSON parse failed`);
            continue;
         }

         // Zod validation
         const validated = routerResponseSchema.safeParse(parsed);
         if (!validated.success) {
            const errorMsg = validated.error.errors
               .map((e) => `${e.path.join('.')}: ${e.message}`)
               .join(', ');
            console.log(
               `[router-ollama] retry due to: Zod validation failed - ${errorMsg}`
            );
            continue;
         }

         // Success! Apply defense-in-depth normalization
         return {
            success: true,
            decision: {
               intent: normalizeIntent(validated.data.intent),
               parameters: validated.data.parameters,
               confidence: clamp01(validated.data.confidence),
            },
         };
      } catch (err: any) {
         // Network error or timeout - immediate fallback, no retry
         if (err.name === 'AbortError') {
            console.log('[router-ollama] timeout after 8000ms');
            return { success: false, reason: 'timeout' };
         }
         console.log(`[router-ollama] network error: ${err.message}`);
         return { success: false, reason: `network error: ${err.message}` };
      }
   }

   return { success: false, reason: 'max retries exceeded' };
}

export async function classifyIntent(
   userInput: string
): Promise<RouterDecision> {
   // Try Ollama first
   const ollamaStart = Date.now();
   const ollamaResult = await tryOllamaWithRetry(userInput);

   if (ollamaResult.success) {
      console.log(
         `[benchmark] router-ollama latency=${Date.now() - ollamaStart}ms`
      );
      console.log('[router] decision:', ollamaResult.decision);
      return ollamaResult.decision;
   }

   // Fallback to OpenAI
   console.log(`[router] fallback to OpenAI due to: ${ollamaResult.reason}`);

   try {
      const openaiStart = Date.now();
      const response = await llmClient.generateText({
         model: 'gpt-4.1',
         instructions: ROUTER_PROMPT,
         prompt: userInput,
         temperature: 0,
         maxTokens: 250,
      });
      console.log(
         `[benchmark] router-openai latency=${Date.now() - openaiStart}ms`
      );

      // Keep existing raw logging requirement
      console.log('[router] raw json from LLM:', response.text);

      const parsed = safeParseJson(response.text);
      if (!parsed) {
         console.log('[router] OpenAI parse failed, returning safe default');
         return SAFE_DEFAULT;
      }

      // Validate with Zod
      const validated = routerResponseSchema.safeParse(parsed);
      if (!validated.success) {
         console.log(
            '[router] OpenAI Zod validation failed, using fallback normalization'
         );
         // Fall back to existing normalization logic
         const intent = normalizeIntent(parsed.intent);
         const parameters =
            parsed.parameters && typeof parsed.parameters === 'object'
               ? parsed.parameters
               : {};
         const confidence = clamp01(Number(parsed.confidence));
         const decision = { intent, parameters, confidence };
         console.log('[router] decision:', decision);
         return decision;
      }

      const decision = {
         intent: normalizeIntent(validated.data.intent),
         parameters: validated.data.parameters,
         confidence: clamp01(validated.data.confidence),
      };
      console.log('[router] decision:', decision);
      return decision;
   } catch (err: any) {
      console.error('[router] OpenAI error:', err.message);
      console.log('[router] returning safe default');
      return SAFE_DEFAULT;
   }
}
