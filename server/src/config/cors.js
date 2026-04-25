import { ENV } from './env.js';

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

function parseAllowedOrigins() {
  return [
    ENV.CLIENT_URL,
    ...String(ENV.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ]
    .map(normalizeOrigin)
    .filter(Boolean);
}

const allowedOrigins = new Set(parseAllowedOrigins());

function isTrustedHostingPreview(origin) {
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);

  if (ENV.isDev) return true;
  if (allowedOrigins.has(normalizedOrigin)) return true;
  if (isTrustedHostingPreview(normalizedOrigin)) return true;

  return false;
}

function originResolver(origin, callback) {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origin not allowed by CORS: ${origin}`));
}

export const corsOptions = {
  origin: ENV.isDev ? true : originResolver,
  credentials: true,
};

export const socketCorsOptions = {
  origin: ENV.isDev ? true : originResolver,
  methods: ['GET', 'POST'],
  credentials: true,
};
