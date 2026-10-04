import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';

test('health endpoint returns ok', async () => {
  const app = createApp({ pool: {}, queue: {}, uploadDir: '/tmp/aidoc-test' });
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
  server.close();
});
