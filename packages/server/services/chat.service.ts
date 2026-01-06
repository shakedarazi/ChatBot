// packages/server/services/chat.service.ts
import { conversationRepository } from '../repositories/conversation.repository';
import { routeMessage } from './router.service';

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

      const routed = await routeMessage(prompt, context, previousResponseId);

      conversationRepository.addTurn(conversationId, prompt, routed.message);

      if (routed.responseId) {
         conversationRepository.setLastResponseId(
            conversationId,
            routed.responseId
         );
      }

      await conversationRepository.save();

      return { id: crypto.randomUUID(), message: routed.message };
   },
};
