import fs from 'node:fs';
import path from 'node:path';
import { ENV } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import {
  isPostgresMeetingStoreEnabled,
  loadMeetingFromDb,
  saveMeetingToDb,
} from './postgresMeetingStore.js';

const baseDir = path.resolve(process.cwd(), ENV.MEETING_STORE_DIR);

function ensureBaseDir() {
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
}

function meetingFile(roomId) {
  ensureBaseDir();
  return path.join(baseDir, `${roomId}.json`);
}

export async function loadMeeting(roomId) {
  if (isPostgresMeetingStoreEnabled()) {
    return loadMeetingFromDb(roomId);
  }

  try {
    const file = meetingFile(roomId);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    logger.warn('Meeting load failed:', roomId, error?.message);
    return null;
  }
}

export async function saveMeeting(roomId, payload) {
  if (isPostgresMeetingStoreEnabled()) {
    return saveMeetingToDb(roomId, payload);
  }

  try {
    const now = Date.now();
    const file = meetingFile(roomId);
    const nextPayload = {
      roomId,
      locked: Boolean(payload.locked),
      status: payload.status || 'scheduled',
      source: payload.source || 'api',
      createdAt: payload.createdAt || now,
      updatedAt: payload.updatedAt || now,
      startedAt: payload.startedAt ?? null,
      endedAt: payload.endedAt ?? null,
      metadata: payload.metadata || {},
    };
    fs.writeFileSync(file, JSON.stringify(nextPayload, null, 2), 'utf8');
    return true;
  } catch (error) {
    logger.error('Meeting save failed:', roomId, error?.message);
    return false;
  }
}
