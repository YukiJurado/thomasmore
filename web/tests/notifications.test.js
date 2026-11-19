import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeToNotifications } from '../src/api/notifications.js';

afterEach(() => vi.unstubAllGlobals());

describe('live notification connection', () => {
  it('uses one EventSource and strips unneeded participant data from received frames', () => {
    const listeners = new Map();
    const close = vi.fn(); const connected = vi.fn(); const receive = vi.fn();
    vi.stubGlobal('EventSource', class {
      constructor(url) { connected(url); }
      addEventListener(name, listener) { listeners.set(name, listener); }
      close() { close(); }
    });
    const stop = subscribeToNotifications(receive);
    expect(connected).toHaveBeenCalledExactlyOnceWith('/api/notifications');
    expect([...listeners.keys()]).toEqual(['event.created', 'registration.created']);
    listeners.get('registration.created')({
      type: 'registration.created', lastEventId: 'notification-1',
      data: JSON.stringify({ eventId: 7, name: 'Private Name', email: 'private@example.com' })
    });
    expect(receive).toHaveBeenCalledExactlyOnceWith({ id: 'notification-1', type: 'registration.created', eventId: 7 });
    stop(); expect(close).toHaveBeenCalledOnce();
  });

  it('ignores malformed frames and missing IDs instead of showing a broken toast', () => {
    let receiveFrame; const receive = vi.fn();
    vi.stubGlobal('EventSource', class {
      addEventListener(_name, listener) { receiveFrame = listener; }
      close() {}
    });
    subscribeToNotifications(receive);
    for (const event of [
      { data: '{', lastEventId: 'one' },
      { data: '{"eventId":7}', lastEventId: '' },
      { data: '{"eventId":"private@example.com"}', lastEventId: 'two' },
      { data: '{"eventId":0}', lastEventId: 'three' }
    ]) receiveFrame(event);
    expect(receive).not.toHaveBeenCalled();
  });
});
