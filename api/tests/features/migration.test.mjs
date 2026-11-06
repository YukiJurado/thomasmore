import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';
import { importSnapshot } from '../../src/repositories/migrationRepository.mjs';
import { createEvent, findAllEvents } from '../../src/repositories/eventRepository.mjs';
import { listRegistrations } from '../../src/repositories/registrationRepository.mjs';
import { listEmailJobs } from '../../src/repositories/emailRepository.mjs';

function snapshot(eventId = 10) {
  return { events: [{ id: 10, ...validEvent() }], registrations: [{
    id: 20, eventId, name: 'Existing Student', email: 'existing@example.com'
  }] };
}

it('imports existing event and registration IDs without resending old confirmations', async () => {
  await createTestApp();
  assert.deepEqual(await importSnapshot(snapshot()), { events: 1, registrations: 1 });
  assert.equal((await listRegistrations(10))[0].id, 20);
  assert.deepEqual(await listEmailJobs(), []);
  assert.ok((await createEvent(validEvent())).id > 10);
});

it('refuses to overwrite a database that already has events', async () => {
  await createTestApp();
  await createEvent(validEvent());
  await assert.rejects(importSnapshot(snapshot()), /empty target database/);
  assert.equal((await findAllEvents()).length, 1);
});

it('rolls back imported events if a registration refers to a missing event', async () => {
  await createTestApp();
  await assert.rejects(importSnapshot(snapshot(999)));
  assert.deepEqual(await findAllEvents(), []);
});
