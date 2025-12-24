import axios from 'axios';
import { useRef, useState } from 'react';
import TypingIndicator from './TypingIndicator';
import type { Message } from './ChatMessages';
import ChatMessages from './ChatMessages';
import ChatInput, { type ChatFormData } from './ChatInput';
import popsound from '@/assets/sounds/pop.mp3';
import notificationsound from '@/assets/sounds/notification.mp3';

const popAudion = new Audio(popsound);
popAudion.volume = 0.2;
const notificationAudio = new Audio(notificationsound);
notificationAudio.volume = 0.2;

type ChatResponse = {
   message: string;
};

const ChatBot = () => {
   const [messages, setMessages] = useState<Message[]>([]);
   const [isBotTyping, setIsBotTyping] = useState(false);
   const [error, setError] = useState('');
   const conversationId = useRef(crypto.randomUUID());

   const onSubmit = async ({ prompt }: ChatFormData) => {
      try {
         setMessages((prev) => [...prev, { content: prompt, role: 'user' }]);
         setIsBotTyping(true);
         setError('');
         popAudion.play();

         const { data } = await axios.post<ChatResponse>('/api/chat', {
            prompt,
            conversationId: conversationId.current,
         });
         setMessages((prev) => [
            ...prev,
            { content: data.message, role: 'bot' },
         ]);
         notificationAudio.play();
      } catch (error) {
         console.error(error);
         setError('Something went wrong, try again!');
      } finally {
         setIsBotTyping(false);
      }
   };

   return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 shadow-lg">
         {/* Top bar: title + status */}
         <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-700 to-blue-900 flex items-center justify-center text-white font-semibold shadow-md">
                  SK
               </div>

               <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                     GPT Chat
                  </div>
                  <div className="text-xs text-gray-400">
                     Online · Ready to help
                  </div>
               </div>
            </div>

            <div className="flex items-center gap-2">
               <button className="text-xs px-3 py-1 rounded-full border border-gray-100 bg-gray-50 text-gray-600 hover:shadow-sm">
                  Clear
               </button>
               <button className="text-xs px-3 py-1 rounded-full border border-transparent bg-indigo-50 text-indigo-600">
                  • Online
               </button>
            </div>
         </div>

         <div className="flex flex-col h-full">
            <div className="mb-4 rounded-xl bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-3 border  border-gray-100 dark:border-gray-800  flex flex-col h-full text-gray-400">
               <ChatMessages messages={messages} />
               {isBotTyping && <TypingIndicator />}
               {error && <p className="text-red-500">{error}</p>}
            </div>
            <ChatInput onSubmit={onSubmit} />
         </div>
      </div>
   );
};

export default ChatBot;
