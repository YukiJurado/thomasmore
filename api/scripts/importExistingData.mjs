import { sequelize } from '../src/db/index.mjs';
import { importSnapshot } from '../src/repositories/migrationRepository.mjs';

async function get(path) {
  const response = await fetch(`https://thomasmore-api.onrender.com${path}`);
  if (!response.ok) throw new Error(`Source API returned HTTP ${response.status}`);
  return response.json();
}

try {
  if (sequelize.getDialect() !== 'postgres') throw new Error('DATABASE_URL must select PostgreSQL');
  const events = await get('/api/events');
  const registrations = (await Promise.all(events.map((event) =>
    get(`/api/events/${event.id}/registrations`)))).flat();
  await sequelize.sync();
  const counts = await importSnapshot({ events, registrations });
  console.log(JSON.stringify({ imported: counts }));
} catch (error) {
  console.error('Import failed:', error.name, error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
