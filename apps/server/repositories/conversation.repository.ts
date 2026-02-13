// packages/server/repositories/conversation.repository.ts
export type ChatMessage = {
   role: 'user' | 'assistant';
   content: string;
};

type ConversationState = {
   messages: ChatMessage[];
   lastResponseId?: string; // for OpenAI Responses API chaining (generalChat only)
};

type Store = Record<string, ConversationState>;

const HISTORY_FILE = 'history.json';

let store: Store = {};

// Load history on startup
async function loadFromDisk() {
   try {
      const file = Bun.file(HISTORY_FILE);
      const exists = await file.exists();
      if (!exists) {
         store = {};
         return;
      }

      const text = await file.text();
      store = JSON.parse(text) as Store;
      console.log('[memory] Welcome back! Loaded history.json');
   } catch (err) {
      console.error(
         '[memory] Failed to load history.json, starting fresh.',
         err
      );
      store = {};
   }
}

// Save history to disk
async function saveToDisk() {
   try {
      await Bun.write(HISTORY_FILE, JSON.stringify(store, null, 2));
   } catch (err) {
      console.error('[memory] Failed to save history.json', err);
   }
}

// initialize load immediately (top-level await supported in Bun)
await loadFromDisk();

function ensureConversation(conversationId: string): ConversationState {
   if (!store[conversationId]) {
      store[conversationId] = { messages: [] };
   }
   return store[conversationId];
}

export const conversationRepository = {
   getContext(conversationId: string): ChatMessage[] {
      return ensureConversation(conversationId).messages;
   },

   addTurn(conversationId: string, userInput: string, assistantOutput: string) {
      const conv = ensureConversation(conversationId);
      conv.messages.push({ role: 'user', content: userInput });
      conv.messages.push({ role: 'assistant', content: assistantOutput });
   },

   getLastResponseId(conversationId: string): string | undefined {
      return ensureConversation(conversationId).lastResponseId;
   },

   setLastResponseId(conversationId: string, responseId: string) {
      const conv = ensureConversation(conversationId);
      conv.lastResponseId = responseId;
   },

   async save() {
      await saveToDisk();
   },

   async resetAll() {
      store = {};
      try {
         const file = Bun.file(HISTORY_FILE);
         const exists = await file.exists();
         if (exists) {
            await Bun.write(HISTORY_FILE, ''); // overwrite first (safe)
            await file.delete();
         }
      } catch (err) {
         // If delete fails, we still clear in-memory store.
         console.error('[memory] Failed to delete history.json', err);
      }
   },
};
