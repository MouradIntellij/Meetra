import fs from 'node:fs';
import path from 'node:path';
import { ENV } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const baseDir = path.resolve(process.cwd(), ENV.TRANSCRIPT_STORE_DIR);

function ensureBaseDir() {
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }
}

function roomFile(roomId) {
    ensureBaseDir();
    return path.join(baseDir, `${roomId}.json`);
}

function isExpired(payload) {
    const retentionMs = ENV.TRANSCRIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const anchor = payload?.updatedAt || payload?.createdAt || payload?.startedAt;
    if (!anchor) return false;
    return (Date.now() - anchor) > retentionMs;
}

function deleteRoomFile(roomId) {
    const file = roomFile(roomId);
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
}

export function loadTranscriptRoom(roomId) {
    try {
        const file = roomFile(roomId);
        if (!fs.existsSync(file)) return null;
        const raw = fs.readFileSync(file, 'utf8');
        const parsed = JSON.parse(raw);

        if (isExpired(parsed)) {
            deleteRoomFile(roomId);
            return null;
        }

        return parsed;
    } catch (error) {
        logger.warn('Transcript load failed:', roomId, error?.message);
        return null;
    }
}

export function saveTranscriptRoom(roomId, payload) {
    try {
        const file = roomFile(roomId);
        const nextPayload = {
            ...payload,
            updatedAt: Date.now(),
            createdAt: payload.createdAt || Date.now(),
        };
        fs.writeFileSync(file, JSON.stringify(nextPayload, null, 2), 'utf8');
        return true;
    } catch (error) {
        logger.error('Transcript save failed:', roomId, error?.message);
        return false;
    }
}

export function purgeExpiredTranscriptFiles() {
    try {
        ensureBaseDir();
        const entries = fs.readdirSync(baseDir).filter((entry) => entry.endsWith('.json'));

        entries.forEach((entry) => {
            const roomId = entry.replace(/\.json$/, '');
            loadTranscriptRoom(roomId);
        });
    } catch (error) {
        logger.warn('Transcript retention purge failed:', error?.message);
    }
}
