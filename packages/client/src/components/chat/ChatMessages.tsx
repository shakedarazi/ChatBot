import React, { useEffect, useRef } from 'react';
import ReactMarkDown from 'react-markdown';

export type Message = {
   content: string;
   role: 'user' | 'bot';
};

type Props = {
   messages: Message[];
};

const ChatMessages = ({ messages }: Props) => {
   const lastMessageref = useRef<HTMLDivElement | null>(null);
   useEffect(() => {
      lastMessageref.current?.scrollIntoView({ behavior: 'smooth' });
   }, [messages]);
   const onCopyMessage = (e: React.ClipboardEvent) => {
      const selection = window.getSelection()?.toString().trim();
      if (selection) {
         e.preventDefault();
         e.clipboardData.setData('text/plain', selection);
      }
   };
   return (
      <div>
         {messages.map((message, index) => {
            return (
               <div className="flex flex-col gap-3 mb-10 flex items-center">
                  <div
                     key={index}
                     onCopy={onCopyMessage}
                     ref={index === messages.length - 1 ? lastMessageref : null}
                     className={`px-3 py-1 max-w-md rounded-xl ${
                        message.role === 'user'
                           ? ' text-black self-end bg-gradient-to-br from-purple-700 to-blue-900 text-white'
                           : ' text-black self-start bg-gray-100'
                     }`}
                  >
                     {<ReactMarkDown>{message.content}</ReactMarkDown>}
                  </div>
               </div>
            );
         })}
      </div>
   );
};

export default ChatMessages;
