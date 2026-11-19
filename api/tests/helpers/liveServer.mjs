import { once } from 'node:events';
import assert from 'node:assert/strict';

export async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await app.locals.closeConnections();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

export async function openNotifications(url) {
  const controller = new AbortController();
  const response = await fetch(`${url}/api/notifications`, { signal: controller.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  assert.equal(response.headers.get('x-cache'), null);
  const reader = response.body.getReader();
  const messages = [];
  let buffer = '';
  let wake = () => {};
  let connected;
  const ready = new Promise((resolve) => { connected = resolve; });

  function parse(frame) {
    if (frame.startsWith(': connected')) connected();
    if (frame.startsWith(':')) return;
    const values = Object.fromEntries(frame.split('\n').map((line) => {
      const separator = line.indexOf(':');
      return [line.slice(0, separator), line.slice(separator + 1).trim()];
    }));
    messages.push({ id: values.id, type: values.event, data: JSON.parse(values.data) });
    wake();
  }

  const consuming = (async () => {
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          parse(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    }
  })();
  await ready;
  return {
    messages,
    async waitFor(count) {
      let timeout;
      await Promise.race([
        new Promise((resolve) => {
          wake = () => { if (messages.length >= count) resolve(); };
          wake();
        }),
        new Promise((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error(`Expected ${count} notifications, got ${messages.length}`)), 4000);
        })
      ]).finally(() => clearTimeout(timeout));
    },
    async close() {
      controller.abort();
      await consuming;
    }
  };
}
