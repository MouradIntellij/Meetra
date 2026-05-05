import express from 'express';
import * as roomService from '../rooms/roomService.js';
import { getBearerToken } from './authRoutes.js';
import { resolveAuthenticatedUserFromToken } from '../services/auth/authService.js';
import { createLiveKitParticipantToken, getLiveKitStatus } from '../services/livekit/livekitTokenService.js';

function normalizeRoomId(value) {
  return String(value || '').trim().toLowerCase();
}

function canManageMeeting(meeting, user) {
  if (!meeting?.metadata || !user?.email) return false;
  return (
    (meeting.metadata.createdByUserId && meeting.metadata.createdByUserId === user.id)
    || (meeting.metadata.createdByEmail && meeting.metadata.createdByEmail === user.email)
    || (meeting.metadata.hostEmail && meeting.metadata.hostEmail === user.email)
  );
}

export function createLiveKitRouter() {
  const router = express.Router();

  router.get('/livekit/status', (_req, res) => {
    const status = getLiveKitStatus();
    return res.json({
      enabled: status.enabled,
      configured: status.configured,
      url: status.enabled ? status.url : '',
    });
  });

  router.post('/livekit/token', async (req, res) => {
    try {
      const { roomId, userName = '', userId = '', asHost = false } = req.body || {};
      const normalizedRoomId = normalizeRoomId(roomId);
      if (!normalizedRoomId || !String(userName || '').trim()) {
        return res.status(400).json({ error: 'LIVEKIT_TOKEN_PAYLOAD_INVALID' });
      }

      const meeting = await roomService.getMeetingRoomInfo(normalizedRoomId);
      if (!meeting) {
        return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
      }

      const authenticated = await resolveAuthenticatedUserFromToken(getBearerToken(req));
      const mayJoinAsHost = Boolean(authenticated && canManageMeeting(meeting, authenticated));
      if (asHost && !mayJoinAsHost) {
        return res.status(403).json({ error: 'LIVEKIT_HOST_ACCESS_DENIED' });
      }

      const result = await createLiveKitParticipantToken({
        roomId: normalizedRoomId,
        userName: authenticated?.name || userName,
        userId: authenticated?.id || userId,
        role: mayJoinAsHost ? 'host' : 'participant',
      });

      if (result.error) {
        const status = result.error === 'LIVEKIT_DISABLED' ? 403 : 503;
        return res.status(status).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'LIVEKIT_TOKEN_FAILED' });
    }
  });

  return router;
}
