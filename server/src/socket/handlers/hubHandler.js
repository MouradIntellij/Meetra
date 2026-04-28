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

function emitHubError(socket, body) {
  socket.emit(EVENTS.HUB_ACTIVITY_RECEIVED, {
    id: `hub-error-${Date.now()}`,
    type: 'error',
    title: 'Campus Hub',
    body,
    createdAt: Date.now(),
  });
}

export function registerHubHandlers(io, socket) {
  socket.on(EVENTS.HUB_ACCESS, async ({ email, name, role, token, status }) => {
    try {
      const authenticated = token ? await resolveAuthenticatedUserFromToken(token) : null;
      if (!authenticated?.email) {
        emitHubError(socket, 'Authentification requise pour ouvrir le Campus Hub.');
        return;
      }

      const profile = await upsertHubProfile({
        email: authenticated.email,
        name: authenticated.name || name,
        role: authenticated.role || role,
        presenceStatus: status || authenticated.presenceStatus || 'available',
      });
      if (!profile) return;

      joinHubUserRoom(socket, profile.email);
      markHubPresence(profile.email, socket.id, profile);
      broadcastPresence(io);
      logger.socket(EVENTS.HUB_ACCESS, { email: profile.email, by: socket.id });
    } catch (error) {
      logger.warn('Hub access failed:', error?.message);
      emitHubError(
        socket,
        error?.message === 'HUB_DATABASE_REQUIRED'
          ? 'Le Campus Hub exige une base Postgres active.'
          : "Impossible d'ouvrir la session Campus Hub."
      );
    }
  });

  socket.on(EVENTS.HUB_STATUS_SET, async ({ email, status }) => {
    try {
      const targetEmail = socket.data.hubEmail || email;
      if (!targetEmail) {
        emitHubError(socket, 'Connectez-vous avant de modifier votre statut.');
        return;
      }

      const updated = setHubPresenceStatus(targetEmail, status);
      if (!updated) return;

      await upsertHubProfile({
        email: targetEmail,
        name: updated.name,
        role: updated.role,
        presenceStatus: updated.status,
      });
      broadcastPresence(io);
    } catch (error) {
      logger.warn('Hub status update failed:', error?.message);
      emitHubError(socket, 'Impossible de mettre à jour le statut de présence.');
    }
  });

  socket.on(EVENTS.HUB_MESSAGE_SEND, async ({ fromEmail, fromName, toEmail, content, token }) => {
    try {
      const authenticated = token ? await resolveAuthenticatedUserFromToken(token) : null;
      if (!authenticated?.email) {
        emitHubError(socket, 'Vous devez être authentifié pour envoyer un message.');
        return;
      }

      const effectiveFromEmail = authenticated.email;
      const effectiveFromName = authenticated.name || fromName;
      const recipient = await getHubProfile(toEmail);
      if (!recipient) {
        emitHubError(socket, "Le destinataire doit d'abord activer son compte Meetra.");
        return;
      }

      const result = await addHubMessage({
        fromEmail: effectiveFromEmail,
        fromName: effectiveFromName,
        toEmail,
        content,
      });

      if (!result?.message) {
        emitHubError(socket, "Le message direct n'a pas pu être enregistré.");
        return;
      }

      const { message, activity } = result;

      io.to(getHubUserRoom(message.toEmail)).emit(EVENTS.HUB_MESSAGE_RECEIVED, message);
      if (activity) {
        io.to(getHubUserRoom(message.toEmail)).emit(EVENTS.HUB_ACTIVITY_RECEIVED, activity);
      }
      io.to(getHubUserRoom(message.fromEmail)).emit(EVENTS.HUB_MESSAGE_RECEIVED, message);
    } catch (error) {
      logger.warn('Hub message send failed:', error?.message);
      emitHubError(
        socket,
        error?.message === 'HUB_DATABASE_REQUIRED'
          ? 'La messagerie Hub exige Postgres. Vérifiez DATABASE_URL.'
          : "Impossible d'envoyer le message pour le moment."
      );
    }
  });

  socket.on('disconnect', () => {
    if (!socket.data.hubEmail) return;
    clearHubPresence(socket.data.hubEmail, socket.id);
    broadcastPresence(io);
  });
}
