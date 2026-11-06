import { sequelize, Event, Registration } from '../db/index.mjs';
import { withTransaction } from './databaseRepository.mjs';

export function importSnapshot(snapshot) {
  return withTransaction(async (transaction) => {
    const options = { transaction, validate: true };
    if (await Event.count(options) || await Registration.count(options)) {
      throw new Error('Import requires an empty target database; existing data was left unchanged');
    }
    await Event.bulkCreate(snapshot.events, { ...options, fields: [
      'id', 'title', 'description', 'location', 'startsAt', 'capacity', 'createdAt', 'updatedAt'
    ] });
    await Registration.bulkCreate(snapshot.registrations, { ...options, fields: [
      'id', 'eventId', 'name', 'email', 'createdAt', 'updatedAt'
    ] });
    if (sequelize.getDialect() === 'postgres') {
      // Explicit imported IDs do not advance PostgreSQL sequences automatically.
      await sequelize.query(`SELECT setval(pg_get_serial_sequence('"Events"', 'id'),
        COALESCE((SELECT MAX(id) FROM "Events"), 1), EXISTS(SELECT 1 FROM "Events"))`, options);
      await sequelize.query(`SELECT setval(pg_get_serial_sequence('"Registrations"', 'id'),
        COALESCE((SELECT MAX(id) FROM "Registrations"), 1), EXISTS(SELECT 1 FROM "Registrations"))`, options);
    }
    return { events: snapshot.events.length, registrations: snapshot.registrations.length };
  });
}
