import assert from 'node:assert/strict';
import { it } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

it('preserves registrations and pending email across a real application-process restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'campus-persistence-'));
  try {
    const fixture = fileURLToPath(new URL('../fixtures/persistRegistration.mjs', import.meta.url));
    const options = { env: {
      ...process.env, NODE_ENV: 'test', DB_STORAGE: join(directory, 'events.sqlite')
    } };
    const run = promisify(execFile);
    const first = await run(process.execPath, [fixture, 'write'], options);
    const restarted = await run(process.execPath, [fixture, 'read'], options);
    const expected = { events: 1, registrations: 1, pendingEmails: 1 };
    assert.deepEqual(JSON.parse(first.stdout), expected);
    assert.deepEqual(JSON.parse(restarted.stdout), expected);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
