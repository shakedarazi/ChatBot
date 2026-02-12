// packages/server/llm/python-kb-client.ts
// HTTP POST client for Python KB search microservice

const PY_SERVICE_URL = process.env.PY_SERVICE_URL || 'http://localhost:8000';

export type ChunkResult = {
   text: string;
   metadata: {
      source: string;
      chunk_index: number;
   };
   score: number;
};

export type SearchKBResponse = {
   chunks: ChunkResult[];
};

/**
 * Search the knowledge base for relevant chunks
 */
export async function searchKB(
   query: string,
   topK: number = 3
): Promise<SearchKBResponse> {
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

   try {
      const response = await fetch(`${PY_SERVICE_URL}/search_kb`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ query, top_k: topK }),
         signal: controller.signal,
      });

      if (!response.ok) {
         const errorData = (await response.json().catch(() => ({}))) as {
            detail?: string;
         };
         throw new Error(
            errorData.detail || `KB service error: ${response.status}`
         );
      }

      const data = (await response.json()) as SearchKBResponse;
      return {
         chunks: data.chunks || [],
      };
   } catch (err: any) {
      if (err.name === 'AbortError') {
         console.error('[kb-client] timeout searching KB');
         return { chunks: [] };
      }
      console.error('[kb-client] error:', err.message);
      return { chunks: [] };
   } finally {
      clearTimeout(timeout);
   }
}
