import { EVENTS } from '../../constants/events.js';
import * as roomService from '../../rooms/roomService.js';
import { logger } from '../../utils/logger.js';

export function registerHostHandlers(io, socket) {

  // Mute all participants
  socket.on(EVENTS.MUTE_ALL, ({ roomId }) => {
    if (!roomService.isModerator(roomId, socket.id)) return;
    logger.socket(EVENTS.MUTE_ALL, { roomId });
    socket.to(roomId).emit(EVENTS.MUTED_BY_HOST, { all: true });
  });

  // Mute specific user
  socket.on(EVENTS.MUTE_USER, ({ roomId, targetSocketId }) => {
    if (!roomService.isModerator(roomId, socket.id)) return;
    logger.socket(EVENTS.MUTE_USER, { targetSocketId });
    io.to(targetSocketId).emit(EVENTS.MUTED_BY_HOST, { all: false });
  });

  // Kick user
  socket.on(EVENTS.KICK_USER, ({ roomId, targetSocketId }) => {
    if (!roomService.isModerator(roomId, socket.id)) return;
    logger.socket(EVENTS.KICK_USER, { targetSocketId });
    io.to(targetSocketId).emit(EVENTS.KICKED, { message: 'You were removed by the host.' });
    // Force disconnect after short delay
    setTimeout(() => {
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) targetSocket.disconnect(true);
    }, 1000);
  });

  // Lock / unlock room
  socket.on(EVENTS.LOCK_ROOM, async ({ roomId, locked }) => {
    if (!roomService.isModerator(roomId, socket.id)) return;
    await roomService.lockRoom(roomId, locked);
    logger.socket(EVENTS.LOCK_ROOM, { roomId, locked });
    io.to(roomId).emit(EVENTS.ROOM_LOCKED, { locked, by: socket.id });
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
}
