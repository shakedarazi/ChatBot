// packages/server/services/chat.service.ts
import { conversationRepository } from '../repositories/conversation.repository';
import { executePlan } from './plan-executor.service';
import { planPlanner } from './planner.service';
import { generalChat } from './general-chat.service';

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

      // Planner-first: Router is no longer used anywhere in the project.
      // If the planner fails to produce a valid plan, we fall back to generalChat.
      const plan = await planPlanner(prompt);

      let message: string;
      if (plan) {
         const result = await executePlan(plan, prompt, context);
         message = result.message;
      } else {
         const fallback = await generalChat(context, prompt);
         message = fallback.message;
      }

      conversationRepository.addTurn(conversationId, prompt, message);
      await conversationRepository.save();

      return { id: crypto.randomUUID(), message };
   },
};
