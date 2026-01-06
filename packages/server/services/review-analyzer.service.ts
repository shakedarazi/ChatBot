// packages/server/services/review-analyzer.service.ts
import { llmClient } from '../llm/client';
import { REVIEW_ANALYZER_PROMPT, REVIEW_FIX_PROMPT } from '../prompts';
import { z } from 'zod';

const sentimentEnum = z.enum(['Positive', 'Negative', 'Neutral', 'Mixed']);
const aspectSentimentEnum = z.enum(['Positive', 'Negative', 'Neutral']);

const aspectSchema = z.object({
   topic: z.string().min(1),
   sentiment: aspectSentimentEnum,
   detail: z.string().min(1),
});

const reviewAnalysisSchema = z.object({
   summary: z.string().min(1),
   overall_sentiment: sentimentEnum,
   score: z.number().int().min(1).max(10),
   aspects: z.array(aspectSchema),
});

export type ReviewAnalysis = z.infer<typeof reviewAnalysisSchema>;

function safeParseJson(text: string): any | null {
   try {
      return JSON.parse(text);
   } catch {
      return null;
   }
}

function needsSelfCorrection(a: ReviewAnalysis): boolean {
   return a.score < 4 && a.overall_sentiment === 'Positive';
}

async function callAnalyzer(reviewText: string): Promise<ReviewAnalysis> {
   const response = await llmClient.generateText({
      model: 'gpt-4.1',
      instructions: REVIEW_ANALYZER_PROMPT,
      prompt: reviewText,
      temperature: 0.2,
      maxTokens: 700,
   });

   // Debug (optional)
   console.log('[review] analyzer raw json:', response.text);

   const parsed = safeParseJson(response.text);
   if (!parsed) {
      throw new Error('Review analyzer did not return valid JSON.');
   }

   const validated = reviewAnalysisSchema.safeParse(parsed);
   if (!validated.success) {
      console.log('[review] analyzer schema error:', validated.error.flatten());
      throw new Error('Review analyzer returned invalid schema.');
   }

   return validated.data;
}

async function callFixer(
   reviewText: string,
   badJson: ReviewAnalysis
): Promise<ReviewAnalysis> {
   const fixPrompt = `Original review:
${reviewText}

Bad analysis JSON:
${JSON.stringify(badJson)}

Inconsistency detected:
You detected a Positive sentiment but gave a score of ${badJson.score}. Please fix this inconsistency based on the review.
Return corrected JSON only.`;

   const response = await llmClient.generateText({
      model: 'gpt-4.1',
      instructions: REVIEW_FIX_PROMPT,
      prompt: fixPrompt,
      temperature: 0,
      maxTokens: 700,
   });

   console.log('[review] fixer raw json:', response.text);

   const parsed = safeParseJson(response.text);
   if (!parsed) {
      throw new Error('Review fixer did not return valid JSON.');
   }

   const validated = reviewAnalysisSchema.safeParse(parsed);
   if (!validated.success) {
      console.log('[review] fixer schema error:', validated.error.flatten());
      throw new Error('Review fixer returned invalid schema.');
   }

   return validated.data;
}

export function formatReviewAnalysisForUser(a: ReviewAnalysis): string {
   const lines: string[] = [];
   lines.push('Analyzing Review...');
   lines.push('');
   lines.push(`Summary: ${a.summary}`);
   lines.push(`Overall Sentiment: ${a.overall_sentiment}`);
   lines.push(`Score: ${a.score}/10`);
   lines.push('');
   lines.push('Detailed Aspects:');
   if (!a.aspects.length) {
      lines.push('  (No clear aspects detected.)');
      return lines.join('\n');
   }

   a.aspects.forEach((x, i) => {
      lines.push(`  ${i + 1}. ${x.topic} (${x.sentiment}): "${x.detail}"`);
   });

   return lines.join('\n');
}

export const reviewAnalyzerService = {
   async analyzeReview(reviewText: string): Promise<{
      analysis: ReviewAnalysis;
      formatted: string;
      selfCorrected: boolean;
   }> {
      const analysis1 = await callAnalyzer(reviewText);

      if (!needsSelfCorrection(analysis1)) {
         return {
            analysis: analysis1,
            formatted: formatReviewAnalysisForUser(analysis1),
            selfCorrected: false,
         };
      }

      // Self-correction: only once
      const fixed = await callFixer(reviewText, analysis1);

      return {
         analysis: fixed,
         formatted: formatReviewAnalysisForUser(fixed),
         selfCorrected: true,
      };
   },
};
