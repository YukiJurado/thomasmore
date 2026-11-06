import { Registration } from '../db/index.mjs';

export async function countRegistrationsForEvent(eventId) {
  return Registration.count({
    where: { eventId }
  });
}