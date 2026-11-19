import assert from 'node:assert/strict';
import { beforeEach, it } from 'node:test';
import request from 'supertest';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';
import { createApp } from '../../src/app.mjs';
import { listen, openNotifications } from '../helpers/liveServer.mjs';
import { createMailWorker } from '../../src/services/mailWorker.mjs';
import { EmailJob } from '../../src/db/index.mjs';

beforeEach(createTestApp);

it('keeps notifying remaining browsers after another browser disconnects', async (t) => {
  const app = createApp(); const server = await listen(app);
  const a = await openNotifications(server.url); const b = await openNotifications(server.url);
  t.after(async () => { await a.close(); await b.close(); await server.close(); });
  await a.close();
  assert.equal((await request(app).post('/api/events').send(validEvent())).status, 201);
  await b.waitFor(1);
  assert.equal(b.messages[0].type, 'event.created');
  assert.deepEqual(a.messages, []);
});

it('notifies two browser connections exactly once per registration, without participant data', async (t) => {
  const app = createApp(); const server = await listen(app);
  const a = await openNotifications(server.url); const b = await openNotifications(server.url);
  t.after(async () => { await a.close(); await b.close(); await server.close(); });
  const event = (await request(app).post('/api/events').send(validEvent())).body;
  const url = `/api/events/${event.id}/registrations`;
  const participant = { name: 'Private Student Name', email: 'private@example.com' };
  assert.equal((await request(app).post(url).send(participant)).status, 201);
  assert.equal((await request(app).post(url).send(participant)).status, 409);
  await request(app).patch(`/api/events/${event.id}`).send({ title: 'Edited event' });
  await createMailWorker({ send: async () => {} }).drain();
  // A later creation is a stream-order barrier: no extra toast is produced by editing,
  // duplicate rejection, or confirmation-email delivery between these two events.
  await request(app).post('/api/events').send(validEvent({ title: 'Barrier event' }));
  await a.waitFor(3); await b.waitFor(3);
  assert.deepEqual(a.messages, b.messages);
  assert.deepEqual(a.messages.map((message) => message.type), ['event.created', 'registration.created', 'event.created']);
  for (const message of a.messages) {
    assert.deepEqual(Object.keys(message.data), ['eventId']);
    assert.match(message.id, /^[a-f0-9-]{36}$/);
  }
  assert.equal(new Set(a.messages.map((message) => message.id)).size, 3);
  assert.ok(!JSON.stringify(a.messages).includes(participant.name));
  assert.ok(!JSON.stringify(a.messages).includes(participant.email));
});

it('does not broadcast a registration when its transaction rolls back', async (t) => {
  const app = createApp(); const server = await listen(app);
  const browser = await openNotifications(server.url);
  t.after(async () => { await browser.close(); await server.close(); });
  const event = (await request(app).post('/api/events').send(validEvent())).body;
  t.mock.method(EmailJob, 'create', async () => { throw new Error('Outbox unavailable'); });
  const failed = await request(app).post(`/api/events/${event.id}/registrations`).send({ name: 'Student', email: 'student@example.com' });
  assert.equal(failed.status, 500);
  assert.deepEqual((await request(app).get(`/api/events/${event.id}/registrations`)).body, []);
  await request(app).post('/api/events').send(validEvent());
  await browser.waitFor(2);
  assert.deepEqual(browser.messages.map((message) => message.type), ['event.created', 'event.created']);
});
