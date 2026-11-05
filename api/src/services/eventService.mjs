import { findAllEvents } from '../repositories/eventRepository.mjs';

export async function listEvents() {
  return findAllEvents();
}
