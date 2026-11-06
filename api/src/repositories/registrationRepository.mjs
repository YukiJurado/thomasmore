import { Registration } from '../db/index.mjs';

export function countRegistrationsForEvent(eventId, options = {}) {
  return Registration.count({ where: { eventId }, ...options });
}

export async function listRegistrations(eventId) {
  const rows = await Registration.findAll({ where: { eventId }, order: [['createdAt', 'ASC']] });
  return rows.map((row) => row.toJSON());
}

export async function findRegistration(eventId, email, options = {}) {
  const row = await Registration.findOne({ where: { eventId, email }, ...options });
  return row ? row.toJSON() : null;
}

export async function createRegistration(data, options = {}) {
  const row = await Registration.create(data, options);
  return row.toJSON();
}
