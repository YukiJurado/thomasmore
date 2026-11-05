import { Event } from '../db/index.mjs';

export async function findAllEvents() {
  return Event.findAll({
    order: [['startsAt', 'ASC']]
  });
}