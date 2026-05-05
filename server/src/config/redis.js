import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ENV } from './env.js';
import { logger } from '../utils/logger.js';

let pubClient = null;
let subClient = null;

function isRedisAdapterEnabled() {
  const mode = String(ENV.REDIS_SOCKET_ADAPTER || 'auto').trim().toLowerCase();
  if (['0', 'false', 'off', 'disabled'].includes(mode)) return false;
  if (['1', 'true', 'on', 'enabled', 'required'].includes(mode)) return true;
  return Boolean(ENV.REDIS_URL);
}

export async function configureSocketRedisAdapter(io) {
  if (!isRedisAdapterEnabled()) {
    logger.info('Socket.IO Redis adapter disabled; using in-memory adapter');
    return false;
  }

  if (!ENV.REDIS_URL) {
    logger.warn('REDIS_SOCKET_ADAPTER enabled but REDIS_URL is missing; using in-memory adapter');
    return false;
  }

  pubClient = createClient({ url: ENV.REDIS_URL });
  subClient = pubClient.duplicate();

  pubClient.on('error', (error) => {
    logger.error('Redis pub client error:', error?.message || error);
  });
  subClient.on('error', (error) => {
    logger.error('Redis sub client error:', error?.message || error);
  });

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.success('Socket.IO Redis adapter enabled');
    return true;
  } catch (error) {
    logger.error('Socket.IO Redis adapter failed; using in-memory adapter:', error?.message || error);
    await closeSocketRedisAdapter();
    return false;
  }
}

export async function closeSocketRedisAdapter() {
  const clients = [pubClient, subClient].filter(Boolean);
  pubClient = null;
  subClient = null;

  await Promise.allSettled(
    clients.map(async (client) => {
      if (client.isOpen) {
        await client.quit();
      }
    })
  );
}
