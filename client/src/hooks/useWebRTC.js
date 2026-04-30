import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { useRoom } from '../context/RoomContext.jsx';
import { useMedia } from '../context/MediaContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { EVENTS } from '../utils/events.js';

export function useWebRTC(roomId, userName) {
  const { socket } = useSocket();
  const {
    setHostId, setLocked, setParticipants, setCoHostIds,
    addParticipant, removeParticipant, updateParticipant,
    setBreakoutRooms, setCurrentBreakout, setScreenSharingId, screenSharingId,
  } = useRoom();
  const { setActiveSpeakerId } = useUI();
  const { getMedia } = useMedia();

  // Local ref so toggleHand works without stale closure
  const handRaisedRef = useRef(false);

  // ── Join ─────────────────────────────────────────────────
  const joinRoom = useCallback(async () => {
    let stream = null;
    try {
      stream = await getMedia();
    } catch {
      stream = null;
    }

    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanupJoinListeners = () => {
        socket.off(EVENTS.ROOM_PARTICIPANTS, handleAccepted);
        socket.off(EVENTS.WAITING_REQUIRED, handleWaitingRequired);
        socket.off(EVENTS.ROOM_LOCKED, handleLocked);
      };

      const finish = (callback) => {
        if (settled) return;
        settled = true;
        cleanupJoinListeners();
        callback();
      };

      const handleAccepted = () => finish(() => resolve(stream));
      const handleWaitingRequired = ({ message }) => finish(() => reject(new Error(message || 'WAITING_REQUIRED')));
      const handleLocked = ({ message }) => finish(() => reject(new Error(message || 'ROOM_LOCKED')));

      socket.once(EVENTS.ROOM_PARTICIPANTS, handleAccepted);
      socket.once(EVENTS.WAITING_REQUIRED, handleWaitingRequired);
      socket.once(EVENTS.ROOM_LOCKED, handleLocked);
      socket.emit(EVENTS.JOIN_ROOM, { roomId, userId: socket.id, userName });
    });
  }, [socket, roomId, userName, getMedia]);

  // ── toggleHand: alternates RAISE / LOWER each call ───────
  const toggleHand = useCallback(() => {
    if (!socket) return;
    const willRaise = !handRaisedRef.current;
    handRaisedRef.current = willRaise;

    if (willRaise) {
      socket.emit(EVENTS.RAISE_HAND, { roomId });
    } else {
      socket.emit(EVENTS.LOWER_HAND, { roomId });
    }
  }, [socket, roomId]);

  // ── Socket listeners ──────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on(EVENTS.ROOM_JOINED, ({ participants = [], hostSocketId, isHost, roomId: joinedRoomId }) => {
      const others = participants.filter((p) => p.socketId !== socket.id);
      setParticipants(others);
      setHostId(hostSocketId || (isHost ? socket.id : ''));
      if (joinedRoomId !== roomId) return;
    });

    socket.on(EVENTS.ROOM_PARTICIPANTS, ({ participants, hostId, locked, coHostIds = [] }) => {
      const others = participants.filter(p => p.socketId !== socket.id);
      setParticipants(others);
      setHostId(hostId);
      setLocked(locked);
      setCoHostIds(coHostIds);
    });

    socket.on(EVENTS.USER_JOINED, (user) => {
      if (user.socketId === socket.id) return;
      const displayName = user.name || user.userName || 'Inconnu';
      addParticipant({
        ...user,
        name:     displayName,
        userName: displayName,
        socketId: user.socketId,
        audioEnabled: true,
        videoEnabled: true,
        handRaised:   false,
        isCoHost: user.coHostIds?.includes?.(user.socketId) || false,
      });
      if (user.hostId) setHostId(user.hostId);
      if (user.coHostIds) setCoHostIds(user.coHostIds);
    });

    socket.on(EVENTS.ASSIGN_HOST, ({ socketId }) => setHostId(socketId));
    socket.on(EVENTS.HOST_CHANGED,  ({ newHostId }) => setHostId(newHostId));
    socket.on(EVENTS.COHOSTS_UPDATED, ({ coHostIds = [] }) => setCoHostIds(coHostIds));
    socket.on(EVENTS.ROOM_LOCKED,   ({ locked }) => setLocked(locked));

    socket.on(EVENTS.VIDEO_TOGGLED, ({ userId, enabled }) =>
      updateParticipant(userId, { videoEnabled: enabled }));
    socket.on(EVENTS.AUDIO_TOGGLED, ({ userId, enabled }) =>
      updateParticipant(userId, { audioEnabled: enabled }));
    socket.on(EVENTS.SCREEN_START, ({ userId }) => setScreenSharingId(userId));
    socket.on(EVENTS.SCREEN_STOP, () => setScreenSharingId(null));

    // Active speaker
    const speakerMap = new Map();
    socket.on(EVENTS.AUDIO_LEVEL, ({ userId, level }) => {
      speakerMap.set(userId, level);
      let maxId = null, maxLevel = 8;
      speakerMap.forEach((l, id) => { if (l > maxLevel) { maxLevel = l; maxId = id; } });
      setActiveSpeakerId(maxId);
    });

    socket.on(EVENTS.HAND_RAISED,  ({ userId }) => {
      updateParticipant(userId, { handRaised: true });
    });
    socket.on(EVENTS.HAND_LOWERED, ({ userId }) => {
      updateParticipant(userId, { handRaised: false });
    });

    socket.on(EVENTS.BREAKOUT_UPDATED,  ({ breakoutRooms }) => setBreakoutRooms(breakoutRooms));
    socket.on(EVENTS.BREAKOUT_ASSIGNED, ({ breakoutId, breakoutName }) =>
      setCurrentBreakout({ id: breakoutId, name: breakoutName }));
    socket.on(EVENTS.BREAKOUT_END_ALL, () => setCurrentBreakout(null));
    socket.on(EVENTS.USER_LEFT, ({ socketId }) => {
      if (socketId === screenSharingId) {
        setScreenSharingId(null);
      }
    });

    return () => {
      socket.off(EVENTS.ROOM_PARTICIPANTS);
      socket.off(EVENTS.ROOM_JOINED);
      socket.off(EVENTS.USER_JOINED);
      socket.off(EVENTS.ASSIGN_HOST);
      socket.off(EVENTS.HOST_CHANGED);
      socket.off(EVENTS.COHOSTS_UPDATED);
      socket.off(EVENTS.ROOM_LOCKED);
      socket.off(EVENTS.VIDEO_TOGGLED);
      socket.off(EVENTS.AUDIO_TOGGLED);
      socket.off(EVENTS.SCREEN_START);
      socket.off(EVENTS.SCREEN_STOP);
      socket.off(EVENTS.AUDIO_LEVEL);
      socket.off(EVENTS.HAND_RAISED);
      socket.off(EVENTS.HAND_LOWERED);
      socket.off(EVENTS.BREAKOUT_UPDATED);
      socket.off(EVENTS.BREAKOUT_ASSIGNED);
      socket.off(EVENTS.BREAKOUT_END_ALL);
      socket.off(EVENTS.USER_LEFT);
    };
  }, [socket, setHostId, setLocked, setParticipants, setCoHostIds, addParticipant,
    updateParticipant, setBreakoutRooms, setCurrentBreakout, setActiveSpeakerId, setScreenSharingId, screenSharingId]);

  return { joinRoom, toggleHand };
}
