// packages/server/llm/ollama-client.ts
// HTTP fetch to Ollama /api/generate (NOT using ollama npm SDK)

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// Track Ollama availability (determined at startup)
let ollamaAvailable: boolean | null = null;
let availableModels: string[] = [];

type CallOllamaOptions = {
   prompt: string;
   system?: string;
   model?: string;
   temperature?: number;
   timeoutMs?: number;
};

/**
 * Check Ollama health by querying /api/tags
 * Returns list of available models or empty array if unreachable
 */
export async function checkOllamaHealth(): Promise<{
   available: boolean;
   models: string[];
}> {
   try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${OLLAMA_URL}/api/tags`, {
         method: 'GET',
         signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
         return { available: false, models: [] };
      }

      const data = (await response.json()) as {
         models?: Array<{ name?: string; model?: string }>;
      };
      const models = (data.models || [])
         .map((m) => m.name || m.model || '')
         .filter(Boolean) as string[];

      ollamaAvailable = true;
      availableModels = models;

      return { available: true, models };
   } catch {
      ollamaAvailable = false;
      availableModels = [];
      return { available: false, models: [] };
   }
}

/**
 * Initialize Ollama client - call this at server startup
 * Optionally warms up the model to avoid cold-start latency
 */
export async function initOllama(): Promise<void> {
   console.log(`[ollama] Checking availability at ${OLLAMA_URL}...`);

   const { available, models } = await checkOllamaHealth();

   if (!available) {
      console.warn(
         '[ollama] ⚠️  Ollama not available - will fallback to OpenAI for LLM calls'
      );
      console.warn(
         '[ollama] To use local inference, ensure Ollama is installed and running'
      );
      return;
   }

   console.log(`[ollama] ✓ Connected to Ollama`);
   console.log(
      `[ollama] Available models: ${models.length > 0 ? models.join(', ') : '(none)'}`
   );

   // Check if configured model is available
   const configuredModel = OLLAMA_MODEL;
   const modelAvailable = models.some(
      (m) => m.startsWith(configuredModel) || m === configuredModel
   );

   if (!modelAvailable && models.length > 0) {
      console.warn(
         `[ollama] ⚠️  Model "${configuredModel}" not found. Available: ${models.join(', ')}`
      );
      console.warn(
         `[ollama] Set OLLAMA_MODEL env var to use a different model`
      );
   } else if (modelAvailable) {
      console.log(`[ollama] Using model: ${configuredModel}`);

      // Warm up the model to avoid cold-start latency on first request
      console.log(`[ollama] Warming up model (this may take a moment)...`);
      try {
         const warmupStart = Date.now();
         await callOllama({
            prompt: 'Hi',
            timeoutMs: 60000, // 60s for warmup (model loading)
         });
         console.log(
            `[ollama] ✓ Model warmed up in ${Date.now() - warmupStart}ms`
         );
      } catch (err: any) {
         console.warn(`[ollama] ⚠️  Warmup failed: ${err.message}`);
         console.warn(`[ollama] First requests may be slow or timeout`);
      }
   }
}

/**
 * Check if Ollama is available (based on startup check)
 */
export function isOllamaAvailable(): boolean {
   return ollamaAvailable === true;
}

/**
 * Get configured Ollama model
 */
export function getOllamaModel(): string {
   return OLLAMA_MODEL;
}

export async function callOllama({
   prompt,
   system,
   model = OLLAMA_MODEL,
   temperature = 0,
   timeoutMs = 30000, // 30s default - local models need time
}: CallOllamaOptions): Promise<{ text: string }> {
   // Quick fail if Ollama was determined unavailable at startup
   if (ollamaAvailable === false) {
      throw new Error('Ollama not available');
   }

   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), timeoutMs);

   try {
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            model,
            prompt,
            system,
            temperature,
            stream: false,
         }),
         signal: controller.signal,
      });

      if (!response.ok) {
         const errorText = await response.text().catch(() => '');
         throw new Error(
            `Ollama error: ${response.status} ${response.statusText} - ${errorText}`
         );
      }

      const data = (await response.json()) as { response?: string };
      return { text: data.response ?? '' };
   } finally {
      clearTimeout(timeout);
   }
}
