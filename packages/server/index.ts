/**
 * ChatBot Server Entry Point (bootstrap only).
 * Orchestration flow: POST /api/chat → chat.controller → chat.service.sendMessage
 *   → (USE_PLAN=true) planPlanner → executePlan | routeMessage (fallback)
 *   → (USE_PLAN≠true) routeMessage
 * No business logic here; wiring only.
 */
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import router from './routes';
import { initOllama } from './llm/ollama-client';

dotenv.config({ path: path.join(import.meta.dir, '.env') });

const app = express();
app.use(express.json());
app.use(router);

const port = process.env.PORT || 3000;

// Initialize services and start server
async function start() {
   // Check Ollama availability at startup (non-blocking, logs status)
   await initOllama();

   app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
   });
}

start();
