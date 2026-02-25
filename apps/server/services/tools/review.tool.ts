// packages/server/services/tools/review.tool.ts
import type { ToolHandler } from './utils/index';
import { reviewAnalyzerService } from '../review-analyzer.service';
import { generalChat } from '../general-chat.service';
import { callPythonSentiment } from '../../llm/python-sentiment-client'; // adjusted for /services/tools

export const reviewTool: ToolHandler = async ({
   toolName,
   params,
   context,
   userInput,
   previousResponseId,
}) => {
   const reviewText =
      typeof params.reviewText === 'string' && params.reviewText.trim()
         ? params.reviewText
         : userInput;

   // Router parity:
   // - Router used Python verification when classification confidence was low.
   // In planner mode we don't have router confidence, so we always verify first.
   try {
      const start = Date.now();
      const verification = await callPythonSentiment(reviewText);
      console.log(
         `[benchmark] python-sentiment latency=${Date.now() - start}ms`
      );
      console.log(
         `[tool:analyzeReview] verification sentiment=${verification.sentiment} confidence=${verification.confidence}`
      );

      if (verification.confidence < 0.6) {
         console.log(
            '[tool:analyzeReview] verification failed -> fallback generalChat'
         );
         const r = await generalChat(context, userInput, previousResponseId);
         return { tool: toolName, success: true, result: r.message };
      }
   } catch (err) {
      console.error('[tool:analyzeReview] Python verification error:', err);
      const r = await generalChat(context, userInput, previousResponseId);
      return { tool: toolName, success: true, result: r.message };
   }

   try {
      const result = await reviewAnalyzerService.analyzeReview(reviewText);
      console.log(
         '[tool:analyzeReview] selfCorrectionApplied:',
         result.selfCorrected
      );
      return { tool: toolName, success: true, result: result.formatted };
   } catch (err) {
      console.error('[tool:analyzeReview] analyzeReview error:', err);
      const r = await generalChat(context, userInput, previousResponseId);
      return { tool: toolName, success: true, result: r.message };
   }
};
