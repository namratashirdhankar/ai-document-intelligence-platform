import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import pg from 'pg';
import { processDocument } from './process.js';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
new Worker('documents', job => processDocument(job.data, {
  pool,
  ocrUrl: process.env.OCR_URL,
  llmUrl: process.env.LLM_URL
}), { connection, concurrency: 2 });
console.log('worker started');
