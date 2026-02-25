// packages/server/services/tools/product.tool.ts
import type { ToolHandler } from './utils/index';
import { getProductInformation } from '../product-info.service';
import { generalChat } from '../general-chat.service';
import { extractNumericValue } from './utils/numbers';

export const productTool: ToolHandler = async ({
   toolName,
   params,
   context,
   userInput,
   previousResponseId,
}) => {
   const productName =
      typeof params.product_name === 'string' && params.product_name.trim()
         ? params.product_name.trim()
         : null;

   // Router default
   const query =
      typeof params.query === 'string' && params.query.trim()
         ? params.query.trim()
         : 'specs';

   if (!productName) {
      console.log(
         `[tool:getProductInformation] Missing product_name -> fallback generalChat`
      );
      const r = await generalChat(context, userInput, previousResponseId);
      return { tool: toolName, success: true, result: r.message };
   }

   try {
      const result = await getProductInformation(productName, query, userInput);

      return { tool: toolName, success: true, result };
   } catch (err: any) {
      console.error(
         '[tool:getProductInformation] error:',
         err?.message ?? String(err)
      );
      const r = await generalChat(context, userInput, previousResponseId);
      return { tool: toolName, success: true, result: r.message };
   }
};
