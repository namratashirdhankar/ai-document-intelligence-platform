import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { pool, initDb } from './db.js';
import { createApp } from './app.js';

await initDb();
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue('documents', { connection });
const app = createApp({ pool, queue, uploadDir: process.env.UPLOAD_DIR || '/data/uploads' });
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`api listening on ${port}`));
