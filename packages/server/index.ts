import dotenv from 'dotenv';
import express from 'express';
import router from './routes';
import { initOllama } from './llm/ollama-client';

dotenv.config();

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
