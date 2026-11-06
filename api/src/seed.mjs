// Explicit development command: resets local data; never run automatically in production.
import { sequelize } from './db/index.mjs';
import { seedDemoData } from './repositories/demoRepository.mjs';

await sequelize.sync({ force: true });
await seedDemoData();
console.log('Database reset with demo data.');
await sequelize.close();
