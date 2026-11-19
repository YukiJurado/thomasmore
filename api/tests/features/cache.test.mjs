import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';
import { createResponseCache } from '../../src/cache/responseCache.mjs';
import { EventEmitter } from 'node:events';

describe('GET cache and write invalidation', () => {
  let app;
  beforeEach(async () => { ({ app } = await createTestApp()); });

  it('caches successful event lists and invalidates them after creation', async () => {
    assert.equal((await request(app).get('/api/events')).headers['x-cache'], 'MISS');
    assert.equal((await request(app).get('/api/events')).headers['x-cache'], 'HIT');
    const created = await request(app).post('/api/events').send(validEvent());
    assert.equal(created.status, 201);
    const fresh = await request(app).get('/api/events');
    assert.equal(fresh.headers['x-cache'], 'MISS');
    assert.equal(fresh.body.length, 1);
    assert.equal(fresh.headers['cache-control'], 'no-store');
  });

  it('invalidates details, registrations and stats after registration', async () => {
    const event = (await request(app).post('/api/events').send(validEvent())).body;
    const urls = [`/api/events/${event.id}`, `/api/events/${event.id}/registrations`, '/api/stats'];
    for (const url of urls) {
      assert.equal((await request(app).get(url)).headers['x-cache'], 'MISS');
      assert.equal((await request(app).get(url)).headers['x-cache'], 'HIT');
    }
    const saved = await request(app).post(urls[1]).send({ name: 'Student', email: 'student@example.com' });
    assert.equal(saved.status, 201);
    for (const url of urls) assert.equal((await request(app).get(url)).headers['x-cache'], 'MISS');
    assert.equal((await request(app).get(urls[0])).body.registered, 1);
    assert.equal((await request(app).get(urls[0])).body.spotsLeft, 9);
    assert.equal((await request(app).get(urls[1])).body.length, 1);
    assert.equal((await request(app).get('/api/stats')).body[0].registered, 1);
  });

  it('invalidates cached values after update and deletion without caching 404 responses', async () => {
    const event = (await request(app).post('/api/events').send(validEvent())).body;
    const url = `/api/events/${event.id}`;
    await request(app).get(url);
    assert.equal((await request(app).get(url)).headers['x-cache'], 'HIT');
    await request(app).patch(url).send({ title: 'Updated event' });
    const updated = await request(app).get(url);
    assert.equal(updated.headers['x-cache'], 'MISS');
    assert.equal(updated.body.title, 'Updated event');
    await request(app).get('/api/stats');
    await request(app).delete(url);
    for (let n = 0; n < 2; n++) {
      const missing = await request(app).get(url);
      assert.equal(missing.status, 404);
      assert.equal(missing.headers['x-cache'], 'MISS');
    }
    assert.deepEqual((await request(app).get('/api/stats')).body, []);
  });

  it('does not clear a valid cache on rejected writes and never caches health checks', async () => {
    await request(app).get('/api/events');
    const invalid = await request(app).post('/api/events').send({ title: 'x' });
    assert.equal(invalid.status, 400);
    assert.equal((await request(app).get('/api/events')).headers['x-cache'], 'HIT');
    assert.equal((await request(app).get('/api/health')).headers['x-cache'], undefined);
  });

  it('preserves unrelated event caches and registration lists after an event edit', async () => {
    const a = (await request(app).post('/api/events').send(validEvent())).body;
    const b = (await request(app).post('/api/events').send(validEvent({ title: 'Other event' }))).body;
    const affected = ['/api/events?sort=start', '/api/stats', `/api/events/${a.id}?view=detail`];
    const unchanged = [`/api/events/${a.id}/registrations`, `/api/events/${b.id}`, `/api/events/${b.id}/registrations`];
    for (const url of [...affected, ...unchanged]) await request(app).get(url);
    assert.equal((await request(app).patch(`/api/events/${a.id}`).send({ title: 'Edited title' })).status, 200);
    for (const url of affected) assert.equal((await request(app).get(url)).headers['x-cache'], 'MISS', url);
    for (const url of unchanged) assert.equal((await request(app).get(url)).headers['x-cache'], 'HIT', url);
  });

  it('preserves the event list and other events when someone registers', async () => {
    const a = (await request(app).post('/api/events').send(validEvent())).body;
    const b = (await request(app).post('/api/events').send(validEvent())).body;
    const affected = [
      `/api/events/0${a.id}/`, `/api/events/${a.id}/registrations/?page=1`,
      `/api/events/%2B${a.id}`, `/api/events/${a.id}e0`, '/api/stats'
    ];
    const unchanged = ['/api/events', `/api/events/${b.id}`, `/api/events/${b.id}/registrations`];
    for (const url of [...affected, ...unchanged]) await request(app).get(url);
    assert.equal((await request(app).post(`/api/events/${a.id}/registrations`).send({ name: 'Student', email: 'one@example.com' })).status, 201);
    for (const url of affected) assert.equal((await request(app).get(url)).headers['x-cache'], 'MISS', url);
    for (const url of unchanged) assert.equal((await request(app).get(url)).headers['x-cache'], 'HIT', url);
  });

  it('preserves existing detail caches after creation and unrelated caches after deletion', async () => {
    const a = (await request(app).post('/api/events').send(validEvent())).body;
    const unchanged = [`/api/events/${a.id}`, `/api/events/${a.id}/registrations`];
    for (const url of unchanged) await request(app).get(url);
    const b = (await request(app).post('/api/events').send(validEvent())).body;
    for (const url of unchanged) assert.equal((await request(app).get(url)).headers['x-cache'], 'HIT');
    await request(app).get(`/api/events/${b.id}`);
    await request(app).get(`/api/events/${b.id}/registrations`);
    await request(app).get('/api/events');
    await request(app).get('/api/stats');
    assert.equal((await request(app).delete(`/api/events/${b.id}`)).status, 204);
    for (const url of unchanged) assert.equal((await request(app).get(url)).headers['x-cache'], 'HIT');
    for (const url of ['/api/events', '/api/stats']) assert.equal((await request(app).get(url)).headers['x-cache'], 'MISS');
    for (const url of [`/api/events/${b.id}`, `/api/events/${b.id}/registrations`]) assert.equal((await request(app).get(url)).status, 404);
  });
});

