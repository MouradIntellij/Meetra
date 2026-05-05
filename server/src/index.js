import { createServer } from 'http';
import { createApp } from './app.js';
import { initSocket } from './socket/index.js';
import { ENV } from './config/env.js';
import { closeSocketRedisAdapter } from './config/redis.js';
import { logger } from './utils/logger.js';

const app        = createApp();
const httpServer = createServer(app);
const io         = initSocket(httpServer);

httpServer.listen(ENV.PORT, () => {
  logger.success(`🚀 Server running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down');
  httpServer.close(async () => {
    await closeSocketRedisAdapter();
    process.exit(0);
  });
});
