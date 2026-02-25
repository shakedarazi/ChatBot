// packages/server/services/tools/weather.tool.ts
import type { ToolHandler } from './utils/index';
import { getWeather } from '../weather.service';
import { generalChat } from '../general-chat.service';

export const weatherTool: ToolHandler = async ({
   toolName,
   params,
   context,
   userInput,
   previousResponseId,
}) => {
   const city = params.city;

   if (!city || typeof city !== 'string') {
      console.log(`[tool:getWeather] Missing city -> fallback generalChat`);
      const r = await generalChat(context, userInput, previousResponseId);
      return { tool: toolName, success: true, result: r.message };
   }

   const result = await getWeather(city);
   return { tool: toolName, success: true, result };
};
