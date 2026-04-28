import { EVENTS } from '../../constants/events.js';
import { logger } from '../../utils/logger.js';
import { addHubMessage, getHubProfile, upsertHubProfile } from '../../services/hub/hubStore.js';
import { getHubUserRoom, joinHubUserRoom } from '../../services/hub/hubRealtimeService.js';
import { clearHubPresence, listHubPresence, markHubPresence, setHubPresenceStatus } from '../../services/hub/hubPresenceStore.js';
import { resolveAuthenticatedUserFromToken } from '../../services/auth/authService.js';

function broadcastPresence(io) {
  io.emit(EVENTS.HUB_PRESENCE_UPDATED, {
    items: listHubPresence(),
  });
}

export function registerHubHandlers(io, socket) {
  socket.on(EVENTS.HUB_ACCESS, async ({ email, name, role, token, status }) => {
    const authenticated = token ? await resolveAuthenticatedUserFromToken(token) : null;
    const profile = upsertHubProfile({
      email: authenticated?.email || email,
      name: authenticated?.name || name,
      role: authenticated?.role || role,
      presenceStatus: status || authenticated?.presenceStatus || 'available',
    });
    if (!profile) {
      socket.emit(EVENTS.TRANSCRIPTION_ERROR, {
        message: 'Hub: email requis pour activer l’accès.',
      });
      return;
    }

    joinHubUserRoom(socket, profile.email);
    markHubPresence(profile.email, socket.id, profile);
    broadcastPresence(io);
    logger.socket(EVENTS.HUB_ACCESS, { email: profile.email, by: socket.id });
  });

  socket.on(EVENTS.HUB_STATUS_SET, ({ email, status }) => {
    const targetEmail = socket.data.hubEmail || email;
    const updated = setHubPresenceStatus(targetEmail, status);
    if (!updated) return;
    upsertHubProfile({
      email: targetEmail,
      name: updated.name,
      role: updated.role,
      presenceStatus: updated.status,
    });
    broadcastPresence(io);
  });

  socket.on(EVENTS.HUB_MESSAGE_SEND, async ({ fromEmail, fromName, toEmail, content, token }) => {
    const authenticated = token ? await resolveAuthenticatedUserFromToken(token) : null;
    const effectiveFromEmail = authenticated?.email || fromEmail;
    const effectiveFromName = authenticated?.name || fromName;
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
      fromEmail: effectiveFromEmail,
      fromName: effectiveFromName,
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

  socket.on('disconnect', () => {
    if (!socket.data.hubEmail) return;
    clearHubPresence(socket.data.hubEmail, socket.id);
    broadcastPresence(io);
  });
}
