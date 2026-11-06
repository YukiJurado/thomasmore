import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';
import { listEmailJobs } from '../../src/repositories/emailRepository.mjs';
import { createMailWorker } from '../../src/services/mailWorker.mjs';

const person = { name: 'Test Student', email: 'student@example.com' };

describe('Registration and durable confirmation emails', () => {
  let app;
  let event;
  beforeEach(async () => {
    ({ app } = await createTestApp());
    event = (await request(app).post('/api/events').send(validEvent({ capacity: 1 }))).body;
  });

  it('returns 201 without waiting for the mail provider, then retries a failed delivery', async () => {
    const response = await request(app).post(`/api/events/${event.id}/registrations`).send(person);
    assert.equal(response.status, 201);
    let clock = Date.now() + 100;
    let attempts = 0;
    const worker = createMailWorker({
      now: () => clock, retryMs: 100,
      send: async () => {
        attempts++;
        if (attempts === 1) throw new Error('provider offline');
      }
    });
    await worker.drain();
    const registrations = await request(app).get(`/api/events/${event.id}/registrations`);
    assert.equal(registrations.body.length, 1);
    assert.equal(registrations.body[0].email, person.email);
    const [failed] = await listEmailJobs();
    assert.equal(failed.attempts, 1);
    assert.equal(failed.sentAt, null);
    await worker.drain();
    assert.equal(attempts, 1, 'retry must respect backoff');
    clock += 101;
    // A new worker simulates a process restarting: pending mail comes from the database.
    const restarted = createMailWorker({ now: () => clock, send: async () => { attempts++; } });
    await restarted.drain();
    assert.ok((await listEmailJobs())[0].sentAt);
    assert.equal(attempts, 2);
    await restarted.drain();
    assert.equal(attempts, 2, 'sent jobs must not be sent again');
  });

  it('does not allow a registration beyond capacity', async () => {
    const url = `/api/events/${event.id}/registrations`;
    assert.equal((await request(app).post(url).send(person)).status, 201);
    const rejected = await request(app).post(url).send({ name: 'Other Student', email: 'other@example.com' });
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.error.message, 'Event is full');
    assert.equal((await listEmailJobs()).length, 1);
  });

  it('serialises concurrent last-seat attempts and queues only one email', async () => {
    const url = `/api/events/${event.id}/registrations`;
    const responses = await Promise.all([
      request(app).post(url).send(person),
      request(app).post(url).send({ name: 'Other Student', email: 'other@example.com' })
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    assert.equal((await listEmailJobs()).length, 1);
  });

  it('does not queue email for a duplicate registration', async () => {
    const url = `/api/events/${event.id}/registrations`;
    await request(app).post(url).send(person);
    assert.equal((await request(app).post(url).send(person)).status, 409);
    assert.equal((await listEmailJobs()).length, 1);
  });

  it('deleting an event also removes its registrations and pending confirmations', async () => {
    await request(app).post(`/api/events/${event.id}/registrations`).send(person);
    assert.equal((await request(app).delete(`/api/events/${event.id}`)).status, 204);
    assert.deepEqual(await listEmailJobs(), []);
  });
});
