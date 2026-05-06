import * as store from './roomStore.js';
import * as meetingService from '../services/meetings/meetingService.js';

export async function createRoom() {
  return meetingService.createMeeting({
    source: 'api',
  });
}

export async function createScheduledRoom(options = {}) {
  const inviteeEmails = Array.isArray(options.inviteeEmails)
    ? Array.from(new Set(options.inviteeEmails.map((email) => String(email || '').trim()).filter(Boolean)))
    : [];

  const metadata = {
    title: options.title || 'Réunion Meetra',
    scheduledFor: options.scheduledFor || null,
    timezone: options.timezone || null,
    durationMinutes: options.durationMinutes || 60,
    hostName: options.hostName || null,
    hostEmail: options.hostEmail || null,
    hostPhone: options.hostPhone || null,
    inviteeEmails,
    createdByUserId: options.createdByUserId || null,
    createdByEmail: options.createdByEmail || null,
    createdByName: options.createdByName || null,
  };

  return meetingService.createMeeting({
    source: options.source || 'api',
    status: options.status || 'scheduled',
    metadata,
  });
}

export async function updateMeetingSchedule(roomId, updates = {}) {
  const existing = await meetingService.getMeeting(roomId);
  if (!existing) return null;

  return meetingService.updateMeeting(roomId, {
    metadata: {
      ...(existing.metadata || {}),
      ...(updates.title !== undefined ? { title: updates.title || 'Réunion Meetra' } : {}),
      ...(updates.scheduledFor !== undefined ? { scheduledFor: updates.scheduledFor || null } : {}),
      ...(updates.timezone !== undefined ? { timezone: updates.timezone || null } : {}),
      ...(updates.durationMinutes !== undefined ? { durationMinutes: updates.durationMinutes || 60 } : {}),
      ...(updates.hostName !== undefined ? { hostName: updates.hostName || null } : {}),
      ...(updates.hostEmail !== undefined ? { hostEmail: updates.hostEmail || null } : {}),
      ...(updates.hostPhone !== undefined ? { hostPhone: updates.hostPhone || null } : {}),
    },
  });
}

export function getRoomInfo(roomId) {
  const room = store.getRoom(roomId);
  if (!room) return null;
  return {
    id: room.id,
    hostId: room.hostId,
    locked: room.locked,
    coHostIds: Array.from(room.coHostIds || []),
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
    coHostIds: room ? Array.from(room.coHostIds || []) : (meeting?.metadata?.coHostIds || []),
    createdAt: meeting?.createdAt ?? room?.createdAt ?? null,
    status: meeting?.status || (room ? 'active' : 'scheduled'),
    startedAt: meeting?.startedAt ?? null,
    endedAt: meeting?.endedAt ?? null,
    source: meeting?.source || 'runtime',
    metadata: meeting?.metadata || {},
    title: meeting?.metadata?.title || 'Réunion Meetra',
    scheduledFor: meeting?.metadata?.scheduledFor || null,
    timezone: meeting?.metadata?.timezone || null,
    durationMinutes: meeting?.metadata?.durationMinutes || 60,
    hostName: meeting?.metadata?.hostName || null,
    hostEmail: meeting?.metadata?.hostEmail || null,
    hostPhone: meeting?.metadata?.hostPhone || null,
    inviteeEmails: meeting?.metadata?.inviteeEmails || [],
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

export function isCoHost(roomId, socketId) {
  const room = store.getRoom(roomId);
  return room?.coHostIds?.has(socketId) || false;
}

export function isModerator(roomId, socketId) {
  return isHost(roomId, socketId) || isCoHost(roomId, socketId);
}

export function setHost(roomId, newHostSocketId) {
  const room = store.getRoom(roomId);
  if (!room) return false;
  room.hostId = newHostSocketId;
  room.coHostIds?.delete(newHostSocketId);
  return true;
}

export function getCoHostIds(roomId) {
  const room = store.getRoom(roomId);
  return Array.from(room?.coHostIds || []);
}

export function assignCoHost(roomId, targetSocketId) {
  const room = store.getRoom(roomId);
  if (!room || room.hostId === targetSocketId || !room.participants.has(targetSocketId)) return false;
  room.coHostIds.add(targetSocketId);
  return true;
}

export function removeCoHost(roomId, targetSocketId) {
  const room = store.getRoom(roomId);
  if (!room) return false;
  return room.coHostIds.delete(targetSocketId);
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

export function getRaisedHands(roomId) {
  return store.getParticipantsList(roomId)
    .filter((participant) => participant.handRaised)
    .sort((a, b) => {
      const left = Number(a.handRaisedAt || 0);
      const right = Number(b.handRaisedAt || 0);
      if (left !== right) return left - right;
      return String(a.joinedAt || '').localeCompare(String(b.joinedAt || ''));
    })
    .map((participant, index) => ({
      socketId: participant.socketId,
      userId: participant.socketId,
      name: participant.name || participant.userName || 'Participant',
      userName: participant.name || participant.userName || 'Participant',
      handRaised: true,
      handRaisedAt: participant.handRaisedAt || null,
      handOrder: index + 1,
    }));
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

export async function getRecentMeetings(limit = 8) {
  const meetings = await meetingService.getRecentMeetings(limit);
  return meetings.map((meeting) => ({
    ...meeting,
    title: meeting.metadata?.title || 'Réunion Meetra',
    scheduledFor: meeting.metadata?.scheduledFor || null,
    timezone: meeting.metadata?.timezone || null,
    durationMinutes: meeting.metadata?.durationMinutes || 60,
    hostName: meeting.metadata?.hostName || null,
    hostEmail: meeting.metadata?.hostEmail || null,
    hostPhone: meeting.metadata?.hostPhone || null,
    inviteeEmails: meeting.metadata?.inviteeEmails || [],
    createdByUserId: meeting.metadata?.createdByUserId || null,
    createdByEmail: meeting.metadata?.createdByEmail || null,
    createdByName: meeting.metadata?.createdByName || null,
  }));
}
