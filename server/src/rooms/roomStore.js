import { generateId } from '../utils/uuid.js';

/**
 * In-memory room store.
 * Shape:
 * {
 *   id, hostId, locked, createdAt,
 *   coHostIds: Set<socketId>,
 *   participants: Map<socketId, { id, name, socketId, handRaised, audioEnabled, videoEnabled }>,
 *   breakoutRooms: Map<breakoutId, { id, name, participants: Set<socketId> }>
 * }
 */
const rooms = new Map();
// socketId → roomId (reverse lookup)
const userRoomIndex = new Map();

// ─── ROOM CRUD ────────────────────────────────────────────────
export function createRoom() {
  const id = generateId();
  return createRoomWithId(id);
}

export function createRoomWithId(id, overrides = {}) {
  rooms.set(id, {
    id,
    hostId: null,
    locked: overrides.locked ?? false,
    createdAt: overrides.createdAt || new Date().toISOString(),
    coHostIds: new Set(overrides.coHostIds || []),
    participants: new Map(),
    breakoutRooms: new Map(),
  });
  return rooms.get(id);
}

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

export function deleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    room.participants.forEach((_, socketId) => userRoomIndex.delete(socketId));
    rooms.delete(roomId);
  }
}

// ─── PARTICIPANT CRUD ─────────────────────────────────────────
export function addParticipant(roomId, participant) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.participants.set(participant.socketId, {
    ...participant,
    handRaised: false,
    audioEnabled: true,
    videoEnabled: true,
    joinedAt: new Date().toISOString(),
  });
  userRoomIndex.set(participant.socketId, roomId);
  return room.participants.get(participant.socketId);
}

export function removeParticipant(socketId) {
  const roomId = userRoomIndex.get(socketId);
  if (!roomId) return null;
  const room = rooms.get(roomId);
  if (!room) return null;
  const participant = room.participants.get(socketId);
  room.participants.delete(socketId);
  userRoomIndex.delete(socketId);
  room.coHostIds.delete(socketId);

  // Remove from breakout rooms
  room.breakoutRooms.forEach(br => br.participants.delete(socketId));

  // Clean up empty room
  if (room.participants.size === 0) {
    rooms.delete(roomId);
  }

  return { participant, roomId, room };
}

export function getParticipantRoom(socketId) {
  return userRoomIndex.get(socketId) || null;
}

export function updateParticipant(socketId, updates) {
  const roomId = userRoomIndex.get(socketId);
  if (!roomId) return null;
  const room = rooms.get(roomId);
  if (!room) return null;
  const p = room.participants.get(socketId);
  if (!p) return null;
  Object.assign(p, updates);
  return p;
}

export function getParticipantsList(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.participants.values());
}

// ─── BREAKOUT ROOMS ───────────────────────────────────────────
export function createBreakoutRoom(roomId, name) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const id = generateId();
  room.breakoutRooms.set(id, { id, name, participants: new Set() });
  return room.breakoutRooms.get(id);
}

export function getBreakoutRooms(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.breakoutRooms.values()).map(br => ({
    ...br,
    participants: Array.from(br.participants),
  }));
}

export function assignToBreakout(roomId, socketId, breakoutId) {
  const room = rooms.get(roomId);
  if (!room) return false;
  // Remove from any existing breakout
  room.breakoutRooms.forEach(br => br.participants.delete(socketId));
  const br = room.breakoutRooms.get(breakoutId);
  if (!br) return false;
  br.participants.add(socketId);
  return true;
}

export function deleteBreakoutRooms(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.breakoutRooms.clear();
}

export { rooms };
