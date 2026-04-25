import * as store from './roomStore.js';
import * as meetingService from '../services/meetings/meetingService.js';

export async function createRoom() {
  return meetingService.createMeeting({
    source: 'api',
  });
}

export function getRoomInfo(roomId) {
  const room = store.getRoom(roomId);
  if (!room) return null;
  return {
    id: room.id,
    hostId: room.hostId,
    locked: room.locked,
    participantCount: room.participants.size,
    participants: store.getParticipantsList(roomId),
  };
}

export async function getMeetingRoomInfo(roomId) {
  const room = store.getRoom(roomId);
  const meeting = await meetingService.getMeeting(roomId);

  if (!room && !meeting) return null;

  return {
    id: roomId,
    hostId: room?.hostId || null,
    locked: room?.locked ?? meeting?.locked ?? false,
    participantCount: room?.participants.size ?? 0,
    participants: room ? store.getParticipantsList(roomId) : [],
    createdAt: meeting?.createdAt ?? room?.createdAt ?? null,
    status: meeting?.status || (room ? 'active' : 'scheduled'),
    startedAt: meeting?.startedAt ?? null,
    endedAt: meeting?.endedAt ?? null,
    source: meeting?.source || 'runtime',
  };
}

export async function joinRoom(roomId, { socketId, userId, userName }) {
  const meeting = await meetingService.ensureMeeting(roomId, {
    autoCreate: true,
    source: 'socket-join',
    metadata: {
      autoCreated: true,
    },
  });

  const room = store.getRoom(roomId);
  if (!room) {
    store.createRoomWithId(roomId, {
      locked: meeting?.locked ?? false,
      createdAt: meeting?.createdAt
        ? new Date(meeting.createdAt).toISOString()
        : new Date().toISOString(),
    });
  }

  const finalRoom = store.getRoom(roomId);
  if (finalRoom.locked) return { error: 'ROOM_LOCKED' };

  const participant = store.addParticipant(roomId, { id: userId, socketId, name: userName });

  // First participant becomes host
  if (finalRoom.participants.size === 1) {
    finalRoom.hostId = socketId;
  }

  await meetingService.markMeetingActive(roomId);

  return { participant, room: finalRoom };
}

export async function leaveRoom(socketId) {
  const result = store.removeParticipant(socketId);
  if (result?.room && result.room.participants.size === 0) {
    await meetingService.markMeetingIdle(result.roomId);
  }
  return result;
}

export function isHost(roomId, socketId) {
  const room = store.getRoom(roomId);
  return room?.hostId === socketId;
}

export function setHost(roomId, newHostSocketId) {
  const room = store.getRoom(roomId);
  if (!room) return false;
  room.hostId = newHostSocketId;
  return true;
}

export async function lockRoom(roomId, locked) {
  const room = store.getRoom(roomId);
  if (room) {
    room.locked = locked;
  }
  await meetingService.setMeetingLocked(roomId, locked);
  return true;
}

export function getParticipants(roomId) {
  return store.getParticipantsList(roomId);
}

export function updateParticipantStatus(socketId, updates) {
  return store.updateParticipant(socketId, updates);
}

// Breakout
export function createBreakoutRooms(roomId, names) {
  return names.map(name => store.createBreakoutRoom(roomId, name));
}

export function getBreakoutRooms(roomId) {
  return store.getBreakoutRooms(roomId);
}

export function assignBreakout(roomId, socketId, breakoutId) {
  return store.assignToBreakout(roomId, socketId, breakoutId);
}

export function endBreakouts(roomId) {
  store.deleteBreakoutRooms(roomId);
}
