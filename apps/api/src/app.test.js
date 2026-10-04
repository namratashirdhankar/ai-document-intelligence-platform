import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp } from './app.js';

async function withServer(app, fn) {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('health endpoint returns ok', async () => {
  const app = createApp({ pool: {}, queue: {}, uploadDir: '/tmp/aidoc-test-health' });
  await withServer(app, async base => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

test('upload without a file is rejected', async () => {
  const app = createApp({ pool: {}, queue: {}, uploadDir: '/tmp/aidoc-test-missing' });
  await withServer(app, async base => {
    const res = await fetch(`${base}/documents`, { method: 'POST' });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'file is required' });
  });
});

test('unknown document returns 404', async () => {
  const pool = { query: async () => ({ rows: [] }) };
  const app = createApp({ pool, queue: {}, uploadDir: '/tmp/aidoc-test-notfound' });
  await withServer(app, async base => {
    const res = await fetch(`${base}/documents/00000000-0000-0000-0000-000000000000`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'not found' });
  });
});

test('upload persists metadata and enqueues processing', async () => {
  const uploadDir = '/tmp/aidoc-test-upload';
  fs.rmSync(uploadDir, { recursive: true, force: true });
  const queries = [];
  const jobs = [];
  const pool = { query: async (...args) => { queries.push(args); return { rows: [] }; } };
  const queue = { add: async (...args) => { jobs.push(args); } };
  const app = createApp({ pool, queue, uploadDir });

  await withServer(app, async base => {
    const form = new FormData();
    form.append('file', new Blob(['hello invoice']), 'invoice.txt');
    const res = await fetch(`${base}/documents`, { method: 'POST', body: form });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(body.status, 'queued');
    assert.ok(body.id);

    assert.equal(queries.length, 1);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0][0], 'process-document');
    assert.equal(jobs[0][1].documentId, body.id);
    assert.ok(fs.existsSync(jobs[0][1].filePath));
  });

  fs.rmSync(uploadDir, { recursive: true, force: true });
});
