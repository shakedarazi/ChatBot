// packages/server/services/plan-executor.service.ts
// Executor – runs the PLAN step-by-step with extensive console logging (project-friendly)

import type {
   RouterPlan,
   ToolCall,
   ToolResult,
   ResultStore,
} from '../schemas/plan.schema';

import { getWeather } from './weather.service';
import { getExchangeRate } from './exchange.service';
import { calculateMath } from './math.service';
import { translateWordProblemToExpression } from './math-translator.service';
import { reviewAnalyzerService } from './review-analyzer.service';
import { generalChat } from './general-chat.service';
import { getProductInformation } from './product-info.service';
import { synthesizeAnswer } from './synthesis.service';
import { detectLanguage } from '../utils/language';
import type { ChatMessage } from '../repositories/conversation.repository';

/**
 * Resolve placeholders like <result_from_tool_1> (deep / recursive).
 * If a referenced tool failed / missing, replaces with "ERROR".
 */
function resolvePlaceholdersDeep(value: any, resultStore: ResultStore): any {
   if (typeof value === 'string') {
      return value.replace(/<result_from_tool_(\d+)>/g, (_, idx) => {
         const step = parseInt(idx, 10);
         const r = resultStore.get(step);
         if (!r || !r.success) return 'ERROR';
         return String(r.result);
      });
   }

   if (Array.isArray(value)) {
      return value.map((v) => resolvePlaceholdersDeep(v, resultStore));
   }

   if (value && typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
         out[k] = resolvePlaceholdersDeep(v, resultStore);
      }
      return out;
   }

   return value;
}

function resolvePlaceholders(
   params: Record<string, any>,
   resultStore: ResultStore
): Record<string, any> {
   return resolvePlaceholdersDeep(params, resultStore);
}

/**
 * Extract numeric value from tool result string for downstream math
 */
function extractNumericValue(result: string | number | null): number | null {
   if (result === null) return null;
   if (typeof result === 'number') return result;

   const normalized = String(result).replace(/,/g, '');
   const matches = normalized.match(/[\d.]+/g);
   if (!matches || matches.length === 0) return null;

   // Prefer last numeric token (robust for "1 USD = 3.67 ILS")
   for (let i = matches.length - 1; i >= 0; i--) {
      const n = parseFloat(matches[i]!);
      if (!isNaN(n)) return n;
   }
   return null;
}

/**
 * Extract exchange rate robustly from typical strings like:
 * "1 USD = 3.67 ILS", "USD/ILS: 3.67", "3.67"
 */
function extractExchangeRateValue(
   result: string | number | null
): number | null {
   if (result === null) return null;
   if (typeof result === 'number') return result;

   const text = String(result).replace(/,/g, '');

   // Try " = <number>"
   const eqMatch = text.match(/=\s*([\d.]+)/);
   if (eqMatch?.[1]) {
      const n = parseFloat(eqMatch[1]);
      if (!isNaN(n)) return n;
   }

   // Fallback: last numeric token
   return extractNumericValue(text);
}

function hasErrorToken(obj: any): boolean {
   try {
      return JSON.stringify(obj).includes('ERROR');
   } catch {
      return true;
   }
}

/**
 * Execute a single tool
 */
async function executeTool(
   toolCall: ToolCall,
   resolvedParams: Record<string, any>,
   context: ChatMessage[],
   userInput: string
): Promise<ToolResult> {
   const { tool } = toolCall;

   try {
      switch (tool) {
         case 'getWeather': {
            const city = resolvedParams.city;
            if (!city || typeof city !== 'string') {
               return {
                  tool,
                  success: false,
                  result: null,
                  error: 'Missing city parameter',
               };
            }
            const result = await getWeather(city);
            return { tool, success: true, result };
         }

         case 'getExchangeRate': {
            const fromRaw = resolvedParams.from;
            const toRaw = resolvedParams.to;

            const from =
               typeof fromRaw === 'string' ? fromRaw.toUpperCase() : null;
            const to = typeof toRaw === 'string' ? toRaw.toUpperCase() : 'ILS';

            if (!from) {
               return {
                  tool,
                  success: false,
                  result: null,
                  error: 'Missing from currency',
               };
            }

            const result = getExchangeRate(from, to);

            // Store numeric rate for placeholders (not the leading "1")
            const rateValue = extractExchangeRateValue(result);
            return { tool, success: true, result: rateValue ?? result };
         }

         case 'calculateMath': {
            const expression = resolvedParams.expression;
            const textProblem = resolvedParams.textProblem;

            if (
               expression &&
               typeof expression === 'string' &&
               expression.trim()
            ) {
               const result = calculateMath(expression);
               const numValue = extractNumericValue(result);
               return { tool, success: true, result: numValue ?? result };
            }

            if (
               textProblem &&
               typeof textProblem === 'string' &&
               textProblem.trim()
            ) {
               const translated =
                  await translateWordProblemToExpression(textProblem);
               if (!translated.expression) {
                  return {
                     tool,
                     success: false,
                     result: null,
                     error: 'Could not translate word problem',
                  };
               }

               const result = calculateMath(translated.expression);
               const numValue = extractNumericValue(result);
               return { tool, success: true, result: numValue ?? result };
            }

            return {
               tool,
               success: false,
               result: null,
               error: 'Missing expression or textProblem',
            };
         }

         case 'analyzeReview': {
            const reviewText = resolvedParams.reviewText || userInput;
            if (!reviewText || typeof reviewText !== 'string') {
               return {
                  tool,
                  success: false,
                  result: null,
                  error: 'Missing review text',
               };
            }

            // Any special gating logic should be inside reviewAnalyzerService.analyzeReview.
            const result =
               await reviewAnalyzerService.analyzeReview(reviewText);
            return { tool, success: true, result: result.formatted };
         }

         case 'getProductInformation': {
            const productName = resolvedParams.product_name;
            const query = resolvedParams.query;

            if (!productName || !query) {
               return {
                  tool,
                  success: false,
                  result: null,
                  error: 'Missing product_name or query',
               };
            }

            const result = await getProductInformation(
               productName,
               query,
               userInput
            );

            // If query is "price", try to store numeric value for downstream placeholders
            if (typeof query === 'string' && query.toLowerCase() === 'price') {
               const numVal = extractNumericValue(result);
               if (numVal !== null)
                  return { tool, success: true, result: numVal };
            }

            return { tool, success: true, result };
         }

         case 'generalChat': {
            const message = resolvedParams.message || userInput;
            const result = await generalChat(context, message);
            return { tool, success: true, result: result.message };
         }

         default:
            return {
               tool,
               success: false,
               result: null,
               error: `Unknown tool: ${tool}`,
            };
      }
   } catch (err: any) {
      return {
         tool,
         success: false,
         result: null,
         error: err?.message ?? String(err),
      };
   }
}

