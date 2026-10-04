import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export function createApp({ pool, queue, uploadDir }) {
  fs.mkdirSync(uploadDir, { recursive: true });
  const upload = multer({ dest: uploadDir, limits: { fileSize: 10 * 1024 * 1024 } });
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.post('/documents', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'file is required' });
      const id = uuidv4();
      const ext = path.extname(req.file.originalname || '');
      const finalPath = path.join(uploadDir, `${id}${ext}`);
      fs.renameSync(req.file.path, finalPath);
      await pool.query(
        'INSERT INTO documents (id, original_name, file_path, status) VALUES ($1,$2,$3,$4)',
        [id, req.file.originalname, finalPath, 'queued']
      );
      await queue.add('process-document', { documentId: id, filePath: finalPath }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
      res.status(202).json({ id, status: 'queued' });
    } catch (e) { next(e); }
  });

  app.get('/documents/:id', async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT id, original_name, status, result, error, created_at, updated_at FROM documents WHERE id=$1', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'not found' });
      res.json(rows[0]);
    } catch (e) { next(e); }
  });

  app.get('/documents', async (_req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT id, original_name, status, result, error, created_at, updated_at FROM documents ORDER BY created_at DESC LIMIT 100');
      res.json(rows);
    } catch (e) { next(e); }
  });

  app.use((err, _req, res, _next) => res.status(500).json({ error: err.message || 'internal error' }));
  return app;
}
