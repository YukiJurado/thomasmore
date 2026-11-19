import assert from 'node:assert/strict';
import { beforeEach, it } from 'node:test';
import request from 'supertest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';
import { listen, openNotifications } from '../helpers/liveServer.mjs';
import { createApp } from '../../src/app.mjs';
import { listEmailJobs } from '../../src/repositories/emailRepository.mjs';
import { listUpcomingEvents, listPastEvents } from '../../src/services/eventService.mjs';

beforeEach(createTestApp);

async function connect(t, options) {
  const app = createApp(); const server = await listen(app);
  const client = new Client({ name: 'assignment-test', version: '1.0.0' }, options);
  t.after(async () => { await client.close(); await server.close(); });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${server.url}/mcp`)));
  return { app, server, client };
}

it('discovers MCP tools and lists upcoming/past events through the official HTTP client', async (t) => {
  const { app, client } = await connect(t);
  const now = Date.now();
  const past = (await request(app).post('/api/events').send(validEvent({ title: 'Past event', startsAt: new Date(now - 86400000).toISOString() }))).body;
  const future = (await request(app).post('/api/events').send(validEvent({ title: 'Future event', startsAt: new Date(now + 86400000).toISOString() }))).body;
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), ['get_past_events', 'get_upcoming_events', 'register_for_event']);
  assert.deepEqual((await client.callTool({ name: 'get_upcoming_events', arguments: {} })).structuredContent.events.map((event) => event.id), [future.id]);
  assert.deepEqual((await client.callTool({ name: 'get_past_events', arguments: {} })).structuredContent.events.map((event) => event.id), [past.id]);
});

it('treats an exact start time as upcoming without a gap or overlap', async () => {
  const { app } = await createTestApp(); const now = new Date('2030-01-01T12:00:00Z');
  const before = (await request(app).post('/api/events').send(validEvent({ startsAt: '2030-01-01T11:59:59Z' }))).body;
  const exact = (await request(app).post('/api/events').send(validEvent({ startsAt: now.toISOString() }))).body;
  assert.deepEqual((await listPastEvents(now)).map((event) => event.id), [before.id]);
  assert.deepEqual((await listUpcomingEvents(now)).map((event) => event.id), [exact.id]);
});

it('registers through MCP, queues email, invalidates only affected HTTP caches and broadcasts once', async (t) => {
  const { app, server, client } = await connect(t);
  const a = (await request(app).post('/api/events').send(validEvent())).body;
  const b = (await request(app).post('/api/events').send(validEvent())).body;
  const changed = [`/api/events/${a.id}`, `/api/events/${a.id}/registrations`, '/api/stats'];
  const unchanged = ['/api/events', `/api/events/${b.id}`];
  for (const path of [...changed, ...unchanged]) await request(app).get(path);
  const browser = await openNotifications(server.url);
  t.after(() => browser.close());
  const result = await client.callTool({ name: 'register_for_event', arguments: { eventId: a.id, name: 'Private Person', email: 'PRIVATE@EXAMPLE.COM' } });
  assert.ok(!result.isError);
  assert.equal(result.structuredContent.registration.eventId, a.id);
  assert.equal((await listEmailJobs()).length, 1);
  assert.equal((await listEmailJobs())[0].recipient, 'private@example.com');
  for (const path of changed) assert.equal((await request(app).get(path)).headers['x-cache'], 'MISS', path);
  for (const path of unchanged) assert.equal((await request(app).get(path)).headers['x-cache'], 'HIT', path);
  const duplicate = await client.callTool({ name: 'register_for_event', arguments: { eventId: a.id, name: 'Private Person', email: 'private@example.com' } });
  assert.equal(duplicate.isError, true);
  assert.equal(duplicate.structuredContent.error.code, 'CONFLICT');
  await request(app).post('/api/events').send(validEvent());
  await browser.waitFor(2);
  assert.deepEqual(browser.messages.map((message) => message.type), ['registration.created', 'event.created']);
  assert.deepEqual(browser.messages[0].data, { eventId: a.id });
});

it('rejects invalid MCP registration input without saving anything', async (t) => {
  const { app, client } = await connect(t);
  const event = (await request(app).post('/api/events').send(validEvent())).body;
  const invalid = await client.callTool({ name: 'register_for_event', arguments: { eventId: event.id, name: 'Student', email: 'invalid' } });
  assert.equal(invalid.isError, true);
  const missing = await client.callTool({ name: 'register_for_event', arguments: { eventId: 99999, name: 'Student', email: 'student@example.com' } });
  assert.equal(missing.isError, true);
  assert.equal(missing.structuredContent.error.code, 'NOT_FOUND');
  assert.deepEqual(await listEmailJobs(), []);
});

it('supports modern protocol negotiation as well as legacy MCP hosts', async (t) => {
  const { client } = await connect(t, { versionNegotiation: { mode: 'auto' } });
  assert.equal((await client.listTools()).tools.length, 3);
  assert.deepEqual((await client.callTool({ name: 'get_upcoming_events', arguments: {} })).structuredContent.events, []);
});

it('protects the last seat when an MCP call races a website registration', async (t) => {
  const { app, client } = await connect(t);
  const event = (await request(app).post('/api/events').send(validEvent({ capacity: 1 }))).body;
  const [mcp, http] = await Promise.all([
    client.callTool({ name: 'register_for_event', arguments: { eventId: event.id, name: 'MCP Student', email: 'mcp@example.com' } }),
    request(app).post(`/api/events/${event.id}/registrations`).send({ name: 'Web Student', email: 'web@example.com' })
  ]);
  assert.equal(Number(!mcp.isError) + Number(http.status === 201), 1);
  assert.ok(mcp.isError ? http.status === 201 : http.status === 409);
  assert.equal((await listEmailJobs()).length, 1);
  const detail = await request(app).get(`/api/events/${event.id}`);
  assert.equal(detail.body.registered, 1);
  assert.equal(detail.body.spotsLeft, 0);
});

it('rejects untrusted MCP host/origin headers and does not cache protocol responses', async () => {
  const app = createApp();
  const body = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
  assert.equal((await request(app).post('/mcp').set('Host', 'untrusted.example').send(body)).status, 403);
  const blocked = await request(app).post('/mcp').set('Origin', 'https://untrusted.example').send(body);
  assert.equal(blocked.status, 403);
  const allowed = await request(app).post('/mcp').set('Accept', 'application/json, text/event-stream').send(body);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers['cache-control'], 'no-store');
  assert.equal(allowed.headers['x-cache'], undefined);
  await app.locals.closeConnections();
});

it('returns a protocol parse error for malformed MCP JSON rather than a REST error', async () => {
  const app = createApp();
  const invalid = await request(app).post('/mcp')
    .set('Accept', 'application/json, text/event-stream').set('Content-Type', 'application/json').send('{');
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.jsonrpc, '2.0');
  assert.equal(invalid.body.error.code, -32700);
  await app.locals.closeConnections();
});
