// packages/server/services/general-chat.service.ts
import type { ChatMessage } from '../repositories/conversation.repository';
import { llmClient } from '../llm/client';
import { GENERAL_CHAT_PROMPT } from '../prompts';

type GeneralChatResult = {
   message: string;
   responseId: string;
};

function buildTranscript(messages: ChatMessage[]): string {
   return messages
      .map((m) =>
         m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`
      )
      .join('\n');
}

function isBlockedByGuardrails(input: string): boolean {
   const s = input.toLowerCase();

   // Politics-related content (broad detection, sufficient for assignment)
   const politics =
      /\b(election|vote|president|prime minister|government|left|right|politic|biden|trump|netanyahu|gantz)\b/.test(
         s
      ) || /politics|elections|government|parliament/.test(s);

   // Malware / hacking related content
   const malware =
      /\b(malware|virus|trojan|ransomware|keylogger|steal password|phishing|exploit|hack)\b/.test(
         s
      );

   return politics || malware;
}

export async function generalChat(
   context: ChatMessage[],
   userInput: string,
   previousResponseId?: string
): Promise<GeneralChatResult> {
   // Guardrails: block unsafe requests deterministically
   if (isBlockedByGuardrails(userInput)) {
      return {
         message: 'I cannot process this request: due to safety protocols.',
         responseId: crypto.randomUUID(),
      };
   }

   const transcript = buildTranscript(context);
   const prompt = transcript.length
      ? `${transcript}\nUser: ${userInput}\nAssistant:`
      : `User: ${userInput}\nAssistant:`;

   const response = await llmClient.generateText({
      model: 'gpt-4.1',
      instructions: GENERAL_CHAT_PROMPT,
      prompt,
      temperature: 0.7,
      maxTokens: 300,
      // previousResponseId is used ONLY here to preserve conversational continuity
      previousResponseId,
   });

   return {
      message: response.text,
      responseId: response.id,
   };
}
