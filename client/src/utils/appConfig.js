function isLocalHostname(hostname) {
  return /^(localhost|127(?:\.\d{1,3}){3})$/i.test(String(hostname || ''));
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
  if (electronJoinBaseUrl) return electronJoinBaseUrl;

  const explicitJoinBaseUrl = import.meta.env.VITE_PUBLIC_JOIN_BASE_URL;
  if (explicitJoinBaseUrl) return explicitJoinBaseUrl;

  return '';
}

export function isLocalHostName(hostname) {
  return isLocalHostname(hostname);
}
