import { withDatabase, withTransaction } from '../repositories/databaseRepository.mjs';
import * as events from '../repositories/eventRepository.mjs';
import { countRegistrationsForEvent } from '../repositories/registrationRepository.mjs';
import { AppError } from '../errors/AppError.mjs';
import { changes } from '../events/changes.mjs';

export function listEvents() {
  return withDatabase(() => events.findAllEvents());
}

export function listUpcomingEvents(now = new Date()) {
  return withDatabase(() => events.findEventsInRange({ from: now }));
}

export function listPastEvents(now = new Date()) {
  return withDatabase(() => events.findEventsInRange({ before: now }));
}

export async function requireEvent(id, options = {}) {
  const event = await events.findEventById(id, options);
  if (!event) throw new AppError(404, 'NOT_FOUND', `Event with id ${id} not found`);
  return event;
}

export function getEventById(id) {
  return withDatabase(async () => {
    const event = await requireEvent(id);
    const registered = await countRegistrationsForEvent(id);
    return { ...event, registered, spotsLeft: Math.max(event.capacity - registered, 0) };
  });
}

export function createEvent(data) {
  return withTransaction(
    (transaction) => events.createEvent(data, { transaction }),
    (event) => changes.publish('event.created', event.id)
  );
}

export function updateEvent(id, data) {
  return withTransaction(async (transaction) => {
    const event = await events.updateEvent(id, data, { transaction });
    if (!event) throw new AppError(404, 'NOT_FOUND', `Event with id ${id} not found`);
    return event;
  }, (event) => changes.publish('event.updated', event.id));
}

export function deleteEvent(id) {
  return withTransaction(async (transaction) => {
    const deleted = await events.deleteEvent(id, { transaction });
    if (!deleted) throw new AppError(404, 'NOT_FOUND', `Event with id ${id} not found`);
  }, () => changes.publish('event.deleted', id));
}
