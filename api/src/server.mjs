import { app } from './app.mjs';
import { sequelize } from './db/index.mjs';
import { env } from './config/env.mjs';
import { logger } from './config/logger.mjs';
import { countEvents } from './repositories/eventRepository.mjs';
import { seedDemoData } from './repositories/demoRepository.mjs';
import { createMailWorker } from './services/mailWorker.mjs';

await sequelize.sync();
if ((await countEvents()) === 0) {
  await seedDemoData();
  logger.info('Empty database: demo data added');
}

const mailWorker = createMailWorker({ retryMs: env.mailRetryMs });
mailWorker.start();
const server = app.listen(env.port, '0.0.0.0', () => {
  logger.info(`Campus Events running on port ${env.port}`);
});

async function shutdown() {
  server.close(async () => {
    await mailWorker.stop();
    await sequelize.close();
  });
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
