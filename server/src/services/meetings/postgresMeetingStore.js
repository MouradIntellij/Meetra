import { Pool } from 'pg';
import { ENV } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let pool = null;
let initialized = false;

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!hasDatabase()) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('render.com')
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  return pool;
}

export function isPostgresMeetingStoreEnabled() {
  return (ENV.MEETING_STORE_BACKEND === 'postgres' || ENV.MEETING_STORE_BACKEND === 'auto') && hasDatabase();
}

export async function initMeetingTables() {
  if (initialized || !isPostgresMeetingStoreEnabled()) return;

  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      room_id TEXT PRIMARY KEY,
      locked BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'scheduled',
      source TEXT NOT NULL DEFAULT 'api',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      started_at BIGINT NULL,
      ended_at BIGINT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS meetings_status_updated_idx
    ON meetings(status, updated_at DESC);
  `);

  initialized = true;
  logger.info('Meeting Postgres tables ready');
}

export async function loadMeetingFromDb(roomId) {
  if (!isPostgresMeetingStoreEnabled()) return null;
  await initMeetingTables();

  const db = getPool();
  const result = await db.query(
    `SELECT room_id, locked, status, source, created_at, updated_at, started_at, ended_at, metadata
     FROM meetings
     WHERE room_id = $1`,
    [roomId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    roomId: row.room_id,
    locked: row.locked,
    status: row.status,
    source: row.source,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    startedAt: row.started_at ? Number(row.started_at) : null,
    endedAt: row.ended_at ? Number(row.ended_at) : null,
    metadata: row.metadata || {},
  };
}

export async function saveMeetingToDb(roomId, payload) {
  if (!isPostgresMeetingStoreEnabled()) return false;
  await initMeetingTables();

  const db = getPool();
  const now = Date.now();

  await db.query(
    `INSERT INTO meetings (room_id, locked, status, source, created_at, updated_at, started_at, ended_at, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (room_id)
     DO UPDATE SET
       locked = EXCLUDED.locked,
       status = EXCLUDED.status,
       source = EXCLUDED.source,
       updated_at = EXCLUDED.updated_at,
       started_at = EXCLUDED.started_at,
       ended_at = EXCLUDED.ended_at,
       metadata = EXCLUDED.metadata`,
    [
      roomId,
      Boolean(payload.locked),
      payload.status || 'scheduled',
      payload.source || 'api',
      payload.createdAt || now,
      payload.updatedAt || now,
      payload.startedAt ?? null,
      payload.endedAt ?? null,
      payload.metadata || {},
    ]
  );

  return true;
}

export async function listRecentMeetingsFromDb(limit = 8) {
  if (!isPostgresMeetingStoreEnabled()) return [];
  await initMeetingTables();

  const db = getPool();
  const result = await db.query(
    `SELECT room_id, locked, status, source, created_at, updated_at, started_at, ended_at, metadata
     FROM meetings
     ORDER BY updated_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    roomId: row.room_id,
    locked: row.locked,
    status: row.status,
    source: row.source,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    startedAt: row.started_at ? Number(row.started_at) : null,
    endedAt: row.ended_at ? Number(row.ended_at) : null,
    metadata: row.metadata || {},
  }));
}
