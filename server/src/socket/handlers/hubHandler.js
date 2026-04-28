import { EVENTS } from '../../constants/events.js';
import { logger } from '../../utils/logger.js';
import { addHubMessage, getHubProfile, upsertHubProfile } from '../../services/hub/hubStore.js';
import { getHubUserRoom, joinHubUserRoom } from '../../services/hub/hubRealtimeService.js';

export function registerHubHandlers(io, socket) {
  socket.on(EVENTS.HUB_ACCESS, ({ email, name, role }) => {
    const profile = upsertHubProfile({ email, name, role });
    if (!profile) {
      socket.emit(EVENTS.TRANSCRIPTION_ERROR, {
        message: 'Hub: email requis pour activer l’accès.',
      });
      return;
    }

    joinHubUserRoom(socket, profile.email);
    logger.socket(EVENTS.HUB_ACCESS, { email: profile.email, by: socket.id });
  });

  socket.on(EVENTS.HUB_MESSAGE_SEND, ({ fromEmail, fromName, toEmail, content }) => {
    const recipient = getHubProfile(toEmail);
    if (!recipient) {
      socket.emit(EVENTS.HUB_ACTIVITY_RECEIVED, {
        type: 'error',
        title: 'Destinataire introuvable',
        body: "Le destinataire doit d'abord activer son accès Meetra.",
        createdAt: Date.now(),
      });
      return;
    }

    const result = addHubMessage({
      fromEmail,
      fromName,
      toEmail,
      content,
    });

    if (!result?.message) {
      socket.emit(EVENTS.HUB_ACTIVITY_RECEIVED, {
        type: 'error',
        title: 'Envoi impossible',
        body: "Le message direct n'a pas pu être enregistré.",
        createdAt: Date.now(),
      });
      return;
    }

    const { message, activity } = result;

    io.to(getHubUserRoom(message.toEmail)).emit(EVENTS.HUB_MESSAGE_RECEIVED, message);
    if (activity) {
      io.to(getHubUserRoom(message.toEmail)).emit(EVENTS.HUB_ACTIVITY_RECEIVED, activity);
    }
    io.to(getHubUserRoom(message.fromEmail)).emit(EVENTS.HUB_MESSAGE_RECEIVED, message);
  });
}