function response() {
  return {
    statusCode: 200, locals: {}, headers: {}, body: undefined,
    set(name, value) { this.headers[name] = value; return this; },
    type() { return this; },
    send(body) { this.body = body; return this; },
    json(body) { this.body = body; return this; }
  };
}

it('expires entries and bounds memory usage', () => {
  let clock = 0;
  const cache = createResponseCache({ ttlMs: 10, maxEntries: 1, now: () => clock });
  const req = (url) => ({ method: 'GET', path: url, originalUrl: url });
  const first = response(); cache.read(req('/one'), first, () => first.json({ value: 1 }));
  const hit = response(); cache.read(req('/one'), hit, () => assert.fail('expected a cache hit'));
  assert.equal(hit.headers['X-Cache'], 'HIT');
  clock = 11;
  const expired = response(); cache.read(req('/one'), expired, () => expired.json({ value: 2 }));
  assert.equal(expired.headers['X-Cache'], 'MISS');
  const second = response(); cache.read(req('/two'), second, () => second.json({ value: 3 }));
  const evicted = response(); cache.read(req('/one'), evicted, () => {});
  assert.equal(evicted.headers['X-Cache'], 'MISS');
});

it('does not let a read started before invalidation refill the cache with stale data', () => {
  const cache = createResponseCache();
  const req = { method: 'GET', path: '/events', originalUrl: '/events' };
  const delayed = response(); cache.read(req, delayed, () => {});
  cache.clear();
  delayed.json({ title: 'old title' });
  const fresh = response(); cache.read(req, fresh, () => {});
  assert.equal(fresh.headers['X-Cache'], 'MISS');
});

it('expires statistics at the next event start instead of retaining an outdated status', () => {
  let clock = 100;
  const cache = createResponseCache({ ttlMs: 10000, now: () => clock });
  const req = { method: 'GET', path: '/stats', originalUrl: '/stats' };
  const stats = response(); stats.locals.cacheExpiresAt = 105;
  cache.read(req, stats, () => stats.json([{ status: 'open' }]));
  clock = 106;
  const fresh = response(); cache.read(req, fresh, () => {});
  assert.equal(fresh.headers['X-Cache'], 'MISS');
});

it('blocks only affected stale in-flight reads and keeps an unrelated in-flight fill', () => {
  const cache = createResponseCache();
  const req = (id) => ({ method: 'GET', path: `/events/${id}`, originalUrl: `/api/events/${id}?details=1` });
  const a = response(); const b = response();
  cache.read(req(1), a, () => {});
  cache.read(req(2), b, () => {});
  cache.invalidateChange({ type: 'registration.created', eventId: 1 });
  a.json({ registered: 0 }); b.json({ title: 'Unchanged' });
  const fresh = response(); cache.read(req(1), fresh, () => {});
  assert.equal(fresh.headers['X-Cache'], 'MISS');
  const preserved = response(); cache.read(req(2), preserved, () => assert.fail('unrelated fill should survive'));
  assert.equal(preserved.headers['X-Cache'], 'HIT');
});

it('never caches a late response from an aborted read after a write', () => {
  const cache = createResponseCache();
  const req = { method: 'GET', path: '/events/1', originalUrl: '/api/events/1' };
  const aborted = Object.assign(new EventEmitter(), response());
  cache.read(req, aborted, () => {});
  aborted.emit('close');
  cache.invalidateChange({ type: 'event.updated', eventId: 1 });
  aborted.json({ title: 'old title' });
  const fresh = response(); cache.read(req, fresh, () => {});
  assert.equal(fresh.headers['X-Cache'], 'MISS');
});
