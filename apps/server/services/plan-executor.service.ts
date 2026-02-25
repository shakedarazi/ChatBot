// packages/server/services/plan-executor.service.ts
// Executor – runs the PLAN step-by-step

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
import { callPythonSentiment } from '../llm/python-sentiment-client';
import { generalChat } from './general-chat.service';
import { getProductInformation } from './product-info.service';
import { synthesizeAnswer } from './synthesis.service';
import { detectLanguage } from '../utils/language';
import type { ChatMessage } from '../repositories/conversation.repository';

/**
 * Router parity helpers
 */
function upper3(x: any): string | null {
   if (typeof x !== 'string') return null;
   const v = x.trim().toUpperCase();
   return /^[A-Z]{3}$/.test(v) ? v : null;
}

/**
 * Resolve placeholders like <result_from_tool_1> in parameters
 * If referenced tool missing/failed -> "ERROR"
 */
function resolvePlaceholders(
   params: Record<string, any>,
   resultStore: ResultStore
): Record<string, any> {
   const resolved = { ...params };
   for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === 'string') {
         resolved[key] = value.replace(
            /<result_from_tool_(\d+)>/g,
            (_, idx) => {
               const r = resultStore.get(parseInt(idx));
               if (!r || !r.success) return 'ERROR';
               const raw = r.result;

               if (key === 'expression') {
                  const n = extractNumericValue(raw as any);
                  if (n !== null) return String(n);
               }

               return String(raw);
            }
         );
      }
   }
   return resolved;
}

/**
 * Extract numeric value from tool result string for downstream math/placeholders
 */
