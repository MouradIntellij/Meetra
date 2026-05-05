import { Pool } from 'pg';
import { ENV } from '../../config/env.js';
import { createPostgresPoolConfig, hasDatabaseUrl } from '../../config/postgres.js';
import { logger } from '../../utils/logger.js';

let pool = null;
let initialized = false;

function hasDatabase() {
    return hasDatabaseUrl();
}

function getPool() {
    if (!hasDatabase()) return null;
    if (!pool) {
        pool = new Pool(createPostgresPoolConfig());
    }
    return pool;
}

export async function isPostgresTranscriptStoreEnabled() {
    return ENV.TRANSCRIPT_STORE_BACKEND === 'postgres' && hasDatabase();
}

export async function initTranscriptTables() {
    if (initialized || !(await isPostgresTranscriptStoreEnabled())) return;

    const db = getPool();
    await db.query(`
        CREATE TABLE IF NOT EXISTS meeting_transcripts (
            room_id TEXT PRIMARY KEY,
            active BOOLEAN NOT NULL DEFAULT FALSE,
            language TEXT NOT NULL DEFAULT 'fr-CA',
            started_at BIGINT NULL,
            summary JSONB NULL,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        );
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS transcript_segments (
            id TEXT PRIMARY KEY,
            room_id TEXT NOT NULL,
            speaker_id TEXT NULL,
            speaker_name TEXT NOT NULL,
            text TEXT NOT NULL,
            is_final BOOLEAN NOT NULL DEFAULT TRUE,
            language TEXT NOT NULL,
            start_ms BIGINT NULL,
            end_ms BIGINT NULL,
            created_at BIGINT NOT NULL
        );
    `);

    await db.query(`
        CREATE INDEX IF NOT EXISTS transcript_segments_room_created_idx
        ON transcript_segments(room_id, created_at);
    `);

    initialized = true;
    logger.info('Transcript Postgres tables ready');
}

export async function loadTranscriptRoomFromDb(roomId) {
    if (!(await isPostgresTranscriptStoreEnabled())) return null;
    await initTranscriptTables();
    const db = getPool();

    const roomResult = await db.query(
        `SELECT room_id, active, language, started_at, summary, created_at, updated_at
         FROM meeting_transcripts
         WHERE room_id = $1`,
        [roomId]
    );

    const roomRow = roomResult.rows[0];
    if (!roomRow) return null;

    const segmentsResult = await db.query(
        `SELECT id, room_id, speaker_id, speaker_name, text, is_final, language, start_ms, end_ms, created_at
         FROM transcript_segments
         WHERE room_id = $1
         ORDER BY created_at ASC`,
        [roomId]
    );

    return {
        active: roomRow.active,
        language: roomRow.language,
        startedAt: roomRow.started_at,
        summary: roomRow.summary,
        createdAt: Number(roomRow.created_at),
        updatedAt: Number(roomRow.updated_at),
        segments: segmentsResult.rows.map((row) => ({
            id: row.id,
            roomId: row.room_id,
            speakerId: row.speaker_id,
            speakerName: row.speaker_name,
            text: row.text,
            isFinal: row.is_final,
            language: row.language,
            startMs: Number(row.start_ms),
            endMs: Number(row.end_ms),
            createdAt: Number(row.created_at),
        })),
    };
}

export async function saveTranscriptRoomToDb(roomId, payload) {
    if (!(await isPostgresTranscriptStoreEnabled())) return false;
    await initTranscriptTables();
    const db = getPool();

    await db.query(
        `INSERT INTO meeting_transcripts (room_id, active, language, started_at, summary, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (room_id)
         DO UPDATE SET
           active = EXCLUDED.active,
           language = EXCLUDED.language,
           started_at = EXCLUDED.started_at,
           summary = EXCLUDED.summary,
           updated_at = EXCLUDED.updated_at`,
        [
            roomId,
            payload.active,
            payload.language,
            payload.startedAt,
            payload.summary ?? null,
            payload.createdAt ?? Date.now(),
            payload.updatedAt ?? Date.now(),
        ]
    );

    await db.query('DELETE FROM transcript_segments WHERE room_id = $1', [roomId]);

    for (const segment of payload.segments || []) {
        await db.query(
            `INSERT INTO transcript_segments
             (id, room_id, speaker_id, speaker_name, text, is_final, language, start_ms, end_ms, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
                segment.id,
                roomId,
                segment.speakerId || null,
                segment.speakerName || 'Participant',
                segment.text || '',
                Boolean(segment.isFinal),
                segment.language || payload.language || 'fr-CA',
                segment.startMs ?? Date.now(),
                segment.endMs ?? Date.now(),
                segment.createdAt ?? Date.now(),
            ]
        );
    }

    return true;
}

export async function purgeExpiredTranscriptRows(retentionDays) {
    if (!(await isPostgresTranscriptStoreEnabled())) return;
    await initTranscriptTables();
    const db = getPool();
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    await db.query('DELETE FROM transcript_segments WHERE room_id IN (SELECT room_id FROM meeting_transcripts WHERE updated_at < $1)', [cutoff]);
    await db.query('DELETE FROM meeting_transcripts WHERE updated_at < $1', [cutoff]);
}
