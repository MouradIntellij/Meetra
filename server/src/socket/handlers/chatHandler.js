import { EVENTS } from '../../constants/events.js';
import { generateId } from '../../utils/uuid.js';
import { logger } from '../../utils/logger.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function registerChatHandlers(io, socket) {

  // ── Message texte OU fichier/image (même event CHAT) ─────
  // Le client envoie tout via 'chat-message', le serveur
  // valide et rebroadcast à toute la salle.
  socket.on(EVENTS.CHAT, (payload) => {
    const { roomId, message, userId, userName, type, data,
      fileName, fileType, fileSize, replyTo } = payload;

    // Validation fichier
    if ((type === 'file' || type === 'image') && data) {
      // Vérifier taille (base64 ~= 4/3 du fichier original)
      const estimatedSize = Math.round(data.length * 0.75);
      if (estimatedSize > MAX_FILE_SIZE) {
        socket.emit('file-transfer-error', {
          error: `Fichier trop volumineux (max 10 Mo)`,
        });
        return;
      }
      logger.socket('FILE_SHARE', { fileName, fileType, size: Math.round(estimatedSize / 1024) + ' KB', room: roomId });
    } else {
      logger.socket(EVENTS.CHAT, { roomId, userName, msg: (message||'').slice(0, 40) });
    }

    // Broadcast à toute la salle (incluant l'expéditeur pour confirmer)
    io.to(roomId).emit(EVENTS.CHAT, {
      id:        generateId(),
      type:      type || 'text',
      message:   message || null,
      fileName:  fileName || null,
      fileType:  fileType || null,
      fileSize:  fileSize || null,
      data:      data || null,         // base64 complet
      userId,
      userName,
      socketId:  socket.id,
      replyTo:   replyTo || null,
      timestamp: new Date().toISOString(),
    });
  });

  // ── Réaction sur un message ───────────────────────────────
  const EV_REACT = EVENTS.CHAT_REACTION ?? 'chat-reaction';
  socket.on(EV_REACT, ({ roomId, messageId, emoji, userId, userName }) => {
    io.to(roomId).emit(EV_REACT, { messageId, emoji, userId, userName });
  });
}