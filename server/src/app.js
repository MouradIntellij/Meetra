import express from 'express';
import cors from 'cors';
import { corsOptions } from './config/cors.js';
import { ENV } from './config/env.js';
import * as roomService from './rooms/roomService.js';
import { logger } from './utils/logger.js';
import { createTranscriptionRouter } from './routes/transcriptionRoutes.js';
import { createHubRouter } from './routes/hubRoutes.js';
import { createAuthRouter, getBearerToken } from './routes/authRoutes.js';
import { purgeExpiredTranscriptFiles } from './services/transcription/transcriptPersistenceService.js';
import { appendHubActivity, upsertHubProfile } from './services/hub/hubStore.js';
import { resolveAuthenticatedUserFromToken } from './services/auth/authService.js';

export function createApp() {
  const app = express();

  function normalizeOrigin(value) {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  function resolveMeetingJoinBase(req) {
    if (!ENV.isDev && ENV.CLIENT_URL) {
      return normalizeOrigin(ENV.CLIENT_URL);
    }

    const origin = req.get('origin');
    if (origin) return normalizeOrigin(origin);

    const referer = req.get('referer');
    if (referer) {
      try {
        return normalizeOrigin(new URL(referer).origin);
      } catch {
        // ignore invalid referer
      }
    }

    return normalizeOrigin(ENV.CLIENT_URL);
  }

  function serializeMeetingSummary(meeting, joinBase) {
    const roomId = meeting.roomId || meeting.id;
    return {
      roomId,
      title: meeting.title || meeting.metadata?.title || 'Réunion Meetra',
      joinUrl: joinBase ? `${joinBase}/room/${roomId}` : null,
      scheduledFor: meeting.scheduledFor || meeting.metadata?.scheduledFor || null,
      timezone: meeting.timezone || meeting.metadata?.timezone || null,
      durationMinutes: meeting.durationMinutes || meeting.metadata?.durationMinutes || 60,
      hostName: meeting.hostName || meeting.metadata?.hostName || null,
      hostEmail: meeting.hostEmail || meeting.metadata?.hostEmail || null,
      hostPhone: meeting.hostPhone || meeting.metadata?.hostPhone || null,
      status: meeting.status || 'scheduled',
      locked: Boolean(meeting.locked),
      createdAt: meeting.createdAt || null,
      updatedAt: meeting.updatedAt || null,
      startedAt: meeting.startedAt || null,
      endedAt: meeting.endedAt || null,
    };
  }

  async function resolveRequestUser(req) {
    return resolveAuthenticatedUserFromToken(getBearerToken(req));
  }

  function canManageMeeting(meeting, user) {
    if (!meeting?.metadata || !user?.email) return false;
    return (
      (meeting.metadata.createdByUserId && meeting.metadata.createdByUserId === user.id)
      || (meeting.metadata.createdByEmail && meeting.metadata.createdByEmail === user.email)
      || (meeting.metadata.hostEmail && meeting.metadata.hostEmail === user.email)
    );
  }

  Promise.resolve(purgeExpiredTranscriptFiles()).catch((error) => {
    logger.warn('Transcript retention startup purge failed:', error?.message);
  });

  app.use(cors(corsOptions));
  app.use(express.json());
  app.use('/api', createAuthRouter());
  app.use('/api', createTranscriptionRouter());
  app.use('/api', createHubRouter());

  // ── Health check ──────────────────────────────────────────
  app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

  // ── POST /api/rooms — créer une salle ─────────────────────
  app.post('/api/rooms', async (req, res) => {
    try {
      const authenticated = await resolveRequestUser(req);
      if (!authenticated) {
        return res.status(401).json({ error: 'UNAUTHENTICATED' });
      }

      const {
        title = 'Réunion Meetra',
        scheduledFor = null,
        timezone = null,
        durationMinutes = 60,
        hostName = null,
        hostEmail = null,
        hostPhone = null,
      } = req.body || {};

      if (scheduledFor) {
        const parsed = Date.parse(scheduledFor);
        if (Number.isNaN(parsed)) {
          return res.status(400).json({ error: 'INVALID_SCHEDULED_DATE' });
        }
      }

      const room = await roomService.createScheduledRoom({
        title,
        scheduledFor,
        timezone,
        durationMinutes,
        hostName: authenticated.name || hostName,
        hostEmail: authenticated.email || hostEmail,
        hostPhone,
        source: 'api',
        createdByUserId: authenticated.id,
        createdByEmail: authenticated.email,
        createdByName: authenticated.name,
      });
      const joinBase = resolveMeetingJoinBase(req);
      const joinUrl = joinBase ? `${joinBase}/room/${room.roomId}` : null;

      logger.info('Room created:', room.roomId);
      if (authenticated.email) {
        try {
          await upsertHubProfile({ email: authenticated.email, name: authenticated.name || authenticated.email });
          await appendHubActivity({
            type: 'meeting',
            title: 'Réunion créée',
            body: `"${title}" est prête${scheduledFor ? ` pour ${new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone || undefined }).format(new Date(scheduledFor))}` : ' à démarrer'}.`,
            targetEmail: authenticated.email,
            actorEmail: authenticated.email,
            actorName: authenticated.name || authenticated.email,
            meta: { roomId: room.roomId, joinUrl },
          });
        } catch (hubError) {
          logger.warn('Hub activity sync skipped on room create:', hubError?.message);
        }
      }
      res.json({
        roomId: room.roomId,
        joinUrl,
        title: room.metadata?.title || title,
        scheduledFor: room.metadata?.scheduledFor || null,
        timezone: room.metadata?.timezone || null,
        durationMinutes: room.metadata?.durationMinutes || durationMinutes,
        hostName: room.metadata?.hostName || authenticated.name || hostName || null,
        hostEmail: room.metadata?.hostEmail || authenticated.email || hostEmail || null,
        hostPhone: room.metadata?.hostPhone || hostPhone || null,
      });
    } catch (err) {
      logger.error('createRoom error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/rooms/:roomId — vérifier si une salle existe ─
  app.get('/api/rooms/:roomId', async (req, res) => {
    try {
      const authenticated = await resolveRequestUser(req);
      const info = await roomService.getMeetingRoomInfo(req.params.roomId);
      if (info) {
        res.json({
          exists: true,
          ...info,
          canJoinAsHost: Boolean(authenticated && canManageMeeting(info, authenticated)),
        });
      } else {
        res.json({ exists: false });
      }
    } catch (err) {
      logger.error('getRoomInfo error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/rooms/:roomId', async (req, res) => {
    try {
      const authenticated = await resolveRequestUser(req);
      if (!authenticated) {
        return res.status(401).json({ error: 'UNAUTHENTICATED' });
      }

      const { roomId } = req.params;
      const existing = await roomService.getMeetingRoomInfo(roomId);
      if (!existing) {
        return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
      }
      if (!canManageMeeting(existing, authenticated)) {
        return res.status(403).json({ error: 'MEETING_ACCESS_DENIED' });
      }

      const {
        title,
        scheduledFor,
        timezone,
        durationMinutes,
        hostName,
        hostEmail,
        hostPhone,
      } = req.body || {};

      if (scheduledFor) {
        const parsed = Date.parse(scheduledFor);
        if (Number.isNaN(parsed)) {
          return res.status(400).json({ error: 'INVALID_SCHEDULED_DATE' });
        }
      }

      const updated = await roomService.updateMeetingSchedule(roomId, {
        title,
        scheduledFor,
        timezone,
        durationMinutes,
        hostName: authenticated.name || hostName,
        hostEmail: authenticated.email || hostEmail,
        hostPhone,
      });

      const joinBase = resolveMeetingJoinBase(req);
      if (authenticated.email || updated.metadata?.hostEmail) {
        const targetEmail = authenticated.email || updated.metadata?.hostEmail;
        const targetName = authenticated.name || updated.metadata?.hostName || targetEmail;
        try {
          await upsertHubProfile({ email: targetEmail, name: targetName });
          await appendHubActivity({
            type: 'meeting-update',
            title: 'Réunion mise à jour',
            body: `"${updated.metadata?.title || title || 'Réunion Meetra'}" a été mise à jour.`,
            targetEmail,
            actorEmail: targetEmail,
            actorName: targetName,
            meta: { roomId, joinUrl: joinBase ? `${joinBase}/room/${roomId}` : null },
          });
        } catch (hubError) {
          logger.warn('Hub activity sync skipped on room update:', hubError?.message);
        }
      }
      return res.json(serializeMeetingSummary({
        roomId,
        ...updated,
        title: updated.metadata?.title,
        scheduledFor: updated.metadata?.scheduledFor,
        timezone: updated.metadata?.timezone,
        durationMinutes: updated.metadata?.durationMinutes,
        hostName: updated.metadata?.hostName,
        hostEmail: updated.metadata?.hostEmail,
        hostPhone: updated.metadata?.hostPhone,
      }, joinBase));
    } catch (err) {
      logger.error('updateRoom error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/meetings', async (req, res) => {
    try {
      const authenticated = await resolveRequestUser(req);
      if (!authenticated) {
        return res.status(401).json({ error: 'UNAUTHENTICATED' });
      }

      const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20);
      const meetings = (await roomService.getRecentMeetings(limit * 3)).filter((meeting) =>
        canManageMeeting({ metadata: meeting.metadata || meeting }, authenticated)
      ).slice(0, limit);
      const joinBase = resolveMeetingJoinBase(req);
      res.json({
        meetings: meetings.map((meeting) => serializeMeetingSummary(meeting, joinBase)),
      });
    } catch (err) {
      logger.error('listMeetings error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/rooms/:roomId/participants ────────────────────
  // Retourne la liste détaillée des participants avec leur statut
  // micro, caméra, main levée, et rôle hôte.
  // Utilisé par WaitingRoom.jsx pour afficher qui est déjà connecté.
  app.get('/api/rooms/:roomId/participants', async (req, res) => {
    try {
      const { roomId } = req.params;
      const info = await roomService.getMeetingRoomInfo(roomId);

      // Salle introuvable → tableau vide (pas d'erreur 404,
      // car la salle peut ne pas encore exister au moment où
      // le premier utilisateur arrive dans la salle d'attente)
      if (!info) {
        return res.json({
          exists:       false,
          participants: [],
          hostId:       null,
          locked:       false,
          count:        0,
        });
      }

      // Enrichir chaque participant avec son statut et son rôle
      const participants = (info.participants || []).map(p => ({
        socketId:     p.socketId,
        name:         p.name || p.userName || 'Participant',
        audioEnabled: p.audioEnabled ?? true,
        videoEnabled: p.videoEnabled ?? true,
        handRaised:   p.handRaised   ?? false,
        isHost:       p.socketId === info.hostId,
        joinedAt:     p.joinedAt || null,
      }));

      // Trier : hôte en premier, puis par ordre d'arrivée
      participants.sort((a, b) => {
        if (a.isHost && !b.isHost) return -1;
        if (!a.isHost && b.isHost) return  1;
        if (a.joinedAt && b.joinedAt) return new Date(a.joinedAt) - new Date(b.joinedAt);
        return 0;
      });

      logger.debug(`GET participants for ${roomId}: ${participants.length} found`);

      res.json({
        exists:       true,
        participants,
        hostId:       info.hostId,
        locked:       info.locked,
        count:        participants.length,
      });
    } catch (err) {
      logger.error('getParticipants error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
