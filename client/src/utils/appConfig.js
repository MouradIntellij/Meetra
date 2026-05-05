function isLocalHostname(hostname) {
  return /^(localhost|127(?:\.\d{1,3}){3})$/i.test(String(hostname || ''));
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function getElectronRuntimeConfig() {
  if (typeof window === 'undefined') return {};
  return window.electronAPI?.config || {};
}

export function getApiUrl() {
  const electronApiUrl = getElectronRuntimeConfig().apiUrl;
  if (electronApiUrl) return electronApiUrl;

  const explicitApiUrl = import.meta.env.VITE_API_URL;
  if (explicitApiUrl) return explicitApiUrl;

  if (typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
    const { protocol, hostname } = window.location;
    if (!isLocalHostname(hostname)) {
      return `${protocol}//${hostname}:4000`;
    }
  }

  return 'http://localhost:4000';
}

export function getPublicJoinBaseUrl() {
  const electronJoinBaseUrl = getElectronRuntimeConfig().publicJoinBaseUrl;
  if (electronJoinBaseUrl) return normalizeBaseUrl(electronJoinBaseUrl);

  const explicitJoinBaseUrl = import.meta.env.VITE_PUBLIC_JOIN_BASE_URL;
  if (explicitJoinBaseUrl) return normalizeBaseUrl(explicitJoinBaseUrl);

  if (typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
    return normalizeBaseUrl(window.location.origin);
  }

  return '';
}

export function buildPublicRoomUrl(roomId) {
  const normalizedRoomId = String(roomId || '').trim();
  if (!normalizedRoomId) return '';

  const baseUrl = getPublicJoinBaseUrl();
  if (!baseUrl) return normalizedRoomId;

  return `${baseUrl}/room/${encodeURIComponent(normalizedRoomId)}`;
}

export function getMediaBackend() {
  const electronMediaBackend = getElectronRuntimeConfig().mediaBackend;
  const value = electronMediaBackend || import.meta.env.VITE_MEDIA_BACKEND || 'p2p';
  return String(value || 'p2p').trim().toLowerCase();
}

export function isLiveKitMediaEnabled() {
  return getMediaBackend() === 'livekit';
}

export function isLocalHostName(hostname) {
  return isLocalHostname(hostname);
}
