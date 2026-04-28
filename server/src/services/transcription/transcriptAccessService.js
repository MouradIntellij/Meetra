import * as roomService from '../../rooms/roomService.js';
import { loadTranscriptRoom } from './transcriptPersistenceService.js';

export async function canAccessTranscript(roomId, requesterId) {
    if (!requesterId) return false;

    const room = roomService.getRoomInfo(roomId);
    if (room) {
        if (room.hostId === requesterId) return true;
        if ((room.participants || []).some((participant) => participant.socketId === requesterId)) return true;
    }

    const meeting = await roomService.getMeetingRoomInfo(roomId);
    if (!meeting) return false;

    const transcript = await loadTranscriptRoom(roomId);
    const hasTranscriptContent =
        Boolean(transcript?.startedAt) ||
        Array.isArray(transcript?.segments) && transcript.segments.length > 0;

    // Fallback for persisted meetings/transcripts after runtime room state is lost.
    return hasTranscriptContent;
}

export async function canExportTranscript(roomId, requesterId) {
    return canAccessTranscript(roomId, requesterId);
}
