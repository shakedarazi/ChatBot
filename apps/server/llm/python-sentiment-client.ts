// packages/server/llm/python-sentiment-client.ts
// HTTP POST client for Python sentiment microservice

const PY_SERVICE_URL = process.env.PY_SERVICE_URL || 'http://localhost:8000';

type SentimentResponse = {
   sentiment: 'POSITIVE' | 'NEGATIVE';
   confidence: number;
};

export async function callPythonSentiment(
   text: string
): Promise<SentimentResponse> {
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 5000);

   try {
      const response = await fetch(`${PY_SERVICE_URL}/analyze`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ text }),
         signal: controller.signal,
      });

      if (!response.ok) {
         const errorData = (await response.json().catch(() => ({}))) as {
            error?: string;
         };
         throw new Error(
            errorData.error || `Python service error: ${response.status}`
         );
      }

      const data = (await response.json()) as {
         sentiment: string;
         confidence: number;
      };
      const sentiment = data.sentiment === 'NEGATIVE' ? 'NEGATIVE' : 'POSITIVE';
      return {
         sentiment,
         confidence: data.confidence,
      };
   } finally {
      clearTimeout(timeout);
   }
}
