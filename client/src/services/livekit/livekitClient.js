import { getApiUrl, isLiveKitMediaEnabled } from '../../utils/appConfig.js';

const AUTH_STORAGE_KEY = 'meetra-auth-session';

function readStoredAuthToken() {
  if (typeof window === 'undefined') return '';
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
    return parsed.token || '';
  } catch {
    return '';
  }
}

export async function getLiveKitStatus() {
  const response = await fetch(`${getApiUrl()}/api/livekit/status`);
  if (!response.ok) {
    throw new Error(`LIVEKIT_STATUS_FAILED_${response.status}`);
  }
  return response.json();
}

export async function requestLiveKitToken({ roomId, userName, userId = '', asHost = false }) {
  const token = readStoredAuthToken();
  const response = await fetch(`${getApiUrl()}/api/livekit/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ roomId, userName, userId, asHost }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `LIVEKIT_TOKEN_FAILED_${response.status}`);
  }
  return payload;
}

export async function connectLiveKitRoom({ roomId, userName, userId = '', asHost = false }) {
  if (!isLiveKitMediaEnabled()) {
    return { skipped: true, reason: 'MEDIA_BACKEND_P2P' };
  }

  const [{ Room }, tokenPayload] = await Promise.all([
    import('livekit-client'),
    requestLiveKitToken({ roomId, userName, userId, asHost }),
  ]);

  const room = new Room();
  await room.connect(tokenPayload.url, tokenPayload.token);

  return {
    room,
    tokenPayload,
  };
}
