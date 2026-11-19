import express from 'express';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.mjs';
import { responseCache } from './cache/responseCache.mjs';
import { eventRoutes } from './routes/eventRoutes.mjs';
import { health, stats } from './controllers/systemController.mjs';
import { requestLogger } from './middleware/requestLogger.mjs';
import { notFound, errorHandler } from './middleware/errors.mjs';
import { attachFrontend } from './middleware/frontend.mjs';
import { createNotificationStream } from './notifications/stream.mjs';
import { createMcpEndpoint } from './mcp/server.mjs';

// Compatibility exports keep the original integration-test helper unchanged.
export { sequelize, Event, Registration } from './db/index.mjs';
export { seedDemoData } from './repositories/demoRepository.mjs';

const builtFrontend = fileURLToPath(new URL('../../web/dist/', import.meta.url));

export function createApp({ webDirectory = env.nodeEnv === 'test' ? null : builtFrontend } = {}) {
  const app = express();
  const notifications = createNotificationStream();
  const mcp = createMcpEndpoint();
  app.locals.closeConnections = async () => {
    notifications.close();
    await mcp.close();
  };
  app.disable('x-powered-by');
  app.use(requestLogger);
  // MCP owns its JSON-RPC parsing; SSE must never pass through the JSON response cache.
  app.all('/mcp', mcp.handle);
  app.use(express.json());
  app.get('/api/notifications', notifications.connect);
  app.use('/api', responseCache.read);
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
