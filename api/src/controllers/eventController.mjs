import { listEvents } from '../services/eventService.mjs';

export async function getEvents(req, res) {
  const events = await listEvents();
  res.json(events);
}