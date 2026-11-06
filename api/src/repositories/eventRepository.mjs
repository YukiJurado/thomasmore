import { Event } from '../db/index.mjs';

export async function findAllEvents() {
  return Event.findAll({
    order: [['startsAt', 'ASC']]
  });
}

export async function findEventById(id) {
  const event = await Event.findByPk(id);

  return event ? event.toJSON() : null;
}

import { Registration } from '../db/index.mjs';

export async function countRegistrationsForEvent(eventId) {
  return Registration.count({
    where: { eventId }
  });
}