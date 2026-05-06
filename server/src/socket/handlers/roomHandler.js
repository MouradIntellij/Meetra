// server/src/socket/handlers/roomHandler.js
//
// SALLE D'ATTENTE greffée sur votre roomService/roomStore existants.
// ─── CE QUI NE CHANGE PAS ────────────────────────────────────────────────────
//   roomService.js  → intact  (server/src/rooms/roomService.js)
//   roomStore.js    → intact  (server/src/rooms/roomStore.js)
// ─── CE QUI EST AJOUTÉ ────────────────────────────────────────────────────────
//   waitingQueues   → Map en mémoire LOCAL à ce fichier  (roomId → guest[])
//   ADMIT_GUEST / DENY_GUEST   → nouveaux handlers
//   WAITING_ROOM_GUEST / GUEST_ADMITTED / GUEST_DENIED / WAITING_ROOM_STATUS
// ─────────────────────────────────────────────────────────────────────────────

import * as roomService from '../../rooms/roomService.js';
import * as roomStore   from '../../rooms/roomStore.js';
import { logger }       from '../../utils/logger.js';
import { resolveAuthenticatedUserFromToken } from '../../services/auth/authService.js';
import { notifyHostWaitingGuest } from '../../services/notifications/hostAlertService.js';
import { ENV } from '../../config/env.js';

// ─── Événements (ajoutez ces 6 lignes dans constants/events.js aussi) ─────────
import * as EV from '../../constants/events.js';

const ADMIT_GUEST         = 'admit-guest';
const DENY_GUEST          = 'deny-guest';
const WAITING_ROOM_GUEST  = 'waiting-room-guest';
const GUEST_ADMITTED      = 'guest-admitted';
const GUEST_DENIED        = 'guest-denied';
const WAITING_ROOM_STATUS = 'waiting-room-status';
const WAITING_ROOM_UPDATE = 'waiting-room-update';

// ─── File d'attente locale (roomId → [{ socketId, userName, joinedAt }]) ──────
// Séparée de roomStore pour ne pas modifier votre schéma existant.
const waitingQueues = new Map();

function getQueue(roomId) {
  if (!waitingQueues.has(roomId)) waitingQueues.set(roomId, []);
  return waitingQueues.get(roomId);
}

export function listWaitingGuests(roomId) {
  return [...getQueue(roomId)];
}

function removeFromQueue(roomId, socketId) {
  const q = getQueue(roomId);
  const idx = q.findIndex((g) => g.socketId === socketId);
  if (idx !== -1) q.splice(idx, 1);
}

function broadcastWaitingQueue(io, roomId) {
  io.to(roomId).emit(WAITING_ROOM_UPDATE, {
    waitingList: listWaitingGuests(roomId),
  });
}

function canManageMeeting(meeting, user) {
  if (!meeting?.metadata || !user?.email) return false;
  return (
    (meeting.metadata.createdByUserId && meeting.metadata.createdByUserId === user.id)
    || (meeting.metadata.createdByEmail && meeting.metadata.createdByEmail === user.email)
    || (meeting.metadata.hostEmail && meeting.metadata.hostEmail === user.email)
  );
}

function normalizeRoomId(value) {
  return String(value || '').trim().toLowerCase();
}

function buildJoinUrl(roomId) {
  const baseUrl = String(ENV.CLIENT_URL || '').trim().replace(/\/+$/, '');
  return baseUrl ? `${baseUrl}/room/${roomId}` : roomId;
}