function extractNumericValue(result: string | number | null): number | null {
   if (result === null) return null;
   if (typeof result === 'number') return result;

   const normalized = String(result).replace(/,/g, '');
   const matches = normalized.match(/[\d.]+/g);
   if (!matches || matches.length === 0) return null;

   // Prefer LAST numeric token (robust for "1 USD = 3.67 ILS", "$1,999" etc.)
   for (let i = matches.length - 1; i >= 0; i--) {
      const num = parseFloat(matches[i]!);
      if (!isNaN(num)) return num;
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

   // Prefer the value AFTER "=" if present
   const eqMatch = text.match(/=\s*([\d.]+)/);
   if (eqMatch?.[1]) {
      const n = parseFloat(eqMatch[1]);
      if (!isNaN(n)) return n;
   }

   // Fallback: last numeric token
   return extractNumericValue(text);
}

/**
 * Router-style soft fallback: instead of failing the plan, answer with generalChat
 */
async function fallbackToGeneralChat(
   context: ChatMessage[],
   userInput: string,
   reason: string
): Promise<ToolResult> {
   console.log(`[executor][fallback] generalChat because: ${reason}`);
   const r = await generalChat(context, userInput);
   return { tool: 'generalChat', success: true, result: r.message };
}

/**
 * Execute a single tool and return the result (router-parity behavior)
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
               // Router: fallback to generalChat
               return await fallbackToGeneralChat(
                  context,
                  userInput,
                  'Missing city parameter'
               );
            }
            const result = await getWeather(city);
            return { tool, success: true, result };
         }

         case 'getExchangeRate': {
            const from = upper3(resolvedParams.from);
            const to = upper3(resolvedParams.to) ?? 'ILS';

            if (!from) {
               // Router: fallback to generalChat
               return await fallbackToGeneralChat(
                  context,
                  userInput,
                  'Missing/invalid from currency'
               );
            }

            const raw = getExchangeRate(from, to);

            // IMPORTANT: for placeholders store numeric rate, not leading "1"
            const rateValue = extractExchangeRateValue(raw);
            return { tool, success: true, result: rateValue ?? raw };
         }

         case 'getProductInformation': {
            const productName =
               typeof resolvedParams.product_name === 'string' &&
               resolvedParams.product_name.trim()
                  ? resolvedParams.product_name.trim()
                  : null;

            // Router: default query to "specs"
            const query =
               typeof resolvedParams.query === 'string' &&
               resolvedParams.query.trim()
                  ? resolvedParams.query.trim()
                  : 'specs';

            if (!productName) {
               return await fallbackToGeneralChat(
                  context,
                  userInput,
                  'Missing product_name'
               );
            }

            try {
               const result = await getProductInformation(
                  productName,
                  query,
                  userInput
               );

               return { tool, success: true, result };
            } catch (err: any) {
               console.error(
                  '[product-info] error:',
                  err?.message ?? String(err)
               );
               return await fallbackToGeneralChat(
                  context,
                  userInput,
                  'getProductInformation threw error'
               );
            }
         }

         case 'calculateMath': {
            const expression = resolvedParams.expression;
            const textProblem = resolvedParams.textProblem;

            if (
               expression &&
               typeof expression === 'string' &&
               expression.trim()
            ) {
               if (expression.includes('ERROR')) {
                  // Router would fallback; here we do the same (soft)
                  return await fallbackToGeneralChat(
                     context,
                     userInput,
                     'Math dependency failed (ERROR placeholder)'
                  );
               }
               const result = calculateMath(expression);

               // Try store numeric if possible (planner-friendly)
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
                  // Router: return friendly message (NOT failure)
                  return {
                     tool,
                     success: true,
                     result:
                        'I could not translate the word problem into a safe math expression.',
                  };
               }

               const result = calculateMath(translated.expression);
               const numValue = extractNumericValue(result);
               return { tool, success: true, result: numValue ?? result };
            }

            // Router: fallback to generalChat
            return await fallbackToGeneralChat(
               context,
               userInput,
               'Missing expression/textProblem'
            );
         }

         case 'analyzeReview': {
            const reviewText =
               typeof resolvedParams.reviewText === 'string' &&
               resolvedParams.reviewText.trim()
                  ? resolvedParams.reviewText
                  : userInput;

            // Router parity:
            // - If classification confidence was low (<0.8), router verified via Python sentiment first.
            // In planner mode we don't have router confidence, so we ALWAYS verify with Python first.
            // This keeps the "protective" behavior: don't run expensive ABSA on non-review input.
            try {
               const start = Date.now();
               const verification = await callPythonSentiment(reviewText);
               console.log(
                  `[benchmark] python-sentiment latency=${Date.now() - start}ms`
               );
               console.log(
                  `[review] verification sentiment=${verification.sentiment} confidence=${verification.confidence}`
               );

               if (verification.confidence < 0.6) {
                  console.log(
                     '[review] verification failed (low confidence), fallback to generalChat'
                  );
                  return await fallbackToGeneralChat(
                     context,
                     userInput,
                     'Review verification failed (python confidence < 0.6)'
                  );
               }
            } catch (err) {
               console.error('[review] Python verification error:', err);
               return await fallbackToGeneralChat(
                  context,
                  userInput,
                  'Python sentiment verification error'
               );
            }

            try {
               const result =
                  await reviewAnalyzerService.analyzeReview(reviewText);
               console.log(
                  '[review] selfCorrectionApplied:',
                  result.selfCorrected
               );
               return { tool, success: true, result: result.formatted };
            } catch (err) {
               console.error('[review] analyzeReview error:', err);
               return await fallbackToGeneralChat(
                  context,
                  userInput,
                  'analyzeReview threw error'
               );
            }
         }

         case 'generalChat': {
            const message = resolvedParams.message || userInput;
            const r = await generalChat(context, message);
            return { tool, success: true, result: r.message };
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
      console.error(
         `[executor] tool ${tool} error:`,
         err?.message ?? String(err)
      );
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
 * Execute a plan (sequence of tool calls) and return the final result
 * - Stops early on HARD failures (unknown tool / unexpected crash)
 * - Uses router-style soft fallbacks for missing parameters / verification failures
 */
export async function executePlan(
   plan: RouterPlan,
   userInput: string,
   context: ChatMessage[]
): Promise<PlanExecutionResult> {
   const totalStart = Date.now();
   const resultStore: ResultStore = new Map();
   const toolResults: ToolResult[] = [];
   let stoppedEarly = false;

   console.log('\n==============================');
   console.log('[executor] START EXECUTION');
   console.log('[executor] userInput:', userInput);
   console.log('==============================\n');

   for (let i = 0; i < plan.plan.length; i++) {
      const toolCall = plan.plan[i]!;
      const stepIndex = i + 1; // 1-based index

      console.log('--------------------------------');
      console.log(
         `[executor] STEP ${stepIndex}/${plan.plan.length}: ${toolCall.tool}`
      );

      const resolvedParams = resolvePlaceholders(
         toolCall.parameters,
         resultStore
      );
      console.log(
         '[executor] resolved params:',
         JSON.stringify(resolvedParams, null, 2)
      );

      // If placeholders resolved to ERROR, do router-style fallback to generalChat and STOP
      // (Router does not have multi-step dependency chains, so safest is to stop.)
      if (JSON.stringify(resolvedParams).includes('ERROR')) {
         const fallback = await fallbackToGeneralChat(
            context,
            userInput,
            'Placeholder resolved to ERROR'
         );
         toolResults.push(fallback);
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
      console.log(
         `[benchmark] tool-${toolCall.tool} latency=${Date.now() - toolStart}ms`
      );

      // Store and log
      resultStore.set(stepIndex, result);
      toolResults.push(result);

      if (!result.success) {
         console.error(
            `[executor] ❌ HARD failure in ${toolCall.tool}: ${result.error}`
         );
         stoppedEarly = true;
         break;
      } else {
         console.log(
            `[executor] ✅ ${toolCall.tool} result (stored):`,
            String(result.result).slice(0, 200)
         );
      }
   }

   // Determine final answer
   let finalMessage: string;
   let synthesized = false;

   if (plan.final_answer_synthesis_required) {
      console.log(
         '[executor] final_answer_synthesis_required=true → synthesizing final answer'
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
      // Router-equivalent: return the last successful result
      const lastSuccess = [...toolResults].reverse().find((r) => r.success);
      if (lastSuccess) {
         finalMessage = String(lastSuccess.result);
      } else {
         // extra safety
         const r = await generalChat(context, userInput);
         finalMessage = r.message;
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
