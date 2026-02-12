// packages/server/services/synthesis.service.ts
import { llmClient } from '../llm/client';
import { SYNTHESIS_PROMPT } from '../prompts';
import type { ToolResult } from '../schemas/plan.schema';
import { detectLanguage } from '../utils/language';

/**
 * Format tool results for the synthesis prompt
 */
function formatToolResults(results: ToolResult[]): string {
   return results
      .map((r, i) => {
         const status = r.success ? '✓' : '✗';
         const value = r.success ? r.result : `Error: ${r.error}`;
         return `${i + 1}. ${r.tool} [${status}]: ${value}`;
      })
      .join('\n');
}

/**
 * Synthesize a final answer from multiple tool results.
 * @param userInput - Original user message
 * @param toolResults - Tool execution results
 * @param targetLanguage - Optional override; defaults to detectLanguage(userInput)
 */
export async function synthesizeAnswer(
   userInput: string,
   toolResults: ToolResult[],
   targetLanguage?: 'he' | 'en'
): Promise<string> {
   const lang = targetLanguage ?? detectLanguage(userInput);

   // Format tool results
   const formattedResults = formatToolResults(toolResults);

   // Build the synthesis prompt
   const prompt = SYNTHESIS_PROMPT.replace('{user_input}', userInput)
      .replace('{tool_results}', formattedResults)
      .replace(/\{target_language\}/g, lang);

   console.log(
      '[synthesis] combining results from',
      toolResults.length,
      'tools'
   );

   try {
      const response = await llmClient.generateText({
         model: 'gpt-4.1',
         instructions: '', // Instructions are in the prompt itself
         prompt,
         temperature: 0.5,
         maxTokens: 500,
      });

      return response.text.trim();
   } catch (err: any) {
      console.error('[synthesis] error:', err.message);

      // Fallback: concatenate successful results
      const successfulResults = toolResults.filter((r) => r.success);
      if (successfulResults.length > 0) {
         return successfulResults.map((r) => String(r.result)).join('\n\n');
      }

      return 'Sorry, I encountered an error while processing your request.';
   }
}
