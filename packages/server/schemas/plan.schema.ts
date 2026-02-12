// packages/server/schemas/plan.schema.ts
import { z } from 'zod';

// Tool call schema for individual tool invocations
export const toolCallSchema = z.object({
   tool: z.enum([
      'getWeather',
      'getExchangeRate',
      'calculateMath',
      'analyzeReview',
      'getProductInformation',
      'generalChat',
   ]),
   parameters: z.record(z.any()),
});

// Router plan schema - the output from the planner
export const routerPlanSchema = z.object({
   plan: z.array(toolCallSchema).min(1).max(5),
   final_answer_synthesis_required: z.boolean(),
});

// Type exports
export type ToolCall = z.infer<typeof toolCallSchema>;
export type RouterPlan = z.infer<typeof routerPlanSchema>;

// Tool result schema for execution results
export type ToolResult = {
   tool: string;
   success: boolean;
   result: string | number | null;
   error?: string;
};

// Result store type for plan executor
export type ResultStore = Map<number, ToolResult>;
