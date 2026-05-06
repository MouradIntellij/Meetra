import { EVENTS } from '../../constants/events.js';
import * as roomService from '../../rooms/roomService.js';
import { resolveAuthenticatedUserFromToken } from '../../services/auth/authService.js';
import { logger } from '../../utils/logger.js';

function canManageMeeting(meeting, user) {
  if (!meeting?.metadata || !user?.email) return false;
  return (
    (meeting.metadata.createdByUserId && meeting.metadata.createdByUserId === user.id)
    || (meeting.metadata.createdByEmail && meeting.metadata.createdByEmail === user.email)
    || (meeting.metadata.hostEmail && meeting.metadata.hostEmail === user.email)
  );
}

async function canManageRoom(roomId, socket, authToken = '') {
  if (roomService.isModerator(roomId, socket.id)) return true;

  if (socket._meetraCanManageMeeting && socket._meetraRoom === roomId) {
    return true;
  }

  if (!authToken) return false;

  const meetingInfo = await roomService.getMeetingRoomInfo(roomId);
  const authenticated = await resolveAuthenticatedUserFromToken(authToken);
  return Boolean(authenticated && canManageMeeting(meetingInfo, authenticated));
}

function emitRoomState(io, socket, roomId) {
  const info = roomService.getRoomInfo(roomId);
  if (!info) return;

  io.to(roomId).emit(EVENTS.HOST_CHANGED, { newHostId: info.hostId });
  io.to(roomId).emit(EVENTS.COHOSTS_UPDATED, { coHostIds: info.coHostIds || [] });
  io.to(roomId).emit(EVENTS.ROOM_PARTICIPANTS, {
    participants: info.participants || [],
    hostId: info.hostId,
    locked: info.locked,
    coHostIds: info.coHostIds || [],
  });
  socket.emit(EVENTS.HOST_STATUS_SYNCED, {
    hostSocketId: info.hostId,
    participants: info.participants || [],
    locked: info.locked,
    coHostIds: info.coHostIds || [],
  });
}

export function registerHostHandlers(io, socket) {

  socket.on(EVENTS.HOST_STATUS_SYNC, async ({ roomId, userName, authToken = '' }) => {
    if (!(await canManageRoom(roomId, socket, authToken))) return;

    socket._meetraCanManageMeeting = true;
    socket._meetraRoom = roomId;
    socket._meetraName = userName || socket._meetraName || 'Hôte';
    socket.join(roomId);

    roomService.ensureHostPresence(roomId, {
      socketId: socket.id,
      userId: socket._meetraUserId || socket.id,
      userName: socket._meetraName,
    });

    logger.socket(EVENTS.HOST_STATUS_SYNC, { roomId, socketId: socket.id });
    emitRoomState(io, socket, roomId);
  });

  // Mute all participants
  socket.on(EVENTS.MUTE_ALL, async ({ roomId, authToken = '' }) => {
    if (!(await canManageRoom(roomId, socket, authToken))) return;
    logger.socket(EVENTS.MUTE_ALL, { roomId });
    socket.to(roomId).emit(EVENTS.MUTED_BY_HOST, { all: true });
    emitRoomState(io, socket, roomId);
  });

  // Mute specific user
  socket.on(EVENTS.MUTE_USER, async ({ roomId, targetSocketId, authToken = '' }) => {
    if (!(await canManageRoom(roomId, socket, authToken))) return;
    logger.socket(EVENTS.MUTE_USER, { targetSocketId });
    io.to(targetSocketId).emit(EVENTS.MUTED_BY_HOST, { all: false });
    emitRoomState(io, socket, roomId);
  });

  // Kick user
  socket.on(EVENTS.KICK_USER, async ({ roomId, targetSocketId, authToken = '' }) => {
    if (!(await canManageRoom(roomId, socket, authToken))) return;
    logger.socket(EVENTS.KICK_USER, { targetSocketId });
    io.to(targetSocketId).emit(EVENTS.KICKED, { message: 'You were removed by the host.' });
    // Force disconnect after short delay
    setTimeout(() => {
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) targetSocket.disconnect(true);
    }, 1000);
  });

  // Lock / unlock room
  socket.on(EVENTS.LOCK_ROOM, async ({ roomId, locked, authToken = '' }) => {
    if (!(await canManageRoom(roomId, socket, authToken))) return;
    await roomService.lockRoom(roomId, locked);
    logger.socket(EVENTS.LOCK_ROOM, { roomId, locked });
    io.to(roomId).emit(EVENTS.ROOM_LOCKED, { locked, by: socket.id });
    emitRoomState(io, socket, roomId);
  });

  // Transfer host
  socket.on(EVENTS.ASSIGN_HOST, ({ roomId, targetSocketId }) => {
    if (!roomService.isHost(roomId, socket.id)) return;
    roomService.setHost(roomId, targetSocketId);
    logger.socket(EVENTS.ASSIGN_HOST, { targetSocketId });
    io.to(roomId).emit(EVENTS.HOST_CHANGED, { newHostId: targetSocketId });
    io.to(roomId).emit(EVENTS.COHOSTS_UPDATED, { coHostIds: roomService.getCoHostIds(roomId) });
  });

  socket.on(EVENTS.ASSIGN_COHOST, ({ roomId, targetSocketId }) => {
    if (!roomService.isHost(roomId, socket.id)) return;
    if (!roomService.assignCoHost(roomId, targetSocketId)) return;
    logger.socket(EVENTS.ASSIGN_COHOST, { targetSocketId });
    io.to(roomId).emit(EVENTS.COHOSTS_UPDATED, { coHostIds: roomService.getCoHostIds(roomId) });
  });

  socket.on(EVENTS.REMOVE_COHOST, ({ roomId, targetSocketId }) => {
    if (!roomService.isHost(roomId, socket.id)) return;
    if (!roomService.removeCoHost(roomId, targetSocketId)) return;
    logger.socket(EVENTS.REMOVE_COHOST, { targetSocketId });
    io.to(roomId).emit(EVENTS.COHOSTS_UPDATED, { coHostIds: roomService.getCoHostIds(roomId) });
  });

  socket.on(EVENTS.MEDIA_BACKEND_CHANGE, async ({ roomId, backend, reason = '', authToken = '' }) => {
    if (!(await canManageRoom(roomId, socket, authToken))) return;
    const nextBackend = backend === 'p2p' ? 'p2p' : 'livekit';
    logger.socket(EVENTS.MEDIA_BACKEND_CHANGE, { roomId, backend: nextBackend, reason });
    io.to(roomId).emit(EVENTS.MEDIA_BACKEND_CHANGED, {
      backend: nextBackend,
      reason: reason || (nextBackend === 'p2p' ? 'HOST_SWITCHED_TO_P2P' : 'HOST_SWITCHED_TO_LIVEKIT'),
      by: socket.id,
    });
  });
}
