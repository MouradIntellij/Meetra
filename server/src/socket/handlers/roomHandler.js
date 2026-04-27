import { EVENTS } from '../../constants/events.js';
import * as roomService from '../../rooms/roomService.js';
import { logger } from '../../utils/logger.js';
import { notifyHostWaitingGuest } from '../../services/notifications/hostAlertService.js';

// ─── Waiting room store (in-memory, par roomId) ───────────────
// Structure : Map<roomId, Map<socketId, { socketId, userName, joinedAt }>>
const waitingRooms = new Map();

function getWaiting(roomId) {
  if (!waitingRooms.has(roomId)) waitingRooms.set(roomId, new Map());
  return waitingRooms.get(roomId);
}

function waitingList(roomId) {
  return Array.from(getWaiting(roomId).values());
}

function broadcastWaitingUpdate(io, roomId) {
  const list = waitingList(roomId);

  // Notifier tous les gens EN ATTENTE de la liste à jour
  list.forEach(({ socketId }) => {
    io.to(socketId).emit(EVENTS.WAITING_UPDATE, { waitingList: list });
  });

  // Notifier l'hôte (dans la salle principale) qu'il y a des gens en attente
  const room = roomService.getRoomInfo(roomId);
  const moderators = new Set([room?.hostId, ...(room?.coHostIds || [])].filter(Boolean));
  moderators.forEach((socketId) => {
    io.to(socketId).emit(EVENTS.WAITING_UPDATE, { waitingList: list });
  });
}

