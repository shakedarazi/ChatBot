// packages/server/services/plan-executor.service.ts
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
 * Resolve placeholders like <result_from_tool_1> in parameters
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
               return String(r.result);
            }
         );
      }
   }
   return resolved;
}

/**
 * Extract numeric value from tool result string for math operations
 */
function extractNumericValue(result: string | number | null): number | null {
   if (result === null) return null;
   if (typeof result === 'number') return result;

   // Try to extract first number from string (handles "3.67 ILS per USD", "$1,999" formats)
   const normalized = String(result).replace(/,/g, '');
   const match = normalized.match(/[\d.]+/);
   if (match) {
      const num = parseFloat(match[0]);
      return isNaN(num) ? null : num;
   }
   return null;
}

/**
 * Execute a single tool and return the result
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
            const from = resolvedParams.from?.toUpperCase?.();
            const to = resolvedParams.to?.toUpperCase?.() || 'ILS';
            if (!from) {
               return {
                  tool,
                  success: false,
                  result: null,
                  error: 'Missing from currency',
               };
            }
            const result = getExchangeRate(from, to);
            // Extract the rate value for placeholder substitution
            const rateMatch = result.match(/[\d.]+/);
            const rateValue = rateMatch ? parseFloat(rateMatch[0]) : null;
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
               // Check if expression contains ERROR placeholder
               if (expression.includes('ERROR')) {
                  return {
                     tool,
                     success: false,
                     result: null,
                     error: 'Dependency tool failed',
                  };
               }
               const result = calculateMath(expression);
               // Extract numeric result
               const numMatch = result.match(/=\s*([\d.]+)/);
               const numValue =
                  numMatch && numMatch[1] ? parseFloat(numMatch[1]) : null;
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
               const numMatch = result.match(/=\s*([\d.]+)/);
               const numValue =
                  numMatch && numMatch[1] ? parseFloat(numMatch[1]) : null;
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
            // For price queries, extract numeric value for downstream math/placeholders
            if (query.toLowerCase() === 'price') {
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
      console.error(`[executor] tool ${tool} error:`, err.message);
      return { tool, success: false, result: null, error: err.message };
   }
}

export type PlanExecutionResult = {
   message: string;
   toolResults: ToolResult[];
   synthesized: boolean;
};

/**
 * Execute a plan (sequence of tool calls) and return the final result
 */
export async function executePlan(
   plan: RouterPlan,
   userInput: string,
   context: ChatMessage[]
): Promise<PlanExecutionResult> {
   const totalStart = Date.now();
   const resultStore: ResultStore = new Map();
   const toolResults: ToolResult[] = [];

   // Execute each tool in sequence
   for (let i = 0; i < plan.plan.length; i++) {
      const toolCall = plan.plan[i]!;
      const stepIndex = i + 1; // 1-based index

      console.log(
         `[executor] step ${stepIndex}/${plan.plan.length}: ${toolCall.tool}`
      );

      // Resolve placeholders in parameters
      const resolvedParams = resolvePlaceholders(
         toolCall.parameters,
         resultStore
      );
      console.log(
         `[executor] resolved params:`,
         JSON.stringify(resolvedParams)
      );

      // Execute the tool
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

      // Store result
      resultStore.set(stepIndex, result);
      toolResults.push(result);

      if (!result.success) {
         console.log(
            `[executor] tool ${toolCall.tool} failed: ${result.error}`
         );
      } else {
         console.log(
            `[executor] tool ${toolCall.tool} result: ${String(result.result).slice(0, 100)}`
         );
      }
   }

   // Determine final answer
   let finalMessage: string;
   let synthesized = false;

   if (plan.final_answer_synthesis_required && toolResults.length > 1) {
      // Synthesize multiple results
      console.log('[executor] synthesizing final answer');
      const synthStart = Date.now();
      finalMessage = await synthesizeAnswer(
         userInput,
         toolResults,
         detectLanguage(userInput)
      );
      console.log(`[benchmark] synthesis latency=${Date.now() - synthStart}ms`);
      synthesized = true;
   } else {
      // Return last successful result
      const lastSuccess = [...toolResults].reverse().find((r) => r.success);
      if (lastSuccess) {
         finalMessage = String(lastSuccess.result);
      } else {
         finalMessage = "Sorry, I couldn't complete that request.";
      }
   }

   console.log(`[benchmark] total-plan latency=${Date.now() - totalStart}ms`);

   return {
      message: finalMessage,
      toolResults,
      synthesized,
   };
}
