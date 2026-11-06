import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';
import { createEvent, deleteEvent, findAllEvents } from '../../src/repositories/eventRepository.mjs';
import { listRegistrations } from '../../src/repositories/registrationRepository.mjs';
import { seedDemoData } from '../../src/repositories/demoRepository.mjs';

it('can seed an empty database whose event ID counter has already advanced', async () => {
  await createTestApp();
  const old = await createEvent(validEvent());
  await deleteEvent(old.id);
  await seedDemoData();
  const events = await findAllEvents();
  assert.equal(events.length, 4);
  const welcome = events.find((event) => event.title === 'Welcome Day IXD');
  const prototyping = events.find((event) => event.title === 'Prototyping with Figma & APIs');
  assert.ok(welcome.id > old.id);
  assert.equal((await listRegistrations(welcome.id)).length, 2);
  assert.equal((await listRegistrations(prototyping.id)).length, 1);
});
