import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

// Read-only smoke test: it never creates a registration or sends an email.
const endpoint = new URL(process.argv[2] || 'http://localhost:3000/mcp');
const client = new Client({ name: 'campus-events-verification', version: '1.0.0' }, {
  versionNegotiation: { mode: 'auto' }
});
try {
  await client.connect(new StreamableHTTPClientTransport(endpoint));
  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name);
  for (const name of ['get_upcoming_events', 'get_past_events', 'register_for_event']) {
    assert.ok(names.includes(name), `Missing MCP tool: ${name}`);
  }
  const upcoming = await client.callTool({ name: 'get_upcoming_events', arguments: {} });
  const past = await client.callTool({ name: 'get_past_events', arguments: {} });
  assert.ok(!upcoming.isError && !past.isError);
  assert.ok(Array.isArray(upcoming.structuredContent.events));
  assert.ok(Array.isArray(past.structuredContent.events));
  console.log(JSON.stringify({
    endpoint: endpoint.href, tools: names,
    upcoming: upcoming.structuredContent.events.length,
    past: past.structuredContent.events.length,
    writesPerformed: false
  }, null, 2));
} finally {
  await client.close();
}
