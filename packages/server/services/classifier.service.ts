// packages/server/services/classifier.service.ts
import { llmClient } from '../llm/client';
import { ROUTER_PROMPT } from '../prompts';

export type RouterDecision = {
   intent:
      | 'getWeather'
      | 'calculateMath'
      | 'getExchangeRate'
      | 'analyzeReview'
      | 'generalChat';
   parameters: Record<string, any>;
   confidence: number;
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

function normalizeIntent(x: any): RouterDecision['intent'] {
   return x === 'getWeather' ||
      x === 'calculateMath' ||
      x === 'getExchangeRate' ||
      x === 'analyzeReview' ||
      x === 'generalChat'
      ? x
      : 'generalChat';
}

export async function classifyIntent(
   userInput: string
): Promise<RouterDecision> {
   const response = await llmClient.generateText({
      model: 'gpt-4.1',
      instructions: ROUTER_PROMPT,
      prompt: userInput,
      temperature: 0,
      maxTokens: 250,
      // IMPORTANT: no previousResponseId for router/classifier (stateless)
   });

   // דרישת המטלה: להדפיס לקונסול את ה-JSON הגולמי
   console.log('[router] raw json from LLM:', response.text);

   const parsed = safeParseJson(response.text);
   if (!parsed) {
      return { intent: 'generalChat', parameters: {}, confidence: 0.4 };
   }

   const intent = normalizeIntent(parsed.intent);
   const parameters =
      parsed.parameters && typeof parsed.parameters === 'object'
         ? parsed.parameters
         : {};
   const confidence = clamp01(Number(parsed.confidence));

   return { intent, parameters, confidence };
}
