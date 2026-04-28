const presenceByEmail = new Map();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function markHubPresence(email, socketId, profile = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !socketId) return null;

  const current = presenceByEmail.get(normalizedEmail) || {
    email: normalizedEmail,
    name: profile.name || normalizedEmail.split('@')[0] || normalizedEmail,
    role: profile.role || 'member',
    status: profile.presenceStatus || profile.status || 'available',
    socketIds: new Set(),
    lastSeenAt: Date.now(),
  };

  current.name = profile.name || current.name;
  current.role = profile.role || current.role;
  current.status = profile.presenceStatus || profile.status || current.status || 'available';
  current.lastSeenAt = Date.now();
  current.socketIds.add(socketId);

  presenceByEmail.set(normalizedEmail, current);
  return serializePresence(current);
}

export function clearHubPresence(email, socketId) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !socketId) return false;

  const current = presenceByEmail.get(normalizedEmail);
  if (!current) return false;

  current.socketIds.delete(socketId);
  current.lastSeenAt = Date.now();

  if (current.socketIds.size === 0) {
    presenceByEmail.delete(normalizedEmail);
    return true;
  }

  presenceByEmail.set(normalizedEmail, current);
  return true;
}

export function listHubPresence() {
  return Array.from(presenceByEmail.values())
    .map(serializePresence)
    .sort((a, b) => (b.onlineSince || 0) - (a.onlineSince || 0));
}

export function isHubUserOnline(email) {
  return presenceByEmail.has(normalizeEmail(email));
}

export function setHubPresenceStatus(email, status) {
  const normalizedEmail = normalizeEmail(email);
  const current = presenceByEmail.get(normalizedEmail);
  if (!current) return null;
  current.status = String(status || 'available').trim();
  current.lastSeenAt = Date.now();
  presenceByEmail.set(normalizedEmail, current);
  return serializePresence(current);
}

function serializePresence(entry) {
  return {
    email: entry.email,
    name: entry.name,
    role: entry.role,
    online: true,
    status: entry.status || 'available',
    connectionCount: entry.socketIds.size,
    onlineSince: entry.lastSeenAt,
  };
}