// ─── Handler principal ────────────────────────────────────────
export function registerRoomHandlers(io, socket) {

  // ── Rejoindre la salle principale ─────────────────────────
  socket.on(EVENTS.JOIN_ROOM, async ({ roomId, userId, userName }) => {
    logger.socket(EVENTS.JOIN_ROOM, { roomId, userName });

    const result = await roomService.joinRoom(roomId, { socketId: socket.id, userId, userName });

    if (result.error === 'ROOM_LOCKED') {
      socket.emit(EVENTS.ROOM_LOCKED, { message: 'Room is locked by the host.' });
      return;
    }

    socket.join(roomId);
    socket.data.roomId   = roomId;
    socket.data.userId   = userId;
    socket.data.userName = userName;

    // Retirer de la salle d'attente s'il y était
    getWaiting(roomId).delete(socket.id);
    broadcastWaitingUpdate(io, roomId);

    const participants = roomService.getParticipants(roomId);
    const room = result.room;

    // Envoyer la liste complète au nouvel arrivant
    socket.emit(EVENTS.ROOM_PARTICIPANTS, {
      participants,
      hostId: room.hostId,
      locked: room.locked,
      coHostIds: roomService.getCoHostIds(roomId),
    });

    // Notifier les autres participants
    socket.to(roomId).emit(EVENTS.USER_JOINED, {
      id:           userId,
      socketId:     socket.id,
      name:         userName,
      userName:     userName,
      hostId:       room.hostId,
      coHostIds:    roomService.getCoHostIds(roomId),
      audioEnabled: true,
      videoEnabled: true,
      handRaised:   false,
    });

    logger.success(`${userName} joined room ${roomId} (${participants.length} total)`);
  });

  // ── Entrer en salle d'attente ──────────────────────────────
  // Émis par WaitingRoom.jsx au montage, AVANT de rejoindre la salle principale.
  socket.on(EVENTS.WAITING_JOIN, async ({ roomId, userName }) => {
    logger.socket(EVENTS.WAITING_JOIN, { roomId, userName });

    socket.data.roomId   = roomId;
    socket.data.userName = userName;
    socket.data.waiting  = true;

    // Ajouter à la salle d'attente
    getWaiting(roomId).set(socket.id, {
      socketId:  socket.id,
      userName,
      joinedAt:  Date.now(),
    });

    // Envoyer au nouvel arrivant : liste en attente + participants déjà dans la salle
    const room = roomService.getRoomInfo(roomId);
    socket.emit(EVENTS.WAITING_UPDATE, {
      waitingList:  waitingList(roomId),
      participants: room?.participants || [],
      hostId:       room?.hostId || null,
      coHostIds:    room?.coHostIds || [],
    });

    // Prévenir tout le monde (en attente + hôte) de la nouvelle liste
    broadcastWaitingUpdate(io, roomId);

    const meeting = await roomService.getMeetingRoomInfo(roomId);
    const joinUrl = process.env.CLIENT_URL
      ? `${String(process.env.CLIENT_URL).replace(/\/+$/, '')}/room/${roomId}`
      : null;
    notifyHostWaitingGuest({
      meeting,
      roomId,
      guestName: userName,
      joinUrl,
    }).catch(() => {});

    logger.info(`${userName} entered waiting room for ${roomId} (${getWaiting(roomId).size} waiting)`);
  });

  // ── Quitter la salle d'attente ─────────────────────────────
  socket.on(EVENTS.WAITING_LEAVE, ({ roomId }) => {
    getWaiting(roomId)?.delete(socket.id);
    socket.data.waiting = false;
    broadcastWaitingUpdate(io, roomId);
    logger.socket(EVENTS.WAITING_LEAVE, { roomId, socketId: socket.id });
  });

  // ── Hôte : admettre un utilisateur ────────────────────────
  socket.on(EVENTS.WAITING_ADMIT, ({ roomId, targetSocketId }) => {
    // Vérifier que c'est bien l'hôte qui émet
    if (!roomService.isModerator(roomId, socket.id)) {
      logger.warn(`WAITING_ADMIT refusé : ${socket.id} n'est pas l'hôte de ${roomId}`);
      return;
    }

    const waiting = getWaiting(roomId);
    const user = waiting.get(targetSocketId);
    if (!user) {
      logger.warn(`WAITING_ADMIT : ${targetSocketId} introuvable en salle d'attente`);
      return;
    }

    // Supprimer de la salle d'attente
    waiting.delete(targetSocketId);
    broadcastWaitingUpdate(io, roomId);

    // Notifier l'utilisateur qu'il est admis → il émettra JOIN_ROOM
    io.to(targetSocketId).emit(EVENTS.WAITING_ADMITTED, {
      roomId,
      message: 'L\'hôte vous a admis dans la réunion.',
    });

    logger.success(`${user.userName} admitted to ${roomId} by host`);
  });

  // ── Hôte : refuser un utilisateur ─────────────────────────
  socket.on(EVENTS.WAITING_REJECT, ({ roomId, targetSocketId }) => {
    if (!roomService.isModerator(roomId, socket.id)) return;

    const user = getWaiting(roomId)?.get(targetSocketId);
    getWaiting(roomId)?.delete(targetSocketId);
    broadcastWaitingUpdate(io, roomId);

    io.to(targetSocketId).emit(EVENTS.WAITING_REJECTED, {
      message: 'L\'hôte a refusé votre entrée dans la réunion.',
    });

    logger.info(`${user?.userName || targetSocketId} rejected from ${roomId}`);
  });

  // ── Hôte : admettre tout le monde ─────────────────────────
  socket.on(EVENTS.WAITING_ADMIT_ALL, ({ roomId }) => {
    if (!roomService.isModerator(roomId, socket.id)) return;

    const waiting = getWaiting(roomId);
    const toAdmit = Array.from(waiting.values());

    waiting.clear();
    broadcastWaitingUpdate(io, roomId);

    toAdmit.forEach(({ socketId }) => {
      io.to(socketId).emit(EVENTS.WAITING_ADMITTED, {
        roomId,
        message: 'L\'hôte vous a admis dans la réunion.',
      });
    });

    logger.success(`${toAdmit.length} user(s) admitted all at once to ${roomId}`);
  });

  // ── Déconnexion ───────────────────────────────────────────
  socket.on('disconnect', async () => {
    const { roomId, userName, waiting } = socket.data;

    // Si le socket était en salle d'attente → nettoyer
    if (waiting && roomId) {
      getWaiting(roomId)?.delete(socket.id);
      broadcastWaitingUpdate(io, roomId);
      logger.info(`${userName} left waiting room ${roomId} (disconnected)`);

      // Nettoyer la salle d'attente si elle est vide ET la salle principale aussi
      const mainRoom = roomService.getRoomInfo(roomId);
      if (!mainRoom && getWaiting(roomId)?.size === 0) {
        waitingRooms.delete(roomId);
      }
      return; // Pas besoin de traiter le leave de la salle principale
    }

    // Sinon : le socket était dans la salle principale
    const result = await roomService.leaveRoom(socket.id);
    if (!result) return;

    const { participant, room } = result;
    logger.info(`${participant?.name} left room ${roomId}`);

    // Réassigner l'hôte si nécessaire
    if (room && room.participants.size > 0 && room.hostId === socket.id) {
      const promotedCoHostId = Array.from(room.coHostIds || []).find((candidateId) => room.participants.has(candidateId));
      const newHost = promotedCoHostId
        ? room.participants.get(promotedCoHostId)
        : room.participants.values().next().value;
      if (newHost) {
        room.hostId = newHost.socketId;
        room.coHostIds?.delete(newHost.socketId);
        io.to(roomId).emit(EVENTS.HOST_CHANGED, { newHostId: newHost.socketId });
        io.to(roomId).emit(EVENTS.COHOSTS_UPDATED, { coHostIds: roomService.getCoHostIds(roomId) });

        // Notifier les gens EN ATTENTE du changement d'hôte
        broadcastWaitingUpdate(io, roomId);
      }
    }

    socket.to(roomId).emit(EVENTS.USER_LEFT, {
      id:       participant?.id,
      socketId: socket.id,
      name:     participant?.name,
    });

    // Si la salle principale est vide → nettoyer la salle d'attente aussi
    if (room && room.participants.size === 0) {
      // Renvoyer tout le monde en attente vers l'accueil
      waitingList(roomId).forEach(({ socketId: wSid }) => {
        io.to(wSid).emit(EVENTS.WAITING_REJECTED, {
          message: 'La réunion est terminée. Il n\'y a plus d\'hôte.',
        });
      });
      waitingRooms.delete(roomId);
    }
  });
}
