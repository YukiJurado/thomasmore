import * as registrations from '../repositories/registrationRepository.mjs';
import { requireEvent } from './eventService.mjs';
import { AppError } from '../errors/AppError.mjs';

export async function listRegistrations(eventId) {
  await requireEvent(eventId);
  return registrations.listRegistrations(eventId);
}

export async function register(eventId, data) {
  const event = await requireEvent(eventId);
  const existing = await registrations.findRegistration(eventId, data.email);
  if (existing) {
    throw new AppError(409, 'CONFLICT', `${data.email} is already registered for this event`);
  }
  const count = await registrations.countRegistrationsForEvent(eventId);
  // Preserve the starter's behaviour here; capacity correction gets a separate test and commit.
  if (count > event.capacity) throw new AppError(409, 'CONFLICT', 'Event is full');
  return registrations.createRegistration({ eventId, ...data });
}
