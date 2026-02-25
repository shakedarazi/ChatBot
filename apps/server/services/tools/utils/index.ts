// packages/server/services/tools/index.ts
import type { ChatMessage } from '../../../repositories/conversation.repository';
import type { ToolResult } from '../../../schemas/plan.schema';

import { weatherTool } from '../weather.tool';
import { exchangeTool } from '../exchange.tool';
import { mathTool } from '../math.tool';
import { productTool } from '../product.tool';
import { reviewTool } from '../review.tool';
import { generalChatTool } from '../general-chat.tool';

export type ToolHandlerArgs = {
   toolName: string;
   params: Record<string, any>;
   context: ChatMessage[];
   userInput: string;
   previousResponseId?: string;
};

export type ToolHandler = (args: ToolHandlerArgs) => Promise<ToolResult>;

export const toolHandlers: Record<string, ToolHandler> = {
   getWeather: weatherTool,
   getExchangeRate: exchangeTool,
   calculateMath: mathTool,
   getProductInformation: productTool,
   analyzeReview: reviewTool,
   generalChat: generalChatTool,
};
