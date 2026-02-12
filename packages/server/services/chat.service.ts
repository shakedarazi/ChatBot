// packages/server/services/chat.service.ts
import { conversationRepository } from '../repositories/conversation.repository';
import { routeMessage } from './router.service';
import { executePlan } from './plan-executor.service';
import { planPlanner } from './planner.service';

type ChatResponse = {
   id: string;
   message: string;
};

export const chatService = {
   async sendMessage(
      prompt: string,
      conversationId: string
   ): Promise<ChatResponse> {
      if (prompt.trim() === '/reset') {
         await conversationRepository.resetAll();
         return {
            id: crypto.randomUUID(),
            message: 'History reset. Starting a fresh chat.',
         };
      }

      const context = conversationRepository.getContext(conversationId);
      const previousResponseId =
         conversationRepository.getLastResponseId(conversationId);

      const usePlan = process.env.USE_PLAN === 'true';
      const plan = usePlan ? await planPlanner(prompt) : null;

      let message: string;
      let responseId: string | undefined;

      if (plan) {
         const result = await executePlan(plan, prompt, context);
         message = result.message;
      } else {
         const routed = await routeMessage(prompt, context, previousResponseId);
         message = routed.message;
         responseId = routed.responseId;
      }

      conversationRepository.addTurn(conversationId, prompt, message);

      if (responseId) {
         conversationRepository.setLastResponseId(conversationId, responseId);
      }

      await conversationRepository.save();

      return { id: crypto.randomUUID(), message };
   },
};
