import { findAllEvents } from '../repositories/eventRepository.mjs';
import { countRegistrationsForEvent } from '../repositories/registrationRepository.mjs';

function eventStatus(event, registered, now) {
  if (registered >= event.capacity) return 'full';
  return new Date(event.startsAt) < now ? 'past' : 'open';
}

export async function getStatsSnapshot() {
  const events = await findAllEvents();
  const now = new Date();
  const value = await Promise.all(events.map(async (event) => {
    const registered = await countRegistrationsForEvent(event.id);
    return {
      id: event.id, title: event.title, registered, capacity: event.capacity,
      occupancy: `${Math.round((registered / event.capacity) * 100)}%`,
      status: eventStatus(event, registered, now)
    };
  }));
  const futureStarts = events.map((event) => new Date(event.startsAt).getTime())
    .filter((time) => time >= now.getTime());
  return { value, validUntil: Math.min(...futureStarts) };
}
