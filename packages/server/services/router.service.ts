// packages/server/services/router.service.ts
import type { ChatMessage } from '../repositories/conversation.repository';
import { classifyIntent } from './classifier.service';
import { getWeather } from './weather.service';
import { calculateMath } from './math.service';
import { getExchangeRate } from './exchange.service';
import { generalChat } from './general-chat.service';
import { translateWordProblemToExpression } from './math-translator.service';
import { reviewAnalyzerService } from './review-analyzer.service';

export type RouteResult = { message: string; responseId?: string };

function upper3(x: any): string | null {
   if (typeof x !== 'string') return null;
   const v = x.trim().toUpperCase();
   return /^[A-Z]{3}$/.test(v) ? v : null;
}

export async function routeMessage(
   userInput: string,
   context: ChatMessage[],
   previousResponseId?: string
): Promise<RouteResult> {
   const decision = await classifyIntent(userInput);

   console.log('[router] decision:', decision);

   // אם ממש לא בטוח – fallback ל-generalChat
   if (decision.confidence < 0.45) {
      const r = await generalChat(context, userInput, previousResponseId);
      return { message: r.message, responseId: r.responseId };
   }

   if (decision.intent === 'analyzeReview') {
      const reviewText =
         typeof decision.parameters?.reviewText === 'string' &&
         decision.parameters.reviewText.trim()
            ? decision.parameters.reviewText
            : userInput;

      try {
         const result = await reviewAnalyzerService.analyzeReview(reviewText);

         console.log('[review] selfCorrectionApplied:', result.selfCorrected);

         // Note: no responseId here (stateless analysis, no conversational continuity needed)
         return { message: result.formatted };
      } catch (err) {
         console.error('[review] analyzeReview error:', err);
         // graceful fallback (still comply with system stability)
         const r = await generalChat(context, userInput, previousResponseId);
         return { message: r.message, responseId: r.responseId };
      }
   }

   if (decision.intent === 'getWeather') {
      const city =
         typeof decision.parameters?.city === 'string'
            ? decision.parameters.city
            : null;
      if (!city) {
         const r = await generalChat(context, userInput, previousResponseId);
         return { message: r.message, responseId: r.responseId };
      }
      return { message: await getWeather(city) };
   }

   if (decision.intent === 'getExchangeRate') {
      const from = upper3(decision.parameters?.from);
      const to = upper3(decision.parameters?.to) ?? 'ILS';
      if (!from) {
         const r = await generalChat(context, userInput, previousResponseId);
         return { message: r.message, responseId: r.responseId };
      }
      return { message: getExchangeRate(from, to) };
   }

   if (decision.intent === 'calculateMath') {
      const expression =
         typeof decision.parameters?.expression === 'string'
            ? decision.parameters.expression
            : null;
      const textProblem =
         typeof decision.parameters?.textProblem === 'string'
            ? decision.parameters.textProblem
            : null;

      if (expression && expression.trim()) {
         return { message: calculateMath(expression) };
      }

      if (textProblem && textProblem.trim()) {
         const translated = await translateWordProblemToExpression(textProblem);
         if (!translated.expression) {
            return {
               message:
                  'I could not translate the word problem into a safe math expression.',
            };
         }
         return { message: calculateMath(translated.expression) };
      }

      // fallback
      const r = await generalChat(context, userInput, previousResponseId);
      return { message: r.message, responseId: r.responseId };
   }

   // generalChat
   const r = await generalChat(context, userInput, previousResponseId);
   return { message: r.message, responseId: r.responseId };
}
