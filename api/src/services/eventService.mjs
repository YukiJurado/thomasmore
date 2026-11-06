import * as events from '../repositories/eventRepository.mjs';
import { countRegistrationsForEvent } from '../repositories/registrationRepository.mjs';
import { AppError } from '../errors/AppError.mjs';

export function listEvents() {
  return events.findAllEvents();
}

export async function requireEvent(id, options = {}) {
  const event = await events.findEventById(id, options);
  if (!event) throw new AppError(404, 'NOT_FOUND', `Event with id ${id} not found`);
  return event;
}

export async function getEventById(id) {
  const event = await requireEvent(id);
  const registered = await countRegistrationsForEvent(id);
  return { ...event, registered, spotsLeft: Math.max(event.capacity - registered, 0) };
}

export function createEvent(data) {
  return events.createEvent(data);
}

export async function updateEvent(id, data) {
  const event = await events.updateEvent(id, data);
  if (!event) throw new AppError(404, 'NOT_FOUND', `Event with id ${id} not found`);
  return event;
}

export async function deleteEvent(id) {
  const deleted = await events.deleteEvent(id);
  if (!deleted) throw new AppError(404, 'NOT_FOUND', `Event with id ${id} not found`);
}
