import { changes } from '../events/changes.mjs';

function send(res, message) {
  if (res.destroyed || res.writableEnded) return;
  try {
    if (!res.write(message)) res.end();
  } catch {
    res.destroy();
  }
}

export function createNotificationStream({ heartbeatMs = 15000 } = {}) {
  const clients = new Set();
  const unsubscribe = changes.subscribe((change) => {
    if (!['event.created', 'registration.created'].includes(change.type)) return;
    // Construct the public payload explicitly, rather than serializing a registration.
    const data = JSON.stringify({ eventId: change.eventId });
    const message = `id: ${change.id}\nevent: ${change.type}\ndata: ${data}\n\n`;
    for (const client of clients) send(client, message);
  });

  function connect(_req, res) {
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    res.on('error', () => res.destroy());
    clients.add(res);
    send(res, ': connected\n\n');
    const heartbeat = setInterval(() => send(res, ': heartbeat\n\n'), heartbeatMs);
    heartbeat.unref();
    res.once('close', () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
  }

  function close() {
    unsubscribe();
    for (const client of clients) client.end();
    clients.clear();
  }

  return { connect, close };
}
