import { Event, sequelize } from '../db/index.mjs';

// PostgreSQL row locks protect the last seat if another process also writes this event.
function eventReadOptions(options) {
  if (options.transaction && sequelize.getDialect() === 'postgres') {
    return { ...options, lock: options.transaction.LOCK.UPDATE };
  }
  return options;
}

export async function findAllEvents() {
  const events = await Event.findAll({ order: [['startsAt', 'ASC']] });
  return events.map((event) => event.toJSON());
}

export async function findEventById(id, options = {}) {
  const event = await Event.findByPk(id, eventReadOptions(options));
  return event ? event.toJSON() : null;
}

export async function createEvent(data, options = {}) {
  const event = await Event.create(data, options);
  return event.toJSON();
}

export async function updateEvent(id, data, options = {}) {
  const event = await Event.findByPk(id, eventReadOptions(options));
  if (!event) return null;
  await event.update(data, options);
  return event.toJSON();
}

export function deleteEvent(id, options = {}) {
  return Event.destroy({ where: { id }, ...options });
}

export function countEvents() {
  return Event.count();
}

export async function findEventsForStats() {
  const events = await Event.findAll();
  return events.map((event) => event.toJSON());
}
