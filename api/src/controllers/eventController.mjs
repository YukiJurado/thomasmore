import {
  listEvents,
  getEventById
} from '../services/eventService.mjs';

export async function getEvents(req, res) {
  const events = await listEvents();
  res.json(events);
}

export async function getEvent(req, res) {
  const event = await getEventById(req.validatedParams.id);
  res.json(event);
}