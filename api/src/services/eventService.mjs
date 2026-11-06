import {
  findAllEvents,
  findEventById
} from '../repositories/eventRepository.mjs';

import { countRegistrationsForEvent } from '../repositories/registrationRepository.mjs';
import { AppError } from '../errors/AppError.mjs';

export async function listEvents() {
  return findAllEvents();
}

export async function getEventById(id) {
  const event = await findEventById(id);

  if (!event) {
    throw new AppError(
      404,
      'NOT_FOUND',
      `Event with id ${id} not found`
    );
  }

  const registered = await countRegistrationsForEvent(id);

  return {
    ...event,
    registered,
    spotsLeft: Math.max(event.capacity - registered, 0)
  };
}
