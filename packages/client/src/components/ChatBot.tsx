import React, { useRef, useState } from 'react';
import { Button } from './ui/button';
import { FaArrowUp } from 'react-icons/fa';
import { useForm } from 'react-hook-form';
import { GrEmoji } from 'react-icons/gr';
import axios from 'axios';
import { GoFileSymlinkFile } from 'react-icons/go';

import ReactMarkDown from 'react-markdown';

type FormData = {
   prompt: string;
};

type ChatResponse = {
   message: string;
};

type Message = {
   content: string;
   role: 'user' | 'bot';
};

const ChatBot = () => {
   const [messages, setMessages] = useState<Message[]>([]);
   const conversationId = useRef(crypto.randomUUID());
   const { register, handleSubmit, reset, formState } = useForm<FormData>();

   const onSubmit = async ({ prompt }: FormData) => {
      setMessages((prev) => [...prev, { content: prompt, role: 'user' }]);

      reset();

      const { data } = await axios.post<ChatResponse>('/api/chat', {
         prompt,
         conversationId: conversationId.current,
      });
      setMessages((prev) => [...prev, { content: data.message, role: 'bot' }]);
   };

   const onKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {};

   return (
      <div className="w-full max-w-2xl mx-auto">
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

            <div className="mb-4 rounded-xl bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-3 border  border-gray-100 dark:border-gray-800 min-h-[120px] text-gray-400">
               <div>
                  <div className="flex flex-col gap-3 mb-10 flex items-center">
                     {messages.map((message, index) => (
                        <p
                           key={index}
                           className={`px-3 py-1 rounded-xl ${
                              message.role === 'user'
                                 ? ' text-black self-end bg-gradient-to-br from-purple-700 to-blue-900 text-white'
                                 : ' text-black self-start bg-gray-100'
                           }`}
                        >
                           <ReactMarkDown>{message.content}</ReactMarkDown>
                        </p>
                     ))}
                  </div>
               </div>
            </div>

            <div className="relative flex items-center gap-3">
               {/* Attach / emoji column */}
               <div className="hidden sm:flex flex-col gap-2">
                  <button
                     className="w-10 h-10 rounded-xl flex items-center justify-center border border-gray-100 bg-white hover:shadow-sm"
                     aria-label="attach"
                  >
                     <GoFileSymlinkFile />
                  </button>
                  <button
                     className="w-10 h-10 rounded-xl flex items-center justify-center border border-gray-100 bg-white hover:shadow-sm"
                     aria-label="emoji"
                  >
                     <GrEmoji />
                  </button>
               </div>

               <form
                  onSubmit={handleSubmit(onSubmit)}
                  onKeyDown={onKeyDown}
                  className="flex items-center gap-3 border-2 p-4 rounded-3xl w-full"
               >
                  <textarea
                     {...register('prompt', {
                        required: true,
                        validate: (data) => data.trim().length > 0,
                     })}
                     className="flex-1 border-0 focus:outline-none resize-none min-h-[40px]"
                     placeholder="Ask anything"
                  />
                  <Button
                     disabled={!formState.isValid}
                     className="rounded-full w-9 h-9 flex items-center justify-center"
                  >
                     <FaArrowUp />
                  </Button>
               </form>
            </div>
         </div>
      </div>
   );
};

export default ChatBot;
