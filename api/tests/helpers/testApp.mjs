import { responseCache } from '../../src/cache/responseCache.mjs';
import { app, Event, Registration, sequelize } from '../../src/app.mjs';

// The app and its database are created as soon as app.mjs is imported.
// .env.test sets DB_STORAGE=:memory:, so the tests never touch your real data.
// Every call empties all tables: tests never share state.
export async function createTestApp() {
  responseCache.clear();
  await sequelize.sync({ force: true });
  return { app, db: { sequelize, Event, Registration } };
}

export const validEvent = (overrides = {}) => ({
  title: 'Backend Bootcamp',
  location: 'Room C101',
  startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  capacity: 10,
  ...overrides
});