// ─── Handler principal ────────────────────────────────────────────────────────
export function registerRoomHandlers(io, socket) {

  // ── JOIN_ROOM ───────────────────────────────────────────────────────────────
  socket.on(EV.JOIN_ROOM, async ({ roomId, userName, userId, isHost = false, authToken = '' }) => {
    try {
      roomId = normalizeRoomId(roomId);
      const existingRoom = roomStore.getRoom(roomId);
      const meetingInfo = await roomService.getMeetingRoomInfo(roomId);
      const authenticated = authToken ? await resolveAuthenticatedUserFromToken(authToken) : null;
      const canJoinAsHost = Boolean(authenticated && canManageMeeting(meetingInfo, authenticated));

      if (existingRoom?.locked || meetingInfo?.locked) {
        socket.emit(GUEST_DENIED, { reason: 'room_locked' });
        return;
      }

      // 2. Un vrai hôte doit être authentifié et propriétaire de la réunion.
      if (isHost) {
        if (!canJoinAsHost) {
          socket.emit(GUEST_DENIED, { reason: 'host_auth_required' });
          return;
        }

        await _admitToRoom(io, socket, roomId, userName, userId, true);

        // Si des invités attendaient avant l'arrivée de l'hôte, les pousser au panneau d'attente.
        const queue = getQueue(roomId);
        queue.forEach((guest) => {
          socket.emit(WAITING_ROOM_GUEST, {
            socketId: guest.socketId,
            userName: guest.userName,
            joinedAt: guest.joinedAt,
          });
        });
        socket.emit(WAITING_ROOM_UPDATE, { waitingList: listWaitingGuests(roomId) });
        return;
      }

      // 3. Un invité ne peut rejoindre que si la réunion existe déjà.
      if (!meetingInfo) {
        socket.emit(GUEST_DENIED, { reason: 'room_unavailable' });
        return;
      }

      // 4. Tous les invités passent par la salle d'attente.
      removeFromQueue(roomId, socket.id);

      const guest = { socketId: socket.id, userName, userId, joinedAt: Date.now() };
      socket._meetraName  = userName;
      socket._meetraRoom  = roomId;
      socket._meetraUserId = userId;

      getQueue(roomId).push(guest);

      const queue = getQueue(roomId);
      socket.emit(WAITING_ROOM_STATUS, {
        position: queue.length,
        total:    queue.length,
      });

      io.to(roomId).emit(WAITING_ROOM_GUEST, {
        socketId: socket.id,
        userName,
        joinedAt: guest.joinedAt,
      });
      broadcastWaitingQueue(io, roomId);

      notifyHostWaitingGuest({
        meeting: meetingInfo,
        roomId,
        guestName: userName,
        joinUrl: buildJoinUrl(roomId),
      }).catch((error) => {
        logger.warn(`[WaitingRoom] host notification skipped for ${roomId}: ${error?.message}`);
      });

      logger.info(`[WaitingRoom] "${userName}" (${socket.id}) attend dans ${roomId}`);

    } catch (err) {
      logger.error(`[JOIN_ROOM] Erreur : ${err.message}`);
      socket.emit('error', { message: 'Impossible de rejoindre la salle.' });
    }
  });

  // ── ADMIT_GUEST ─────────────────────────────────────────────────────────────
  socket.on(ADMIT_GUEST, async ({ roomId, guestSocketId, targetSocketId }) => {
    roomId = normalizeRoomId(roomId);
    guestSocketId = guestSocketId || targetSocketId;

    // Vérifier que c'est bien l'hôte qui admet
    if (!roomService.isModerator(roomId, socket.id)) {
      logger.warn(`[ADMIT_GUEST] socket ${socket.id} n'est pas modérateur de ${roomId}`);
      return;
    }

    const guest = getQueue(roomId).find((g) => g.socketId === guestSocketId);
    if (!guest) {
      logger.warn(`[ADMIT_GUEST] guest ${guestSocketId} introuvable dans la file de ${roomId}`);
      return;
    }

    removeFromQueue(roomId, guestSocketId);
    broadcastWaitingQueue(io, roomId);

    const guestSocket = io.sockets.sockets.get(guestSocketId);
    if (!guestSocket) {
      logger.warn(`[ADMIT_GUEST] guest ${guestSocketId} déconnecté avant d'être admis`);
      return;
    }

    // Admettre le guest dans la salle
    await _admitToRoom(io, guestSocket, roomId, guest.userName, guest.userId, false);
    logger.info(`[WaitingRoom] "${guest.userName}" admis dans ${roomId}`);
  });

  // ── DENY_GUEST ──────────────────────────────────────────────────────────────
  socket.on(DENY_GUEST, ({ roomId, guestSocketId, targetSocketId }) => {
    roomId = normalizeRoomId(roomId);
    guestSocketId = guestSocketId || targetSocketId;

    if (!roomService.isModerator(roomId, socket.id)) return;

    removeFromQueue(roomId, guestSocketId);
    broadcastWaitingQueue(io, roomId);

    const guestSocket = io.sockets.sockets.get(guestSocketId);
    if (guestSocket) {
      guestSocket.emit(GUEST_DENIED, { reason: 'host_denied' });
    }

    logger.info(`[WaitingRoom] guest ${guestSocketId} refusé dans ${roomId}`);
  });

  // ── LEAVE_ROOM ──────────────────────────────────────────────────────────────
  socket.on(EV.LEAVE_ROOM, () => _handleLeave(io, socket));

  // ── DISCONNECT ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    // Nettoyer la file d'attente si le guest était en attente
    const roomId = socket._meetraRoom;
    if (roomId) {
      removeFromQueue(roomId, socket.id);
      broadcastWaitingQueue(io, roomId);
    }

    _handleLeave(io, socket);
  });

  // ── Autres handlers existants (conservés tels quels) ───────────────────────

  socket.on(EV.LOCK_ROOM, async ({ roomId, locked }) => {
    if (!roomService.isModerator(roomId, socket.id)) return;
    await roomService.lockRoom(roomId, locked);
    io.to(roomId).emit(EV.LOCK_ROOM, { locked });

    // Si on verrouille, refuser tous les guests en attente
    if (locked) {
      const queue = [...getQueue(roomId)];
      queue.forEach(({ socketId }) => {
        removeFromQueue(roomId, socketId);
        const s = io.sockets.sockets.get(socketId);
        if (s) s.emit(GUEST_DENIED, { reason: 'room_locked' });
      });
      broadcastWaitingQueue(io, roomId);
    }
  });

  socket.on(EV.MUTE_ALL, ({ roomId }) => {
    if (!roomService.isModerator(roomId, socket.id)) return;
    io.to(roomId).emit(EV.MUTE_ALL);
  });

  socket.on(EV.KICK_USER, ({ roomId, targetSocketId }) => {
    if (!roomService.isModerator(roomId, socket.id)) return;
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.emit(EV.KICK_USER);
      targetSocket.leave(roomId);
    }
    io.to(roomId).emit(EV.USER_LEFT, { socketId: targetSocketId });
  });

  socket.on(EV.ASSIGN_HOST, ({ roomId, targetSocketId }) => {
    if (!roomService.isHost(roomId, socket.id)) return;
    roomService.setHost(roomId, targetSocketId);
    io.to(roomId).emit(EV.ASSIGN_HOST, { socketId: targetSocketId });
  });

  socket.on(EV.RAISE_HAND, ({ roomId, raised }) => {
    roomService.updateParticipantStatus(socket.id, { handRaised: raised });
    socket.to(roomId).emit(EV.RAISE_HAND, { socketId: socket.id, raised });
  });

  socket.on(EV.CHAT_MESSAGE, ({ roomId, message }) => {
    io.to(roomId).emit(EV.CHAT_MESSAGE, {
      socketId: socket.id,
      message,
      timestamp: Date.now(),
    });
  });

  socket.on(EV.REACTION, ({ roomId, reaction }) => {
    io.to(roomId).emit(EV.REACTION, { socketId: socket.id, reaction });
  });

  socket.on(EV.SCREEN_SHARE_START, ({ roomId }) => {
    socket.to(roomId).emit(EV.SCREEN_SHARE_START, { socketId: socket.id });
  });

  socket.on(EV.SCREEN_SHARE_STOP, ({ roomId }) => {
    socket.to(roomId).emit(EV.SCREEN_SHARE_STOP, { socketId: socket.id });
  });

}

