import express from 'express';
import cors from 'cors';
import { corsOptions } from './config/cors.js';
import * as roomService from './rooms/roomService.js';
import { logger } from './utils/logger.js';
import { createTranscriptionRouter } from './routes/transcriptionRoutes.js';
import { purgeExpiredTranscriptFiles } from './services/transcription/transcriptPersistenceService.js';

export function createApp() {
  const app = express();

  purgeExpiredTranscriptFiles();

  app.use(cors(corsOptions));
  app.use(express.json());
  app.use('/api', createTranscriptionRouter());

  // ── Health check ──────────────────────────────────────────
  app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

  // ── POST /api/rooms — créer une salle ─────────────────────
  app.post('/api/rooms', (req, res) => {
    try {
      const room = roomService.createRoom();
      logger.info('Room created:', room.id);
      res.json({ roomId: room.id });
    } catch (err) {
      logger.error('createRoom error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/rooms/:roomId — vérifier si une salle existe ─
  app.get('/api/rooms/:roomId', (req, res) => {
    try {
      const info = roomService.getRoomInfo(req.params.roomId);
      if (info) {
        res.json({ exists: true, ...info });
      } else {
        res.json({ exists: false });
      }
    } catch (err) {
      logger.error('getRoomInfo error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/rooms/:roomId/participants ────────────────────
  // Retourne la liste détaillée des participants avec leur statut
  // micro, caméra, main levée, et rôle hôte.
  // Utilisé par WaitingRoom.jsx pour afficher qui est déjà connecté.
  app.get('/api/rooms/:roomId/participants', (req, res) => {
    try {
      const { roomId } = req.params;
      const info = roomService.getRoomInfo(roomId);

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
