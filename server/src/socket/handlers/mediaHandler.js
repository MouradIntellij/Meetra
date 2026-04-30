import { EVENTS } from '../../constants/events.js';
import { logger } from '../../utils/logger.js';

export function registerMediaHandlers(io, socket) {

  // ✅ FIX: Use io.to(targetUserId) — NOT socket.to(roomId)
  // socket.to(roomId) broadcasts to ALL room members, breaking WebRTC signaling.
  // WebRTC OFFER/ANSWER/ICE must go to ONE specific peer only.

  socket.on(EVENTS.OFFER, ({ offer, targetUserId, roomId }) => {
    logger.socket(EVENTS.OFFER, { from: socket.id, to: targetUserId });
    io.to(targetUserId).emit(EVENTS.OFFER, {
      offer,
      fromUserId: socket.id,
      targetUserId,
    });
  });

  socket.on(EVENTS.ANSWER, ({ answer, targetUserId, roomId }) => {
    logger.socket(EVENTS.ANSWER, { from: socket.id, to: targetUserId });
    io.to(targetUserId).emit(EVENTS.ANSWER, {
      answer,
      fromUserId: socket.id,
      targetUserId,
    });
  });

  socket.on(EVENTS.ICE_CANDIDATE, ({ candidate, targetUserId, roomId }) => {
    io.to(targetUserId).emit(EVENTS.ICE_CANDIDATE, {
      candidate,
      fromUserId: socket.id,
      targetUserId,
    });
  });

  // Screen share → broadcast to room is correct
  socket.on(EVENTS.SCREEN_START, ({ roomId }) => {
    logger.socket(EVENTS.SCREEN_START, socket.id);
    socket.to(roomId).emit(EVENTS.SCREEN_START, { userId: socket.id });
  });

  socket.on(EVENTS.SCREEN_STOP, ({ roomId }) => {
    socket.to(roomId).emit(EVENTS.SCREEN_STOP, { userId: socket.id });
  });

  // Toggle → broadcast to room is correct
  socket.on(EVENTS.TOGGLE_VIDEO, ({ roomId, userId, enabled }) => {
    socket.to(roomId).emit(EVENTS.VIDEO_TOGGLED, { userId, enabled });
  });

  socket.on(EVENTS.TOGGLE_AUDIO, ({ roomId, userId, enabled }) => {
    socket.to(roomId).emit(EVENTS.AUDIO_TOGGLED, { userId, enabled });
  });

  // Audio level → broadcast to room is correct
  socket.on(EVENTS.AUDIO_LEVEL, ({ roomId, level }) => {
    socket.to(roomId).emit(EVENTS.AUDIO_LEVEL, { userId: socket.id, level });
  });
}
