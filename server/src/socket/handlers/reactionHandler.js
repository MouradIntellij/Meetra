import { EVENTS } from '../../constants/events.js';
import * as roomService from '../../rooms/roomService.js';

function emitRaisedHands(io, roomId) {
  const raisedHands = roomService.getRaisedHands(roomId);
  io.to(roomId).emit(EVENTS.RAISED_HANDS_UPDATED, { roomId, raisedHands });
  return raisedHands;
}

function raiseHand(io, socket, roomId) {
  const currentParticipant = roomService
    .getParticipants(roomId)
    .find((participant) => participant.socketId === socket.id);
  const handRaisedAt = currentParticipant?.handRaisedAt || Date.now();

  roomService.updateParticipantStatus(socket.id, {
    handRaised: true,
    handRaisedAt,
  });

  const raisedHands = emitRaisedHands(io, roomId);
  const currentHand = raisedHands.find((hand) => hand.socketId === socket.id);

  io.to(roomId).emit(EVENTS.HAND_RAISED, {
    userId: socket.id,
    handRaisedAt,
    handOrder: currentHand?.handOrder || raisedHands.length,
  });
}

function lowerHand(io, socket, roomId) {
  roomService.updateParticipantStatus(socket.id, {
    handRaised: false,
    handRaisedAt: null,
  });

  io.to(roomId).emit(EVENTS.HAND_LOWERED, { userId: socket.id });
  emitRaisedHands(io, roomId);
}

export function registerReactionHandlers(io, socket) {

  // Emoji reaction (fire, clap, heart, etc.)
  socket.on(EVENTS.REACTION, ({ roomId, emoji, userName }) => {
    io.to(roomId).emit(EVENTS.REACTION_BROADCAST, {
      userId: socket.id,
      userName,
      emoji,
      timestamp: Date.now(),
    });
  });

  // Raise hand
  socket.on(EVENTS.RAISE_HAND, ({ roomId, raised }) => {
    if (raised === false) {
      lowerHand(io, socket, roomId);
      return;
    }

    raiseHand(io, socket, roomId);
  });

  // Lower hand
  socket.on(EVENTS.LOWER_HAND, ({ roomId }) => {
    lowerHand(io, socket, roomId);
  });
}
