import { randomUUID } from 'node:crypto';
import { logger } from '../config/logger.mjs';

const listeners = new Set();

export const changes = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  publish(type, eventId) {
    // Only public event information belongs on this channel, never participant data.
    const change = Object.freeze({ id: randomUUID(), type, eventId });
    for (const listener of listeners) {
      try {
        listener(change);
      } catch {
        // Observer failure must not turn a committed registration into an HTTP failure.
        logger.error('Could not deliver an application change notification');
      }
    }
  }
};
