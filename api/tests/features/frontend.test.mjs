import assert from 'node:assert/strict';
import { it } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../../src/app.mjs';

it('serves the built frontend and Vue deep links while preserving JSON API 404s', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'campus-frontend-'));
  try {
    await writeFile(join(directory, 'index.html'), '<html><body>Campus Events</body></html>');
    const app = createApp({ webDirectory: directory });
    for (const url of ['/', '/events/new', '/events/123', '/stats']) {
      const response = await request(app).get(url);
      assert.equal(response.status, 200);
      assert.match(response.headers['content-type'], /text\/html/);
      assert.match(response.text, /Campus Events/);
    }
    const missing = await request(app).get('/api/missing');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'NOT_FOUND');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