// ─── Admettre un participant dans la salle (hôte ou guest admis) ──────────────
async function _admitToRoom(io, socket, roomId, userName, userId, isHostFlag) {
  socket._meetraName   = userName;
  socket._meetraRoom   = roomId;
  socket._meetraUserId = userId;

  // Utilise votre roomService.joinRoom existant
  const result = await roomService.joinRoom(roomId, {
    socketId: socket.id,
    userId:   userId || socket.id,
    userName,
  });

  if (result?.error === 'ROOM_LOCKED') {
    socket.emit(GUEST_DENIED, { reason: 'room_locked' });
    return;
  }

  // Si c'est le premier arrivé (hôte), forcer hostId dans roomStore
  if (isHostFlag) {
    const room = roomStore.getRoom(roomId);
    if (room && !room.hostId) {
      room.hostId = socket.id;
    }
  }

  socket.join(roomId);

  // Récupérer l'état complet de la salle
  const participants = roomService.getParticipants(roomId);
  const room         = roomStore.getRoom(roomId);

  // Confirmer au participant admis
  socket.emit(EV.ROOM_JOINED, {
    roomId,
    hostSocketId: room?.hostId,
    participants,
    isHost: isHostFlag,
  });

  // Si c'est un guest admis → lui envoyer GUEST_ADMITTED en plus
  if (!isHostFlag) {
    socket.emit(GUEST_ADMITTED);
  }

  // Informer les autres participants
  socket.to(roomId).emit(EV.USER_JOINED, {
    socketId: socket.id,
    userName,
    isHost: isHostFlag,
  });

  logger.info(`[Room] "${userName}" (${socket.id}) a rejoint ${roomId} (isHost=${isHostFlag})`);
}

// ─── Gérer le départ d'un participant ────────────────────────────────────────
async function _handleLeave(io, socket) {
  const result = await roomService.leaveRoom(socket.id);
  if (!result) return;

  const { roomId, room } = result;

  socket.leave(roomId);
  io.to(roomId).emit(EV.USER_LEFT, { socketId: socket.id });

  // Réassigner l'hôte si l'hôte est parti et qu'il reste des participants
  if (room && room.hostId === socket.id && room.participants.size > 0) {
    const newHost = room.participants.values().next().value;
    roomService.setHost(roomId, newHost.socketId);
    io.to(roomId).emit(EV.ASSIGN_HOST, { socketId: newHost.socketId });
    logger.info(`[Room] Nouvel hôte : "${newHost.name}" dans ${roomId}`);
  }

  // Nettoyer la file d'attente si la salle est vide
  if (!room || room.participants.size === 0) {
    waitingQueues.delete(roomId);
    logger.info(`[Room] Salle ${roomId} fermée`);
  }

  logger.info(`[Room] "${socket._meetraName}" (${socket.id}) a quitté ${roomId}`);
}
