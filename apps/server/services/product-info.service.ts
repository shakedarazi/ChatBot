// packages/server/services/product-info.service.ts
import { searchKB } from '../llm/python-kb-client';
import { llmClient } from '../llm/client';
import { RAG_PRODUCT_PROMPT } from '../prompts';
import { detectLanguage } from '../utils/language';

/**
 * Build the KB query deterministically (no conditionals)
 */
function buildKBQuery(
   productName: string,
   queryToken: string,
   originalUserQuestion: string
): string {
   return `${productName} ${queryToken} ${originalUserQuestion}`;
}

/**
 * Format chunks for the RAG prompt
 */
function formatChunks(
   chunks: Array<{ text: string; metadata: { source: string } }>
): string {
   if (chunks.length === 0) return '';

   return chunks
      .map((c, i) => `[Source: ${c.metadata.source}]\n${c.text}`)
      .join('\n\n---\n\n');
}

/**
 * Get product information using RAG
 * @param productName - The product name (as provided by planner)
 * @param queryToken - Controlled token (price, specs, battery, etc.)
 * @param originalUserQuestion - The original user input (for context)
 */
export async function getProductInformation(
   productName: string,
   queryToken: string,
   originalUserQuestion: string
): Promise<string> {
   console.log(`[product-info] product="${productName}" query="${queryToken}"`);

   // Build deterministic retrieval query
   const kbQuery = buildKBQuery(productName, queryToken, originalUserQuestion);
   console.log(`[product-info] KB query: "${kbQuery}"`);

   // Search KB
   const searchStart = Date.now();
   const searchResult = await searchKB(kbQuery, 3);
   console.log(
      `[benchmark] kb-search latency=${Date.now() - searchStart}ms, chunks=${searchResult.chunks.length}`
   );

   // Handle no chunks found
   if (searchResult.chunks.length === 0) {
      console.log('[product-info] no chunks found');
      return `I couldn't find information about "${productName}" in the knowledge base.`;
   }

   // Log chunk sources
   searchResult.chunks.forEach((c, i) => {
      console.log(
         `[product-info] chunk ${i + 1}: ${c.metadata.source} (score: ${c.score.toFixed(3)})`
      );
   });

   // Format chunks for prompt
   const chunksText = formatChunks(searchResult.chunks);

   // Build the RAG prompt (target language for bilingual response)
   const targetLanguage = detectLanguage(originalUserQuestion);
   const prompt = RAG_PRODUCT_PROMPT.replace('{chunks}', chunksText)
      .replace('{original_user_question}', originalUserQuestion)
      .replace('{query_token}', queryToken)
      .replace(/\{target_language\}/g, targetLanguage);

   // Call OpenAI for grounded answer generation
   const ragStart = Date.now();
   try {
      const response = await llmClient.generateText({
         model: 'gpt-4.1',
         instructions: '', // Instructions are in the prompt itself
         prompt,
         temperature: 0.3,
         maxTokens: 500,
      });
      console.log(
         `[benchmark] rag-generation latency=${Date.now() - ragStart}ms`
      );

      return response.text.trim();
   } catch (err: any) {
      console.error('[product-info] RAG generation error:', err.message);
      return `Error retrieving information about "${productName}".`;
   }
}
