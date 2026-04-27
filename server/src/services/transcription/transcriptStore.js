import { loadTranscriptRoom, saveTranscriptRoom } from './transcriptPersistenceService.js';

const roomTranscripts = new Map();

async function ensureRoom(roomId) {
    if (!roomTranscripts.has(roomId)) {
        const persisted = await loadTranscriptRoom(roomId);
        roomTranscripts.set(roomId, {
            active: persisted?.active ?? false,
            language: persisted?.language ?? 'fr-CA',
            startedAt: persisted?.startedAt ?? null,
            segments: persisted?.segments ?? [],
            summary: persisted?.summary ?? null,
            createdAt: persisted?.createdAt ?? Date.now(),
            updatedAt: persisted?.updatedAt ?? Date.now(),
            speakers: new Map(),
        });
    }

    return roomTranscripts.get(roomId);
}

async function persistRoom(roomId) {
    const room = await ensureRoom(roomId);
    await saveTranscriptRoom(roomId, {
        active: room.active,
        language: room.language,
        startedAt: room.startedAt,
        segments: room.segments,
        summary: room.summary ?? null,
        createdAt: room.createdAt ?? Date.now(),
        updatedAt: Date.now(),
    });
}

export async function startTranscript(roomId, options = {}) {
    const room = await ensureRoom(roomId);
    room.active = true;
    room.language = options.language || room.language || 'fr-CA';
    room.startedAt = room.startedAt || Date.now();
    await persistRoom(roomId);
    return room;
}

export async function stopTranscript(roomId) {
    const room = await ensureRoom(roomId);
    room.active = false;
    await persistRoom(roomId);
    return room;
}

export async function appendTranscriptSegment(roomId, segment) {
    const room = await ensureRoom(roomId);

    const normalized = {
        id: segment.id || `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        roomId,
        speakerId: segment.speakerId,
        speakerName: segment.speakerName || 'Participant',
        text: segment.text || '',
        translations: segment.translations || {},
        isFinal: Boolean(segment.isFinal),
        language: segment.language || room.language || 'fr-CA',
        startMs: segment.startMs ?? Date.now(),
        endMs: segment.endMs ?? Date.now(),
        createdAt: Date.now(),
    };

    if (normalized.isFinal) {
        room.segments.push(normalized);
        await persistRoom(roomId);
    }

    return normalized;
}

export async function getTranscriptState(roomId) {
    const room = await ensureRoom(roomId);
    return {
        active: room.active,
        language: room.language,
        startedAt: room.startedAt,
        segments: room.segments,
        summary: room.summary ?? null,
    };
}

export async function getTranscriptSegments(roomId) {
    return (await ensureRoom(roomId)).segments;
}

export async function clearTranscript(roomId) {
    const room = await ensureRoom(roomId);
    room.segments = [];
    room.summary = null;
    room.startedAt = room.active ? Date.now() : null;
    await persistRoom(roomId);
    return room;
}

export async function getTranscriptSummary(roomId) {
    return (await ensureRoom(roomId)).summary ?? null;
}

export async function setTranscriptSummary(roomId, summary) {
    const room = await ensureRoom(roomId);
    room.summary = summary;
    await persistRoom(roomId);
    return room.summary;
}
