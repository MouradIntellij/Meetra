import { loadTranscriptRoom, saveTranscriptRoom } from './transcriptPersistenceService.js';

const roomTranscripts = new Map();

function ensureRoom(roomId) {
    if (!roomTranscripts.has(roomId)) {
        const persisted = loadTranscriptRoom(roomId);
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

function persistRoom(roomId) {
    const room = ensureRoom(roomId);
    saveTranscriptRoom(roomId, {
        active: room.active,
        language: room.language,
        startedAt: room.startedAt,
        segments: room.segments,
        summary: room.summary ?? null,
        createdAt: room.createdAt ?? Date.now(),
        updatedAt: Date.now(),
    });
}

export function startTranscript(roomId, options = {}) {
    const room = ensureRoom(roomId);
    room.active = true;
    room.language = options.language || room.language || 'fr-CA';
    room.startedAt = room.startedAt || Date.now();
    persistRoom(roomId);
    return room;
}

export function stopTranscript(roomId) {
    const room = ensureRoom(roomId);
    room.active = false;
    persistRoom(roomId);
    return room;
}

export function appendTranscriptSegment(roomId, segment) {
    const room = ensureRoom(roomId);

    const normalized = {
        id: segment.id || `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        roomId,
        speakerId: segment.speakerId,
        speakerName: segment.speakerName || 'Participant',
        text: segment.text || '',
        isFinal: Boolean(segment.isFinal),
        language: segment.language || room.language || 'fr-CA',
        startMs: segment.startMs ?? Date.now(),
        endMs: segment.endMs ?? Date.now(),
        createdAt: Date.now(),
    };

    if (normalized.isFinal) {
        room.segments.push(normalized);
        persistRoom(roomId);
    }

    return normalized;
}

export function getTranscriptState(roomId) {
    const room = ensureRoom(roomId);
    return {
        active: room.active,
        language: room.language,
        startedAt: room.startedAt,
        segments: room.segments,
        summary: room.summary ?? null,
    };
}

export function getTranscriptSegments(roomId) {
    return ensureRoom(roomId).segments;
}

export function clearTranscript(roomId) {
    const room = ensureRoom(roomId);
    room.segments = [];
    room.summary = null;
    room.startedAt = room.active ? Date.now() : null;
    persistRoom(roomId);
    return room;
}

export function getTranscriptSummary(roomId) {
    return ensureRoom(roomId).summary ?? null;
}

export function setTranscriptSummary(roomId, summary) {
    const room = ensureRoom(roomId);
    room.summary = summary;
    persistRoom(roomId);
    return room.summary;
}