export type PlanExecutionResult = {
   message: string;
   toolResults: ToolResult[];
   synthesized: boolean;
   stoppedEarly: boolean;
};

/**
 * Execute a plan and return the final message.
 * Includes lots of console logging (as requested).
 */
export async function executePlan(
   plan: RouterPlan,
   userInput: string,
   context: ChatMessage[]
): Promise<PlanExecutionResult> {
   const totalStart = Date.now();
   console.log('\n==============================');
   console.log('[executor] START EXECUTION');
   console.log('[executor] userInput:', userInput);
   console.log('==============================\n');

   const resultStore: ResultStore = new Map();
   const toolResults: ToolResult[] = [];
   let stoppedEarly = false;

   for (let i = 0; i < plan.plan.length; i++) {
      const toolCall = plan.plan[i]!;
      const stepIndex = i + 1; // 1-based indexing like placeholders

      console.log('--------------------------------');
      console.log(`[executor] STEP ${stepIndex}/${plan.plan.length}`);
      console.log(`[executor] tool: ${toolCall.tool}`);

      const resolvedParams = resolvePlaceholders(
         toolCall.parameters,
         resultStore
      );
      console.log(
         '[executor] resolved parameters:',
         JSON.stringify(resolvedParams, null, 2)
      );

      // Stop if placeholders resolved to ERROR
      if (hasErrorToken(resolvedParams)) {
         const fail: ToolResult = {
            tool: toolCall.tool,
            success: false,
            result: null,
            error: 'Dependency tool failed (placeholder resolved to ERROR)',
         };
         console.error('[executor] STOP: placeholder dependency failure');
         resultStore.set(stepIndex, fail);
         toolResults.push(fail);
         stoppedEarly = true;
         break;
      }

      const toolStart = Date.now();
      const result = await executeTool(
         toolCall,
         resolvedParams,
         context,
         userInput
      );
      const toolLatency = Date.now() - toolStart;

      console.log(
         `[benchmark] tool=${toolCall.tool} step=${stepIndex} latency=${toolLatency}ms`
      );

      resultStore.set(stepIndex, result);
      toolResults.push(result);

      if (result.success) {
         console.log(`[executor] ✅ success: ${toolCall.tool}`);
         console.log(
            '[executor] result (stored for placeholders):',
            result.result
         );
      } else {
         console.error(`[executor] ❌ failure: ${toolCall.tool}`);
         console.error('[executor] error:', result.error);
         stoppedEarly = true;
         break; // stop on first failure
      }
   }

   console.log('\n==============================');
   console.log('[executor] TOOL RESULTS SUMMARY:');
   console.log(JSON.stringify(toolResults, null, 2));
   console.log('==============================\n');

   let finalMessage: string;
   let synthesized = false;

   if (plan.final_answer_synthesis_required) {
      console.log(
         '[executor] final_answer_synthesis_required=true → running synthesis'
      );
      const synthStart = Date.now();
      finalMessage = await synthesizeAnswer(
         userInput,
         toolResults,
         detectLanguage(userInput)
      );
      console.log(`[benchmark] synthesis latency=${Date.now() - synthStart}ms`);
      synthesized = true;
   } else {
      console.log(
         '[executor] final_answer_synthesis_required=false → returning last successful tool output'
      );
      const lastSuccess = [...toolResults].reverse().find((r) => r.success);
      if (lastSuccess) {
         finalMessage = String(lastSuccess.result);
      } else {
         console.log(
            '[executor] no successful tool result → fallback to generalChat'
         );
         const fallback = await generalChat(context, userInput);
         finalMessage = fallback.message;
      }
   }

   console.log('[executor] FINAL MESSAGE:', finalMessage);
   console.log(`[benchmark] total-plan latency=${Date.now() - totalStart}ms`);
   console.log('[executor] END EXECUTION');
   console.log('==============================\n');

   return {
      message: finalMessage,
      toolResults,
      synthesized,
      stoppedEarly,
   };
}
