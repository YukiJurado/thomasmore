import express from 'express';
import { responseCache } from './cache/responseCache.mjs';
import { eventRoutes } from './routes/eventRoutes.mjs';
import { health, stats } from './controllers/systemController.mjs';
import { requestLogger } from './middleware/requestLogger.mjs';
import { notFound, errorHandler } from './middleware/errors.mjs';

// Compatibility exports for the original integration-test helper and seed script.
export { sequelize, Event, Registration } from './db/index.mjs';
export { seedDemoData } from './repositories/demoRepository.mjs';

export const app = express();
app.use(express.json());
app.use(requestLogger);
app.use('/api', responseCache.invalidateWrites, responseCache.read);
app.get('/api/health', health);
app.use('/api/events', eventRoutes);
app.get('/api/stats', stats);
app.use(notFound);
app.use(errorHandler);
