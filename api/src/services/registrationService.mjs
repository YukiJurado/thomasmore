import * as registrations from '../repositories/registrationRepository.mjs';
import { enqueueEmail } from '../repositories/emailRepository.mjs';
import { withTransaction } from '../repositories/databaseRepository.mjs';
import { requireEvent } from './eventService.mjs';
import { AppError } from '../errors/AppError.mjs';

export async function listRegistrations(eventId) {
  await requireEvent(eventId);
  return registrations.listRegistrations(eventId);
}

export function register(eventId, data) {
  return withTransaction(async (transaction) => {
    const options = { transaction };
    const event = await requireEvent(eventId, options);
    const existing = await registrations.findRegistration(eventId, data.email, options);
    if (existing) {
      throw new AppError(409, 'CONFLICT', `${data.email} is already registered for this event`);
    }
    const count = await registrations.countRegistrationsForEvent(eventId, options);
    if (count >= event.capacity) throw new AppError(409, 'CONFLICT', 'Event is full');
    const registration = await registrations.createRegistration({ eventId, ...data }, options);
    // Both records commit together. No network call can roll back a saved registration.
    await enqueueEmail({
      registrationId: registration.id,
      recipient: registration.email,
      subject: `Registration confirmed: ${event.title}`,
      text: `Hi ${registration.name}, you are registered for ${event.title} at ${event.location}.`
    }, options);
    return registration;
  });
}
