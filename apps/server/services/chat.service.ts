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
      const previousResponseId =
         conversationRepository.getLastResponseId(conversationId);

      const plan = await planPlanner(prompt);

      let message: string;
      let responseId: string | undefined;

      if (plan) {
         const result = await executePlan(
            plan,
            prompt,
            context,
            previousResponseId
         );
         message = result.message;
      } else {
         // If planning fails, fallback to generalChat directly.
         const r = await generalChat(context, prompt, previousResponseId);
         message = r.message;
         responseId = r.responseId;
      }

      conversationRepository.addTurn(conversationId, prompt, message);

      if (responseId) {
         conversationRepository.setLastResponseId(conversationId, responseId);
      }

      await conversationRepository.save();
      return { id: crypto.randomUUID(), message };
   },
};
