// packages/server/services/tools/math.tool.ts
import type { ToolHandler } from './utils/index';
import { calculateMath } from '../math.service';
import { translateWordProblemToExpression } from '../math-translator.service';
import { generalChat } from '../general-chat.service';
import { extractNumericValue } from './utils/numbers';

export const mathTool: ToolHandler = async ({
   toolName,
   params,
   context,
   userInput,
   previousResponseId,
}) => {
   const expression = params.expression;
   const textProblem = params.textProblem;

   // Expression path
   if (typeof expression === 'string' && expression.trim()) {
      if (expression.includes('ERROR')) {
         console.log(
            `[tool:calculateMath] Dependency ERROR -> fallback generalChat`
         );
         const r = await generalChat(context, userInput, previousResponseId);
         return { tool: toolName, success: true, result: r.message };
      }

      const result = calculateMath(expression);
      const num = extractNumericValue(result);
      return { tool: toolName, success: true, result: num ?? result };
   }

   // Word-problem path
   if (typeof textProblem === 'string' && textProblem.trim()) {
      const translated = await translateWordProblemToExpression(textProblem);

      if (!translated.expression) {
         // Router behavior: friendly message instead of failure
         return {
            tool: toolName,
            success: true,
            result:
               'I could not translate the word problem into a safe math expression.',
         };
      }

      const result = calculateMath(translated.expression);
      const num = extractNumericValue(result);
      return { tool: toolName, success: true, result: num ?? result };
   }

   // Missing inputs -> router-like soft fallback
   console.log(
      `[tool:calculateMath] Missing expression/textProblem -> fallback generalChat`
   );
   const r = await generalChat(context, userInput, previousResponseId);
   return { tool: toolName, success: true, result: r.message };
};
