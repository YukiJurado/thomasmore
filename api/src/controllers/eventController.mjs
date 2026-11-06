import * as events from '../services/eventService.mjs';

export async function getEvents(_req, res) {
  res.json(await events.listEvents());
}

export async function getEvent(req, res) {
  res.json(await events.getEventById(req.validated.params.id));
}

export async function createEvent(req, res) {
  const event = await events.createEvent(req.validated.body);
  res.status(201).location(`/api/events/${event.id}`).json(event);
}

export async function updateEvent(req, res) {
  res.json(await events.updateEvent(req.validated.params.id, req.validated.body));
}

export async function deleteEvent(req, res) {
  await events.deleteEvent(req.validated.params.id);
  res.status(204).send();
}
