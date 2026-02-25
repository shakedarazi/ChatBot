// packages/server/services/plan-executor.service.ts

import type {
   RouterPlan,
   ToolResult,
   ResultStore,
} from '../schemas/plan.schema';
import type { ChatMessage } from '../repositories/conversation.repository';
import { toolHandlers } from './tools/utils/index';
import {
   resolvePlaceholders,
   containsErrorToken,
} from './tools/utils/placeholders';
import { synthesizeAnswer } from './synthesis.service';
import { detectLanguage } from '../utils/language';
import { generalChat } from './general-chat.service';

export type PlanExecutionResult = {
   message: string;
   toolResults: ToolResult[];
   synthesized: boolean;
   stoppedEarly: boolean;
};

export async function executePlan(
   plan: RouterPlan,
   userInput: string,
   context: ChatMessage[],
   previousResponseId?: string
): Promise<PlanExecutionResult> {
   const totalStart = Date.now();
   const resultStore: ResultStore = new Map();
   const toolResults: ToolResult[] = [];
   let stoppedEarly = false;

   console.log('\n==============================');
   console.log('[executor] START EXECUTION');
   console.log('==============================\n');

   for (let i = 0; i < plan.plan.length; i++) {
      const toolCall = plan.plan[i]!;
      const stepIndex = i + 1;

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

      // If placeholders resolved to ERROR, safest is to stop and fallback (router-style soft behavior)
      if (containsErrorToken(resolvedParams)) {
         console.error(
            '[executor] STOP: placeholder dependency failure (ERROR)'
         );
         const r = await generalChat(context, userInput, previousResponseId);
         const fallback: ToolResult = {
            tool: 'generalChat',
            success: true,
            result: r.message,
         };
         toolResults.push(fallback);
         stoppedEarly = true;
         break;
      }

      const handler = toolHandlers[toolCall.tool];
      if (!handler) {
         const fail: ToolResult = {
            tool: toolCall.tool,
            success: false,
            result: null,
            error: `Unknown tool: ${toolCall.tool}`,
         };
         console.error(
            '[executor] ❌ HARD failure: unknown tool',
            toolCall.tool
         );
         toolResults.push(fail);
         resultStore.set(stepIndex, fail);
         stoppedEarly = true;
         break;
      }

      const toolStart = Date.now();
      const result = await handler({
         toolName: toolCall.tool,
         params: resolvedParams,
         context,
         userInput,
         previousResponseId,
      });
      console.log(
         `[benchmark] tool=${toolCall.tool} step=${stepIndex} latency=${Date.now() - toolStart}ms`
      );

      toolResults.push(result);
      resultStore.set(stepIndex, result);

      if (!result.success) {
         // Tools generally soft-fallback, so reaching here is "hard"
         console.error(
            `[executor] ❌ HARD failure in ${toolCall.tool}: ${result.error}`
         );
         stoppedEarly = true;
         break;
      } else {
         console.log(`[executor] ✅ success: ${toolCall.tool}`);
         console.log(
            '[executor] result (stored for placeholders):',
            String(result.result).slice(0, 200)
         );
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
         const r = await generalChat(context, userInput, previousResponseId);
         finalMessage = r.message;
      }
   }

   console.log('[executor] FINAL MESSAGE:', finalMessage);
   console.log(`[benchmark] total-plan latency=${Date.now() - totalStart}ms`);
   console.log('[executor] END EXECUTION');
   console.log('==============================\n');

   return { message: finalMessage, toolResults, synthesized, stoppedEarly };
}
