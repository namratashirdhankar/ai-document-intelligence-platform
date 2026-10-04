import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { processDocument } from './process.js';

test('worker executes OCR then LLM and marks completed', async () => {
  const file = '/tmp/aidoc-worker-test.txt';
  fs.writeFileSync(file, 'fake');
  const calls = [];
  const pool = { query: async (sql, args) => { calls.push([sql,args]); return { rows: [] }; } };
  let n = 0;
  const fetchFn = async () => (++n === 1)
    ? new Response(JSON.stringify({ text: 'Invoice INV-1 Total 100' }), { status: 200, headers: {'content-type':'application/json'} })
    : new Response(JSON.stringify({ documentType:'invoice', total:100 }), { status: 200, headers: {'content-type':'application/json'} });
  const result = await processDocument({ documentId:'00000000-0000-0000-0000-000000000001', filePath:file }, { pool, ocrUrl:'http://ocr', llmUrl:'http://llm', fetchFn });
  assert.equal(result.total, 100);
  assert.ok(calls.some(([sql]) => sql.includes("status='completed'")));
});

test('worker marks document failed when OCR fails', async () => {
  const file = '/tmp/aidoc-worker-failure.txt';
  fs.writeFileSync(file, 'fake');
  const calls = [];
  const pool = { query: async (sql, args) => { calls.push([sql,args]); return { rows: [] }; } };
  const fetchFn = async () => new Response('bad gateway', { status: 502 });

  await assert.rejects(
    () => processDocument(
      { documentId:'00000000-0000-0000-0000-000000000002', filePath:file },
      { pool, ocrUrl:'http://ocr', llmUrl:'http://llm', fetchFn }
    ),
    /OCR failed: 502/
  );

  assert.ok(calls.some(([sql]) => sql.includes("status='failed'")));
});
