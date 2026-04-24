import { Server } from 'socket.io';
import { socketCorsOptions } from '../config/cors.js';
import { logger } from '../utils/logger.js';

import { registerRoomHandlers }     from './handlers/roomHandler.js';
import { registerMediaHandlers }    from './handlers/mediaHandler.js';
import { registerChatHandlers }     from './handlers/chatHandler.js';
import { registerHostHandlers }     from './handlers/hostHandler.js';
import { registerReactionHandlers } from './handlers/reactionHandler.js';
import { registerRecordingHandlers} from './handlers/recordingHandler.js';
import { registerBreakoutHandlers } from './handlers/breakoutHandler.js';
import { registerTranscriptionHandlers } from './handlers/transcriptionHandler.js';

// Whiteboard (inline — small enough)
import { EVENTS } from '../constants/events.js';
import { generateId } from '../utils/uuid.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: socketCorsOptions,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 Socket connected: ${socket.id}`);

    // Register all domain handlers
    registerRoomHandlers(io, socket);
    registerMediaHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerHostHandlers(io, socket);
    registerReactionHandlers(io, socket);
    registerRecordingHandlers(io, socket);
    registerBreakoutHandlers(io, socket);
    registerTranscriptionHandlers(io, socket);

    // Whiteboard (broadcast draw data, clear)
    socket.on(EVENTS.WHITEBOARD_DRAW, ({ roomId, data }) => {
      socket.to(roomId).emit(EVENTS.WHITEBOARD_DRAW, data);
    });
    socket.on(EVENTS.WHITEBOARD_CLEAR, ({ roomId }) => {
      socket.to(roomId).emit(EVENTS.WHITEBOARD_CLEAR);
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}
