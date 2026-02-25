// packages/server/services/tools/general-chat.tool.ts
import type { ToolHandler } from './utils/index';
import { generalChat } from '../general-chat.service';

export const generalChatTool: ToolHandler = async ({
   toolName,
   params,
   context,
   userInput,
   previousResponseId,
}) => {
   const message =
      typeof params.message === 'string' && params.message.trim()
         ? params.message
         : userInput;
   const r = await generalChat(context, message, previousResponseId);
   return { tool: toolName, success: true, result: r.message };
};
