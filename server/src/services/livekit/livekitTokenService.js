import { AccessToken } from 'livekit-server-sdk';
import { ENV } from '../../config/env.js';

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').trim().toLowerCase());
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
  const configured = Boolean(ENV.LIVEKIT_URL && ENV.LIVEKIT_API_KEY && ENV.LIVEKIT_API_SECRET);
  return {
    enabled: isTruthy(ENV.LIVEKIT_ENABLED) && configured,
    configured,
    url: configured ? ENV.LIVEKIT_URL : '',
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

  const token = new AccessToken(ENV.LIVEKIT_API_KEY, ENV.LIVEKIT_API_SECRET, {
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
    url: ENV.LIVEKIT_URL,
    room,
    identity,
    name,
    ttlSeconds: ENV.LIVEKIT_TOKEN_TTL_SECONDS,
  };
}
