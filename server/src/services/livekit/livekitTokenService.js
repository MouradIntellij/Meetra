import { AccessToken } from 'livekit-server-sdk';
import { ENV } from '../../config/env.js';

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').trim().toLowerCase());
}

function cleanEnvValue(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function normalizeRoomName(roomId) {
  return String(roomId || '').trim().toLowerCase();
}

function normalizeIdentity(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.@-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function normalizeDisplayName(value) {
  return String(value || '').trim().slice(0, 80) || 'Participant Meetra';
}

export function getLiveKitStatus() {
  const livekitUrl = cleanEnvValue(ENV.LIVEKIT_URL);
  const apiKey = cleanEnvValue(ENV.LIVEKIT_API_KEY);
  const apiSecret = cleanEnvValue(ENV.LIVEKIT_API_SECRET);
  const configured = Boolean(livekitUrl && apiKey && apiSecret);
  return {
    enabled: isTruthy(ENV.LIVEKIT_ENABLED) && configured,
    configured,
    url: configured ? livekitUrl : '',
  };
}

export async function createLiveKitParticipantToken({ roomId, userName, userId, role = 'participant' }) {
  const status = getLiveKitStatus();
  if (!status.enabled) {
    return { error: status.configured ? 'LIVEKIT_DISABLED' : 'LIVEKIT_NOT_CONFIGURED' };
  }

  const room = normalizeRoomName(roomId);
  const name = normalizeDisplayName(userName);
  const identityBase = normalizeIdentity(userId || userName || `guest-${Date.now()}`);
  const identity = `${identityBase || 'guest'}-${Math.random().toString(36).slice(2, 8)}`;

  const livekitUrl = cleanEnvValue(ENV.LIVEKIT_URL);
  const apiKey = cleanEnvValue(ENV.LIVEKIT_API_KEY);
  const apiSecret = cleanEnvValue(ENV.LIVEKIT_API_SECRET);

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: ENV.LIVEKIT_TOKEN_TTL_SECONDS,
    metadata: JSON.stringify({
      app: 'meetra',
      roomId: room,
      role,
    }),
  });

  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    token: await token.toJwt(),
    url: livekitUrl,
    room,
    identity,
    name,
    ttlSeconds: ENV.LIVEKIT_TOKEN_TTL_SECONDS,
  };
}
