import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { useRoom } from '../context/RoomContext.jsx';
import { useMedia } from '../context/MediaContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { EVENTS } from '../utils/events.js';

export function useWebRTC(roomId, userName) {
  const { socket } = useSocket();
  const {
    setHostId, setLocked, setParticipants,
    addParticipant, removeParticipant, updateParticipant,
    setBreakoutRooms, setCurrentBreakout,
  } = useRoom();
  const { setActiveSpeakerId } = useUI();
  const { getMedia } = useMedia();

  // Track hand state locally so we can toggle
  const handRaisedRef = useRef(false);

  // ── Join room ─────────────────────────────────────────────
  const joinRoom = useCallback(async () => {
    const stream = await getMedia();
    console.log(`[Join] Joining room ${roomId} as ${userName}`);
    socket.emit(EVENTS.JOIN_ROOM, { roomId, userId: socket.id, userName });
    return stream;
  }, [socket, roomId, userName, getMedia]);

  // ── Socket listeners ──────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Receive participant list on join
    socket.on(EVENTS.ROOM_PARTICIPANTS, ({ participants, hostId, locked }) => {
      console.log('[Room] Participants received:', participants);
      const others = participants.filter(p => p.socketId !== socket.id);
      setParticipants(others);
      setHostId(hostId);
      setLocked(locked);
    });

    // New participant joins
    socket.on(EVENTS.USER_JOINED, (user) => {
      if (user.socketId === socket.id) return;
      // BUG FIX: server sends { name } but code was reading { userName }
      // Normalize both so UI always has a name
      const displayName = user.name || user.userName || 'Inconnu';
      console.log(`[Room] ${displayName} joined`);
      addParticipant({
        ...user,
        name: displayName,
        userName: displayName,
        socketId: user.socketId,
      });
      if (user.hostId) setHostId(user.hostId);
    });

    socket.on(EVENTS.HOST_CHANGED, ({ newHostId }) => setHostId(newHostId));
    socket.on(EVENTS.ROOM_LOCKED, ({ locked }) => setLocked(locked));

    socket.on(EVENTS.VIDEO_TOGGLED, ({ userId, enabled }) =>
      updateParticipant(userId, { videoEnabled: enabled }));
    socket.on(EVENTS.AUDIO_TOGGLED, ({ userId, enabled }) =>
      updateParticipant(userId, { audioEnabled: enabled }));

    // Active speaker detection
    const speakerMap = new Map();
    socket.on(EVENTS.AUDIO_LEVEL, ({ userId, level }) => {
      speakerMap.set(userId, level);
      let maxId = null, maxLevel = 8;
      speakerMap.forEach((l, id) => { if (l > maxLevel) { maxLevel = l; maxId = id; } });
      setActiveSpeakerId(maxId);
    });

    socket.on(EVENTS.HAND_RAISED,  ({ userId, handOrder, handRaisedAt }) => updateParticipant(userId, { handRaised: true, handOrder, handRaisedAt }));
    socket.on(EVENTS.HAND_LOWERED, ({ userId }) => updateParticipant(userId, { handRaised: false, handOrder: null, handRaisedAt: null }));

    socket.on(EVENTS.BREAKOUT_UPDATED,  ({ breakoutRooms }) => setBreakoutRooms(breakoutRooms));
    socket.on(EVENTS.BREAKOUT_ASSIGNED, ({ breakoutId, breakoutName }) =>
      setCurrentBreakout({ id: breakoutId, name: breakoutName }));
    socket.on(EVENTS.BREAKOUT_END_ALL, () => setCurrentBreakout(null));

    return () => {
      socket.off(EVENTS.ROOM_PARTICIPANTS);
      socket.off(EVENTS.USER_JOINED);
      socket.off(EVENTS.HOST_CHANGED);
      socket.off(EVENTS.ROOM_LOCKED);
      socket.off(EVENTS.VIDEO_TOGGLED);
      socket.off(EVENTS.AUDIO_TOGGLED);
      socket.off(EVENTS.AUDIO_LEVEL);
      socket.off(EVENTS.HAND_RAISED);
      socket.off(EVENTS.HAND_LOWERED);
      socket.off(EVENTS.BREAKOUT_UPDATED);
      socket.off(EVENTS.BREAKOUT_ASSIGNED);
      socket.off(EVENTS.BREAKOUT_END_ALL);
    };
  }, [socket, setHostId, setLocked, setParticipants, addParticipant,
    updateParticipant, setBreakoutRooms, setCurrentBreakout, setActiveSpeakerId]);

  // ── Toggle hand raise (raise on 1st click, lower on 2nd) ─
  const toggleHand = useCallback(() => {
    if (!socket) return;
    if (handRaisedRef.current) {
      socket.emit(EVENTS.LOWER_HAND, { roomId });
      handRaisedRef.current = false;
    } else {
      socket.emit(EVENTS.RAISE_HAND, { roomId });
      handRaisedRef.current = true;
    }
  }, [socket, roomId]);

  return { joinRoom, toggleHand };
}
