import { withDatabase, withTransaction } from '../repositories/databaseRepository.mjs';
import * as events from '../repositories/eventRepository.mjs';
import { countRegistrationsForEvent } from '../repositories/registrationRepository.mjs';
import { AppError } from '../errors/AppError.mjs';

export function listEvents() {
  return withDatabase(() => events.findAllEvents());
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
  return withTransaction((transaction) => events.createEvent(data, { transaction }));
}

export async function updateEvent(id, data) {
  const event = await withTransaction((transaction) => events.updateEvent(id, data, { transaction }));
  if (!event) throw new AppError(404, 'NOT_FOUND', `Event with id ${id} not found`);
  return event;
}

export async function deleteEvent(id) {
  const deleted = await withTransaction((transaction) => events.deleteEvent(id, { transaction }));
  if (!deleted) throw new AppError(404, 'NOT_FOUND', `Event with id ${id} not found`);
}
