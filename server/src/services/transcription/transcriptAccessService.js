import * as roomService from '../../rooms/roomService.js';

export function canAccessTranscript(roomId, requesterId) {
    if (!requesterId) return false;

    const room = roomService.getRoomInfo(roomId);
    if (!room) return false;

    if (room.hostId === requesterId) return true;
    return (room.participants || []).some((participant) => participant.socketId === requesterId);
}

export function canExportTranscript(roomId, requesterId) {
    return canAccessTranscript(roomId, requesterId);
}
