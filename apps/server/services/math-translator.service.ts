// packages/server/services/math-translator.service.ts
import { llmClient } from '../llm/client';
import { MATH_TRANSLATOR_PROMPT } from '../prompts';

type TranslateResult = {
   expression: string;
   reasoning: string;
};

function safeParseJson(text: string): any | null {
   try {
      return JSON.parse(text);
   } catch {
      return null;
   }
}

function isSafeExpression(expr: string): boolean {
   // digits, operators, spaces, parentheses, dot
   return /^[0-9+\-*/().\s]+$/.test(expr) && expr.trim().length > 0;
}

export async function translateWordProblemToExpression(
   textProblem: string
): Promise<TranslateResult> {
   const response = await llmClient.generateText({
      model: 'gpt-4.1',
      instructions: MATH_TRANSLATOR_PROMPT,
      prompt: textProblem,
      temperature: 0,
      maxTokens: 200,
   });

   const parsed = safeParseJson(response.text);

   const expression =
      typeof parsed?.expression === 'string' ? parsed.expression : '';
   const reasoning =
      typeof parsed?.reasoning === 'string' ? parsed.reasoning : 'no reasoning';

   // CoT מודפס ללוג בלבד
   console.log('[math][cot] reasoning:', reasoning);
   console.log('[math][cot] expression:', expression);

   if (!isSafeExpression(expression)) {
      return { expression: '', reasoning: 'cannot translate' };
   }

   return { expression: expression.replace(/\s+/g, ''), reasoning };
}
