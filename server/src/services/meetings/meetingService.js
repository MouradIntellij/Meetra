import { generateId } from '../../utils/uuid.js';
import { listRecentMeetings, loadMeeting, saveMeeting } from './meetingPersistenceService.js';

function buildMeetingPayload(roomId, existing, updates = {}) {
  const now = Date.now();

  return {
    roomId,
    locked: updates.locked ?? existing?.locked ?? false,
    status: updates.status ?? existing?.status ?? 'scheduled',
    source: updates.source ?? existing?.source ?? 'api',
    createdAt: updates.createdAt ?? existing?.createdAt ?? now,
    updatedAt: updates.updatedAt ?? now,
    startedAt: updates.startedAt ?? existing?.startedAt ?? null,
    endedAt: updates.endedAt ?? existing?.endedAt ?? null,
    metadata: {
      ...(existing?.metadata || {}),
      ...(updates.metadata || {}),
    },
  };
}

export async function createMeeting(options = {}) {
  const roomId = options.roomId || generateId();
  const payload = buildMeetingPayload(roomId, null, {
    source: options.source || 'api',
    status: options.status || 'scheduled',
    metadata: options.metadata || {},
  });

  await saveMeeting(roomId, payload);
  return payload;
}

export async function getMeeting(roomId) {
  return loadMeeting(roomId);
}

export async function ensureMeeting(roomId, options = {}) {
  const existing = await loadMeeting(roomId);
  if (existing) return existing;
  if (!options.autoCreate) return null;

  return createMeeting({
    roomId,
    source: options.source || 'socket-join',
    status: options.status || 'scheduled',
    metadata: options.metadata || {},
  });
}

export async function updateMeeting(roomId, updates = {}) {
  const existing = await ensureMeeting(roomId, {
    autoCreate: true,
    source: updates.source || 'system',
    metadata: updates.metadata || {},
  });

  const nextPayload = buildMeetingPayload(roomId, existing, updates);
  await saveMeeting(roomId, nextPayload);
  return nextPayload;
}

export async function setMeetingLocked(roomId, locked) {
  return updateMeeting(roomId, { locked, updatedAt: Date.now() });
}

export async function markMeetingActive(roomId) {
  return updateMeeting(roomId, {
    status: 'active',
    startedAt: Date.now(),
    endedAt: null,
  });
}

export async function markMeetingIdle(roomId) {
  return updateMeeting(roomId, {
    status: 'idle',
    endedAt: Date.now(),
  });
}

export async function getRecentMeetings(limit = 8) {
  return listRecentMeetings(limit);
}
