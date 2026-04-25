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
    setBreakoutRooms, setCurrentBreakout, setScreenSharingId, screenSharingId,
  } = useRoom();
  const { setActiveSpeakerId } = useUI();
  const { getMedia } = useMedia();

  // Local ref so toggleHand works without stale closure
  const handRaisedRef = useRef(false);

  // ── Join ─────────────────────────────────────────────────
  const joinRoom = useCallback(async () => {
    const stream = await getMedia();
    socket.emit(EVENTS.JOIN_ROOM, { roomId, userId: socket.id, userName });
    return stream;
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

    socket.on(EVENTS.ROOM_PARTICIPANTS, ({ participants, hostId, locked }) => {
      const others = participants.filter(p => p.socketId !== socket.id);
      setParticipants(others);
      setHostId(hostId);
      setLocked(locked);
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
      });
      if (user.hostId) setHostId(user.hostId);
    });

    socket.on(EVENTS.HOST_CHANGED,  ({ newHostId }) => setHostId(newHostId));
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
      socket.off(EVENTS.USER_JOINED);
      socket.off(EVENTS.HOST_CHANGED);
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
  }, [socket, setHostId, setLocked, setParticipants, addParticipant,
    updateParticipant, setBreakoutRooms, setCurrentBreakout, setActiveSpeakerId, setScreenSharingId, screenSharingId]);

  return { joinRoom, toggleHand };
}
