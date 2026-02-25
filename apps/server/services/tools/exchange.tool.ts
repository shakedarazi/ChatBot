// packages/server/services/tools/exchange.tool.ts
import type { ToolHandler } from './utils/index';
import { getExchangeRate } from '../exchange.service';
import { generalChat } from '../general-chat.service';
import { upper3 } from './utils/currency';
import { extractExchangeRateValue } from './utils/numbers';

export const exchangeTool: ToolHandler = async ({
   toolName,
   params,
   context,
   userInput,
   previousResponseId,
}) => {
   const from = upper3(params.from);
   const to = upper3(params.to) ?? 'ILS';

   if (!from) {
      console.log(
         `[tool:getExchangeRate] Missing/invalid 'from' -> fallback generalChat`
      );
      const r = await generalChat(context, userInput, previousResponseId);
      return { tool: toolName, success: true, result: r.message };
   }

   const raw = getExchangeRate(from, to);

   // For placeholders, store the numeric rate (not a leading "1")
   const rateValue = extractExchangeRateValue(raw);
   return { tool: toolName, success: true, result: rateValue ?? raw };
};
