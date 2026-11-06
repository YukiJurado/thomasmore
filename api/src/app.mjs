import express from 'express';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.mjs';
import { responseCache } from './cache/responseCache.mjs';
import { eventRoutes } from './routes/eventRoutes.mjs';
import { health, stats } from './controllers/systemController.mjs';
import { requestLogger } from './middleware/requestLogger.mjs';
import { notFound, errorHandler } from './middleware/errors.mjs';
import { attachFrontend } from './middleware/frontend.mjs';

// Compatibility exports keep the original integration-test helper unchanged.
export { sequelize, Event, Registration } from './db/index.mjs';
export { seedDemoData } from './repositories/demoRepository.mjs';

const builtFrontend = fileURLToPath(new URL('../../web/dist/', import.meta.url));

export function createApp({ webDirectory = env.nodeEnv === 'test' ? null : builtFrontend } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(requestLogger);
  app.use('/api', responseCache.invalidateWrites, responseCache.read);
  app.get('/api/health', health);
  app.use('/api/events', eventRoutes);
  app.get('/api/stats', stats);
  app.use('/api', notFound);
  attachFrontend(app, webDirectory);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
